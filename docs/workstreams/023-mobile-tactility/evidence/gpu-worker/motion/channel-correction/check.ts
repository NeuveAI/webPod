import assert from 'node:assert/strict';
import {Matrix4} from '../../../../../../../packages/device/node_modules/three';
import {createDeviceMotionDriver} from '../../../../../../../packages/device/src/device-motion-driver';
import type {RenderCommand, RenderMotionProgram, RenderPose} from '../../../../../../../packages/device/src/device-render-protocol';
let now = 1000, frameId = 0, commandId = 0;
const frames = new Map<number, (time: number) => void>();
const initial: RenderPose = {sequence: 0, motionEpoch: 1, lastAcceptedCommand: 0, layoutRevision: 1, sceneRevision: 1, resourceRevision: 1,
  nodes: ['device-model', 'wheel-assembly', 'select'].map(id => ({id, matrix: new Matrix4().identity().toArray()})), orientation: {yawDeg: 0, pitchDeg: 0, rollDeg: 0}, reveal: null};
const driver = createDeviceMotionDriver(initial, {now: () => now, requestFrame: callback => {frames.set(++frameId, callback); return frameId;}, cancelFrame: id => {frames.delete(id);}, rendererEpoch: 1, orientationNodeId: 'device-model', publish() {}, settled() {}});
const tick = () => {now += 16; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now);};
const matrix = (pose: RenderPose, id: string) => {const node = pose.nodes.find(node => node.id === id); assert(node); return node.matrix;};
const start = (program: RenderMotionProgram, pose = driver.read()) => assert(driver.command({kind: 'motion-start', commandSequence: ++commandId, motionEpoch: pose.motionEpoch, pose, program: {...program, origin: {commandSequence: commandId, motionEpoch: pose.motionEpoch}}}));
const origin = {commandSequence: 0, motionEpoch: 1};
const release = (channel: 'wheel' | 'select'): RenderMotionProgram => ({kind: 'control-release', channel, nodeId: channel === 'wheel' ? 'wheel-assembly' : 'select', origin,
  restMatrix: new Matrix4().identity().toArray(), restPosition: [0, 0, 0], restQuaternion: [0, 0, 0, 1], restScale: [1, 1, 1], contactAngleDeg: 30,
  initialDepth: 0.12, durationMs: 120, startedAtTimestampMs: now, lastTimestampMs: now, stalledFrames: 0});
start({kind: 'orientation-release', origin, previousStepTimestampMs: now, state: {kind: 'coast', orientation: initial.orientation, velocity: {pitchDegPerSecond: 0, yawDegPerSecond: 200, rollDegPerSecond: 0}, targetYawDeg: 200 / 7.5, flickDirection: 0}});
start(release('wheel')); start(release('select'));
const stale = driver.read(); tick(); tick();
const before = driver.read();
const contact: RenderCommand = {kind: 'control-contact', commandSequence: ++commandId, motionEpoch: 1, pose: stale, contactAngleDeg: 44, timestampMs: now};
assert(driver.command(contact));
assert.deepEqual(driver.read().orientation, before.orientation);
assert.deepEqual(matrix(driver.read(), 'select'), matrix(before, 'select'));
assert.deepEqual(matrix(driver.read(), 'wheel-assembly'), matrix(stale, 'wheel-assembly'));
const beforeReframe = driver.read();
assert(driver.adoptPose({...stale, nodes: stale.nodes.map(node => node.id === 'device-model' ? {...node, matrix: new Matrix4().makeTranslation(0, 17, 0).toArray()} : node)}));
assert.deepEqual(driver.read().orientation, beforeReframe.orientation);
assert.equal(matrix(driver.read(), 'device-model')[13], 17);
assert.deepEqual(matrix(driver.read(), 'select'), matrix(beforeReframe, 'select'));
// A fresh explicit orientation supersedes the coast, while both releases keep
// their exact independently advanced matrices.
const controls = driver.read();
const fresh = {...stale, motionEpoch: 2, orientation: {yawDeg: 70, pitchDeg: 0, rollDeg: 0}};
assert(driver.adoptPose(fresh));
assert.equal(driver.read().orientation.yawDeg, 70);
assert.equal(driver.checkpoint().programs.some(program => program.kind === 'orientation-release'), false);
assert.deepEqual(matrix(driver.read(), 'select'), matrix(controls, 'select'));
// A channel cancellation admits that target's exact terminal matrix.
assert(driver.command({kind: 'motion-cancel', channel: 'wheel', reason: 'external-input', commandSequence: ++commandId, motionEpoch: 2, pose: fresh}));
assert.deepEqual(matrix(driver.read(), 'wheel-assembly'), matrix(fresh, 'wheel-assembly'));
assert.equal(driver.checkpoint().programs.length, 1);
// Hidden and dispose barriers carry the full exact pose, not merged progress.
const final = {...fresh, orientation: {yawDeg: 91, pitchDeg: 3, rollDeg: 2}};
assert(driver.command({kind: 'motion-cancel', reason: 'hidden', commandSequence: ++commandId, motionEpoch: 2, pose: final}));
assert.deepEqual(driver.read().orientation, final.orientation);
assert.deepEqual(driver.read().nodes, final.nodes);
assert.equal(frames.size, 0); assert.equal(driver.checkpoint().programs.length, 0);
start({kind: 'reveal', origin, elapsedMs: 100, previousStepTimestampMs: now}, final); tick();
const reveal = driver.read();
assert(driver.command({kind: 'control-down', button: 'center', timestampMs: now, commandSequence: ++commandId, motionEpoch: 2, pose: final}));
assert.deepEqual(driver.read().reveal, reveal.reveal); assert.deepEqual(driver.read().orientation, reveal.orientation);
assert(driver.command({kind: 'motion-cancel', reason: 'unmount', commandSequence: ++commandId, motionEpoch: 2, pose: final}));
assert.deepEqual(driver.read().orientation, final.orientation); driver.dispose(); assert.equal(frames.size, 0);
const result = {simultaneousChannels: 3, staleContactPreservesCoastAndOtherControl: true, affectedTargetExact: true, reframeTranslation: 17, newerEpochCancelsOrientationOnly: true, channelFinalSample: true, hiddenAndUnmountFinalSamples: true, independentReveal: true, scope: 'Actual pure driver with controlled RAF; no browser, GPU or timing claim.'};
await Bun.write(new URL('./check.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(result);
