import { useCallback, useSyncExternalStore } from 'react';
import { DataTexture, LinearFilter, RGBAFormat, TextureLoader, UnsignedByteType } from 'three';
import { STICKER_MICROTEXTURE_AMPLITUDE } from './materials';

import { createStickerTextureCache, EMPTY_STICKER_TEXTURE, type StickerTextureSnapshot } from './sticker-texture-cache';

const artworkTextures = createStickerTextureCache((url, success, failure) => {
  new TextureLoader().load(url, success, undefined, failure);
});
/** One attempt for each failed/live asset, with shared subscribers deduplicated. */
let preparationEpoch = 0;
const preparationListeners = new Set<() => void>();
/** Explicit retry also retries shader preparation without redownloading successful textures. */
export function retryStickerArtwork(): number {
  const attempts = artworkTextures.retryFailed();
  preparationEpoch++;
  for (const listener of preparationListeners) listener();
  return attempts;
}
const subscribePreparation = (listener: () => void): (() => void) => { preparationListeners.add(listener); return () => { preparationListeners.delete(listener); }; };
export function useStickerPreparationEpoch(): number { return useSyncExternalStore(subscribePreparation, () => preparationEpoch, () => 0); }

export function useStickerTexture(url: string): StickerTextureSnapshot {
  const subscribe = useCallback((listener: () => void) => artworkTextures.subscribe(url, listener), [url]);
  const snapshot = useCallback(() => artworkTextures.getSnapshot(url), [url]);
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_STICKER_TEXTURE);
}
/** Deterministic non-color variation, owned by the mounted surface collection. */
export function createStickerRoughness(): DataTexture {
  const size = 64;
  const values = new Uint8Array(size * size * 4);
  let seed = 0x504c4159;
  for (let index = 0; index < values.length; index += 4) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const signed = (seed >>> 0) / 0xffffffff * 2 - 1;
    const value = Math.round(255 * (1 - STICKER_MICROTEXTURE_AMPLITUDE + signed * STICKER_MICROTEXTURE_AMPLITUDE));
    values[index] = value; values[index + 1] = value; values[index + 2] = value; values[index + 3] = 255;
  }
  const texture = new DataTexture(values, size, size, RGBAFormat, UnsignedByteType);
  texture.minFilter = LinearFilter; texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Non-React ownership of the same artwork cache used by StickerPrint. A
 * renderer generation retains this lease through upload/query use; release
 * drops only its subscriber and never disposes another mounted owner's map. */
export function acquireStickerTexture(url: string, listener: () => void) {
  const unsubscribe = artworkTextures.subscribe(url, listener);
  let released = false;
  return { read: () => artworkTextures.getSnapshot(url), release() { if (released) return; released = true; unsubscribe(); } };
}
