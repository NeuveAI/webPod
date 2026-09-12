import { atom, createStore } from 'jotai/vanilla';
import { FRONT_DEVICE_ORIENTATION } from '@webpod/device';
import { Euler, Matrix4 } from 'three';
import type { DeviceMotionAuthority, DeviceMotionBinding, DeviceMotionIntent } from '../../../packages/device/src/device-motion-authority';
import type { RenderCommand, RenderPose, RenderRevealState, RenderPointerSample } from '../../../packages/device/src/device-render-protocol';
import type { DeviceOrientationReleaseMotion } from './device-orientation-motion';
import type { DeviceOrientation } from '@webpod/device';

export interface PreviewMotionAuthority extends DeviceMotionAuthority {
  readonly pointer: (kind: 'pointer-start' | 'pointer-release' | 'pointer-cancel', sample: RenderPointerSample) => void;
  readonly publishReveal: (orientation: DeviceOrientation, reveal: RenderRevealState | null) => void;
  readonly publishIntent: (orientation: DeviceOrientation) => void;
  readonly startOrientation: (
    state: DeviceOrientationReleaseMotion,
    progress: (orientation: DeviceOrientation) => void,
    settled: (error?: Error) => void,
  ) => (() => void) | null;
}

/** Per-route command owner. Main input/public mutations happen before entering
 * this bridge; a missing renderer binding leaves the existing GL fallback in
 * charge. Never resolves settlement from command acceptance or projection ack. */
