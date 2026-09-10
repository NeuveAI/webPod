import { eq } from 'drizzle-orm'
import { getSticker, isStickerPlacement, isStickerWear, MAX_STICKER_PLACEMENTS, STICKER_GENRES } from '@webpod/stickers'
import { createStickerRepository, StickerError } from './repository.ts'
import * as tables from './schema.ts'

type DB = Parameters<typeof createStickerRepository>[0]
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024
const fail = (): never => { throw new StickerError('invalid_backup', 400, 'This is not a valid webPod sticker backup.') }
function record(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(); return v as Record<string, unknown> }
function integer(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return fail(); return v }
function text(v: unknown): string { if (typeof v !== 'string' || !v.length || v.length > 256) return fail(); return v }
function bool(v: unknown): boolean { if (typeof v !== 'boolean') return fail(); return v }
function list(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max) return fail(); return v }
function unique(values: readonly unknown[]) { if (new Set(values).size !== values.length) fail() }
function genre(v: unknown) { const found = STICKER_GENRES.find(g => g === v); return found ?? fail() }
function sticker(v: unknown) { const found = getSticker(text(v)); return found?.id ?? fail() }

export function exportBackup(db: DB, owner: string): string {
  const collection = db.select().from(tables.collections).where(eq(tables.collections.owner, owner)).get()
  if (!collection) return fail()
  const result = JSON.stringify({ format: 'webpod-stickers', version: 1, collection,
    tracks: db.select().from(tables.tracks).where(eq(tables.tracks.owner, owner)).all(),
    credits: db.select().from(tables.credits).where(eq(tables.credits.owner, owner)).all(),
    packs: db.select().from(tables.packs).where(eq(tables.packs.owner, owner)).all(),
  })
  if (new TextEncoder().encode(result).length > MAX_BACKUP_BYTES) throw new StickerError('backup_too_large', 413, 'This collection exceeds the backup size limit.')
  return result
}

/** Semantic JSON only: no SQL/schema/files or server identity is accepted. Parse
 * and validate everything before replacing rows in one rollback-safe transaction.
 * Playback observations are ephemeral and restart after a restore. */
export function importBackup(db: DB, owner: string, json: string) {
  if (typeof json !== 'string' || json.length > MAX_BACKUP_BYTES || new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) return fail()
  let input: unknown
  try { input = JSON.parse(json) } catch { return fail() }
  const root = record(input)
  if (root['format'] !== 'webpod-stickers' || root['version'] !== 1) return fail()
  const c = record(root['collection'])
  const status = c['importStatus']; if (status !== 'pending' && status !== 'complete' && status !== 'partial' && status !== 'failed') return fail()
  const packs = list(root['packs'], 61).map(value => {
    const p = record(value); const source = p['source']; if (source !== 'starter' && source !== 'listening') return fail()
    const stickerIds = list(p['stickerIds'], 3).map(sticker); if (!stickerIds.length) return fail(); unique(stickerIds)
    const grantKey = text(p['grantKey'])
    if (source === 'starter' ? grantKey !== 'starter:v1' : stickerIds.length !== 1 || grantKey !== `listening:v1:${stickerIds[0]}`) return fail()
    return { owner, id: text(p['id']), grantKey, source, stickerIds, earnedAt: integer(p['earnedAt']), openedAt: p['openedAt'] === null ? null : integer(p['openedAt']) } satisfies typeof tables.packs.$inferInsert
  })
  unique(packs.map(p => p.id)); unique(packs.map(p => p.grantKey)); unique(packs.flatMap(p => p.stickerIds))
  const owned = new Set(packs.flatMap(p => p.stickerIds))
  const placements = list(c['placements'], MAX_STICKER_PLACEMENTS).map(value => { if (!isStickerPlacement(value) || !owned.has(value.stickerId)) return fail(); return value })
  unique(placements.map(p => p.stickerId))
  const appearances = list(c['appearances'], 60).map(value => { const p = record(value); const stickerId = sticker(p['stickerId']); if (!owned.has(stickerId) || !isStickerWear(p['wear'])) return fail(); return { stickerId, wear: p['wear'] } })
  unique(appearances.map(p => p.stickerId))
  const collection = { owner, createdAt: integer(c['createdAt']), revision: integer(c['revision']), lastCreditAt: 0, importStatus: status, starterEvaluated: bool(c['starterEvaluated']), placements, appearances } satisfies typeof tables.collections.$inferInsert
  const tracks = list(root['tracks'], MAX_BACKUP_BYTES).map(value => {
    const t = record(value); const source = t['source']; if (source !== 'library' && source !== 'catalog') return fail()
    const catalogId = text(t['catalogId']); const durationMs = integer(t['durationMs'])
    if (!/^\d{1,24}$/.test(catalogId) || durationMs < 1 || durationMs > 86_400_000) return fail()
    return { owner, catalogId, genre: t['genre'] === null ? null : genre(t['genre']), durationMs, source, catalogChecked: bool(t['catalogChecked']) } satisfies typeof tables.tracks.$inferInsert
  })
  unique(tracks.map(t => t.catalogId))
  const credits = list(root['credits'], 12).map(value => { const c = record(value); return { owner, genre: genre(c['genre']), listenedMs: integer(c['listenedMs']) } }); unique(credits.map(c => c.genre))
  db.transaction(() => {
    // A restore supersedes every in-flight layout revision in this browser.
    const current = db.select().from(tables.collections).where(eq(tables.collections.owner, owner)).get()
    const revision = Math.max(current?.revision ?? 0, collection.revision) + 1
    if (!Number.isSafeInteger(revision)) return fail()
    db.delete(tables.collections).where(eq(tables.collections.owner, owner)).run()
    db.insert(tables.collections).values({ ...collection, revision }).run()
    for (const row of tracks) db.insert(tables.tracks).values(row).run()
    for (const row of credits) db.insert(tables.credits).values(row).run()
    for (const row of packs) db.insert(tables.packs).values(row).run()
  }, { behavior: 'immediate' })
  return createStickerRepository(db).inventory(owner)
}
