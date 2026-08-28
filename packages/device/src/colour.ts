/**
 * sRGB ↔ linear conversion and the luminance metric the acceptance criterion
 * is stated in.
 *
 * Written out rather than taken from `THREE.Color` because the luminance
 * sampler must be able to run over raw framebuffer bytes with no renderer in
 * scope, and because a gate should not share an implementation with the thing
 * it is gating.
 */

/** IEC 61966-2-1 sRGB EOTF, on the 0..1 domain. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** The inverse. */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
}

/** `#RRGGBB` → three sRGB components on 0..1. */
export function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = Number.parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** `#RRGGBB` → three linear-sRGB components on 0..1. */
export function hexToLinear(hex: string): [number, number, number] {
  const [r, g, b] = hexToSrgb(hex)
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]
}

/**
 * The metric the ±4 gate is measured in.
 *
 * Rec. 709 luma over **gamma-encoded sRGB bytes**, i.e. exactly what
 * "desaturate the render and read the pixel value" gives — which is what
 * §10.4's automatable test describes ("desaturate the steel back to greyscale
 * and plot a vertical luminance histogram") and what makes "±4 **units**"
 * mean 4/255 rather than 4 units of something unstated.
 *
 * ⚑ Deliberately **not** WCAG relative luminance. WCAG's Y is linear-light, so
 * a 4-unit tolerance there is a different tolerance at every brightness — 4
 * units near black would be an 11% error and near white a 1.5% one. The stop
 * tables are authored as sRGB hex and compared against sRGB pixels, so the
 * comparison stays in the space both sides are written in.
 */
export function luma255(r255: number, g255: number, b255: number): number {
  return 0.2126 * r255 + 0.7152 * g255 + 0.0722 * b255
}

/** {@link luma255} for a spec stop written as hex. */
export function hexLuma255(hex: string): number {
  const [r, g, b] = hexToSrgb(hex)
  return luma255(r * 255, g * 255, b * 255)
}

/** Component-wise mix in whatever space the inputs are already in. */
export function mix3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
