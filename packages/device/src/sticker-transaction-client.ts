import type { BufferGeometry } from 'three';
import type { DeviceStickerPlacement } from './sticker-contract';
import { acquireStickerTransaction } from './sticker-transaction-broker';
import type { StickerTransactionRequest, StickerFitRequest } from './sticker-transaction-data';
const adopted = new WeakMap<BufferGeometry, DeviceStickerPlacement>();
let surfaceRevision = 0;
/** Geometry and placement are adopted together. Call after the mesh commit so
 * cached picks cannot reuse a hit from the previous visible geometry. */
export function commitPreparedStickerSurface(geometry: BufferGeometry, placement: DeviceStickerPlacement): void { adopted.set(geometry, placement); surfaceRevision++; }
export function preparedStickerPlacement(geometry: BufferGeometry): DeviceStickerPlacement | undefined { return adopted.get(geometry); }
export function preparedStickerSurfaceRevision(): number { return surfaceRevision; }
/** Release fitting captures the final sample and all transform data before any
 * await. Abort releases only this owner; only the caller's current transaction
 * may persist the returned result. No render acknowledgement authorizes a save. */
export async function resolveStickerDropTransaction(input: StickerFitRequest, signal: AbortSignal): Promise<DeviceStickerPlacement> {
  signal.throwIfAborted();
  const lease = acquireStickerTransaction(`fit:${JSON.stringify(input)}`, input);
  const abort = () => lease.release();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await lease.result; signal.throwIfAborted();
    if (result.kind !== 'fit') throw new Error('Unexpected sticker fit result');
    return result.placement;
  } finally { signal.removeEventListener('abort', abort); lease.release(); }
}

export interface PreparedStickerResource { readonly key: string; readonly input: StickerTransactionRequest }
const resources = new WeakMap<BufferGeometry, readonly PreparedStickerResource[]>();
/** Data-only descriptors locate the existing producer cache. They confer no
 * buffer ownership; acquirePrivateStickerTransaction grants a renderer lease. */
export function registerPreparedStickerResources(geometry: BufferGeometry, value: readonly PreparedStickerResource[]): void { resources.set(geometry, value); }
export function preparedStickerResources(geometry: BufferGeometry): readonly PreparedStickerResource[] { return resources.get(geometry) ?? []; }
