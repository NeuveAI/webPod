import { Box3, Euler, Matrix4, PerspectiveCamera, Vector3 } from "three";

import {
  DEVICE_ORIENTATION_LIMITS,
  deviceOrientationToRotation,
} from "./orientation";

/** CSS-pixel viewport used to fit the physical model, not the debug chrome. */
export type DeviceFitViewport = {
  readonly width: number;
  readonly height: number;
  readonly safePadding: number;
  /** Total clear span reserved on each axis; `0.1` leaves 5% per side. */
  readonly safeMarginRatio?: number;
};

/** Solved perspective camera state for one measured world-space model bound. */
export type DeviceCameraFit = {
  readonly target: Vector3;
  readonly distance: number;
  readonly near: number;
  readonly far: number;
  readonly maxNdcX: number;
  readonly maxNdcY: number;
};

const DEG_TO_RAD = Math.PI / 180;
export const DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO = 0.1;
/** Camera allowance beyond the 45° direct-manipulation pitch clamp. */
export const DEVICE_CAMERA_PITCH_OVERSHOOT_DEG = 3;
const ROTATIONAL_FIT_SAMPLE_DEG = 1;

function fitInsets(viewport: DeviceFitViewport): {
  readonly insetX: number;
  readonly insetY: number;
  readonly maxNdcX: number;
  readonly maxNdcY: number;
} {
  const safeMarginRatio =
    viewport.safeMarginRatio ?? DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO;
  if (!(safeMarginRatio >= 0) || !(safeMarginRatio < 0.8)) {
    throw new Error("device camera fit requires a margin ratio from 0 through 0.8");
  }
  const insetX = Math.min(
    Math.max(viewport.safePadding, (viewport.width * safeMarginRatio) / 2),
    viewport.width * 0.4,
  );
  const insetY = Math.min(
    Math.max(viewport.safePadding, (viewport.height * safeMarginRatio) / 2),
    viewport.height * 0.4,
  );
  return {
    insetX,
    insetY,
    maxNdcX: 1 - (2 * insetX) / viewport.width,
    maxNdcY: 1 - (2 * insetY) / viewport.height,
  };
}

/**
 * Fit a +Z perspective camera to an actual world-space {@link Box3}.
 *
 * Units are model units except for the viewport and padding, which are CSS
 * pixels. Every one of the eight bound corners participates in the solve, so a
 * rotated front, edge, or rear pose cannot inherit a front-only camera guess.
 * The returned target is owned by the caller and may be mutated after use.
 */
export function fitPerspectiveCameraToBounds(
  bounds: Box3,
  viewport: DeviceFitViewport,
  verticalFovDeg: number,
): DeviceCameraFit {
  if (bounds.isEmpty()) throw new Error("device camera fit requires non-empty bounds");
  if (!(viewport.width > 0) || !(viewport.height > 0)) {
    throw new Error("device camera fit requires a positive viewport");
  }
  if (!(verticalFovDeg > 0) || !(verticalFovDeg < 180)) {
    throw new Error(`device camera fit requires a finite perspective FOV; got ${verticalFovDeg}`);
  }

  const { maxNdcX, maxNdcY } = fitInsets(viewport);
  if (!(maxNdcX > 0) || !(maxNdcY > 0)) {
    throw new Error("device camera fit padding leaves no visible viewport");
  }

  const target = bounds.getCenter(new Vector3());
  const aspect = viewport.width / viewport.height;
  const tanHalfY = Math.tan((verticalFovDeg * DEG_TO_RAD) / 2);
  const tanHalfX = tanHalfY * aspect;
  let distance = 0;
  for (const corner of boxCorners(bounds)) {
    const x = corner.x - target.x;
    const y = corner.y - target.y;
    const z = corner.z - target.z;
    distance = Math.max(
      distance,
      z + Math.abs(x) / (tanHalfX * maxNdcX),
      z + Math.abs(y) / (tanHalfY * maxNdcY),
    );
  }

  const size = bounds.getSize(new Vector3());
  const nearestSurface = Math.max(0.1, distance - size.z / 2);
  const farthestSurface = distance + size.z / 2;
  const diagonal = size.length();
  return {
    target,
    distance,
    near: Math.max(0.1, nearestSurface * 0.25),
    far: farthestSurface + diagonal * 1.5,
    maxNdcX,
    maxNdcY,
  };
}

/**
 * Fits one camera to the complete yaw/pitch sweep without following pose.
 *
 * The actual centered enclosure corners participate at every sampled yaw and
 * pitch, including the inertial pitch allowance. One-degree sampling plus the
 * independent 10% safe span bounds the sub-degree chord between samples.
 * Roll is an explicit modifier mode rather than part of ordinary flip motion,
 * so including its full ±18° range would make a portrait device needlessly
 * half-size before the first interaction.
 */
