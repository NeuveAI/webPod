import { Mesh, Plane, Ray, Vector3, type Raycaster, type Intersection } from 'three';
import { DEVICE_LAYOUT } from './layout';
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from './form';
import { DEFAULT_FRONT_ASSEMBLY_DEPTHS, resolveFrontAssemblyDepths, frontShellOffsetAt, SELECT_CONCAVITY } from './front-surface';

/** Explicit input adapter shared by Fiber and native query dispatch. The ray is
 * supplied by the current camera; this is not a synthetic Fiber event. */
export interface ClickWheelPointerEvent {
  readonly pointerId: number; readonly pointerType: string; readonly isPrimary: boolean; readonly button: number;
  readonly timeStamp: number; readonly ray: Ray; readonly target: EventTarget | null;
  readonly nativeEvent: {readonly currentTarget: EventTarget | null};
  stopPropagation(): void;
}
export type ClickWheelPointerType = "mouse" | "touch" | "pen";

/** A body-local wheel angle sampled from the current pointer ray. */
export type ClickWheelArcSample = {
  readonly pointerId: number;
  readonly pointerType: ClickWheelPointerType;
  /** Absolute angle in degrees, increasing clockwise. */
  readonly angleDeg: number;
  readonly timestampMs: number;
};

/** The terminal event for one captured wheel gesture. */
export type ClickWheelArcEnd = {
  readonly pointerId: number;
  readonly timestampMs: number;
  readonly reason: "release" | "cancel" | "lost-capture";
};

/** Physical Select contact; semantic selection remains outside this package. */
export type ClickWheelSelectStart = {
  readonly pointerId: number;
  readonly pointerType: ClickWheelPointerType;
  readonly timestampMs: number;
};

export type ClickWheelSelectEnd = {
  readonly pointerId: number;
  readonly timestampMs: number;
  readonly reason: ClickWheelArcEnd["reason"];
};

/** The four physical buttons printed into the click-wheel ring. */
export type ClickWheelCardinalButton =
  | "menu"
  | "previous"
  | "next"
  | "play-pause";

/** One release-qualified physical cardinal-button press. */
export type ClickWheelCardinalPress = {
  readonly pointerId: number;
  readonly pointerType: ClickWheelPointerType;
  readonly button: ClickWheelCardinalButton;
  readonly timestampMs: number;
};

/** Physical down edge for one cardinal switch, before semantic acceptance. */
export type ClickWheelCardinalStart = ClickWheelCardinalPress;

/** Terminal edge for a cardinal switch, including drag-off acceptance. */
export type ClickWheelCardinalEnd = ClickWheelCardinalPress & {
  readonly reason: ClickWheelArcEnd["reason"];
  readonly accepted: boolean;
};

export type ClickWheelInputSurfaceProps = {
  readonly onArcStart: (sample: ClickWheelArcSample) => void;
  readonly onArcMove: (sample: ClickWheelArcSample) => void;
  readonly onArcEnd: (end: ClickWheelArcEnd) => void;
  /** Optional typed seam for the runtime that owns Select semantics/SFX. */
  readonly onSelectStart?: (start: ClickWheelSelectStart) => void;
  readonly onSelectEnd?: (end: ClickWheelSelectEnd) => void;
  /** Fires once on release only when a cardinal hit survives pointer slop. */
  readonly onCardinalPress?: (press: ClickWheelCardinalPress) => void;
  readonly onCardinalStart?: (start: ClickWheelCardinalStart) => void;
  readonly onCardinalEnd?: (end: ClickWheelCardinalEnd) => void;
};

/** Canonical annulus dimensions, exported so geometry drift is testable. */
export const CLICK_WHEEL_INPUT_RADII = Object.freeze({
  inner: DEVICE_LAYOUT.wheel.selectR,
  outer: DEVICE_LAYOUT.wheel.outerR,
});

/**
 * Stable local origin for input meshes. Production raycasts resolve the
 * crowned surface relative to this origin; it is not a floating hit plane.
 */
export const CLICK_WHEEL_INPUT_POSITION = Object.freeze([
  DEVICE_LAYOUT.wheel.centerX,
  DEVICE_LAYOUT.wheel.centerY,
  DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ,
] as const);

/** Pointer slop before a cardinal tap becomes an arc-only gesture. */
export const CLICK_WHEEL_CARDINAL_SLOP = 10;

export type WheelLocalPoint = {
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
  readonly radius: number;
  readonly z: number;
};

