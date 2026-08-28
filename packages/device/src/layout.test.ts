/**
 * §12.0's geometry, asserted against the section's own literals.
 *
 * ⚑ **D-050.** Every expected value below is a number **read off design-system
 * §12.0 / §7.3 and written here by hand**, with the section cited. Nothing is
 * recomputed from `@webpod/tokens` — a test that derives both sides from the
 * symbol under test moves with the bug and reports green while the constant is
 * wrong, which is exactly how W2's planted flat-7 page size passed 93 tests.
 * The implementation imports the tokens; the test asserts the spec. If those
 * two ever disagree, one of them is wrong and this file says which.
 *
 * Falsification, run and recorded in `evidence/w4-geometry.txt`: each token was
 * given a wrong value in turn and this file went red for it.
 */
import { describe, expect, test } from "bun:test";

import {
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

import { DEVICE_LAYOUT, PX_PER_MM, toCanvasTopLeft } from "./layout";
import { silhouetteHalfWidth } from "./luminance-probe";

describe("§12.0 R5 geometry — the numbers the dispatch names", () => {
  test('wheelR is 115 (§12.0, "wheelR 106 → 115")', () => {
    expect(WHEEL_R).toBe(115);
    expect(DEVICE_LAYOUT.wheel.outerR).toBe(115);
  });

  test('body is 330 × 552 (§12.0, "body 330 × 552")', () => {
    expect(BODY_W).toBe(330);
    expect(BODY_H).toBe(552);
    expect(DEVICE_LAYOUT.body.width).toBe(330);
    expect(DEVICE_LAYOUT.body.height).toBe(552);
  });

  test("wheel/body is 0.697, against the real 5G’s 0.699 (§12.0)", () => {
    // §12.0: "Wheel/body = 230/330 = 0.697 vs real 0.699."
    expect(((WHEEL_R * 2) / BODY_W).toFixed(3)).toBe("0.697");
  });

  test("Select r 42, lip to 46 (§12.0 R5 table)", () => {
    expect(SELECT_R).toBe(42);
    expect(SELECT_LIP_R).toBe(46);
    expect(DEVICE_LAYOUT.wheel.selectR).toBe(42);
    expect(DEVICE_LAYOUT.wheel.selectLipR).toBe(46);
  });

  test("label band r 77–79 (§12.0 R5 table, measured)", () => {
    expect(LABEL_BAND_INNER_R).toBe(77);
    expect(LABEL_BAND_OUTER_R).toBe(79);
    expect(DEVICE_LAYOUT.wheel.labelBandInnerR).toBe(77);
    expect(DEVICE_LAYOUT.wheel.labelBandOuterR).toBe(79);
  });

  test("the label band constant is innerR + ringW × 0.493, not × 0.57 (§12.0)", () => {
    // §12.0: "The constant is `innerR + ringW × 0.493`, not ×0.57 (which would
    // give r 83.6) and certainly not ×0.30." Both halves are asserted: the
    // multiplier must land inside the measured band, and the one §7.3 states
    // must land outside it. Checking only the first would pass for 0.50, 0.51
    // and every other value that happens to fall in a 2px window.
    const inner = 42;
    const ringW = 115 - 42;
    expect(inner + ringW * 0.493).toBeGreaterThanOrEqual(77);
    expect(inner + ringW * 0.493).toBeLessThanOrEqual(79);
    expect(inner + ringW * 0.57).toBeGreaterThan(79);
  });

  test("recess-shadow reach r 104 (§12.0 R5 table)", () => {
    expect(RECESS_SHADOW_REACH_R).toBe(104);
    expect(DEVICE_LAYOUT.wheel.recessShadowReachR).toBe(104);
  });

  test("panel active area 272 × 204 at scale 0.85 (§7.3 mobile column, §7.4)", () => {
    expect(PANEL_W).toBe(272);
    expect(PANEL_H).toBe(204);
    expect(PANEL_SCALE).toBe(0.85);
    // §7.3(b): rounding the active area to 272 × 204 gives exactly 17/20.
    expect(PANEL_W / PANEL_SCALE).toBe(320);
    expect(PANEL_H / PANEL_SCALE).toBe(240);
  });

  test("body corner radius 33px, superellipse n = 4.2 (§7.3 mobile, §7.1 clause 3)", () => {
    expect(BODY_CORNER_R).toBe(33);
    expect(DEVICE_LAYOUT.body.exponent).toBe(4.2);
  });
});

describe("the vertical chain, re-derived at wheelR 115", () => {
  test("scale is 5.3398 px/mm (§7.3, body 330px / 61.8mm)", () => {
    expect(PX_PER_MM.toFixed(4)).toBe("5.3398");
  });

  test("48 + 204 + 43 + 230 + 27 = 552 (§7.3 millimetres, §12.0 wheel)", () => {
    const chain = DEVICE_LAYOUT.chain;
    expect(chain.topToGlass).toBe(48);
    expect(chain.glassToWheel).toBe(43);
    expect(chain.bottomMargin).toBe(27);
    expect(
      chain.topToGlass + 204 + chain.glassToWheel + 230 + chain.bottomMargin,
    ).toBe(552);
  });

  test("the bottom margin lands on §7.3’s measured 5.2mm", () => {
    // §7.3: "pushes the wheel-bottom-to-body-bottom gap to 45px where the real
    // ratio gives 28px". 5.2mm × 5.3398 = 27.8. The chain closes on 27 as a
    // remainder and independently agrees with the measurement — which is the
    // check that wheelR 115 is self-consistent geometry rather than a patch.
    expect(
      Math.abs(DEVICE_LAYOUT.chain.bottomMargin - 5.2 * PX_PER_MM),
    ).toBeLessThan(1);
  });

  test("screen centre sits 126px above the body centre", () => {
    // 552/2 − 48 − 204/2 = 126, from the chain above.
    expect(DEVICE_LAYOUT.screen.centerY).toBe(126);
    expect(DEVICE_LAYOUT.screen.centerX).toBe(0);
    expect(toCanvasTopLeft(0, DEVICE_LAYOUT.screen.centerY)).toEqual({
      x: 165,
      y: 150,
    });
  });

  test("wheel centre sits 134px below the body centre", () => {
    // 552/2 − (48 + 204 + 43) − 115 = −134.
    expect(DEVICE_LAYOUT.wheel.centerY).toBe(-134);
    expect(DEVICE_LAYOUT.wheel.centerX).toBe(0);
    expect(toCanvasTopLeft(0, DEVICE_LAYOUT.wheel.centerY)).toEqual({
      x: 165,
      y: 410,
    });
  });

  test("glass window is the active area plus a 6px surround (§5.5 L2)", () => {
    expect(DEVICE_LAYOUT.glass.width).toBe(284);
    expect(DEVICE_LAYOUT.glass.height).toBe(216);
  });

  test("body depth is 11.0mm (§7.3, 30GB)", () => {
    expect(DEVICE_LAYOUT.body.depth.toFixed(2)).toBe("58.74");
  });
});

describe("the silhouette is a superellipse, not a rounded rectangle", () => {
  test("n = 4.2 is fuller at the corner than a circular arc of the same radius", () => {
    // At 45° into the corner the superellipse stands proud of the circle; that
    // difference *is* the squircle. Same radius, same box, different curve.
    const y = 552 / 2 - 33 + 33 * Math.SQRT1_2;
    const superellipse = silhouetteHalfWidth(y, 165, 276, 33, 4.2);
    const circular = silhouetteHalfWidth(y, 165, 276, 33, 2);
    expect(superellipse).toBeGreaterThan(circular);
  });

  test("it is exactly the box width away from the corners", () => {
    expect(silhouetteHalfWidth(0, 165, 276, 33, 4.2)).toBe(165);
    expect(silhouetteHalfWidth(240, 165, 276, 33, 4.2)).toBe(165);
  });
});
