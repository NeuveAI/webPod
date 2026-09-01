import { describe, expect, test } from "bun:test";
import { Euler, Matrix4, Vector3 } from "three";

import {
  CONTROL_RELEASE_FRAME_LIMIT,
  CONTROL_RELEASE_MS,
  CONTROL_TRAVEL,
  ControlPhysicsController,
  WHEEL_CONTACT_FOOTPRINT_MM,
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
      | readonly [number, FrameRequestCallback]
      | undefined;
    if (entry === undefined) return;
    this.#callbacks.delete(entry[0]);
    entry[1](timestampMs);
  }
}

function snapshot(geometry: ReturnType<typeof wheelGeometry>, name: "position" | "normal") {
  const attribute = geometry.getAttribute(name);
  if (!(attribute.array instanceof Float32Array)) {
    throw new Error("test geometry must use float attributes");
  }
  return attribute.array.slice();
}

function maximumTripletDelta(before: Float32Array, after: Float32Array): number {
  let maximum = 0;
  for (let index = 0; index < before.length; index += 3) {
    const dx = (after[index] ?? 0) - (before[index] ?? 0);
    const dy = (after[index + 1] ?? 0) - (before[index + 1] ?? 0);
    const dz = (after[index + 2] ?? 0) - (before[index + 2] ?? 0);
    maximum = Math.max(maximum, Math.hypot(dx, dy, dz));
  }
  return maximum;
}