export function fitPerspectiveCameraToRotationalEnvelope(
  bounds: Box3,
  viewport: DeviceFitViewport,
  verticalFovDeg: number,
): DeviceCameraFit {
  if (bounds.isEmpty()) throw new Error("device camera fit requires non-empty bounds");
  if (!(viewport.width > 0) || !(viewport.height > 0)) {
    throw new Error("device camera fit requires a positive viewport");
  }
  if (!(verticalFovDeg > 0) || !(verticalFovDeg < 180)) {
    throw new Error(`device camera fit requires a finite perspective FOV; got ${verticalFovDeg}`);
  }
  const { maxNdcX, maxNdcY } = fitInsets(viewport);
  const aspect = viewport.width / viewport.height;
  const tanHalfY = Math.tan((verticalFovDeg * DEG_TO_RAD) / 2);
  const tanHalfX = tanHalfY * aspect;
  const center = bounds.getCenter(new Vector3());
  const centeredCorners = boxCorners(bounds).map((corner) => corner.sub(center));
  const radius = Math.max(...centeredCorners.map((corner) => corner.length()));
  const scratch = new Vector3();
  const rotation = new Matrix4();
  let distance = 0;
  const pitchLimit =
    DEVICE_ORIENTATION_LIMITS.pitchMax + DEVICE_CAMERA_PITCH_OVERSHOOT_DEG;
  for (let yawDeg = -180; yawDeg < 180; yawDeg += ROTATIONAL_FIT_SAMPLE_DEG) {
    for (
      let pitchDeg = -pitchLimit;
      pitchDeg <= pitchLimit;
      pitchDeg += ROTATIONAL_FIT_SAMPLE_DEG
    ) {
      rotation.makeRotationFromEuler(
        new Euler(
          ...deviceOrientationToRotation({ pitchDeg, yawDeg, rollDeg: 0 }),
          "XYZ",
        ),
      );
      for (const corner of centeredCorners) {
        scratch.copy(corner).applyMatrix4(rotation);
        distance = Math.max(
          distance,
          scratch.z + Math.abs(scratch.x) / (tanHalfX * maxNdcX),
          scratch.z + Math.abs(scratch.y) / (tanHalfY * maxNdcY),
        );
      }
    }
  }
  return {
    target: new Vector3(0, 0, 0),
    distance,
    near: Math.max(0.1, (distance - radius) * 0.5),
    far: distance + radius * 2,
    maxNdcX,
    maxNdcY,
  };
}

/** Apply a solved fit to the live R3F perspective camera. */
export function applyDeviceCameraFit(
  camera: PerspectiveCamera,
  fit: DeviceCameraFit,
  viewport: Pick<DeviceFitViewport, "width" | "height">,
): void {
  camera.aspect = viewport.width / viewport.height;
  camera.near = fit.near;
  camera.far = fit.far;
  camera.position.set(fit.target.x, fit.target.y, fit.target.z + fit.distance);
  camera.lookAt(fit.target);
  camera.updateProjectionMatrix();
  camera.updateWorldMatrix(true, false);
}

/** The eight corners of a bound, returned as new caller-owned vectors. */
export function boxCorners(bounds: Box3): readonly Vector3[] {
  const { min, max } = bounds;
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, max.y, max.z),
  ];
}

/**
 * Return the greatest absolute projected coordinate of the bound.
 * Values at or below the fit's NDC limits prove the model is inside its safe
 * area; this is also the mutation gate for a regressed camera distance.
 */
export function projectedBoundsExtent(
  bounds: Box3,
  camera: PerspectiveCamera,
): { readonly x: number; readonly y: number } {
  let x = 0;
  let y = 0;
  for (const corner of boxCorners(bounds)) {
    corner.project(camera);
    x = Math.max(x, Math.abs(corner.x));
    y = Math.max(y, Math.abs(corner.y));
  }
  return { x, y };
}

/** Projected AABB metrics in NDC, including perspective-induced center drift. */
export function projectedBoundsMetrics(
  bounds: Box3,
  camera: PerspectiveCamera,
): ReturnType<typeof projectedPointsMetrics> {
  return projectedPointsMetrics(boxCorners(bounds), camera);
}

/** Project actual geometry points without inventing rotated-AABB corners. */
export function projectedPointsMetrics(
  points: readonly Vector3[],
  camera: PerspectiveCamera,
): {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly maxAbsX: number;
  readonly maxAbsY: number;
} {
  if (points.length === 0) {
    throw new Error("device projection metrics require at least one point");
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const corner = point.clone();
    corner.project(camera);
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
    maxAbsX: Math.max(Math.abs(minX), Math.abs(maxX)),
    maxAbsY: Math.max(Math.abs(minY), Math.abs(maxY)),
  };
}
