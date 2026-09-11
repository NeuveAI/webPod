import { createStickerBoundsIndex, setStickerBoundsIndex } from './sticker-bounds-index';
import { yieldSteps } from './sticker-computation-steps';
import { createStickerSurfaceGeometrySteps } from './sticker-surface';
import type { StickerArtwork, DeviceStickerPlacement } from './sticker-contract';
import type { StickerWrapSurface } from './sticker-wrap';
import { atom, createStore, useAtomValue } from 'jotai';
import { useLayoutEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { restoreShell } from './immutable-shell-transfer';
import { requestStickerTransaction } from './sticker-transaction-broker';
import { registerPreparedStickerResources } from './sticker-transaction-client';
import type { StickerSurfaceRequest } from './sticker-transaction-data';
import { createLatestStickerPreparation } from './sticker-latest-preparation';
interface PreparedSurface { readonly geometry: BufferGeometry; readonly placement: DeviceStickerPlacement; release(): void }
interface SurfaceInput { readonly input: StickerSurfaceRequest | null; readonly custom: { readonly art: StickerArtwork; readonly placement: DeviceStickerPlacement; readonly rear: BufferGeometry; readonly wrap: StickerWrapSurface }; readonly onError?: (id: string) => void }
async function prepareSurface({ input, custom }: SurfaceInput, signal: AbortSignal): Promise<PreparedSurface> {
  if (!input) {
    const geometry = await yieldSteps(createStickerSurfaceGeometrySteps(custom.art, custom.placement, custom.rear, custom.wrap), signal);
    try { setStickerBoundsIndex(geometry, await yieldSteps(createStickerBoundsIndex(geometry.getAttribute('position').array), signal)); let released = false; return { geometry, placement: custom.placement, release() { if (!released) { released = true; geometry.dispose(); } } }; }
    catch (error) { geometry.dispose(); throw error; }
  }
  const key = `surface:${JSON.stringify(input)}`, lease = await requestStickerTransaction(key, input, signal);
  try {
    if (lease.value.kind !== 'surface') throw new Error('Unexpected sticker surface result');
    const geometry = restoreShell(lease.value.geometry); setStickerBoundsIndex(geometry, lease.value.bounds);
    registerPreparedStickerResources(geometry, [{ key, input }]);
    let released = false;
    return { geometry, placement: input.placement, release() { if (!released) { released = true; geometry.dispose(); lease.release(); } } };
  } catch (error) { lease.release(); throw error; }
}
/** Adopt exact geometry and placement together. Same-gesture progress can finish
 * while a newer sample waits; art/form/epoch changes invalidate old publication. */
export function usePreparedStickerSurface(input: StickerSurfaceRequest | null, custom: SurfaceInput['custom'], computationEpoch: number, onError?: (id: string) => void): PreparedSurface | null {
  const owner = useMemo(() => {
    const store = createStore(), state = atom<PreparedSurface | null>(null), retired = new Set<PreparedSurface>();
    return { store, state, retired, runtime: createLatestStickerPreparation(prepareSurface, value => { const previous = store.get(state); if (previous) retired.add(previous); store.set(state, value); }, input => input.onError?.(input.custom.art.id)) };
  }, []);
  const current = useAtomValue(owner.state, { store: owner.store });
  useLayoutEffect(() => { owner.runtime.request({ input, custom, onError }, JSON.stringify([custom.art, input?.form, computationEpoch])); }, [owner, input, custom, computationEpoch, onError]);
  useLayoutEffect(() => () => { owner.runtime.dispose(); owner.store.get(owner.state)?.release(); for (const value of owner.retired) value.release(); owner.retired.clear(); }, [owner]);
  useLayoutEffect(() => { for (const value of owner.retired) if (value !== current) { value.release(); owner.retired.delete(value); } return () => current?.release(); }, [owner, current]);
  return current?.placement.stickerId === custom.placement.stickerId ? current : null;
}
