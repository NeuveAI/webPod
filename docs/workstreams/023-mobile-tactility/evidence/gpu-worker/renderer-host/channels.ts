import assert from 'node:assert/strict';
import { createLatestRenderChannel, createNativePaintCredit } from '../../../../../../packages/device/src/render-channels';

const sent: { sequence: number; value: number }[] = [];
const channel = createLatestRenderChannel<number>((sequence, value) => sent.push({ sequence, value }));
for (let i = 0; i < 10000; i++) channel.offer(i);
assert.deepEqual(sent, [{ sequence: 1, value: 0 }]);
assert.deepEqual(channel.inspect(), { inFlight: 1, pending: true, paused: false, disposed: false });
assert.equal(channel.acknowledge(100), false);
channel.acknowledge(1);
assert.deepEqual(sent[1], { sequence: 2, value: 9999 });
channel.pause(true); channel.offer(10000); channel.acknowledge(2);
assert.equal(sent.length, 2);
channel.pause(false); assert.deepEqual(sent[2], { sequence: 3, value: 10000 });
channel.dispose(); channel.offer(10001); channel.acknowledge(3); assert.equal(sent.length, 3);

let available = 0, closes = 0;
const initial = { epoch: 1, rasterRevision: 1, layoutRevision: 1, visibilityRevision: 1, width: 960, height: 720 };
const credit = createNativePaintCredit(initial, () => available++);
const snapshot = () => ({ close() { closes++; } });
const first = credit.begin(1); assert(first);
for (let i = 0; i < 10000; i++) credit.dirty();
assert.equal(credit.begin(2), null); assert.equal(available, 0);
const resized = { ...initial, rasterRevision: 2, width: 1280, height: 960 };
credit.update(resized, true);
assert.equal(credit.begin(3), null);
assert.equal(credit.complete(first, snapshot()), null); assert.equal(closes, 1); assert.equal(available, 1);
const second = credit.begin(4); assert(second);
assert(credit.complete(second, snapshot()));
assert.equal(credit.begin(5, true), null);
assert.equal(credit.acknowledge(first), false);
assert.equal(credit.acknowledge(second), true);
assert.equal(available, 2);
const third = credit.begin(6); assert(third);
const hidden = { ...resized, visibilityRevision: 2 };
credit.update(hidden, false);
assert.equal(credit.complete(third, snapshot()), null); assert.equal(closes, 2);
assert.equal(credit.begin(7, true), null);
credit.update({ ...hidden, visibilityRevision: 3 }, true);
const fourth = credit.begin(8); assert(fourth);
credit.dispose(); assert.equal(credit.complete(fourth, snapshot()), null); assert.equal(closes, 3);
assert.equal(credit.acknowledge(fourth), false); assert.equal(credit.begin(9), null);

const result = {
  kind: 'offline deterministic channel lifecycle, not browser rendering or latency',
  checks: {
    tenThousandNotificationsRetainOnlyOneInFlightAndLatest: true,
    exactAcknowledgmentRequired: true, pausedLatestResumes: true, disposalStopsPublication: true,
    captureIsBoundedBeforeTransfer: true, resizeWaitsAndClosesStaleCapture: true,
    latestPaintSurvivesBackpressure: true, staleAckCannotReleaseNewCredit: true,
    hiddenCaptureClosesWithoutRepaint: true, captureAfterDisposeCloses: true,
  },
};
await Bun.write(new URL('./channels.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(result);
