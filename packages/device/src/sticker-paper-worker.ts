import { drainSteps } from './sticker-computation-steps';
import { prepareStickerPackGeometry, stickerPackGeometryBuffers, type StickerPackGeometryData, type PackResourceWorkerRequest, type PackResourceWorkerResponse } from './sticker-pack-resource-data';
import { createStickerPaperGeometry } from './sticker-paper';
import { transferPaperGeometry, type PaperPreparationInput, type PaperWorkerResponse } from './sticker-paper-transfer';

const resources = new Map<number, StickerPackGeometryData>();
self.onmessage = ({ data }: MessageEvent<{ readonly id: number; readonly input: PaperPreparationInput } | PackResourceWorkerRequest>) => {
  if ('type' in data) {
    if (data.type === 'release-pack') { resources.delete(data.id); return; }
    if (data.type === 'deliver-pack') {
      try {
        const source = resources.get(data.id); if (!source) throw Error('Canonical pack geometry retired');
        const value = structuredClone(source);
        data.port.postMessage({version:1,id:data.deliveryId,value}, stickerPackGeometryBuffers(value));
        self.postMessage({type:'pack-delivered',deliveryId:data.deliveryId} satisfies PackResourceWorkerResponse);
      } catch { self.postMessage({type:'pack-delivered',deliveryId:data.deliveryId,error:'Pack private delivery failed'} satisfies PackResourceWorkerResponse); }
      finally { data.port.close(); }
      return;
    }
    try {
      const value = drainSteps(prepareStickerPackGeometry(data.input)); resources.set(data.id, value);
      const copy = structuredClone(value);
      self.postMessage({type:'pack',id:data.id,value:copy} satisfies PackResourceWorkerResponse,{transfer:stickerPackGeometryBuffers(copy)});
    } catch { resources.delete(data.id); self.postMessage({type:'pack',id:data.id,error:'Pack geometry preparation failed'} satisfies PackResourceWorkerResponse); }
    return;
  }
  let geometry: ReturnType<typeof createStickerPaperGeometry> | undefined;
  try {
    const { width, height, pixel, liner, curl } = data.input;
    if (![width, height, pixel, curl].every(Number.isFinite)) throw new Error('Invalid paper preparation');
    geometry = createStickerPaperGeometry(width, height, pixel, liner, curl);
    const stock = { front: transferPaperGeometry(geometry.front), back: transferPaperGeometry(geometry.back), edge: transferPaperGeometry(geometry.edge) };
    const transfer = Object.values(stock).flatMap(part => [part.position.buffer, part.normal.buffer, ...(part.uv ? [part.uv.buffer] : []), ...(part.index ? [part.index.buffer] : [])]);
    self.postMessage({ id: data.id, stock } satisfies PaperWorkerResponse, { transfer });
  } catch {
    self.postMessage({ id: data.id, error: 'Paper preparation failed' } satisfies PaperWorkerResponse);
  } finally { geometry?.front.dispose(); geometry?.back.dispose(); geometry?.edge.dispose(); }
};