function angleContact(angleDeg: number) {
  const radius = (wheel.selectLipR + wheel.outerR) / 2;
  const angle = (-angleDeg * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

describe("transient physical click-wheel geometry", () => {
  test("the bounded visual calibration is explicit and mutation-gated", () => {
    expect(CONTROL_TRAVEL.wheelMm).toBe(0.08);
    expect(CONTROL_TRAVEL.selectMm).toBe(0.36);
    expect(WHEEL_CONTACT_FOOTPRINT_MM).toEqual({
      radial: 5.5,
      tangential: 8,
    });
    expect(CONTROL_RELEASE_MS).toEqual({ wheel: 120, select: 96 });
    expect(CONTROL_RELEASE_FRAME_LIMIT).toBe(24);
  });

  test("locality follows the live thumb at all four cardinal angles", () => {
    for (const angleDeg of [0, 90, 180, 270]) {
      const geometry = wheelGeometry();
      const rest = snapshot(geometry, "position");
      const harness = new FrameHarness();
      const controller = new ControlPhysicsController(harness.dependencies);
      controller.attachWheel(geometry);
      controller.wheelContact(angleContact(angleDeg));
      const moved = snapshot(geometry, "position");
      let nearMaximum = 0;
      let oppositeMaximum = 0;
      const position = geometry.getAttribute("position");
      const contact = angleContact(angleDeg);
      for (let index = 0; index < position.count; index += 1) {
        const offset = index * 3;
        const displacement = Math.hypot(
          (moved[offset] ?? 0) - (rest[offset] ?? 0),
          (moved[offset + 1] ?? 0) - (rest[offset + 1] ?? 0),
          (moved[offset + 2] ?? 0) - (rest[offset + 2] ?? 0),
        );
        const x = rest[offset] ?? 0;
        const y = rest[offset + 1] ?? 0;
        if (Math.hypot(x - contact.x, y - contact.y) < 8) {
          nearMaximum = Math.max(nearMaximum, displacement);
        }
        if (x * contact.x + y * contact.y < 0) {
          oppositeMaximum = Math.max(oppositeMaximum, displacement);
        }
      }
      expect(nearMaximum).toBeGreaterThan(CONTROL_TRAVEL.wheelModel * 0.9);
      expect(oppositeMaximum).toBe(0);
      controller.dispose();
      geometry.dispose();
    }
  });

  test("contact motion is continuous across the signed-angle seam", () => {
    const first = wheelGeometry();
    const second = wheelGeometry();
    const firstHarness = new FrameHarness();
    const secondHarness = new FrameHarness();
    const firstController = new ControlPhysicsController(firstHarness.dependencies);
    const secondController = new ControlPhysicsController(secondHarness.dependencies);
    firstController.attachWheel(first);
    secondController.attachWheel(second);
    firstController.wheelContact(angleContact(179.9));
    secondController.wheelContact(angleContact(-180.1));
    const a = snapshot(first, "position");
    const b = snapshot(second, "position");
    expect(maximumTripletDelta(a, b)).toBeLessThan(1e-5);
    firstController.dispose();
    secondController.dispose();
    first.dispose();
    second.dispose();
  });

  test("Select travel is restrained but greater than wheel deformation", () => {
    const ring = wheelGeometry();
    const select = selectGeometry();
    const ringRest = snapshot(ring, "position");
    const selectRest = snapshot(select, "position");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(ring);
    controller.attachSelect(select);
    controller.wheelContact(angleContact(0));
    controller.pressSelect();
    const wheelTravel = maximumTripletDelta(
      ringRest,
      snapshot(ring, "position"),
    );
    const selectTravel = maximumTripletDelta(
      selectRest,
      snapshot(select, "position"),
    );
    expect(wheelTravel).toBeCloseTo(CONTROL_TRAVEL.wheelModel, 1);
    expect(selectTravel).toBeCloseTo(CONTROL_TRAVEL.selectModel, 4);
    expect(selectTravel).toBeGreaterThan(wheelTravel * 3);
    controller.dispose();
    ring.dispose();
    select.dispose();
  });

  test("the depression changes real normals and returns byte-exactly to rest", () => {
    const geometry = wheelGeometry();
    const restPosition = snapshot(geometry, "position");
    const restNormal = snapshot(geometry, "normal");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry);
    controller.wheelContact(angleContact(90));
    expect(
      maximumTripletDelta(restNormal, snapshot(geometry, "normal")),
    ).toBeGreaterThan(0.001);
    controller.setReducedMotion(true);
    controller.releaseWheel();
    expect(snapshot(geometry, "position")).toEqual(restPosition);
    expect(snapshot(geometry, "normal")).toEqual(restNormal);
    expect(harness.pending).toBe(0);
    controller.dispose();
    geometry.dispose();
  });

  test("Select displacement follows the curved local normal after rotation", () => {
    const geometry = selectGeometry();
    const restPosition = snapshot(geometry, "position");
    const restNormal = snapshot(geometry, "normal");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachSelect(geometry);
    controller.pressSelect();
    const moved = snapshot(geometry, "position");
    const index = Math.floor(geometry.getAttribute("position").count * 0.73) * 3;
    const localTravel = new Vector3(
      (moved[index] ?? 0) - (restPosition[index] ?? 0),
      (moved[index + 1] ?? 0) - (restPosition[index + 1] ?? 0),
      (moved[index + 2] ?? 0) - (restPosition[index + 2] ?? 0),
    );
    const localNormal = new Vector3(
      restNormal[index] ?? 0,
      restNormal[index + 1] ?? 0,
      restNormal[index + 2] ?? 0,
    );
    const rotation = new Matrix4().makeRotationFromEuler(
      new Euler(0.41, -0.63, 0.22, "XYZ"),
    );
    const worldTravel = localTravel.clone().transformDirection(rotation);
    const worldNormal = localNormal.clone().transformDirection(rotation);
    expect(worldTravel.normalize().dot(worldNormal)).toBeCloseTo(-1, 6);
    controller.dispose();
    geometry.dispose();
  });

  test("release is demand-driven, bounded and has zero idle frames", () => {
    const geometry = wheelGeometry();
    const rest = snapshot(geometry, "position");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry);
    expect(harness.requests).toBe(0);
    controller.wheelContact(angleContact(0));
    expect(harness.requests).toBe(0);
    controller.releaseWheel();
    expect(harness.pending).toBe(1);
    for (let frame = 0; frame < CONTROL_RELEASE_FRAME_LIMIT; frame += 1) {
      harness.step(0);
    }
    expect(harness.pending).toBe(0);
    expect(harness.requests).toBe(CONTROL_RELEASE_FRAME_LIMIT);
    expect(snapshot(geometry, "position")).toEqual(rest);
    controller.dispose();
    geometry.dispose();
  });

  test("production has no polling loop or painted deformation proxy", async () => {
    const physics = await Bun.file(
      "packages/device/src/control-physics.ts",
    ).text();
    const scope = await Bun.file(
      "packages/device/src/ControlPhysicsScope.tsx",
    ).text();
    const device = await Bun.file("packages/device/src/Device.tsx").text();
    expect(scope).not.toContain("import { useFrame");
    expect(scope).not.toContain("useFrame(");
    expect(scope).not.toContain("setInterval");
    expect(physics).not.toContain("ShaderMaterial");
    expect(physics).not.toContain("uniform");
    expect(physics).not.toContain("uv");
    expect(physics).toContain("position.needsUpdate = true");
    expect(physics).toContain("normal.needsUpdate = true");
    expect(device).toContain("controlPhysics?.attachWheel(ringGeometry)");
    expect(device).toContain("controlPhysics?.attachSelect(selectGeometry)");
  });
});
