import { atom } from 'jotai'
import { stickerInventoryAtom, stickerInteractionAtom } from '@webpod/state'
import { STICKER_CATALOGUE, STICKER_GENRES, type StickerDefinition, type StickerGenre, type StickerInventory, type StickerPlacement, type StickerId } from '@webpod/stickers'

/** Display milestones mirror the v1 earning policy; ownership always comes from inventory. */
export const COLLECTION_MINUTES = [5, 15, 60, 180, 600] as const
const INKS: Readonly<Record<StickerGenre, string>> = { metal: '#88927d', pop: '#d68c93', rock: '#c96c39', 'hip-hop': '#c8a452', rnb: '#b48a83', electronic: '#6f9ac4', indie: '#a7b58d', jazz: '#799ba9', classical: '#aba28a', country: '#c49d71', reggae: '#98a76b', latin: '#c88254' }
export interface CollectionSlot {
  readonly art: StickerDefinition
  readonly state: 'locked' | 'sealed' | 'earned' | 'placed'
  readonly thresholdMinutes: number
  readonly remainingMinutes: number
  readonly meaning: string
}
export interface StickerGenreCollection {
  readonly genre: StickerGenre
  readonly title: string
  readonly ink: string
  readonly slots: readonly CollectionSlot[]
  readonly earned: number
  readonly listenedMinutes: number
  readonly unopenedPackIds: readonly string[]
}
/** Groups genre sheets without mistaking a mixed starter grant for a genre collection. */
export function collectStickerSheets(inventory: StickerInventory | null): readonly StickerGenreCollection[] {
  if (inventory === null) return []
  return STICKER_GENRES.flatMap((genre) => {
    const arts = STICKER_CATALOGUE.filter((art) => art.genre === genre)
    const owned = arts.filter((art) => inventory.stickerIds.includes(art.id))
    if (owned.length === 0) return []
    const listenedMinutes = (inventory.progress.find((row) => row.genre === genre)?.listenedMs ?? 0) / 60_000
    const slots = arts.map((art, index): CollectionSlot => {
      const thresholdMinutes = COLLECTION_MINUTES[index] ?? 600
      const earned = inventory.stickerIds.includes(art.id)
      const opened = inventory.packs.some((pack) => pack.openedAt !== null && pack.stickerIds.includes(art.id))
      const state = !earned ? 'locked' : inventory.placements.some((placement) => placement.stickerId === art.id) ? 'placed' : opened ? 'earned' : 'sealed'
      const starter = inventory.packs.some((pack) => pack.source === 'starter' && pack.stickerIds.includes(art.id))
      return { art, state, thresholdMinutes, remainingMinutes: Math.max(0, Math.ceil(thresholdMinutes - listenedMinutes)), meaning: starter ? `A first mark from the ${genreLabel(genre)} in your Apple Music library.` : `A mark for ${formatListeningMinutes(thresholdMinutes)} of ${genreLabel(genre)} listened to in webPod.` }
    })
    return [{ genre, title: arts[0]?.collection ?? genre, ink: INKS[genre], slots, earned: owned.length, listenedMinutes, unopenedPackIds: inventory.packs.filter((pack) => pack.openedAt === null && pack.stickerIds.some((id) => owned.some((art) => art.id === id))).map((pack) => pack.id) }]
  })
}
export const genreLabel = (genre: StickerGenre): string => genre === 'rnb' ? 'R&B' : genre === 'hip-hop' ? 'hip-hop' : genre
export const formatListeningMinutes = (minutes: number): string => minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hr` : `${minutes} min`
export const selectedStickerGenreAtom = atom<StickerGenre | null>(null)
export const stickerSheetRevealAtom = atom(0)
export const stickerDetailIdAtom = atom<string | null>(null)
export const stickerCollectionsAtom = atom((get) => collectStickerSheets(get(stickerInventoryAtom)))
export const requestedStickerCollectionAtom = atom((get) => {
  const collections = get(stickerCollectionsAtom)
  const selected = get(selectedStickerGenreAtom)
  const currentPack = get(stickerInventoryAtom)?.packs.find((pack) => pack.id === get(stickerInteractionAtom).packId)
  return collections.find((collection) => collection.genre === selected)
    ?? collections.find((collection) => collection.slots.some((slot) => currentPack?.stickerIds.includes(slot.art.id))) ?? collections[0] ?? null
})

export const stickerDragOffsetAtom = atom<{ readonly x: number; readonly y: number } | null>(null)

/** A keyboard/detail intent may reuse only the preview owned by that exact sticker. */
export function stickerPlacementForIntent(id: StickerId, preview: StickerPlacement | null, width: number): StickerPlacement {
  return preview?.stickerId === id ? preview : { stickerId: id, surface: 'back', x: .5, y: .5, width, rotationDeg: 0 }
}

/** Peel resistance preserves contact until the final edge releases; free vinyl then relaxes. */
export function stickerPeelMotion(x: number, y: number, reduced: boolean, travel = 64, releasedDistance = 0) {
  const distance = Math.max(Math.hypot(x, y), releasedDistance);
  if (reduced) return { peel: 0, detached: distance >= 12, offset: distance < 12 ? null : { x, y } };
  if (distance <= travel) return { peel: distance / travel, detached: false, offset: null };
  const free = distance - travel;
  const recover = Math.min(1, free / travel);
  const ease = recover * recover * (3 - 2 * recover);
  const factor = 1 - travel * (1 - ease) / distance;
  return { peel: 1 - Math.min(1, free / 100) * .6, detached: true, offset: { x: x * factor, y: y * factor } };
}

export const stickerWorkspaceLoweringAtom = atom(0);

/** Active collection readiness is independent of counter/import refresh status. */
export const stickerPreparedIdsAtom = atom<readonly string[]>([])
export const stickerCollectionUsableAtom = atom((get) => {
  const collection = get(activeStickerCollectionAtom)
  const prepared = get(stickerPreparedIdsAtom)
  return collection !== null && collection.slots.every((slot) => prepared.includes(slot.art.id))
})

/** Keep the displayed ready packet while the next requested genre is being prepared. */
export const displayedStickerGenreAtom = atom<StickerGenre | null>(null)
export const activeStickerCollectionAtom = atom((get) => {
  const displayed = get(displayedStickerGenreAtom)
  return get(stickerCollectionsAtom).find((collection) => collection.genre === displayed) ?? get(requestedStickerCollectionAtom)
})
export const stickerPreparationIdsAtom = atom((get) => [...new Set([get(activeStickerCollectionAtom), get(requestedStickerCollectionAtom)].flatMap((collection) => collection?.slots.map((slot) => slot.art.id) ?? []))])

/** Semantic rear controls refresh after the renderer publishes its physical frame. */
export const stickerProjectionVersionAtom = atom(0)
