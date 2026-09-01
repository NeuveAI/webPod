/**
 * Device-local renderer tuning.
 *
 * The LCD source already matches the drawing buffer at DPR 1/2/3. A larger
 * transmission framebuffer creates an avoidable supersample/downsample pass
 * over text; native scale keeps the glass and LCD on one pixel budget.
 */

export const DEVICE_TRANSMISSION_RESOLUTION_SCALE = 1;

type TransmissionRenderer = { transmissionResolutionScale: number };

export function applyDeviceRendererDefaults(
  renderer: TransmissionRenderer,
): void {
  renderer.transmissionResolutionScale = DEVICE_TRANSMISSION_RESOLUTION_SCALE;
}
