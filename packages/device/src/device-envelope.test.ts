import { describe, expect, test } from "bun:test";
import { Euler, Matrix4, Vector3 } from "three";

import {
  completeDeviceEnvelope,
  DEFAULT_DEVICE_ENVELOPE,
  deviceEnvelopeBounds,
} from "./device-envelope";
import { DEFAULT_DEVICE_FORM } from "./form";
import { DEVICE_LAYOUT } from "./layout";
import {
  FRONT_DEVICE_ORIENTATION,
  clampDeviceOrientation,
  deviceOrientationToRotation,
} from "./orientation";
import { DEFAULT_DEVICE_TOP_CONTROL_BOUNDS } from "./top-controls";

describe("complete device envelope and rigid pivot", () => {
  test("declares the full rear-to-crown enclosure around one immutable center", () => {
    const envelope = completeDeviceEnvelope(DEFAULT_DEVICE_FORM);
    const maximumFrontCrown =
      DEFAULT_DEVICE_FORM.bodyCrown + DEFAULT_DEVICE_FORM.bodyCrossCrown;

    expect(envelope).toEqual(DEFAULT_DEVICE_ENVELOPE);
    expect(envelope.width).toBe(DEVICE_LAYOUT.body.width);
    expect(envelope.height).toBe(
      DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.max[1] + DEVICE_LAYOUT.body.height / 2,
    );
    expect(envelope.min).toEqual([
      -DEVICE_LAYOUT.body.width / 2,
      -DEVICE_LAYOUT.body.height / 2,
      -DEVICE_LAYOUT.body.depth / 2,
    ]);
    expect(envelope.max).toEqual([
      DEVICE_LAYOUT.body.width / 2,
      DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.max[1],
      DEVICE_LAYOUT.body.depth / 2 + maximumFrontCrown,
    ]);
    expect(envelope.center[0]).toBe(0);
    expect(envelope.center[1]).toBeCloseTo(1.625, 12);
    expect(envelope.center[2]).toBeCloseTo(maximumFrontCrown / 2, 12);
    expect(deviceEnvelopeBounds(envelope).getCenter(new Vector3()).toArray()).toEqual(
      [...envelope.center],
    );
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.center)).toBe(true);
  });

  test("recentering keeps the production envelope pivot fixed through a full sweep", () => {
    const envelope = DEFAULT_DEVICE_ENVELOPE;
    const localCenter = new Vector3(...envelope.center);
    const recenter = new Matrix4().makeTranslation(
      -envelope.center[0],
      -envelope.center[1],
      -envelope.center[2],
    );
    let maximumDrift = 0;

    for (let yawDeg = -180; yawDeg <= 180; yawDeg += 5) {
      for (const pitchDeg of [-45, -22.5, 0, 22.5, 45]) {
        const rotation = new Matrix4().makeRotationFromEuler(
          new Euler(
            ...deviceOrientationToRotation({ pitchDeg, yawDeg, rollDeg: 18 }),
            "XYZ",
          ),
        );
        const world = localCenter.clone().applyMatrix4(recenter).applyMatrix4(rotation);
        maximumDrift = Math.max(maximumDrift, world.length());
      }
    }

    expect(maximumDrift).toBeLessThan(1e-12);
  });

  test("a planted front-face pivot visibly moves the enclosure center", () => {
    const envelope = DEFAULT_DEVICE_ENVELOPE;
    const localCenter = new Vector3(...envelope.center);
    const frontFacePivot = new Matrix4().makeTranslation(0, 0, -envelope.max[2]);
    let maximumDrift = 0;

    for (let yawDeg = -180; yawDeg <= 180; yawDeg += 15) {
      const rotation = new Matrix4().makeRotationFromEuler(
        new Euler(
          ...deviceOrientationToRotation({ pitchDeg: 30, yawDeg, rollDeg: 0 }),
          "XYZ",
        ),
      );
      const world = localCenter
        .clone()
        .applyMatrix4(frontFacePivot)
        .applyMatrix4(rotation);
      maximumDrift = Math.max(maximumDrift, world.length());
    }

    expect(maximumDrift).toBeGreaterThan(DEVICE_LAYOUT.body.depth / 2);
  });

  test("one complete turn reproduces the exact front orientation", () => {
    const returned = clampDeviceOrientation({
      pitchDeg: 0,
      yawDeg: 360,
      rollDeg: 0,
    });

    expect(returned).toEqual(FRONT_DEVICE_ORIENTATION);
    expect(deviceOrientationToRotation(returned)).toEqual(
      deviceOrientationToRotation(FRONT_DEVICE_ORIENTATION),
    );
  });
});
