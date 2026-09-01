import {
  DynamicDrawUsage,
  type BufferAttribute,
  type BufferGeometry,
  Vector3,
} from "three";

import { PX_PER_MM } from "./layout";

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
  wheelMm: 0.08,
  selectMm: 0.36,
  wheelModel: 0.08 * PX_PER_MM,
  selectModel: 0.36 * PX_PER_MM,
});

/** Compact thumb footprint, wider along the ring than across its plastic. */
export const WHEEL_CONTACT_FOOTPRINT_MM = Object.freeze({
  radial: 5.5,
  tangential: 8,
});
export const WHEEL_CONTACT_FOOTPRINT_MODEL = Object.freeze({
  radial: WHEEL_CONTACT_FOOTPRINT_MM.radial * PX_PER_MM,
  tangential: WHEEL_CONTACT_FOOTPRINT_MM.tangential * PX_PER_MM,
});

export const CONTROL_RELEASE_MS = Object.freeze({
  wheel: 120,
  select: 96,
});

/** Consecutive non-advancing timestamps tolerated before a safety settle. */
export const CONTROL_STALLED_FRAME_LIMIT = 24;

export type ControlContact = {
  readonly x: number;
  readonly y: number;
};

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
  readonly requestFrame: (callback: FrameRequestCallback) => ControlPhysicsFrame;
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

/** C2 compact support: smooth at the contact centre and exactly zero at edge. */
export function compactContactWeight(distance: number, radius: number): number {
  if (!(radius > 0) || distance >= radius) return 0;
  const q = distance / radius;
  const base = 1 - q * q;
  return base * base * base;
}

/**
 * Applies one body-local thumb depression from immutable rest geometry.
 *
 * Positions move along each vertex's own rest normal. Normals use the analytic
 * gradient of the same compact displacement field projected into the local
 * tangent plane, so the travelling light response is coupled to the actual
 * surface instead of painted in UV or view space.
 */
export function deformWheelSurface(
  surface: BoundSurface,
  contact: ControlContact,
  depth: number,
  footprint = WHEEL_CONTACT_FOOTPRINT_MODEL,
): void {
  const p = surface.position.array;
  const n = surface.normal.array;
  const p0 = surface.restPosition;
  const n0 = surface.restNormal;
  const radialFootprintSq = footprint.radial * footprint.radial;
  const tangentialFootprintSq = footprint.tangential * footprint.tangential;
  const contactLength = Math.hypot(contact.x, contact.y);
  const radialX = contactLength === 0 ? 1 : contact.x / contactLength;
  const radialY = contactLength === 0 ? 0 : contact.y / contactLength;
  const tangentX = -radialY;
  const tangentY = radialX;
  const normal = new Vector3();
  const gradient = new Vector3();

  for (let index = 0; index < p.length; index += 3) {
    const px = componentAt(p0, index);
    const py = componentAt(p0, index + 1);
    const pz = componentAt(p0, index + 2);
    const dx = px - contact.x;
    const dy = py - contact.y;
    const radialDistance = dx * radialX + dy * radialY;
    const tangentialDistance = dx * tangentX + dy * tangentY;
    const normalizedDistanceSq =
      (radialDistance * radialDistance) / radialFootprintSq +
      (tangentialDistance * tangentialDistance) / tangentialFootprintSq;
    const base = Math.max(0, 1 - normalizedDistanceSq);
    const weight = base * base * base;
    const nx = componentAt(n0, index);
    const ny = componentAt(n0, index + 1);
    const nz = componentAt(n0, index + 2);

    p[index] = px - nx * depth * weight;
    p[index + 1] = py - ny * depth * weight;
    p[index + 2] = pz - nz * depth * weight;

    if (weight === 0 || normalizedDistanceSq === 0 || depth === 0) {
      n[index] = nx;
      n[index + 1] = ny;
      n[index + 2] = nz;
      continue;
    }

    // w=(1-q²)³ over an ellipse; this is its exact body-local gradient.
    const derivativeScale = -6 * base * base;
    gradient.set(
      derivativeScale *
        ((radialDistance * radialX) / radialFootprintSq +
          (tangentialDistance * tangentX) / tangentialFootprintSq),
      derivativeScale *
        ((radialDistance * radialY) / radialFootprintSq +
          (tangentialDistance * tangentY) / tangentialFootprintSq),
      0,
    );
    normal.set(nx, ny, nz);
    gradient.addScaledVector(normal, -gradient.dot(normal));
    normal.addScaledVector(gradient, depth).normalize();
    n[index] = normal.x;
    n[index + 1] = normal.y;
    n[index + 2] = normal.z;
  }
  markChanged(surface);
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
 * outside React render. The controller owns only transient mesh travel; state,
 * navigation, detents and feedback remain in their existing runtimes.
 */
export class ControlPhysicsController {
  readonly #dependencies: ControlPhysicsDependencies;
  readonly #wheel = channel();
  readonly #select = channel();
  #wheelContact: ControlContact = { x: 0, y: 0 };
  #frame: ControlPhysicsFrame | null = null;
  #reducedMotion = false;
  #disposed = false;

  constructor(dependencies: ControlPhysicsDependencies) {
    this.#dependencies = dependencies;
  }

  attachWheel(geometry: BufferGeometry): () => void {
    return this.#attach(this.#wheel, geometry);
  }

  attachSelect(geometry: BufferGeometry): () => void {
    return this.#attach(this.#select, geometry);
  }

  wheelContact(contact: ControlContact): void {
    if (this.#disposed) return;
    this.#wheel.release = null;
    this.#wheelContact = contact;
    this.#wheel.depth = CONTROL_TRAVEL.wheelModel;
    this.#renderWheel();
    this.#dependencies.invalidate();
    this.#cancelFrameWhenSettled();
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
      // BufferAttribute.needsUpdate uploads restored arrays, but a demand
      // canvas still needs one explicit render request to present them.
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
    if (
      progress >= 1 ||
      release.stalledFrames >= CONTROL_STALLED_FRAME_LIMIT
    ) {
      this.#settle(channelState);
      return true;
    }
    const remaining = 1 - progress;
    channelState.depth = release.initialDepth * remaining * remaining * remaining;
    return true;
  }

  #renderWheel(): void {
    if (this.#wheel.surface === null) return;
    if (this.#wheel.depth === 0) {
      restoreSurface(this.#wheel.surface);
      return;
    }
    deformWheelSurface(
      this.#wheel.surface,
      this.#wheelContact,
      this.#wheel.depth,
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
