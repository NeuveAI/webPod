import { createLocalStickerClient, type LocalStickerClient, type ImportedTrack } from './sticker-local'
import { QueryClient } from '@tanstack/query-core'
import type { MusicProvider } from '@webpod/providers'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom, setStickerCollectionStatusActionAtom, stickerInventoryAtom } from '@webpod/state'
import { STICKER_GENRES, isStickerPlacement, type ListeningObservation, type StickerInventory, type StickerPlacement } from '@webpod/stickers'
import { resetStickerEditor, sameStickerPose } from './sticker-editor-model'
import { cancelStickerInteraction } from './sticker-interaction'

const LISTENING = { heartbeatMs: 10_000, maximumPending: 3, refreshMs: 15 * 60_000, retries: 2, retryDelayMs: 800 } as const
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: LISTENING.retries, retryDelay: LISTENING.retryDelayMs, gcTime: 0 } } })
let generation = 0
let abort: AbortController | null = null
let detach: (() => void) | null = null
let reconnect: (() => Promise<void>) | null = null
let writes: Promise<void> = Promise.resolve()
let local: LocalStickerClient | null = null
let storefront: string | null = null
function storage(): LocalStickerClient { return local ??= createLocalStickerClient() }
let activeProvider: MusicProvider | null = null
let restoration: Promise<void> | null = null
let publication = 0
class StickerRequestError extends Error { constructor(readonly status: number) { super('collection_request_failed') } }
class StickerMusicAuthorizationRequiredError extends Error {
  readonly code = 'music_authorization_required'
  constructor() { super('Connect Apple Music to retry library sync.'); this.name = 'StickerMusicAuthorizationRequiredError' }
}

function publish(inventory: StickerInventory, expected: number): void {
  if (expected !== generation) return
  if (!deviceStore.set(receiveStickerInventoryActionAtom, inventory)) throw new Error('collection_invalid_placements')
  publication += 1
}

