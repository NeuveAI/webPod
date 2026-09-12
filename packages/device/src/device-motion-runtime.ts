import { Matrix4, Quaternion, Vector3 } from 'three';
import type { RenderMatrix, RenderMotionProgram, RenderOrientationReleaseState } from './device-render-protocol';
import { advanceDeviceOrientationRelease } from './device-orientation-motion';
import { DEVICE_REVEAL_TIMING, deviceRevealFrame, smooth } from './device-reveal-motion';
import { advanceControlRelease, CONTROL_TRAVEL, WHEEL_TILT } from './control-motion';

export type MotionStep = {
  readonly program: RenderMotionProgram | null;
  readonly orientation?: RenderOrientationReleaseState['orientation'];
  readonly control?: { readonly nodeId: string; readonly matrix: RenderMatrix };
  readonly reveal?: { readonly elapsedMs: number; readonly travelPercent: number; readonly glow: number; readonly publicActive: boolean; readonly settled: boolean; readonly timelineComplete: boolean };
};

/** Exact authored single-program step. No ports, timers, browser state or render
 * credits; caller owns scheduling and preserves the originating command identity.
 * Timestamps are in the protocol's shared absolute monotonic domain. */
export function advanceDeviceMotion(program: RenderMotionProgram, timestampMs: number): MotionStep {
  if (program.kind === 'orientation-release') {
    const elapsed = program.previousStepTimestampMs === null ? 0 : (timestampMs - program.previousStepTimestampMs) / 1000;
    const next = advanceDeviceOrientationRelease(program.state, elapsed);
    return { orientation: next.orientation, program: next.motion === null ? null : {
      ...program, state: next.motion,
      previousStepTimestampMs: timestampMs,
    } };
  }
  if (program.kind === 'reveal') {
    const elapsedMs = program.elapsedMs + (program.previousStepTimestampMs === null ? 0 : Math.min(timestampMs - program.previousStepTimestampMs, DEVICE_REVEAL_TIMING.maxFrameStep));
    const frame = deviceRevealFrame(elapsedMs);
    const settled = elapsedMs >= DEVICE_REVEAL_TIMING.settle;
    const timelineComplete = elapsedMs >= DEVICE_REVEAL_TIMING.complete;
    return { orientation: frame.orientation, reveal: {elapsedMs, travelPercent: frame.travelPercent,
      glow: 1 - smooth(elapsedMs / DEVICE_REVEAL_TIMING.front), publicActive: !settled, settled, timelineComplete},
      program: timelineComplete ? null : {...program, elapsedMs, previousStepTimestampMs: timestampMs} };
  }
  const next = advanceControlRelease({startedAtMs: program.startedAtTimestampMs, initialDepth: program.initialDepth,
    durationMs: program.durationMs, lastTimestampMs: program.lastTimestampMs, stalledFrames: program.stalledFrames}, timestampMs);
  return { control: {nodeId: program.nodeId, matrix: controlMotionMatrix(program, next.depth)},
    program: next.settled ? null : {...program, lastTimestampMs: next.lastTimestampMs, stalledFrames: next.stalledFrames} };
}

/** Preserves original rest components and the rigid quaternion composition
 * and axial translation convention, without decomposing a rounded matrix. */
export function controlMotionMatrix(program: Extract<RenderMotionProgram, {kind: 'control-release'}>, depth: number): RenderMatrix {
  const matrix = new Matrix4();
  const position = new Vector3().fromArray(program.restPosition);
  const rotation = new Quaternion().fromArray(program.restQuaternion);
  const scale = new Vector3().fromArray(program.restScale);
  if (depth === 0) return program.restMatrix;
  if (program.channel === 'select') position.z -= depth;
  else {
    const angle = (((program.contactAngleDeg % 360) + 360) % 360) * Math.PI / 180;
    const axis = new Vector3(Math.sin(angle), Math.cos(angle), 0);
    const travel = Math.max(0, Math.min(depth, CONTROL_TRAVEL.wheelModel));
    rotation.multiply(new Quaternion().setFromAxisAngle(axis, Math.asin(travel / WHEEL_TILT.radiusModel))).normalize();
  }
  return matrix.compose(position, rotation, scale).toArray();
}
