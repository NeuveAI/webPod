import type { Matrix4Tuple } from 'three';
import type { DeviceOrientation } from './orientation';
import type { ClickWheelCardinalButton } from './click-wheel-input';

export const DEVICE_RENDER_PROTOCOL_VERSION = 1;
export type RenderMatrix = Readonly<Matrix4Tuple>;
/** Local transforms of stable shared-scene nodes; never a serialized scene. */
export interface RenderNodePose { readonly id: string; readonly matrix: RenderMatrix }
export interface RenderLayout {
  readonly revision: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly pixelRatio: number;
  readonly cameraWorld: RenderMatrix;
  readonly cameraProjection: RenderMatrix;
}
/** The worker/main clock is an explicit logical timeline, not elapsed wall time.
 * In particular reveal advances by the existing min(frameDelta,32ms) rule.
 * CPU012 owns the exact trajectory and same-turn public-state integration. */
export interface RenderRevealState {
  readonly elapsedMs: number;
  readonly travelPercent: number;
  readonly glow: number;
  readonly publicActive: boolean;
  readonly settled: boolean;
  readonly timelineComplete: boolean;
}
/** One coherent visual sample. Matrices are authoritative for rendering/query;
 * orientation/reveal are the matching semantic projection for main UI state.
 * A new external/tool input increments motionEpoch synchronously on main.
 */
export interface RenderPose {
  readonly sequence: number;
  readonly motionEpoch: number;
  readonly lastAcceptedCommand: number;
  readonly layoutRevision: number;
  readonly sceneRevision: number;
  readonly resourceRevision: number;
  readonly nodes: readonly RenderNodePose[];
  readonly orientation: DeviceOrientation;
  readonly reveal: RenderRevealState | null;
}
/** All wire timestamps use performance.timeOrigin + a monotonic timestamp.
 * Main converts native event timestamps before sending; worker never compares
 * raw window performance.now to its own unrelated time origin. */
export interface RenderPointerSample {
  readonly pointerId: number;
  readonly pointerType: 'mouse' | 'touch' | 'pen';
  readonly clientX: number;
  readonly clientY: number;
  readonly timestampMs: number;
}
/** Structural seeds of the existing pure motion equations. CPU012 extracts
 * those equations into the device package without importing application code. */
export interface RenderOrientationReleaseState {
  readonly kind: 'coast' | 'opposite-face' | 'flick-snap';
  readonly orientation: DeviceOrientation;
  readonly velocity: { readonly pitchDegPerSecond: number; readonly yawDegPerSecond: number; readonly rollDegPerSecond: number };
  readonly targetYawDeg: number;
  readonly flickDirection: -1 | 0 | 1;
}
export interface RenderMotionOrigin {
  readonly commandSequence: number;
  readonly motionEpoch: number;
}
/** Origin survives checkpoint/replacement separately for simultaneous releases.
 * Global lastAcceptedCommand cannot stand in for each program's settlement. */
export type RenderMotionProgram = { readonly origin: RenderMotionOrigin } & (
  | { readonly kind: 'reveal'; readonly elapsedMs: number; readonly previousStepTimestampMs: number | null }
  | { readonly kind: 'orientation-release'; readonly state: RenderOrientationReleaseState; readonly previousStepTimestampMs: number | null }
  | { readonly kind: 'control-release'; readonly channel: 'wheel' | 'select'; readonly nodeId: string; readonly restMatrix: RenderMatrix;
      readonly contactAngleDeg: number; readonly initialDepth: number; readonly durationMs: number;
      readonly startedAtTimestampMs: number; readonly lastTimestampMs: number; readonly stalledFrames: number }
);
export interface RenderMotionCheckpoint {
  readonly programs: readonly RenderMotionProgram[];
  readonly reducedMotion: boolean;
  readonly pose: RenderPose;
}

/** Reliable commands cannot depend on a replaceable pose mailbox. Every command
 * carries its exact pose barrier, including release/cancel's terminal sample.
 * Media activation and human feedback run on main before this message is sent.
 */
export interface RenderCommandBase {
  readonly commandSequence: number;
  readonly motionEpoch: number;
  readonly pose: RenderPose;
}
export type RenderCommand = RenderCommandBase & (
  | { readonly kind: 'pointer-start' | 'pointer-release' | 'pointer-cancel'; readonly sample: RenderPointerSample }
  | { readonly kind: 'control-down' | 'control-up' | 'control-cancel'; readonly button: ClickWheelCardinalButton | 'center'; readonly timestampMs: number }
  | { readonly kind: 'control-contact'; readonly contactAngleDeg: number; readonly timestampMs: number }
  | { readonly kind: 'motion-start'; readonly program: RenderMotionProgram }
  | { readonly kind: 'reduced-motion'; readonly enabled: boolean }
  | { readonly kind: 'motion-resume'; readonly checkpoint: RenderMotionCheckpoint }
  | { readonly kind: 'motion-cancel'; readonly reason: 'external-input' | 'hidden' | 'unmount' | 'layout' }
);
export interface RenderProjection {
  readonly epoch: number;
  readonly notificationSequence: number;
  readonly sceneRevision: number;
  readonly resourceRevision: number;
  readonly layoutRevision: number;
  readonly pose: RenderPose;
  readonly screenWorld: RenderMatrix;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly cameraWorld: RenderMatrix;
  readonly cameraProjection: RenderMatrix;
}
/** Credit identifies the captured paint and all lifetimes that can invalidate it. */
export interface NativePaintStamp {
  readonly epoch: number;
  readonly captureId: number;
  readonly rasterRevision: number;
  readonly layoutRevision: number;
  readonly visibilityRevision: number;
  readonly paintRevision: number;
  readonly width: number;
  readonly height: number;
}
export interface RenderEnvelope { readonly version: typeof DEVICE_RENDER_PROTOCOL_VERSION; readonly epoch: number }

/** Resource and full scene messages are defined alongside their immutable data
 * contract. This control channel is stable independently of those bulk leases. */
export type RenderControlRequest = RenderEnvelope & (
  | { readonly type: 'pose'; readonly pose: RenderPose }
  | { readonly type: 'command'; readonly command: RenderCommand }
  | { readonly type: 'layout'; readonly layout: RenderLayout }
  | { readonly type: 'visibility'; readonly visible: boolean; readonly revision: number; readonly command: RenderCommand }
  | { readonly type: 'projection-ack'; readonly notificationSequence: number }
  | { readonly type: 'dispose'; readonly command: RenderCommand }
);
export type RenderControlResponse = RenderEnvelope & (
  | { readonly type: 'projection'; readonly projection: RenderProjection }
  | { readonly type: 'paint-consumed'; readonly stamp: NativePaintStamp }
  | { readonly type: 'command-accepted'; readonly commandSequence: number; readonly motionEpoch: number }
  | { readonly type: 'command-rejected'; readonly commandSequence: number; readonly motionEpoch: number; readonly reason: string }
  | { readonly type: 'motion-checkpoint'; readonly checkpoint: RenderMotionCheckpoint }
  | { readonly type: 'command-settled'; readonly commandSequence: number; readonly motionEpoch: number; readonly pose: RenderPose; readonly outcome: 'settled' | 'cancelled' }
  | { readonly type: 'failed'; readonly stage: 'initialize' | 'resource' | 'compile' | 'paint' | 'render' | 'protocol'; readonly message: string }
  | { readonly type: 'disposed' }
);
