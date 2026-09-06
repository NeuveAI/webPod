import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { createFixtureProvider, type ProgressTick, type MusicProvider } from '@webpod/providers'
import { deviceStore, stickerInventoryAtom, stickerCollectionStatusAtom } from '@webpod/state'
import { STICKER_GENRES, type StickerInventory } from '@webpod/stickers'
import { bootstrapStickerCollection, placeSticker, retryStickerCollection, startStickerRuntime, stopStickerRuntime } from './sticker-runtime'

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
