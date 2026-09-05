import { describe, expect, test } from "bun:test";

import {
  BODY_CORNER_EXPONENT,
  BODY_CORNER_R,
  BODY_H,
  BODY_W,
  PANEL_H,
  PANEL_SCALE,
  PANEL_W,
} from "@webpod/tokens";

import { DEFAULT_DEVICE_FORM } from "./form";
import {
  SELECT_SEAM_WIDTH,
  WHEEL_GAP_FLOOR_OFFSET,
  WHEEL_OUTER_SEAM_WIDTH,
} from "./front-surface";
import {
  DEVICE_LAYOUT,
  LCD_ACTIVE_PHYSICAL_MM,
  LCD_PHYSICAL_TOLERANCE_MM,
  PX_PER_MM,
  toCanvasTopLeft,
} from "./layout";
import { silhouetteHalfWidth } from "./luminance-probe";
import { IPOD_CLASSIC_PHYSICAL_SPEC } from "./physical-spec";
import { DEVICE_SURFACE_LAYOUT } from "./surface-layout";

describe("thin iPod Classic physical target", () => {
  test("declares one variant and cannot silently become the thick 60/80GB case", () => {
    expect(IPOD_CLASSIC_PHYSICAL_SPEC.variant).toBe(
      "iPod Classic 120GB thin (A1238)",
    );
    expect(IPOD_CLASSIC_PHYSICAL_SPEC.bodyMm).toEqual({
      width: 61.8,
      height: 103.5,
      depth: 10.5,
    });
    expect(IPOD_CLASSIC_PHYSICAL_SPEC.bodyMm.depth).not.toBe(14);
  });

  test("keeps the authored body and exact 320×240 LCD semantics", () => {
    expect([BODY_W, BODY_H, BODY_CORNER_R, BODY_CORNER_EXPONENT]).toEqual([
      330, 552, 26, 2,
    ]);
    expect([PANEL_W, PANEL_H, PANEL_SCALE]).toEqual([272, 204, 0.85]);
    expect(PANEL_W / PANEL_H).toBe(4 / 3);
    expect(PANEL_W / PANEL_SCALE).toBe(320);
    expect(PANEL_H / PANEL_SCALE).toBe(240);
  });

  test("maps the official front raster to a 24px forehead", () => {
    const chain = DEVICE_LAYOUT.chain;
    expect(chain.screenTopFromTop).toBe(24);
    expect(chain.screenTopFromTop / BODY_H).toBeCloseTo(27 / 629, 2);
    expect(chain.screenTopFromTop).not.toBe(48);
    expect(DEVICE_LAYOUT.screen.centerY).toBe(150);
    expect(toCanvasTopLeft(0, DEVICE_LAYOUT.screen.centerY)).toEqual({
      x: 165,
      y: 126,
    });
  });

  test("maps the official front raster to the smaller 206px wheel", () => {
    expect(DEVICE_LAYOUT.wheel.outerR).toBe(103);
    expect(DEVICE_LAYOUT.wheel.outerR * 2).toBe(206);
    expect((DEVICE_LAYOUT.wheel.outerR * 2) / BODY_W).toBeCloseTo(235 / 377, 2);
    expect(DEVICE_LAYOUT.wheel.outerR * 2).not.toBe(230);
  });

  test("places the wheel at the measured centre with balanced lower whitespace", () => {
    const chain = DEVICE_LAYOUT.chain;
    expect(chain.wheelCenterFromTop).toBe(390);
    expect(chain.wheelTopFromTop).toBe(287);
    expect(chain.screenToWheel).toBe(59);
    expect(chain.bottomMargin).toBe(59);
    expect(24 + 204 + 59 + 206 + 59).toBe(552);
    expect(DEVICE_LAYOUT.wheel.centerY).toBe(-114);
  });

  test("scales the separate Select part from the same official front raster", () => {
    expect(DEVICE_LAYOUT.wheel.selectR).toBe(37);
    expect(DEVICE_LAYOUT.wheel.selectR * 2).toBe(74);
    expect((DEVICE_LAYOUT.wheel.selectR * 2) / BODY_W).toBeCloseTo(84 / 377, 2);
    expect(DEVICE_LAYOUT.wheel.selectLipR).toBe(38);
  });

  test("keeps photo-derived shell profile estimates explicit", () => {
    expect(DEFAULT_DEVICE_FORM.frontThickness / PX_PER_MM).toBeCloseTo(1.5, 1);
    expect(DEFAULT_DEVICE_FORM.rearCrownInset / PX_PER_MM).toBeCloseTo(1.6, 1);
    expect(IPOD_CLASSIC_PHYSICAL_SPEC.photoDerivedProfileMm).toEqual({
      frontShellDepth: 1.5,
      rearCrownInset: 1.6,
    });
    expect(WHEEL_GAP_FLOOR_OFFSET / PX_PER_MM).toBeLessThan(0.02);
  });

  test("bounds both visible assembly seams from multiple OEM references", () => {
    const bounds = IPOD_CLASSIC_PHYSICAL_SPEC.wheelAssemblyRasterBounds;
    const selectGap = SELECT_SEAM_WIDTH;
    const selectGapRatio = selectGap / (DEVICE_LAYOUT.wheel.selectR * 2);
    expect(selectGap).toBe(1);
    expect(selectGapRatio).toBeLessThanOrEqual(
      bounds.selectSeamMaxPx / bounds.selectDiameterPx,
    );
    const outerGapRatio =
      WHEEL_OUTER_SEAM_WIDTH / (DEVICE_LAYOUT.wheel.outerR * 2);
    expect(DEVICE_SURFACE_LAYOUT.front.wheel.outerDiameter / 2).toBe(
      DEVICE_LAYOUT.wheel.outerR,
    );
    expect(outerGapRatio).toBeLessThanOrEqual(
      bounds.wheelSeamMaxPx / bounds.wheelDiameterPx,
    );
    expect(bounds.wheelSeamMaxPx / bounds.wheelDiameterPx).toBeLessThan(0.01);
  });

  test("retains a thin intentional material seam", () => {
    expect(DEFAULT_DEVICE_FORM.seamWidth).toBe(1.2);
    expect(DEFAULT_DEVICE_FORM.seamWidth).toBeLessThan(2);
  });
});

