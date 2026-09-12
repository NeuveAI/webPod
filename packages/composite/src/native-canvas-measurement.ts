import { firstDevicePixelBox, resolveCanvasPixelRatio, type DevicePixelBox } from '../../device/src/pixel-density';
import { DEVICE_LAYOUT } from '../../device/src/layout';
import { resolvePanelRasterDensity, resolvePanelRasterFrame } from './html-in-canvas';

export interface NativeCanvasMeasurement {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly pixelRatio: number;
  readonly rasterWidth: number;
  readonly rasterHeight: number;
}

/** One canvas-generation owner, independent of pose publication. Notifications
 * coalesce before measuring; equal numerical output never advances layout.
 * Hidden/zero dimensions retain the last valid host layout. Disposal cancels
 * queued work and guards already-delivered observer/media callbacks.
 */
export function observeNativeCanvasMeasurement(
  canvas: HTMLCanvasElement,
  explicitDensity: number | undefined,
  publish: (measurement: NativeCanvasMeasurement) => void,
): () => void {
  let disposed = false, frame: number | null = null;
  let entry: ResizeObserverEntry | undefined;
  let last: NativeCanvasMeasurement | null = null;
  let physicalSample: { width: number; height: number; nativeDensity: number; box: DevicePixelBox } | null = null;
  const flush = () => {
    frame = null;
    if (disposed || document.hidden) return;
    const observed = entry; entry = undefined;
    const rect = observed?.contentRect ?? canvas.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return;
    const box = firstDevicePixelBox(observed?.devicePixelContentBoxSize);
    if (box) physicalSample = { width: rect.width, height: rect.height, nativeDensity: window.devicePixelRatio, box };
    else if (physicalSample && (physicalSample.width !== rect.width || physicalSample.height !== rect.height
      || physicalSample.nativeDensity !== window.devicePixelRatio)) physicalSample = null;
    const pixelRatio = explicitDensity ?? resolveCanvasPixelRatio({
      cssWidth: rect.width, cssHeight: rect.height,
      devicePixelBox: physicalSample?.box,
      fallbackDevicePixelRatio: window.devicePixelRatio,
    });
    const raster = resolvePanelRasterFrame(DEVICE_LAYOUT.screen.width, DEVICE_LAYOUT.screen.height,
      resolvePanelRasterDensity(Math.max(window.devicePixelRatio, pixelRatio)), DEVICE_LAYOUT.screen.scale);
    const next: NativeCanvasMeasurement = { cssWidth: rect.width, cssHeight: rect.height,
      backingWidth: Math.floor(rect.width * pixelRatio), backingHeight: Math.floor(rect.height * pixelRatio),
      pixelRatio, rasterWidth: raster.width, rasterHeight: raster.height };
    if (last && last.cssWidth === next.cssWidth && last.cssHeight === next.cssHeight
      && last.backingWidth === next.backingWidth && last.backingHeight === next.backingHeight
      && last.pixelRatio === next.pixelRatio && last.rasterWidth === next.rasterWidth && last.rasterHeight === next.rasterHeight) return;
    last = next;
    publish(next);
  };
  const schedule = () => {
    if (!disposed && !document.hidden && frame === null) frame = window.requestAnimationFrame(flush);
  };
  const invalidate = () => { entry = undefined; schedule(); };
  const observer = new ResizeObserver(entries => {
    if (disposed) return;
    const next = entries.find(value => value.target === canvas);
    if (next) {
      const box = firstDevicePixelBox(next.devicePixelContentBoxSize);
      if (box) physicalSample = { width: next.contentRect.width, height: next.contentRect.height, nativeDensity: window.devicePixelRatio, box };
      entry = next; schedule();
    }
  });
  const physical = typeof ResizeObserverEntry !== 'undefined' && 'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;
  observer.observe(canvas, physical ? { box: 'device-pixel-content-box' } : undefined);
  let resolution = window.matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`);
  const onDensity = () => {
    if (disposed) return;
    resolution.removeEventListener('change', onDensity);
    resolution = window.matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`);
    resolution.addEventListener('change', onDensity);
    invalidate();
  };
  const onVisibility = () => {
    if (document.hidden && frame !== null) { window.cancelAnimationFrame(frame); frame = null; }
    invalidate();
  };
  resolution.addEventListener('change', onDensity);
  window.addEventListener('resize', invalidate);
  window.visualViewport?.addEventListener('resize', invalidate);
  document.addEventListener('visibilitychange', onVisibility);
  flush();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    resolution.removeEventListener('change', onDensity);
    window.removeEventListener('resize', invalidate);
    window.visualViewport?.removeEventListener('resize', invalidate);
    document.removeEventListener('visibilitychange', onVisibility);
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null; entry = undefined; last = null; physicalSample = null;
  };
}
