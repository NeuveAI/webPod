import type { ThreeEvent } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import {
  Mesh,
  Plane,
  Ray,
  Vector3,
} from "three";

import { DEVICE_LAYOUT } from "./layout";
import { DeviceCanvasOrientationContext } from "./DeviceCanvas";

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

export type ClickWheelInputSurfaceProps = {
  readonly onArcStart: (sample: ClickWheelArcSample) => void;
  readonly onArcMove: (sample: ClickWheelArcSample) => void;
  readonly onArcEnd: (end: ClickWheelArcEnd) => void;
};

const INPUT_PLANE_OFFSET = 0.25;

/** Canonical annulus dimensions, exported so geometry drift is testable. */
export const CLICK_WHEEL_INPUT_RADII = Object.freeze({
  inner: DEVICE_LAYOUT.wheel.selectR,
  outer: DEVICE_LAYOUT.wheel.outerR,
});

/**
 * The interaction plane sits just ahead of every visible front-face surface.
 * It is deliberately planar: the state adapter needs angular thumb travel,
 * while the rendered wheel's shallow dish remains a material/geometry concern.
 */
export const CLICK_WHEEL_INPUT_POSITION = Object.freeze([
  DEVICE_LAYOUT.wheel.centerX,
  DEVICE_LAYOUT.wheel.centerY,
  DEVICE_LAYOUT.body.depth / 2 + INPUT_PLANE_OFFSET,
] as const);

type CaptureApi = {
  readonly hasPointerCapture: (pointerId: number) => boolean;
  readonly setPointerCapture: (pointerId: number) => void;
  readonly releasePointerCapture: (pointerId: number) => void;
};

type ActivePointer = {
  readonly pointerId: number;
  readonly pointerType: ClickWheelPointerType;
  readonly capture: CaptureApi;
  readonly host: EventTarget;
  readonly onCancel: EventListener;
  readonly onLostCapture: EventListener;
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
  onArcEnd({ pointerId, timestampMs, reason });
  if (releaseCapture && active.capture.hasPointerCapture(pointerId)) {
    active.capture.releasePointerCapture(pointerId);
  }
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
  return clockwiseWheelAngleDeg(hit.x, hit.y);
}

/** Shortest signed angular travel, including the ±180° seam. */
export function shortestWheelDeltaDeg(
  previousDeg: number,
  currentDeg: number,
): number {
  return ((currentDeg - previousDeg + 540) % 360) - 180;
}

function pointerTypeOf(value: string): ClickWheelPointerType | null {
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

function nativeHost(event: ThreeEvent<PointerEvent>): EventTarget | null {
  return event.nativeEvent.currentTarget;
}

function pointerIdentity(event: Event): {
  readonly pointerId: number;
  readonly timestampMs: number;
} | null {
  if (!("pointerId" in event) || typeof event.pointerId !== "number") {
    return null;
  }
  return { pointerId: event.pointerId, timestampMs: event.timeStamp };
}

function captureApiOf(target: EventTarget | null): CaptureApi | null {
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

/**
 * Invisible front-face annulus that owns R3F ray conversion and capture only.
 * State, acceleration, coast, haptics and tier policy remain outside device.
 */
export function ClickWheelInputSurface({
  onArcStart,
  onArcMove,
  onArcEnd,
}: ClickWheelInputSurfaceProps) {
  const orientationState = useContext(DeviceCanvasOrientationContext);
  const meshRef = useRef<Mesh>(null);
  const captureSlotRef = useRef<ClickWheelCaptureSlot>(
    createClickWheelCaptureSlot(),
  );
  const callbacksRef = useRef({ onArcStart, onArcMove, onArcEnd });
  useEffect(() => {
    callbacksRef.current = { onArcStart, onArcMove, onArcEnd };
  }, [onArcEnd, onArcMove, onArcStart]);

  const finish = (
    pointerId: number,
    timestampMs: number,
    reason: ClickWheelArcEnd["reason"],
    releaseCapture: boolean,
  ) => {
    finishClickWheelCapture(
      captureSlotRef.current,
      pointerId,
      timestampMs,
      reason,
      releaseCapture,
      callbacksRef.current.onArcEnd,
    );
  };

  useEffect(
    () => () => {
      const active = captureSlotRef.current.current;
      if (active === null) return;
      finishClickWheelCapture(
        captureSlotRef.current,
        active.pointerId,
        performance.now(),
        "cancel",
        true,
        callbacksRef.current.onArcEnd,
      );
    },
    [],
  );

  const sample = (
    event: ThreeEvent<PointerEvent>,
    pointerType: ClickWheelPointerType,
  ): ClickWheelArcSample | null => {
    const mesh = meshRef.current;
    if (mesh === null) return null;
    const angleDeg = wheelAngleFromRay(mesh, event.ray);
    if (angleDeg === null) return null;
    return {
      pointerId: event.pointerId,
      pointerType,
      angleDeg,
      timestampMs: event.timeStamp,
    };
  };

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (
      !acceptsClickWheelPointer(event) ||
      captureSlotRef.current.current !== null
    )
      return;
    const pointerType = pointerTypeOf(event.pointerType);
    const host = nativeHost(event);
    const capture = captureApiOf(event.target);
    if (pointerType === null || host === null || capture === null) return;
    const first = sample(event, pointerType);
    if (first === null) return;

    event.stopPropagation();
    capture.setPointerCapture(event.pointerId);

    const onCancel: EventListener = (nativeEvent) => {
      const pointer = pointerIdentity(nativeEvent);
      if (pointer === null) return;
      finish(pointer.pointerId, pointer.timestampMs, "cancel", false);
    };
    const onLostCapture: EventListener = (nativeEvent) => {
      const pointer = pointerIdentity(nativeEvent);
      if (pointer === null) return;
      finish(
        pointer.pointerId,
        pointer.timestampMs,
        "lost-capture",
        false,
      );
    };
    const active: ActivePointer = {
      pointerId: event.pointerId,
      pointerType,
      capture,
      host,
      onCancel,
      onLostCapture,
    };
    captureSlotRef.current.current = active;
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("lostpointercapture", onLostCapture);
    callbacksRef.current.onArcStart(first);
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const next = sample(event, active.pointerType);
    if (next !== null) callbacksRef.current.onArcMove(next);
  };

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    finish(event.pointerId, event.timeStamp, "release", true);
  };

  if (!orientationState.frontInteractive) return null;

  return (
    <mesh
      ref={meshRef}
      name="click-wheel-input"
      position={CLICK_WHEEL_INPUT_POSITION}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      renderOrder={-1}
    >
      <ringGeometry
        args={[
          CLICK_WHEEL_INPUT_RADII.inner,
          CLICK_WHEEL_INPUT_RADII.outer,
          128,
        ]}
      />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        colorWrite={false}
      />
    </mesh>
  );
}
