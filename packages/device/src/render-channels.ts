import type { NativePaintStamp } from './device-render-protocol';

/** One reliable notification in flight and one replaceable latest value. Sending
 * or acknowledging this channel never grants permission to animate/render. */
export function createLatestRenderChannel<T>(send: (sequence: number, value: T) => void) {
  let nextSequence = 0, inFlight: number | null = null, pending: { value: T } | null = null;
  let paused = false, disposed = false;
  const flush = () => {
    if (disposed || paused || inFlight !== null || pending === null) return;
    const value = pending.value; pending = null;
    const sequence = ++nextSequence; inFlight = sequence;
    send(sequence, value);
  };
  return {
    offer(value: T) { if (disposed) return; pending = { value }; flush(); },
    acknowledge(sequence: number) { if (disposed || inFlight !== sequence) return false; inFlight = null; flush(); return true; },
    pause(value: boolean) { if (disposed) return; paused = value; flush(); },
    dispose() { disposed = true; inFlight = null; pending = null; },
    inspect: () => ({ inFlight, pending: pending !== null, paused, disposed }),
  };
}

export interface PaintGeneration {
  readonly epoch: number;
  readonly rasterRevision: number;
  readonly layoutRevision: number;
  readonly visibilityRevision: number;
  readonly width: number;
  readonly height: number;
}
interface ClosableSnapshot { close(): void }
function sameGeneration(a: PaintGeneration, b: PaintGeneration): boolean {
  return a.epoch === b.epoch && a.rasterRevision === b.rasterRevision && a.layoutRevision === b.layoutRevision &&
    a.visibilityRevision === b.visibilityRevision && a.width === b.width && a.height === b.height;
}
function sameCapture(a: NativePaintStamp, b: NativePaintStamp): boolean {
  return sameGeneration(a, b) && a.captureId === b.captureId && a.paintRevision === b.paintRevision;
}
/** Bounds capture itself, not merely the upload queue. Invalidated asynchronous
 * captures retain their credit until they settle and close; transferred images
 * retain it until the exact consuming acknowledgment. A fresh renderer owns a
 * fresh channel; its retired worker is responsible for closing transferred data.
 */
export function createNativePaintCredit(initial: PaintGeneration, available: () => void) {
  let generation = initial, nextCapture = 0, dirty = true, visible = true, disposed = false;
  let active: { stamp: NativePaintStamp; phase: 'capturing' | 'transferred' } | null = null;
  const notify = () => { if (!disposed && visible && dirty && active === null) available(); };
  return {
    dirty() { if (disposed) return; dirty = true; notify(); },
    update(next: PaintGeneration, isVisible: boolean) {
      if (disposed) return;
      if (!sameGeneration(generation, next)) dirty = true;
      generation = next; visible = isVisible; notify();
    },
    begin(paintRevision: number, receivedPaint = false): NativePaintStamp | null {
      if (receivedPaint && !disposed) dirty = true;
      if (disposed || !visible || !dirty || active !== null) return null;
      const stamp = { ...generation, captureId: ++nextCapture, paintRevision };
      active = { stamp, phase: 'capturing' }; dirty = false;
      return stamp;
    },
    complete<T extends ClosableSnapshot>(stamp: NativePaintStamp, image: T): { stamp: NativePaintStamp; image: T } | null {
      const matches = active !== null && active.phase === 'capturing' && sameCapture(active.stamp, stamp);
      if (disposed || !visible || !matches || !sameGeneration(stamp, generation)) {
        image.close();
        if (matches) { active = null; dirty = true; notify(); }
        return null;
      }
      active = { stamp, phase: 'transferred' };
      return { stamp, image };
    },
    failed(stamp: NativePaintStamp) {
      if (active === null || !sameCapture(active.stamp, stamp)) return;
      active = null; dirty = true; notify();
    },
    acknowledge(stamp: NativePaintStamp) {
      if (disposed || active === null || active.phase !== 'transferred' || !sameCapture(active.stamp, stamp)) return false;
      active = null; notify(); return true;
    },
    dispose() { disposed = true; active = null; dirty = false; },
    inspect: () => ({ active: active?.stamp ?? null, phase: active?.phase ?? null, dirty, visible, disposed }),
  };
}
