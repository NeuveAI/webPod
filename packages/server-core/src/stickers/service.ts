import { Context, Effect, Layer, ManagedRuntime } from 'effect'
import { openStickerDatabase } from './database.ts'
import { createStickerRepository, StickerError, type StickerRepository } from './repository.ts'

export class StickerStorage extends Context.Service<StickerStorage, StickerRepository>()('@webpod/server-core/StickerStorage') {}

/** Typed Effect boundary for synchronous Drizzle work; errors never serialize SQL or parameters. */
export function stickerOperation<A>(run: (repository: StickerRepository) => A) {
  return Effect.gen(function* () {
    const repository = yield* StickerStorage
    return yield* Effect.try({ try: () => run(repository), catch: (cause) => cause instanceof StickerError ? cause : new StickerError('storage_unavailable', 503, 'Your sticker collection is temporarily unavailable.') })
  })
}

/** The Effect layer owns and closes SQLite. Start routes reuse one runtime, never a connection per request. */
export function createStickerRuntime(path: string, now: () => number = Date.now) {
  const layer = Layer.effect(StickerStorage, Effect.gen(function* () {
    const handle = yield* Effect.acquireRelease(
      Effect.try({ try: () => openStickerDatabase(path), catch: () => new StickerError('storage_unavailable', 503, 'Your sticker collection is temporarily unavailable.') }),
      (handle) => Effect.sync(() => handle.close()),
    )
    return createStickerRepository(handle.db, now)
  }))
  return ManagedRuntime.make(layer)
}
