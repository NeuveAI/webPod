import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BoxGeometry, Matrix4, PerspectiveCamera } from '../../../../../../packages/device/node_modules/three';
import { createImmutableShells } from '../../../../../../packages/device/src/immutable-shells';
import { createHardwareGeometry } from '../../../../../../packages/device/src/hardware-geometry';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
import { createStickerCollision } from '../../../../../../packages/device/src/sticker-collision';
import { carryContextSource, copyCarryContextSteps, MAX_CARRY_CONTEXT_BYTES } from '../../../../../../packages/device/src/sticker-carry-context';
import { yieldSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
import { transferPaperGeometry } from '../../../../../../packages/device/src/sticker-paper-transfer';
import { createCarryPreparation } from '../../../../../../packages/device/src/sticker-carry-preparation';
import type { CarryWorkerMessage, CarryWorkerResult } from '../../../../../../packages/device/src/sticker-carry-worker';
import type { CarryRenderAck } from '../../../../../../packages/device/src/sticker-carry-render-resources';
import type { CarryInput } from '../../../../../../packages/device/src/sticker-carry-computation';
const sleep = (ms = 5) => new Promise<void>(resolve => setTimeout(resolve, ms));
const until = async (check: () => boolean) => { for (let i = 0; i < 2000; i++) { if (check()) return; await sleep(); } throw Error('Deadline'); };
const hash = (value: ArrayBufferView) => createHash('sha256').update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).digest('hex');
const output: Record<string, boolean | number> = {};
const shells = createImmutableShells(DEFAULT_DEVICE_FORM), hardware = createHardwareGeometry(DEFAULT_DEVICE_FORM);
const collision = createStickerCollision([{ geometry: shells.front, source: 'front', kind: 'surface' }, { geometry: shells.back, source: 'rear', kind: 'surface' }, ...hardware.map(part => ({ geometry: part.geometry, source: part.name, kind: 'surface' as const }))]);
const original = collision.snapshot();
const borrowed = [shells.back.getAttribute('position').array, shells.back.getAttribute('normal').array, shells.back.getAttribute('uv').array, ...(shells.back.index ? [shells.back.index.array] : []), original.coordinates, original.provenance, original.root.bounds, original.root.links, original.root.triangles];
const hashes = borrowed.map(hash), sizes = borrowed.map(array => array.byteLength);
const source = carryContextSource(shells.back, original, DEFAULT_DEVICE_FORM);
const expected = { context: { rear: transferPaperGeometry(shells.back), form: DEFAULT_DEVICE_FORM, collision: original } };
let settled = false;
const preparation = yieldSteps(copyCarryContextSteps(source), new AbortController().signal).then(value => { settled = true; return value; });
assert.equal(settled, false);
const prepared = await preparation;
assert.deepEqual(prepared.message, expected);
assert.equal(new Set(prepared.transfer).size, prepared.transfer.length);
const privateBytes = prepared.transfer.reduce((sum, buffer) => sum + buffer.byteLength, 0);
assert(privateBytes <= source.bytes && source.bytes <= MAX_CARRY_CONTEXT_BYTES);
for (const buffer of prepared.transfer) assert(!borrowed.some(array => array.buffer === buffer));
const channel = new MessageChannel();
const received = new Promise<unknown>(resolve => { channel.port2.onmessage = event => resolve(event.data); });
channel.port1.postMessage(prepared.message, prepared.transfer);
assert(prepared.transfer.every(buffer => buffer.byteLength === 0));
assert.deepEqual(await received, expected); channel.port1.close(); channel.port2.close();
assert.deepEqual(borrowed.map(hash), hashes); assert.deepEqual(borrowed.map(array => array.byteLength), sizes);
Object.assign(output, { authoredRearAndPackedCollisionExact: true, privateTypedBytes: privateBytes, reservedContextBytes: source.bytes, oneTransferPerBuffer: true, borrowedIntact: true });

// Count element reads at generator checkpoints, not elapsed time on this host.
let reads = 0;
const counted = new Proxy(new Float32Array(10000), { get(target, key) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, target); } });
const steps = copyCarryContextSteps({ ...source, position: counted });
assert.equal(reads, 0);
for (;;) { const before = reads, next = steps.next(); assert(reads - before <= 2048); if (next.done) break; }
assert.equal(reads, 10000); output.copyCheckpointsAtMost2048Elements = true;

