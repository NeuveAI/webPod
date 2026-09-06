import { createStickerSessions } from './sessions.ts'
import { and, desc, eq, sql } from 'drizzle-orm'
import {
  STICKER_GENRES, getSticker, isStickerPlacement, MAX_STICKER_PLACEMENTS,
  type ListeningObservation, type StickerGenre, type StickerId, type StickerInventory, type StickerPlacement, type StickerAppearance,
} from '@webpod/stickers'
import type { StickerDatabase } from './database.ts'
import * as tables from './schema.ts'
import { genreStickers, LISTENING_THRESHOLDS_MS, MAX_CREDIT_PER_OBSERVATION_MS, MAX_OBSERVATION_GAP_MS, strongestGenres } from './policy.ts'

export class StickerError extends Error {
  readonly _tag = 'StickerError'
  constructor(readonly code: string, readonly status: number, message: string) { super(message); this.name = 'StickerError' }
}
export interface ImportedTrack { readonly catalogId: string; readonly genre: StickerGenre | null; readonly durationMs: number }

/** All repository entry points require a previously authenticated opaque owner. No network inside transactions. */
export function createStickerRepository(db: StickerDatabase, now: () => number = Date.now) {
  function collection(owner: string) {
    const value = db.select().from(tables.collections).where(eq(tables.collections.owner, owner)).get()
    if (value === undefined) throw new StickerError('unauthorized', 401, 'Sign in to collect stickers.')
    return value
  }
  function inventory(owner: string): StickerInventory {
    const value = collection(owner)
    const ownedPacks = db.select().from(tables.packs).where(eq(tables.packs.owner, owner)).all()
    const earned = [...new Set(ownedPacks.flatMap((pack) => pack.stickerIds))]
    const totals = db.select().from(tables.credits).where(eq(tables.credits.owner, owner)).all()
    return {
      stickerIds: earned, packs: ownedPacks.map(({ id, source, stickerIds, earnedAt, openedAt }) => ({ id, source, stickerIds, earnedAt, openedAt })),
      appearances: value.appearances,
      placements: value.placements.map(({ wear: _storedWear, ...placement }) => { void _storedWear; const appearance = value.appearances.find((entry) => entry.stickerId === placement.stickerId); return appearance === undefined ? placement : { ...placement, wear: appearance.wear } }), placementRevision: value.revision, importStatus: value.importStatus,
      progress: STICKER_GENRES.map((genre) => {
        const listenedMs = totals.find((row) => row.genre === genre)?.listenedMs ?? 0
        const nextIndex = genreStickers(genre).findIndex((sticker) => !earned.includes(sticker.id))
        return { genre, listenedMs, nextThresholdMs: nextIndex < 0 ? null : LISTENING_THRESHOLDS_MS[nextIndex] ?? null }
      }),
    }
  }
  function grant(owner: string, grantKey: string, source: 'starter' | 'listening', stickerIds: readonly StickerId[]) {
    if (stickerIds.length === 0) return
    db.insert(tables.packs).values({ id: crypto.randomUUID(), owner, grantKey, source, stickerIds, earnedAt: now() }).onConflictDoNothing().run()
  }
  /** Library membership and catalogue resolution are independent provenance. Catalogue non-null metadata wins;
   * weak/null snapshots never erase known metadata, and a checked unknown does not trigger endless enrichment. */
  function mergeTrack(owner: string, track: ImportedTrack, source: 'library' | 'catalog') {
    const prior = db.select().from(tables.tracks).where(and(eq(tables.tracks.owner, owner), eq(tables.tracks.catalogId, track.catalogId))).get()
    const catalogueWins = source === 'catalog' || prior?.catalogChecked !== true
    const values = {
      ...track, owner,
      genre: catalogueWins ? track.genre ?? prior?.genre ?? null : prior.genre ?? track.genre,
      durationMs: catalogueWins ? track.durationMs : prior.durationMs,
      source: source === 'library' || prior?.source === 'library' ? 'library' as const : 'catalog' as const,
      catalogChecked: source === 'catalog' || prior?.catalogChecked === true,
    }
    db.insert(tables.tracks).values(values).onConflictDoUpdate({ target: [tables.tracks.owner, tables.tracks.catalogId], set: values }).run()
  }
  return {
    sessions: createStickerSessions(db, now),
    inventory,
    ensureOwner(owner: string) {
      db.insert(tables.collections).values({ owner, createdAt: now() }).onConflictDoNothing().run()
    },
    importTracks(owner: string, imported: readonly ImportedTrack[], status: 'complete' | 'partial') {
      db.transaction(() => {
        const account = collection(owner)
        for (const track of imported) mergeTrack(owner, track, 'library')
        const taste = db.select().from(tables.tracks).where(and(eq(tables.tracks.owner, owner), eq(tables.tracks.source, 'library'))).all()
        const strongest = strongestGenres(taste)
        if (!account.starterEvaluated && strongest.length > 0) {
          const owned = new Set(db.select().from(tables.packs).where(eq(tables.packs.owner, owner)).all().flatMap((pack) => pack.stickerIds))
          const first = strongest.flatMap((genre) => { const sticker = genreStickers(genre)[0]; return sticker === undefined || owned.has(sticker.id) ? [] : [sticker.id] })
          grant(owner, 'starter:v1', 'starter', first)
          // Supported taste consumes the one starter evaluation, even when every eligible first sticker is
          // already owned. Never emit an empty pack or upgrade to an unearned higher-tier sticker.
          db.update(tables.collections).set({ starterEvaluated: true }).where(eq(tables.collections.owner, owner)).run()
        }
        db.update(tables.collections).set({ importStatus: status }).where(eq(tables.collections.owner, owner)).run()
      }, { behavior: 'immediate' })
      return inventory(owner)
    },
    markImportFailed(owner: string) {
      db.update(tables.collections).set({ importStatus: 'failed' }).where(eq(tables.collections.owner, owner)).run()
    },
    hasTrack(owner: string, catalogId: string) {
      return db.select().from(tables.tracks).where(and(eq(tables.tracks.owner, owner), eq(tables.tracks.catalogId, catalogId))).get() !== undefined
    },
    needsEnrichment(owner: string, catalogId: string) {
      const track = db.select().from(tables.tracks).where(and(eq(tables.tracks.owner, owner), eq(tables.tracks.catalogId, catalogId))).get()
      return track === undefined || (track.genre === null && !track.catalogChecked)
    },
    enrichTrack(owner: string, track: ImportedTrack) {
      db.transaction(() => { collection(owner); mergeTrack(owner, track, 'catalog') }, { behavior: 'immediate' })
    },
    observe(owner: string, observation: ListeningObservation) {
      db.transaction(() => {
        const account = collection(owner)
        if (db.select().from(tables.observations).where(and(eq(tables.observations.owner, owner), eq(tables.observations.eventId, observation.eventId))).get() !== undefined) return
        const previous = db.select().from(tables.observations).where(and(eq(tables.observations.owner, owner), eq(tables.observations.streamId, observation.streamId))).orderBy(desc(tables.observations.sequence)).limit(1).get()
        if (previous !== undefined && observation.sequence <= previous.sequence) throw new StickerError('stale_observation', 409, 'Listening update was already superseded.')
        const track = db.select().from(tables.tracks).where(and(eq(tables.tracks.owner, owner), eq(tables.tracks.catalogId, observation.catalogId))).get()
        const receivedAt = now()
        let creditedMs = 0
        if (previous !== undefined && observation.sequence === previous.sequence + 1 && previous.catalogId === observation.catalogId && previous.playing && observation.playing && track !== undefined) {
          const elapsed = receivedAt - previous.receivedAt
          const moved = observation.positionMs - previous.positionMs
          if (elapsed > 0 && elapsed <= MAX_OBSERVATION_GAP_MS && moved > 0 && moved <= elapsed + 1_500 && observation.positionMs <= track.durationMs + 1_000) {
            creditedMs = Math.floor(Math.max(0, Math.min(moved, elapsed, receivedAt - account.lastCreditAt, MAX_CREDIT_PER_OBSERVATION_MS)))
          }
        }
        db.insert(tables.observations).values({ ...observation, owner, receivedAt, creditedMs }).run()
        if (creditedMs > 0) {
          db.update(tables.collections).set({ lastCreditAt: receivedAt }).where(eq(tables.collections.owner, owner)).run()
          if (track?.genre !== null && track?.genre !== undefined) {
            db.insert(tables.credits).values({ owner, genre: track.genre, listenedMs: creditedMs }).onConflictDoUpdate({ target: [tables.credits.owner, tables.credits.genre], set: { listenedMs: sql`${tables.credits.listenedMs} + ${creditedMs}` } }).run()
            const total = db.select().from(tables.credits).where(and(eq(tables.credits.owner, owner), eq(tables.credits.genre, track.genre))).get()?.listenedMs ?? 0
            const owned = new Set(db.select().from(tables.packs).where(eq(tables.packs.owner, owner)).all().flatMap((pack) => pack.stickerIds))
            genreStickers(track.genre).forEach((sticker, index) => {
              const threshold = LISTENING_THRESHOLDS_MS[index]
              if (threshold !== undefined && total >= threshold && !owned.has(sticker.id)) grant(owner, `listening:v1:${sticker.id}`, 'listening', [sticker.id])
            })
          }
        }
      }, { behavior: 'immediate' })
      return inventory(owner)
    },
    openPack(owner: string, id: string) {
      collection(owner)
      const pack = db.select().from(tables.packs).where(and(eq(tables.packs.owner, owner), eq(tables.packs.id, id))).get()
      if (pack === undefined) throw new StickerError('pack_missing', 404, 'That sticker pack is unavailable.')
      db.update(tables.packs).set({ openedAt: sql`coalesce(${tables.packs.openedAt}, ${now()})` }).where(and(eq(tables.packs.owner, owner), eq(tables.packs.id, id))).run()
      return inventory(owner)
    },
    place(owner: string, revision: number, placements: readonly StickerPlacement[]) {
      db.transaction(() => {
        const current = inventory(owner)
        if (current.placementRevision !== revision) throw new StickerError('placement_conflict', 409, 'Your sticker layout changed. Try again.')
        if (placements.length > MAX_STICKER_PLACEMENTS || new Set(placements.map((p) => p.stickerId)).size !== placements.length
          || placements.some((p) => !isStickerPlacement(p) || getSticker(p.stickerId) === undefined || !current.stickerIds.includes(p.stickerId))) {
          throw new StickerError('invalid_placement', 400, 'Place owned stickers inside the backplate.')
        }
        const appearances = new Map((current.appearances ?? []).map((entry) => [entry.stickerId, entry]))
        for (const placement of placements) if (placement.wear !== undefined) appearances.set(placement.stickerId, { stickerId: placement.stickerId, wear: placement.wear } satisfies StickerAppearance)
        const geometry = placements.map(({ wear, ...placement }) => { void wear; return placement })
        db.update(tables.collections).set({ placements: geometry, appearances: [...appearances.values()], revision: revision + 1 }).where(eq(tables.collections.owner, owner)).run()
      }, { behavior: 'immediate' })
      return inventory(owner)
    },
  }
}
export type StickerRepository = ReturnType<typeof createStickerRepository>
