import { describe, expect, test } from "bun:test";
import { Euler, Matrix4, Vector3 } from "three";

import {
  CONTROL_RELEASE_MS,
  CONTROL_STALLED_FRAME_LIMIT,
  CONTROL_TRAVEL,
  ControlPhysicsController,
  WHEEL_CONTACT_FOOTPRINT_MM,
  WHEEL_REST_NORMAL_ATTRIBUTE,
  type ControlPhysicsDependencies,
  type WheelContactReadability,
  type WheelReadabilitySample,
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

class ReadabilityHarness implements WheelContactReadability {
  readonly updates: Array<WheelReadabilitySample> = [];
  clears = 0;

  update(sample: WheelReadabilitySample): void {
    this.updates.push(structuredClone(sample));
  }

  clear(): void {
    this.clears += 1;
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
    expect(CONTROL_STALLED_FRAME_LIMIT).toBe(24);
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

  test("wheel readability follows contact and shares the bounded demand lifecycle", () => {
    const geometry = wheelGeometry();
    const harness = new FrameHarness();
    const readability = new ReadabilityHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry, readability);

    expect(readability.updates).toHaveLength(0);
    expect(readability.clears).toBe(0);
    expect(harness.requests).toBe(0);

    controller.wheelContact(angleContact(0));
    const first = readability.updates.at(-1);
    expect(first?.engagement).toBe(1);
    expect(harness.invalidations).toBe(1);
    expect(harness.requests).toBe(0);

    controller.wheelContact(angleContact(90));
    const second = readability.updates.at(-1);
    expect(second?.point.x).not.toBe(first?.point.x);
    expect(second?.point.y).not.toBe(first?.point.y);
    expect(harness.invalidations).toBe(2);
    expect(harness.requests).toBe(0);

    controller.releaseWheel();
    expect(harness.pending).toBe(1);
    harness.step(60);
    expect(readability.updates.at(-1)?.engagement).toBeCloseTo(0.125, 8);
    expect(harness.invalidations).toBe(3);
    expect(harness.pending).toBe(1);
    harness.step(CONTROL_RELEASE_MS.wheel);
    expect(readability.clears).toBe(1);
    expect(harness.invalidations).toBe(4);
    expect(harness.pending).toBe(0);
    expect(harness.requests).toBe(2);

    controller.dispose();
    geometry.dispose();
  });

  test("Select cannot receive or activate the wheel-only grazing response", () => {
    const ring = wheelGeometry();
    const select = selectGeometry();
    const harness = new FrameHarness();
    const readability = new ReadabilityHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(ring, readability);
    controller.attachSelect(select);

    controller.pressSelect();
    controller.releaseSelect();
    expect(readability.updates).toHaveLength(0);
    expect(readability.clears).toBe(0);

    controller.dispose();
    ring.dispose();
    select.dispose();
  });

  test("reduced motion keeps direct feedback and clears it without release frames", () => {
    const geometry = wheelGeometry();
    const harness = new FrameHarness();
    const readability = new ReadabilityHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry, readability);
    controller.setReducedMotion(true);
    controller.wheelContact(angleContact(180));
    expect(readability.updates.at(-1)?.engagement).toBe(1);
    expect(harness.invalidations).toBe(1);
    expect(harness.requests).toBe(0);

    controller.releaseWheel();
    expect(readability.clears).toBe(1);
    expect(harness.invalidations).toBe(2);
    expect(harness.pending).toBe(0);

    controller.dispose();
    geometry.dispose();
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
    const immutableRestNormal = geometry.getAttribute(
      WHEEL_REST_NORMAL_ATTRIBUTE,
    );
    expect(immutableRestNormal.array).toEqual(restNormal);
    controller.wheelContact(angleContact(90));
    expect(
      maximumTripletDelta(restNormal, snapshot(geometry, "normal")),
    ).toBeGreaterThan(0.001);
    expect(immutableRestNormal.array).toEqual(restNormal);
    controller.setReducedMotion(true);
    controller.releaseWheel();
    expect(snapshot(geometry, "position")).toEqual(restPosition);
    expect(snapshot(geometry, "normal")).toEqual(restNormal);
    expect(harness.pending).toBe(0);
    expect(harness.invalidations).toBe(2);
    controller.dispose();
    geometry.dispose();
  });

  test("enabling reduced motion during release presents the restored GPU frame", () => {
    const geometry = wheelGeometry();
    const restPosition = snapshot(geometry, "position");
    const restNormal = snapshot(geometry, "normal");
    const harness = new FrameHarness();
    const readability = new ReadabilityHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry, readability);
    controller.wheelContact(angleContact(90));
    controller.releaseWheel();
    harness.step(32);
    expect(snapshot(geometry, "position")).not.toEqual(restPosition);
    expect(harness.invalidations).toBe(2);
    expect(harness.pending).toBe(1);
    expect(readability.updates.at(-1)?.engagement).toBeGreaterThan(0);
    expect(readability.clears).toBe(0);

    controller.setReducedMotion(true);

    expect(snapshot(geometry, "position")).toEqual(restPosition);
    expect(snapshot(geometry, "normal")).toEqual(restNormal);
    expect(harness.invalidations).toBe(3);
    expect(harness.pending).toBe(0);
    expect(harness.cancels).toBe(1);
    expect(readability.clears).toBe(1);
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

  test("release duration is frame-rate invariant from 15 through 360 Hz", () => {
    for (const refreshHz of [15, 30, 60, 120, 240, 360]) {
      for (const control of ["wheel", "select"] as const) {
        const geometry =
          control === "wheel" ? wheelGeometry() : selectGeometry();
        const rest = snapshot(geometry, "position");
        const harness = new FrameHarness();
        const controller = new ControlPhysicsController(harness.dependencies);
        if (control === "wheel") {
          controller.attachWheel(geometry);
          controller.wheelContact(angleContact(0));
          controller.releaseWheel();
        } else {
          controller.attachSelect(geometry);
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
        expect(snapshot(geometry, "position")).toEqual(rest);
        expect(harness.pending).toBe(0);
        if (refreshHz === 360 && control === "wheel") {
          expect(harness.requests).toBeGreaterThan(
            CONTROL_STALLED_FRAME_LIMIT,
          );
        }
        controller.dispose();
        geometry.dispose();
      }
    }
  });

  test("release is demand-driven and a frozen clock has a bounded escape", () => {
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
    for (let frame = 0; frame < CONTROL_STALLED_FRAME_LIMIT; frame += 1) {
      harness.step(0);
    }
    expect(harness.pending).toBe(0);
    expect(harness.requests).toBe(CONTROL_STALLED_FRAME_LIMIT);
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
    const canvas = await Bun.file(
      "packages/device/src/DeviceCanvas.tsx",
    ).text();
    const route = await Bun.file(
      "apps/web/src/routes/[_]spike.device.tsx",
    ).text();
    const device = await Bun.file("packages/device/src/Device.tsx").text();
    expect(scope).not.toContain("import { useFrame");
    expect(scope).not.toContain("useFrame(");
    expect(scope).not.toContain("setInterval");
    expect(scope).not.toContain("ControlPhysicsEvidence");
    expect(canvas).not.toContain("controlEvidencePose");
    expect(route).not.toContain("requestedControlPose");
    expect(route).not.toContain("controlEvidencePose");
    expect(physics).not.toContain("ShaderMaterial");
    expect(physics).not.toContain("uniform");
    expect(physics).not.toContain("uv");
    expect(physics).toContain("position.needsUpdate = true");
    expect(physics).toContain("normal.needsUpdate = true");
    expect(device).toContain(
      "controlPhysics?.attachWheel(ringGeometry, wheelGrazingResponse)",
    );
    expect(device).toContain("controlPhysics?.attachSelect(selectGeometry)");
  });
});