describe("physical LCD and restrained trim", () => {
  test("the active panel is the physical 50.8 × 38.1mm 4:3 aperture", () => {
    const physicalWidth = DEVICE_LAYOUT.screen.width / PX_PER_MM;
    const physicalHeight = DEVICE_LAYOUT.screen.height / PX_PER_MM;
    expect(
      Math.abs(physicalWidth - LCD_ACTIVE_PHYSICAL_MM.width),
    ).toBeLessThanOrEqual(LCD_PHYSICAL_TOLERANCE_MM);
    expect(
      Math.abs(physicalHeight - LCD_ACTIVE_PHYSICAL_MM.height),
    ).toBeLessThanOrEqual(LCD_PHYSICAL_TOLERANCE_MM);
    expect(LCD_ACTIVE_PHYSICAL_MM.semanticWidth).toBe(320);
    expect(LCD_ACTIVE_PHYSICAL_MM.semanticHeight).toBe(240);
  });

  test("continuous black underprint covers a moderately sized square LCD surround", () => {
    const { displayWell, glass, mask } = DEVICE_SURFACE_LAYOUT.front;
    expect(displayWell.inset).toBe(6);
    expect(glass.width).toBe(displayWell.width);
    expect(glass.height).toBe(displayWell.height);
    expect(mask.width - displayWell.width).toBe(12);
    expect(mask.height - displayWell.height).toBe(12);
    expect(DEVICE_LAYOUT.screen.cornerR).toBe(0);
    expect(DEVICE_LAYOUT.glass.width).toBe(284);
    expect(DEVICE_LAYOUT.glass.height).toBe(216);
  });
});

describe("enclosure plan and depth", () => {
  test("uses the thin 10.5mm depth at the one body scale", () => {
    expect(PX_PER_MM.toFixed(4)).toBe("5.3398");
    expect(DEVICE_LAYOUT.body.depth.toFixed(2)).toBe("56.07");
  });

  test("preserves the analytic 26px circular corner", () => {
    const y = 276 - 26 + 26 * Math.SQRT1_2;
    const actual = silhouetteHalfWidth(y, 165, 276, 26, 2);
    const expected = 165 - 26 + 26 * Math.SQRT1_2;
    expect(actual).toBeCloseTo(expected, 10);
    expect(silhouetteHalfWidth(0, 165, 276, 26, 2)).toBe(165);
  });
});
