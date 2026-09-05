import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import {
  Mesh,
  Plane,
  Ray,
  Vector3,
  type Raycaster,
  type Intersection,
} from "three";

import { completeDeviceEnvelope } from "./device-envelope";
import { deviceOrientationToRotation } from "./orientation";
import { DEVICE_LAYOUT } from "./layout";
import { useControlPhysics } from "./ControlPhysicsScope";
import { DeviceCanvasOrientationContext } from "./DeviceCanvas";
import { setDeviceControlCursor } from "./cursor-intent";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  DEFAULT_FRONT_ASSEMBLY_DEPTHS,
  resolveFrontAssemblyDepths,
  frontShellOffsetAt,
  SELECT_CONCAVITY,
} from "./front-surface";

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

type WheelLocalPoint = {
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
  readonly radius: number;
  readonly z: number;
};

type CardinalCandidate = {
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
function raycastWheelRing(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
  raycastWheelRegion(this, raycaster, hits, false);
}
function raycastWheelSelect(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
  raycastWheelRegion(this, raycaster, hits, true);
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
 * Browser panning suppression belongs to the application boundary's
 * `touch-action`, not R3F's delegated pointer callbacks: those callbacks may
 * run under a passive native listener where preventDefault() is illegal.
 */
export function ClickWheelInputSurface({
  onArcStart,
  onArcMove,
  onArcEnd,
  onSelectStart,
  onSelectEnd,
  onCardinalPress,
  onCardinalStart,
  onCardinalEnd,
}: ClickWheelInputSurfaceProps) {
  const canvas = useThree((state) => state.gl.domElement);
  const orientationState = useContext(DeviceCanvasOrientationContext);
  const controlPhysics = useControlPhysics();
  const inputPosition = useMemo(
    () => clickWheelInputPosition(orientationState.form),
    [orientationState.form],
  );
  const envelope = useMemo(() => completeDeviceEnvelope(orientationState.form), [orientationState.form]);
  const meshRef = useRef<Mesh>(null);
  const keyboardSelectRef = useRef(false);
  const captureSlotRef = useRef<ClickWheelCaptureSlot>(
    createClickWheelCaptureSlot(),
  );
  const cardinalCandidateRef = useRef<CardinalCandidate | null>(null);
  const cardinalContactRef = useRef<CardinalCandidate | null>(null);
  const rotationOriginRef = useRef<ClickWheelArcSample | null>(null);
  const arcStartedRef = useRef(false);
  const callbacksRef = useRef({
    onArcStart,
    onArcMove,
    onArcEnd,
    onCardinalPress,
    onCardinalStart,
    onCardinalEnd,
  });
  useEffect(() => {
    callbacksRef.current = {
      onArcStart,
      onArcMove,
      onArcEnd,
      onCardinalPress,
      onCardinalStart,
      onCardinalEnd,
    };
  }, [
    onArcEnd,
    onArcMove,
    onArcStart,
    onCardinalEnd,
    onCardinalPress,
    onCardinalStart,
  ]);
  useEffect(() => () => setDeviceControlCursor(canvas, false), [canvas]);

  useEffect(() => {
    if (controlPhysics === null || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.repeat ||
        keyboardSelectRef.current ||
        !(event.target instanceof Element) ||
        event.target.getAttribute("role") !== "application"
      )
        return;
      keyboardSelectRef.current = true;
      controlPhysics.pressSelect();
    };
    const release = () => {
      if (!keyboardSelectRef.current) return;
      keyboardSelectRef.current = false;
      controlPhysics.releaseSelect();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Enter") release();
    };
    const onVisibilityChange = () => {
      if (document.hidden) release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [controlPhysics]);

  const finish = (
    pointerId: number,
    timestampMs: number,
    reason: ClickWheelArcEnd["reason"],
    releaseCapture: boolean,
    releasePoint: WheelLocalPoint | null = null,
  ) => {
    const candidate = cardinalCandidateRef.current;
    const contact = cardinalContactRef.current;
    cardinalCandidateRef.current = null;
    cardinalContactRef.current = null;
    rotationOriginRef.current = null;
    const arcStarted = arcStartedRef.current;
    arcStartedRef.current = false;
    const acceptedCardinal =
      reason === "release" &&
      candidate?.pointerId === pointerId &&
      releasePoint !== null &&
      cardinalButtonAtWheelPoint(releasePoint.x, releasePoint.y) ===
        candidate.button &&
      Math.hypot(
        releasePoint.x - candidate.startX,
        releasePoint.y - candidate.startY,
      ) <= CLICK_WHEEL_CARDINAL_SLOP
        ? candidate
        : null;
    const ended = finishClickWheelCapture(
      captureSlotRef.current,
      pointerId,
      timestampMs,
      reason,
      releaseCapture,
      (end) => {
        controlPhysics?.releaseWheel();
        if (arcStarted) callbacksRef.current.onArcEnd(end);
      },
    );
    if (ended && contact?.pointerId === pointerId) {
      callbacksRef.current.onCardinalEnd?.({
        pointerId,
        pointerType: contact.pointerType,
        button: contact.button,
        timestampMs,
        reason,
        accepted: acceptedCardinal !== null,
      });
    }
    if (ended && acceptedCardinal !== null) {
      callbacksRef.current.onCardinalPress?.({
        pointerId,
        pointerType: acceptedCardinal.pointerType,
        button: acceptedCardinal.button,
        timestampMs,
      });
    }
  };

  const cancelAfterCallbackError = (
    pointerId: number,
    timestampMs: number,
    error: unknown,
  ): never => {
    try {
      finish(pointerId, timestampMs, "cancel", true);
    } catch {
      // Capture/listener cleanup happens before onArcEnd. Preserve the first
      // callback failure if a secondary cancellation callback also throws.
    }
    throw error;
  };

  useEffect(
    () => () => {
      const active = captureSlotRef.current.current;
      if (active === null) return;
      const contact = cardinalContactRef.current;
      cardinalCandidateRef.current = null;
      cardinalContactRef.current = null;
      rotationOriginRef.current = null;
      const arcStarted = arcStartedRef.current;
      arcStartedRef.current = false;
      const ended = finishClickWheelCapture(
        captureSlotRef.current,
        active.pointerId,
        performance.now(),
        "cancel",
        true,
        (end) => {
          controlPhysics?.releaseWheel();
          if (arcStarted) callbacksRef.current.onArcEnd(end);
        },
      );
      if (ended && contact?.pointerId === active.pointerId) {
        callbacksRef.current.onCardinalEnd?.({
          pointerId: active.pointerId,
          pointerType: contact.pointerType,
          button: contact.button,
          timestampMs: performance.now(),
          reason: "cancel",
          accepted: false,
        });
      }
    },
    [controlPhysics],
  );

  const point = (
    event: ThreeEvent<PointerEvent>,
  ): WheelLocalPoint | null => {
    const mesh = meshRef.current;
    if (mesh === null) return null;
    return wheelPointFromRay(mesh, event.ray);
  };

  const sample = (
    event: ThreeEvent<PointerEvent>,
    pointerType: ClickWheelPointerType,
  ): ClickWheelArcSample | null => {
    const local = point(event);
    if (local === null) return null;
    return {
      pointerId: event.pointerId,
      pointerType,
      angleDeg: local.angleDeg,
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
    const firstPoint = point(event);
    if (first === null || firstPoint === null) return;
    // RingGeometry includes its inner edge in ray hits. The semantic contract
    // gives that shared r=37 edge to Select, so let the coincident center hit
    // continue through R3F instead of turning a mapper-null point into an arc.
    if (firstPoint.radius <= CLICK_WHEEL_INPUT_RADII.inner) return;

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
    const blurHost = typeof window === "undefined" ? undefined : window;
    const onBlur: EventListener = () => {
      finish(event.pointerId, performance.now(), "cancel", true);
    };
    const active: ActivePointer = {
      pointerId: event.pointerId,
      pointerType,
      capture,
      host,
      onCancel,
      onLostCapture,
      blurHost,
      onBlur,
    };
    captureSlotRef.current.current = active;
    const cardinalButton = cardinalButtonAtWheelPoint(
      firstPoint.x,
      firstPoint.y,
    );
    cardinalCandidateRef.current =
      cardinalButton === null
        ? null
        : {
            pointerId: event.pointerId,
            pointerType,
            button: cardinalButton,
            startX: firstPoint.x,
            startY: firstPoint.y,
          };
    cardinalContactRef.current = cardinalCandidateRef.current;
    rotationOriginRef.current = first;
    arcStartedRef.current = cardinalButton === null;
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("lostpointercapture", onLostCapture);
    blurHost?.addEventListener("blur", onBlur);
    controlPhysics?.pressWheel(first.angleDeg);
    try {
      if (cardinalButton !== null) {
        callbacksRef.current.onCardinalStart?.({
          pointerId: event.pointerId,
          pointerType,
          button: cardinalButton,
          timestampMs: event.timeStamp,
        });
      }
      if (cardinalButton === null) callbacksRef.current.onArcStart(first);
    } catch (error) {
      cancelAfterCallbackError(event.pointerId, event.timeStamp, error);
    }
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const next = sample(event, active.pointerType);
    const nextPoint = point(event);
    const candidate = cardinalCandidateRef.current;
    const cancelsCardinal =
      candidate?.pointerId === event.pointerId &&
      (nextPoint === null ||
        cardinalButtonAtWheelPoint(nextPoint.x, nextPoint.y) !==
          candidate.button ||
        Math.hypot(
          nextPoint.x - candidate.startX,
          nextPoint.y - candidate.startY,
        ) > CLICK_WHEEL_CARDINAL_SLOP);
    if (cancelsCardinal) {
      cardinalCandidateRef.current = null;
    }
    if (next !== null && cardinalCandidateRef.current === null) {
      controlPhysics?.moveWheel(next.angleDeg);
      try {
        if (!arcStartedRef.current) {
          const origin = rotationOriginRef.current;
          if (origin === null) return;
          arcStartedRef.current = true;
          callbacksRef.current.onArcStart(origin);
        }
        callbacksRef.current.onArcMove(next);
      } catch (error) {
        cancelAfterCallbackError(event.pointerId, event.timeStamp, error);
      }
    }
  };

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    finish(
      event.pointerId,
      event.timeStamp,
      "release",
      true,
      point(event),
    );
  };

  if (!orientationState.frontInteractive) return null;

  return (
    <group name="click-wheel-input-pose" rotation={deviceOrientationToRotation(orientationState.orientation)}>
      <group position={[-envelope.center[0], -envelope.center[1], -envelope.center[2]]}>
      <mesh
        ref={meshRef}
        name="click-wheel-input"
        raycast={raycastWheelRing}
        userData={{ wheelSurfaceForm: orientationState.form }}
        position={inputPosition}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={() => setDeviceControlCursor(canvas, true)}
        onPointerOut={() => setDeviceControlCursor(canvas, false)}
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
      <SelectInputSurface
        position={inputPosition}
        form={orientationState.form}
        onSelectStart={onSelectStart}
        onSelectEnd={onSelectEnd}
        canvas={canvas}
      />
      </group>
    </group>
  );
}

function SelectInputSurface({
  position,
  form,
  onSelectStart,
  onSelectEnd,
  canvas,
}: {
  readonly position: readonly [number, number, number];
  readonly form: DeviceFormParams;
  readonly onSelectStart: ((start: ClickWheelSelectStart) => void) | undefined;
  readonly onSelectEnd: ((end: ClickWheelSelectEnd) => void) | undefined;
  readonly canvas: HTMLCanvasElement;
}) {
  const controlPhysics = useControlPhysics();
  const captureSlotRef = useRef<ClickWheelCaptureSlot>(
    createClickWheelCaptureSlot(),
  );
  const callbacksRef = useRef({ onSelectStart, onSelectEnd });
  useEffect(() => {
    callbacksRef.current = { onSelectStart, onSelectEnd };
  }, [onSelectEnd, onSelectStart]);
  useEffect(() => () => setDeviceControlCursor(canvas, false), [canvas]);

  const finish = (
    pointerId: number,
    timestampMs: number,
    reason: ClickWheelSelectEnd["reason"],
    releaseCapture: boolean,
  ) => {
    finishClickWheelCapture(
      captureSlotRef.current,
      pointerId,
      timestampMs,
      reason,
      releaseCapture,
      (end) => {
        controlPhysics?.releaseSelect();
        callbacksRef.current.onSelectEnd?.(end);
      },
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
        (end) => {
          controlPhysics?.releaseSelect();
          callbacksRef.current.onSelectEnd?.(end);
        },
      );
    },
    [controlPhysics],
  );

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
      finish(pointer.pointerId, pointer.timestampMs, "lost-capture", false);
    };
    const blurHost = typeof window === "undefined" ? undefined : window;
    const onBlur: EventListener = () => {
      finish(event.pointerId, performance.now(), "cancel", true);
    };
    captureSlotRef.current.current = {
      pointerId: event.pointerId,
      pointerType,
      capture,
      host,
      onCancel,
      onLostCapture,
      blurHost,
      onBlur,
    };
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("lostpointercapture", onLostCapture);
    blurHost?.addEventListener("blur", onBlur);
    controlPhysics?.pressSelect();
    try {
      callbacksRef.current.onSelectStart?.({
        pointerId: event.pointerId,
        pointerType,
        timestampMs: event.timeStamp,
      });
    } catch (error) {
      try {
        finish(event.pointerId, event.timeStamp, "cancel", true);
      } catch {
        // Cleanup precedes the secondary callback, so retain the first error.
      }
      throw error;
    }
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
  };

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const active = captureSlotRef.current.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    finish(event.pointerId, event.timeStamp, "release", true);
  };

  return (
    <mesh
      name="click-wheel-select-input"
      raycast={raycastWheelSelect}
      userData={{ wheelSurfaceForm: form }}
      position={position}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={() => setDeviceControlCursor(canvas, true)}
      onPointerOut={() => setDeviceControlCursor(canvas, false)}
      renderOrder={-1}
    >
      <circleGeometry args={[CLICK_WHEEL_INPUT_RADII.inner, 128]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        colorWrite={false}
      />
    </mesh>
  );
}
