import { describe, expect, test } from "bun:test";

import { DEFAULT_DEVICE_FORM } from "./form";
import {
  DEFAULT_FRONT_ASSEMBLY_DEPTHS,
  frontShellOffsetAt,
  minimumFrontShellOffsetAroundCircle,
  minimumFrontShellOffsetAroundRect,
  resolveFrontAssemblyDepths,
} from "./front-surface";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";
import { DEVICE_SURFACE_LAYOUT } from "./surface-layout";

const { body, screen, wheel } = DEVICE_LAYOUT;

describe("front assemblies share the crowned shell frame", () => {
  test("the production crown is subtle rather than a second chassis depth", () => {
    expect(DEFAULT_DEVICE_FORM.bodyCrown).toBe(1.2);
    expect(DEFAULT_DEVICE_FORM.bodyCrossCrown).toBe(1.2);
    expect(DEFAULT_DEVICE_FORM.bodyCrown).not.toBe(6.2);
    expect(DEFAULT_DEVICE_FORM.bodyCrossCrown).not.toBe(6.2);
  });

  test("flat display layers remain recessed at every outer corner", () => {
    const depths = resolveFrontAssemblyDepths();
    const well = DEVICE_SURFACE_LAYOUT.front.displayWell;
    const minimum = minimumFrontShellOffsetAroundRect(well);
    expect(depths.displayReferenceZ).toBeCloseTo(body.depth / 2 + minimum, 12);

    for (const x of [
      well.centerX - well.width / 2,
      well.centerX + well.width / 2,
    ]) {
      for (const y of [
        well.centerY - well.height / 2,
        well.centerY + well.height / 2,
      ]) {
        const localShellZ = body.depth / 2 + frontShellOffsetAt(x, y);
        expect(localShellZ - depths.glassFrontZ).toBeGreaterThanOrEqual(
          DEFAULT_DEVICE_FORM.glassInset - 1e-10,
        );
      }
    }
    expect(depths.glassFrontZ - depths.screenFrontZ).toBeCloseTo(
      DEFAULT_DEVICE_FORM.glassThickness + DEFAULT_DEVICE_FORM.glassToPanel,
      12,
    );
    expect(depths.displayReferenceZ - depths.displayWellFrontZ).toBeCloseTo(
      DEFAULT_DEVICE_FORM.displayWellInset,
      12,
    );
  });

  test("the click wheel never pierces the shell around its full opening", () => {
    const depths = resolveFrontAssemblyDepths();
    const minimum = minimumFrontShellOffsetAroundCircle({
      centerX: wheel.centerX,
      centerY: wheel.centerY,
      radius: wheel.outerR,
    });
    expect(depths.wheelReferenceZ).toBeCloseTo(body.depth / 2 + minimum, 12);
    const wheelOuterSurfaceZ = depths.ringZ + depths.ringSag;

    for (let sample = 0; sample < 256; sample += 1) {
      const angle = (sample / 256) * Math.PI * 2;
      const localShellZ =
        body.depth / 2 +
        frontShellOffsetAt(
          wheel.centerX + Math.cos(angle) * wheel.outerR,
          wheel.centerY + Math.sin(angle) * wheel.outerR,
        );
      expect(localShellZ - wheelOuterSurfaceZ).toBeGreaterThanOrEqual(
        DEFAULT_DEVICE_FORM.recessDepth - 1e-10,
      );
    }
    expect(DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ).toBeCloseTo(
      wheelOuterSurfaceZ + 0.25,
      12,
    );
  });

  test("the flat Select is a separate part recessed below the wheel", () => {
    const depths = resolveFrontAssemblyDepths();
    const annularGap = wheel.selectLipR - wheel.selectR;
    expect(annularGap).toBe(4);
    expect(annularGap / wheel.outerR).toBeLessThan(0.05);
    expect(depths.selectFaceZ).toBeCloseTo(
      depths.ringInnerZ - DEFAULT_DEVICE_FORM.selectRecess,
      12,
    );
    expect(depths.selectFaceZ).toBeLessThan(depths.ringInnerZ);
    expect(DEFAULT_DEVICE_FORM.selectRecess / PX_PER_MM).toBeCloseTo(0.3, 2);
    expect(DEFAULT_DEVICE_FORM.selectThickness).toBeGreaterThan(0);
  });

  test("no renderer or calibration path can restore the proud dome", async () => {
    const sources = await Promise.all(
      [
        "packages/device/src/Device.tsx",
        "packages/device/src/curved-discs.ts",
        "packages/device/src/form.ts",
        "packages/device/calibration/apply-rig.ts",
        "packages/device/calibration/tune.ts",
        "packages/device/calibration/rig.json",
      ].map((path) => Bun.file(path).text()),
    );
    const rejected = [
      "domedDiscGeometry",
      "selectDomeTiltDeg",
      "selectDomeExponent",
      "selectProud",
      "selectRise",
      "selectThicknessMap",
    ];
    for (const source of sources) {
      for (const symbol of rejected) expect(source).not.toContain(symbol);
    }
  });

  test("the active LCD keeps its physical grid while only depth moves", () => {
    expect(screen.width).toBe(272);
    expect(screen.height).toBe(204);
    expect(screen.width / screen.height).toBe(4 / 3);
  });
});
