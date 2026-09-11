import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
import { preparedDeviceBuffers, type PreparedDeviceRenderLease } from '../../../../../../packages/device/src/device-preparation-data';

const cleanups: (() => void)[] = [];
mock.module('react', () => ({ useLayoutEffect: (effect: () => () => void) => { cleanups.push(effect()); } }));
const { acquirePreparedDeviceForRenderer, usePreparedImmutableShells, inspectDevicePreparation } = await import('../../../../../../packages/device/src/immutable-shell-preparation');
const channel = new MessageChannel(), abort = new AbortController();
const delivered = new Promise<PreparedDeviceRenderLease>(resolve => { channel.port2.onmessage = (event: MessageEvent<PreparedDeviceRenderLease>) => resolve(event.data); });
const lease = await acquirePreparedDeviceForRenderer(DEFAULT_DEVICE_FORM, channel.port1, abort.signal);
const data = await delivered;
assert.equal(data.leaseId, lease.leaseId); assert.equal(data.id, lease.id);
const mounted = usePreparedImmutableShells(DEFAULT_DEVICE_FORM);
assert.equal(mounted, lease.query);
assert.deepEqual(data.result.front.attributes['position']?.array, mounted.front.getAttribute('position').array);
const before = inspectDevicePreparation();
assert.equal(before.entries, 1); assert.equal(before.renderLeases, 1); assert(before.canonicalBytes > 0);
assert.equal(before.accountedBytes, before.canonicalBytes * 3);
// Moving the renderer-private payload again cannot detach mounted/query buffers.
const moved = structuredClone(data.result, { transfer: preparedDeviceBuffers(data.result) });
assert.equal(data.result.front.attributes['position']?.array.byteLength, 0);
assert((mounted.front.getAttribute('position').array.byteLength) > 0);
assert.deepEqual(moved.front.attributes['position']?.array, mounted.front.getAttribute('position').array);
lease.release(); channel.port2.close();
assert.equal(inspectDevicePreparation().renderLeases, 0);
assert.equal(inspectDevicePreparation().worker, true);

// Abort while its copy is queued: reservation cannot vanish while a producer
// remains alive. Main GL/query resources remain exact and usable after failure.
const cancelledChannel = new MessageChannel(), cancelled = new AbortController();
const cancelledLease = acquirePreparedDeviceForRenderer(DEFAULT_DEVICE_FORM, cancelledChannel.port1, cancelled.signal);
cancelled.abort(); await assert.rejects(cancelledLease); cancelledChannel.port2.close();
assert.equal(inspectDevicePreparation().renderLeases, 0);
assert.equal(inspectDevicePreparation().worker, false);
assert.equal(inspectDevicePreparation().canonicalBytes, 0);
assert(mounted.front.getAttribute('position').array.byteLength > 0);
const unavailableChannel = new MessageChannel();
await assert.rejects(acquirePreparedDeviceForRenderer(DEFAULT_DEVICE_FORM, unavailableChannel.port1, new AbortController().signal), /resident prepared recipe/);
unavailableChannel.port2.close(); assert.equal(inspectDevicePreparation().worker, false);
const releaseMounted = cleanups.pop(); assert(releaseMounted); releaseMounted();
await new Promise<void>(resolve => setTimeout(resolve, 10));
assert.equal(inspectDevicePreparation().entries, 0);
const result = {
  method: 'Actual Bun module worker and native MessagePorts; deterministic React commit shim. No browser/GPU or latency claim.',
  checks: { sameHookAndRendererAuthority: true, privateTransferPreservesMountedBuffers: true,
    canonicalMainAndRenderBytesAccounted: true, rendererReleaseRetainsOtherOwner: true,
    pendingAbortTerminatesBeforeReservationRelease: true, failedWorkerDoesNotRecomputeCachedRecipe: true,
    finalOwnerEvictsAndTerminates: true },
  admitted: before,
};
await Bun.write(new URL('./prepared-leases.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(result);
