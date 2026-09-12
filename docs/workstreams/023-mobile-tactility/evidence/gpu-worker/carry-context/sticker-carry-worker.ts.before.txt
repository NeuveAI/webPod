import { carryRenderBuffers, sameCarryRenderStamp, MAX_CARRY_RENDER_RESOURCE_BYTES, type CarryRenderStamp, type CarryRenderPayload, type CarryRenderRequest, type CarryRenderAck } from './sticker-carry-render-resources';
import type { StickerBoundsIndex } from './sticker-bounds-index';
import { bindStickerWrapSurface, createStickerWrapSurface } from './sticker-wrap';
import type { DeviceFormParams } from './form';
import { createStickerCollision, type StickerCollisionSnapshot } from './sticker-collision';
import { computeStickerCarry, type CarryInput } from './sticker-carry-computation';
import { restorePaperGeometry, transferPaperGeometry, type PaperGeometryTransfer } from './sticker-paper-transfer';
import { createStickerSurfaceGeometry } from './sticker-surface';
import type { BufferGeometry } from 'three';

export type CarryWorkerMessage = { readonly context: { readonly rear: PaperGeometryTransfer; readonly form: DeviceFormParams | null; readonly collision: StickerCollisionSnapshot } } | { readonly id: number; readonly input: CarryInput; readonly renderStamp?: CarryRenderStamp } | CarryRenderRequest;
export interface CarryWorkerResult { readonly id: number; readonly renderStamp?: CarryRenderStamp; readonly renderBytes?: number; readonly bounds?: StickerBoundsIndex; readonly geometry?: PaperGeometryTransfer; readonly wearGeometry?: PaperGeometryTransfer | null; readonly wearRevision?: number; readonly pointerError?: number | null; readonly error?: string }
let rear: BufferGeometry | null = null, collider: ReturnType<typeof createStickerCollision> | null = null;
let source: BufferGeometry | null = null, target: BufferGeometry | null = null, sourceKey = '', targetKey = '';
const canonical = new Map<number, CarryRenderPayload>();
let canonicalWear: PaperGeometryTransfer | null = null;
let sentWear: BufferGeometry | null | undefined, wearRevision = 0;
self.onmessage = ({ data }: MessageEvent<CarryWorkerMessage>) => {
  if ('type' in data) {
    const value = canonical.get(data.stamp.jobId);
    if (data.type === 'carry-render-release') { if (value && sameCarryRenderStamp(value.stamp, data.stamp)) canonical.delete(data.stamp.jobId); if (canonical.size === 0) canonicalWear = null; return; }
    self.postMessage({type: 'carry-render-start', stamp: data.stamp, requestId: data.requestId} satisfies CarryRenderAck);
    try {
      if (!value || !sameCarryRenderStamp(value.stamp, data.stamp)) throw Error('Carry canonical result unavailable');
      const copy = structuredClone(value);
      data.port.postMessage(copy, carryRenderBuffers(copy));
      self.postMessage({type: 'carry-render-copied', stamp: data.stamp, requestId: data.requestId} satisfies CarryRenderAck);
    } catch { self.postMessage({type: 'carry-render-copied', stamp: data.stamp, requestId: data.requestId, error: 'Carry private delivery failed'} satisfies CarryRenderAck); }
    finally {data.port.close();}
    return;
  }
  if ('context' in data) {
    canonical.clear(); canonicalWear = null;
    rear?.dispose(); collider?.dispose(); source?.dispose(); target?.dispose(); source = null; target = null; sourceKey = ''; targetKey = ''; sentWear = undefined; wearRevision = 0;
    rear = restorePaperGeometry(data.context.rear); if (data.context.form) bindStickerWrapSurface(rear, createStickerWrapSurface(data.context.form, [])); collider = createStickerCollision([], data.context.collision); return;
  }
  let shown: BufferGeometry | null = null;
  try {
    if (!rear || !collider) throw new Error('Carry assembly is not prepared');
    const { art, pack } = data.input;
    const nextSource = JSON.stringify([art, pack.sourcePlacement ?? null]);
    const nextTarget = JSON.stringify([art, pack.landing > 0 ? pack.placement : null]);
    if (sourceKey !== nextSource) { source?.dispose(); source = null; sourceKey = ''; source = pack.sourcePlacement ? createStickerSurfaceGeometry(art, pack.sourcePlacement, rear) : null; sourceKey = nextSource; }
    if (targetKey !== nextTarget) { target?.dispose(); target = null; targetKey = ''; target = pack.landing > 0 && pack.placement ? createStickerSurfaceGeometry(art, pack.placement, rear) : null; targetKey = nextTarget; }
    const result = computeStickerCarry(data.input, rear, source, target, collider); shown = result.geometry;
    const geometry = transferPaperGeometry(shown), wear = pack.landing > 0 ? target : source;
    const changedWear = wear !== sentWear;
    const wearGeometry = changedWear ? (wear ? transferPaperGeometry(wear) : null) : undefined;
    if (changedWear) wearRevision++;
    let message: CarryWorkerResult = { id: data.id, bounds: result.bounds, geometry, wearGeometry, wearRevision, pointerError: result.pointerError };
    if (data.renderStamp) {
      if (changedWear) canonicalWear = wearGeometry ?? null;
      else if (wear && !canonicalWear) canonicalWear = transferPaperGeometry(wear);
      const payload: CarryRenderPayload = { version: 1, stamp: data.renderStamp, geometry, bounds: result.bounds,
        wearGeometry: canonicalWear, wearRevision, pointerError: result.pointerError };
      const bytes = carryRenderBuffers(payload).reduce((sum, buffer) => sum + buffer.byteLength, 0);
      if (canonical.size >= 2 || bytes > MAX_CARRY_RENDER_RESOURCE_BYTES) throw Error('Carry canonical capacity exceeded');
      canonical.set(data.id, payload);
      message = structuredClone({...message, renderStamp: data.renderStamp, renderBytes: bytes});
    }
    const transfer = [message.geometry, message.wearGeometry].flatMap(value => value ? [value.position.buffer, value.normal.buffer, ...(value.uv ? [value.uv.buffer] : []), ...(value.index ? [value.index.buffer] : [])] : []);
    if (message.bounds) transfer.push(message.bounds.bounds.buffer, message.bounds.nodes.buffer, message.bounds.seeds.buffer);
    self.postMessage(message, { transfer });
    sentWear = wear;
  } catch { self.postMessage({ id: data.id, error: 'Sticker deformation failed' } satisfies CarryWorkerResult); }
  finally { shown?.dispose(); }
};
