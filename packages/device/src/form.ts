/**
 * The physical build details §12.0 does not state.
 *
 * §12.0 fixes the *plan* — radii and the vertical chain — because that is what
 * a 2D artboard can hold. Depth cannot be measured off an artboard, so the
 * third dimension is stated here: how wide the steel's rolled edge reads and
 * how the display stack sits behind the front shell. The wheel and Select are
 * intentionally absent: owner-primary OEM photographs establish them as
 * zero-wall patches on the faceplate surface, not adjustable depth controls.
 *
 * ⚑ These are **inputs**, like the materials and the rig (D-012), and for the
 * same reason: they are the other half of what a tier would have to change.
 * They are separated from `layout.ts` so the distinction stays visible — a
 * number in `layout.ts` is derived from a locked token and is not adjustable;
 * a number here is a modelling decision and is.
 */

import { PX_PER_MM } from "./layout";
import { IPOD_CLASSIC_PHYSICAL_SPEC } from "./physical-spec";

const PHOTO_PROFILE = IPOD_CLASSIC_PHYSICAL_SPEC.photoDerivedProfileMm;

export type DeviceFormParams = {
  /**
   * How far the aluminum front is inset from the silhouette, letting the
   * steel back's rolled edge read as the perimeter hairline.
   *
   * This is §5.6's chrome bezel seam, modelled rather than drawn: the seam is
   * "the 3px line where the steel back's rolled edge meets the aluminum
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
  /** Shallow side-to-side crown; gives the key real x-normal travel. */
  readonly bodyCrossCrown: number;
  /** Secondary molded crown depth near the top edge; zero removes it exactly. */
  readonly topEdgeCrown: number;
  /** Secondary molded crown depth near the bottom edge; zero removes it exactly. */
  readonly bottomEdgeCrown: number;
  /** Inboard reach of both secondary edge crowns. */
  readonly edgeCrownExtent: number;
  /** Maximum plan inset of the crowned steel rear face relative to its seam. */
  readonly rearCrownInset: number;
  /** How far below the body face the dark LCD well begins. */
  readonly displayWellInset: number;
  /** Physical thickness of the LCD well floor slab. */
  readonly displayWellDepth: number;
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
  seamWidth: 1.2,
  frontThickness: Math.round(PHOTO_PROFILE.frontShellDepth * PX_PER_MM),
  frontBevel: 3.5,
  bodyCrown: 1.2,
  bodyCrossCrown: 1.2,
  topEdgeCrown: 0,
  bottomEdgeCrown: 0,
  edgeCrownExtent: 20,
  rearCrownInset:
    Math.round(PHOTO_PROFILE.rearCrownInset * PX_PER_MM * 10) / 10,
  displayWellInset: 1.8,
  displayWellDepth: 0.9,
  rearInlayInset: 1.1,
  glassInset: 0.85,
  glassThickness: 2.4,
  glassToPanel: 0.2,
};
