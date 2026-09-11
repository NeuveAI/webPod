import { strict as assert } from 'node:assert';
import { createPreviewMotionAuthority } from '../../../../../../apps/web/src/device-motion-authority';
import { bindDeviceOrientationControls, createDevicePreviewStore } from '../../../../../../apps/web/src/device-preview-orientation';
import type { RenderCommand, RenderControlResponse, RenderPose } from '../../../../../../packages/device/src/device-render-protocol';

const identity: [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number] = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
let pose: RenderPose = {sequence: 0, motionEpoch: 0, lastAcceptedCommand: 0, layoutRevision: 1, sceneRevision: 1, resourceRevision: 1,
  nodes: [{id: 'device-model', matrix: identity}], orientation: {pitchDeg: 0, yawDeg: 0, rollDeg: 0}, reveal: null};
let sequence = 0;
const commands: RenderCommand[] = [], listeners = new Set<(value: RenderControlResponse) => void>();
const authority = createPreviewMotionAuthority();
const detach = authority.attach({read: () => pose, nextCommandSequence: () => ++sequence, sendPose(next) {pose = next;}, sendCommand(command) {commands.push(command);},
  subscribe(listener) {listeners.add(listener); return () => {listeners.delete(listener);};}});
const store = createDevicePreviewStore();
class Stage extends EventTarget {dataset: Record<string, string | undefined> = {}; focus() {}}
const stage = new Stage();
let mainFrames = 0;
const controls = bindDeviceOrientationControls(stage, store, new EventTarget(), {now: () => 100, reducedMotion: () => false, requestFrame() {mainFrames++; return 1;}, cancelFrame() {}}, undefined, authority);
controls.rotate(0, 30); assert.equal(store.getSnapshot().orientation.yawDeg, 30);
let status = 'pending';
const flick = controls.flick('back', new AbortController().signal).then(() => {status = 'settled';}, () => {status = 'rejected';});
const command = commands.at(-1); assert(command?.kind === 'motion-start');
const emit = (response: RenderControlResponse) => {for (const listener of [...listeners]) listener(response);};
emit({type: 'command-accepted', version: 1, epoch: 1, commandSequence: command.commandSequence, motionEpoch: command.motionEpoch});
await Promise.resolve(); assert.equal(status, 'pending'); assert.equal(mainFrames, 0);
const appearance = store.getAppearanceSnapshot();
store.setOrientation({pitchDeg: 0, yawDeg: 77, rollDeg: 0});
assert.equal(store.getAppearanceSnapshot(), appearance);
await flick; assert.equal(status, 'rejected');
emit({type: 'command-settled', version: 1, epoch: 1, commandSequence: command.commandSequence, motionEpoch: command.motionEpoch, pose: {...command.pose, orientation: {pitchDeg: 0, yawDeg: 180, rollDeg: 0}}, outcome: 'settled'});
assert.equal(store.getSnapshot().orientation.yawDeg, 77);
let finalStatus = 'pending';
const final = controls.flick('back', new AbortController().signal).then(() => {finalStatus = 'settled';});
const finalCommand = commands.at(-1); assert(finalCommand?.kind === 'motion-start');
emit({type: 'command-settled', version: 1, epoch: 1, commandSequence: finalCommand.commandSequence, motionEpoch: finalCommand.motionEpoch, pose: {...finalCommand.pose, orientation: {pitchDeg: 0, yawDeg: 180, rollDeg: 0}}, outcome: 'settled'});
await final; assert.equal(finalStatus, 'settled'); assert.equal(store.getSnapshot().orientation.yawDeg, 180);
controls.dispose();
let directStatus = 'pending', directProgress = 0;
authority.startOrientation({kind: 'coast', orientation: {pitchDeg: 0, yawDeg: 180, rollDeg: 0}, velocity: {pitchDegPerSecond: 0, yawDegPerSecond: 100, rollDegPerSecond: 0}, targetYawDeg: 200, flickDirection: 0}, () => {directProgress++;}, error => {directStatus = error ? 'rejected' : 'settled';});
const directCommand = commands.at(-1); assert(directCommand?.kind === 'motion-start');
authority.publishIntent({pitchDeg: 0, yawDeg: 225, rollDeg: 0});
assert.equal(directStatus, 'rejected');
const stalePose = {...directCommand.pose, sequence: 999, lastAcceptedCommand: directCommand.commandSequence, orientation: {pitchDeg: 0, yawDeg: 190, rollDeg: 0}};
emit({type: 'projection', version: 1, epoch: 1, projection: {epoch: 1, notificationSequence: 1, sceneRevision: 1, resourceRevision: 1, layoutRevision: 1, pose: stalePose, screenWorld: identity, screenWidth: 320, screenHeight: 240, cameraWorld: identity, cameraProjection: identity}});
emit({type: 'command-settled', version: 1, epoch: 1, commandSequence: directCommand.commandSequence, motionEpoch: directCommand.motionEpoch, pose: stalePose, outcome: 'settled'});
assert.equal(authority.readIntent().orientation.yawDeg, 225); assert.equal(directProgress, 0); assert.equal(directStatus, 'rejected');
detach(); assert.equal(listeners.size, 0);
console.log(JSON.stringify({sameTurnRotate: true, acceptedDoesNotSettle: true, remoteMainFrames: mainFrames, staleSettlementIgnored: true, actualSettlementResolves: true,
  directIntentSupersedesRelease: true, staleProjectionIgnored: true, appearanceSnapshotStable: true, finalListeners: listeners.size, scope: 'Actual main adapter/controller deterministic binding, no native presentation or media claim.'}, null, 2));
