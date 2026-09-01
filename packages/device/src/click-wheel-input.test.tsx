import { describe, expect, test } from "bun:test";
import { Group, Matrix4, Mesh, Ray, RingGeometry, Vector3 } from "three";

import {
  CLICK_WHEEL_INPUT_POSITION,
  CLICK_WHEEL_INPUT_RADII,
  acceptsClickWheelPointer,
  clampWheelContactToRing,
  clockwiseWheelAngleDeg,
  createClickWheelCaptureSlot,
  finishClickWheelCapture,
  shortestWheelDeltaDeg,
  type ClickWheelArcEnd,
  wheelAngleFromRay,
  wheelContactFromRay,
} from "./click-wheel-input";
import { DEVICE_LAYOUT } from "./layout";
import { DEFAULT_FRONT_ASSEMBLY_DEPTHS } from "./front-surface";

function wheelMesh() {
  const mesh = new Mesh(
    new RingGeometry(
      CLICK_WHEEL_INPUT_RADII.inner,
      CLICK_WHEEL_INPUT_RADII.outer,
      32,
    ),
  );
  mesh.position.fromArray(CLICK_WHEEL_INPUT_POSITION);
  return mesh;
}

function rayAtExpectedMatrix(matrixWorld: Matrix4, x: number, y: number) {
  const target = new Vector3(x, y, 0).applyMatrix4(matrixWorld);
  return new Ray(
    target.clone().add(new Vector3(0, 0, 100)),
    new Vector3(0, 0, -1),
  );
}

describe("click-wheel input geometry", () => {
  test("uses the canonical Select and wheel radii", () => {
    expect(CLICK_WHEEL_INPUT_RADII).toEqual({
      inner: DEVICE_LAYOUT.wheel.selectR,
      outer: DEVICE_LAYOUT.wheel.outerR,
    });
    expect(CLICK_WHEEL_INPUT_POSITION[0]).toBe(DEVICE_LAYOUT.wheel.centerX);
    expect(CLICK_WHEEL_INPUT_POSITION[1]).toBe(DEVICE_LAYOUT.wheel.centerY);
    expect(CLICK_WHEEL_INPUT_POSITION[2]).toBe(
      DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ,
    );
  });

  test("clockwise and counter-clockwise quarter turns have the right sign", () => {
    const right = clockwiseWheelAngleDeg(1, 0);
    const down = clockwiseWheelAngleDeg(0, -1);
    const up = clockwiseWheelAngleDeg(0, 1);
    expect(shortestWheelDeltaDeg(right, down)).toBe(90);
    expect(shortestWheelDeltaDeg(right, up)).toBe(-90);
  });

  test("crosses the signed-angle seam without a reverse jump", () => {
    expect(shortestWheelDeltaDeg(179, -179)).toBe(2);
    expect(shortestWheelDeltaDeg(-179, 179)).toBe(-2);
  });

  test("refreshes a dirty parent and mesh world transform in production", () => {
    const parent = new Group();
    const mesh = wheelMesh();
    parent.add(mesh);
    parent.updateWorldMatrix(true, true);
    parent.position.set(31, -24, 18);
    parent.rotation.set(0.17, -0.23, 0.29);
    mesh.position.x += 19;
    mesh.position.y -= 11;
    mesh.rotation.set(-0.12, 0.19, -0.41);

    const parentMatrix = new Matrix4().compose(
      parent.position,
      parent.quaternion,
      parent.scale,
    );
    const meshMatrix = new Matrix4().compose(
      mesh.position,
      mesh.quaternion,
      mesh.scale,
    );
    const expectedWorld = parentMatrix.multiply(meshMatrix);
    const clockwiseQuarter = wheelAngleFromRay(
      mesh,
      rayAtExpectedMatrix(expectedWorld, 0, -80),
    );
    expect(clockwiseQuarter).toBeCloseTo(90, 8);
  });

  test("returns transformed body-local contact without moving the hit plane", () => {
    const parent = new Group();
    const mesh = wheelMesh();
    parent.add(mesh);
    parent.rotation.set(0.31, -0.47, 0.18);
    parent.updateWorldMatrix(true, true);
    const hit = wheelContactFromRay(
      mesh,
      rayAtExpectedMatrix(mesh.matrixWorld, 0, -82),
    );
    expect(hit?.angleDeg).toBeCloseTo(90, 8);
    expect(hit?.x).toBeCloseTo(0, 8);
    expect(hit?.y).toBeCloseTo(-82, 8);
    expect(hit?.radius).toBeCloseTo(82, 8);
    expect(mesh.position.toArray()).toEqual([...CLICK_WHEEL_INPUT_POSITION]);
  });

  test("captured contacts remain on wheel plastic at any pointer radius", () => {
    const outside = clampWheelContactToRing({
      angleDeg: 90,
      x: 0,
      y: -900,
      radius: 900,
    });
    const inside = clampWheelContactToRing({
      angleDeg: -90,
      x: 0,
      y: 1,
      radius: 1,
    });
    expect(outside.x).toBeCloseTo(0, 8);
    expect(outside.y).toBeLessThan(-CLICK_WHEEL_INPUT_RADII.inner);
    expect(Math.hypot(outside.x, outside.y)).toBeLessThan(
      CLICK_WHEEL_INPUT_RADII.outer,
    );
    expect(inside.y).toBeGreaterThan(CLICK_WHEEL_INPUT_RADII.inner);
  });

  test("returns null when the current ray is parallel to the wheel plane", () => {
    const mesh = wheelMesh();
    const parallel = new Ray(new Vector3(), new Vector3(1, 0, 0));
    expect(wheelAngleFromRay(mesh, parallel)).toBeNull();
  });

  test("accepts primary touch, pen and left mouse only", () => {
    expect(
      acceptsClickWheelPointer({
        isPrimary: true,
        pointerType: "mouse",
        button: 0,
      }),
    ).toBeTrue();
    expect(
      acceptsClickWheelPointer({
        isPrimary: true,
        pointerType: "touch",
        button: 0,
      }),
    ).toBeTrue();
    expect(
      acceptsClickWheelPointer({
        isPrimary: true,
        pointerType: "pen",
        button: 0,
      }),
    ).toBeTrue();
    expect(
      acceptsClickWheelPointer({
        isPrimary: false,
        pointerType: "touch",
        button: 0,
      }),
    ).toBeFalse();
    expect(
      acceptsClickWheelPointer({
        isPrimary: true,
        pointerType: "mouse",
        button: 2,
      }),
    ).toBeFalse();
    expect(
      acceptsClickWheelPointer({
        isPrimary: true,
        pointerType: "unknown",
        button: 0,
      }),
    ).toBeFalse();
  });
});

