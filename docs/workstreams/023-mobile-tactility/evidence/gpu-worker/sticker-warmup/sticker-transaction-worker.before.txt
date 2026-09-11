import { drainSteps } from './sticker-computation-steps';
import { computeStickerTransaction } from './sticker-transaction-computation';
import { STICKER_TRANSACTION_VERSION, stickerTransactionBuffers, type StickerTransactionMessage, type StickerTransactionResponse, type StickerTransactionResult } from './sticker-transaction-data';
const canonical = new Map<number, StickerTransactionResult>();
type ResourceMessage = { readonly type: 'release'; readonly id: number } | { readonly type: 'deliver'; readonly id: number; readonly deliveryId: number; readonly port: MessagePort };
self.onmessage = ({ data }: MessageEvent<StickerTransactionMessage | ResourceMessage>) => {
  if ('type' in data) {
    if (data.type === 'release') { canonical.delete(data.id); return; }
    try {
      const source = canonical.get(data.id); if (!source) throw new Error('Canonical sticker resource was retired');
      const result = structuredClone(source);
      data.port.postMessage({ version: STICKER_TRANSACTION_VERSION, id: data.deliveryId, result }, stickerTransactionBuffers(result));
      self.postMessage({ type: 'delivered', deliveryId: data.deliveryId });
    } catch { self.postMessage({ type: 'delivery-failed', deliveryId: data.deliveryId }); }
    finally { data.port.close(); }
    return;
  }
  try {
    if (data.version !== STICKER_TRANSACTION_VERSION || !Number.isSafeInteger(data.id)) throw new Error('Invalid sticker transaction protocol');
    let input = data.input;
    if (input.kind === 'contour-reference') {
      const damage = canonical.get(input.damageId), geometry = input.geometryId === undefined ? undefined : canonical.get(input.geometryId);
      const positions = geometry?.kind === 'surface' ? geometry.geometry.attributes['position']?.array : input.positions;
      const uv = geometry?.kind === 'surface' ? geometry.geometry.attributes['uv']?.array : input.uv;
      if (damage?.kind !== 'damage' || !(positions instanceof Float32Array) || !(uv instanceof Float32Array)) throw new Error('Contour dependencies retired');
      input = { kind: 'contour', damageKey: String(input.damageId), field: damage.field, wear: input.wear, positions, uv };
    }
    const result = drainSteps(computeStickerTransaction(input));
    canonical.set(data.id, result);
    const main = structuredClone(result);
    self.postMessage({ version: STICKER_TRANSACTION_VERSION, id: data.id, result: main } satisfies StickerTransactionResponse, { transfer: stickerTransactionBuffers(main) });
  } catch (error) {
    canonical.delete(data.id);
    self.postMessage({ version: STICKER_TRANSACTION_VERSION, id: data.id, error: error instanceof Error ? error.message : 'Sticker computation failed' } satisfies StickerTransactionResponse);
  }
};
