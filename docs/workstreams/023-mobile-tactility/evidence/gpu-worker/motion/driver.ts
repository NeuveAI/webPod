import { strict as assert } from 'node:assert';
import { Matrix4, Group } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createDeviceMotionDriver } from '../../../../../../packages/device/src/device-motion-driver';
import { ControlPhysicsController } from '../../../../../../packages/device/src/control-physics';
import type { RenderCommand, RenderControlResponse, RenderPose } from '../../../../../../packages/device/src/device-render-protocol';
import type { DeviceMotionBinding } from '../../../../../../packages/device/src/device-motion-authority';

let now = 1000, nextFrame = 0, nextCommand = 0;
const frames = new Map<number, (timestamp: number) => void>();
const listeners = new Set<(response: RenderControlResponse) => void>();
const notifications: RenderControlResponse[] = [];
const identity = new Matrix4().toArray();
let pose: RenderPose = {sequence: 0, motionEpoch: 0, lastAcceptedCommand: 0, layoutRevision: 1, sceneRevision: 1, resourceRevision: 1,
  nodes: ['device-model', 'wheel-assembly', 'select'].map(id => ({id, matrix: id === 'device-model' ? new Matrix4().makeTranslation(0, 37, 0).toArray() : identity})), orientation: {pitchDeg: 0, yawDeg: 0, rollDeg: 0}, reveal: null};
const driver = createDeviceMotionDriver(pose, {now: () => now, requestFrame: callback => {frames.set(++nextFrame, callback); return nextFrame;}, cancelFrame: id => {frames.delete(id);},
  rendererEpoch: 1, orientationNodeId: 'device-model', publish(next) {pose = next;}, settled(event) {notifications.push(event); for (const listener of listeners) listener(event);}});
const binding: DeviceMotionBinding = {read: () => pose, nextCommandSequence: () => ++nextCommand, sendPose(next) {pose = next;}, sendCommand(command) {assert(driver.command(command));},
  subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};}};
const wheel = new Group(), select = new Group();
const controller = new ControlPhysicsController({now: () => now - performance.timeOrigin, invalidate() {}, requestFrame() {throw Error('Remote control must not request a main frame');}, cancelFrame() {}});
controller.attachWheel(wheel); controller.attachSelect(select); const detach = controller.attachMotion(binding);
controller.pressWheel(33); controller.releaseWheel(); controller.pressSelect(); controller.releaseSelect();
// Commands remain reliable even if the main sender has not received any
// projection acknowledging an earlier command. Driver owns sequence admission.
const pendingPose = {...pose, lastAcceptedCommand: 0};
assert(driver.command({kind: 'control-contact', contactAngleDeg: 44, timestampMs: now,
  commandSequence: ++nextCommand, motionEpoch: pose.motionEpoch, pose: pendingPose}));
assert.equal(driver.read().lastAcceptedCommand, nextCommand);
assert.equal(frames.size, 1);
const checkpoint = driver.checkpoint(); assert.equal(checkpoint.programs.length, 2);
assert.notEqual(checkpoint.programs[0]?.origin.commandSequence, checkpoint.programs[1]?.origin.commandSequence);
for (let i = 0; i < 10 && frames.size; i++) {
  now += 16; const pending = [...frames.values()]; frames.clear(); for (const frame of pending) frame(now);
}
assert.equal(frames.size, 0); assert.equal(driver.checkpoint().programs.length, 0);
assert.deepEqual(wheel.matrix.toArray(), identity); assert.deepEqual(select.matrix.toArray(), identity);
assert.equal(notifications.filter(event => event.type === 'command-settled' && event.outcome === 'settled').length, 2);
const start: RenderCommand = {kind: 'motion-start', commandSequence: ++nextCommand, motionEpoch: 1, pose: {...pose, motionEpoch: 1}, program: {kind: 'orientation-release', origin: {commandSequence: nextCommand, motionEpoch: 1}, previousStepTimestampMs: now,
  state: {kind: 'coast', orientation: {pitchDeg: 0, yawDeg: 0, rollDeg: 0}, velocity: {pitchDegPerSecond: 0, yawDegPerSecond: 200, rollDegPerSecond: 0}, targetYawDeg: 200/7.5, flickDirection: 0}}};
assert(driver.command(start)); assert.equal(frames.size, 1);
assert.equal(driver.command(start), false);
now += 16; const orientationFrames = [...frames.values()]; frames.clear();
for (const callback of orientationFrames) callback(now);
assert.equal(driver.read().nodes.find(node => node.id === 'device-model')?.matrix[13], 37);
driver.pause(true); assert.equal(frames.size, 0); driver.pause(false); assert.equal(frames.size, 1);
driver.dispose(); assert.equal(frames.size, 0); assert.equal(driver.command({...start, commandSequence: ++nextCommand}), false);
detach(); controller.dispose();
console.log(JSON.stringify({remoteControlChannels: 2, mainControlFrames: 0, maxRendererFrames: 1, exactRest: true, distinctOrigins: true, rapidCommandsWithoutProjectionReceipt: true, modelReframeTranslationPreserved: true, staleCommandRejected: true, pauseDisposeQuiescent: true,
  scope: 'Deterministic actual controller/driver seam; no native rendering or provider/browser claim.'}, null, 2));
