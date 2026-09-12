import assert from 'node:assert/strict';
import {Group, Matrix4} from '../../../../../../../packages/device/node_modules/three';
import {createDeviceMotionDriver} from '../../../../../../../packages/device/src/device-motion-driver';
import {ControlPhysicsController} from '../../../../../../../packages/device/src/control-physics';
import type {DeviceMotionBinding} from '../../../../../../../packages/device/src/device-motion-authority';
import type {RenderPose} from '../../../../../../../packages/device/src/device-render-protocol';
let now = 1000, frameId = 0, sequence = 0;
const frames = new Map<number, (time: number) => void>();
const identity = new Matrix4().identity().toArray();
let main: RenderPose = {sequence: 0, motionEpoch: 1, lastAcceptedCommand: 0, layoutRevision: 1, sceneRevision: 1, resourceRevision: 1,
  nodes: ['device-model', 'wheel-assembly', 'select'].map(id => ({id, matrix: identity})), orientation: {yawDeg: 0, pitchDeg: 0, rollDeg: 0}, reveal: null};
const driver = createDeviceMotionDriver(main, {now: () => now, requestFrame: callback => {frames.set(++frameId, callback); return frameId;}, cancelFrame: id => {frames.delete(id);}, rendererEpoch: 1, orientationNodeId: 'device-model', publish() {}, settled() {}});
const wheel = new Group(), select = new Group();
const binding: DeviceMotionBinding = {read: () => main, nextCommandSequence: () => ++sequence, sendPose(pose) {main = pose; assert(driver.adoptPose(pose));}, sendCommand(command) {main = command.pose; assert(driver.command(command));}, subscribe() {return () => {};}};
const controller = new ControlPhysicsController({now: () => now - performance.timeOrigin, requestFrame() {throw Error('No main release frame');}, cancelFrame() {}, invalidate() {
  binding.sendPose({...main, nodes: main.nodes.map(node => node.id === 'wheel-assembly' ? {...node, matrix: wheel.matrix.toArray()} : node.id === 'select' ? {...node, matrix: select.matrix.toArray()} : node)});
}});
controller.attachWheel(wheel); controller.attachSelect(select); const detach = controller.attachMotion(binding);
const node = (id: string) => {const found = driver.read().nodes.find(node => node.id === id); assert(found); return found.matrix;};
controller.pressWheel(30); const heldWheel = node('wheel-assembly'); controller.pressSelect(); assert.deepEqual(node('wheel-assembly'), heldWheel); assert.notDeepEqual(node('select'), identity);
controller.releaseWheel(); controller.releaseSelect();
for (let i = 0; i < 10; i++) {now += 16; const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now);}
assert.deepEqual(node('wheel-assembly'), identity); assert.deepEqual(node('select'), identity);
controller.setReducedMotion(true); controller.pressWheel(47); controller.pressSelect(); assert.notDeepEqual(node('wheel-assembly'), identity); assert.notDeepEqual(node('select'), identity);
controller.releaseWheel(); controller.releaseSelect(); assert.deepEqual(node('wheel-assembly'), identity); assert.deepEqual(node('select'), identity);
assert.equal(frames.size, 0); detach(); controller.dispose(); driver.dispose();
const result = {firstSimultaneousPress: true, completedWorkerRest: true, laterReducedMotionPressAndRelease: true, mainFrames: 0, scope: 'Actual ControlPhysicsController and driver, controlled binding/query invalidation; no browser activation claim.'};
await Bun.write(new URL('./control-ownership.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(result);
