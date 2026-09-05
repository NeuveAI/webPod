import { describe, expect, test } from "bun:test";

import { DEFAULT_DEVICE_FORM } from "./form";
import {
  DEFAULT_FRONT_ASSEMBLY_DEPTHS,
  frontShellOffsetAt,
  minimumFrontShellOffsetAroundRect,
  resolveFrontAssemblyDepths,
  SELECT_SEAM_WIDTH,
  SELECT_CONCAVITY,
  WHEEL_GAP_FLOOR_OFFSET,
  WHEEL_OUTER_SEAM_WIDTH,
} from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";
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

  test("the click wheel and Select share the shell's front surface", () => {
    const depths = resolveFrontAssemblyDepths();
    expect(depths.wheelSurfaceBaseZ).toBe(body.depth / 2);
    expect(depths.wheelTopAtCenterZ).toBeCloseTo(
      body.depth / 2 + frontShellOffsetAt(wheel.centerX, wheel.centerY),
      12,
    );
    expect(depths.selectTopAtCenterZ).toBe(depths.wheelTopAtCenterZ - SELECT_CONCAVITY);
    expect(depths.wheelSurfaceBaseZ - depths.wheelGapFloorBaseZ).toBeCloseTo(
      WHEEL_GAP_FLOOR_OFFSET,
      12,
    );
    expect(DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ).toBeGreaterThan(
      depths.wheelTopAtCenterZ,
    );
  });

  test("the wheel and Select are near-flush separate parts without a border ring", () => {
    const depths = resolveFrontAssemblyDepths();
    const annularGap = wheel.selectLipR - wheel.selectR;
    expect(annularGap).toBe(1);
    expect(annularGap / (wheel.selectR * 2)).toBeLessThan(0.024);
    expect(annularGap).toBe(SELECT_SEAM_WIDTH);
    expect(WHEEL_OUTER_SEAM_WIDTH).toBe(0.5);
    expect(depths.selectTopAtCenterZ).toBe(depths.wheelTopAtCenterZ - SELECT_CONCAVITY);
    expect(WHEEL_GAP_FLOOR_OFFSET).toBeLessThan(WHEEL_OUTER_SEAM_WIDTH);
  });

  test("no renderer or calibration path can restore a dome or decorative Select border", async () => {
    const sources = await Promise.all(
      [
        "packages/device/src/Device.tsx",
        "packages/device/src/front-control-geometry.ts",
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
      "device-wheel-well",
      "wheelWellGeometry",
      "selectGeometry = useMemo(() => new CylinderGeometry",
      "curvedAnnulusGeometry",
      "ringDishTiltDeg",
      "ringDishExponent",
      "selectRecess",
      "device-select-border",
      "selectBorderGeometry",
      "selectBezelGeometry",
    ];
    for (const source of sources) {
      for (const symbol of rejected) expect(source).not.toContain(symbol);
    }
    const rig = JSON.parse(
      await Bun.file("packages/device/calibration/rig.json").text(),
    ) as Record<string, unknown>;
    expect(rig["form.recessDepth"]).toBeUndefined();
    expect(rig["form.ringDishTiltDeg"]).toBeUndefined();
    expect(rig["form.ringDishExponent"]).toBeUndefined();
  });

  test("the active LCD keeps its physical grid while only depth moves", () => {
    expect(screen.width).toBe(272);
    expect(screen.height).toBe(204);
    expect(screen.width / screen.height).toBe(4 / 3);
  });
});