// Initial yield and abort after partially copying. No completed private envelope escapes.
reads = 0;
const large = new Proxy(new Float32Array(4_000_000), { get(target, key) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, target); } });
const abort = new AbortController();
const interrupted = yieldSteps(copyCarryContextSteps({ ...source, position: large }), abort.signal); void interrupted.catch(() => {});
assert.equal(reads, 0); setTimeout(() => abort.abort(), 1); await assert.rejects(interrupted);
assert(reads > 0 && reads < large.length); const readsAtAbort = reads; await sleep(); assert.equal(reads, readsAtAbort);
output.initialYieldAndMidCopyAbort = true;

const NativeWorker = globalThis.Worker;
const workers: ObservedWorker[] = []; let scalarJobs = 0; let live = 0, peak = 0, installedBytes = 0, peakInstalledBytes = 0, failContext = false;
class ObservedWorker {
  readonly actual: Worker; stopped = false; bytes = 0;
  onmessage: ((event: MessageEvent<CarryWorkerResult | CarryRenderAck>) => void) | null = null;
  onerror: (() => void) | null = null; onmessageerror: (() => void) | null = null;
  constructor(url: URL, options: WorkerOptions) {
    this.actual = new NativeWorker(url, options); workers.push(this); live++; peak = Math.max(peak, live);
    this.actual.onmessage = event => this.onmessage?.(event); this.actual.onerror = () => this.onerror?.(); this.actual.onmessageerror = () => this.onmessageerror?.();
  }
  postMessage(message: CarryWorkerMessage, transfer: Transferable[] = []) {
    if ('context' in message) {
      assert(transfer.length >= 7); assert(transfer.every(value => value instanceof ArrayBuffer));
      this.bytes = transfer.reduce((sum, value) => sum + (value instanceof ArrayBuffer ? value.byteLength : 0), 0);
      assert(this.bytes <= MAX_CARRY_CONTEXT_BYTES);
      if (failContext) throw Error('Controlled context post failure');
      installedBytes += this.bytes; peakInstalledBytes = Math.max(peakInstalledBytes, installedBytes);
      this.actual.postMessage(message, transfer);
      assert(transfer.every(value => value instanceof ArrayBuffer && value.byteLength === 0)); return;
    }
    if ('id' in message) scalarJobs++;
    this.actual.postMessage(message, transfer);
  }
  terminate() { if (!this.stopped) { this.stopped = true; live--; if (!failContext) installedBytes -= this.bytes; this.actual.terminate(); } }
}
Object.defineProperty(globalThis, 'Worker', { value: ObservedWorker, configurable: true });
const doc = Object.assign(new EventTarget(), { hidden: false }); Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
const camera = new PerspectiveCamera(40, 440 / 956, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const art = { id: 'carry-context', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const };
const input: CarryInput = { art, pack: { progress: 1, stickerId: art.id, peel: .3, sourcePeelFront: .3, landing: 0, placement: null, computationEpoch: 1 }, width: 66, paperWidth: 300, pixel: 1, seatX: .5, origin: [0, -140, 132], world: new Matrix4().toArray(), cameraWorld: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), viewportWidth: 440, viewportHeight: 956, worldPixel: 1, workspaceBounds: null };
let revision = 1;
const visibility = { ready: true, get revision() { return revision; }, snapshot: () => original };
const runtime = createCarryPreparation({ renderer: true }), unmount = runtime.mount();
try {
  runtime.primeContext(shells.back, visibility);
  runtime.primeContext(shells.back, visibility);
  assert.equal(workers.length,0); assert.equal(scalarJobs,0);
  await until(()=>workers.length===1);
  assert.equal(scalarJobs,0); assert.equal(runtime.getSnapshot().frame,null);
  runtime.primeContext(shells.back,visibility); await sleep(); assert.equal(workers.length,1);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await sleep();assert.equal(live,0);assert.equal(scalarJobs,0);
  output.primeNoJobsDeduplicatedAndNoResumePrime=true;
  // Priming and a real request share the same initially-yielding copy.
  runtime.primeContext(shells.back,visibility);
  runtime.request(input, shells.back, visibility); assert.equal(workers.length, 1);
  // Replace an initial context before its first copy task: exactly one latest producer.
  revision = 2; runtime.request({ ...input, pack: { ...input.pack, computationEpoch: 2, peel: .8 } }, shells.back, visibility);
  assert.equal(workers.length, 1); await until(() => !!runtime.getSnapshot().frame);
  const first = runtime.getSnapshot().frame; assert(first); assert.equal(first.input.pack.peel, .8); assert.equal(first.renderStamp?.assemblyRevision, 2);
  assert.equal(workers.length, 2); assert.equal(peak, 1);
  let disposed = 0; first.geometry.addEventListener('dispose', () => disposed++);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(live, 0); assert.equal(installedBytes, 0);
  runtime.request({ ...input, pack: { ...input.pack, computationEpoch: 3, peel: .95 } }, shells.back, visibility);
  assert.equal(runtime.getSnapshot().frame, first); assert.equal(disposed, 0);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(workers.length, 2);
  await until(() => runtime.getSnapshot().frame !== first); assert.equal(runtime.getSnapshot().frame?.input.pack.peel, .95);
  runtime.commit(); assert.equal(disposed, 1); unmount(); assert.equal(live, 0); assert.equal(installedBytes, 0);
  Object.assign(output, { coldRequestCreatesNoWorkerSynchronously: true, cancelledGenerationNeverPosts: true, latestIntentDrains: true, hiddenRetiresInstalledContext: true, previousFrameRetainedUntilReplacement: true, peakLiveProducer: peak, peakInstalledBytes });
  // Unmount during pending copy cannot spawn a late producer.
  const pending = createCarryPreparation({ renderer: true }), stopPending = pending.mount(), before = workers.length;
  pending.primeContext(shells.back, visibility); stopPending(); await sleep(30); assert.equal(workers.length, before);
  assert.equal(pending.inspectRendererResources().bytes, 0); output.disposePendingNoLateWorker = true;
  const shared = createCarryPreparation({ renderer: true }), stopShared = shared.mount(), beforeShared = workers.length;
  shared.primeContext(shells.back,visibility); shared.request(input,shells.back,visibility);
  assert.equal(workers.length,beforeShared); await until(()=>!!shared.getSnapshot().frame);
  assert.equal(workers.length,beforeShared+1);
  const sharedFirst=shared.getSnapshot().frame;
  shared.request({...input,pack:{...input.pack,peel:.9}},shells.back,visibility);
  await until(()=>shared.getSnapshot().frame!==sharedFirst);assert.equal(workers.length,beforeShared+1);
  shared.commit();stopShared();assert.equal(live,0);assert.equal(installedBytes,0);
  output.inFlightPrimeAndColdRequestShareOneCopy=true;output.installedContextPickupDoesNotConstructWorker=true;
  failContext = true;
  const failed = createCarryPreparation({ renderer: true }), stopFailed = failed.mount(); failed.primeContext(shells.back, visibility);
  await until(() => failed.getSnapshot().error !== null); assert.equal(failed.getSnapshot().frame, null); stopFailed(); assert.equal(live, 0); assert.equal(failed.inspectRendererResources().bytes, 0); failContext = false;
  output.contextPostFailureRetiresProducer = true;
  const small = new BoxGeometry(); small.computeBoundingSphere();
  const over = { ...original, coordinates: new Float64Array() }; Object.defineProperty(over.coordinates, 'byteLength', { value: MAX_CARRY_CONTEXT_BYTES + 1 });
  assert.throws(() => carryContextSource(small, over, null), /capacity/); small.dispose(); output.overCapacityRejectedBeforeCopy = true;
  assert.deepEqual(borrowed.map(hash), hashes); assert.deepEqual(borrowed.map(array => array.byteLength), sizes);
  assert.equal(runtime.inspectRendererResources().bytes, 0); output.finalZero = true;
  await Bun.write(new URL('./check.json', import.meta.url), JSON.stringify(output, null, 2) + '\n'); console.log(output);
} finally { unmount(); for (const worker of workers) worker.terminate(); Object.defineProperty(globalThis, 'Worker', { value: NativeWorker, configurable: true }); shells.front.dispose(); shells.back.dispose(); hardware.forEach(part => part.geometry.dispose()); collision.dispose(); }
