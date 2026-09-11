import { Euler, Matrix4 } from 'three';
import type { RenderCommand, RenderControlResponse, RenderMotionCheckpoint, RenderMotionProgram, RenderPose } from './device-render-protocol';
import { advanceDeviceMotion } from './device-motion-runtime';
import { DEVICE_REVEAL_TIMING } from './device-reveal-motion';

export interface DeviceMotionDriverDependencies {
  readonly now: () => number;
  /** Scheduler callback must use the protocol absolute monotonic time domain. */
  readonly requestFrame: (callback: (timestampMs: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly publish: (pose: RenderPose) => void;
  readonly settled: (event: Extract<RenderControlResponse, {type: 'command-settled'}>) => void;
  readonly rendererEpoch: number;
  readonly orientationNodeId: string;
}

const channelOf = (program: RenderMotionProgram) => program.kind === 'control-release' ? program.channel : 'orientation';

/** One bounded autonomous owner inside the renderer worker or equivalent main
 * fallback. At most orientation/reveal, wheel and select are active. Publication
 * is a side effect, never frame credit; reentrant commands invalidate this tick.
 * Host validates scene/resource/layout barriers before delivering commands. */
export function createDeviceMotionDriver(initial: RenderPose, dependencies: DeviceMotionDriverDependencies) {
  let pose = initial;
  const programs = new Map<string, RenderMotionProgram>();
  let frame: number | null = null, disposed = false, paused = false, reducedMotion = false, generation = 0;
  const rotationMatrix = new Matrix4(), rotationEuler = new Euler();
  const cancelFrame = () => { if (frame !== null) dependencies.cancelFrame(frame); frame = null; };
  const emitSettlement = (program: RenderMotionProgram, outcome: 'settled' | 'cancelled', completedPose: RenderPose = pose) => dependencies.settled({
    type: 'command-settled', version: 1, epoch: dependencies.rendererEpoch,
    commandSequence: program.origin.commandSequence, motionEpoch: program.origin.motionEpoch, pose: completedPose, outcome,
  });
  const update = (program: RenderMotionProgram, timestamp: number) => {
    const result = advanceDeviceMotion(program, timestamp);
    let nodes = pose.nodes;
    if (result.control) {
      const control = result.control;
      nodes = nodes.map(node => node.id === control.nodeId ? {...node, matrix: control.matrix} : node);
    }
    if (result.orientation) {
      const value = result.orientation;
      rotationEuler.set(value.pitchDeg * Math.PI / 180, value.yawDeg * Math.PI / 180, value.rollDeg * Math.PI / 180, 'XYZ');
      const matrix = rotationMatrix.makeRotationFromEuler(rotationEuler).toArray();
      nodes = nodes.map(node => node.id === dependencies.orientationNodeId ? {...node, matrix: new Matrix4().fromArray(matrix).setPosition(node.matrix[12], node.matrix[13], node.matrix[14]).toArray()} : node);
    }
    pose = {...pose, sequence: pose.sequence + 1, nodes,
      ...(result.orientation ? {orientation: result.orientation} : {}),
      ...(result.reveal ? {reveal: result.reveal} : {})};
    return result.program;
  };
  const settleReduced = (program: RenderMotionProgram) => {
    if (program.kind === 'control-release') update(program, program.startedAtTimestampMs + program.durationMs);
    else if (program.kind === 'reveal') update({...program, elapsedMs: DEVICE_REVEAL_TIMING.complete, previousStepTimestampMs: null}, dependencies.now());
    else {
      const state = program.state;
      const orientation = state.kind === 'coast' ? state.orientation : {
        ...state.orientation, ...(state.kind === 'flick-snap' ? {pitchDeg: 0, rollDeg: 0} : {}), yawDeg: state.targetYawDeg,
      };
      update({...program, state: {...state, orientation}, previousStepTimestampMs: null}, dependencies.now());
    }
  };
  const schedule = () => { if (!disposed && !paused && programs.size > 0 && frame === null) frame = dependencies.requestFrame(tick); };
  const tick = (timestampMs: number) => {
    frame = null;
    if (disposed || paused) return;
    const finished: RenderMotionProgram[] = [];
    for (const [channel, program] of programs) {
      const next = update(program, timestampMs);
      if (next === null) { programs.delete(channel); finished.push(program); }
      else programs.set(channel, next);
    }
    const completedPose = pose;
    dependencies.publish(completedPose);
    if (disposed) return;
    // A reentrant unrelated command cannot lose a completed channel's record.
    // The original identity/pose lets main reject only superseded settlements.
    for (const program of finished) {
      emitSettlement(program, 'settled', completedPose);
      if (disposed) return;
    }
    schedule();
  };
  return {
    read: () => pose,
    /** Latest intent updates the driver's base even while an independent control
     * release is running, preventing its next frame from restoring old yaw. */
    adoptPose(next: RenderPose): boolean {
      if (disposed || !Number.isSafeInteger(next.motionEpoch) || !Number.isSafeInteger(next.sequence) || next.motionEpoch < pose.motionEpoch) return false;
      generation++;
      pose = {...next, sequence: Math.max(pose.sequence, next.sequence) + 1,
        lastAcceptedCommand: Math.max(pose.lastAcceptedCommand, next.lastAcceptedCommand)};
      const orientation = programs.get('orientation');
      if (orientation && orientation.origin.motionEpoch < next.motionEpoch) {
        programs.delete('orientation'); emitSettlement(orientation, 'cancelled');
      }
      if (programs.size === 0) cancelFrame();
      dependencies.publish(pose);
      schedule();
      return true;
    },
    checkpoint: (): RenderMotionCheckpoint => ({programs: [...programs.values()], reducedMotion, pose}),
    /** Reliable command sequencing is independent of coalesced visual samples. */
    command(command: RenderCommand): boolean {
      if (disposed || !Number.isSafeInteger(command.commandSequence) || !Number.isSafeInteger(command.motionEpoch) || command.commandSequence <= pose.lastAcceptedCommand || command.motionEpoch < pose.motionEpoch) return false;
      if (command.kind === 'motion-start' && (command.program.origin.commandSequence !== command.commandSequence || command.program.origin.motionEpoch !== command.motionEpoch)) return false;
      if (command.kind === 'motion-resume' && (command.checkpoint.programs.length > 3 || new Set(command.checkpoint.programs.map(channelOf)).size !== command.checkpoint.programs.length)) return false;
      generation++;
      const currentGeneration = generation;
      const settledPrograms: RenderMotionProgram[] = [];
      pose = {...command.pose, sequence: Math.max(pose.sequence, command.pose.sequence) + 1,
        lastAcceptedCommand: command.commandSequence, motionEpoch: command.motionEpoch};
      if (command.kind === 'motion-cancel') {
        const target = command.channel ?? 'all';
        const cancelled = [...programs.values()].filter(program => target === 'all' || channelOf(program) === target);
        for (const program of cancelled) programs.delete(channelOf(program));
        if (programs.size === 0) cancelFrame();
        for (const program of cancelled) { emitSettlement(program, 'cancelled'); if (generation !== currentGeneration) return true; }
      } else if (command.kind === 'pointer-start' || command.kind === 'pointer-cancel' || command.kind === 'control-down' || command.kind === 'control-cancel') {
        const target = 'button' in command ? command.button === 'center' ? 'select' : 'wheel' : 'orientation';
        const old = programs.get(target); programs.delete(target);
        if (old) { emitSettlement(old, 'cancelled'); if (generation !== currentGeneration) return true; }
        if (programs.size === 0) cancelFrame();
      } else if (command.kind === 'control-contact') {
        const wheel = programs.get('wheel');
        if (wheel?.kind === 'control-release') programs.set('wheel', {...wheel, contactAngleDeg: command.contactAngleDeg});
      } else if (command.kind === 'motion-start') {
        const channel = channelOf(command.program), old = programs.get(channel);
        programs.delete(channel);
        if (old) { emitSettlement(old, 'cancelled'); if (generation !== currentGeneration) return true; }
        if (reducedMotion) { settleReduced(command.program); settledPrograms.push(command.program); }
        else programs.set(channel, command.program);
      } else if (command.kind === 'motion-resume') {
        programs.clear();
        for (const program of command.checkpoint.programs) programs.set(channelOf(program), program);
        reducedMotion = command.checkpoint.reducedMotion;
      } else if (command.kind === 'reduced-motion') {
        reducedMotion = command.enabled;
        if (reducedMotion) {
          const settling = [...programs.values()]; programs.clear(); cancelFrame();
          for (const program of settling) {
            settleReduced(program); settledPrograms.push(program);
            if (generation !== currentGeneration) return true;
          }
        }
      }
      if (generation !== currentGeneration || disposed) return true;
      const completedPose = pose;
      dependencies.publish(completedPose);
      if (disposed) return true;
      for (const program of settledPrograms) {
        emitSettlement(program, 'settled', completedPose);
        if (disposed) return true;
      }
      schedule(); return true;
    },
    pause(value: boolean) { if (disposed) return; paused = value; if (value) cancelFrame(); else schedule(); },
    dispose() { if (disposed) return; disposed = true; generation++; cancelFrame(); programs.clear(); },
  };
}
