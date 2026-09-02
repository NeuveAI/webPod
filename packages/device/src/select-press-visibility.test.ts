import { describe, expect, test } from "bun:test";
import {
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Raycaster,
  Vector3,
  type BufferGeometry,
} from "three";

import {
  CONTROL_TRAVEL,
  ControlPhysicsController,
} from "./control-physics";
import {
  createFrontControlPatchGeometry,
  createWheelGapFloorGeometries,
} from "./front-control-geometry";
import { DEFAULT_DEVICE_FORM } from "./form";
import {
  resolveFrontAssemblyDepths,
  WHEEL_OUTER_SEAM_WIDTH,
} from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";

const { wheel } = DEVICE_LAYOUT;

function radialBounds(geometry: BufferGeometry): {
  readonly minimum: number;
  readonly maximum: number;
} {
  const position = geometry.getAttribute("position");
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = 0;
  for (let index = 0; index < position.count; index += 1) {
    const radius = Math.hypot(position.getX(index), position.getY(index));
    minimum = Math.min(minimum, radius);
    maximum = Math.max(maximum, radius);
  }
  return { minimum, maximum };
}

function frontHit(
  model: Group,
  localX: number,
  localY: number,
): ReturnType<Raycaster["intersectObject"]>[number] | undefined {
  model.updateMatrixWorld(true);
  return new Raycaster(
    new Vector3(wheel.centerX + localX, wheel.centerY + localY, 1_000),
    new Vector3(0, 0, -1),
  ).intersectObject(model, true)[0];
}

describe("Select press visibility", () => {
  test("the fixed wheel floor occupies only the two authored seams", () => {
    const floor = createWheelGapFloorGeometries(DEFAULT_DEVICE_FORM);
    const select = radialBounds(floor.selectSeam);
    const outer = radialBounds(floor.outerSeam);

    expect(select.minimum).toBeCloseTo(wheel.selectR, 5);
    expect(select.maximum).toBeCloseTo(wheel.selectLipR, 5);
    expect(outer.minimum).toBeCloseTo(
      wheel.outerR - WHEEL_OUTER_SEAM_WIDTH,
      5,
    );
    expect(outer.maximum).toBeCloseTo(wheel.outerR, 5);
    expect(select.minimum).toBeGreaterThan(0);
    expect(outer.minimum).toBeGreaterThan(wheel.selectLipR);

    floor.selectSeam.dispose();
    floor.outerSeam.dispose();
  });

  test("the held button remains the first visible plastic at four angles and radii", () => {
    const depths = resolveFrontAssemblyDepths(DEFAULT_DEVICE_FORM);
    const floor = createWheelGapFloorGeometries(DEFAULT_DEVICE_FORM);
    const selectGeometry = createFrontControlPatchGeometry(
      {
        centerX: wheel.centerX,
        centerY: wheel.centerY,
        innerRadius: 0,
        outerRadius: wheel.selectR,
        uvRadius: wheel.outerR,
      },
      DEFAULT_DEVICE_FORM,
    );
    const selectMaterial = new MeshPhysicalMaterial({
      name: "select-production-plastic",
      color: "#F6F2E9",
      metalness: 0,
      roughness: 0.72,
    });
    const gapMaterial = new MeshPhysicalMaterial({
      name: "wheel-gap-floor",
      color: "#17191D",
      metalness: 0,
      roughness: 0.8,
    });
    const model = new Group();
    const select = new Mesh(selectGeometry, selectMaterial);
    select.name = "device-select";
    select.position.set(wheel.centerX, wheel.centerY, depths.wheelSurfaceBaseZ);
    const selectSeam = new Mesh(floor.selectSeam, gapMaterial);
    selectSeam.name = "device-select-seam-floor";
    selectSeam.position.set(
      wheel.centerX,
      wheel.centerY,
      depths.wheelGapFloorBaseZ,
    );
    const outerSeam = new Mesh(floor.outerSeam, gapMaterial);
    outerSeam.name = "device-outer-seam-floor";
    outerSeam.position.copy(selectSeam.position);
    model.add(selectSeam, outerSeam, select);

    const materialBefore = select.material;
    const controller = new ControlPhysicsController({
      invalidate: () => undefined,
      now: () => 0,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
    });
    controller.attachSelect(select);
    controller.pressSelect();

    expect(select.position.z).toBe(
      depths.wheelSurfaceBaseZ - CONTROL_TRAVEL.selectModel,
    );
    expect(select.material).toBe(materialBefore);
    for (const radius of [0, wheel.selectR * 0.45, wheel.selectR * 0.9]) {
      for (const angleDeg of [0, 90, 180, 270]) {
        const angle = (angleDeg * Math.PI) / 180;
        const hit = frontHit(
          model,
          radius * Math.cos(angle),
          radius * Math.sin(angle),
        );
        expect(hit?.object.name).toBe("device-select");
        expect((hit?.object as Mesh | undefined)?.material).toBe(materialBefore);
      }
    }
    expect(frontHit(model, (wheel.selectR + wheel.selectLipR) / 2, 0)?.object.name)
      .toBe("device-select-seam-floor");

    controller.releaseSelect();
    controller.setReducedMotion(true);
    expect(select.position.z).toBe(depths.wheelSurfaceBaseZ);
    expect(select.material).toBe(materialBefore);

    controller.dispose();
    selectGeometry.dispose();
    floor.selectSeam.dispose();
    floor.outerSeam.dispose();
    selectMaterial.dispose();
    gapMaterial.dispose();
  });
});
