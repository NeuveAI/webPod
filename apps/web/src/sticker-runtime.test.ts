import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { createFixtureProvider, type ProgressTick, type MusicProvider } from '@webpod/providers'
import { deviceStore, stickerInventoryAtom, stickerCollectionStatusAtom } from '@webpod/state'
import { STICKER_GENRES, type StickerInventory } from '@webpod/stickers'
import { bootstrapStickerCollection, restoreStickerSession, openStickerPack, placeSticker, retryStickerCollection, startStickerRuntime, stopStickerRuntime } from './sticker-runtime'

const inventory: StickerInventory = { stickerIds: ['PW-A01'], packs: [{ id: 'starter', stickerIds: ['PW-A01'], source: 'starter', earnedAt: 1, openedAt: 2 }], placements: [], placementRevision: 0, importStatus: 'complete', progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })) }
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
afterEach(() => stopStickerRuntime(false))

describe('sticker runtime lifecycle', () => {
  test('logout invalidates a delayed import instead of restoring the prior collection', async () => {
    let complete: (value: StickerInventory) => void = () => {}
    const pending = new Promise<StickerInventory>((resolve) => { complete = resolve })
    startStickerRuntime(createFixtureProvider(), () => pending)
    stopStickerRuntime(false)
    complete(inventory)
    await flush()
    expect(deviceStore.get(stickerInventoryAtom)).toBeNull()
    expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('signed-out')
  })
  test('retry after failed bootstrap attaches the same listening subscription once', async () => {
    let listeners = 0
    let attempts = 0
    const provider: MusicProvider = { ...createFixtureProvider(), onProgress(_callback: (tick: ProgressTick) => void) { void _callback; listeners += 1; return () => { listeners -= 1 } } }
    startStickerRuntime(provider, async () => { attempts += 1; if (attempts === 1) throw new Error('unavailable'); return inventory })
    await flush()
    expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('error')
    expect(listeners).toBe(0)
    await retryStickerCollection()
    expect(listeners).toBe(1)
    await retryStickerCollection()
    expect(listeners).toBe(1)
    stopStickerRuntime(false)
    expect(listeners).toBe(0)
  })
  test('a stale placement revision reloads server state and does not show an optimistic save', async () => {
    startStickerRuntime(createFixtureProvider(), async () => inventory)
    await flush()
    const latest = { ...inventory, placementRevision: 4 }
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => options?.method === 'PUT' ? new Response('{}', { status: 409 }) : Response.json(latest), { preconnect: globalThis.fetch.preconnect }))
    try {
      await expect(placeSticker({ stickerId: 'PW-A01', surface: 'back', x: 0.5, y: 0.5, width: 0.25, rotationDeg: 0 })).rejects.toThrow()
      expect(deviceStore.get(stickerInventoryAtom)?.placementRevision).toBe(4)
      expect(deviceStore.get(stickerInventoryAtom)?.placements).toEqual([])
    } finally { fetchSpy.mockRestore() }
  })
  test('listening starts with a baseline, resets after seeks and stops at teardown', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('Missing fixture track')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    const observed: { streamId: string; sequence: number; positionMs: number; playing: boolean }[] = []
    let now = 0
    const clockSpy = spyOn(performance, 'now').mockImplementation(() => now)
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => { observed.push(JSON.parse(String(options?.body))); return Response.json(inventory) }, { preconnect: globalThis.fetch.preconnect }))
    try {
      startStickerRuntime(provider, async () => inventory)
      await flush()
      provider.tick(1); await flush()
      now = 10_000; provider.tick(10_000); await flush()
      expect(observed.map((event) => event.sequence)).toEqual([0, 1])
      expect(observed[0]?.streamId).toBe(observed[1]?.streamId)
      now = 11_000; await provider.seek(100_000); provider.tick(1); await flush()
      expect(observed.at(-1)?.sequence).toBe(0)
      expect(observed.at(-1)?.streamId).not.toBe(observed[0]?.streamId)
      stopStickerRuntime(false)
      const count = observed.length
      now = 30_000; provider.tick(10_000); await flush()
      expect(observed).toHaveLength(count)
    } finally { fetchSpy.mockRestore(); clockSpy.mockRestore() }
  })
  test('logout during failed conflict recovery cannot restore the prior error status', async () => {
    startStickerRuntime(createFixtureProvider(), async () => inventory)
    await flush()
    let failRecovery: (reason: unknown) => void = () => {}
    let recoveryStarted = false
    const recovery = new Promise<Response>((_resolve, reject) => { failRecovery = reject })
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'PUT') return new Response('{}', { status: 409 })
      recoveryStarted = true
      return recovery
    }, { preconnect: globalThis.fetch.preconnect }))
    try {
      const save = placeSticker({ stickerId: 'PW-A01', surface: 'back', x: 0.5, y: 0.5, width: 0.25, rotationDeg: 0 }).catch(() => undefined)
      await flush()
      expect(recoveryStarted).toBe(true)
      stopStickerRuntime(false)
      failRecovery(new Error('recovery aborted'))
      await save
      expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('signed-out')
      expect(deviceStore.get(stickerInventoryAtom)).toBeNull()
    } finally { fetchSpy.mockRestore() }
  })
})


