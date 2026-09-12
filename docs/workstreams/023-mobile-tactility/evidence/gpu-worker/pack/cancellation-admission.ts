import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createPaperWorker, inspectPaperPool, releaseUnusedPaperPackGeometry, acquirePaperPackGeometry, acquirePrivatePaperPackGeometry } from '../../../../../../packages/device/src/sticker-paper-pool';
async function idle() { for (let index = 0; index < 1000; index++) { if (inspectPaperPool().active === null) return; await new Promise<void>(resolve => setTimeout(resolve, 5)); } throw Error('Worker completion deadline'); }
const client = createPaperWorker();
client.postMessage({id: 1, input: {width: 300, height: 420, pixel: 1, liner: true, curl: .4}}); client.terminate();
const pending = inspectPaperPool(); assert.equal(pending.accountedBytes, 4 * 1024 * 1024); assert.equal(pending.active, 'paper');
await idle(); const dynamic = inspectPaperPool(); assert.equal(dynamic.worker, false); assert.equal(dynamic.accountedBytes, 0);
const resource = acquirePaperPackGeometry({kind: 'gpu-paper', width: 300, height: 420, pixel: 1, liner: true});
const rejected = assert.rejects(resource.result); resource.release(); await rejected; await idle();
const immutable = inspectPaperPool(); assert.equal(immutable.worker, false); assert.equal(immutable.accountedBytes, 0);
const requests = Array.from({length: 100}, () => {
  const channel = new MessageChannel(), abort = new AbortController();
  const promise = acquirePrivatePaperPackGeometry({kind: 'gpu-paper', width: 300, height: 420, pixel: 1, liner: true}, channel.port1, abort.signal);
  void promise.catch(() => {}); return {channel, abort, promise};
});
const cold = inspectPaperPool(); assert.equal(cold.privateOwners, 32); assert.equal(cold.entries, 1);
for (const request of requests) request.abort.abort();
const outcomes = await Promise.allSettled(requests.map(request => request.promise));
assert(outcomes.every(value => value.status === 'rejected'));
for (const request of requests) request.channel.port2.close();
await idle(); releaseUnusedPaperPackGeometry(); const final = inspectPaperPool();
assert.equal(final.privateOwners, 0); assert.equal(final.accountedBytes, 0); assert.equal(final.worker, false);
writeFileSync(new URL('./cancellation-admission.json', import.meta.url), JSON.stringify({actualWorker: true, pending, dynamic, immutable, cold, final, requests: requests.length}, null, 2) + '\n');
console.log('Actual producer cancellation and cold private admission checks passed');
