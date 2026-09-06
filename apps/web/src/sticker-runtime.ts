import { QueryClient } from '@tanstack/query-core'
import type { MusicProvider } from '@webpod/providers'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom, setStickerCollectionStatusActionAtom, stickerInventoryAtom } from '@webpod/state'
import { isStickerInventory, isStickerPlacement, type ListeningObservation, type StickerInventory, type StickerPlacement } from '@webpod/stickers'
import { resetStickerEditor, sameStickerPose } from './sticker-editor-model'
import { cancelStickerInteraction } from './sticker-interaction'

const LISTENING = { heartbeatMs: 10_000, maximumPending: 3, refreshMs: 15 * 60_000, retries: 2, retryDelayMs: 800 } as const
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: LISTENING.retries, retryDelay: LISTENING.retryDelayMs, gcTime: 0 } } })
let generation = 0
let abort: AbortController | null = null
let detach: (() => void) | null = null
let reconnect: (() => Promise<void>) | null = null
let writes: Promise<void> = Promise.resolve()
let revocation: Promise<unknown> = Promise.resolve()
let activeProvider: MusicProvider | null = null
let restoration: Promise<void> | null = null
let publication = 0
class StickerRequestError extends Error { constructor(readonly status: number) { super('collection_request_failed') } }

/** Response validation is shared with the server domain; never publish unchecked JSON. */
async function inventoryResponse(response: Response): Promise<StickerInventory> {
  if (!response.ok) throw new StickerRequestError(response.status)
  const body: unknown = await response.json()
  if (!isStickerInventory(body)) throw new Error('collection_invalid_response')
  return body
}

function publish(inventory: StickerInventory, expected: number): void {
  if (expected !== generation) return
  if (!deviceStore.set(receiveStickerInventoryActionAtom, inventory)) throw new Error('collection_invalid_placements')
  publication += 1
}

async function request(path: string, method = 'GET', body?: unknown): Promise<StickerInventory> {
  return inventoryResponse(await fetch(`/api/stickers${path}`, { method, credentials: 'same-origin', cache: 'no-store', signal: abort?.signal, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }))
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
    inventory = await request('')
  }
}
function restoreFailure(cause: unknown, expected: number): void {
  if (expected !== generation) return
  if (cause instanceof StickerRequestError && (cause.status === 401 || cause.status === 403)) {
    cancelStickerInteraction(); deviceStore.set(resetStickerCollectionActionAtom); publication += 1
  } else deviceStore.set(setStickerCollectionStatusActionAtom, 'error')
}
/** Starts with the registered server lease, before MusicKit configuration/library
 * work. Same provider transitions preserve the current validated device snapshot;
 * a replacement provider or confirmed logout starts with no previous identity. */
export function restoreStickerSession(provider: MusicProvider): void {
  const preserve = activeProvider === provider
  stopStickerRuntime(false, preserve)
  activeProvider = provider
  // Initial SDK uncertainty is not a logout, but an observed authorization loss is.
  let authorized = provider.session?.status === 'authorized'
  detach = provider.onSessionChange((session) => { if (session?.status === 'authorized') authorized = true; else if (authorized) stopStickerRuntime(true) })
  abort = new AbortController()
  const expected = generation, startedAt = publication
  deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  restoration = (async () => {
    await revocation
    if (expected !== generation) return
    try { await reconcile(await request(''), expected, startedAt) }
    catch (cause) { restoreFailure(cause, expected) }
  })()
}

