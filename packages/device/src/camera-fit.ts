import { Box3, PerspectiveCamera, Vector3 } from "three";

/** CSS-pixel viewport used to fit the physical model, not the debug chrome. */
export type DeviceFitViewport = {
  readonly width: number;
  readonly height: number;
  readonly safePadding: number;
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

  const insetX = Math.min(viewport.safePadding, viewport.width * 0.4);
  const insetY = Math.min(viewport.safePadding, viewport.height * 0.4);
  const maxNdcX = 1 - (2 * insetX) / viewport.width;
  const maxNdcY = 1 - (2 * insetY) / viewport.height;
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
