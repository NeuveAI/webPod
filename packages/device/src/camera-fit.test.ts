import { describe, expect, test } from "bun:test";
import { Box3, Euler, Matrix4, PerspectiveCamera, Vector3 } from "three";

import {
  applyDeviceCameraFit,
  boxCorners,
  DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO,
  fitPerspectiveCameraToBounds,
  fitPerspectiveCameraToRotationalEnvelope,
  projectedBoundsExtent,
  projectedPointsMetrics,
} from "./camera-fit";
import {
  DEFAULT_DEVICE_ENVELOPE,
  deviceEnvelopeBounds,
} from "./device-envelope";
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
  { width: 844, height: 390, safePadding: 28 },
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

  test("one production camera contains the complete rotational envelope at every DPR", () => {
    const envelope = DEFAULT_DEVICE_ENVELOPE;
    const local = deviceEnvelopeBounds(envelope);
    for (const viewport of VIEWPORTS) {
      const camera = new PerspectiveCamera(30, 1, 0.1, 10_000);
      const fit = fitPerspectiveCameraToRotationalEnvelope(
        local,
        {
          ...viewport,
          safeMarginRatio: DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO,
        },
        30,
      );
      applyDeviceCameraFit(camera, fit, viewport);
      const cameraState = {
        position: camera.position.toArray(),
        fov: camera.fov,
        aspect: camera.aspect,
        near: camera.near,
        far: camera.far,
      };
      const rest = projectedPointsMetrics(
        rotatedRecentredCorners(local, DEVICE_ORIENTATION_PRESETS.front),
        camera,
      );
      const restCssClearance = Math.min(
        ((1 - rest.maxAbsX) * viewport.width) / 2,
        ((1 - rest.maxAbsY) * viewport.height) / 2,
      );
      let minimumCssClearance = Number.POSITIVE_INFINITY;
      let maximumProjectedX = 0;
      let maximumProjectedY = 0;

      for (let yawDeg = -180; yawDeg <= 180; yawDeg += 1) {
        for (let pitchDeg = -48; pitchDeg <= 48; pitchDeg += 1) {
          const points = rotatedRecentredCorners(local, {
            pitchDeg,
            yawDeg,
            rollDeg: 0,
          });
          const projected = projectedPointsMetrics(points, camera);
          maximumProjectedX = Math.max(maximumProjectedX, projected.maxAbsX);
          maximumProjectedY = Math.max(maximumProjectedY, projected.maxAbsY);
          minimumCssClearance = Math.min(
            minimumCssClearance,
            ((1 - projected.maxAbsX) * viewport.width) / 2,
            ((1 - projected.maxAbsY) * viewport.height) / 2,
          );
        }
      }

      expect(maximumProjectedX).toBeLessThanOrEqual(fit.maxNdcX + 1e-8);
      expect(maximumProjectedY).toBeLessThanOrEqual(fit.maxNdcY + 1e-8);
      expect(camera.position.toArray()).toEqual(cameraState.position);
      expect(camera.fov).toBe(cameraState.fov);
      expect(camera.aspect).toBe(cameraState.aspect);
      expect(camera.near).toBe(cameraState.near);
      expect(camera.far).toBe(cameraState.far);
      expect(restCssClearance).toBeGreaterThanOrEqual(
        Math.min(viewport.width, viewport.height) * 0.08,
      );
      expect(restCssClearance).toBeLessThanOrEqual(
        Math.min(viewport.width, viewport.height) * 0.14,
      );
      for (const dpr of [1, 2, 3]) {
        expect(minimumCssClearance * dpr).toBeGreaterThanOrEqual(
          Math.min(viewport.width, viewport.height) * 0.04 * dpr,
        );
      }
    }
  });

  test("front and rear reproduce dimensions while the projected pivot stays fixed", () => {
    const viewport = VIEWPORTS[2];
    const envelope = DEFAULT_DEVICE_ENVELOPE;
    const local = deviceEnvelopeBounds(envelope);
    const camera = new PerspectiveCamera(30, 1, 0.1, 10_000);
    const fit = fitPerspectiveCameraToRotationalEnvelope(
      local,
      viewport,
      30,
    );
    applyDeviceCameraFit(camera, fit, viewport);
    const front = projectedPointsMetrics(
      rotatedRecentredCorners(local, DEVICE_ORIENTATION_PRESETS.front),
      camera,
    );
    const rear = projectedPointsMetrics(
      rotatedRecentredCorners(local, DEVICE_ORIENTATION_PRESETS.rear),
      camera,
    );

    expect(front.width).toBeCloseTo(rear.width, 12);
    expect(front.height).toBeCloseTo(rear.height, 12);
    expect(Math.abs(front.centerX)).toBeLessThan(0.002);
    expect(Math.abs(front.centerY)).toBeLessThan(0.002);
    expect(Math.abs(rear.centerX)).toBeLessThan(0.002);
    expect(Math.abs(rear.centerY)).toBeLessThan(0.002);
  });

  test("a shorter planted production camera clips the rotational envelope", () => {
    const viewport = VIEWPORTS[0];
    const local = deviceEnvelopeBounds(DEFAULT_DEVICE_ENVELOPE);
    const fit = fitPerspectiveCameraToRotationalEnvelope(local, viewport, 30);
    const camera = new PerspectiveCamera(30, 1, 0.1, 10_000);
    applyDeviceCameraFit(
      camera,
      { ...fit, distance: fit.distance * 0.95 },
      viewport,
    );
    const projected = projectedPointsMetrics(
      rotatedRecentredCorners(local, {
        pitchDeg: -48,
        yawDeg: -166,
        rollDeg: 0,
      }),
      camera,
    );

    expect(
      projected.maxAbsX > fit.maxNdcX || projected.maxAbsY > fit.maxNdcY,
    ).toBe(true);
  });
});

function rotatedRecentredCorners(
  local: Box3,
  orientation: DeviceOrientation,
): readonly Vector3[] {
  const recenter = new Matrix4().makeTranslation(
    -DEFAULT_DEVICE_ENVELOPE.center[0],
    -DEFAULT_DEVICE_ENVELOPE.center[1],
    -DEFAULT_DEVICE_ENVELOPE.center[2],
  );
  const rotation = new Matrix4().makeRotationFromEuler(
    new Euler(...deviceOrientationToRotation(orientation), "XYZ"),
  );
  const transform = rotation.multiply(recenter);
  return boxCorners(local).map((corner) => corner.applyMatrix4(transform));
}
