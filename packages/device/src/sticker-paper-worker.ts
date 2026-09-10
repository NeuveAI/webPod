import { createStickerPaperGeometry } from './sticker-paper';
import { transferPaperGeometry, type PaperPreparationInput, type PaperWorkerResponse } from './sticker-paper-transfer';

self.onmessage = ({ data }: MessageEvent<{ readonly id: number; readonly input: PaperPreparationInput }>) => {
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