describe("click-wheel capture lifecycle", () => {
  test("reports release and releases capture exactly once", () => {
    const host = new EventTarget();
    const ends: Array<ClickWheelArcEnd> = [];
    let releases = 0;
    const slot = createClickWheelCaptureSlot();
    const noop = () => undefined;
    slot.current = {
      pointerId: 7,
      pointerType: "mouse",
      host,
      capture: {
        hasPointerCapture: () => true,
        setPointerCapture: noop,
        releasePointerCapture: () => {
          releases += 1;
        },
      },
      onCancel: noop,
      onLostCapture: noop,
    };

    expect(
      finishClickWheelCapture(slot, 7, 12, "release", true, (end) =>
        ends.push(end),
      ),
    ).toBeTrue();
    expect(
      finishClickWheelCapture(slot, 7, 13, "lost-capture", false, (end) =>
        ends.push(end),
      ),
    ).toBeFalse();
    expect(ends).toEqual([{ pointerId: 7, timestampMs: 12, reason: "release" }]);
    expect(releases).toBe(1);
  });

  test("ignores terminal events for a different pointer", () => {
    const slot = createClickWheelCaptureSlot();
    const noop = () => undefined;
    const host = new EventTarget();
    slot.current = {
      pointerId: 4,
      pointerType: "touch",
      host,
      capture: {
        hasPointerCapture: () => true,
        setPointerCapture: noop,
        releasePointerCapture: noop,
      },
      onCancel: noop,
      onLostCapture: noop,
    };
    let ended = false;
    expect(
      finishClickWheelCapture(slot, 5, 1, "cancel", false, () => {
        ended = true;
      }),
    ).toBeFalse();
    expect(slot.current?.pointerId).toBe(4);
    expect(ended).toBeFalse();
  });
});
