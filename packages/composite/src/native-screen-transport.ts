import { supportsNativePaintCanvas, type NativeElementImage } from '../../device/src/native-element-image';
import { createNativePaintCredit, type PaintGeneration } from '../../device/src/render-channels';
import type { NativePaintStamp } from '../../device/src/device-render-protocol';

/** Owns capture credit, not the panel React tree or worker. The caller appends
 * the stable panel host below this fresh canvas, then transfers the canvas
 * before any rendering context is acquired. Capture is only legal in paint.
 * Backend replacement disposes this owner but reparents the same panel host.
 */
export function createNativeScreenTransport(input: {
  readonly canvas: HTMLCanvasElement;
  readonly panel: HTMLElement;
  readonly generation: PaintGeneration;
  readonly send: (stamp: NativePaintStamp, image: NativeElementImage) => void;
  readonly fail: (error: unknown) => void;
}) {
  const { canvas, panel } = input;
  if (!supportsNativePaintCanvas(canvas)) throw new Error('Native DOM capture is unavailable');
  let disposed = false, requested = false, paintRevision = 0, visible = true;
  let consumptionDeadline: ReturnType<typeof setTimeout> | undefined;
  const credit = createNativePaintCredit(input.generation, () => {
    if (disposed || requested || !visible) return;
    requested = true;
    queueMicrotask(() => {
      if (disposed || !visible) { requested = false; return; }
      try { canvas.requestPaint(); }
      catch (error) { requested = false; retire(error); }
    });
  });
  const retire = (error: unknown) => { dispose(); input.fail(error); };
  const onPaint = () => {
    requested = false;
    if (disposed || !visible || panel.parentElement !== canvas) return;
    // A received native paint is immediately eligible, without scheduling a
    // second paint/RAF merely to consume the one the browser just delivered.
    const stamp = credit.begin(++paintRevision, true);
    if (!stamp) return;
    let owned: NativeElementImage | null = null;
    try {
      owned = canvas.captureElementImage(panel);
      if (!(owned.width > 0 && owned.height > 0)) throw new Error('Native capture is empty');
      const captured = credit.complete(stamp, owned);
      owned = null; // complete either closed or moved ownership into captured.
      if (captured) {
        owned = captured.image;
        // A post-ready missing consumption acknowledgement must retire the
        // entire renderer generation, never release credit and recapture while
        // the old worker still owns an ElementImage. Host fail hard-terminates
        // that generation after its bounded disposal handshake.
        consumptionDeadline = setTimeout(() => retire(new Error('Native paint consumption exceeded 15000ms deadline')), 15000);
        input.send(captured.stamp, captured.image);
        owned = null; // Successful native postMessage transfers ownership.
      }
    } catch (error) { owned?.close(); retire(error); }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; requested = false; clearTimeout(consumptionDeadline); consumptionDeadline = undefined; credit.dispose(); canvas.removeEventListener('paint', onPaint);
  };
  canvas.addEventListener('paint', onPaint);
  credit.dirty();
  return {
    update(generation: PaintGeneration, isVisible: boolean) {
      visible = isVisible; credit.update(generation, isVisible);
    },
    acknowledge(stamp: NativePaintStamp) {
      const accepted = credit.acknowledge(stamp);
      if (accepted) { clearTimeout(consumptionDeadline); consumptionDeadline = undefined; }
      return accepted;
    },
    requestPaint() { credit.dirty(); },
    dispose,
    inspect: credit.inspect,
  };
}
