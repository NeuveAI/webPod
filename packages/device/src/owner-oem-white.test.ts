import { describe, expect, test } from "bun:test";

import { hexLuma255 } from "./colour";
import { DEFAULT_DEVICE_FORM } from "./form";
import { resolveFrontAssemblyDepths } from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";
import {
  DEFAULT_DEVICE_MATERIALS,
  DEFAULT_WHEEL_COLOURWAYS,
} from "./materials";

function channels(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe("owner-primary OEM white 5G material relationships", () => {
  test("confirms the Apple-derived front ratios across the owner's four near-front views", () => {
    const { body, wheel } = DEVICE_LAYOUT;
    const selectSeam = wheel.selectLipR - wheel.selectR;

    expect((wheel.outerR * 2) / body.width).toBeCloseTo(235 / 377, 2);
    expect((wheel.selectR * 2) / body.width).toBeCloseTo(84 / 377, 2);
    expect(DEVICE_LAYOUT.chain.wheelCenterFromTop / body.height).toBeCloseTo(
      390 / 552,
      12,
    );
    expect(DEVICE_LAYOUT.chain.screenTopFromTop / body.height).toBeCloseTo(
      24 / 552,
      12,
    );
    expect(selectSeam / (wheel.selectR * 2)).toBeLessThan(0.02);
  });

  test("keeps the photographed faceplate → wheel → Select ordering near-coplanar", () => {
    const depths = resolveFrontAssemblyDepths();
    const wheelOuterFaceZ = depths.ringZ + depths.ringSag;

    expect(depths.wheelReferenceZ).toBeGreaterThan(wheelOuterFaceZ);
    expect(wheelOuterFaceZ).toBeGreaterThan(depths.selectFaceZ);
    expect(DEFAULT_DEVICE_FORM.recessDepth).toBe(1);
    expect(DEFAULT_DEVICE_FORM.selectRecess).toBe(0.5);
    expect(
      DEFAULT_DEVICE_FORM.recessDepth / DEVICE_LAYOUT.body.width,
    ).toBeLessThan(0.004);
    expect(DEFAULT_DEVICE_FORM.selectRecess).toBeLessThan(
      DEVICE_LAYOUT.wheel.selectLipR - DEVICE_LAYOUT.wheel.selectR,
    );
  });

  test("keeps the faceplate mildly warm and the wheel distinctly cool", () => {
    const [bodyR, , bodyB] = channels(DEFAULT_DEVICE_MATERIALS.bodyWhite.color);
    const [wheelR, , wheelB] = channels(
      DEFAULT_WHEEL_COLOURWAYS.white.ring.color,
    );

    expect(bodyR - bodyB).toBeGreaterThanOrEqual(8);
    expect(bodyR - bodyB).toBeLessThan(18);
    expect(wheelB - wheelR).toBeGreaterThanOrEqual(5);
    expect(
      hexLuma255(DEFAULT_DEVICE_MATERIALS.bodyWhite.color),
    ).toBeGreaterThan(
      hexLuma255(DEFAULT_WHEEL_COLOURWAYS.white.ring.color) + 20,
    );
    // Regression against encoding the warm room light as strong yellow.
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.color).not.toBe("#FFF0D5");
    // Regression against the former cool/blue shell.
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.color).not.toBe("#F4F7FA");
  });

  test("keeps Select cream, separate from both wheel and faceplate", () => {
    const { ring, select } = DEFAULT_WHEEL_COLOURWAYS.white;
    const [selectR, , selectB] = channels(select.color);

    expect(selectR - selectB).toBeGreaterThanOrEqual(10);
    expect(hexLuma255(select.color)).toBeGreaterThan(
      hexLuma255(ring.color) + 20,
    );
    expect(select.color).not.toBe(ring.color);
    expect(select.color).not.toBe(DEFAULT_DEVICE_MATERIALS.bodyWhite.color);
    expect(select.roughness).not.toBe(ring.roughness);
    expect(select.clearcoat).not.toBe(ring.clearcoat);
  });

  test("uses light legends on white hardware and never restores dark-grey ink", () => {
    const { labelColor, ring } = DEFAULT_WHEEL_COLOURWAYS.white;
    const [labelR, , labelB] = channels(labelColor);

    expect(hexLuma255(labelColor)).toBeGreaterThan(hexLuma255(ring.color) + 20);
    expect(labelR).toBeGreaterThanOrEqual(labelB);
    expect(labelColor).not.toBe("#7B838E");
    expect(labelColor).not.toBe("#5E646D");
    expect(labelColor).not.toBe(DEFAULT_WHEEL_COLOURWAYS.black.labelColor);
  });

  test("lets physical occlusion, not a dark-painted floor, draw the hairline seam", () => {
    const floor = DEFAULT_DEVICE_MATERIALS.wheelWellWhite;
    const ring = DEFAULT_WHEEL_COLOURWAYS.white.ring;

    expect(hexLuma255(floor.color)).toBeGreaterThan(hexLuma255(ring.color));
    expect(floor.albedoScale).toBeGreaterThanOrEqual(ring.albedoScale ?? 1);
    expect(floor.color).not.toBe("#D9E1E9");
  });
});
