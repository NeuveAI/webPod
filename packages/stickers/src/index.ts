import { BODY_H, BODY_W } from '@webpod/tokens'
import { getSticker, STICKER_GENRES, type StickerGenre, type StickerId } from './catalogue.ts'
export * from './catalogue.ts'

/** Serializable rear-view placement. x/y are the visible artwork center. */
export interface StickerPlacement {
  readonly stickerId: StickerId
  readonly surface: 'back'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly rotationDeg: number
  /** Omission preserves stored appearance on writes; legacy data renders as zero. */
  readonly wear?: number
}
export interface StickerAppearance { readonly stickerId: StickerId; readonly wear: number }
export const MAX_STICKER_APPEARANCES = 60
export function isStickerWear(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 }
/** Canonical per-owned-sticker appearance; absence means the approved original art. */
export function stickerWear(inventory: Pick<StickerInventory, 'appearances'>, id: string): number {
  return inventory.appearances?.find((appearance) => appearance.stickerId === id)?.wear ?? 0
}
export const MAX_STICKER_PLACEMENTS = 12
export const STICKER_PLACEMENT_BOUNDS = { left: 0.08, right: 0.92, top: 0.06, bottom: 0.94, minWidth: 0.08, maxWidth: 0.35 } as const

/** Shared server/render boundary: the rotated occupied rectangle must fit the rear safe zone. */
export function isStickerPlacement(value: unknown): value is StickerPlacement {
  if (typeof value !== 'object' || value === null) return false
  if (!('stickerId' in value) || typeof value.stickerId !== 'string') return false
  const art = getSticker(value.stickerId)
  if (art === undefined || !('surface' in value) || value.surface !== 'back') return false
  if (!('x' in value) || typeof value.x !== 'number' || !Number.isFinite(value.x)
    || !('y' in value) || typeof value.y !== 'number' || !Number.isFinite(value.y)
    || !('width' in value) || typeof value.width !== 'number' || !Number.isFinite(value.width)
    || !('rotationDeg' in value) || typeof value.rotationDeg !== 'number' || !Number.isFinite(value.rotationDeg)) return false
  if ('wear' in value && !isStickerWear(value.wear)) return false
  const b = STICKER_PLACEMENT_BOUNDS
  if (value.width < b.minWidth || value.width > b.maxWidth || Math.abs(value.rotationDeg) > 180) return false
  const [left, top, right, bottom] = art.visibleBounds
  const heightInWidthUnits = value.width * (bottom - top) / (right - left)
  const radians = value.rotationDeg * Math.PI / 180
  const c = Math.abs(Math.cos(radians)); const s = Math.abs(Math.sin(radians))
  const halfX = (c * value.width + s * heightInWidthUnits) / 2
  const halfY = (s * value.width + c * heightInWidthUnits) * BODY_W / BODY_H / 2
  return value.x - halfX >= b.left && value.x + halfX <= b.right && value.y - halfY >= b.top && value.y + halfY <= b.bottom
}

export interface StickerPack {
  readonly id: string
  readonly source: 'starter' | 'listening'
  readonly stickerIds: readonly StickerId[]
  readonly earnedAt: number
  readonly openedAt: number | null
}
export interface StickerProgress {
  readonly genre: StickerGenre
  readonly listenedMs: number
  readonly nextThresholdMs: number | null
}
export interface StickerInventory {
  readonly stickerIds: readonly StickerId[]
  readonly packs: readonly StickerPack[]
  readonly progress: readonly StickerProgress[]
  readonly placements: readonly StickerPlacement[]
  readonly appearances?: readonly StickerAppearance[]
  readonly placementRevision: number
  readonly importStatus: 'pending' | 'complete' | 'partial' | 'failed'
}
/** One sequential playback observation. Never accepts client genre or credited duration. */
export interface ListeningObservation {
  readonly eventId: string
  readonly streamId: string
  readonly sequence: number
  readonly catalogId: string
  readonly positionMs: number
  readonly playing: boolean
}

function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 }
/** Validates responses before storing server data in shared browser state. */
export function isStickerInventory(value: unknown): value is StickerInventory {
  if (!object(value)) return false
  const ids = value['stickerIds']; const packs = value['packs']; const progress = value['progress']; const placements = value['placements']
  const appearances = value['appearances']
  if (appearances !== undefined && (!Array.isArray(appearances) || appearances.length > MAX_STICKER_APPEARANCES
    || appearances.some((entry: unknown) => !object(entry) || typeof entry['stickerId'] !== 'string' || getSticker(entry['stickerId']) === undefined || !Array.isArray(ids) || !ids.includes(entry['stickerId']) || !isStickerWear(entry['wear']))
    || new Set(appearances.map((entry: { stickerId: string }) => entry.stickerId)).size !== appearances.length)) return false
  return Array.isArray(ids) && ids.length <= 60 && ids.every((id) => typeof id === 'string' && getSticker(id) !== undefined)
    && Array.isArray(packs) && packs.length <= 61 && packs.every((pack: unknown) => object(pack) && typeof pack['id'] === 'string'
      && (pack['source'] === 'starter' || pack['source'] === 'listening') && finite(pack['earnedAt'])
      && (pack['openedAt'] === null || finite(pack['openedAt'])) && Array.isArray(pack['stickerIds'])
      && pack['stickerIds'].every((id: unknown) => typeof id === 'string' && getSticker(id) !== undefined))
    && Array.isArray(progress) && progress.length === 12 && progress.every((row: unknown) => object(row)
      && typeof row['genre'] === 'string' && STICKER_GENRES.some((genre) => genre === row['genre'])
      && finite(row['listenedMs']) && (row['nextThresholdMs'] === null || finite(row['nextThresholdMs'])))
    && Array.isArray(placements) && placements.length <= MAX_STICKER_PLACEMENTS && placements.every(isStickerPlacement)
    && Number.isSafeInteger(value['placementRevision']) && finite(value['placementRevision'])
    && ['pending', 'complete', 'partial', 'failed'].includes(String(value['importStatus']))
}
