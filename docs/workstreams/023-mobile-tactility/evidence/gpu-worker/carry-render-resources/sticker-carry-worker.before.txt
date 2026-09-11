import type { StickerBoundsIndex } from './sticker-bounds-index';
import { bindStickerWrapSurface, createStickerWrapSurface } from './sticker-wrap';
import type { DeviceFormParams } from './form';
import { createStickerCollision, type StickerCollisionSnapshot } from './sticker-collision';
import { computeStickerCarry, type CarryInput } from './sticker-carry-computation';
import { restorePaperGeometry, transferPaperGeometry, type PaperGeometryTransfer } from './sticker-paper-transfer';
import { createStickerSurfaceGeometry } from './sticker-surface';
import type { BufferGeometry } from 'three';

export type CarryWorkerMessage = { readonly context: { readonly rear: PaperGeometryTransfer; readonly form: DeviceFormParams | null; readonly collision: StickerCollisionSnapshot } } | { readonly id: number; readonly input: CarryInput };
export interface CarryWorkerResult { readonly id: number; readonly bounds?: StickerBoundsIndex; readonly geometry?: PaperGeometryTransfer; readonly wearGeometry?: PaperGeometryTransfer | null; readonly wearRevision?: number; readonly pointerError?: number | null; readonly error?: string }
let rear: BufferGeometry | null = null, collider: ReturnType<typeof createStickerCollision> | null = null;
let source: BufferGeometry | null = null, target: BufferGeometry | null = null, sourceKey = '', targetKey = '';
let sentWear: BufferGeometry | null | undefined, wearRevision = 0;
self.onmessage = ({ data }: MessageEvent<CarryWorkerMessage>) => {
  if ('context' in data) {
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
    const transfer = [geometry, ...(wearGeometry ? [wearGeometry] : [])].flatMap(value => [value.position.buffer, value.normal.buffer, ...(value.uv ? [value.uv.buffer] : []), ...(value.index ? [value.index.buffer] : [])]);
    transfer.push(result.bounds.bounds.buffer, result.bounds.nodes.buffer, result.bounds.seeds.buffer);
    self.postMessage({ id: data.id, bounds: result.bounds, geometry, wearGeometry, wearRevision, pointerError: result.pointerError } satisfies CarryWorkerResult, { transfer });
    sentWear = wear;
  } catch { self.postMessage({ id: data.id, error: 'Sticker deformation failed' } satisfies CarryWorkerResult); }
  finally { shown?.dispose(); }
};
