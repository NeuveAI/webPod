import assert from 'node:assert/strict';
import {BoxGeometry, Matrix4, PerspectiveCamera} from '../../../../../../packages/device/node_modules/three';
import {createStickerCollision} from '../../../../../../packages/device/src/sticker-collision';
import {createCarryPreparation, type CarryFrame} from '../../../../../../packages/device/src/sticker-carry-preparation';
import {transferPaperGeometry} from '../../../../../../packages/device/src/sticker-paper-transfer';
import {bindStickerWrapSurface, createStickerWrapSurface} from '../../../../../../packages/device/src/sticker-wrap';
import {DEFAULT_DEVICE_FORM} from '../../../../../../packages/device/src/form';
import {getStickerBoundsIndex} from '../../../../../../packages/device/src/sticker-bounds-index';
import {carryRenderBuffers, type CarryRenderAck, type CarryRenderPayload} from '../../../../../../packages/device/src/sticker-carry-render-resources';
import type {CarryInput} from '../../../../../../packages/device/src/sticker-carry-computation';
import type {CarryWorkerResult, CarryWorkerMessage} from '../../../../../../packages/device/src/sticker-carry-worker';
const until = async (check: () => boolean) => {for (let index = 0; index < 1000; index++) {if (check()) return; await new Promise(resolve => setTimeout(resolve, 5));} throw Error('Deadline');};
const NativeWorker = globalThis.Worker;
let hold = false, computed = 0;
const workers: ObservedWorker[] = [];
class ObservedWorker {
  readonly actual: Worker;
  onmessage: ((event: MessageEvent<CarryWorkerResult | CarryRenderAck>) => void) | null = null;
  onerror: (() => void) | null = null; onmessageerror: (() => void) | null = null;
  readonly held: CarryRenderAck[] = []; terminated = false;
  constructor(url: URL, options: WorkerOptions) {
    this.actual = new NativeWorker(url, options); workers.push(this);
    this.actual.onmessage = (event: MessageEvent<CarryWorkerResult | CarryRenderAck>) => {
      if ('type' in event.data && event.data.type === 'carry-render-copied' && hold) {this.held.push(event.data); return;}
      this.onmessage?.(event);
    };
    this.actual.onerror = () => this.onerror?.(); this.actual.onmessageerror = () => this.onmessageerror?.();
  }
  postMessage(message: CarryWorkerMessage, transfer: Transferable[] = []) {if ('input' in message) computed++; this.actual.postMessage(message, transfer);}
  terminate() {this.terminated = true; return this.actual.terminate();}
}
Object.defineProperty(globalThis, 'Worker', {value: ObservedWorker, configurable: true});
Object.defineProperty(globalThis, 'document', {value: Object.assign(new EventTarget(), {hidden: false}), configurable: true});
const rear = new BoxGeometry(330, 550, 50); rear.computeBoundingSphere(); bindStickerWrapSurface(rear, createStickerWrapSurface(DEFAULT_DEVICE_FORM, []));
const collision = createStickerCollision([{geometry: rear, source: 'box', kind: 'surface'}]);
const visibility = {ready: true, revision: 1, snapshot: () => collision.snapshot()};
const camera = new PerspectiveCamera(40, 440 / 956, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
const art = {id: 'carry-delivery', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const};
const placement = {stickerId: art.id, surface: 'back' as const, x: .8, y: .22, width: .2, rotationDeg: 23};
const input: CarryInput = {art, pack: {progress: 1, stickerId: art.id, sourcePlacement: placement, peel: .3, sourcePeelFront: .3, landing: 0, placement: null, computationEpoch: 1}, width: 66, paperWidth: 300, pixel: 1, seatX: .5, origin: [0, -140, 132], world: new Matrix4().toArray(), cameraWorld: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), viewportWidth: 440, viewportHeight: 956, worldPixel: 1, workspaceBounds: null};
const runtime = createCarryPreparation({renderer: true}), unmount = runtime.mount();
const frame = () => {const value = runtime.getSnapshot().frame; assert(value); return value;};
const take = (value: CarryFrame, signal = new AbortController()) => {
  const channel = new MessageChannel();
  const payload = new Promise<CarryRenderPayload>(resolve => {channel.port2.onmessage = (event: MessageEvent<CarryRenderPayload>) => resolve(event.data);});
  const lease = runtime.acquireRendererFrame(value, channel.port1, signal.signal); void lease.catch(() => {});
  return {channel, payload, lease, signal};
};
const compare = (main: CarryFrame, delivered: CarryRenderPayload) => {
  assert.deepEqual(delivered.geometry, transferPaperGeometry(main.geometry));
  assert.deepEqual(delivered.bounds, getStickerBoundsIndex(main.geometry));
  assert.deepEqual(delivered.wearGeometry, main.wearGeometry ? transferPaperGeometry(main.wearGeometry) : null);
  assert.deepEqual(delivered.stamp, main.renderStamp); assert.equal(delivered.pointerError, main.pointerError);
};
try {
  runtime.request(input, rear, visibility); await until(() => !!runtime.getSnapshot().frame);
  const first = frame(), firstPrivate = take(first), firstLease = await firstPrivate.lease, firstData = await firstPrivate.payload;
  compare(first, firstData); const mainBytes = first.geometry.getAttribute('position').array.byteLength;
  structuredClone(firstData, {transfer: carryRenderBuffers(firstData)}); assert.equal(first.geometry.getAttribute('position').array.byteLength, mainBytes);
  let disposedFirst = 0; first.geometry.addEventListener('dispose', () => disposedFirst++);
  runtime.request({...input, pack: {...input.pack, peel: .5}}, rear, visibility); await until(() => frame() !== first);
  const second = frame(), secondPrivate = take(second), secondLease = await secondPrivate.lease; compare(second, await secondPrivate.payload);
  assert.equal(first.wearGeometry, second.wearGeometry);
  const overflow = take(second); await assert.rejects(overflow.lease); overflow.channel.port2.close();
  assert.equal(runtime.inspectRendererResources().privateOwners, 2);
  const workBefore = computed;
  for (let index = 6; index <= 9; index++) runtime.request({...input, pack: {...input.pack, peel: index / 10}}, rear, visibility);
  assert.equal(computed, workBefore); assert.equal(runtime.inspectRendererResources().canonical, 2);
  runtime.commit(); assert.equal(disposedFirst, 0); firstLease.release(); firstLease.release(); firstPrivate.channel.port2.close(); assert.equal(disposedFirst, 1);
  await until(() => frame().input.pack.peel === .9); assert.equal(computed, workBefore + 1);
  const latest = frame(); runtime.commit(); secondLease.release(); secondPrivate.channel.port2.close();
  const latestPrivate = take(latest), latestLease = await latestPrivate.lease; compare(latest, await latestPrivate.payload);
  const obsolete = latest;
  runtime.request({...input, pack: {...input.pack, computationEpoch: 2, sourcePlacement: {...placement, x: .7}, peel: .95}}, rear, visibility);
  await until(() => frame().input.pack.computationEpoch === 2);
  const stale = take(obsolete); await assert.rejects(stale.lease); stale.channel.port2.close();
  const finalFrame = frame(); hold = true;
  const pending = take(finalFrame); await pending.payload; await until(() => workers.some(worker => worker.held.length > 0));
  assert.equal(runtime.inspectRendererResources().pendingPrivate, 1);
  pending.signal.abort(); await assert.rejects(pending.lease); pending.channel.port2.close();
  const stopped = workers.at(-1); assert(stopped?.terminated); const beforeLate = runtime.inspectRendererResources();
  for (const data of stopped.held) stopped.onmessage?.(new MessageEvent('message', {data}));
  assert.deepEqual(runtime.inspectRendererResources(), beforeLate); assert.equal(beforeLate.privateOwners, 1);
  const unavailable = take(finalFrame); await assert.rejects(unavailable.lease); unavailable.channel.port2.close();
  assert(finalFrame.geometry.getAttribute('position').array.byteLength > 0);
  unmount(); latestLease.release(); latestPrivate.channel.port2.close();
  assert.deepEqual(runtime.inspectRendererResources(), {canonical: 0, privateOwners: 0, pendingPrivate: 0, preparing: false, bytes: 0});
  assert.equal(workers.length, 1);
  assert.equal(runtime.getSnapshot().frame, null);
  Object.defineProperty(globalThis, 'Worker', {value: undefined, configurable: true});
  const unavailableRuntime = createCarryPreparation({renderer: true}), stopUnavailable = unavailableRuntime.mount();
  unavailableRuntime.request(input, rear, visibility);
  assert.equal(unavailableRuntime.getSnapshot().error, 'Native carry producer unavailable');
  assert.equal(unavailableRuntime.getSnapshot().frame, null);
  unavailableRuntime.request({...input, pack: {...input.pack, peel: .8}}, rear, visibility);
  await new Promise<void>(resolve => setTimeout(resolve, 10));
  assert.equal(unavailableRuntime.getSnapshot().frame, null); stopUnavailable();
  assert.equal(unavailableRuntime.inspectRendererResources().bytes, 0);
  await Bun.write(new URL('./check.json', import.meta.url), JSON.stringify({actualModuleWorker: true, mainPrivateExact: true, boundsWearStampParity: true, mountedBuffersNeverDetached: true,
    pinnedQuerySurvivesCommit: true, currentPlusCandidateBound: true, privateAdmissionBound: true, finalLatestJobDrained: true,
    staleOwnerRejected: true, pendingAbortRetiresProducer: true, oldGpuLeaseSurvivesRetirement: true, staleAckIgnored: true,
    unavailablePrivateRejects: true, unavailableWorkerHasNoMainDeformation: true, finalZero: true, resourceBytes: firstLease.bytes, computedJobs: computed, workers: workers.length, browserTimingClaim: false}, null, 2) + '\n');
  console.log('Carry main/private parity and lifecycle passed');
} finally {unmount(); for (const worker of workers) worker.terminate(); rear.dispose(); collision.dispose();}
