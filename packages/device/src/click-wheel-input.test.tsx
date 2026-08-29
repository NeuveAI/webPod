import { describe, expect, test } from "bun:test";
import { Mesh, Ray, RingGeometry, Vector3 } from "three";

import {
  CLICK_WHEEL_INPUT_POSITION,
  CLICK_WHEEL_INPUT_RADII,
  acceptsClickWheelPointer,
  clockwiseWheelAngleDeg,
  createClickWheelCaptureSlot,
  finishClickWheelCapture,
  shortestWheelDeltaDeg,
  type ClickWheelArcEnd,
  wheelAngleFromRay,
} from "./click-wheel-input";
import { DEVICE_LAYOUT } from "./layout";

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

function rayAtLocal(mesh: Mesh, x: number, y: number) {
  mesh.updateWorldMatrix(true, false);
  const target = new Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld);
  return new Ray(target.clone().add(new Vector3(0, 0, 100)), new Vector3(0, 0, -1));
}

describe("click-wheel input geometry", () => {
  test("uses the canonical Select and wheel radii", () => {
    expect(CLICK_WHEEL_INPUT_RADII).toEqual({
      inner: DEVICE_LAYOUT.wheel.selectR,
      outer: DEVICE_LAYOUT.wheel.outerR,
    });
    expect(CLICK_WHEEL_INPUT_POSITION[0]).toBe(DEVICE_LAYOUT.wheel.centerX);
    expect(CLICK_WHEEL_INPUT_POSITION[1]).toBe(DEVICE_LAYOUT.wheel.centerY);
    expect(CLICK_WHEEL_INPUT_POSITION[2]).toBeGreaterThan(
      DEVICE_LAYOUT.body.depth / 2,
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

  test("samples the live ray against the mesh's current world plane", () => {
    const mesh = wheelMesh();
    mesh.rotation.set(0.15, -0.2, 0.35);
    mesh.position.x += 18;
    const clockwiseQuarter = wheelAngleFromRay(
      mesh,
      rayAtLocal(mesh, 0, -80),
    );
    expect(clockwiseQuarter).toBeCloseTo(90, 8);

    mesh.rotation.z = -0.45;
    mesh.position.y -= 12;
    const counterClockwiseQuarter = wheelAngleFromRay(
      mesh,
      rayAtLocal(mesh, 0, 80),
    );
    expect(counterClockwiseQuarter).toBeCloseTo(-90, 8);
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
