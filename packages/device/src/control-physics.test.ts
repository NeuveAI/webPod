import { describe, expect, test } from "bun:test";
import { Euler, Matrix4, Vector3 } from "three";

import {
  CONTROL_RELEASE_MS,
  CONTROL_STALLED_FRAME_LIMIT,
  CONTROL_TRAVEL,
  ControlPhysicsController,
  WHEEL_BOUNDARY_EPSILON_MODEL,
  WHEEL_CONTACT_FOOTPRINT_MM,
  WHEEL_CONTACT_FOOTPRINT_MODEL,
  WHEEL_DEFORMATION_RADII_MODEL,
  type ControlPhysicsDependencies,
} from "./control-physics";
import { createFrontControlPatchGeometry } from "./front-control-geometry";
import { DEFAULT_DEVICE_FORM } from "./form";
import { frontShellOffsetAt, WHEEL_OUTER_SEAM_WIDTH } from "./front-surface";
import { DEVICE_LAYOUT } from "./layout";

const { wheel } = DEVICE_LAYOUT;
const RADIAL_SEGMENTS = 128;
const RING_SEGMENTS = 24;
const STRIDE = RADIAL_SEGMENTS + 1;

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

function contactAt(angleDeg: number, radius = 70.25) {
  const angle = (-angleDeg * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function assertWheelIsDepthOnly(
  rest: Float32Array,
  moved: Float32Array,
  label: string,
): void {
  for (let index = 0; index < rest.length; index += 3) {
    if (!Object.is(moved[index], rest[index])) {
      throw new Error(`${label}: vertex ${index / 3} changed local X`);
    }
    if (!Object.is(moved[index + 1], rest[index + 1])) {
      throw new Error(`${label}: vertex ${index / 3} changed local Y`);
    }
    if ((moved[index + 2] ?? 0) > (rest[index + 2] ?? 0)) {
      throw new Error(`${label}: vertex ${index / 3} moved toward the viewer`);
    }
  }
}

function assertRingBoundariesAreImmutable(
  restPosition: Float32Array,
  restNormal: Float32Array,
  livePosition: Float32Array,
  liveNormal: Float32Array,
  label: string,
): void {
  for (const ringIndex of [0, RING_SEGMENTS]) {
    for (let segment = 0; segment <= RADIAL_SEGMENTS; segment += 1) {
      const offset = (ringIndex * STRIDE + segment) * 3;
      for (let component = 0; component < 3; component += 1) {
        if (
          !Object.is(
            livePosition[offset + component],
            restPosition[offset + component],
          )
        ) {
          throw new Error(
            `${label}: boundary ${ringIndex} position component ${component} crawled`,
          );
        }
        if (
          !Object.is(
            liveNormal[offset + component],
            restNormal[offset + component],
          )
        ) {
          throw new Error(
            `${label}: boundary ${ringIndex} normal component ${component} crawled`,
          );
        }
      }
    }
  }
}

function independentWeight(
  x: number,
  y: number,
  contact: Readonly<{ x: number; y: number }>,
): number {
  const radius = Math.hypot(x, y);
  if (
    radius <=
      WHEEL_DEFORMATION_RADII_MODEL.inner + WHEEL_BOUNDARY_EPSILON_MODEL ||
    radius >=
      WHEEL_DEFORMATION_RADII_MODEL.outer - WHEEL_BOUNDARY_EPSILON_MODEL
  ) {
    return 0;
  }
  const contactRadius = Math.hypot(contact.x, contact.y);
  const radialSupport = Math.min(
    WHEEL_CONTACT_FOOTPRINT_MODEL.radial,
    contactRadius - WHEEL_DEFORMATION_RADII_MODEL.inner,
    WHEEL_DEFORMATION_RADII_MODEL.outer - contactRadius,
  );
  if (!(radialSupport > 0)) return 0;
  const radialX = contact.x / contactRadius;
  const radialY = contact.y / contactRadius;
  const dx = x - contact.x;
  const dy = y - contact.y;
  const radialDistance = dx * radialX + dy * radialY;
  const tangentialDistance = dx * -radialY + dy * radialX;
  const q2 =
    (radialDistance * radialDistance) / (radialSupport * radialSupport) +
    (tangentialDistance * tangentialDistance) /
      (WHEEL_CONTACT_FOOTPRINT_MODEL.tangential *
        WHEEL_CONTACT_FOOTPRINT_MODEL.tangential);
  if (q2 >= 1) return 0;
  return (1 - q2) ** 3;
}

function independentLiveHeight(
  x: number,
  y: number,
  contact: Readonly<{ x: number; y: number }>,
): number {
  return (
    frontShellOffsetAt(
      wheel.centerX + x,
      wheel.centerY + y,
      DEFAULT_DEVICE_FORM,
    ) -
    CONTROL_TRAVEL.wheelModel * independentWeight(x, y, contact)
  );
}

describe("transient physical click-wheel geometry", () => {
  test("the bounded visual calibration and fixed ring boundaries are explicit", () => {
    expect(CONTROL_TRAVEL.wheelMm).toBe(0.08);
    expect(CONTROL_TRAVEL.selectMm).toBe(0.36);
    expect(WHEEL_CONTACT_FOOTPRINT_MM).toEqual({
      radial: 5.5,
      tangential: 5.5,
    });
    expect(WHEEL_DEFORMATION_RADII_MODEL).toEqual({ inner: 38, outer: 102.5 });
    expect(WHEEL_BOUNDARY_EPSILON_MODEL).toBe(1e-4);
    expect(CONTROL_RELEASE_MS).toEqual({ wheel: 120, select: 96 });
    expect(CONTROL_STALLED_FRAME_LIMIT).toBe(24);
  });

  test("dense production contacts and releases preserve every vertex X/Y exactly", () => {
    const geometry = wheelGeometry();
    const restPosition = snapshot(geometry, "position");
    const restNormal = snapshot(geometry, "normal");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry);
    const radii = [50.2, 70.25, 89.8];

    for (let angleDeg = -180; angleDeg < 180; angleDeg += 5) {
      for (const radius of radii) {
        const label = `contact ${angleDeg}deg/${radius}px`;
        controller.wheelContact(contactAt(angleDeg, radius));
        const position = snapshot(geometry, "position");
        const normal = snapshot(geometry, "normal");
        assertWheelIsDepthOnly(restPosition, position, label);
        assertRingBoundariesAreImmutable(
          restPosition,
          restNormal,
          position,
          normal,
          label,
        );
      }
    }

    for (let angleDeg = -180; angleDeg < 180; angleDeg += 30) {
      controller.wheelContact(contactAt(angleDeg));
      const startedAt = harness.now;
      controller.releaseWheel();
      for (const elapsed of [15, 45, 90, CONTROL_RELEASE_MS.wheel]) {
        harness.step(startedAt + elapsed);
        assertWheelIsDepthOnly(
          restPosition,
          snapshot(geometry, "position"),
          "release sample",
        );
      }
      expect(snapshot(geometry, "position")).toEqual(restPosition);
      expect(snapshot(geometry, "normal")).toEqual(restNormal);
    }

    controller.dispose();
    geometry.dispose();
  });

  test("the depression is a monotonic negative-Z basin with unchanged silhouette", () => {
    const geometry = wheelGeometry();
    const rest = snapshot(geometry, "position");
    const restNormal = snapshot(geometry, "normal");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry);
    controller.wheelContact(contactAt(0));
    const moved = snapshot(geometry, "position");
    const movedNormal = snapshot(geometry, "normal");

    const centerRing = 12;
    const radialDepths: number[] = [];
    for (let ringIndex = centerRing; ringIndex <= RING_SEGMENTS; ringIndex += 1) {
      const offset = ringIndex * STRIDE * 3;
      radialDepths.push((rest[offset + 2] ?? 0) - (moved[offset + 2] ?? 0));
    }
    expect(radialDepths[0]).toBeCloseTo(CONTROL_TRAVEL.wheelModel, 4);
    for (let index = 1; index < radialDepths.length; index += 1) {
      expect(radialDepths[index]).toBeLessThanOrEqual(
        (radialDepths[index - 1] ?? 0) + 1e-7,
      );
      expect(radialDepths[index]).toBeGreaterThanOrEqual(0);
    }
    expect(radialDepths.at(-1)).toBe(0);
    assertWheelIsDepthOnly(rest, moved, "monotonic basin");
    assertRingBoundariesAreImmutable(
      rest,
      restNormal,
      moved,
      movedNormal,
      "monotonic basin",
    );

    controller.dispose();
    geometry.dispose();
  });

  test("the midpoint basin is isotropic instead of a tangential optical stamp", () => {
    const contact = contactAt(0);
    const contactRadius = Math.hypot(contact.x, contact.y);
    const radial = {
      x: contact.x / contactRadius,
      y: contact.y / contactRadius,
    };
    const tangent = { x: -radial.y, y: radial.x };

    expect(WHEEL_CONTACT_FOOTPRINT_MODEL.radial).toBe(
      WHEEL_CONTACT_FOOTPRINT_MODEL.tangential,
    );
    for (const distanceRatio of [0, 0.1, 0.25, 0.5, 0.75, 0.95]) {
      const distance =
        WHEEL_CONTACT_FOOTPRINT_MODEL.radial * distanceRatio;
      const radialWeight = independentWeight(
        contact.x + radial.x * distance,
        contact.y + radial.y * distance,
        contact,
      );
      const tangentialWeight = independentWeight(
        contact.x + tangent.x * distance,
        contact.y + tangent.y * distance,
        contact,
      );
      expect(radialWeight).toBeCloseTo(tangentialWeight, 12);
    }

    const geometry = wheelGeometry();
    const rest = snapshot(geometry, "position");
    const controller = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    controller.attachWheel(geometry);
    controller.wheelContact(contact);
    const moved = snapshot(geometry, "position");
    let radialExtent = 0;
    let tangentialExtent = 0;
    for (let index = 0; index < moved.length; index += 3) {
      const depth = (rest[index + 2] ?? 0) - (moved[index + 2] ?? 0);
      if (depth <= 0) continue;
      const dx = (moved[index] ?? 0) - contact.x;
      const dy = (moved[index + 1] ?? 0) - contact.y;
      radialExtent = Math.max(
        radialExtent,
        Math.abs(dx * radial.x + dy * radial.y),
      );
      tangentialExtent = Math.max(
        tangentialExtent,
        Math.abs(dx * tangent.x + dy * tangent.y),
      );
    }
    expect(radialExtent).toBeGreaterThan(0);
    expect(tangentialExtent).toBeGreaterThan(0);
    expect(
      Math.max(radialExtent, tangentialExtent) /
        Math.min(radialExtent, tangentialExtent),
    ).toBeLessThan(1.12);

    controller.dispose();
    geometry.dispose();
  });

  test("live normals equal the finite-difference gradient of the scalar Z field", () => {
    const geometry = wheelGeometry();
    const rest = snapshot(geometry, "position");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    const contact = contactAt(35);
    controller.attachWheel(geometry);
    controller.wheelContact(contact);
    const moved = snapshot(geometry, "position");
    const normal = snapshot(geometry, "normal");
    const epsilon = 0.002;
    let samples = 0;

    for (let index = 0; index < moved.length; index += 3) {
      const depth = (rest[index + 2] ?? 0) - (moved[index + 2] ?? 0);
      if (depth < CONTROL_TRAVEL.wheelModel * 0.08) continue;
      const x = moved[index] ?? 0;
      const y = moved[index + 1] ?? 0;
      const dzdx =
        (independentLiveHeight(x + epsilon, y, contact) -
          independentLiveHeight(x - epsilon, y, contact)) /
        (2 * epsilon);
      const dzdy =
        (independentLiveHeight(x, y + epsilon, contact) -
          independentLiveHeight(x, y - epsilon, contact)) /
        (2 * epsilon);
      const expected = new Vector3(-dzdx, -dzdy, 1).normalize();
      const actual = new Vector3(
        normal[index] ?? 0,
        normal[index + 1] ?? 0,
        normal[index + 2] ?? 0,
      );
      expect(actual.distanceTo(expected)).toBeLessThan(2e-4);
      samples += 1;
    }
    expect(samples).toBeGreaterThan(100);

    controller.dispose();
    geometry.dispose();
  });

  test("contact motion is continuous through the signed-angle seam", () => {
    const first = wheelGeometry();
    const second = wheelGeometry();
    const firstController = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    const secondController = new ControlPhysicsController(
      new FrameHarness().dependencies,
    );
    firstController.attachWheel(first);
    secondController.attachWheel(second);
    firstController.wheelContact(contactAt(179.99));
    secondController.wheelContact(contactAt(-180.01));
    expect(
      maximumTripletDelta(
        snapshot(first, "position"),
        snapshot(second, "position"),
      ),
    ).toBeLessThan(1e-5);
    expect(
      maximumTripletDelta(
        snapshot(first, "normal"),
        snapshot(second, "normal"),
      ),
    ).toBeLessThan(1e-5);
    firstController.dispose();
    secondController.dispose();
    first.dispose();
    second.dispose();
  });

  test("Select travel remains restrained but greater than wheel depth", () => {
    const ring = wheelGeometry();
    const select = selectGeometry();
    const ringRest = snapshot(ring, "position");
    const selectRest = snapshot(select, "position");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(ring);
    controller.attachSelect(select);
    controller.wheelContact(contactAt(0));
    controller.pressSelect();
    const wheelTravel = maximumTripletDelta(
      ringRest,
      snapshot(ring, "position"),
    );
    const selectTravel = maximumTripletDelta(
      selectRest,
      snapshot(select, "position"),
    );
    expect(wheelTravel).toBeCloseTo(CONTROL_TRAVEL.wheelModel, 4);
    expect(selectTravel).toBeCloseTo(CONTROL_TRAVEL.selectModel, 4);
    expect(selectTravel).toBeGreaterThan(wheelTravel * 3);
    controller.dispose();
    ring.dispose();
    select.dispose();
  });

  test("the seam floor follows Z only and cannot cut through a moving edge", () => {
    const ring = wheelGeometry();
    const backing = wheelBackingGeometry();
    const ringRest = snapshot(ring, "position");
    const backingRest = snapshot(backing, "position");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(ring, backing);

    controller.wheelContact(contactAt(90));
    const ringMoved = snapshot(ring, "position");
    const backingMoved = snapshot(backing, "position");
    assertWheelIsDepthOnly(ringRest, ringMoved, "visible wheel");
    assertWheelIsDepthOnly(backingRest, backingMoved, "seam floor");
    expect(maximumTripletDelta(ringRest, ringMoved)).toBeCloseTo(
      CONTROL_TRAVEL.wheelModel,
      4,
    );
    expect(maximumTripletDelta(backingRest, backingMoved)).toBeGreaterThan(
      CONTROL_TRAVEL.wheelModel * 0.98,
    );
    expect(maximumTripletDelta(backingRest, backingMoved)).toBeLessThanOrEqual(
      CONTROL_TRAVEL.wheelModel + 1e-6,
    );

    controller.setReducedMotion(true);
    controller.releaseWheel();
    expect(snapshot(ring, "position")).toEqual(ringRest);
    expect(snapshot(backing, "position")).toEqual(backingRest);
    controller.dispose();
    ring.dispose();
    backing.dispose();
  });

  test("reduced motion during release restores the exact presented frame", () => {
    const geometry = wheelGeometry();
    const restPosition = snapshot(geometry, "position");
    const restNormal = snapshot(geometry, "normal");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    controller.attachWheel(geometry);
    controller.wheelContact(contactAt(90));
    controller.releaseWheel();
    harness.step(32);
    expect(snapshot(geometry, "position")).not.toEqual(restPosition);
    expect(harness.invalidations).toBe(2);
    expect(harness.pending).toBe(1);

    controller.setReducedMotion(true);

    expect(snapshot(geometry, "position")).toEqual(restPosition);
    expect(snapshot(geometry, "normal")).toEqual(restNormal);
    expect(harness.invalidations).toBe(3);
    expect(harness.pending).toBe(0);
    expect(harness.cancels).toBe(1);
    controller.dispose();
    geometry.dispose();
  });

  test("detach and rebind restore the detached mesh without touching replacement", () => {
    const first = wheelGeometry();
    const second = wheelGeometry();
    const firstRest = snapshot(first, "position");
    const secondRest = snapshot(second, "position");
    const harness = new FrameHarness();
    const controller = new ControlPhysicsController(harness.dependencies);
    const detachFirst = controller.attachWheel(first);
    controller.wheelContact(contactAt(45));
    expect(snapshot(first, "position")).not.toEqual(firstRest);

    const detachSecond = controller.attachWheel(second);
    expect(snapshot(first, "position")).toEqual(firstRest);
    controller.wheelContact(contactAt(46));
    const secondMoved = snapshot(second, "position");
    expect(secondMoved).not.toEqual(secondRest);

    detachFirst();
    expect(snapshot(second, "position")).toEqual(secondMoved);
    detachSecond();
    expect(snapshot(second, "position")).toEqual(secondRest);

    controller.dispose();
    first.dispose();
    second.dispose();
  });

  test("Select displacement still follows its curved local normal after rotation", () => {
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
        const geometry = control === "wheel" ? wheelGeometry() : selectGeometry();
        const rest = snapshot(geometry, "position");
        const harness = new FrameHarness();
        const controller = new ControlPhysicsController(harness.dependencies);
        if (control === "wheel") {
          controller.attachWheel(geometry);
          controller.wheelContact(contactAt(0));
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
          expect(harness.requests).toBeGreaterThan(CONTROL_STALLED_FRAME_LIMIT);
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
    controller.wheelContact(contactAt(0));
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

  test("production has no polling loop, lateral wheel motion or optical proxy", async () => {
    const physics = await Bun.file("packages/device/src/control-physics.ts").text();
    const scope = await Bun.file("packages/device/src/ControlPhysicsScope.tsx").text();
    const canvas = await Bun.file("packages/device/src/DeviceCanvas.tsx").text();
    const route = await Bun.file("apps/web/src/routes/[_]spike.device.tsx").text();
    const device = await Bun.file("packages/device/src/Device.tsx").text();
    const wheelDeformation = physics.slice(
      physics.indexOf("export function deformWheelSurface"),
      physics.indexOf("export function deformSelectSurface"),
    );

    expect(scope).not.toMatch(/useFrame\(|setInterval\(/);
    expect(canvas).not.toContain("controlEvidencePose");
    expect(route).not.toContain("requestedControlPose");
    expect(route).not.toContain("controlEvidencePose");
    expect(wheelDeformation).toContain("p[index] = px;");
    expect(wheelDeformation).toContain("p[index + 1] = py;");
    expect(wheelDeformation).toContain(
      "p[index + 2] = pz - boundedDepth * field.weight;",
    );
    expect(wheelDeformation).not.toMatch(/px\s*[-+]\s*nx|py\s*[-+]\s*ny/);
    expect(physics).not.toMatch(/ShaderMaterial|uniform|wheelReadability/);
    expect(device).toContain(
      "controlPhysics?.attachWheel(ringGeometry, wheelGapGeometry)",
    );
    expect(device).toContain(
      "createPolycarbonateMaterial(\n      withStudioEnvironment(ringMaterial",
    );
    expect(device).not.toMatch(/WheelGrazing|wheel-readability|onBeforeCompile/);
    expect(
      await Bun.file("packages/device/src/wheel-readability.ts").exists(),
    ).toBeFalse();
    expect(device).toContain("controlPhysics?.attachSelect(selectGeometry)");
  });
});
