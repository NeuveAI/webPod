/**
 * Where each part sits on the body face.
 *
 * ⚑ Every §12.0 number is **imported** from `@webpod/tokens`, never re-typed.
 * W0 exported and test-locked them; a second copy that drifts is the failure
 * this module exists to make impossible. What is computed here is only the
 * *arrangement* — the vertical chain and the two centres — and each step of
 * it is derived from an imported constant or from a §7.3 millimetre figure
 * put through the one scale factor.
 *
 * ⚠ §7.3's **desktop** column is stale (D-021). Desktop is a non-goal for W4
 * and nothing below reads it. The millimetre column of §7.3 is *not* stale —
 * it is measurements of the real 5th generation — and is the only thing taken
 * from that section.
 *
 * Coordinate frame: body-local CSS pixels, origin at the **centre** of the
 * body face, +x right, +y **up**, +z toward the viewer. Three.js is
 * y-up, so this is the renderer's frame directly and no flip is smuggled in
 * anywhere. Callers wanting the design canvas's top-left origin convert with
 * {@link toCanvasTopLeft}.
 */
import {
  BODY_CORNER_EXPONENT,
  BODY_CORNER_R,
  BODY_H,
  BODY_W,
  LABEL_BAND_INNER_R,
  LABEL_BAND_OUTER_R,
  PANEL_H,
  PANEL_SCALE,
  PANEL_W,
  RECESS_SHADOW_REACH_R,
  SELECT_LIP_R,
  SELECT_R,
  WHEEL_R,
} from "@webpod/tokens";

/**
 * Millimetres per CSS pixel, mobile — §7.3's "Scale" row, stated as the
 * division it is so the body width stays the authority.
 *
 * §7.3 derives 5.3398 px/mm from body 330px / 61.8mm and calls the body
 * authoritative; that division is reproduced rather than the rounded constant
 * transcribed.
 */
export const PX_PER_MM: number = BODY_W / 61.8;

/** §7.3 millimetre column — the real 5th generation, measured. */
const MM = {
  /** Body depth, 30GB model. Sets the chassis extrusion. */
  bodyDepth: 11.0,
  /** Top edge → glass top. */
  topToGlass: 9.0,
  /** Glass bottom → wheel top. */
  glassToWheel: 8.0,
} as const;

/** §5.5: the printed black surround extends 6px beyond the active area. */
export const GLASS_SURROUND: number = 6;

/** §7.1: screen glass window radius, mobile. */
export const GLASS_CORNER_R: number = 7;

/** §7.1: screen active area radius, mobile — glass − 3px print inset. */
export const SCREEN_CORNER_R: number = 4;

/** Body depth in CSS px. */
export const BODY_D: number = MM.bodyDepth * PX_PER_MM;

/**
 * The vertical chain, in body-local coordinates (+y up, origin at centre).
 *
 * §7.3 states the chain as `48 + 204 + 43 + 212 + 45 = 552` — but that is the
 * `wheelR` 106 chain, and §12.0 raised the wheel to 115. §7.3 says in the same
 * breath that the wheel is 8.1% small and that "the real ratio gives 28px" for
 * the bottom margin. Re-derived at `wheelR` 115 the chain closes on the
 * measured millimetres instead of on a residual:
 *
 * ```
 *   48  top → glass    (9.0mm × 5.3398)
 *  204  active area    (PANEL_H)
 *   43  glass → wheel  (8.0mm × 5.3398)
 *  230  wheel          (WHEEL_R × 2)
 *   27  wheel → bottom (the remainder — and 5.2mm × 5.3398 = 27.8, §7.3's
 *                       "real ratio gives 28px")
 *  ---
 *  552  BODY_H         ✓
 * ```
 *
 * The bottom margin is left as the remainder so the chain closes on `BODY_H`
 * by construction; that it independently lands on the measured 5.2mm is the
 * check that `wheelR` 115 is the self-consistent geometry, not a patch.
 */
function verticalChain() {
  const topToGlass = Math.round(MM.topToGlass * PX_PER_MM);
  const glassToWheel = Math.round(MM.glassToWheel * PX_PER_MM);
  const screenTopFromTop = topToGlass;
  const wheelTopFromTop = topToGlass + PANEL_H + glassToWheel;
  const wheelBottomFromTop = wheelTopFromTop + WHEEL_R * 2;
  return {
    topToGlass,
    glassToWheel,
    screenTopFromTop,
    wheelTopFromTop,
    /** Left as the remainder so the chain closes on `BODY_H` exactly. */
    bottomMargin: BODY_H - wheelBottomFromTop,
  };
}

const CHAIN = verticalChain();

/** Half-extents, used everywhere below. */
const HALF_W = BODY_W / 2;
const HALF_H = BODY_H / 2;

/**
 * The device layout, body-local, +y up, origin at the face centre.
 *
 * Frozen because it is a derived fact, not a configuration point: a caller
 * that wants a different arrangement wants different §12.0 tokens.
 */
export const DEVICE_LAYOUT = Object.freeze({
  body: Object.freeze({
    width: BODY_W,
    height: BODY_H,
    depth: BODY_D,
    cornerR: BODY_CORNER_R,
    exponent: BODY_CORNER_EXPONENT,
  }),
  /** The emissive panel — the active area W6 composites onto. */
  screen: Object.freeze({
    width: PANEL_W,
    height: PANEL_H,
    cornerR: SCREEN_CORNER_R,
    /** Panel px → body px. §7.4: one `scale()`, and this is its value. */
    scale: PANEL_SCALE,
    centerX: 0,
    centerY: HALF_H - CHAIN.screenTopFromTop - PANEL_H / 2,
  }),
  /** The cover glass sheet: active area + a 6px printed surround (§5.5 L2). */
  glass: Object.freeze({
    width: PANEL_W + GLASS_SURROUND * 2,
    height: PANEL_H + GLASS_SURROUND * 2,
    cornerR: GLASS_CORNER_R,
    surround: GLASS_SURROUND,
    centerX: 0,
    centerY: HALF_H - CHAIN.screenTopFromTop - PANEL_H / 2,
  }),
  /** The click wheel recess and its contents (§12.0 radii). */
  wheel: Object.freeze({
    outerR: WHEEL_R,
    selectR: SELECT_R,
    selectLipR: SELECT_LIP_R,
    labelBandInnerR: LABEL_BAND_INNER_R,
    labelBandOuterR: LABEL_BAND_OUTER_R,
    recessShadowReachR: RECESS_SHADOW_REACH_R,
    centerX: 0,
    centerY: HALF_H - CHAIN.wheelTopFromTop - WHEEL_R,
  }),
  chain: Object.freeze(CHAIN),
} as const);

/**
 * Convert a body-local point (+y up, centre origin) to the design canvas's
 * top-left origin with +y down, so a number here can be checked against an
 * artboard measurement without doing the flip in one's head.
 */
export function toCanvasTopLeft(
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: x + HALF_W, y: HALF_H - y };
}
