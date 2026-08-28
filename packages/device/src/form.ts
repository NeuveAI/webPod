/**
 * The physical build details §12.0 does not state.
 *
 * §12.0 fixes the *plan* — radii and the vertical chain — because that is what
 * a 2D artboard can hold. Depth cannot be measured off an artboard, so the
 * third dimension is stated here: how proud the Select plug stands, how far
 * the wheel is sunk, how wide the steel's rolled edge reads, how much the ring
 * is dished.
 *
 * ⚑ These are **inputs**, like the materials and the rig (D-012), and for the
 * same reason: they are the other half of what a tier would have to change.
 * They are separated from `layout.ts` so the distinction stays visible — a
 * number in `layout.ts` is derived from a locked token and is not adjustable;
 * a number here is a modelling decision and is.
 */

export type DeviceFormParams = {
  /**
   * How far the polycarbonate front is inset from the silhouette, letting the
   * steel back's rolled edge read as the perimeter hairline.
   *
   * This is §5.6's chrome bezel seam, modelled rather than drawn: the seam is
   * "the 3px line where the steel back's rolled edge meets the polycarbonate
   * front", so in 3D it is not a stroke at all — it is the back part still
   * being visible past the front part, catching the key light on its curve.
   * §10.4 prevention #6 asks for a conic response around a rounded rectangle;
   * a real rolled edge gives one for free, because every point of it presents a
   * different angle to the light.
   */
  readonly seamWidth: number
  /** Front shell thickness. */
  readonly frontThickness: number
  /** Radius of the rolled edge on the front shell's face. */
  readonly frontBevel: number
  /** Radius of the rolled edge on the steel back's face. */
  readonly backBevel: number
  /** How far below the body face the wheel ring sits. §5.3: "1.5px below". */
  readonly recessDepth: number
  /**
   * Surface tilt at the ring's outer rim, degrees, **concave**. See
   * `curved-discs.ts` for why the ring is dished and what it replaces.
   */
  readonly ringDishTiltDeg: number
  /**
   * Profile exponent for the ring's dish. Higher keeps the middle flat and
   * turns up near the rim, reaching the same rim tilt in less depth — see
   * `curved-discs.ts`.
   */
  readonly ringDishExponent: number
  /** Surface tilt at the Select plug's rim, degrees, **convex**. */
  readonly selectDomeTiltDeg: number
  /** Profile exponent for the Select plug's dome. */
  readonly selectDomeExponent: number
  /** How far the Select plug stands proud of the ring's inner edge. */
  readonly selectProud: number
  /** Cover glass sheet thickness. */
  readonly glassThickness: number
  /** Gap between the glass sheet's inner face and the emissive panel. */
  readonly glassToPanel: number
}

export const DEFAULT_DEVICE_FORM: DeviceFormParams = {
  seamWidth: 3,
  frontThickness: 7,
  frontBevel: 2.2,
  backBevel: 3.5,
  recessDepth: 13.125,
  ringDishTiltDeg: 0.2875,
  ringDishExponent: 7.8,
  selectDomeTiltDeg: 1.4,
  selectDomeExponent: 1.2281,
  selectProud: 7.075,
  glassThickness: 2.4,
  glassToPanel: 1.2,
}
