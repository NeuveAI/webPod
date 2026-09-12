import type { DeviceMotionBinding } from './device-motion-authority';
import type { RenderCommand, RenderMotionProgram } from './device-render-protocol';
import {markStickerAssemblyChanged} from './sticker-assembly-revision';
import {
  type Object3D,
  Quaternion,
  Vector3,
} from "three";

import { CONTROL_TRAVEL, WHEEL_TILT, CONTROL_RELEASE_MS, advanceControlRelease } from './control-motion';
export { CONTROL_TRAVEL, WHEEL_TILT, CONTROL_RELEASE_MS, CONTROL_STALLED_FRAME_LIMIT } from './control-motion';

type BoundRigidAssembly = {
  readonly object: Object3D;
  readonly restX: number;
  readonly restY: number;
  readonly restZ: number;
  readonly restQuaternion: Quaternion;
  readonly restScale: Vector3;
  readonly restMatrixAutoUpdate: boolean;
  readonly tiltAxis: Vector3;
  readonly tiltQuaternion: Quaternion;
};

type BoundAxialControl = {
  readonly object: Object3D;
  readonly restX: number;
  readonly restY: number;
  readonly restZ: number;
  readonly restQuaternion: Quaternion;
  readonly restScale: Vector3;
  readonly restMatrixAutoUpdate: boolean;
};

type Release = {
  readonly startedAtMs: number;
  readonly initialDepth: number;
  readonly durationMs: number;
  lastTimestampMs: number;
  stalledFrames: number;
};

