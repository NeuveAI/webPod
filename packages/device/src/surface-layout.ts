import { DEVICE_LAYOUT } from "./layout";

/**
 * Surface-detail geometry lifted from Pencil components VWaJS and zbTc3.
 *
 * `layout.ts` owns the locked body, wheel and active-panel plan from
 * `@webpod/tokens`; this file owns the richer per-surface layering the
 * volumetric device consumes without changing those exported token facts.
 */
const { body, screen, wheel } = DEVICE_LAYOUT;
const DISPLAY_WELL_INSET = 4;
const DISPLAY_GLASS_LIP = 2;
const DISPLAY_MASK = 1;

export const DEVICE_SURFACE_LAYOUT = Object.freeze({
  front: Object.freeze({
    topChamferHeight: 7,
    displayWell: Object.freeze({
      width: screen.width + DISPLAY_WELL_INSET * 2,
      height: screen.height + DISPLAY_WELL_INSET * 2,
      cornerR: 9,
      centerX: screen.centerX,
      centerY: screen.centerY,
      inset: DISPLAY_WELL_INSET,
    }),
    glass: Object.freeze({
      width: screen.width + DISPLAY_GLASS_LIP * 2,
      height: screen.height + DISPLAY_GLASS_LIP * 2,
      cornerR: screen.cornerR + DISPLAY_GLASS_LIP,
      centerX: screen.centerX,
      centerY: screen.centerY,
    }),
    mask: Object.freeze({
      width: screen.width + DISPLAY_MASK * 2,
      height: screen.height + DISPLAY_MASK * 2,
      cornerR: screen.cornerR + DISPLAY_MASK,
      centerX: screen.centerX,
      centerY: screen.centerY,
      inset: DISPLAY_MASK,
    }),
    wheel: Object.freeze({
      centerX: wheel.centerX,
      centerY: wheel.centerY,
      outerDiameter: wheel.outerR * 2,
      selectDiameter: wheel.selectR * 2,
      selectSpecularOffsetY: 19,
      selectSpecularWidth: 58,
      selectSpecularHeight: 30,
    }),
  }),
  rear: Object.freeze({
    mirrorBandHeight: 168,
    brushSheenTop: 170,
    brushSheenHeight: 250,
    inlay: Object.freeze({
      x: 22,
      y: 150,
      width: 286,
      height: 296,
      cornerR: 14,
      centerX: 0,
      centerY: body.height / 2 - (150 + 296 / 2),
    }),
    legalY: 456,
    serialY: 473,
    liveY: 492,
  }),
});
