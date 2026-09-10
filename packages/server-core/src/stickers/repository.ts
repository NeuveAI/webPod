import { createStickerRepository as createEngine } from '@webpod/sticker-engine'
import { createStickerSessions } from './sessions.ts'
import type { StickerDatabase } from './database.ts'
export { StickerError, type ImportedTrack } from '@webpod/sticker-engine'
export function createStickerRepository(db: StickerDatabase, now: () => number = Date.now) { return { ...createEngine(db, now), sessions: createStickerSessions(db, now) } }
export type StickerRepository = ReturnType<typeof createStickerRepository>
