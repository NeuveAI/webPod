import { describe, expect, test } from "bun:test";
import { Box3, Euler, Matrix4, PerspectiveCamera, Vector3 } from "three";

import {
  applyDeviceCameraFit,
  boxCorners,
  fitPerspectiveCameraToBounds,
  projectedBoundsExtent,
} from "./camera-fit";
import { DEFAULT_DEVICE_FORM } from "./form";
import { DEVICE_LAYOUT } from "./layout";
import {
  DEVICE_ORIENTATION_PRESETS,
  deviceOrientationToRotation,
  type DeviceOrientation,
} from "./orientation";

const VIEWPORTS = [
  { width: 375, height: 812, safePadding: 28 },
  { width: 430, height: 932, safePadding: 28 },
  { width: 1024, height: 768, safePadding: 36 },
] as const;

function modelBounds(orientation: DeviceOrientation): Box3 {
  const { body } = DEVICE_LAYOUT;
  const local = new Box3(
    new Vector3(-body.width / 2 - 4, -body.height / 2 - 4, -body.depth / 2 - 2),
    new Vector3(
      body.width / 2 + 4,
      body.height / 2 + 4,
      body.depth / 2 +
        DEFAULT_DEVICE_FORM.bodyCrown +
        DEFAULT_DEVICE_FORM.bodyCrossCrown,
    ),
  );
  const rotation = deviceOrientationToRotation(orientation);
  const matrix = new Matrix4().makeRotationFromEuler(
    new Euler(...rotation, "XYZ"),
  );
  const rotated = new Box3();
  for (const corner of boxCorners(local))
    rotated.expandByPoint(corner.applyMatrix4(matrix));
  return rotated;
}

const PHYSICAL_VIEWS = [
  { name: "front", orientation: DEVICE_ORIENTATION_PRESETS.front },
  {
    name: "three-quarter",
    orientation: DEVICE_ORIENTATION_PRESETS["three-quarter"],
  },
  { name: "left-edge", orientation: { pitchDeg: 0, yawDeg: -90, rollDeg: 0 } },
  { name: "right-edge", orientation: { pitchDeg: 0, yawDeg: 90, rollDeg: 0 } },
  { name: "rear", orientation: DEVICE_ORIENTATION_PRESETS.rear },
  { name: "top", orientation: { pitchDeg: 90, yawDeg: 0, rollDeg: 0 } },
  { name: "bottom", orientation: { pitchDeg: -90, yawDeg: 0, rollDeg: 0 } },
] as const satisfies ReadonlyArray<{
  readonly name: string;
  readonly orientation: DeviceOrientation;
}>;

describe("perspective camera fit from measured model bounds", () => {
  for (const viewport of VIEWPORTS) {
    for (const view of PHYSICAL_VIEWS) {
      test(`${viewport.width}x${viewport.height} contains the ${view.name} model inside its safe area`, () => {
        const bounds = modelBounds(view.orientation);
        const camera = new PerspectiveCamera(30, 1, 0.1, 10_000);
        const fit = fitPerspectiveCameraToBounds(bounds, viewport, 30);
        applyDeviceCameraFit(camera, fit, viewport);
        const projected = projectedBoundsExtent(bounds, camera);

        expect(projected.x).toBeLessThanOrEqual(fit.maxNdcX + 1e-8);
        expect(projected.y).toBeLessThanOrEqual(fit.maxNdcY + 1e-8);
        expect(camera.near).toBeGreaterThan(0);
        expect(camera.far).toBeGreaterThan(camera.near);
      });
    }
  }

  test("a shorter planted distance visibly escapes the safe area", () => {
    const viewport = VIEWPORTS[0];
    const bounds = modelBounds(DEVICE_ORIENTATION_PRESETS["three-quarter"]);
    const camera = new PerspectiveCamera(30, 1, 0.1, 10_000);
    const fit = fitPerspectiveCameraToBounds(bounds, viewport, 30);
    applyDeviceCameraFit(
      camera,
      { ...fit, distance: fit.distance * 0.82 },
      viewport,
    );
    const projected = projectedBoundsExtent(bounds, camera);
    expect(projected.x > fit.maxNdcX || projected.y > fit.maxNdcY).toBe(true);
  });
});
