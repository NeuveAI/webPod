import type { StickerCollisionFace, StickerCollisionSnapshot } from './sticker-collision';

export interface CollisionWorkerFace {
  readonly positions: Float64Array;
  readonly indices: Uint32Array | null;
  readonly transform: number[];
  readonly source: string;
  readonly kind: 'surface' | 'bridge';
  readonly adhesiveSupport: boolean;
}
/** Copies only collision inputs. Rendering buffers never leave their owner. */
export function collisionWorkerFaces(faces: readonly StickerCollisionFace[]): CollisionWorkerFace[] {
  return faces.map(face => {
    const attribute = face.geometry.getAttribute('position'), index = face.geometry.index;
    const positions = new Float64Array(attribute.count * 3);
    for (let i = 0; i < attribute.count; i++) {
      positions[i * 3] = attribute.getX(i); positions[i * 3 + 1] = attribute.getY(i); positions[i * 3 + 2] = attribute.getZ(i);
    }
    return { positions, indices: index ? Uint32Array.from(index.array) : null,
      transform: face.transform?.toArray() ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], source: face.source, kind: face.kind, adhesiveSupport: face.adhesiveSupport === true };
  });
}
export function prepareCollisionInWorker(faces: readonly StickerCollisionFace[], signal: AbortSignal): Promise<StickerCollisionSnapshot> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./sticker-collision-worker.ts', import.meta.url), { type: 'module' });
    const finish = (): void => { clearTimeout(deadline); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = (): void => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
    const deadline = setTimeout(() => { finish(); reject(new Error('Collision preparation timed out')); }, 15000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ snapshot?: StickerCollisionSnapshot; error?: string }>) => {
      finish();
      if (event.data.snapshot) resolve(event.data.snapshot); else reject(new Error(event.data.error ?? 'Collision preparation failed'));
    };
    worker.onerror = () => { finish(); reject(new Error('Collision worker failed')); };
    try {
      const input = collisionWorkerFaces(faces);
      worker.postMessage(input, input.flatMap(face => face.indices ? [face.positions.buffer, face.indices.buffer] : [face.positions.buffer]));
    } catch (error) { finish(); reject(error); }
  });
}
