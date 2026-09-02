import {
  type BufferAttribute,
  type BufferGeometry,
  DynamicDrawUsage,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";

import { WHEEL_OUTER_SEAM_WIDTH } from "./front-surface";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";

/**
 * Transient control travel, expressed in physical millimetres and converted
 * through the established 5G body scale.
 *
 * No surviving Apple service source publishes the 5G control travel. The
 * owner photographs establish the flush rest geometry, while these restrained
 * depths are visual calibration under the approved key/fill rig. They are not
 * presented as OEM dimensions.
 */
export const CONTROL_TRAVEL = Object.freeze({
  // Low-side rim travel for the rigid wheel rock. This is deliberately below
  // both the rejected 0.08 mm basin and rejected 0.03 mm whole-wheel shift.
  // It remains bounded visual calibration, not an OEM dimension.
  wheelMm: 0.018,
  selectMm: 0.36,
  wheelModel: 0.018 * PX_PER_MM,
  selectModel: 0.36 * PX_PER_MM,
});

const WHEEL_VISIBLE_RADIUS_MODEL =
  DEVICE_LAYOUT.wheel.outerR - WHEEL_OUTER_SEAM_WIDTH;

/** One rigid-disc tilt derived from its bounded low-side rim travel. */
export const WHEEL_TILT = Object.freeze({
  radiusModel: WHEEL_VISIBLE_RADIUS_MODEL,
  maxAngleRad: Math.asin(
    CONTROL_TRAVEL.wheelModel / WHEEL_VISIBLE_RADIUS_MODEL,
  ),
});

export const CONTROL_RELEASE_MS = Object.freeze({
  wheel: 120,
  select: 96,
});

/** Consecutive non-advancing timestamps tolerated before a safety settle. */
export const CONTROL_STALLED_FRAME_LIMIT = 24;

type MutableFloatAttribute = BufferAttribute & {
  readonly array: Float32Array;
};

type BoundSurface = {
  readonly geometry: BufferGeometry;
  readonly position: MutableFloatAttribute;
  readonly normal: MutableFloatAttribute;
  readonly restPosition: Float32Array;
  readonly restNormal: Float32Array;
};

type BoundRigidAssembly = {
  readonly object: Object3D;
  readonly restX: number;
  readonly restY: number;
  readonly restZ: number;
  readonly restQuaternion: Quaternion;
  readonly restScale: Vector3;
  readonly tiltAxis: Vector3;
  readonly tiltQuaternion: Quaternion;
};

type Release = {
  readonly startedAtMs: number;
  readonly initialDepth: number;
  readonly durationMs: number;
  lastTimestampMs: number;
  stalledFrames: number;
};

type Channel = {
  surface: BoundSurface | null;
  depth: number;
  release: Release | null;
};

export type ControlPhysicsFrame = number;

export type ControlPhysicsDependencies = {
  readonly invalidate: () => void;
  readonly now: () => number;
  readonly requestFrame: (
    callback: FrameRequestCallback,
  ) => ControlPhysicsFrame;
  readonly cancelFrame: (frame: ControlPhysicsFrame) => void;
};

function mutableFloatAttribute(
  geometry: BufferGeometry,
  name: "position" | "normal",
): MutableFloatAttribute {
  const attribute = geometry.getAttribute(name);
  if (!(attribute.array instanceof Float32Array) || attribute.itemSize !== 3) {
    throw new Error(`control physics requires a Float32 ${name} attribute`);
  }
  return attribute as MutableFloatAttribute;
}

function bindSurface(geometry: BufferGeometry): BoundSurface {
  const position = mutableFloatAttribute(geometry, "position");
  const normal = mutableFloatAttribute(geometry, "normal");
  position.setUsage(DynamicDrawUsage);
  normal.setUsage(DynamicDrawUsage);
  return {
    geometry,
    position,
    normal,
    restPosition: position.array.slice(),
    restNormal: normal.array.slice(),
  };
}

function markChanged(surface: BoundSurface): void {
  surface.position.needsUpdate = true;
  surface.normal.needsUpdate = true;
}

function componentAt(array: Float32Array, index: number): number {
  const value = array[index];
  if (value === undefined) {
    throw new Error("control physics attribute triplet is incomplete");
  }
  return value;
}

function restoreSurface(surface: BoundSurface): void {
  surface.position.array.set(surface.restPosition);
  surface.normal.array.set(surface.restNormal);
  markChanged(surface);
}

function bindRigidAssembly(object: Object3D): BoundRigidAssembly {
  return {
    object,
    restX: object.position.x,
    restY: object.position.y,
    restZ: object.position.z,
    restQuaternion: object.quaternion.clone(),
    restScale: object.scale.clone(),
    tiltAxis: new Vector3(),
    tiltQuaternion: new Quaternion(),
  };
}

function normalizeAngleDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

function tiltRigidAssembly(
  assembly: BoundRigidAssembly,
  lowSideTravel: number,
  contactAngleDeg: number,
): void {
  const boundedTravel = Math.max(
    0,
    Math.min(lowSideTravel, CONTROL_TRAVEL.wheelModel),
  );
  const tiltAngle = Math.asin(boundedTravel / WHEEL_TILT.radiusModel);
  const contactAngleRad =
    (normalizeAngleDeg(contactAngleDeg) * Math.PI) / 180;
  // Clockwise wheel angle maps to (cos θ, -sin θ). The in-plane axis
  // perpendicular to that radius makes that exact contact side the low side.
  assembly.tiltAxis.set(
    Math.sin(contactAngleRad),
    Math.cos(contactAngleRad),
    0,
  );
  assembly.tiltQuaternion.setFromAxisAngle(assembly.tiltAxis, tiltAngle);
  assembly.object.position.set(
    assembly.restX,
    assembly.restY,
    assembly.restZ,
  );
  assembly.object.quaternion
    .copy(assembly.restQuaternion)
    .multiply(assembly.tiltQuaternion)
    .normalize();
  assembly.object.scale.copy(assembly.restScale);
  assembly.object.updateMatrix();
}

function restoreRigidAssembly(assembly: BoundRigidAssembly): void {
  assembly.object.position.set(assembly.restX, assembly.restY, assembly.restZ);
  assembly.object.quaternion.copy(assembly.restQuaternion);
  assembly.object.scale.copy(assembly.restScale);
  assembly.object.updateMatrix();
}

/** Uniform Select travel still follows every vertex's curved local normal. */
export function deformSelectSurface(
  surface: BoundSurface,
  depth: number,
): void {
  const p = surface.position.array;
  const n = surface.normal.array;
  const p0 = surface.restPosition;
  const n0 = surface.restNormal;
  for (let index = 0; index < p.length; index += 3) {
    const px = componentAt(p0, index);
    const py = componentAt(p0, index + 1);
    const pz = componentAt(p0, index + 2);
    const nx = componentAt(n0, index);
    const ny = componentAt(n0, index + 1);
    const nz = componentAt(n0, index + 2);
    p[index] = px - nx * depth;
    p[index + 1] = py - ny * depth;
    p[index + 2] = pz - nz * depth;
    n[index] = nx;
    n[index + 1] = ny;
    n[index + 2] = nz;
  }
  markChanged(surface);
}

function channel(): Channel {
  return { surface: null, depth: 0, release: null };
}

/**
 * Imperative because pointer callbacks and R3F demand rendering both live
 * outside React render. The controller owns only transient physical travel;
 * state, navigation, detents and feedback remain in their existing runtimes.
 */
export class ControlPhysicsController {
  readonly #dependencies: ControlPhysicsDependencies;
  readonly #wheel = channel();
  readonly #select = channel();
  #wheelAssembly: BoundRigidAssembly | null = null;
  #frame: ControlPhysicsFrame | null = null;
  #reducedMotion = false;
  #disposed = false;
  #wheelAngleDeg = 0;

  constructor(dependencies: ControlPhysicsDependencies) {
    this.#dependencies = dependencies;
  }

  attachWheel(assemblyObject: Object3D): () => void {
    if (this.#wheelAssembly !== null) {
      restoreRigidAssembly(this.#wheelAssembly);
    }
    const assembly = bindRigidAssembly(assemblyObject);
    this.#wheelAssembly = assembly;
    this.#wheel.depth = 0;
    this.#wheel.release = null;
    this.#wheelAngleDeg = 0;
    this.#cancelFrameWhenSettled();
    return () => {
      if (this.#wheelAssembly !== assembly) return;
      restoreRigidAssembly(assembly);
      this.#wheelAssembly = null;
      this.#wheel.depth = 0;
      this.#wheel.release = null;
      this.#wheelAngleDeg = 0;
      this.#cancelFrameWhenSettled();
    };
  }

  attachSelect(geometry: BufferGeometry): () => void {
    return this.#attach(this.#select, geometry);
  }

  pressWheel(contactAngleDeg: number): void {
    if (this.#disposed || !Number.isFinite(contactAngleDeg)) return;
    this.#wheel.release = null;
    this.#wheelAngleDeg = normalizeAngleDeg(contactAngleDeg);
    this.#wheel.depth = CONTROL_TRAVEL.wheelModel;
    this.#renderWheel();
    this.#dependencies.invalidate();
    this.#cancelFrameWhenSettled();
  }

  moveWheel(contactAngleDeg: number): void {
    if (
      this.#disposed ||
      this.#wheel.depth === 0 ||
      !Number.isFinite(contactAngleDeg)
    )
      return;
    const nextAngle = normalizeAngleDeg(contactAngleDeg);
    if (nextAngle === this.#wheelAngleDeg) return;
    this.#wheelAngleDeg = nextAngle;
    this.#renderWheel();
    this.#dependencies.invalidate();
  }

  releaseWheel(): void {
    this.#release(this.#wheel, CONTROL_RELEASE_MS.wheel);
  }

  pressSelect(): void {
    if (this.#disposed) return;
    this.#select.release = null;
    this.#select.depth = CONTROL_TRAVEL.selectModel;
    this.#renderSelect();
    this.#dependencies.invalidate();
    this.#cancelFrameWhenSettled();
  }

  releaseSelect(): void {
    this.#release(this.#select, CONTROL_RELEASE_MS.select);
  }

  setReducedMotion(reduced: boolean): void {
    this.#reducedMotion = reduced;
    if (!reduced) return;
    const wheelWasReleasing = this.#wheel.release !== null;
    const selectWasReleasing = this.#select.release !== null;
    if (wheelWasReleasing) this.#settle(this.#wheel);
    if (selectWasReleasing) this.#settle(this.#select);
    if (wheelWasReleasing || selectWasReleasing) {
      // Restoring either geometry or an object transform still needs one
      // explicit demand render to present the exact rest state.
      this.#dependencies.invalidate();
    }
    this.#cancelFrameWhenSettled();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#frame !== null) this.#dependencies.cancelFrame(this.#frame);
    this.#frame = null;
    this.#settle(this.#wheel);
    this.#settle(this.#select);
  }

  #attach(channelState: Channel, geometry: BufferGeometry): () => void {
    if (channelState.surface !== null) restoreSurface(channelState.surface);
    const surface = bindSurface(geometry);
    channelState.surface = surface;
    channelState.depth = 0;
    channelState.release = null;
    this.#cancelFrameWhenSettled();
    return () => {
      if (channelState.surface !== surface) return;
      restoreSurface(surface);
      channelState.surface = null;
      channelState.depth = 0;
      channelState.release = null;
      this.#cancelFrameWhenSettled();
    };
  }

  #release(channelState: Channel, durationMs: number): void {
    if (this.#disposed || channelState.depth === 0) return;
    if (this.#reducedMotion) {
      this.#settle(channelState);
      this.#dependencies.invalidate();
      this.#cancelFrameWhenSettled();
      return;
    }
    const startedAtMs = this.#dependencies.now();
    channelState.release = {
      startedAtMs,
      initialDepth: channelState.depth,
      durationMs,
      lastTimestampMs: startedAtMs,
      stalledFrames: 0,
    };
    this.#requestFrame();
  }

  #requestFrame(): void {
    if (this.#frame !== null || this.#disposed) return;
    this.#frame = this.#dependencies.requestFrame(this.#onFrame);
  }

  readonly #onFrame: FrameRequestCallback = (timestampMs) => {
    this.#frame = null;
    if (this.#disposed) return;
    const wheelChanging = this.#advance(this.#wheel, timestampMs);
    const selectChanging = this.#advance(this.#select, timestampMs);
    if (wheelChanging) this.#renderWheel();
    if (selectChanging) this.#renderSelect();
    if (wheelChanging || selectChanging) this.#dependencies.invalidate();
    if (this.#wheel.release !== null || this.#select.release !== null) {
      this.#requestFrame();
    }
  };

  #advance(channelState: Channel, timestampMs: number): boolean {
    const release = channelState.release;
    if (release === null) return false;
    const timestampAdvanced =
      Number.isFinite(timestampMs) && timestampMs > release.lastTimestampMs;
    if (timestampAdvanced) {
      release.lastTimestampMs = timestampMs;
      release.stalledFrames = 0;
    } else {
      release.stalledFrames += 1;
    }
    const elapsed = Number.isFinite(timestampMs)
      ? Math.max(0, timestampMs - release.startedAtMs)
      : 0;
    const progress = Math.min(1, elapsed / release.durationMs);
    if (progress >= 1 || release.stalledFrames >= CONTROL_STALLED_FRAME_LIMIT) {
      this.#settle(channelState);
      return true;
    }
    const remaining = 1 - progress;
    channelState.depth =
      release.initialDepth * remaining * remaining * remaining;
    return true;
  }

  #renderWheel(): void {
    if (this.#wheelAssembly === null) return;
    tiltRigidAssembly(
      this.#wheelAssembly,
      this.#wheel.depth,
      this.#wheelAngleDeg,
    );
  }

  #renderSelect(): void {
    if (this.#select.surface === null) return;
    if (this.#select.depth === 0) {
      restoreSurface(this.#select.surface);
      return;
    }
    deformSelectSurface(this.#select.surface, this.#select.depth);
  }

  #settle(channelState: Channel): void {
    channelState.depth = 0;
    channelState.release = null;
    if (channelState.surface !== null) restoreSurface(channelState.surface);
    if (channelState === this.#wheel) {
      if (this.#wheelAssembly !== null) {
        restoreRigidAssembly(this.#wheelAssembly);
      }
    }
  }

  #cancelFrameWhenSettled(): void {
    if (
      this.#frame === null ||
      this.#wheel.release !== null ||
      this.#select.release !== null
    )
      return;
    this.#dependencies.cancelFrame(this.#frame);
    this.#frame = null;
  }
}