test('device preparation completes before credential transfer and logout cancels a delayed callback', async () => {
  let consume: ((credential: string) => Promise<StickerInventory>) | undefined
  const paths: string[] = []
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (url: RequestInfo | URL) => { paths.push(String(url)); return Response.json(String(url).endsWith('/device') ? { ready: true } : inventory) }, { preconnect: globalThis.fetch.preconnect }))
  try {
    const delayed = { withMusicAuthorization<T>(callback: (credential: string) => Promise<T>): Promise<T> {
      consume = callback as (credential: string) => Promise<StickerInventory>
      return new Promise<T>(() => undefined)
    } }
    void bootstrapStickerCollection(delayed)
    await flush()
    expect(paths).toEqual(['/api/stickers/device'])
    stopStickerRuntime(false)
    if (consume === undefined) throw new Error('Credential callback missing')
    await expect(consume('synthetic')).rejects.toThrow('collection_session_changed')
    expect(paths).toEqual(['/api/stickers/device'])
  } finally { fetchSpy.mockRestore() }
})

const savedInventory: StickerInventory = { ...inventory, placements: [{ stickerId: 'PW-A01', surface: 'back', x: .55, y: .4, width: .22, rotationDeg: 9 }], placementRevision: 2 }
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }

describe('registered session restoration', () => {
  test('valid DB lease publishes before passive ingestion and survives its failure', async () => {
    const provider = createFixtureProvider()
    const upstream = deferred<StickerInventory>()
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async () => Response.json(savedInventory), { preconnect: globalThis.fetch.preconnect }))
    try {
      restoreStickerSession(provider)
      await flush()
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(savedInventory)
      startStickerRuntime(provider, () => upstream.promise)
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(savedInventory)
      await flush()
      expect(deviceStore.get(stickerInventoryAtom)?.placements).toEqual(savedInventory.placements)
      upstream.resolve({ ...savedInventory, importStatus: 'failed' })
      await flush()
      expect(deviceStore.get(stickerInventoryAtom)?.placements).toEqual(savedInventory.placements)
      expect(deviceStore.get(stickerInventoryAtom)?.importStatus).toBe('failed')
    } finally { fetchSpy.mockRestore() }
  })
  test('same provider keeps valid content through read failure, invalid lease clears it', async () => {
    const provider = createFixtureProvider()
    let status = 200
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async () => status === 200 ? Response.json(savedInventory) : new Response('{}', { status }), { preconnect: globalThis.fetch.preconnect }))
    try {
      restoreStickerSession(provider); await flush()
      status = 503; restoreStickerSession(provider)
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(savedInventory)
      await flush(); expect(deviceStore.get(stickerInventoryAtom)).toEqual(savedInventory)
      status = 401; restoreStickerSession(provider); await flush()
      expect(deviceStore.get(stickerInventoryAtom)).toBeNull()
      expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('signed-out')
    } finally { fetchSpy.mockRestore() }
  })
  test('replacement and confirmed authorization loss invalidate a late DB response', async () => {
    const response = deferred<Response>()
    let emitSession: ((session: MusicProvider['session']) => void) | undefined
    const first: MusicProvider = { ...createFixtureProvider(), onSessionChange(callback) { emitSession = callback; return () => {} } }
    const second = createFixtureProvider()
    let reads = 0
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async () => ++reads === 1 ? response.promise : Response.json(inventory), { preconnect: globalThis.fetch.preconnect }))
    try {
      restoreStickerSession(first); await flush()
      emitSession?.(null)
      expect(deviceStore.get(stickerInventoryAtom)).toBeNull()
      restoreStickerSession(second); await flush()
      response.resolve(Response.json(savedInventory)); await flush()
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(inventory)
    } finally { fetchSpy.mockRestore() }
  })
  test('late GET cannot rewind an opened pack with unchanged placement revision', async () => {
    const provider = createFixtureProvider()
    const stale = { ...savedInventory, packs: savedInventory.packs.map((pack) => ({ ...pack, openedAt: null })) }
    const pending = deferred<Response>()
    let reads = 0
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'POST') return Response.json(savedInventory)
      reads++
      return reads === 1 ? Response.json(stale) : reads === 2 ? pending.promise : Response.json(savedInventory)
    }, { preconnect: globalThis.fetch.preconnect }))
    try {
      restoreStickerSession(provider); await flush()
      restoreStickerSession(provider); await flush()
      await openStickerPack('starter')
      expect(deviceStore.get(stickerInventoryAtom)?.packs[0]?.openedAt).toBe(2)
      pending.resolve(Response.json(stale)); await flush()
      expect(reads).toBe(3)
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(savedInventory)
    } finally { fetchSpy.mockRestore() }
  })
  test('late import reconciles new access with newer placement and pack state', async () => {
    const provider = createFixtureProvider()
    const imported = deferred<StickerInventory>()
    const original = savedInventory.placements[0]
    if (!original) throw new Error('Missing saved placement fixture')
    const placement = { ...original, x: .65 }
    const newer: StickerInventory = { ...savedInventory, stickerIds: ['PW-A01', 'PW-A02'], packs: [...savedInventory.packs, { id: 'listened', stickerIds: ['PW-A02'], source: 'listening', earnedAt: 10, openedAt: null }], placementRevision: 3, placements: [placement] }
    let latest = savedInventory
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'PUT') { latest = newer; return Response.json(newer) }
      return Response.json(latest)
    }, { preconnect: globalThis.fetch.preconnect }))
    try {
      restoreStickerSession(provider); await flush()
      startStickerRuntime(provider, () => imported.promise); await flush()
      await placeSticker(placement)
      imported.resolve({ ...newer, placements: savedInventory.placements, placementRevision: 2 }); await flush()
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(newer)
    } finally { fetchSpy.mockRestore() }
  })
  test('scheduled refresh deduplicates pending import and tears down its clock', async () => {
    const provider = createFixtureProvider()
    const upstream = deferred<StickerInventory>()
    let scheduled: (() => void) | undefined, attempts = 0, cleared = 0, now = 1
    const timer = spyOn(globalThis, 'setInterval').mockImplementation(((callback: () => void) => { scheduled = callback; return 1 }) as typeof setInterval)
    const clear = spyOn(globalThis, 'clearInterval').mockImplementation(() => { cleared++ })
    const clock = spyOn(Date, 'now').mockImplementation(() => now)
    try {
      startStickerRuntime(provider, () => { attempts++; return upstream.promise }); await flush()
      now += 16 * 60_000; scheduled?.(); scheduled?.(); await flush()
      expect(attempts).toBe(1)
      upstream.resolve(inventory); await flush()
      scheduled?.(); await flush()
      expect(attempts).toBe(2)
      stopStickerRuntime(false); now += 16 * 60_000; scheduled?.(); await flush()
      expect(attempts).toBe(2)
      expect(cleared).toBeGreaterThan(0)
    } finally { timer.mockRestore(); clear.mockRestore(); clock.mockRestore() }
  })
})