type Channel = {
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

function bindRigidAssembly(object: Object3D): BoundRigidAssembly {
  return {
    object,
    restX: object.position.x,
    restY: object.position.y,
    restZ: object.position.z,
    restQuaternion: object.quaternion.clone(),
    restScale: object.scale.clone(),
    restMatrixAutoUpdate: object.matrixAutoUpdate,
    tiltAxis: new Vector3(),
    tiltQuaternion: new Quaternion(),
  };
}

function bindAxialControl(object: Object3D): BoundAxialControl {
  return {
    object,
    restX: object.position.x,
    restY: object.position.y,
    restZ: object.position.z,
    restQuaternion: object.quaternion.clone(),
    restScale: object.scale.clone(),
    restMatrixAutoUpdate: object.matrixAutoUpdate,
  };
}

function translateAxialControl(control: BoundAxialControl, depth: number): void {
  control.object.position.set(control.restX, control.restY, control.restZ - depth);
  control.object.quaternion.copy(control.restQuaternion);
  control.object.scale.copy(control.restScale);
  control.object.matrixAutoUpdate = control.restMatrixAutoUpdate;
  control.object.updateMatrix();
  markStickerAssemblyChanged(control.object);
}

function restoreAxialControl(control: BoundAxialControl): void {
  translateAxialControl(control, 0);
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
  assembly.object.matrixAutoUpdate = assembly.restMatrixAutoUpdate;
  assembly.object.updateMatrix();
  markStickerAssemblyChanged(assembly.object);
}

function restoreRigidAssembly(assembly: BoundRigidAssembly): void {
  assembly.object.position.set(assembly.restX, assembly.restY, assembly.restZ);
  assembly.object.quaternion.copy(assembly.restQuaternion);
  assembly.object.scale.copy(assembly.restScale);
  assembly.object.matrixAutoUpdate = assembly.restMatrixAutoUpdate;
  assembly.object.updateMatrix();
  markStickerAssemblyChanged(assembly.object);
}

function channel(): Channel {
  return { depth: 0, release: null };
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
  #selectControl: BoundAxialControl | null = null;
  #frame: ControlPhysicsFrame | null = null;
  #reducedMotion = false;
  #disposed = false;
  #wheelAngleDeg = 0;
  #lastRemotePoseSequence = -1;
  #motionBinding: DeviceMotionBinding | null = null;
  #motionUnsubscribe: (() => void) | null = null;
  readonly #remoteReleases = new Map<'wheel' | 'select', number>();

  constructor(dependencies: ControlPhysicsDependencies) {
    this.#dependencies = dependencies;
  }

  /** Attaches the complete renderer's shared reliable command owner. Main
   * press/query transforms remain synchronous; only released travel migrates.
   * Detach restores exact rest and retires old replies without replaying input. */
  attachMotion(binding: DeviceMotionBinding): () => void {
    this.#motionUnsubscribe?.();
    this.#settle(this.#wheel); this.#settle(this.#select);
    this.#motionBinding = binding;
    this.#lastRemotePoseSequence = -1;
    this.#remoteReleases.clear();
    const unsubscribe = binding.subscribe(response => {
      if (this.#motionBinding !== binding || this.#disposed) return;
      if (response.type === 'projection') {
        if (this.#remoteReleases.size === 0 || response.projection.pose.sequence <= this.#lastRemotePoseSequence) return;
        this.#lastRemotePoseSequence = response.projection.pose.sequence;
        for (const [channel, sequence] of this.#remoteReleases) {
          if (response.projection.pose.lastAcceptedCommand < sequence) continue;
          const object = channel === 'wheel' ? this.#wheelAssembly?.object : this.#selectControl?.object;
          const node = response.projection.pose.nodes.find(node => node.id === (channel === 'wheel' ? 'wheel-assembly' : 'select'));
          if (object && node) {
            object.matrix.fromArray(node.matrix);
            // Preserve the submitted matrix exactly for immediate queries;
            // rest/press paths restore authored components and auto-update.
            object.matrixAutoUpdate = false;
            markStickerAssemblyChanged(object);
          }
        }
        this.#dependencies.invalidate();
      } else if (response.type === 'command-settled' || response.type === 'command-rejected') {
        for (const [channel, sequence] of this.#remoteReleases) {
          if (sequence !== response.commandSequence) continue;
          this.#remoteReleases.delete(channel);
          this.#settle(channel === 'wheel' ? this.#wheel : this.#select);
          this.#dependencies.invalidate();
        }
      }
    });
    this.#motionUnsubscribe = unsubscribe;
    return () => {
      unsubscribe();
      if (this.#motionBinding !== binding) return;
      this.#motionBinding = null; this.#motionUnsubscribe = null;
      this.#remoteReleases.clear();
      this.#settle(this.#wheel); this.#settle(this.#select);
      this.#dependencies.invalidate();
    };
  }

  #motionPose(binding: DeviceMotionBinding) {
    const current = binding.read();
    return {...current, nodes: current.nodes.map(node => {
      const object = node.id === 'wheel-assembly' ? this.#wheelAssembly?.object : node.id === 'select' ? this.#selectControl?.object : undefined;
      return object ? {...node, matrix: object.matrix.toArray()} : node;
    })};
  }

  #sendMotion(binding: DeviceMotionBinding, command: RenderCommand): boolean {
    try { binding.sendCommand(command); return true; } catch {
      if (this.#motionBinding === binding) {
        this.#motionUnsubscribe?.(); this.#motionUnsubscribe = null; this.#motionBinding = null;
        this.#remoteReleases.clear();
        this.#settle(this.#wheel); this.#settle(this.#select);
        this.#dependencies.invalidate();
      }
      return false;
    }
  }

  #remotePress(channel: 'wheel' | 'select'): void {
    const binding = this.#motionBinding;
    this.#remoteReleases.delete(channel);
    if (!binding) return;
    const pose = this.#motionPose(binding);
    const command: RenderCommand = {kind: 'control-down', button: channel === 'select' ? 'center' : 'menu',
      timestampMs: performance.timeOrigin + this.#dependencies.now(), commandSequence: binding.nextCommandSequence(), motionEpoch: pose.motionEpoch, pose};
    this.#sendMotion(binding, command);
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

  attachSelect(object: Object3D): () => void {
    if (this.#selectControl !== null) restoreAxialControl(this.#selectControl);
    const control = bindAxialControl(object);
    this.#selectControl = control;
    this.#select.depth = 0;
    this.#select.release = null;
    this.#cancelFrameWhenSettled();
    return () => {
      if (this.#selectControl !== control) return;
      restoreAxialControl(control);
      this.#selectControl = null;
      this.#select.depth = 0;
      this.#select.release = null;
      this.#cancelFrameWhenSettled();
    };
  }

  pressWheel(contactAngleDeg: number): void {
    if (this.#disposed || !Number.isFinite(contactAngleDeg)) return;
    this.#wheel.release = null;
    this.#wheelAngleDeg = normalizeAngleDeg(contactAngleDeg);
    this.#wheel.depth = CONTROL_TRAVEL.wheelModel;
    this.#renderWheel();
    this.#remotePress('wheel');
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
    if (!this.#remoteReleases.has('wheel')) this.#renderWheel();
    const binding = this.#motionBinding;
    if (binding) {
      const pose = this.#motionPose(binding);
      this.#sendMotion(binding, {kind: 'control-contact', contactAngleDeg: nextAngle,
        timestampMs: performance.timeOrigin + this.#dependencies.now(), commandSequence: binding.nextCommandSequence(), motionEpoch: pose.motionEpoch, pose});
    }
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
    this.#remotePress('select');
    this.#dependencies.invalidate();
    this.#cancelFrameWhenSettled();
  }

  releaseSelect(): void {
    this.#release(this.#select, CONTROL_RELEASE_MS.select);
  }

  setReducedMotion(reduced: boolean): void {
    this.#reducedMotion = reduced;
    const binding = this.#motionBinding;
    if (binding) {
      const pose = this.#motionPose(binding);
      this.#sendMotion(binding, {kind: 'reduced-motion', enabled: reduced, commandSequence: binding.nextCommandSequence(), motionEpoch: pose.motionEpoch, pose});
    }
    if (!reduced) return;
    if (this.#remoteReleases.size > 0) {
      for (const channel of this.#remoteReleases.keys()) this.#settle(channel === 'wheel' ? this.#wheel : this.#select);
      this.#remoteReleases.clear();
      this.#dependencies.invalidate();
    }
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
    this.#motionUnsubscribe?.(); this.#motionUnsubscribe = null; this.#motionBinding = null; this.#remoteReleases.clear();
    if (this.#frame !== null) this.#dependencies.cancelFrame(this.#frame);
    this.#frame = null;
    this.#settle(this.#wheel);
    this.#settle(this.#select);
  }

  #release(channelState: Channel, durationMs: number): void {
    if (this.#disposed || channelState.depth === 0) return;
    if (this.#reducedMotion) {
      this.#settle(channelState);
      this.#dependencies.invalidate();
      this.#cancelFrameWhenSettled();
      return;
    }
    const binding = this.#motionBinding;
    const channel = channelState === this.#wheel ? 'wheel' : 'select';
    const control = channel === 'wheel' ? this.#wheelAssembly : this.#selectControl;
    if (binding && control) {
      const pose = this.#motionPose(binding);
      const commandSequence = binding.nextCommandSequence();
      const startedAtTimestampMs = performance.timeOrigin + this.#dependencies.now();
      const restPosition: [number, number, number] = [control.restX, control.restY, control.restZ];
      const restMatrix = control.object.matrix.clone().compose(new Vector3(...restPosition), control.restQuaternion, control.restScale).toArray();
      const program: RenderMotionProgram = {kind: 'control-release', channel, nodeId: channel === 'wheel' ? 'wheel-assembly' : 'select',
        origin: {commandSequence, motionEpoch: pose.motionEpoch}, restPosition, restQuaternion: control.restQuaternion.toArray(), restScale: control.restScale.toArray(), restMatrix,
        contactAngleDeg: this.#wheelAngleDeg, initialDepth: channelState.depth, durationMs, startedAtTimestampMs, lastTimestampMs: startedAtTimestampMs, stalledFrames: 0};
      this.#remoteReleases.set(channel, commandSequence);
      channelState.release = null;
      this.#sendMotion(binding, {kind: 'motion-start', commandSequence, motionEpoch: pose.motionEpoch, pose, program});
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
    const next = advanceControlRelease(release, timestampMs);
    release.lastTimestampMs = next.lastTimestampMs;
    release.stalledFrames = next.stalledFrames;
    if (next.settled) this.#settle(channelState);
    else channelState.depth = next.depth;
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
    if (this.#selectControl === null) return;
    translateAxialControl(this.#selectControl, this.#select.depth);
  }

  #settle(channelState: Channel): void {
    channelState.depth = 0;
    channelState.release = null;
    if (channelState === this.#wheel) {
      if (this.#wheelAssembly !== null) {
        restoreRigidAssembly(this.#wheelAssembly);
      }
    } else if (this.#selectControl !== null) {
      restoreAxialControl(this.#selectControl);
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
