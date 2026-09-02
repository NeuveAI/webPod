import { describe, expect, test } from "bun:test";
import { Euler, Group, Matrix4, Mesh, Vector3 } from "three";

import {
  CONTROL_RELEASE_MS,
  CONTROL_STALLED_FRAME_LIMIT,
  CONTROL_TRAVEL,
  ControlPhysicsController,
  type ControlPhysicsDependencies,
} from "./control-physics";
import { createFrontControlPatchGeometry } from "./front-control-geometry";
import { DEFAULT_DEVICE_FORM } from "./form";
import { WHEEL_OUTER_SEAM_WIDTH } from "./front-surface";
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

function maximumTripletDelta(
  before: Float32Array,
  after: Float32Array,
): number {
  let maximum = 0;
  for (let index = 0; index < before.length; index += 3) {
    const dx = (after[index] ?? 0) - (before[index] ?? 0);
    const dy = (after[index + 1] ?? 0) - (before[index + 1] ?? 0);
    const dz = (after[index + 2] ?? 0) - (before[index + 2] ?? 0);
    maximum = Math.max(maximum, Math.hypot(dx, dy, dz));
  }
  return maximum;
}

function assertTranslationOnlyMatrix(
  rest: Matrix4,
  live: Matrix4,
  expectedDepth: number,
): void {
  const delta = live.clone().premultiply(rest.clone().invert());
  const expected = new Matrix4().makeTranslation(0, 0, -expectedDepth);
  for (let index = 0; index < delta.elements.length; index += 1) {
    if (index === 14) {
      expect(delta.elements[index]).toBeCloseTo(
        expected.elements[index] ?? 0,
        14,
      );
    } else {
      expect(delta.elements[index]).toBe(expected.elements[index]);
    }
  }
}

function assertDenseRigidTranslation(
  geometry: ReturnType<typeof wheelGeometry>,
  restPosition: Float32Array,
  restNormal: Float32Array,
  restAssembly: Readonly<{ x: number; y: number; z: number }>,
  liveAssembly: Readonly<{ x: number; y: number; z: number }>,
  expectedDepth: number,
): void {
  const livePosition = snapshot(geometry, "position");
  const liveNormal = snapshot(geometry, "normal");
  expect([...livePosition]).toEqual([...restPosition]);
  expect([...liveNormal]).toEqual([...restNormal]);
  expect(liveAssembly.x).toBe(restAssembly.x);
  expect(liveAssembly.y).toBe(restAssembly.y);
  expect(liveAssembly.z).toBe(restAssembly.z - expectedDepth);

  // The immutable production tessellation is sampled vertex by vertex. Since
  // the sole live transform is one translation matrix, every point receives
  // the same device-local delta and every radius is exactly unchanged.
  for (let index = 0; index < restPosition.length; index += 3) {
    const x = restPosition[index] ?? 0;
    const y = restPosition[index + 1] ?? 0;
    const z = restPosition[index + 2] ?? 0;
    expect(x + liveAssembly.x).toBe(x + restAssembly.x);
    expect(y + liveAssembly.y).toBe(y + restAssembly.y);
    expect(z + liveAssembly.z).toBe(z + restAssembly.z - expectedDepth);
  }
}