/** Private token callback is consumed immediately by this dedicated same-origin POST. */
export function bootstrapStickerCollection(provider: { withMusicAuthorization<T>(consume: (credential: string) => Promise<T>): Promise<T> }): Promise<StickerInventory> {
  const expected = generation
  const signal = abort?.signal
  return (async () => {
    await revocation
    if (expected !== generation || signal?.aborted) throw new Error('collection_session_changed')
    // Persist the restricted device cookie before authentication, so logout can revoke an in-flight import.
    const prepared = await fetch('/api/stickers/device', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal })
    if (!prepared.ok) throw new StickerRequestError(prepared.status)
    if (expected !== generation || signal?.aborted) throw new Error('collection_session_changed')
    return provider.withMusicAuthorization(async (credential) => {
      if (expected !== generation || signal?.aborted) throw new Error('collection_session_changed')
      return inventoryResponse(await fetch('/api/stickers/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ musicUserToken: credential }) }))
    })
  })()
}

/** Attach music credit after authorization; ingestion runs independently of the
 * already validated DB restoration. One import at a time, on connection/retry and
 * every fifteen visible minutes; no timer or credential outlives this provider. */
export function startStickerRuntime(provider: MusicProvider, bootstrap: () => Promise<StickerInventory>): void {
  if (activeProvider !== provider) {
    stopStickerRuntime(false)
    activeProvider = provider; abort = new AbortController()
  } else if (reconnect !== null) return
  const expected = generation
  if (deviceStore.get(stickerInventoryAtom) === null) deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  detach?.(); detach = null
  const unsubscribeSession = provider.onSessionChange((session) => { if (session?.status !== 'authorized') stopStickerRuntime(true) })
  let stopListening: (() => void) | null = null
  let connecting: Promise<void> | null = null
  let lastImport = 0
  const listen = (): void => { if (expected === generation && stopListening === null && deviceStore.get(stickerInventoryAtom) !== null) stopListening = observeListening(provider, expected) }
  const connect = (): Promise<void> => {
    if (connecting !== null) return connecting
    connecting = (async () => {
      await restoration
      if (expected !== generation) return
      listen()
      const startedAt = publication
      lastImport = Date.now()
      try { await reconcile(await bootstrap(), expected, startedAt); listen() }
      catch (cause) { if (expected === generation) deviceStore.set(setStickerCollectionStatusActionAtom, 'error'); throw cause }
    })().finally(() => { connecting = null })
    return connecting
  }
  const refreshWhenVisible = (): void => {
    if (expected !== generation || provider.session?.status !== 'authorized' || typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (Date.now() - lastImport >= LISTENING.refreshMs) void connect().catch(() => undefined)
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
  queryClient.clear()
  if (!preserveInventory || revoke) { resetStickerEditor(); cancelStickerInteraction(); deviceStore.set(resetStickerCollectionActionAtom); publication += 1 }
  if (revoke && typeof window !== 'undefined') revocation = revocation.catch(() => undefined).then(() => fetch('/api/stickers/session', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })).catch(() => undefined)
}

/** Refreshes inventory without turning an import failure into successful empty state. */
export async function refreshStickerCollection(): Promise<void> {
  const expected = generation, startedAt = publication
  deviceStore.set(setStickerCollectionStatusActionAtom, 'loading')
  try {
    const inventory = await queryClient.fetchQuery({ queryKey: ['sticker-inventory', expected], queryFn: () => { if (expected !== generation) throw new Error('collection_session_changed'); return request('') }, retry: (count) => expected === generation && count < LISTENING.retries, staleTime: 0 })
    await reconcile(inventory, expected, startedAt)
  } catch (cause) {
    restoreFailure(cause, expected)
    throw cause
  }
}

export async function retryStickerCollection(): Promise<void> {
  if (reconnect === null) return refreshStickerCollection()
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
      if (expected === generation && cause instanceof StickerRequestError && cause.status === 409) {
        try { const readAt = publication; await reconcile(await request(''), expected, readAt) } catch { if (expected === generation) deviceStore.set(setStickerCollectionStatusActionAtom, 'error') }
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
  return write(() => request('/packs/open', 'POST', { packId }))
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
    return request('/placements', 'PUT', { revision: inventory.placementRevision, placements: [...inventory.placements.filter((item) => item.stickerId !== placement.stickerId), placement] })
  })
}

export function removeSticker(stickerId: string): Promise<void> {
  return write(() => {
    const inventory = deviceStore.get(stickerInventoryAtom)
    if (inventory === null) throw new Error('collection_signed_out')
    return request('/placements', 'PUT', { revision: inventory.placementRevision, placements: inventory.placements.filter((item) => item.stickerId !== stickerId) })
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
      const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: () => { if (!active || expected !== generation) throw new Error('collection_session_changed'); return request('/listening', 'POST', observation) }, retry: (count, cause) => active && expected === generation && count < LISTENING.retries && !(cause instanceof StickerRequestError && cause.status < 500), retryDelay: LISTENING.retryDelayMs })
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
