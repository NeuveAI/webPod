import { strict as assert } from 'node:assert';
import { createLatestRenderChannel } from '../../../../../../packages/device/src/render-channels';
import type { RenderMotionProgram, RenderMatrix } from '../../../../../../packages/device/src/device-render-protocol';
import type { DeviceOrientationReleaseMotion } from '../../../../../../apps/web/src/device-orientation-motion';

const sent: {sequence: number; value: number}[] = [];
const channel = createLatestRenderChannel<number>((sequence, value) => sent.push({sequence, value}));
channel.offer(1);
for (let frame = 2; frame <= 1000; frame++) channel.offer(frame);
assert.deepEqual(sent, [{sequence: 1, value: 1}]);
assert.deepEqual(channel.inspect(), {inFlight: 1, pending: true, paused: false, disposed: false});
assert.equal(channel.acknowledge(99), false);
assert.equal(channel.acknowledge(1), true);
assert.deepEqual(sent[1], {sequence: 2, value: 1000});
channel.pause(true); channel.offer(1001); channel.acknowledge(2);
assert.equal(sent.length, 2);
channel.pause(false); assert.deepEqual(sent[2], {sequence: 3, value: 1001});
channel.dispose(); channel.offer(1002); channel.acknowledge(3);
assert.equal(sent.length, 3);

const rest: RenderMatrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const original: DeviceOrientationReleaseMotion = {
  kind: 'flick-snap', orientation: {pitchDeg: 2, yawDeg: 721, rollDeg: -1},
  velocity: {pitchDegPerSecond: 4, yawDegPerSecond: 900, rollDegPerSecond: 0},
  targetYawDeg: 900, flickDirection: 1,
};
const programs: RenderMotionProgram[] = [
  {kind: 'orientation-release', origin: {commandSequence: 41, motionEpoch: 3}, state: original, previousStepTimestampMs: 5000},
  {kind: 'control-release', origin: {commandSequence: 42, motionEpoch: 3}, channel: 'wheel', nodeId: 'wheel', restMatrix: rest,
    contactAngleDeg: 33, initialDepth: 0.04, durationMs: 120, startedAtTimestampMs: 5000, lastTimestampMs: 5040, stalledFrames: 2},
  {kind: 'control-release', origin: {commandSequence: 43, motionEpoch: 3}, channel: 'select', nodeId: 'select', restMatrix: rest,
    contactAngleDeg: 0, initialDepth: 0.8, durationMs: 96, startedAtTimestampMs: 5030, lastTimestampMs: 5040, stalledFrames: 0},
];
assert.deepEqual(structuredClone(programs), programs);
assert.equal(programs[0]?.origin.commandSequence, 41);
assert.equal(programs[2]?.origin.commandSequence, 43);
// The source seed preserves both clock values after a regressing timestamp;
// elapsed alone would not retain the original lastTimestamp comparison point.
const wheel = programs[1];
assert(wheel?.kind === 'control-release');
assert.equal(Math.max(0, 5020 - wheel.startedAtTimestampMs), 20);
assert.equal(5020 > wheel.lastTimestampMs, false);
console.log(JSON.stringify({notificationOffers: 1002, sentNotifications: sent.length, maxInFlight: 1, maxPending: 1,
  staleAckRejected: true, disposalSuppressesSend: true, concurrentProgramOriginsRetained: 3,
  originalOrientationSeedStructurallyAssignable: true, regressingControlClockRepresentable: true,
  scope: 'Source contract and notification helper only; no worker rendering, presentation, or integrated motion acceptance.'}, null, 2));
