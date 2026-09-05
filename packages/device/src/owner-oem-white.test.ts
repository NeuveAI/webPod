import { describe, expect, test } from "bun:test";

import { hexLuma255 } from "./colour";
import { resolveFrontAssemblyDepths, SELECT_CONCAVITY } from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";
import {
  DEFAULT_DEVICE_MATERIALS,
  DEFAULT_WHEEL_COLOURWAYS,
} from "./materials";

function channels(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe("Classic silver material relationships with preserved front layout", () => {
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

  test("keeps the wheel flush and the Classic Select center slightly concave", () => {
    const depths = resolveFrontAssemblyDepths();

    expect(depths.wheelTopAtCenterZ - depths.selectTopAtCenterZ).toBeCloseTo(SELECT_CONCAVITY, 12);
    expect(depths.wheelSurfaceBaseZ).toBe(DEVICE_LAYOUT.body.depth / 2);
  });

  test("silver is neutral metal and the light wheel is a brighter plastic", () => {
    const [r, , b] = channels(DEFAULT_DEVICE_MATERIALS.bodyWhite.color);
    expect(Math.abs(r - b)).toBeLessThan(5);
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.metalness).toBe(1);
    expect(DEFAULT_WHEEL_COLOURWAYS.white.ring.metalness).toBe(0);
    expect(hexLuma255(DEFAULT_WHEEL_COLOURWAYS.white.ring.color)).toBeGreaterThan(
      hexLuma255(DEFAULT_DEVICE_MATERIALS.bodyWhite.color),
    );
  });

  test("Select matches the faceplate finish and remains distinct from plastic", () => {
    const { ring, select } = DEFAULT_WHEEL_COLOURWAYS.white;
    expect(select).toBe(DEFAULT_DEVICE_MATERIALS.bodyWhite);
    expect(select.color).not.toBe(ring.color);
    expect(select.roughness).toBeLessThan(ring.roughness);
    expect(select.metalness).toBe(1);
    expect(select.transmission).toBe(0);
  });

  test("silver hardware uses dark legends on the light wheel", () => {
    const { labelColor, ring } = DEFAULT_WHEEL_COLOURWAYS.white;
    expect(hexLuma255(labelColor)).toBeLessThan(hexLuma255(ring.color) - 100);
  });

  test("keeps the wheel gap floor neutral with a matte response", () => {
    const floor = DEFAULT_DEVICE_MATERIALS.wheelWellWhite;
    expect(hexLuma255(floor.color)).toBeGreaterThan(200);
    expect(floor.metalness).toBe(0);
    expect(floor.roughness).toBeGreaterThan(0.8);
  });
});
