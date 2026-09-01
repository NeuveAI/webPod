/**
 * Where each part sits on the body face.
 *
 * Body and active-LCD canvas dimensions remain imported from the design-system
 * tokens. Product placement and wheel proportions come from the declared thin
 * 30GB physical target in `physical-spec.ts`; this is the owner-requested
 * correction to the oversized Pencil wheel and excessive screen forehead.
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
  PANEL_H,
  PANEL_SCALE,
  PANEL_W,
} from "@webpod/tokens";

import {
  IPOD_5G_30GB_PHYSICAL_SPEC,
  rasterRatio,
} from "./physical-spec";

/**
 * Millimetres per CSS pixel, mobile — §7.3's "Scale" row, stated as the
 * division it is so the body width stays the authority.
 *
 * §7.3 derives 5.3398 px/mm from body 330px / 61.8mm and calls the body
 * authoritative; that division is reproduced rather than the rounded constant
 * transcribed.
 */
export const PX_PER_MM: number =
  BODY_W / IPOD_5G_30GB_PHYSICAL_SPEC.bodyMm.width;

/** Apple/5G physical reference behind the canonical 272 × 204 Pencil slot. */
export const LCD_ACTIVE_PHYSICAL_MM = Object.freeze({
  width: IPOD_5G_30GB_PHYSICAL_SPEC.display.activeWidthMm,
  height: IPOD_5G_30GB_PHYSICAL_SPEC.display.activeHeightMm,
  semanticWidth: IPOD_5G_30GB_PHYSICAL_SPEC.display.semanticWidth,
  semanticHeight: IPOD_5G_30GB_PHYSICAL_SPEC.display.semanticHeight,
});

/** Rounding allowance from physical millimetres to the integer Pencil grid. */
export const LCD_PHYSICAL_TOLERANCE_MM = 0.2;

const FRONT_RASTER = IPOD_5G_30GB_PHYSICAL_SPEC.appleFrontRaster;

/** Device-local physical wheel plan, measured from Apple's straight-on image. */
const WHEEL_DIAMETER = Math.round(
  BODY_W * rasterRatio(FRONT_RASTER.wheelDiameter, FRONT_RASTER.body.width),
);
const WHEEL_RADIUS = WHEEL_DIAMETER / 2;
const SELECT_DIAMETER = Math.round(
  BODY_W * rasterRatio(FRONT_RASTER.selectDiameter, FRONT_RASTER.body.width),
);
const SELECT_RADIUS = SELECT_DIAMETER / 2;

/** Label placement measured at roughly 79% of the physical wheel radius. */
const LABEL_BAND_INNER_RADIUS = Math.round(WHEEL_RADIUS * 0.78);
const LABEL_BAND_OUTER_RADIUS = LABEL_BAND_INNER_RADIUS + 2;
const SELECT_LIP_RADIUS = SELECT_RADIUS + 4;
const RECESS_SHADOW_REACH_RADIUS = WHEEL_RADIUS - 11;

/** Cover-glass lip beyond each active edge. */
export const GLASS_SURROUND: number = 1;

/** §7.1: screen glass window radius, mobile. */
export const GLASS_CORNER_R: number = 7;

/** §7.1: screen active area radius, mobile — glass − 3px print inset. */
export const SCREEN_CORNER_R: number = 4;

/** Body depth in CSS px. */
export const BODY_D: number =
  IPOD_5G_30GB_PHYSICAL_SPEC.bodyMm.depth * PX_PER_MM;

/**
 * The vertical chain, in body-local coordinates (+y up, origin at centre).
 *
 * Apple's straight-on 5G product image is the proportion source. The active
 * 4:3 LCD remains fixed by its physical 2.5-inch diagonal; only its placement
 * and the wheel plan come from raster ratios:
 *
 * ```
 *   24  top → screen   (27 / 629 of the body height)
 *  204  active area    (PANEL_H)
 *   59  screen → wheel (wheel centre at 444 / 629 of body height)
 *  206  wheel          (235 / 377 of body width)
 *   59  wheel → bottom (remainder)
 *  ---
 *  552  BODY_H         ✓
 * ```
 *
 * Values are rounded once onto the 330 × 552 device grid. The source image's
 * anti-aliased edges carry ±2 source pixels of uncertainty, which is wider
 * than any of these final one-pixel roundings.
 */
function verticalChain() {
  const screenTopFromTop = Math.round(
    BODY_H * rasterRatio(FRONT_RASTER.screenTop, FRONT_RASTER.body.height),
  );
  const wheelCenterFromTop = Math.round(
    BODY_H *
      rasterRatio(FRONT_RASTER.wheelCenterFromTop, FRONT_RASTER.body.height),
  );
  const wheelTopFromTop = wheelCenterFromTop - WHEEL_RADIUS;
  const screenToWheel = wheelTopFromTop - (screenTopFromTop + PANEL_H);
  const wheelBottomFromTop = wheelCenterFromTop + WHEEL_RADIUS;
  return {
    screenTopFromTop,
    screenToWheel,
    wheelCenterFromTop,
    wheelTopFromTop,
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
 * Frozen because it is a derived fact, not a configuration point: a different
 * arrangement requires a different declared physical target.
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
  /** The cover glass sheet: active area plus a restrained physical lip. */
  glass: Object.freeze({
    width: PANEL_W + GLASS_SURROUND * 2,
    height: PANEL_H + GLASS_SURROUND * 2,
    cornerR: GLASS_CORNER_R,
    surround: GLASS_SURROUND,
    centerX: 0,
    centerY: HALF_H - CHAIN.screenTopFromTop - PANEL_H / 2,
  }),
  /** The click wheel recess and its photo-measured contents. */
  wheel: Object.freeze({
    outerR: WHEEL_RADIUS,
    selectR: SELECT_RADIUS,
    selectLipR: SELECT_LIP_RADIUS,
    labelBandInnerR: LABEL_BAND_INNER_RADIUS,
    labelBandOuterR: LABEL_BAND_OUTER_RADIUS,
    recessShadowReachR: RECESS_SHADOW_REACH_RADIUS,
    centerX: 0,
    centerY: HALF_H - CHAIN.wheelCenterFromTop,
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