describe("rigid physical click-wheel travel", () => {
  test("the restrained rigid calibration and release laws are explicit", () => {
    expect(CONTROL_TRAVEL.wheelMm).toBe(0.03);
    expect(CONTROL_TRAVEL.wheelMm).toBeLessThan(0.08 / 2);
    expect(CONTROL_TRAVEL.selectMm).toBe(0.36);
    expect(CONTROL_RELEASE_MS).toEqual({ wheel: 120, select: 96 });
    expect(CONTROL_STALLED_FRAME_LIMIT).toBe(24);
  });

  test("every production wheel vertex shares one Z delta while XY and normals stay immutable", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const ringPosition = snapshot(ring, "position");
    const ringNormal = snapshot(ring, "normal");
    const backingPosition = snapshot(backing, "position");
    const backingNormal = snapshot(backing, "normal");
    const rest = assembly.position.clone();
    const restMatrix = assembly.matrix.clone();
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);

    controller.pressWheel();
    assertTranslationOnlyMatrix(
      restMatrix,
      assembly.matrix,
      CONTROL_TRAVEL.wheelModel,
    );
    assertDenseRigidTranslation(
      ring,
      ringPosition,
      ringNormal,
      rest,
      assembly.position,
      CONTROL_TRAVEL.wheelModel,
    );
    assertDenseRigidTranslation(
      backing,
      backingPosition,
      backingNormal,
      rest,
      assembly.position,
      CONTROL_TRAVEL.wheelModel,
    );

    controller.dispose();
    expect(assembly.position).toEqual(rest);
    expect(snapshot(ring, "position")).toEqual(ringPosition);
    expect(snapshot(ring, "normal")).toEqual(ringNormal);
    ring.dispose();
    backing.dispose();
  });

  test("inner and outer circular boundaries cannot pinch, bulge or crawl", () => {
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
    controller.pressWheel();

    const live = snapshot(ring, "position");
    expect(live).toEqual(position);
    for (let index = 0; index < live.length; index += 3) {
      const radius = Math.hypot(live[index] ?? 0, live[index + 1] ?? 0);
      expect(radius).toBe(
        Math.hypot(position[index] ?? 0, position[index + 1] ?? 0),
      );
    }
    expect(inner).toBeCloseTo(wheel.selectLipR, 4);
    expect(outer).toBeCloseTo(wheel.outerR - WHEEL_OUTER_SEAM_WIDTH, 4);

    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("a rotated device still travels only along its own local depth axis", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const ringNormal = snapshot(ring, "normal");
    const parent = new Group();
    parent.rotation.set(0.37, -0.58, 0.21, "XYZ");
    parent.add(assembly);
    parent.updateWorldMatrix(true, true);
    const restWorld = assembly.getWorldPosition(new Vector3());
    const expectedDirection = new Vector3(0, 0, -1).transformDirection(
      parent.matrixWorld,
    );
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);

    controller.pressWheel();
    parent.updateWorldMatrix(true, true);
    const travel = assembly
      .getWorldPosition(new Vector3())
      .sub(restWorld);
    expect(travel.length()).toBeCloseTo(CONTROL_TRAVEL.wheelModel, 12);
    expect(travel.clone().normalize().dot(expectedDirection)).toBeCloseTo(1, 12);
    expect([...snapshot(ring, "normal")]).toEqual([...ringNormal]);

    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("wheel release is monotonic in local Z and restores exact rest", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    const rest = assembly.position.clone();
    controller.attachWheel(assembly);
    controller.pressWheel();
    controller.releaseWheel();
    let previousZ = assembly.position.z;

    for (const elapsed of [15, 45, 90, CONTROL_RELEASE_MS.wheel]) {
      harness.step(elapsed);
      expect(assembly.position.x).toBe(rest.x);
      expect(assembly.position.y).toBe(rest.y);
      expect(assembly.position.z).toBeGreaterThanOrEqual(previousZ);
      expect(assembly.position.z).toBeLessThanOrEqual(rest.z);
      previousZ = assembly.position.z;
    }
    expect(assembly.position).toEqual(rest);
    expect(harness.pending).toBe(0);

    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("reduced motion during release restores and presents the exact rest transform", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const rest = assembly.position.clone();
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(assembly);
    controller.pressWheel();
    controller.releaseWheel();
    harness.step(32);
    expect(assembly.position).not.toEqual(rest);
    expect(harness.invalidations).toBe(2);
    expect(harness.pending).toBe(1);

    controller.setReducedMotion(true);

    expect(assembly.position).toEqual(rest);
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
    const firstRest = first.assembly.position.clone();
    const secondRest = second.assembly.position.clone();
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    const detachFirst = controller.attachWheel(first.assembly);
    controller.pressWheel();
    expect(first.assembly.position).not.toEqual(firstRest);

    const detachSecond = controller.attachWheel(second.assembly);
    expect(first.assembly.position).toEqual(firstRest);
    controller.pressWheel();
    const secondMoved = second.assembly.position.clone();
    detachFirst();
    expect(second.assembly.position).toEqual(secondMoved);
    detachSecond();
    expect(second.assembly.position).toEqual(secondRest);

    controller.dispose();
    first.ring.dispose();
    first.backing.dispose();
    second.ring.dispose();
    second.backing.dispose();
  });

  test("Select remains a separate deeper local-normal press", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const select = selectGeometry();
    const selectRest = snapshot(select, "position");
    const selectNormal = snapshot(select, "normal");
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(assembly);
    controller.attachSelect(select);
    controller.pressWheel();
    controller.pressSelect();
    const selectMoved = snapshot(select, "position");

    expect(maximumTripletDelta(selectRest, selectMoved)).toBeCloseTo(
      CONTROL_TRAVEL.selectModel,
      4,
    );
    expect(CONTROL_TRAVEL.selectModel).toBeGreaterThan(
      CONTROL_TRAVEL.wheelModel * 10,
    );
    const index = Math.floor(select.getAttribute("position").count * 0.73) * 3;
    const localTravel = new Vector3(
      (selectMoved[index] ?? 0) - (selectRest[index] ?? 0),
      (selectMoved[index + 1] ?? 0) - (selectRest[index + 1] ?? 0),
      (selectMoved[index + 2] ?? 0) - (selectRest[index + 2] ?? 0),
    );
    const localNormal = new Vector3(
      selectNormal[index] ?? 0,
      selectNormal[index + 1] ?? 0,
      selectNormal[index + 2] ?? 0,
    );
    const rotation = new Matrix4().makeRotationFromEuler(
      new Euler(0.41, -0.63, 0.22, "XYZ"),
    );
    expect(
      localTravel
        .clone()
        .transformDirection(rotation)
        .normalize()
        .dot(localNormal.clone().transformDirection(rotation)),
    ).toBeCloseTo(-1, 6);

    controller.dispose();
    ring.dispose();
    backing.dispose();
    select.dispose();
  });

  test("wheel and Select release durations are invariant from 15 through 360 Hz", () => {
    for (const refreshHz of [15, 30, 60, 120, 240, 360]) {
      for (const control of ["wheel", "select"] as const) {
        const harness = new FrameHarness();
        const controller = new ControlPhysicsController(harness.dependencies);
        const assemblyBundle = productionWheelAssembly();
        const select = selectGeometry();
        const wheelRest = assemblyBundle.assembly.position.clone();
        const selectRest = snapshot(select, "position");
        if (control === "wheel") {
          controller.attachWheel(assemblyBundle.assembly);
          controller.pressWheel();
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
          expect(assemblyBundle.assembly.position).toEqual(wheelRest);
        } else {
          expect([...snapshot(select, "position")]).toEqual([...selectRest]);
        }
        expect(harness.pending).toBe(0);
        if (refreshHz === 360 && control === "wheel") {
          expect(harness.requests).toBeGreaterThan(CONTROL_STALLED_FRAME_LIMIT);
        }
        controller.dispose();
        assemblyBundle.ring.dispose();
        assemblyBundle.backing.dispose();
        select.dispose();
      }
    }
  });

  test("release is demand-driven and a frozen clock has a bounded escape", () => {
    const { assembly, ring, backing } = productionWheelAssembly();
    const rest = assembly.position.clone();
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(assembly);
    expect(harness.requests).toBe(0);
    controller.pressWheel();
    expect(harness.requests).toBe(0);
    controller.releaseWheel();
    expect(harness.pending).toBe(1);
    for (let frame = 0; frame < CONTROL_STALLED_FRAME_LIMIT; frame += 1) {
      harness.step(0);
    }
    expect(harness.pending).toBe(0);
    expect(harness.requests).toBe(CONTROL_STALLED_FRAME_LIMIT);
    expect(assembly.position).toEqual(rest);
    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("production has one rigid wheel transform and no deformation or optical proxy", async () => {
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
      "positionRigidAssembly(this.#wheelAssembly, this.#wheel.depth)",
    );
    expect(renderWheel).not.toMatch(/position\.array|normal\.array|contact/);
    expect(input.match(/controlPhysics\?\.pressWheel\(\)/g)).toHaveLength(1);
    expect(pointerMove).not.toMatch(/pressWheel|wheelContact|controlPhysics/);
    expect(physics).not.toMatch(/ShaderMaterial|uniform|wheelReadability/);
    expect(device).toContain(
      '<group ref={wheelAssemblyRef} name="device-wheel-assembly">',
    );
    expect(device).toContain("controlPhysics?.attachWheel(assembly)");
    expect(device).not.toMatch(
      /WheelGrazing|wheel-readability|onBeforeCompile/,
    );
    expect(
      await Bun.file("packages/device/src/wheel-readability.ts").exists(),
    ).toBeFalse();
    expect(device).toContain("controlPhysics?.attachSelect(selectGeometry)");
  });
});