export function createPreviewMotionAuthority(initialOrientation: DeviceOrientation = FRONT_DEVICE_ORIENTATION): PreviewMotionAuthority {
  const intentStore = createStore();
  const intentAtom = atom<DeviceMotionIntent>({orientation: initialOrientation, reveal: null});
  let binding: DeviceMotionBinding | null = null;
  let unsubscribeBinding: (() => void) | null = null;
  let nextCommand = 0, motionEpoch = 0;
  let active: {readonly commandSequence: number; readonly motionEpoch: number;
    readonly progress: (orientation: DeviceOrientation) => void; readonly settled: (error?: Error) => void;
    lastPoseSequence: number} | null = null;
  const deliver = (owner: DeviceMotionBinding, send: () => void) => {
    try { send(); return true; } catch (error) {
      if (binding === owner) {
        binding = null; unsubscribeBinding?.(); unsubscribeBinding = null;
        const running = active; active = null;
        running?.settled(error instanceof Error ? error : new Error('Motion transport failed'));
      }
      return false;
    }
  };
  const prepare = (owner: DeviceMotionBinding) => {
    const current = owner.read();
    nextCommand = owner.nextCommandSequence();
    motionEpoch = Math.max(motionEpoch, current.motionEpoch) + 1;
    const pose: RenderPose = {...current, motionEpoch};
    return {commandSequence: nextCommand, motionEpoch, pose};
  };
  const poseWithOrientation = (pose: RenderPose, orientation: DeviceOrientation): RenderPose => {
    const matrix = new Matrix4().makeRotationFromEuler(new Euler(orientation.pitchDeg * Math.PI / 180, orientation.yawDeg * Math.PI / 180, orientation.rollDeg * Math.PI / 180, 'XYZ')).toArray();
    return {...pose, orientation, nodes: pose.nodes.map(node => node.id === 'device-model' ? {...node, matrix: new Matrix4().fromArray(matrix).setPosition(node.matrix[12], node.matrix[13], node.matrix[14]).toArray()} : node)};
  };
  const publish = (orientation: DeviceOrientation, reveal: RenderRevealState | null) => {
    const intent = {orientation, reveal};
    intentStore.set(intentAtom, intent);
    // Jotai subscribers run synchronously and may publish a newer intent.
    if (intentStore.get(intentAtom) !== intent) return;
    // Direct authority clients also supersede the old release, independently
    // of the orientation store binding's external-write cancellation.
    const superseded = active, previousEpoch = motionEpoch;
    active = null;
    superseded?.settled(new DOMException('Motion superseded by intent', 'AbortError'));
    if (intentStore.get(intentAtom) !== intent || active !== null || motionEpoch !== previousEpoch) return;
    const owner = binding;
    if (owner === null) return;
    const current = owner.read();
    motionEpoch = Math.max(motionEpoch, current.motionEpoch) + 1;
    deliver(owner, () => owner.sendPose(poseWithOrientation({...current, reveal, motionEpoch, sequence: current.sequence + 1}, orientation)));
  };
  return {
    pointer(kind, sample) {
      const owner = binding;
      if (!owner) return;
      const base = prepare(owner);
      deliver(owner, () => owner.sendCommand({...base, pose: poseWithOrientation(base.pose, intentStore.get(intentAtom).orientation), kind, sample}));
    },
    readIntent: () => intentStore.get(intentAtom),
    subscribeIntent: listener => intentStore.sub(intentAtom, listener),
    publishReveal: publish,
    publishIntent(orientation) {
      const previous = intentStore.get(intentAtom);
      if (previous.orientation.pitchDeg === orientation.pitchDeg && previous.orientation.yawDeg === orientation.yawDeg && previous.orientation.rollDeg === orientation.rollDeg) return;
      publish(orientation, previous.reveal);
    },
    attach(owner) {
      unsubscribeBinding?.(); unsubscribeBinding = null;
      const previous = active; active = null; binding = owner;
      previous?.settled(new DOMException('Renderer motion owner replaced', 'AbortError'));
      if (binding !== owner) return () => {};
      const unsubscribe = owner.subscribe(response => {
        if (binding !== owner || active === null) return;
        const running = active;
        if (response.type === 'projection') {
          const pose = response.projection.pose;
          if (pose.motionEpoch !== running.motionEpoch || pose.lastAcceptedCommand < running.commandSequence || pose.sequence <= running.lastPoseSequence) return;
          running.lastPoseSequence = pose.sequence;
          const intent = {orientation: pose.orientation, reveal: pose.reveal};
          intentStore.set(intentAtom, intent);
          if (binding === owner && active === running && intentStore.get(intentAtom) === intent) running.progress(pose.orientation);
        } else if (response.type === 'command-settled' && response.commandSequence === running.commandSequence && response.motionEpoch === running.motionEpoch) {
          const intent = {orientation: response.pose.orientation, reveal: response.pose.reveal};
          intentStore.set(intentAtom, intent);
          if (binding !== owner || active !== running) return;
          active = null;
          if (intentStore.get(intentAtom) !== intent) {
            running.settled(new DOMException('Renderer completion superseded', 'AbortError'));
            return;
          }
          running.progress(response.pose.orientation);
          running.settled(response.outcome === 'settled' ? undefined : new DOMException('Renderer motion cancelled', 'AbortError'));
        } else if (response.type === 'command-rejected' && response.commandSequence === running.commandSequence && response.motionEpoch === running.motionEpoch) {
          active = null; running.settled(new Error(response.reason));
        } else if (response.type === 'failed') {
          active = null; running.settled(new Error(`Renderer motion failed: ${response.message}`));
        }
      });
      unsubscribeBinding = unsubscribe;
      return () => {
        unsubscribe();
        if (binding !== owner) return;
        binding = null; unsubscribeBinding = null;
        const running = active; active = null;
        running?.settled(new DOMException('Renderer motion owner detached', 'AbortError'));
      };
    },
    startOrientation(state, progress, settled) {
      const owner = binding;
      if (owner === null) return null;
      const base = prepare(owner);
      const command: RenderCommand = {...base, pose: poseWithOrientation(base.pose, state.orientation), kind: 'motion-start', program: {
        kind: 'orientation-release', origin: {commandSequence: base.commandSequence, motionEpoch: base.motionEpoch},
        state, previousStepTimestampMs: performance.timeOrigin + performance.now(),
      }};
      const running = {commandSequence: base.commandSequence, motionEpoch: base.motionEpoch, progress, settled, lastPoseSequence: -1};
      const previous = active; active = running;
      previous?.settled(new DOMException('Motion superseded', 'AbortError'));
      // A synchronous subscriber can replace the request before dispatch.
      if (active === running && binding === owner) {
        deliver(owner, () => owner.sendCommand(command));
      }
      return () => {
        if (active !== running) return;
        active = null;
        if (binding !== owner) return;
        deliver(owner, () => owner.sendCommand({...prepare(owner), kind: 'motion-cancel', reason: 'external-input', channel: 'orientation'}));
      };
    },
  };
}
