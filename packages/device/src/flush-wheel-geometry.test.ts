import { describe, expect, test } from "bun:test";

import { createFrontControlPatchGeometry, maximumCoincidentWallHeight } from "./front-control-geometry";
import { DEFAULT_DEVICE_FORM } from "./form";
import {
  frontShellNormalAt,
  frontShellOffsetAt,
  resolveFrontAssemblyDepths,
  SELECT_SEAM_WIDTH,
  WHEEL_GAP_FLOOR_OFFSET,
  WHEEL_OUTER_SEAM_WIDTH,
} from "./front-surface";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";
import { DEFAULT_WHEEL_COLOURWAYS } from "./materials";
import { IPOD_5G_30GB_PHYSICAL_SPEC } from "./physical-spec";

const { body, wheel } = DEVICE_LAYOUT;
const ACCEPTANCE =
  IPOD_5G_30GB_PHYSICAL_SPEC.wheelAssemblyAcceptanceMm;

function wheelGeometry() {
  return createFrontControlPatchGeometry(
    {
      centerX: wheel.centerX,
      centerY: wheel.centerY,
      innerRadius: wheel.selectLipR,
      outerRadius: wheel.outerR - WHEEL_OUTER_SEAM_WIDTH,
      uvRadius: wheel.outerR,
    },
    DEFAULT_DEVICE_FORM,
  );
}

function selectGeometry() {
  return createFrontControlPatchGeometry(
    {
      centerX: wheel.centerX,
      centerY: wheel.centerY,
      innerRadius: 0,
      outerRadius: wheel.selectR,
      uvRadius: wheel.outerR,
    },
    DEFAULT_DEVICE_FORM,
  );
}

