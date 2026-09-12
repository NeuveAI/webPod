import type { PreparedStickerContour } from './sticker-contour-preparation-data';
import type { StickerBoundsIndex } from './sticker-bounds-index';
import type { Matrix4Tuple } from 'three';
import type { DeviceFormParams } from './form';
import type { DeviceStickerPlacement, StickerArtwork } from './sticker-contract';
import type { StickerAlphaMask, StickerDamageField } from './sticker-alpha';
import type { ShellGeometryTransfer } from './immutable-shell-transfer';

export const STICKER_TRANSACTION_VERSION = 1;
export type StickerGeometryArtwork = Pick<StickerArtwork, 'id' | 'url' | 'width' | 'height' | 'visibleBounds'>;
/** Captured placement and form are immutable; wear is a separate material revision. */
export interface StickerSurfaceRequest {
  readonly kind: 'surface'; readonly art: StickerArtwork; readonly placement: DeviceStickerPlacement; readonly form: DeviceFormParams;
}
export interface StickerDamageRequest {
  readonly kind: 'damage'; readonly artworkKey: string; readonly stickerId: string;
  readonly mask: StickerAlphaMask;
  readonly surface: { readonly normals: Float32Array; readonly uv: Float32Array } | null;
}
export interface StickerFitRequest {
  readonly kind: 'fit'; readonly art: StickerArtwork; readonly placement: DeviceStickerPlacement; readonly form: DeviceFormParams;
  readonly grabbedUv: readonly [number, number]; readonly screen: { readonly x: number; readonly y: number };
  readonly canvas: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  readonly world: Readonly<Matrix4Tuple>; readonly cameraWorld: Readonly<Matrix4Tuple>; readonly cameraProjection: Readonly<Matrix4Tuple>;
}
export interface StickerContourRequest { readonly kind: 'contour'; readonly damageKey: string; readonly geometryKey?: string; readonly field: StickerDamageField; readonly wear: number; readonly positions: Float32Array; readonly uv: Float32Array }
export type StickerTransactionRequest = StickerSurfaceRequest | StickerDamageRequest | StickerFitRequest | StickerContourRequest;
/** Buffers in a result belong to its broker cache lease. Never transfer a mounted
 * lease. Private renderer delivery is a separate broker capability, not ownership implied by this result. */
export type StickerTransactionResult =
  | { readonly kind: 'surface'; readonly geometry: ShellGeometryTransfer; readonly bounds: StickerBoundsIndex }
  | { readonly kind: 'damage'; readonly stickerId: string; readonly field: StickerDamageField; readonly gpu: Uint8Array }
  | { readonly kind: 'contour'; readonly contour: PreparedStickerContour }
  | { readonly kind: 'fit'; readonly placement: DeviceStickerPlacement };
/** Exact shader storage copied from the same canonical damage result. CPU alpha,
 * boundary and distance queries remain on their existing full-result owner. */
export interface StickerRenderDamage { readonly kind: 'render-damage'; readonly stickerId: string; readonly width: number; readonly height: number; readonly gpu: Uint8Array }
export type StickerPrivateTransactionResult = StickerTransactionResult | StickerRenderDamage;
export interface StickerContourWorkerReference { readonly kind: 'contour-reference'; readonly damageId: number; readonly geometryId?: number; readonly positions?: Float32Array; readonly uv?: Float32Array; readonly wear: number }
export type StickerTransactionMessage = { readonly version: typeof STICKER_TRANSACTION_VERSION; readonly id: number; readonly input: StickerTransactionRequest | StickerContourWorkerReference };
export type StickerTransactionResponse = { readonly version: typeof STICKER_TRANSACTION_VERSION; readonly id: number } & ({ readonly result: StickerTransactionResult } | { readonly error: string });

export function stickerTransactionBuffers(result: StickerPrivateTransactionResult): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const add = (view: ArrayBufferView) => { if (!(view.buffer instanceof ArrayBuffer)) throw new Error('Sticker transaction requires private buffers'); buffers.add(view.buffer); };
  if (result.kind === 'render-damage') add(result.gpu);
  if (result.kind === 'surface') { add(result.bounds.bounds); add(result.bounds.nodes); add(result.bounds.seeds); for (const attr of Object.values(result.geometry.attributes)) add(attr.array); if (result.geometry.index) add(result.geometry.index); }
  if (result.kind === 'contour') { add(result.contour.anchors); for (const path of result.contour.paths) { add(path.points); add(path.visiblePoints); } }
  if (result.kind === 'damage') { add(result.gpu); add(result.field.alpha); add(result.field.onset); add(result.field.boundaryCandidates); if (result.field.distance) add(result.field.distance); }
  return [...buffers];
}
