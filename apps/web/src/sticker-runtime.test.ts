import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createFixtureProvider } from '@webpod/providers'
import { deviceStore, stickerInventoryAtom, stickerCollectionStatusAtom } from '@webpod/state'
import { STICKER_GENRES, type StickerInventory } from '@webpod/stickers'
import * as localModule from './sticker-local'
import type { LocalStickerClient } from './sticker-local'
import { bootstrapStickerCollection, disconnectStickerMusic, restoreStickerSession, openStickerPack, placeSticker, refreshStickerCollection, retryStickerCollection, startStickerRuntime, stopStickerRuntime, exportStickerBackup, importStickerBackup } from './sticker-runtime'

const inventory: StickerInventory = { stickerIds: ['PW-A01'], packs: [{ id: 'starter', stickerIds: ['PW-A01'], source: 'starter', earnedAt: 1, openedAt: 2 }], placements: [], placementRevision: 0, importStatus: 'complete', progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })) }
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))
let saved: StickerInventory
let client: LocalStickerClient
let factory: ReturnType<typeof spyOn>
let mutations = 0
beforeEach(() => {
  stopStickerRuntime(false)
  saved = structuredClone(inventory); mutations = 0
  client = {
    inventory: async () => saved,
    importTracks: async () => { mutations++; return saved },
    markImportFailed: async () => saved,
    needsEnrichment: async () => false,
    enrichTrack: async () => {},
    observe: async () => saved,
    openPack: async () => { mutations++; return saved },
    place: async (revision, placements) => { if (revision !== saved.placementRevision) throw Object.assign(new Error('conflict'), { status: 409 }); mutations++; return saved = { ...saved, placements: [...placements], placementRevision: revision + 1 } },
    exportBackup: async () => JSON.stringify(saved),
    importBackup: async json => { const restored = JSON.parse(json) as StickerInventory; mutations++; return saved = { ...restored, placementRevision: saved.placementRevision + 1 } },
    dispose: () => {},
  }
  factory = spyOn(localModule, 'createLocalStickerClient').mockImplementation(() => client)
})
afterEach(() => { stopStickerRuntime(false); factory.mockRestore() })

