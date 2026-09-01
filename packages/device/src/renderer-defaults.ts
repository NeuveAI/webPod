/**
 * Device-local renderer tuning.
 *
 * Three 0.185 sizes the transmissive framebuffer from
 * `WebGLRenderer.transmissionResolutionScale`; leaving it at `1` keeps the
 * cover-glass pass at the base viewport resolution, which softens the HTML
 * panel once more after composite has already rendered it sharply.
 */

export const DEVICE_TRANSMISSION_RESOLUTION_SCALE = 12;

type TransmissionRenderer = { transmissionResolutionScale: number };

export function applyDeviceRendererDefaults(
  renderer: TransmissionRenderer,
): void {
  renderer.transmissionResolutionScale = DEVICE_TRANSMISSION_RESOLUTION_SCALE;
}
