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
  readonly seamWidth: number;
  /** Front shell thickness; must remain greater than two front bevels. */
  readonly frontThickness: number;
  /** Radius of the rolled edge on the front shell's face. */
  readonly frontBevel: number;
  /** Maximum forward sag of the front plate's smooth vertical crown. */
  readonly bodyCrown: number;
  /** Secondary molded crown depth near the top edge; zero removes it exactly. */
  readonly topEdgeCrown: number;
  /** Secondary molded crown depth near the bottom edge; zero removes it exactly. */
  readonly bottomEdgeCrown: number;
  /** Inboard reach of both secondary edge crowns. */
  readonly edgeCrownExtent: number;
  /** Radius of the rolled edge on the steel back's face. */
  readonly backBevel: number;
  /** How far below the body face the wheel ring sits. §5.3: "1.5px below". */
  readonly recessDepth: number;
  /**
   * Surface tilt at the ring's outer rim, degrees, **concave**. See
   * `curved-discs.ts` for why the ring is dished and what it replaces.
   */
  readonly ringDishTiltDeg: number;
  /**
   * Profile exponent for the ring's dish. Higher keeps the middle flat and
   * turns up near the rim, reaching the same rim tilt in less depth — see
   * `curved-discs.ts`.
   */
  readonly ringDishExponent: number;
  /** Surface tilt at the Select plug's rim, degrees, **convex**. */
  readonly selectDomeTiltDeg: number;
  /** Profile exponent for the Select plug's dome. */
  readonly selectDomeExponent: number;
  /** How far the Select plug stands proud of the ring's inner edge. */
  readonly selectProud: number;
  /** How far below the body face the dark LCD well begins. */
  readonly displayWellInset: number;
  /** Physical thickness of the LCD well floor slab. */
  readonly displayWellDepth: number;
  /** Extra wall height around the wheel recess before the ring begins. */
  readonly wheelWellDepth: number;
  /** How far inward the rear Settings inlay sits from the mirror back shell. */
  readonly rearInlayInset: number;
  /** How far below the body face the cover glass front surface sits. */
  readonly glassInset: number;
  /** Cover glass sheet thickness. */
  readonly glassThickness: number;
  /** Gap between the glass sheet's inner face and the emissive panel. */
  readonly glassToPanel: number;
};

export const DEFAULT_DEVICE_FORM: DeviceFormParams = {
  seamWidth: 1.5,
  frontThickness: 14,
  frontBevel: 3.5,
  bodyCrown: -2.125,
  topEdgeCrown: 0,
  bottomEdgeCrown: 0,
  edgeCrownExtent: 28,
  backBevel: 3.5,
  recessDepth: 2.25,
  ringDishTiltDeg: 0.9918,
  ringDishExponent: 6.1283,
  selectDomeTiltDeg: 15.9951,
  selectDomeExponent: 1.4989,
  selectProud: 6.5848,
  displayWellInset: 1.8,
  displayWellDepth: 0.9,
  wheelWellDepth: 1.2,
  rearInlayInset: 1.1,
  glassInset: 0.85,
  glassThickness: 2.4,
  glassToPanel: 1.2,
};
