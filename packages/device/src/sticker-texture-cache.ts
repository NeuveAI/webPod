import { SRGBColorSpace, type Texture } from 'three';

export interface StickerTextureSnapshot { readonly texture: Texture | null; readonly failed: boolean }
export const EMPTY_STICKER_TEXTURE: StickerTextureSnapshot = Object.freeze({ texture: null, failed: false });
/** Adapter is injectable so request races and GPU disposal are tested without a browser. */
export type StickerTextureLoad = (url: string, success: (texture: Texture) => void, failure: () => void) => void;
interface Entry { snapshot: StickerTextureSnapshot; listeners: Set<() => void>; generation: number; pending: boolean }

/**
 * One request per subscribed URL. Retries are explicit and bounded to one request
 * per failed entry per invocation; pending/successful entries cannot be restarted.
 */
export function createStickerTextureCache(load: StickerTextureLoad) {
  const entries = new Map<string, Entry>();
  const publish = (entry: Entry, snapshot: StickerTextureSnapshot) => {
    entry.snapshot = snapshot;
    for (const listener of entry.listeners) listener();
  };
  const start = (url: string, entry: Entry) => {
    entry.pending = true;
    const generation = ++entry.generation;
    publish(entry, EMPTY_STICKER_TEXTURE);
    const isCurrent = () => entries.get(url) === entry && entry.listeners.size > 0 && entry.generation === generation && entry.pending;
    load(url, (texture) => {
      if (!isCurrent()) { texture.dispose(); return; }
      entry.pending = false;
      texture.colorSpace = SRGBColorSpace;
      const previous = entry.snapshot.texture;
      publish(entry, { texture, failed: false });
      if (previous !== texture) previous?.dispose();
    }, () => {
      if (!isCurrent()) return;
      entry.pending = false;
      publish(entry, { texture: null, failed: true });
    });
  };
  return {
    getSnapshot(url: string): StickerTextureSnapshot { return entries.get(url)?.snapshot ?? EMPTY_STICKER_TEXTURE; },
    subscribe(url: string, listener: () => void): () => void {
      let entry = entries.get(url);
      const first = entry === undefined;
      if (entry === undefined) {
        entry = { snapshot: EMPTY_STICKER_TEXTURE, listeners: new Set(), generation: 0, pending: false };
        entries.set(url, entry);
      }
      const subscribed = entry;
      subscribed.listeners.add(listener);
      if (first) start(url, subscribed);
      return () => {
        subscribed.listeners.delete(listener);
        if (subscribed.listeners.size === 0 && entries.get(url) === subscribed) {
          entries.delete(url);
          subscribed.generation++;
          subscribed.snapshot.texture?.dispose();
        }
      };
    },
    retryFailed(): number {
      let attempts = 0;
      for (const [url, entry] of entries) {
        if (entry.snapshot.failed && !entry.pending && entry.listeners.size > 0) {
          start(url, entry);
          attempts++;
        }
      }
      return attempts;
    },
  };
}