export type CardinalCandidate = {
  readonly pointerId: number;
  readonly pointerType: ClickWheelPointerType;
  readonly button: ClickWheelCardinalButton;
  readonly startX: number;
  readonly startY: number;
};

/**
 * Maps every point in the visible annulus to one deterministic 90° sector.
 * Center owns the inner boundary; the four diagonal boundaries are half-open
 * and belong clockwise to Bottom, Left, Top, and Right respectively.
 */
export function cardinalButtonAtWheelPoint(
  x: number,
  y: number,
): ClickWheelCardinalButton | null {
  const radius = Math.hypot(x, y);
  if (
    radius <= CLICK_WHEEL_INPUT_RADII.inner ||
    radius > CLICK_WHEEL_INPUT_RADII.outer
  ) return null;
  const normalized = ((clockwiseWheelAngleDeg(x, y) % 360) + 360) % 360;
  const angle = Math.round(normalized * 1_000_000_000) / 1_000_000_000;
  if (angle >= 315 || angle < 45) return "next";
  if (angle < 135) return "play-pause";
  if (angle < 225) return "previous";
  return "menu";
}

/** Resolve the ray plane from the same injectable solid form as the wheel. */
export function clickWheelInputPosition(
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): readonly [number, number, number] {
  return [
    DEVICE_LAYOUT.wheel.centerX,
    DEVICE_LAYOUT.wheel.centerY,
    resolveFrontAssemblyDepths(form).clickWheelInputZ,
  ];
}

export type CaptureApi = {
  readonly hasPointerCapture: (pointerId: number) => boolean;
  readonly setPointerCapture: (pointerId: number) => void;
  readonly releasePointerCapture: (pointerId: number) => void;
};

export type ActivePointer = {
  readonly pointerId: number;
  readonly pointerType: ClickWheelPointerType;
  readonly capture: CaptureApi;
  readonly host: EventTarget;
  readonly onCancel: EventListener;
  readonly onLostCapture: EventListener;
  readonly blurHost?: EventTarget;
  readonly onBlur?: EventListener;
};

export type ClickWheelCaptureSlot = {
  current: ActivePointer | null;
};

export function createClickWheelCaptureSlot(): ClickWheelCaptureSlot {
  return { current: null };
}

/**
 * Ends an active capture before firing side effects, making browser-generated
 * `lostpointercapture` after release idempotent with the pointer-up path.
 */
export function finishClickWheelCapture(
  slot: ClickWheelCaptureSlot,
  pointerId: number,
  timestampMs: number,
  reason: ClickWheelArcEnd["reason"],
  releaseCapture: boolean,
  onArcEnd: (end: ClickWheelArcEnd) => void,
): boolean {
  const active = slot.current;
  if (active === null || active.pointerId !== pointerId) return false;
  slot.current = null;
  active.host.removeEventListener("pointercancel", active.onCancel);
  active.host.removeEventListener("lostpointercapture", active.onLostCapture);
  if (active.blurHost !== undefined && active.onBlur !== undefined) {
    active.blurHost.removeEventListener("blur", active.onBlur);
  }
  if (releaseCapture && active.capture.hasPointerCapture(pointerId)) {
    active.capture.releasePointerCapture(pointerId);
  }
  onArcEnd({ pointerId, timestampMs, reason });
  return true;
}