function request(): Promise<StickerInventory> { return storage().inventory() }
async function appleRequest(body: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch('/api/apple/stickers', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new StickerRequestError(response.status)
  return response.json()
}
function isTrack(value: unknown): value is ImportedTrack {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row['catalogId'] === 'string' && /^\d{1,24}$/.test(row['catalogId']) && typeof row['durationMs'] === 'number' && Number.isSafeInteger(row['durationMs']) && row['durationMs'] > 0 && row['durationMs'] <= 86_400_000 && (row['genre'] === null || STICKER_GENRES.includes(row['genre'] as typeof STICKER_GENRES[number]))
}

/** A delayed read/import cannot rewind a placement or opened-pack publication.
 * Re-read authoritative SQLite after intervening publications, bounded to three
 * reads under sustained writes. The last validated newer snapshot stays visible. */
async function reconcile(inventory: StickerInventory, expected: number, startedAt: number): Promise<void> {
  for (let attempt = 0; expected === generation; attempt++) {
    const current = deviceStore.get(stickerInventoryAtom)
    if (startedAt === publication && (current === null || inventory.placementRevision >= current.placementRevision)) { publish(inventory, expected); return }
    if (attempt >= 3) return
    startedAt = publication
    inventory = await request()
  }
}
function restoreFailure(_cause: unknown, expected: number): void {
  if (expected === generation) deviceStore.set(setStickerCollectionStatusActionAtom, 'error')
}
/** Restores browser-owned SQLite independently of Apple authorization.
 * Collection ownership remains local across provider transitions. */
export function restoreStickerSession(provider: MusicProvider, readExistingSession = true): void {
  // Route mounts must not abort the authenticated import already in flight.
  if (activeProvider === provider && (reconnect !== null || restoration !== null)) return
  const preserve = true
  stopStickerRuntime(false, preserve)
  activeProvider = provider
  // Initial SDK uncertainty is not a logout, but an observed authorization loss is.
  let authorized = provider.session?.status === 'authorized'
  detach = provider.onSessionChange((session) => { if (session?.status === 'authorized') authorized = true; else if (authorized) { disconnectStickerMusic(provider) } })
  abort = new AbortController()
  const expected = generation, startedAt = publication
  deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  restoration = (async () => {
    if (!readExistingSession) return
    if (expected !== generation) return
    try { await reconcile(await request(), expected, startedAt) }
    catch (cause) { restoreFailure(cause, expected) }
  })()
}

/** Credentials are consumed only by the stateless same-origin Apple endpoint. */
export async function bootstrapStickerCollection(provider: { withMusicAuthorization<T>(consume: (credential: string) => Promise<T>): Promise<T> }, _refresh = false): Promise<StickerInventory> {
  void _refresh
  const expected = generation, signal = abort?.signal
  let result: unknown
  try { result = await provider.withMusicAuthorization(credential => appleRequest({ action: 'import', musicUserToken: credential }, signal)) }
  catch {
    if (expected !== generation || signal?.aborted) throw new Error('collection_session_changed')
    return storage().markImportFailed()
  }
  if (expected !== generation || signal?.aborted) throw new Error('collection_session_changed')
  if (typeof result !== 'object' || result === null) throw new Error('collection_invalid_response')
  const body = result as Record<string, unknown>
  if (!Array.isArray(body['tracks']) || body['tracks'].length > 2500 || !body['tracks'].every(isTrack) || !['complete', 'partial'].includes(String(body['status'])) || typeof body['storefront'] !== 'string' || !/^[a-z]{2}$/.test(body['storefront'])) throw new Error('collection_invalid_response')
  storefront = body['storefront']
  return storage().importTracks(body['tracks'].map(({ catalogId, genre, durationMs }) => ({ catalogId, genre, durationMs })), body['status'] as 'complete' | 'partial')
}

/** Attach music credit after authorization; ingestion runs independently of the
 * already validated DB restoration. One import at a time, on connection/retry and
 * every fifteen visible minutes; no timer or credential outlives this provider. */
export function startStickerRuntime(provider: MusicProvider, bootstrap: (refresh?: boolean) => Promise<StickerInventory>): void {
  if (activeProvider !== provider) {
    stopStickerRuntime(false)
    activeProvider = provider; abort = new AbortController()
  } else if (reconnect !== null) return
  const expected = generation
  if (deviceStore.get(stickerInventoryAtom) === null) deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  detach?.(); detach = null
  const unsubscribeSession = provider.onSessionChange((session) => { if (session?.status !== 'authorized') { disconnectStickerMusic(provider) } })
  let stopListening: (() => void) | null = null
  let connecting: Promise<void> | null = null
  let lastImport = 0
  const listen = (): void => { if (expected === generation && stopListening === null && deviceStore.get(stickerInventoryAtom) !== null) stopListening = observeListening(provider, expected) }
  const connect = (refresh = false): Promise<void> => {
    if (connecting !== null) return connecting
    connecting = (async () => {
      await restoration
      if (expected !== generation) return
      listen()
      if (deviceStore.get(stickerInventoryAtom) === null) deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
      const startedAt = publication
      lastImport = Date.now()
      try { await reconcile(await bootstrap(refresh), expected, startedAt); listen() }
      catch (cause) { if (expected === generation) deviceStore.set(setStickerCollectionStatusActionAtom, 'error'); throw cause }
    })().finally(() => { connecting = null })
    return connecting
  }
  const refreshWhenVisible = (): void => {
    if (expected !== generation || provider.session?.status !== 'authorized' || typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (Date.now() - lastImport >= LISTENING.refreshMs) void connect(true).catch(() => undefined)
  }
  const timer = setInterval(refreshWhenVisible, LISTENING.refreshMs)
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshWhenVisible)
  detach = () => { unsubscribeSession(); stopListening?.(); clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', refreshWhenVisible) }
  reconnect = connect
  void connect().catch(() => undefined)
}

/** Stops subscriptions before sign-out or provider replacement can emit more credit. */
export function stopStickerRuntime(revoke = true, preserveInventory = false): void {
  generation += 1
  detach?.(); detach = null
  abort?.abort(); abort = null
  reconnect = null
  restoration = null
  activeProvider = null
  storefront = null
  local?.dispose(); local = null
  queryClient.clear()
  if (revoke) { resetStickerEditor(); cancelStickerInteraction() }
  if (!preserveInventory) { resetStickerEditor(); cancelStickerInteraction(); deviceStore.set(resetStickerCollectionActionAtom); publication += 1 }

}

/** Apple permission changes stop music credit, then restore the independently owned local collection. */
export function disconnectStickerMusic(provider: MusicProvider): void {
  stopStickerRuntime(true, true)
  restoreStickerSession(provider)
}

/** Refreshes inventory without turning an import failure into successful empty state. */
export async function refreshStickerCollection(): Promise<void> {
  const expected = generation, startedAt = publication
  deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  try {
    const inventory = await queryClient.fetchQuery({ queryKey: ['sticker-inventory', expected], queryFn: () => { if (expected !== generation) throw new Error('collection_session_changed'); return request() }, retry: (count) => expected === generation && count < LISTENING.retries, staleTime: 0 })
    await reconcile(inventory, expected, startedAt)
  } catch (cause) {
    restoreFailure(cause, expected)
    throw cause
  }
}

export async function retryStickerCollection(): Promise<void> {
  // A crashed/timed-out worker cannot recover in-place. A retry creates a fresh transport.
  local?.dispose(); local = null
  if (reconnect === null) {
    await refreshStickerCollection()
    // Reading the same failed import is not a successful sync retry. Music
    // connection must come from the existing explicit sign-in user gesture;
    // local storage itself remains usable and requires no authorization.
    const status = deviceStore.get(stickerInventoryAtom)?.importStatus
    if (status === 'failed' || status === 'partial') throw new StickerMusicAuthorizationRequiredError()
    return
  }
  const expected = generation
  deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  try { await reconnect() }
  catch (cause) { if (expected === generation) deviceStore.set(setStickerCollectionStatusActionAtom, 'error'); throw cause }
}

/** Serializes local writes so pack claims and placement revisions cannot race each other. */
function write(work: () => Promise<StickerInventory>): Promise<void> {
  const expected = generation
  const next = writes.catch(() => undefined).then(async () => {
    if (expected !== generation) throw new Error('collection_session_changed')
    const startedAt = publication
    let inventory: StickerInventory
    try { inventory = await work() }
    catch (cause) {
      if (expected === generation && typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 409) {
        try { const readAt = publication; await reconcile(await request(), expected, readAt) } catch { if (expected === generation) deviceStore.set(setStickerCollectionStatusActionAtom, 'error') }
      }
      throw cause
    }
    if (expected !== generation) throw new Error('collection_session_changed')
    await reconcile(inventory, expected, startedAt)
  })
  writes = next
  return next
}

export function openStickerPack(packId: string): Promise<void> {
  return write(() => storage().openPack(packId))
}

export function placeSticker(placement: StickerPlacement, expectedSource?: StickerPlacement): Promise<void> {
  if (!isStickerPlacement(placement)) return Promise.reject(new Error('collection_invalid_placement'))
  return write(() => {
    const inventory = deviceStore.get(stickerInventoryAtom)
    if (inventory === null) throw new Error('collection_signed_out')
    if (expectedSource !== undefined) {
      const current = inventory.placements.find((item) => item.stickerId === expectedSource.stickerId)
      if (current === undefined || placement.stickerId !== expectedSource.stickerId || !sameStickerPose(current, expectedSource)) throw new StickerRequestError(409)
    }
    return storage().place(inventory.placementRevision, expectedSource === undefined
      ? [...inventory.placements.filter((item) => item.stickerId !== placement.stickerId), placement]
      : inventory.placements.map(item => item.stickerId === placement.stickerId ? placement : item))
  })
}

export function removeSticker(stickerId: string): Promise<void> {
  return write(() => {
    const inventory = deviceStore.get(stickerInventoryAtom)
    if (inventory === null) throw new Error('collection_signed_out')
    return storage().place(inventory.placementRevision, inventory.placements.filter((item) => item.stickerId !== stickerId))
  })
}

/**
 * Reports real provider ticks, never interpolated UI positions or imported duration.
 * A new stream starts after a seek/track change; sequence zero establishes baseline.
 * The server caps elapsed credit and deduplicates the same event on bounded retry.
 */
function observeListening(provider: MusicProvider, expected: number): () => void {
  let streamId = crypto.randomUUID()
  let sequence = 0
  let catalogId: string | null = null
  let lastPosition: number | null = null
  let lastTickAt = 0
  let lastSentAt = -Infinity
  let pending = 0
  let active = true
  let chain = Promise.resolve()
  const reset = (): void => { streamId = crypto.randomUUID(); sequence = 0; lastPosition = null; lastSentAt = -Infinity }
  const submit = (positionMs: number, playing: boolean): void => {
    const id = provider.playback.now?.catalogId
    if (!active || expected !== generation || id === undefined || id === '') return
    if (pending >= LISTENING.maximumPending) { reset(); return }
    const observation: ListeningObservation = { eventId: crypto.randomUUID(), streamId, sequence: sequence++, catalogId: id, positionMs, playing }
    pending += 1
    chain = chain.then(async () => {
      if (!active || expected !== generation) return
      const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: () => { if (!active || expected !== generation) throw new Error('collection_session_changed'); return recordObservation(observation, expected) }, retry: (count, cause) => active && expected === generation && count < LISTENING.retries && !(cause instanceof StickerRequestError && cause.status < 500), retryDelay: LISTENING.retryDelayMs })
      await write(() => mutation.execute(undefined))
    }).catch(() => { if (active && expected === generation) reset() }).finally(() => { pending -= 1 })
  }
  const unsubscribeProgress = provider.onProgress((tick) => {
    if (!active || tick.interpolated || provider.playback.status !== 'playing' || !Number.isFinite(tick.positionMs)) return
    const now = performance.now()
    const id = provider.playback.now?.catalogId ?? null
    if (catalogId !== id) { catalogId = id; reset() }
    if (lastPosition !== null && (tick.positionMs < lastPosition || Math.abs((tick.positionMs - lastPosition) - (now - lastTickAt)) > 2500)) reset()
    lastPosition = tick.positionMs; lastTickAt = now
    if (now - lastSentAt >= LISTENING.heartbeatMs) { lastSentAt = now; submit(tick.positionMs, true) }
  })
  const unsubscribePlayback = provider.onPlaybackChange((playback) => {
    if (playback.status !== 'playing') { if (lastPosition !== null) submit(lastPosition, false); reset() }
    if (playback.now?.catalogId !== catalogId) { catalogId = playback.now?.catalogId ?? null; reset() }
  })
  return () => { active = false; unsubscribeProgress(); unsubscribePlayback() }
}

async function recordObservation(observation: ListeningObservation, expected: number): Promise<StickerInventory> {
  const client = storage()
  if (await client.needsEnrichment(observation.catalogId) && storefront !== null) {
    const track = await appleRequest({ action: 'enrich', catalogId: observation.catalogId, storefront }, abort?.signal)
    if (expected !== generation) throw new Error('collection_session_changed')
    if (!isTrack(track)) throw new Error('collection_invalid_response')
    await client.enrichTrack({ catalogId: track.catalogId, genre: track.genre, durationMs: track.durationMs })
  }
  if (expected !== generation) throw new Error('collection_session_changed')
  return client.observe(observation)
}

export function exportStickerBackup(): Promise<string> { return storage().exportBackup() }
export function importStickerBackup(json: string): Promise<void> {
  return write(() => storage().importBackup(json))
}
