import { describe, expect, test } from "bun:test";
import {
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  CONTROL_RELEASE_MS,
  CONTROL_STALLED_FRAME_LIMIT,
  CONTROL_TRAVEL,
  ControlPhysicsController,
  type ControlPhysicsDependencies,
} from "./control-physics";
import { createFrontControlPatchGeometry } from "./front-control-geometry";
import { DEFAULT_DEVICE_FORM } from "./form";
import {
  WHEEL_GAP_FLOOR_OFFSET,
  WHEEL_OUTER_SEAM_WIDTH,
} from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";

const { wheel } = DEVICE_LAYOUT;

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

function wheelBackingGeometry() {
  return createFrontControlPatchGeometry(
    {
      centerX: wheel.centerX,
      centerY: wheel.centerY,
      innerRadius: 0,
      outerRadius: wheel.outerR,
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

function productionSelectControl() {
  const geometry = selectGeometry();
  const material = new MeshPhysicalMaterial({
    color: "#F6F2E9",
    metalness: 0,
    roughness: 0.72,
  });
  const select = new Mesh(geometry, material);
  select.name = "device-select";
  select.position.set(4.5, -6.25, 3.75);
  select.updateMatrix();
  return { select, geometry, material };
}

function productionWheelAssembly() {
  const ring = wheelGeometry();
  const backing = wheelBackingGeometry();
  const assembly = new Group();
  assembly.name = "device-wheel-assembly";
  assembly.position.set(3.25, -7.5, 1.125);
  assembly.add(new Mesh(backing), new Mesh(ring), new Mesh(ring));
  assembly.updateMatrix();
  return { assembly, ring, backing };
}

class FrameHarness {
  now = 0;
  invalidations = 0;
  requests = 0;
  cancels = 0;
  #nextFrame = 1;
  readonly #callbacks = new Map<number, FrameRequestCallback>();

  readonly dependencies: ControlPhysicsDependencies = {
    invalidate: () => {
      this.invalidations += 1;
    },
    now: () => this.now,
    requestFrame: (callback) => {
      const frame = this.#nextFrame;
      this.#nextFrame += 1;
      this.requests += 1;
      this.#callbacks.set(frame, callback);
      return frame;
    },
    cancelFrame: (frame) => {
      this.cancels += 1;
      this.#callbacks.delete(frame);
    },
  };

  get pending(): number {
    return this.#callbacks.size;
  }

  step(timestampMs: number): void {
    this.now = timestampMs;
    const entry = this.#callbacks.entries().next().value as
      readonly [number, FrameRequestCallback] | undefined;
    if (entry === undefined) return;
    this.#callbacks.delete(entry[0]);
    entry[1](timestampMs);
  }
}

function snapshot(
  geometry: ReturnType<typeof wheelGeometry>,
  name: "position" | "normal",
) {
  const attribute = geometry.getAttribute(name);
  if (!(attribute.array instanceof Float32Array)) {
    throw new Error("test geometry must use float attributes");
  }
  return attribute.array.slice();
}

function transformedPositions(
  positions: Float32Array,
  matrix: Matrix4,
): Float64Array {
  const transformed = new Float64Array(positions.length);
  const point = new Vector3();
  for (let index = 0; index < positions.length; index += 3) {
    point
      .set(
        positions[index] ?? 0,
        positions[index + 1] ?? 0,
        positions[index + 2] ?? 0,
      )
      .applyMatrix4(matrix);
    transformed[index] = point.x;
    transformed[index + 1] = point.y;
    transformed[index + 2] = point.z;
  }
  return transformed;
}

function maximumPairwiseDistanceError(
  rest: Float64Array,
  live: Float64Array,
): number {
  let maximum = 0;
  for (let left = 0; left < rest.length; left += 3) {
    for (let right = left + 3; right < rest.length; right += 3) {
      const restDistance = Math.hypot(
        (rest[left] ?? 0) - (rest[right] ?? 0),
        (rest[left + 1] ?? 0) - (rest[right + 1] ?? 0),
        (rest[left + 2] ?? 0) - (rest[right + 2] ?? 0),
      );
      const liveDistance = Math.hypot(
        (live[left] ?? 0) - (live[right] ?? 0),
        (live[left + 1] ?? 0) - (live[right + 1] ?? 0),
        (live[left + 2] ?? 0) - (live[right + 2] ?? 0),
      );
      maximum = Math.max(maximum, Math.abs(liveDistance - restDistance));
    }
  }
  return maximum;
}

function pointAtClockwiseAngle(
  angleDeg: number,
  radius = wheel.outerR - WHEEL_OUTER_SEAM_WIDTH,
): Vector3 {
  const angle = (angleDeg * Math.PI) / 180;
  return new Vector3(radius * Math.cos(angle), -radius * Math.sin(angle), 0);
}

describe("rigid physical click-wheel tilt", () => {
  test("the restrained rigid calibration and release laws are explicit", () => {
    expect(CONTROL_TRAVEL.wheelMm).toBe(0.006);
    expect(CONTROL_TRAVEL.wheelMm).toBeLessThan(0.03);
    expect(CONTROL_TRAVEL.wheelModel).toBeLessThan(
      WHEEL_GAP_FLOOR_OFFSET,
    );
    expect(CONTROL_TRAVEL.selectMm).toBe(0.12);
    expect(CONTROL_TRAVEL.selectMm).toBeLessThan(0.15);
    expect(CONTROL_RELEASE_MS).toEqual({ wheel: 120, select: 96 });
    expect(CONTROL_STALLED_FRAME_LIMIT).toBe(24);
  });

  test("the complete production tessellation receives one distance-preserving rigid transform", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const ringPosition = snapshot(ring, "position");
    const ringNormal = snapshot(ring, "normal");
    const backingPosition = snapshot(backing, "position");
    const backingNormal = snapshot(backing, "normal");
    const restPosition = assembly.position.clone();
    const restQuaternion = assembly.quaternion.clone();
    const restScale = assembly.scale.clone();
    const restMatrix = assembly.matrix.clone();
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);

    controller.pressWheel(37);
    expect(assembly.position).toEqual(restPosition);
    expect(assembly.scale).toEqual(restScale);
    expect(assembly.quaternion.angleTo(restQuaternion)).toBeGreaterThan(0);
    expect([...snapshot(ring, "position")]).toEqual([...ringPosition]);
    expect([...snapshot(ring, "normal")]).toEqual([...ringNormal]);
    expect([...snapshot(backing, "position")]).toEqual([...backingPosition]);
    expect([...snapshot(backing, "normal")]).toEqual([...backingNormal]);

    const restWorld = transformedPositions(ringPosition, restMatrix);
    const liveWorld = transformedPositions(ringPosition, assembly.matrix);
    expect(maximumPairwiseDistanceError(restWorld, liveWorld)).toBeLessThan(
      1e-10,
    );

    controller.dispose();
    expect(assembly.position).toEqual(restPosition);
    expect(assembly.quaternion.toArray()).toEqual(restQuaternion.toArray());
    expect(assembly.scale).toEqual(restScale);
    expect(snapshot(ring, "position")).toEqual(ringPosition);
    expect(snapshot(ring, "normal")).toEqual(ringNormal);
    ring.dispose();
    backing.dispose();
  });

  test("the low side follows contact continuously while object-space circles never change", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const position = snapshot(ring, "position");
    const boundaryRadii = new Set<number>();
    for (let index = 0; index < position.length; index += 3) {
      boundaryRadii.add(
        Math.hypot(position[index] ?? 0, position[index + 1] ?? 0),
      );
    }
    const sorted = [...boundaryRadii].sort((a, b) => a - b);
    const inner = sorted[0];
    const outer = sorted.at(-1);
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);
    controller.pressWheel(0);

    for (let angle = 0; angle <= 360; angle += 2) {
      controller.moveWheel(angle);
      const contact = pointAtClockwiseAngle(angle);
      const opposite = pointAtClockwiseAngle(angle + 180);
      const perpendicular = pointAtClockwiseAngle(angle + 90);
      const liveContact = contact.clone().applyMatrix4(assembly.matrix);
      const liveOpposite = opposite.clone().applyMatrix4(assembly.matrix);
      const livePerpendicular = perpendicular
        .clone()
        .applyMatrix4(assembly.matrix);
      const restContact = contact.clone().add(assembly.position);
      const restOpposite = opposite.clone().add(assembly.position);
      const restPerpendicular = perpendicular.clone().add(assembly.position);
      expect(liveContact.z - restContact.z).toBeCloseTo(
        -CONTROL_TRAVEL.wheelModel,
        10,
      );
      expect(liveOpposite.z - restOpposite.z).toBeCloseTo(
        CONTROL_TRAVEL.wheelModel,
        10,
      );
      expect(livePerpendicular.z - restPerpendicular.z).toBeCloseTo(0, 10);
      expect([...snapshot(ring, "position")]).toEqual([...position]);
    }
    expect(inner).toBeCloseTo(wheel.selectLipR, 4);
    expect(outer).toBeCloseTo(wheel.outerR - WHEEL_OUTER_SEAM_WIDTH, 4);

    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("a rotated device applies the same rigid rotation to vertices and normals", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const ringNormal = snapshot(ring, "normal");
    const parent = new Group();
    parent.rotation.set(0.37, -0.58, 0.21, "XYZ");
    parent.add(assembly);
    parent.updateWorldMatrix(true, true);
    const restPosition = assembly.position.clone();
    const restScale = assembly.scale.clone();
    const restAssemblyQuaternion = assembly.quaternion.clone();
    const parentWorldQuaternion = parent.getWorldQuaternion(new Quaternion());
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);

    controller.pressWheel(90);
    parent.updateWorldMatrix(true, true);
    const liveNormal = new Vector3(0, 0, 1).applyQuaternion(
      assembly.getWorldQuaternion(assembly.quaternion.clone()),
    );
    const expectedNormal = new Vector3(0, 0, 1)
      .applyAxisAngle(new Vector3(1, 0, 0), Math.asin(
        CONTROL_TRAVEL.wheelModel /
          (wheel.outerR - WHEEL_OUTER_SEAM_WIDTH),
      ))
      .applyQuaternion(restAssemblyQuaternion)
      .applyQuaternion(parentWorldQuaternion);
    expect(assembly.position).toEqual(restPosition);
    expect(assembly.scale).toEqual(restScale);
    expect(liveNormal.angleTo(expectedNormal)).toBeLessThan(1e-7);
    expect([...snapshot(ring, "normal")]).toEqual([...ringNormal]);

    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("wheel release is monotonic in tilt and restores exact rest", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    const restPosition = assembly.position.clone();
    const restQuaternion = assembly.quaternion.clone();
    controller.attachWheel(assembly);
    controller.pressWheel(143);
    controller.releaseWheel();
    let previousAngle = assembly.quaternion.angleTo(restQuaternion);

    for (const elapsed of [15, 45, 90, CONTROL_RELEASE_MS.wheel]) {
      harness.step(elapsed);
      const liveAngle = assembly.quaternion.angleTo(restQuaternion);
      expect(assembly.position).toEqual(restPosition);
      expect(liveAngle).toBeLessThanOrEqual(previousAngle);
      previousAngle = liveAngle;
    }
    expect(assembly.quaternion.toArray()).toEqual(restQuaternion.toArray());
    expect(harness.pending).toBe(0);

    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("reduced motion during release restores and presents the exact rest transform", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const restPosition = assembly.position.clone();
    const restQuaternion = assembly.quaternion.clone();
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(assembly);
    controller.pressWheel(225);
    controller.releaseWheel();
    harness.step(32);
    expect(assembly.quaternion.angleTo(restQuaternion)).toBeGreaterThan(0);
    expect(harness.invalidations).toBe(2);
    expect(harness.pending).toBe(1);

    controller.setReducedMotion(true);

    expect(assembly.position).toEqual(restPosition);
    expect(assembly.quaternion.toArray()).toEqual(restQuaternion.toArray());
    expect(harness.invalidations).toBe(3);
    expect(harness.pending).toBe(0);
    expect(harness.cancels).toBe(1);
    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("detach and rebind restore only the matching rigid assembly", () => {
    const first = productionWheelAssembly();
    const second = productionWheelAssembly();
    second.assembly.position.set(-4, 6, 2.5);
    second.assembly.updateMatrix();
    const firstRest = first.assembly.quaternion.clone();
    const secondRest = second.assembly.quaternion.clone();
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    const detachFirst = controller.attachWheel(first.assembly);
    controller.pressWheel(12);
    expect(first.assembly.quaternion.angleTo(firstRest)).toBeGreaterThan(0);

    const detachSecond = controller.attachWheel(second.assembly);
    expect(first.assembly.quaternion.toArray()).toEqual(firstRest.toArray());
    controller.pressWheel(281);
    const secondMoved = second.assembly.quaternion.clone();
    detachFirst();
    expect(second.assembly.quaternion.toArray()).toEqual(secondMoved.toArray());
    detachSecond();
    expect(second.assembly.quaternion.toArray()).toEqual(secondRest.toArray());

    controller.dispose();
    first.ring.dispose();
    first.backing.dispose();
    second.ring.dispose();
    second.backing.dispose();
  });

  test("Select is one restrained device-local Z press with invariant plastic", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const { select, geometry, material } = productionSelectControl();
    const selectRest = select.position.clone();
    const selectRestQuaternion = select.quaternion.clone();
    const selectRestScale = select.scale.clone();
    const geometryPosition = snapshot(geometry, "position");
    const geometryNormal = snapshot(geometry, "normal");
    const materialSnapshot = material.toJSON();
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);
    controller.attachSelect(select);
    controller.pressWheel(0);
    controller.pressSelect();

    expect(select.position.x).toBe(selectRest.x);
    expect(select.position.y).toBe(selectRest.y);
    expect(select.position.z).toBeCloseTo(
      selectRest.z - CONTROL_TRAVEL.selectModel,
      12,
    );
    expect(select.quaternion.toArray()).toEqual(selectRestQuaternion.toArray());
    expect(select.scale.toArray()).toEqual(selectRestScale.toArray());
    expect(CONTROL_TRAVEL.selectModel).toBeGreaterThan(
      CONTROL_TRAVEL.wheelModel * 10,
    );
    expect(select.material).toBe(material);
    expect(material.toJSON()).toEqual(materialSnapshot);
    expect([...snapshot(geometry, "position")]).toEqual([...geometryPosition]);
    expect([...snapshot(geometry, "normal")]).toEqual([...geometryNormal]);

    controller.releaseSelect();
    controller.setReducedMotion(true);
    expect(select.position.toArray()).toEqual(selectRest.toArray());
    expect(select.material).toBe(material);
    expect(material.toJSON()).toEqual(materialSnapshot);

    controller.dispose();
    ring.dispose();
    backing.dispose();
    geometry.dispose();
    material.dispose();
  });

  test("wheel and Select release durations are invariant from 15 through 360 Hz", () => {
    for (const refreshHz of [15, 30, 60, 120, 240, 360]) {
      for (const control of ["wheel", "select"] as const) {
        const harness = new FrameHarness();
        const controller = new ControlPhysicsController(harness.dependencies);
        const assemblyBundle = productionWheelAssembly();
        const selectBundle = productionSelectControl();
        const select = selectBundle.select;
        const wheelRest = assemblyBundle.assembly.quaternion.clone();
        const selectRest = select.position.clone();
        if (control === "wheel") {
          controller.attachWheel(assemblyBundle.assembly);
          controller.pressWheel(45);
          controller.releaseWheel();
        } else {
          controller.attachSelect(select);
          controller.pressSelect();
          controller.releaseSelect();
        }
        const duration = CONTROL_RELEASE_MS[control];
        const interval = 1_000 / refreshHz;
        let frame = 0;
        while (harness.pending > 0 && frame < 200) {
          frame += 1;
          harness.step(frame * interval);
        }
        const settledAtMs = frame * interval;
        expect(settledAtMs).toBeGreaterThanOrEqual(duration);
        expect(settledAtMs).toBeLessThan(duration + interval + 1e-9);
        if (control === "wheel") {
          expect(assemblyBundle.assembly.quaternion.toArray()).toEqual(
            wheelRest.toArray(),
          );
        } else {
          expect(select.position.toArray()).toEqual(selectRest.toArray());
        }
        expect(harness.pending).toBe(0);
        if (refreshHz === 360 && control === "wheel") {
          expect(harness.requests).toBeGreaterThan(CONTROL_STALLED_FRAME_LIMIT);
        }
        controller.dispose();
        assemblyBundle.ring.dispose();
        assemblyBundle.backing.dispose();
        selectBundle.geometry.dispose();
        selectBundle.material.dispose();
      }
    }
  });

  test("release is demand-driven and a frozen clock has a bounded escape", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const rest = assembly.quaternion.clone();
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(assembly);
    expect(harness.requests).toBe(0);
    controller.pressWheel(315);
    expect(harness.requests).toBe(0);
    controller.releaseWheel();
    expect(harness.pending).toBe(1);
    for (let frame = 0; frame < CONTROL_STALLED_FRAME_LIMIT; frame += 1) {
      harness.step(0);
    }
    expect(harness.pending).toBe(0);
    expect(harness.requests).toBe(CONTROL_STALLED_FRAME_LIMIT);
    expect(assembly.quaternion.toArray()).toEqual(rest.toArray());
    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("production has one contact-following rigid wheel transform and no deformation or optical proxy", async () => {
    const physics = await Bun.file(
      "packages/device/src/control-physics.ts",
    ).text();
    const input = await Bun.file(
      "packages/device/src/click-wheel-input.tsx",
    ).text();
    const scope = await Bun.file(
      "packages/device/src/ControlPhysicsScope.tsx",
    ).text();
    const canvas = await Bun.file(
      "packages/device/src/DeviceCanvas.tsx",
    ).text();
    const route = await Bun.file(
      "apps/web/src/routes/[_]spike.device.tsx",
    ).text();
    const device = await Bun.file("packages/device/src/Device.tsx").text();
    const renderWheel = physics.slice(
      physics.indexOf("#renderWheel(): void"),
      physics.indexOf("#renderSelect(): void"),
    );
    const pointerMove = input.slice(
      input.indexOf("const onPointerMove"),
      input.indexOf("const onPointerUp"),
    );

    expect(scope).not.toMatch(/useFrame\(|setInterval\(/);
    expect(canvas).not.toContain("controlEvidencePose");
    expect(route).not.toContain("requestedControlPose");
    expect(route).not.toContain("controlEvidencePose");
    expect(physics).not.toMatch(
      /wheelHeightField|compactContact|deformWheelSurface|derivativeX|derivativeY/,
    );
    expect(renderWheel).toContain(
      "tiltRigidAssembly(\n      this.#wheelAssembly,",
    );
    expect(renderWheel).not.toMatch(/position\.array|normal\.array/);
    expect(input.match(/controlPhysics\?\.pressWheel\(first\.angleDeg\)/g)).toHaveLength(1);
    expect(pointerMove).toContain("controlPhysics?.moveWheel(next.angleDeg)");
    expect(physics).not.toMatch(/ShaderMaterial|uniform|wheelReadability/);
    expect(device).toContain('name="device-wheel-assembly"');
    expect(device).toContain(
      "position={[wheel.centerX, wheel.centerY, wheelTopAtCenterZ]}",
    );
    expect(device.indexOf('name="device-wheel-gap-floor"')).toBeLessThan(
      device.indexOf('name="device-wheel-assembly"'),
    );
    expect(device).toContain("controlPhysics?.attachWheel(assembly)");
    expect(device).not.toMatch(
      /WheelGrazing|wheel-readability|onBeforeCompile/,
    );
    expect(
      await Bun.file("packages/device/src/wheel-readability.ts").exists(),
    ).toBeFalse();
    expect(device).toContain("controlPhysics?.attachSelect(select)");
    expect(physics).not.toMatch(
      /deformSelectSurface|position\.array|normal\.array|Mesh(?:Basic|Standard|Physical)Material|new Color|opacity|emissive|onBeforeCompile/i,
    );
    const selectMesh = device.slice(
      device.indexOf('name="device-select"'),
      device.indexOf("{/* ⚑ The W6 boundary"),
    );
    expect(selectMesh).not.toMatch(/pressed|activeMaterial|opacity|emissive|shader/i);
  });
});
