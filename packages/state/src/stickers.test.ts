import { describe, expect, test } from 'bun:test';
import { createStore } from 'jotai';
import type { StickerInventory } from '@webpod/stickers';
import { equipStickerActionAtom, equippedStickersAtom, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom, setStickerInteractionActionAtom, stickerCollectionStatusAtom, stickerInteractionAtom } from './stickers';
const inventory: StickerInventory = { stickerIds: ['PW-A01'], packs: [{ id: 'starter', source: 'starter', stickerIds: ['PW-A01'], earnedAt: 1, openedAt: null }], placements: [], placementRevision: 0, progress: [], importStatus: 'complete' };
describe('externally shared sticker state', () => {
  test('external writes notify rendered selectors and reject unearned/invalid placements', () => {
    const store = createStore();
    store.set(receiveStickerInventoryActionAtom, inventory);
    let notifications = 0;
    const unsubscribe = store.sub(equippedStickersAtom, () => { notifications++; });
    const placement = { stickerId: 'PW-A01', surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0 } as const;
    expect(store.set(equipStickerActionAtom, placement)).toBe(true);
    expect(store.get(equippedStickersAtom)).toEqual([placement]);
    expect(notifications).toBe(1);
    expect(store.set(equipStickerActionAtom, { ...placement, stickerId: 'PW-A02' })).toBe(false);
    expect(store.set(equipStickerActionAtom, { ...placement, x: Number.NaN })).toBe(false);
    expect(store.set(equipStickerActionAtom, { ...placement, width: .35, x: .9 })).toBe(false);
    unsubscribe();
  });
  test('duplicate equips replace and account reset clears all gesture/inventory state', () => {
    const store = createStore(); store.set(receiveStickerInventoryActionAtom, inventory);
    const placement = { stickerId: 'PW-A01', surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0 } as const;
    store.set(equipStickerActionAtom, placement); store.set(equipStickerActionAtom, { ...placement, y: .6 });
    expect(store.get(equippedStickersAtom)).toHaveLength(1);
    expect(store.set(setStickerInteractionActionAtom, { stage: 'peeling', packId: 'starter', selectedStickerId: 'PW-A01', progress: 1, peel: .5, previewPlacement: placement, landing: .2 })).toBe(true);
    store.set(resetStickerCollectionActionAtom);
    expect(store.get(equippedStickersAtom)).toEqual([]);
    expect(store.get(stickerCollectionStatusAtom)).toBe('signed-out');
    expect(store.get(stickerInteractionAtom).stage).toBe('hidden');
    expect(store.get(stickerInteractionAtom).previewPlacement).toBeNull();
  });
});