describe('browser-local sticker runtime', () => {
  test('restores without Apple authorization or cookie requests', async () => {
    const fetcher = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected_network'))
    try {
      restoreStickerSession(createFixtureProvider()); await flush()
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(saved)
      expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('ready')
      expect(fetcher).not.toHaveBeenCalled()
    } finally { fetcher.mockRestore() }
  })
  test('logout disposes transport, reconnect restores same persisted collection', async () => {
    const dispose = spyOn(client, 'dispose')
    restoreStickerSession(createFixtureProvider()); await flush()
    stopStickerRuntime(true)
    expect(dispose).toHaveBeenCalled()
    restoreStickerSession(createFixtureProvider()); await flush()
    expect(deviceStore.get(stickerInventoryAtom)).toEqual(saved)
  })
  for (const reason of ['explicit logout', 'permission rejection', 'passive authorization loss']) {
    test(`${reason} during cold storage restoration starts a fresh local read`, async () => {
      const provider = createFixtureProvider()
      let release!: (value: StickerInventory) => void
      client.inventory = () => new Promise(resolve => { release = resolve })
      restoreStickerSession(provider); await flush()
      client.inventory = async () => saved
      if (reason === 'passive authorization loss') await provider.unauthorize()
      else disconnectStickerMusic(provider)
      release({ ...saved, placementRevision: 99 }); await flush()
      expect(factory).toHaveBeenCalledTimes(2)
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(saved)
      expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('ready')
    })
  }
  test('late Apple metadata after logout never reaches worker', async () => {
    let resolve!: (value: Response) => void
    const fetcher = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(() => new Promise<Response>(done => { resolve = done }), { preconnect: fetch.preconnect }))
    try {
      restoreStickerSession(createFixtureProvider()); await flush()
      const bootstrap = bootstrapStickerCollection({ withMusicAuthorization: consume => consume('test-only-token') })
      stopStickerRuntime(true)
      resolve(Response.json({ tracks: [{ catalogId: '1', genre: 'rock', durationMs: 3000 }], status: 'complete', storefront: 'us' }))
      await expect(bootstrap).rejects.toThrow('collection_session_changed')
      expect(mutations).toBe(0)
      expect(deviceStore.get(stickerInventoryAtom)).toBeNull()
    } finally { fetcher.mockRestore() }
  })
  test('import posts only stateless metadata request then writes sanitized tracks', async () => {
    const calls: string[] = []
    const fetcher = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (input: RequestInfo | URL) => { calls.push(String(input)); return Response.json({ tracks: [{ catalogId: '1', genre: null, durationMs: 3000 }], status: 'partial', storefront: 'us' }) }, { preconnect: fetch.preconnect }))
    const imports = spyOn(client, 'importTracks')
    try {
      restoreStickerSession(createFixtureProvider()); await flush()
      await bootstrapStickerCollection({ withMusicAuthorization: consume => consume('test-only-token') })
      expect(calls).toEqual(['/api/apple/stickers'])
      expect(imports).toHaveBeenCalledWith([{ catalogId: '1', genre: null, durationMs: 3000 }], 'partial')
    } finally { fetcher.mockRestore() }
  })
  test('unavailable durable storage is explicit and does not publish empty state', async () => {
    client.inventory = async () => { throw new Error('OPFS unavailable') }
    restoreStickerSession(createFixtureProvider()); await flush()
    expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('error')
    expect(deviceStore.get(stickerInventoryAtom)).toBeNull()
  })
  test('stale placement conflicts refresh durable state without optimistic save', async () => {
    await refreshStickerCollection()
    saved = { ...saved, placementRevision: 4 }
    await expect(placeSticker({ stickerId: 'PW-A01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0 })).rejects.toThrow()
    expect(deviceStore.get(stickerInventoryAtom)?.placementRevision).toBe(4)
    expect(deviceStore.get(stickerInventoryAtom)?.placements).toEqual([])
  })
  test('queued writes from a stopped generation cannot mutate storage', async () => {
    let finish!: (value: StickerInventory) => void
    client.openPack = () => new Promise(resolve => { finish = resolve })
    const first = openStickerPack('starter').catch(() => {})
    await flush()
    const second = placeSticker({ stickerId: 'PW-A01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0 }).catch(() => {})
    stopStickerRuntime(true); finish(saved)
    await Promise.all([first, second])
    expect(mutations).toBe(0)
  })
  test('route remount does not duplicate an in-flight import', async () => {
    const provider = createFixtureProvider()
    let finish!: (value: StickerInventory) => void
    let imports = 0
    const bootstrap = () => { imports++; return new Promise<StickerInventory>(resolve => { finish = resolve }) }
    startStickerRuntime(provider, bootstrap); await flush()
    restoreStickerSession(provider); startStickerRuntime(provider, bootstrap)
    finish(saved); await flush()
    expect(imports).toBe(1)
    expect(deviceStore.get(stickerInventoryAtom)).toEqual(saved)
  })
  test('listening ticks use worker enrichment and stop after teardown', async () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('Missing fixture track')
    await provider.play({ kind: 'tracks', tracks: [{ ...track, catalogId: '123' }], startIndex: 0 })
    const observed: { streamId: string; sequence: number }[] = []
    let enriched = false
    client.needsEnrichment = async () => !enriched
    client.enrichTrack = async () => { enriched = true }
    client.observe = async observation => { observed.push(observation); return saved }
    let now = 0
    const clock = spyOn(performance, 'now').mockImplementation(() => now)
    const fetcher = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      return body.action === 'import' ? Response.json({ tracks: [], status: 'complete', storefront: 'us' }) : Response.json({ catalogId: '123', genre: 'rock', durationMs: 240000 })
    }, { preconnect: fetch.preconnect }))
    try {
      restoreStickerSession(provider)
      startStickerRuntime(provider, () => bootstrapStickerCollection({ withMusicAuthorization: consume => consume('test-token') }))
      await flush(); await flush()
      provider.tick(1); await flush(); await flush()
      now = 10000; provider.tick(10000); await flush(); await flush()
      expect(enriched).toBe(true)
      expect(observed.map(event => event.sequence)).toEqual([0, 1])
      const firstStream = observed[0]?.streamId
      now = 11000; await provider.seek(100000); provider.tick(1); await flush(); await flush()
      expect(observed.at(-1)?.sequence).toBe(0)
      expect(observed.at(-1)?.streamId).not.toBe(firstStream)
      const count = observed.length
      stopStickerRuntime(true); now = 30000; provider.tick(10000); await flush()
      expect(observed).toHaveLength(count)
    } finally { clock.mockRestore(); fetcher.mockRestore() }
  })
  test('a delayed read cannot rewind a newer placement publication', async () => {
    await refreshStickerCollection()
    let complete!: (value: StickerInventory) => void
    const before = saved
    client.inventory = () => new Promise(resolve => { complete = resolve })
    const refresh = refreshStickerCollection()
    await flush()
    await placeSticker({ stickerId: 'PW-A01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0 })
    client.inventory = async () => saved
    complete(before); await refresh
    expect(deviceStore.get(stickerInventoryAtom)?.placements).toHaveLength(1)
    expect(deviceStore.get(stickerInventoryAtom)?.placementRevision).toBe(1)
  })
  test('retry recreates failed worker transport', async () => {
    client.inventory = async () => { throw new Error('closed worker') }
    restoreStickerSession(createFixtureProvider()); await flush()
    client.inventory = async () => saved
    await retryStickerCollection()
    expect(factory).toHaveBeenCalledTimes(2)
    expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('ready')
  })
  test('retry of a restored failed import requires an explicit music connection instead of succeeding unchanged', async () => {
    saved = { ...saved, importStatus: 'failed' }
    const provider = createFixtureProvider({ authorized: false })
    const authorize = spyOn(provider, 'authorize')
    const fetcher = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected_network'))
    try {
      restoreStickerSession(provider); await flush()
      await expect(retryStickerCollection()).rejects.toMatchObject({ code: 'music_authorization_required' })
      expect(deviceStore.get(stickerInventoryAtom)).toEqual(saved)
      expect(deviceStore.get(stickerCollectionStatusAtom)).toBe('ready')
      expect(authorize).not.toHaveBeenCalled()
      expect(fetcher).not.toHaveBeenCalled()
      expect(mutations).toBe(0)
    } finally { authorize.mockRestore(); fetcher.mockRestore() }
  })
  test('connected retry reruns library import and clears its failed state without reauthorization', async () => {
    saved = { ...saved, importStatus: 'failed' }
    const provider = createFixtureProvider()
    const authorize = spyOn(provider, 'authorize')
    let attempts = 0
    try {
      restoreStickerSession(provider)
      startStickerRuntime(provider, async () => { attempts++; if (attempts > 1) saved = { ...saved, importStatus: 'complete' }; return saved })
      await flush(); await flush()
      expect(deviceStore.get(stickerInventoryAtom)?.importStatus).toBe('failed')
      await retryStickerCollection()
      expect(attempts).toBe(2)
      expect(deviceStore.get(stickerInventoryAtom)?.importStatus).toBe('complete')
      expect(deviceStore.get(stickerInventoryAtom)?.stickerIds).toEqual(inventory.stickerIds)
      expect(authorize).not.toHaveBeenCalled()
    } finally { authorize.mockRestore() }
  })
  test('backup uses local transport and restore publishes new revision', async () => {
    await refreshStickerCollection()
    const backup = await exportStickerBackup()
    await importStickerBackup(backup)
    expect(deviceStore.get(stickerInventoryAtom)?.placementRevision).toBe(1)
  })
})
