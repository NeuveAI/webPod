import { Cookie, CookieMap } from 'bun'
import { Effect } from 'effect'
import { createAppleStickerClient } from './apple-import.ts'
import { handleStickerRequest, type StickerHttpServices } from './http.ts'
import { StickerError } from './repository.ts'
import { createStickerRuntime, stickerOperation, StickerStorage } from './service.ts'
import { DEVICE_TTL_MS, SESSION_TTL_MS, stickerSecretHash, type DeviceLease } from './sessions.ts'

export const DEVICE_COOKIE = 'webpod_device'
export const SESSION_COOKIE = 'webpod_session'
export const MAX_STICKER_UPSTREAM = 4
export interface LiveStickerOptions {
  readonly databasePath: string
  readonly developerToken: () => Promise<string>
  readonly fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  readonly now?: () => number
}
function secret(request: Request, name: string): string | undefined { return new CookieMap(request.headers.get('cookie') ?? '').get(name) ?? undefined }
function cookie(request: Request, name: string, value: string, ttl: number): string {
  return new Cookie(name, value, { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: ttl / 1000 }).toString()
}
function unauthorized(): never { throw new StickerError('unauthorized', 401, 'Reconnect Apple Music to collect stickers.') }

/** Explicit factory is the test injection seam. Production provides only environment configuration.
 * ManagedRuntime owns SQLite and every upstream effect; dispose interrupts fetches before closing storage. */
export function createLiveStickerServer(options: LiveStickerOptions) {
  const runtime = createStickerRuntime(options.databasePath, options.now)
  const pending = new Map<string, Set<AbortController>>()
  let upstreamCount = 0
  let disposed = false
  let prepareWindow = 0
  let prepared = 0
  const run: StickerHttpServices['run'] = (operation) => runtime.runPromise(stickerOperation(operation))
  const session = (request: Request) => run((repository) => {
    const value = secret(request, SESSION_COOKIE)
    if (value === undefined) return unauthorized()
    return repository.sessions.resolve(stickerSecretHash(value))
  })
  async function upstream<A>(deviceHash: string, request: Request, work: (signal: AbortSignal) => Promise<A>): Promise<A> {
    if (disposed) throw new StickerError('unavailable', 503, 'Your collection is temporarily unavailable.')
    if (upstreamCount >= MAX_STICKER_UPSTREAM || (pending.get(deviceHash)?.size ?? 0) >= 1) throw new StickerError('rate_limited', 429, 'Your collection is busy. Try again shortly.')
    const controller = new AbortController()
    const set = pending.get(deviceHash) ?? new Set<AbortController>(); set.add(controller); pending.set(deviceHash, set); upstreamCount++
    try {
      return await runtime.runPromise(Effect.tryPromise({ try: (signal) => work(AbortSignal.any([signal, request.signal, controller.signal])), catch: (cause) => cause instanceof StickerError ? cause : new StickerError('unavailable', 503, 'Your collection is temporarily unavailable.') }))
    } finally { upstreamCount--; set.delete(controller); if (set.size === 0) pending.delete(deviceHash) }
  }
  const services: StickerHttpServices = {
    run,
    prepare: async (request) => {
      const now = (options.now ?? Date.now)()
      if (now - prepareWindow >= 60_000) { prepareWindow = now; prepared = 0 }
      if (prepared >= 30) throw new StickerError('rate_limited', 429, 'Wait a moment before reconnecting your collection.')
      prepared++
      const result = await run((repository) => repository.sessions.prepare(secret(request, DEVICE_COOKIE)))
      return result.secret === null ? [] : [cookie(request, DEVICE_COOKIE, result.secret, DEVICE_TTL_MS)]
    },
    resolveOwner: async (request) => (await session(request)).owner,
    authorized: async (request, operation) => {
      const lease = await session(request)
      return run((repository) => repository.sessions.authorized(lease, (owner) => operation(repository, owner)))
    },
    bootstrap: async (request, musicUserToken) => {
      const device = secret(request, DEVICE_COOKIE)
      if (device === undefined) return unauthorized()
      let lease: DeviceLease
      try { lease = await run((repository) => repository.sessions.begin(device)) }
      catch (cause) {
        // A rapid reload of an already verified session needs no new authorization or import.
        if (!(cause instanceof StickerError) || cause.code !== 'rate_limited') throw cause
        const active = await session(request)
        if (active.deviceHash !== stickerSecretHash(device)) throw cause
        const inventory = await run((repository) => repository.sessions.authorized(active, (owner) => repository.inventory(owner)))
        return { inventory, cookies: [] }
      }
      return upstream(lease.deviceHash, request, async (signal) => {
        const developerToken = await options.developerToken()
        signal.throwIfAborted()
        const apple = createAppleStickerClient({ developerToken, musicUserToken, signal, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) })
        const storefront = await apple.verify()
        let imported: Awaited<ReturnType<typeof apple.importLibrary>> | null = null
        try { imported = await apple.importLibrary() } catch (cause) {
          if (signal.aborted || (cause instanceof StickerError && cause.code === 'apple_authorization')) throw cause
        }
        signal.throwIfAborted()
        // Activation and import are one transaction, after verification and the final revocation check.
        const result = await run((repository) => repository.sessions.activate(lease, storefront, (owner) => {
          signal.throwIfAborted()
          repository.ensureOwner(owner)
          if (imported === null) { repository.markImportFailed(owner); return repository.inventory(owner) }
          return repository.importTracks(owner, imported.tracks, imported.status)
        }))
        return { inventory: result.result, cookies: [cookie(request, SESSION_COOKIE, result.secret, SESSION_TTL_MS)] }
      })
    },
    enrich: async (_owner, catalogId, request) => {
      if (request === undefined) return unauthorized()
      const lease = await session(request)
      await upstream(lease.deviceHash, request, async (signal) => {
        const developerToken = await options.developerToken(); signal.throwIfAborted()
        const apple = createAppleStickerClient({ developerToken, signal, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) })
        const track = await apple.enrich(catalogId, lease.storefront); signal.throwIfAborted()
        await run((repository) => repository.sessions.authorized(lease, (owner) => { signal.throwIfAborted(); repository.enrichTrack(owner, track) }))
      })
    },
    logout: async (request) => {
      const hashes = await run((repository) => repository.sessions.revoke(secret(request, DEVICE_COOKIE), secret(request, SESSION_COOKIE)))
      for (const hash of hashes) for (const controller of pending.get(hash) ?? []) controller.abort()
      return [cookie(request, SESSION_COOKIE, '', 0)]
    },
  }
  return {
    handle: (request: Request) => handleStickerRequest(request, services),
    /** Initializes the scoped resource without authenticating or reading Apple credentials. */
    ready: () => runtime.runPromise(Effect.asVoid(StickerStorage)),
    async dispose() { disposed = true; for (const controllers of pending.values()) for (const controller of controllers) controller.abort(); await runtime.dispose() },
  }
}
