import { AgXToneMapping } from "three";
/**
 * Device-local renderer tuning.
 *
 * The LCD source already matches the drawing buffer at DPR 1/2/3. A larger
 * transmission framebuffer creates an avoidable supersample/downsample pass
 * over text; native scale keeps the glass and LCD on one pixel budget.
 */

export const DEVICE_TRANSMISSION_RESOLUTION_SCALE = 1;

type TransmissionRenderer = { transmissionResolutionScale: number; toneMapping?: number; toneMappingExposure?: number; debug?: { checkShaderErrors: boolean } };

export function applyDeviceRendererDefaults(
  renderer: TransmissionRenderer,
  shaderDiagnostics = false,
): void {
  // Three's first-use shader-log queries synchronously wait for the driver,
  // defeating parallel program preparation when the backplate becomes visible.
  if (renderer.debug) renderer.debug.checkShaderErrors = shaderDiagnostics;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.transmissionResolutionScale = DEVICE_TRANSMISSION_RESOLUTION_SCALE;
}
