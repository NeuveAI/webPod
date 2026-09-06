import { atom, type Atom } from 'jotai';
import { isStickerPlacement, MAX_STICKER_PLACEMENTS, type StickerInventory, type StickerPlacement } from '@webpod/stickers';

export type StickerCollectionStatus = 'signed-out' | 'loading' | 'ready' | 'error';
export type StickerInteractionStage = 'hidden' | 'tease' | 'pulling' | 'open' | 'peeling' | 'placing' | 'settling';
export interface StickerInteraction {
  readonly stage: StickerInteractionStage;
  readonly packId: string | null;
  readonly selectedStickerId: string | null;
  readonly progress: number;
  readonly peel: number;
  readonly previewPlacement: StickerPlacement | null;
  readonly landing: number;
  /** Saved rear pose stays authoritative while a transient print is carried. Null is a sheet origin. */
  readonly sourcePlacement?: StickerPlacement | null;
  readonly returnToSheet?: boolean;
}
export const INITIAL_STICKER_INTERACTION: StickerInteraction = Object.freeze({ stage: 'hidden', packId: null, selectedStickerId: null, progress: 0, peel: 0, previewPlacement: null, landing: 0, sourcePlacement: null, returnToSheet: false });
const inventoryStateAtom = atom<StickerInventory | null>(null);
const statusStateAtom = atom<StickerCollectionStatus>('signed-out');
const interactionStateAtom = atom<StickerInteraction>(INITIAL_STICKER_INTERACTION);
export const stickerInventoryAtom: Atom<StickerInventory | null> = inventoryStateAtom;
export const stickerCollectionStatusAtom: Atom<StickerCollectionStatus> = statusStateAtom;
export const stickerInteractionAtom: Atom<StickerInteraction> = interactionStateAtom;
export const equippedStickersAtom = atom((get) => get(stickerInventoryAtom)?.placements ?? []);

/** Publishes an already API-validated inventory; invalid local placements are rejected. */
export const receiveStickerInventoryActionAtom = atom(null, (_get, set, inventory: StickerInventory): boolean => {
  if (inventory.placements.length > MAX_STICKER_PLACEMENTS || inventory.placements.some((placement) => !isStickerPlacement(placement) || !inventory.stickerIds.includes(placement.stickerId))
    || new Set(inventory.placements.map((placement) => placement.stickerId)).size !== inventory.placements.length) return false;
  set(inventoryStateAtom, inventory);
  set(statusStateAtom, 'ready');
  return true;
});
export const setStickerCollectionStatusActionAtom = atom(null, (_get, set, status: StickerCollectionStatus): void => { set(statusStateAtom, status); });
/** All UI, pointer and WebMCP callers use this one external-store interaction owner. */
export const setStickerInteractionActionAtom = atom(null, (get, set, next: StickerInteraction): boolean => {
  if (!Number.isFinite(next.progress) || !Number.isFinite(next.peel) || !Number.isFinite(next.landing)) return false;
  if (next.previewPlacement !== null && !isStickerPlacement(next.previewPlacement)) return false;
  if (next.sourcePlacement != null && (!isStickerPlacement(next.sourcePlacement) || next.sourcePlacement.stickerId !== next.selectedStickerId)) return false;
  const inventory = get(inventoryStateAtom);
  if (next.selectedStickerId !== null && !inventory?.stickerIds.some((id) => id === next.selectedStickerId)) return false;
  if (next.packId !== null && !inventory?.packs.some((pack) => pack.id === next.packId)) return false;
  set(interactionStateAtom, { ...next, progress: Math.max(0, Math.min(1, next.progress)), peel: Math.max(0, Math.min(1, next.peel)), landing: Math.max(0, Math.min(1, next.landing)) });
  return true;
});
/** Optimistic placement publication; persistence/revision reconciliation belongs to API runtime. */
export const equipStickerActionAtom = atom(null, (get, set, placement: StickerPlacement): boolean => {
  const inventory = get(inventoryStateAtom);
  if (inventory === null || !isStickerPlacement(placement) || !inventory.stickerIds.includes(placement.stickerId)) return false;
  const remaining = inventory.placements.filter((item) => item.stickerId !== placement.stickerId);
  if (remaining.length >= MAX_STICKER_PLACEMENTS) return false;
  set(inventoryStateAtom, { ...inventory, placements: [...remaining, placement] });
  return true;
});
export const removeStickerActionAtom = atom(null, (get, set, stickerId: string): void => {
  const inventory = get(inventoryStateAtom);
  if (inventory !== null) set(inventoryStateAtom, { ...inventory, placements: inventory.placements.filter((placement) => placement.stickerId !== stickerId) });
});
/** Account teardown clears transient gestures as well as persisted-user snapshots. */
export const resetStickerCollectionActionAtom = atom(null, (_get, set): void => {
  set(inventoryStateAtom, null);
  set(statusStateAtom, 'signed-out');
  set(interactionStateAtom, INITIAL_STICKER_INTERACTION);
});
