export type DevicePixelBox = {
  readonly inlineSize: number;
  readonly blockSize: number;
};

export type CanvasPixelMeasurement = {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly devicePixelBox?: DevicePixelBox;
  readonly fallbackDevicePixelRatio: number;
};

export const DEVICE_DPR_RANGE = Object.freeze({ min: 1, max: 3 });

/** Resolve physical canvas pixels, including browser zoom, from one observation. */
export function resolveCanvasPixelRatio(
  measurement: CanvasPixelMeasurement,
  range = DEVICE_DPR_RANGE,
): number {
  const { cssWidth, cssHeight, devicePixelBox, fallbackDevicePixelRatio } = measurement;
  const fromPhysicalPixels =
    devicePixelBox !== undefined && cssWidth > 0 && cssHeight > 0
      ? (devicePixelBox.inlineSize / cssWidth + devicePixelBox.blockSize / cssHeight) / 2
      : Number.NaN;
  // Chromium device emulation can report a CSS-sized physical box while
  // exposing the emulated scale through devicePixelRatio. Taking the larger
  // valid signal keeps real hardware, page zoom, and deterministic emulation
  // sharp without ever undersizing the buffer.
  const physical = Number.isFinite(fromPhysicalPixels) && fromPhysicalPixels > 0
    ? fromPhysicalPixels
    : 0;
  const fallback = Number.isFinite(fallbackDevicePixelRatio) && fallbackDevicePixelRatio > 0
    ? fallbackDevicePixelRatio
    : 0;
  const candidate = Math.max(physical, fallback);
  const finite = candidate > 0 ? candidate : range.min;
  return Math.min(range.max, Math.max(range.min, finite));
}

export function firstDevicePixelBox(
  value: readonly ResizeObserverSize[] | ResizeObserverSize | undefined,
): DevicePixelBox | undefined {
  const box = Array.isArray(value) ? value[0] : value;
  if (box === undefined) return undefined;
  return { inlineSize: box.inlineSize, blockSize: box.blockSize };
}