/** Converts a wheel-local point into the clockwise-positive angle contract. */
export function clockwiseWheelAngleDeg(x: number, y: number): number {
  return (-Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Resolves the current event ray against the mesh's current world plane.
 *
 * Pointer capture in R3F retains the original intersection, so `event.point`
 * is stale once the pointer leaves the ring. This function intentionally
 * accepts only a ray and recomputes the intersection after every transform.
 */
export function wheelAngleFromRay(mesh: Mesh, ray: Ray): number | null {
  return wheelPointFromRay(mesh, ray)?.angleDeg ?? null;
}

/** Resolves the complete body-local plane hit used by arc and button logic. */
export function wheelPointFromRay(mesh: Mesh, ray: Ray): WheelLocalPoint | null {
  mesh.updateWorldMatrix(true, false);
  const plane = new Plane();
  const planeNormal = new Vector3();
  const planeOrigin = new Vector3();
  const planeHit = new Vector3();
  planeOrigin.setFromMatrixPosition(mesh.matrixWorld);
  planeNormal.set(0, 0, 1).transformDirection(mesh.matrixWorld);
  plane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);
  const hit = ray.intersectPlane(plane, planeHit);
  if (hit === null) return null;
  mesh.worldToLocal(hit);
  const form = mesh.userData["wheelSurfaceForm"] as DeviceFormParams | undefined;
  if (form !== undefined) {
    const localRay = ray.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
    if (Math.abs(localRay.direction.z) < 1e-8) return null;
    // Intersect the actual crowned surface instead of a floating proxy plane.
    // Its shallow slope converges rapidly, including strongly tilted poses.
    for (let i = 0; i < 8; i++) {
      const bowl = mesh.name === "click-wheel-select-input"
        ? SELECT_CONCAVITY * Math.max(0, 1 - (hit.x * hit.x + hit.y * hit.y) / (CLICK_WHEEL_INPUT_RADII.inner ** 2)) ** 2 : 0;
      const z = DEVICE_LAYOUT.body.depth / 2 + frontShellOffsetAt(
        DEVICE_LAYOUT.wheel.centerX + hit.x, DEVICE_LAYOUT.wheel.centerY + hit.y, form,
      ) - bowl - mesh.position.z;
      const t = (z - localRay.origin.z) / localRay.direction.z;
      if (t < 0) return null;
      localRay.at(t, hit);
    }
  }
  return {
    x: hit.x,
    y: hit.y,
    angleDeg: clockwiseWheelAngleDeg(hit.x, hit.y),
    radius: Math.hypot(hit.x, hit.y),
    z: hit.z,
  };
}

/** Exact circular boundaries avoid triangle-edge misses in oblique raycasts. */
function raycastWheelRegion(mesh: Mesh, raycaster: Raycaster, hits: Intersection[], select: boolean): void {
  const local = wheelPointFromRay(mesh, raycaster.ray);
  if (local === null || local.radius > (select ? CLICK_WHEEL_INPUT_RADII.inner : CLICK_WHEEL_INPUT_RADII.outer) ||
    (!select && local.radius <= CLICK_WHEEL_INPUT_RADII.inner)) return;
  const normal = new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
  if (raycaster.ray.direction.dot(normal) >= 0) return;
  const point = mesh.localToWorld(new Vector3(local.x, local.y, local.z));
  const distance = raycaster.ray.origin.distanceTo(point);
  if (distance < raycaster.near || distance > raycaster.far) return;
  hits.push({ distance, point, object: mesh });
}
export function raycastWheelRing(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
  raycastWheelRegion(this, raycaster, hits, false);
}
export function raycastWheelSelect(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
  raycastWheelRegion(this, raycaster, hits, true);
}

/** Shortest signed angular travel, including the ±180° seam. */
export function shortestWheelDeltaDeg(
  previousDeg: number,
  currentDeg: number,
): number {
  return ((currentDeg - previousDeg + 540) % 360) - 180;
}

export function pointerTypeOf(value: string): ClickWheelPointerType | null {
  if (value === "mouse" || value === "touch" || value === "pen") return value;
  return null;
}

export function acceptsClickWheelPointer(input: {
  readonly isPrimary: boolean;
  readonly pointerType: string;
  readonly button: number;
}): boolean {
  return (
    input.isPrimary &&
    (input.pointerType !== "mouse" || input.button === 0) &&
    pointerTypeOf(input.pointerType) !== null
  );
}

export function nativeHost(event: ClickWheelPointerEvent): EventTarget | null {
  return event.nativeEvent.currentTarget;
}

export function pointerIdentity(event: Event): {
  readonly pointerId: number;
  readonly timestampMs: number;
} | null {
  if (!("pointerId" in event) || typeof event.pointerId !== "number") {
    return null;
  }
  return { pointerId: event.pointerId, timestampMs: event.timeStamp };
}

export function captureApiOf(target: EventTarget | null): CaptureApi | null {
  if (
    target === null ||
    !("hasPointerCapture" in target) ||
    !("setPointerCapture" in target) ||
    !("releasePointerCapture" in target) ||
    typeof target.hasPointerCapture !== "function" ||
    typeof target.setPointerCapture !== "function" ||
    typeof target.releasePointerCapture !== "function"
  ) {
    return null;
  }
  const hasPointerCapture = target.hasPointerCapture;
  const setPointerCapture = target.setPointerCapture;
  const releasePointerCapture = target.releasePointerCapture;
  return {
    hasPointerCapture: (pointerId) =>
      Reflect.apply(hasPointerCapture, target, [pointerId]) === true,
    setPointerCapture: (pointerId) => {
      Reflect.apply(setPointerCapture, target, [pointerId]);
    },
    releasePointerCapture: (pointerId) => {
      Reflect.apply(releasePointerCapture, target, [pointerId]);
    },
  };
}