describe("owner-primary flush wheel topology", () => {
  test("wheel vertices occupy the exact local faceplate surface", () => {
    const geometry = wheelGeometry();
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    let maximumPlaneDelta = 0;
    let maximumNormalAngle = 0;
    for (let index = 0; index < position.count; index += 37) {
      const globalX = wheel.centerX + position.getX(index);
      const globalY = wheel.centerY + position.getY(index);
      maximumPlaneDelta = Math.max(
        maximumPlaneDelta,
        Math.abs(
          position.getZ(index) -
            frontShellOffsetAt(globalX, globalY, DEFAULT_DEVICE_FORM),
        ),
      );
      const expected = frontShellNormalAt(
        globalX,
        globalY,
        DEFAULT_DEVICE_FORM,
      );
      const dot =
        expected.x * normal.getX(index) +
        expected.y * normal.getY(index) +
        expected.z * normal.getZ(index);
      maximumNormalAngle = Math.max(
        maximumNormalAngle,
        Math.acos(Math.min(1, Math.max(-1, dot))),
      );
    }
    expect(maximumPlaneDelta / PX_PER_MM).toBeLessThan(
      ACCEPTANCE.topPlaneTolerance,
    );
    expect(maximumPlaneDelta).toBeLessThan(1e-5);
    expect(maximumNormalAngle).toBeLessThan(0.0005);
    geometry.dispose();
  });

  test("faceplate, wheel and Select are coincident at the shared center plane", () => {
    const depths = resolveFrontAssemblyDepths();
    const select = selectGeometry();
    const selectCenterZ = select.getAttribute("position").getZ(0);
    const shellCenterZ =
      body.depth / 2 +
      frontShellOffsetAt(wheel.centerX, wheel.centerY, DEFAULT_DEVICE_FORM);

    expect(depths.wheelTopAtCenterZ).toBeCloseTo(shellCenterZ, 12);
    expect(depths.selectTopAtCenterZ).toBeCloseTo(shellCenterZ, 12);
    expect(
      Math.abs(
        depths.wheelTopAtCenterZ - depths.selectTopAtCenterZ,
      ) / PX_PER_MM,
    ).toBeLessThanOrEqual(ACCEPTANCE.topPlaneTolerance);
    expect(
      Math.abs(
        depths.wheelSurfaceBaseZ + selectCenterZ - shellCenterZ,
      ) / PX_PER_MM,
    ).toBeLessThanOrEqual(ACCEPTANCE.topPlaneTolerance);
    select.dispose();
  });

  test("both installed gaps remain physical-scale hairlines", () => {
    expect(WHEEL_OUTER_SEAM_WIDTH / PX_PER_MM).toBeLessThanOrEqual(
      ACCEPTANCE.outerSeamMaximum,
    );
    expect(SELECT_SEAM_WIDTH / PX_PER_MM).toBeLessThanOrEqual(
      ACCEPTANCE.selectSeamMaximum,
    );
    expect(WHEEL_GAP_FLOOR_OFFSET / PX_PER_MM).toBeLessThanOrEqual(
      ACCEPTANCE.visibleSidewallMaximum,
    );
    expect(WHEEL_OUTER_SEAM_WIDTH).toBeLessThan(1);
    expect(SELECT_SEAM_WIDTH).toBe(1);
  });

  test("the defined 40° oblique can expose no wheel or Select sidewall", () => {
    const wheelPatch = wheelGeometry();
    const selectPatch = selectGeometry();
    const projectedWheelWall =
      (maximumCoincidentWallHeight(wheelPatch) *
        Math.sin((ACCEPTANCE.referenceObliqueDegrees * Math.PI) / 180)) /
      PX_PER_MM;
    const projectedSelectWall =
      (maximumCoincidentWallHeight(selectPatch) *
        Math.sin((ACCEPTANCE.referenceObliqueDegrees * Math.PI) / 180)) /
      PX_PER_MM;

    expect(projectedWheelWall).toBe(0);
    expect(projectedSelectWall).toBe(0);
    expect(projectedWheelWall).toBeLessThanOrEqual(
      ACCEPTANCE.visibleSidewallMaximum,
    );
    expect(projectedSelectWall).toBeLessThanOrEqual(
      ACCEPTANCE.visibleSidewallMaximum,
    );
    wheelPatch.dispose();
    selectPatch.dispose();
  });

  test("production contains no pocket, annular bevel or shadow proxy", async () => {
    const device = await Bun.file("packages/device/src/Device.tsx").text();
    const form = await Bun.file("packages/device/src/form.ts").text();
    const controlSection = device.slice(
      device.indexOf("const ringGeometry"),
      device.indexOf("const glassGeometry"),
    );
    const wheelMeshes = device.slice(
      device.indexOf('name="device-wheel-gap-floor"'),
      device.indexOf("{/* ⚑ The W6 boundary"),
    );

    expect(controlSection).not.toContain("CylinderGeometry");
    expect(controlSection).not.toContain("ExtrudeGeometry");
    expect(controlSection).not.toContain("TorusGeometry");
    expect(controlSection).not.toContain("surfaceOffset");
    expect(device).not.toContain('name="device-wheel-well"');
    expect(device).not.toContain("device-select-border");
    expect(device).not.toContain("selectBezelGeometry");
    expect(wheelMeshes).not.toContain("castShadow");
    expect(wheelMeshes).not.toContain("receiveShadow");
    expect(wheelMeshes).not.toContain("aoMap");
    expect(wheelMeshes).toContain(
      "position={[wheel.centerX, wheel.centerY, wheelSurfaceBaseZ]}",
    );
    expect(form).not.toContain("recessDepth");
    expect(form).not.toContain("selectRecess");
    expect(form).not.toContain("selectThickness");
    expect(form).not.toContain("wheelWellDepth");
    expect(form).not.toContain("ringDish");
  });

  test("both Select parts are matte dielectric plastics, never metal discs", () => {
    for (const colourway of ["black", "white"] as const) {
      const select = DEFAULT_WHEEL_COLOURWAYS[colourway].select;
      expect(select.metalness).toBe(0);
      expect(select.transmission).toBe(0);
      expect(select.roughness).toBeGreaterThanOrEqual(0.65);
      expect(select.clearcoat).toBeLessThanOrEqual(0.02);
      expect(select.color).not.toBe(
        DEFAULT_WHEEL_COLOURWAYS[colourway].ring.color,
      );
    }
  });
});
