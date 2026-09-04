import { describe, expect, spyOn, test } from 'bun:test'
import { APPLE_CONTINUATION_CACHE_MAX_ENTRIES, APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS, createAppleProvider, MUSICKIT_SCRIPT_URL, type MusicKitGlobalLike, type MusicKitInstanceLike } from './apple-provider.ts'

type FakeMusic = MusicKitInstanceLike & {
  readonly api: MusicKitInstanceLike['api'] & { readonly library: NonNullable<MusicKitInstanceLike['api']['library']> }
  emit(name: string, event?: unknown): void
  setNowPlaying(item: unknown): void
  setPlaybackState(state: number): void
  setCurrentPlaybackTime(seconds: number): void
  setQueueContainer(container: unknown): void
  setQueueItems(items: readonly unknown[]): void
  setQueuePosition(position: number | undefined): void
  removed: string[]
  calls: string[]
  queueDescriptors: Readonly<Record<string, unknown>>[]
}

function fakeMusic(): FakeMusic {
  const listeners = new Map<string, Set<(event: unknown) => void>>(); const calls: string[] = []; const removed: string[] = []
  const queueDescriptors: Readonly<Record<string, unknown>>[] = []; let nowPlaying: unknown; let playbackState = 3; let currentPlaybackTime = 12; let queueContainer: unknown; let queueItems: readonly unknown[] = []; let queuePosition: number | undefined
  const empty = async () => ({ data: { data: [] } })
  const tracks = async () => [{ id: 'song.1', type: 'library-songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000, playParams: { catalogId: 'catalog-song.1' } } }]
  const albums = async () => [{ id: 'album.1', type: 'library-albums', attributes: { name: 'Album', artistName: 'Artist', trackCount: 1 } }]
  return {
    api: {
      library: {
        albums, artists: empty,
        async playlists() { return { data: { data: [{ id: 'p.1', type: 'library-playlists', attributes: { name: 'Focus', canEdit: true, playParams: { globalId: 'pl.1' } } }], meta: { total: 1 } } } },
        songs: tracks, search: empty, albumRelationship: tracks, artistRelationship: albums, playlistRelationship: tracks,
      },
      search: empty, artistRelationship: albums, playlistRelationship: tracks, songRelationship: tracks, station: empty, stations: empty,
    },
    isAuthorized: true, storefrontId: 'se', volume: 0.5, shuffleMode: 0, repeatMode: 0, get playbackState() { return playbackState }, get currentPlaybackTime() { return currentPlaybackTime }, currentPlaybackDuration: 240,
    get nowPlayingItem() { return nowPlaying },
    get queue() { return queueItems.length === 0 && queuePosition === undefined && queueContainer === undefined ? undefined : { items: queueItems, position: queuePosition, itemContainer: queueContainer } },
    async authorize() { calls.push('authorize'); return 'opaque-user' }, async unauthorize() { calls.push('unauthorize') }, async setQueue(descriptor) { calls.push('setQueue'); queueDescriptors.push(descriptor); return { items: [] } }, async play() { calls.push('play') }, async pause() { calls.push('pause') }, async skipToNextItem() { calls.push('next') }, async skipToPreviousItem() { calls.push('previous') }, async seekToTime(value) { calls.push(`seek:${String(value)}`); currentPlaybackTime = value }, async playLater() { calls.push('later') }, async playNext() { calls.push('nextQueue') },
    addEventListener(name, callback) { const set = listeners.get(name) ?? new Set(); set.add(callback); listeners.set(name, set) }, removeEventListener(name, callback) { listeners.get(name)?.delete(callback); removed.push(name) }, emit(name, event = {}) { for (const callback of listeners.get(name) ?? []) callback(event) }, setNowPlaying(item) { nowPlaying = item }, setPlaybackState(state) { playbackState = state }, setCurrentPlaybackTime(seconds) { currentPlaybackTime = seconds }, setQueueContainer(container) { queueContainer = container }, setQueueItems(items) { queueItems = items }, setQueuePosition(position) { queuePosition = position }, removed, calls, queueDescriptors,
  }
}
function setup(timing: Pick<NonNullable<Parameters<typeof createAppleProvider>[0]>, 'playbackConfirmationTimeoutMs' | 'setTimeout' | 'clearTimeout' | 'progressPollIntervalMs' | 'setInterval' | 'clearInterval' | 'playbackDiagnostics' | 'runtimeGlobal'> = {}) { const music = fakeMusic(); const kit: MusicKitGlobalLike = { async configure() { return music }, getInstance() { return music }, PlaybackStates: { loading: 1, paused: 2, playing: 3, waiting: 8 }, PlayerShuffleMode: { off: 0, songs: 1, albums: 2 }, PlayerRepeatMode: { off: 0, one: 1, all: 2 } }; return { music, provider: createAppleProvider({ async loadMusicKit() { return kit }, async fetchDeveloperToken() { return { token: 'test-token-never-logged', expiresAt: 4_102_444_800 } }, setTimeout: () => 1, clearTimeout() {}, ...timing }) } }

function librarySong(index: number, catalogId = `catalog-song.${String(index)}`): unknown {
  return { id: `song.${String(index)}`, type: 'library-songs', attributes: { name: `Song ${String(index)}`, artistName: 'Artist', durationInMillis: 180000, playParams: { catalogId } } }
}

function libraryAlbum(index: number): unknown {
  return { id: `album.${String(index)}`, type: 'library-albums', attributes: { name: `Album ${String(index)}`, artistName: 'Artist', trackCount: 1 } }
}

async function collectSongs(provider: ReturnType<typeof setup>['provider']): Promise<Awaited<ReturnType<typeof provider.libraryList>>['items']> {
  const items = []
  let cursor: string | null = null
  do {
    const page = await provider.libraryList('songs', cursor ?? undefined)
    items.push(...page.items)
    cursor = page.next
  } while (cursor !== null)
  return items
}

describe('Apple provider', () => {
  test('uses the current MusicKit script required by the production integration', () => { expect(MUSICKIT_SCRIPT_URL).toBe('https://js-cdn.music.apple.com/musickit/v3/musickit.js') })
  test('coalesces concurrent configuration before authorization', async () => {
    const music = fakeMusic(); let loads = 0; let tokens = 0; let configures = 0; let cancelled = 0
    let nowMs = 1_000_000
    const refreshDelays: number[] = []
    const kit: MusicKitGlobalLike = { async configure() { configures += 1; return music }, getInstance() { return music } }
    const provider = createAppleProvider({
      async loadMusicKit() { loads += 1; await Promise.resolve(); return kit },
      async fetchDeveloperToken() { tokens += 1; return { token: 'test-token-never-logged', expiresAt: (nowMs + 3_600_000) / 1_000 } },
      now: () => nowMs,
      scheduleDeveloperTokenRefresh(_callback, delayMs) { refreshDelays.push(delayMs); return refreshDelays.length },
      cancelDeveloperTokenRefresh() { cancelled += 1 },
    })
    await Promise.all([provider.configure(), provider.configure(), provider.configure()])
    expect({ loads, tokens, configures }).toEqual({ loads: 1, tokens: 1, configures: 1 })
    expect(refreshDelays).toEqual([3_600_000 - APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS])
    nowMs += 3_600_000 - APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS
    await provider.libraryList('songs')
    expect({ loads, tokens, configures, cancelled }).toEqual({ loads: 1, tokens: 2, configures: 2, cancelled: 1 })
    expect(provider.session?.status).toBe('authorized')
    expect(music.calls).not.toContain('authorize')
  })
  test('configures, authorizes, signs out, and reports storefront', async () => { const { provider, music } = setup(); const sessions: unknown[] = []; const off = provider.onSessionChange((value) => sessions.push(value)); await provider.configure(); const session = await provider.authorize(); expect(session.storefront).toBe('se'); expect(session.userIdentifier).toBe('opaque-user'); await provider.unauthorize(); off(); expect(sessions.at(-1)).toBeNull(); expect(music.calls).toContain('unauthorize') })
  test('maps library pages, preserves stable local identity, and rejects invented cursors', async () => { const { provider } = setup(); await provider.configure(); const first = await provider.libraryList('playlists'); expect(first.total).toBe(1); expect(first.items[0]?.kind).toBe('playlist'); const firstKey = first.items[0]?.key; const again = await provider.libraryList('playlists'); expect(again.items[0]?.key).toBe(firstKey); await expect(provider.libraryList('playlists', '/invented')).rejects.toHaveProperty('_tag', 'InvalidCursor') })
  test('passes the explicit limit and initial offset to every supported library collection', async () => {
    const { provider, music } = setup()
    const requests = new Map<string, unknown>()
    for (const name of ['albums', 'artists', 'playlists', 'songs'] as const) {
      music.api.library[name] = async (parameters) => { requests.set(name, parameters); return [] }
    }
    await provider.configure()

    for (const kind of ['albums', 'artists', 'playlists', 'songs'] as const) await provider.libraryList(kind)

    expect(Object.fromEntries(requests)).toEqual({
      albums: { limit: '100', offset: '0' },
      artists: { limit: '100', offset: '0' },
      playlists: { limit: '100', offset: '0' },
      songs: { limit: '100', offset: '0' },
    })
  })
  test('uses the v3 generic API surface for personalized requests', async () => {
    const { provider, music } = setup()
    const requests: unknown[] = []
    music.api.music = async (path, parameters) => {
      requests.push([path, parameters])
      return {
        data: {
          data: [{ id: 'song.1', type: 'library-songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000, playParams: { catalogId: 'catalog-song.1' } } }],
          meta: { total: 1 },
        },
      }
    }
    await provider.configure()

    const page = await provider.libraryList('songs')

    expect(requests).toEqual([['/v1/me/library/songs', { limit: '100', offset: '0' }]])
    expect(page.items[0]?.kind).toBe('track')
  })
  test('preserves the explicit page size across structured Apple continuations', async () => {
    const { provider, music } = setup()
    const requests: unknown[] = []
    music.api.music = async (path, parameters) => {
      requests.push([path, parameters])
      const offset = Number(parameters?.['offset'] ?? 0)
      return {
        data: {
          data: [librarySong(offset)],
          ...(offset === 0 ? { next: '/v1/me/library/songs?offset=100&limit=25' } : {}),
        },
      }
    }
    await provider.configure()

    const first = await provider.libraryList('songs')
    if (first.next === null) throw new Error('structured continuation missing')
    await provider.libraryList('songs', first.next)

    expect(requests).toEqual([
      ['/v1/me/library/songs', { limit: '100', offset: '0' }],
      ['/v1/me/library/songs', { offset: '100', limit: '100' }],
    ])
  })
  test('traverses bare MusicKit arrays beyond 25 items with explicit bounded offsets and stable order', async () => {
    const { provider, music } = setup()
    const source = Array.from({ length: 205 }, (_, index) => librarySong(index))
    const requests: unknown[] = []
    music.api.library.songs = async (parameters) => {
      requests.push(parameters)
      const offset = Number(parameters?.['offset'] ?? 0)
      const limit = Number(parameters?.['limit'] ?? 0)
      return source.slice(offset, offset + limit)
    }
    await provider.configure()

    const items = await collectSongs(provider)

    expect(requests).toEqual([
      { limit: '100', offset: '0' },
      { limit: '100', offset: '100' },
      { limit: '100', offset: '200' },
    ])
    expect(items).toHaveLength(205)
    expect(items.map((item) => item.kind === 'track' ? item.title : '')).toEqual(source.map((_, index) => `Song ${String(index)}`))
    expect(new Set(items.map((item) => item.key))).toHaveLength(205)
  })
  test('terminates a bare-array listing on its first short page without guessing a total', async () => {
    const { provider, music } = setup()
    const requests: unknown[] = []
    music.api.library.songs = async (parameters) => { requests.push(parameters); return Array.from({ length: 7 }, (_, index) => librarySong(index)) }
    await provider.configure()

    const first = await provider.libraryList('songs')

    expect(first.items).toHaveLength(7)
    expect(first.next).toBeNull()
    expect(first.total).toBeNull()
    expect(requests).toEqual([{ limit: '100', offset: '0' }])
  })
  test('skips incomplete records without aborting authorization or a later-page traversal', async () => {
    const { provider, music } = setup()
    const offsets: number[] = []
    const rejectedRecord = { id: 'private-sentinel', type: 'library-albums', attributes: { trackCount: 1 } }
    music.api.library.albums = async (parameters) => {
      const offset = Number(parameters?.['offset'] ?? 0)
      offsets.push(offset)
      return offset === 0
        ? [...Array.from({ length: 99 }, (_, index) => libraryAlbum(index)), rejectedRecord]
        : [libraryAlbum(100), rejectedRecord]
    }
    const log = spyOn(console, 'log').mockImplementation(() => undefined)
    const info = spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await provider.configure()
      expect(provider.appleSessionState.status).toBe('authorized')
      const first = await provider.libraryList('albums')
      expect(first.items).toHaveLength(99)
      expect(first.next).not.toBeNull()
      if (first.next === null) throw new Error('album continuation missing')
      const second = await provider.libraryList('albums', first.next)

      expect(second.items).toHaveLength(1)
      expect(second.next).toBeNull()
      expect(offsets).toEqual([0, 100])
      expect(provider.appleSessionState.status).toBe('authorized')
      expect([log, info, warn, error].flatMap((value) => value.mock.calls)).toEqual([])
    } finally {
      log.mockRestore()
      info.mockRestore()
      warn.mockRestore()
      error.mockRestore()
    }
  })
  test('makes one empty terminal request for an exact multiple of the bare-array page size', async () => {
    const { provider, music } = setup()
    const source = Array.from({ length: 200 }, (_, index) => librarySong(index))
    const offsets: number[] = []
    music.api.library.songs = async (parameters) => {
      const offset = Number(parameters?.['offset'] ?? 0)
      const limit = Number(parameters?.['limit'] ?? 0)
      offsets.push(offset)
      return source.slice(offset, offset + limit)
    }
    await provider.configure()

    expect(await collectSongs(provider)).toHaveLength(200)
    expect(offsets).toEqual([0, 100, 200])
  })
  test('keeps continuation cursors opaque, single-use, and scoped to their collection', async () => {
    const { provider, music } = setup()
    music.api.library.songs = async (parameters) => Array.from({ length: Number(parameters?.['offset'] ?? 0) === 0 ? 100 : 1 }, (_, index) => librarySong(index + Number(parameters?.['offset'] ?? 0)))
    await provider.configure()

    const first = await provider.libraryList('songs')
    if (first.next === null) throw new Error('song continuation missing')
    expect(first.next).not.toContain('/v1/')
    await expect(provider.libraryList('albums', first.next)).rejects.toHaveProperty('_tag', 'InvalidCursor')
    await expect(provider.libraryList('songs', first.next)).rejects.toHaveProperty('_tag', 'InvalidCursor')
    await expect(provider.libraryList('songs', 'invented')).rejects.toHaveProperty('_tag', 'InvalidCursor')

    const retry = await provider.libraryList('songs')
    if (retry.next === null) throw new Error('retry continuation missing')
    expect((await provider.libraryList('songs', retry.next)).items).toHaveLength(1)
    await expect(provider.libraryList('songs', retry.next)).rejects.toHaveProperty('_tag', 'InvalidCursor')
  })
  test('bounds abandoned continuation cursors and retains only the newest handles', async () => {
    const { provider, music } = setup()
    music.api.library.songs = async (parameters) => {
      const offset = Number(parameters?.['offset'] ?? 0)
      return offset === 0 ? Array.from({ length: 100 }, (_, index) => librarySong(index)) : []
    }
    await provider.configure()
    const cursors: string[] = []
    for (let index = 0; index < APPLE_CONTINUATION_CACHE_MAX_ENTRIES + 2; index += 1) {
      const page = await provider.libraryList('songs')
      if (page.next === null) throw new Error('continuation missing')
      cursors.push(page.next)
    }

    await expect(provider.libraryList('songs', cursors[0])).rejects.toHaveProperty('_tag', 'InvalidCursor')
    const newest = cursors.at(-1)
    if (newest === undefined) throw new Error('newest continuation missing')
    await expect(provider.libraryList('songs', newest)).resolves.toMatchObject({ items: [], next: null })
  })
  test('preserves legitimate duplicate catalog occurrences and their order across pages', async () => {
    const { provider, music } = setup()
    const firstPage = Array.from({ length: 100 }, (_, index) => librarySong(index))
    const duplicateA = { id: 'library-copy.a', type: 'library-songs', attributes: { name: 'First copy', artistName: 'Artist', durationInMillis: 180000, playParams: { catalogId: 'shared-catalog' } } }
    const duplicateB = { id: 'library-copy.b', type: 'library-songs', attributes: { name: 'Second copy', artistName: 'Artist', durationInMillis: 180000, playParams: { catalogId: 'shared-catalog' } } }
    music.api.library.songs = async (parameters) => Number(parameters?.['offset'] ?? 0) === 0 ? firstPage : [duplicateA, duplicateB]
    await provider.configure()

    const items = await collectSongs(provider)
    const copies = items.slice(-2)

    expect(copies.map((item) => item.kind === 'track' ? item.title : '')).toEqual(['First copy', 'Second copy'])
    expect(copies[0]?.key).toBe(copies[1]?.key)
  })
  test('translates structured next metadata into opaque cursors without regressing totals', async () => {
    const { provider, music } = setup()
    const requests: unknown[] = []
    const rawNext = '/v1/me/library/songs?offset=1&limit=1'
    music.api.library.songs = async (parameters) => {
      requests.push(parameters)
      return Number(parameters?.['offset'] ?? 0) === 0
        ? { data: { data: [librarySong(0)], next: rawNext, meta: { total: 2 } } }
        : { data: { data: [librarySong(1)], meta: { total: 2 } } }
    }
    await provider.configure()

    const first = await provider.libraryList('songs')
    if (first.next === null) throw new Error('structured continuation missing')
    expect(first.next).not.toBe(rawNext)
    expect(first.total).toBe(2)
    const second = await provider.libraryList('songs', first.next)

    expect(second.items).toHaveLength(1)
    expect(second.next).toBeNull()
    expect(second.total).toBe(2)
    expect(requests).toEqual([{ limit: '100', offset: '0' }, { offset: '1', limit: '100' }])
  })
  test('fails safely when the MusicKit facade repeats a full page despite advancing offsets', async () => {
    const { provider, music } = setup()
    const repeated = Array.from({ length: 100 }, (_, index) => librarySong(index))
    const offsets: string[] = []
    music.api.library.songs = async (parameters) => { offsets.push(String(parameters?.['offset'])); return repeated }
    await provider.configure()

    const first = await provider.libraryList('songs')
    if (first.next === null) throw new Error('continuation missing')
    await expect(provider.libraryList('songs', first.next)).rejects.toThrow('Apple Music library pagination did not advance')
    expect(offsets).toEqual(['0', '100'])
    await expect(provider.libraryList('songs', first.next)).rejects.toHaveProperty('_tag', 'InvalidCursor')
  })
  test('subscribes to playback and removes consumer callbacks cleanly', async () => { const { provider, music } = setup(); await provider.configure(); let changes = 0; let ticks = 0; const offState = provider.onPlaybackChange(() => { changes += 1 }); const offTick = provider.onProgress(() => { ticks += 1 }); music.emit('playbackStateDidChange'); music.emit('playbackTimeDidChange'); expect(changes).toBe(1); expect(ticks).toBe(1); offState(); offTick(); music.emit('playbackStateDidChange'); music.emit('playbackTimeDidChange'); expect(changes).toBe(1); expect(ticks).toBe(1) })
  test('polls MusicKit progress while playing when v3 omits time-change events', async () => {
    let poll: (() => void) | undefined
    let clears = 0
    const { provider, music } = setup({
      setInterval(callback) { poll = callback; return 7 },
      clearInterval() { clears += 1 },
    })
    await provider.configure()
    music.setNowPlaying({ id: 'catalog-song.1', type: 'song', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 240000 } })
    music.emit('nowPlayingItemDidChange')
    music.setCurrentPlaybackTime(13)

    poll?.()

    expect(provider.playback.positionMs).toBe(13_000)
    music.setPlaybackState(2)
    poll?.()
    expect(clears).toBe(1)
  })
  test('preserves the last valid playback sample when MusicKit reports non-finite numbers', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setNowPlaying({ id: 'catalog-song.1', type: 'song', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 240000 } })
    music.setCurrentPlaybackTime(13)
    music.emit('nowPlayingItemDidChange')
    const mutableMusic = music as unknown as { currentPlaybackDuration: number; volume: number }

    mutableMusic.currentPlaybackDuration = Number.NaN
    mutableMusic.volume = Number.NaN
    music.setCurrentPlaybackTime(Number.NaN)
    music.emit('playbackTimeDidChange')

    expect(provider.playback.positionMs).toBe(13_000)
    expect(provider.playback.durationMs).toBe(240_000)
    expect(provider.playback.volume0to100).toBe(50)
    expect(provider.playback.positionMs).not.toBeNaN()
    expect(provider.playback.durationMs).not.toBeNaN()
  })
  test('drives documented transport primitives', async () => { const { provider, music } = setup(); await provider.configure(); await provider.play(); await provider.pause(); await provider.seek(500_000); await provider.skip('next'); expect(music.calls).toEqual(expect.arrayContaining(['play', 'pause', 'seek:240', 'next'])) })
  test('resumes a provider-owned paused item without gating play behind a seek', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setNowPlaying(librarySong(1))
    music.setPlaybackState(3)
    music.setCurrentPlaybackTime(20)
    music.emit('nowPlayingItemDidChange')
    music.emit('playbackStateDidChange')
    await provider.pause()

    await provider.play()

    expect(music.calls.at(-1)).toBe('play')
    expect(music.calls).not.toContain('seek:20')
    music.setPlaybackState(3)
    music.setCurrentPlaybackTime(21)
    music.emit('playbackStateDidChange')
    expect(provider.playback.positionMs).toBe(21_000)
  })
  test('restarts previous after three seconds and otherwise delegates to the MusicKit queue', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setPlaybackState(3)
    music.emit('playbackStateDidChange')
    music.setCurrentPlaybackTime(3.01)
    await provider.skip('previous')
    expect(music.calls.at(-1)).toBe('seek:0')

    music.setCurrentPlaybackTime(3)
    await provider.skip('previous')
    expect(music.calls.at(-1)).toBe('previous')
  })
  test('restarts an actively playing facade from its live playback time', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setNowPlaying(librarySong(1))
    music.setPlaybackState(3)
    music.setCurrentPlaybackTime(51)
    music.emit('nowPlayingItemDidChange')
    music.emit('playbackStateDidChange')

    await provider.skip('previous')

    expect(provider.playback.status).toBe('playing')
    expect(provider.playback.positionMs).toBe(0)
    expect(music.calls.at(-1)).toBe('seek:0')
    music.setCurrentPlaybackTime(1)
    music.emit('playbackTimeDidChange')
    expect(provider.playback.positionMs).toBe(1_000)
  })
  test('preserves the playing intent across an item-changing skip', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setPlaybackState(3)
    music.emit('playbackStateDidChange')

    await provider.skip('next')

    expect(music.calls.at(-1)).toBe('next')
  })
  test('keeps a paused queue paused after an item-changing skip', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setPlaybackState(2)
    music.emit('playbackStateDidChange')
    music.skipToNextItem = async () => {
      music.calls.push('next')
      // The real MusicKit facade implicitly starts replacement media on skip.
      music.setPlaybackState(3)
    }

    await provider.skip('next')

    expect(music.calls.slice(-2)).toEqual(['next', 'pause'])
    expect(provider.playback.status).toBe('paused')
  })
  test('does not resume a stale skip after a concurrent pause', async () => {
    const { provider, music } = setup()
    let releaseSkip: (() => void) | undefined
    const skipGate = new Promise<void>((resolve) => { releaseSkip = resolve })
    music.skipToNextItem = async () => { music.calls.push('next'); await skipGate }
    await provider.configure()
    music.setPlaybackState(3)
    music.emit('playbackStateDidChange')

    const skipping = provider.skip('next')
    while (!music.calls.includes('next')) await Promise.resolve()
    await provider.pause()
    releaseSkip?.()
    await skipping

    expect(music.calls.slice(-2)).toEqual(['next', 'pause'])
  })
  test('a pause during an in-flight play transaction cannot restart hidden playback', async () => {
    const { provider, music } = setup()
    let releasePlay: (() => void) | undefined
    const playGate = new Promise<void>((resolve) => { releasePlay = resolve })
    music.play = async () => { music.calls.push('play'); await playGate }
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')

    const playing = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    while (!music.calls.includes('play')) await Promise.resolve()
    const pausing = provider.pause()
    releasePlay?.()
    await Promise.allSettled([playing, pausing])

    expect(music.calls.slice(-3)).toEqual(['play', 'pause', 'pause'])
    expect(provider.playback.status).toBe('paused')
  })
  test('queues the exact track target and start index before invoking playback', async () => {
    const { provider, music } = setup(); await provider.configure()
    const page = await provider.libraryList('songs'); const track = page.items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    music.changeToMediaAtIndex = async (index) => { music.calls.push(`change:${String(index)}`) }
    await provider.play({ kind: 'tracks', tracks: [track, { ...track, catalogId: 'catalog-song.2' }], startIndex: 1 })
    expect(music.queueDescriptors).toEqual([{ songs: ['catalog-song.1', 'catalog-song.2'] }])
    expect(music.calls.slice(-2)).toEqual(['setQueue', 'change:1'])
  })
  test('bounds a large song list around the selection and preserves its public queue index', async () => {
    const { provider, music } = setup(); await provider.configure()
    const first = (await provider.libraryList('songs')).items[0]
    if (first?.kind !== 'track') throw new Error('library track missing')
    const tracks = Array.from({ length: 250 }, (_, index) => ({ ...first, key: `${first.key}-${String(index)}` as typeof first.key, catalogId: `catalog-song.${String(index)}` }))

    await provider.play({ kind: 'tracks', tracks, startIndex: 175 })

    const descriptor = music.queueDescriptors.at(-1)
    expect(Array.isArray(descriptor?.['songs']) ? descriptor['songs'].length : 0).toBe(100)
    expect(descriptor).not.toHaveProperty('startPosition')
    expect((descriptor?.['songs'] as readonly string[])[0]).toBe('catalog-song.125')
    expect((descriptor?.['songs'] as readonly string[]).at(-1)).toBe('catalog-song.224')
    music.setQueuePosition(50)
    music.setQueueItems(Array.from({ length: 100 }, (_, index) => librarySong(index + 125)))
    music.setNowPlaying({ id: 'catalog-song.175', type: 'songs', attributes: { name: 'Selected', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback.queueIndex).toBe(175)

    const queue = await provider.queueRead()
    expect(queue.history).toHaveLength(50)
    expect(queue.next).toHaveLength(49)
    expect(queue.now?.catalogId).toBe('catalog-song.175')
  })
  test('reads shuffled queue order from the live MusicKit facade rather than source order', async () => {
    const { provider, music } = setup()
    await provider.configure()
    const first = (await provider.libraryList('songs')).items[0]
    if (first?.kind !== 'track') throw new Error('library track missing')
    const second = { ...first, key: `${first.key}-2` as typeof first.key, catalogId: 'catalog-song.2' }
    const third = { ...first, key: `${first.key}-3` as typeof first.key, catalogId: 'catalog-song.3' }
    await provider.setShuffle('songs')
    await provider.play({ kind: 'tracks', tracks: [first, second, third], startIndex: 0 })
    music.setQueueItems([librarySong(3), librarySong(1), librarySong(2)])
    music.setQueuePosition(1)
    music.setNowPlaying(librarySong(1))
    music.emit('queueItemsDidChange')
    music.emit('nowPlayingItemDidChange')

    const queue = await provider.queueRead()
    expect(queue.history.map((track) => track.catalogId)).toEqual(['catalog-song.3'])
    expect(queue.now?.catalogId).toBe('catalog-song.1')
    expect(queue.next.map((track) => track.catalogId)).toEqual(['catalog-song.2'])
    await provider.skip('next')
    expect(music.calls.at(-1)).toBe('next')
  })
  test('coalesces idle preparation and reuses its exact queue when playback is selected', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const target = { kind: 'tracks', tracks: [track], startIndex: 0 } as const

    await Promise.all([provider.prepare(target), provider.prepare(target)])
    expect(music.queueDescriptors).toEqual([{ songs: ['catalog-song.1'] }])
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(0)
    music.setQueueItems([{ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } }])
    music.setQueuePosition(0)
    music.emit('queueItemsDidChange')

    await provider.play(target)
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(1)
  })
  test('retains a prepared queue when MusicKit emits its unpositioned queue before setQueue resolves', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const target = { kind: 'tracks', tracks: [track], startIndex: 0 } as const
    const queueItem = { id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }
    music.setQueue = async (descriptor) => {
      music.calls.push('setQueue')
      music.queueDescriptors.push(descriptor)
      music.setQueueItems([queueItem])
      music.setQueuePosition(-1)
      music.emit('queueItemsDidChange')
      return { items: [queueItem] }
    }

    await provider.prepare(target)
    await provider.play(target)

    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(1)
  })
  test('does not rebuild a bounded prepared queue when progressive hydration appends distant songs', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const first = (await provider.libraryList('songs')).items[0]
    if (first?.kind !== 'track') throw new Error('library track missing')
    const tracks = Array.from({ length: 200 }, (_, index) => ({ ...first, catalogId: `catalog-song.${String(index)}` }))
    const queuedItems = tracks.slice(0, 100).map((track) => ({ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }))

    await provider.prepare({ kind: 'tracks', tracks: tracks.slice(0, 100), startIndex: 0 })
    music.setQueueItems(queuedItems)
    music.setQueuePosition(0)
    music.emit('queueItemsDidChange')
    await provider.prepare({ kind: 'tracks', tracks, startIndex: 0 })

    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
  })
  test('station start invalidates a completed prepared queue before the original target plays', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const target = { kind: 'tracks', tracks: [track], startIndex: 0 } as const
    await provider.prepare(target)
    music.setQueueItems([{ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }])
    music.setQueuePosition(0)
    music.emit('queueItemsDidChange')

    await provider.stationStart({ type: 'station', ref: 'station-x' })
    await provider.play(target)

    expect(music.queueDescriptors).toEqual([
      { songs: ['catalog-song.1'] },
      { station: 'station-x' },
      { songs: ['catalog-song.1'] },
    ])
  })
  test('public queue and ordering mutations invalidate a completed prepared queue identity', async () => {
    for (const mutation of ['append', 'insert', 'skip', 'shuffle'] as const) {
      const { provider, music } = setup()
      music.setPlaybackState(0)
      await provider.configure()
      const track = (await provider.libraryList('songs')).items[0]
      if (track?.kind !== 'track') throw new Error('library track missing')
      const target = { kind: 'tracks', tracks: [track], startIndex: 0 } as const
      const other = { ...track, catalogId: 'catalog-song.2' }
      await provider.prepare(target)
      music.setQueueItems([{ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }])
      music.setQueuePosition(0)
      music.emit('queueItemsDidChange')

      if (mutation === 'append') await provider.queueAppend([other])
      else if (mutation === 'insert') await provider.queueInsertNext([other])
      else if (mutation === 'skip') await provider.skip('next')
      else await provider.setShuffle('songs')
      await provider.play(target)

      expect(music.queueDescriptors).toEqual([
        { songs: ['catalog-song.1'] },
        { songs: ['catalog-song.1'] },
      ])
    }
  })
  test('an unrelated external queue event invalidates completed preparation identity', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const target = { kind: 'tracks', tracks: [track], startIndex: 0 } as const
    await provider.prepare(target)
    music.setQueueItems([{ id: 'catalog-song.2', type: 'songs', attributes: { name: 'Other', artistName: 'Artist', durationInMillis: 180000 } }])
    music.setQueuePosition(0)
    music.emit('queueItemsDidChange')

    await provider.play(target)

    expect(music.queueDescriptors).toEqual([
      { songs: ['catalog-song.1'] },
      { songs: ['catalog-song.1'] },
    ])
  })
  test('station start waits out and invalidates an in-flight preparation before mutating the queue', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const target = { kind: 'tracks', tracks: [track], startIndex: 0 } as const
    let releaseFirstQueue: (() => void) | undefined
    let queueCalls = 0
    music.setQueue = async (descriptor) => {
      music.calls.push('setQueue')
      music.queueDescriptors.push(descriptor)
      queueCalls += 1
      if (queueCalls === 1) await new Promise<void>((resolve) => { releaseFirstQueue = resolve })
      return { items: [] }
    }

    const preparation = provider.prepare(target)
    await Promise.resolve()
    await Promise.resolve()
    const station = provider.stationStart({ type: 'station', ref: 'station-x' })
    expect(music.queueDescriptors).toEqual([{ songs: ['catalog-song.1'] }])
    releaseFirstQueue?.()
    await Promise.all([preparation, station])
    await provider.play(target)

    expect(music.queueDescriptors).toEqual([
      { songs: ['catalog-song.1'] },
      { station: 'station-x' },
      { songs: ['catalog-song.1'] },
    ])
  })
  test('preparation is a no-op for playing and paused current items', async () => {
    for (const playbackState of [3, 2]) {
      const { provider, music } = setup()
      music.setPlaybackState(playbackState)
      music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
      await provider.configure()
      const track = (await provider.libraryList('songs')).items[0]
      if (track?.kind !== 'track') throw new Error('library track missing')

      await provider.prepare({ kind: 'tracks', tracks: [track], startIndex: 0 })

      expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(0)
      expect(provider.playback.now?.catalogId).toBe('catalog-song.1')
    }
  })
  test('an already-aborted preparation intent never reaches MusicKit', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const abort = new AbortController()
    abort.abort()

    await provider.prepare({ kind: 'tracks', tracks: [track], startIndex: 0 }, abort.signal)

    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(0)
  })
  test('coalesces duplicate selections and stays loading until the selected playback clock advances', async () => {
    const { provider, music } = setup(); await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    let releaseQueue: (() => void) | undefined
    music.setQueue = async (descriptor) => {
      music.calls.push('setQueue')
      music.queueDescriptors.push(descriptor)
      await new Promise<void>((resolve) => { releaseQueue = resolve })
      return { items: [] }
    }
    const states: string[] = []
    provider.onPlaybackChange((playback) => states.push(`${playback.status}:${playback.now?.catalogId ?? 'none'}`))

    const first = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    const duplicate = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    await Promise.resolve()
    expect(provider.playback).toMatchObject({ status: 'loading', now: null })
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
    releaseQueue?.()
    await Promise.all([first, duplicate])
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(1)

    music.emit('playbackStateDidChange')
    expect(provider.playback).toMatchObject({ status: 'loading', now: null })
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback).toMatchObject({ status: 'loading', now: { catalogId: 'catalog-song.1' } })
    music.setCurrentPlaybackTime(13)
    music.emit('playbackTimeDidChange')
    expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: 'catalog-song.1' } })
    expect(states).toEqual(['loading:none', 'loading:none', 'loading:catalog-song.1', 'playing:catalog-song.1'])
  })
  test('reports MusicKit media playback failure even when play resolves and ignores stale success events', async () => {
    const { provider, music } = setup(); await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const providerStates: string[] = []
    provider.onAppleSessionStateChange((state) => {
      if (state.status === 'error') providerStates.push(state.message)
    })

    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    expect(music.calls.slice(-2)).toEqual(['setQueue', 'play'])
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback.status).toBe('loading')
    music.emit('mediaPlaybackError', new Error('The media could not be decoded'))

    expect(provider.playback.status).toBe('error')
    expect(providerStates).toEqual(['Apple Music could not start playback.'])
    music.emit('nowPlayingItemDidChange')
    music.emit('playbackStateDidChange')
    expect(provider.playback.status).toBe('error')
  })
  test('treats a raw SDK error during pending B as provider-level and blocks stale success events', async () => {
    const { provider, music } = setup(); await provider.configure()
    const first = (await provider.libraryList('songs')).items[0]
    if (first?.kind !== 'track') throw new Error('library track missing')
    const second = { ...first, catalogId: 'catalog-song.2', title: 'Morning' }
    const firstItem = { id: first.catalogId, type: 'songs', attributes: { name: first.title, artistName: first.artistName, durationInMillis: first.durationMs } }
    const secondItem = { id: second.catalogId, type: 'songs', attributes: { name: second.title, artistName: second.artistName, durationInMillis: second.durationMs } }

    await provider.play({ kind: 'tracks', tracks: [first], startIndex: 0 })
    music.setNowPlaying(firstItem)
    music.emit('nowPlayingItemDidChange')
    await provider.play({ kind: 'tracks', tracks: [second], startIndex: 0 })

    music.emit('mediaPlaybackError', { name: 'AbortError', message: 'Media playback stopped' })
    expect(provider.playback.status).toBe('error')
    expect(provider.appleSessionState).toMatchObject({ status: 'error', message: 'Apple Music could not start playback.' })

    music.setNowPlaying(secondItem)
    music.emit('nowPlayingItemDidChange')
    music.emit('playbackStateDidChange')
    expect(provider.playback.status).toBe('error')
  })
  test('uses MusicKit v3 media events and detaches every SDK listener across sign-out and reauthorization', async () => {
    const { provider, music } = setup(); await provider.configure()
    expect(music.removed).toEqual([])

    await provider.unauthorize()

    expect(music.removed).toEqual([
      'playbackStateDidChange',
      'queueItemsDidChange',
      'nowPlayingItemDidChange',
      'mediaPlaybackError',
      'playbackTimeDidChange',
    ])
    await provider.authorize()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback.status).toBe('loading')
    music.setCurrentPlaybackTime(13)
    music.emit('playbackTimeDidChange')
    expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: 'catalog-song.1' } })
  })
  test('reports every diagnostic hook with its truthful MusicKit event name', async () => {
    const names: string[] = []
    const { provider, music } = setup({ playbackDiagnostics: { capture(event) { names.push(event) } } })
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    for (const event of ['queueItemsDidChange', 'nowPlayingItemDidChange', 'playbackStateDidChange', 'playbackTimeDidChange', 'mediaCanPlay', 'mediaItemStateDidChange', 'bufferedProgressDidChange', 'mediaPlaybackError']) music.emit(event)
    expect(names).toEqual(['setQueue', 'setQueueResolve', 'playCall', 'playResolve', 'queueItemsDidChange', 'nowPlayingItemDidChange', 'playbackStateDidChange', 'playbackTimeDidChange', 'mediaCanPlay', 'mediaItemStateDidChange', 'bufferedProgressDidChange', 'mediaPlaybackError'])
    await provider.unauthorize()
    expect(music.removed.slice(-8)).toEqual(['playbackStateDidChange', 'queueItemsDidChange', 'nowPlayingItemDidChange', 'mediaPlaybackError', 'playbackTimeDidChange', 'mediaCanPlay', 'mediaItemStateDidChange', 'bufferedProgressDidChange'])
  })
  test('rapid A to B to C selection serializes as latest-wins before any stale queue can play', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    let releaseQueue: (() => void) | undefined
    let markQueueEntered: (() => void) | undefined
    const queueEntered = new Promise<void>((resolve) => { markQueueEntered = resolve })
    let queueCalls = 0
    music.setQueue = async (descriptor) => {
      queueCalls += 1
      music.calls.push('setQueue')
      music.queueDescriptors.push(descriptor)
      if (queueCalls === 1) {
        markQueueEntered?.()
        await new Promise<void>((resolve) => { releaseQueue = resolve })
      }
      return { items: [] }
    }
    const first = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    await queueEntered
    const secondTrack = { ...track, catalogId: 'different-song', title: 'Different' }
    const second = provider.play({ kind: 'tracks', tracks: [secondTrack], startIndex: 0 })
    const thirdTrack = { ...track, catalogId: 'winning-song', title: 'Winning' }
    const third = provider.play({ kind: 'tracks', tracks: [thirdTrack], startIndex: 0 })
    const firstResult = first.catch((cause: unknown) => cause)
    const secondResult = second.catch((cause: unknown) => cause)

    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
    if (releaseQueue === undefined) throw new Error('queue release missing')
    releaseQueue()
    expect(await firstResult).toBeInstanceOf(Error)
    expect((await firstResult as Error).message).toContain('cancelled')
    expect(await secondResult).toBeInstanceOf(Error)
    expect((await secondResult as Error).message).toContain('superseded')
    await third
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(2)
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(1)
    expect(music.queueDescriptors.at(-1)).toEqual({ songs: ['winning-song'] })
  })
  test('rapid track to station selection shares the latest-wins queue boundary', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('cross-kind fixtures missing')
    const station = (await provider.stationsList())[0] ?? { kind: 'station' as const, key: track.key, provider: 'apple' as const, catalogId: 'station.1', name: 'Station', live: false }
    let releaseQueue: (() => void) | undefined
    let markQueueEntered: (() => void) | undefined
    const queueEntered = new Promise<void>((resolve) => { markQueueEntered = resolve })
    let queueCalls = 0
    music.setQueue = async (descriptor) => {
      queueCalls += 1
      music.calls.push('setQueue')
      music.queueDescriptors.push(descriptor)
      if (queueCalls === 1) {
        markQueueEntered?.()
        await new Promise<void>((resolve) => { releaseQueue = resolve })
      }
      return { items: [] }
    }

    const trackPlay = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    await queueEntered
    const stationPlay = provider.play({ kind: 'station', station })
    const trackResult = trackPlay.catch((cause: unknown) => cause)
    if (releaseQueue === undefined) throw new Error('queue release missing')
    releaseQueue()

    expect(await trackResult).toBeInstanceOf(Error)
    expect((await trackResult as Error).message).toContain('cancelled')
    await stationPlay
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(1)
    expect(music.queueDescriptors.at(-1)).toEqual({ station: 'station.1' })
  })
  test('a user pause invalidates a replacement selection waiting at its pause boundary', async () => {
    const { provider, music } = setup()
    music.setPlaybackState(0)
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    let releaseQueue: (() => void) | undefined
    let markQueueEntered: (() => void) | undefined
    const queueEntered = new Promise<void>((resolve) => { markQueueEntered = resolve })
    music.setQueue = async () => {
      markQueueEntered?.()
      await new Promise<void>((resolve) => { releaseQueue = resolve })
      return { items: [] }
    }
    let releaseReplacementPause: (() => void) | undefined
    let markReplacementPauseEntered: (() => void) | undefined
    const replacementPauseEntered = new Promise<void>((resolve) => { markReplacementPauseEntered = resolve })
    let pauses = 0
    music.pause = async () => {
      pauses += 1
      music.calls.push('pause')
      if (pauses === 1) {
        markReplacementPauseEntered?.()
        await new Promise<void>((resolve) => { releaseReplacementPause = resolve })
      }
    }

    const first = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    await queueEntered
    const replacement = provider.play({ kind: 'tracks', tracks: [{ ...track, catalogId: 'replacement-song' }], startIndex: 0 })
    const firstResult = first.catch((cause: unknown) => cause)
    const replacementResult = replacement.catch((cause: unknown) => cause)
    if (releaseQueue === undefined) throw new Error('queue release missing')
    releaseQueue()
    await replacementPauseEntered

    await provider.pause()
    if (releaseReplacementPause === undefined) throw new Error('replacement pause release missing')
    releaseReplacementPause()

    expect(await firstResult).toBeInstanceOf(Error)
    expect(await replacementResult).toBeInstanceOf(Error)
    expect((await replacementResult as Error).message).toContain('superseded')
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(0)
    expect(provider.playback.status).toBe('paused')
  })
  test('does not let a stale item confirm a newly selected queue', async () => {
    const { provider, music } = setup(); await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    music.setNowPlaying({ id: 'old-song', type: 'songs', attributes: { name: 'Old', artistName: 'Artist', durationInMillis: 1000 } })
    music.emit('nowPlayingItemDidChange')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })

    music.emit('nowPlayingItemDidChange')

    expect(provider.playback.status).toBe('loading')
    expect(provider.playback.now?.catalogId).toBe('old-song')
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback.status).toBe('loading')
    music.setCurrentPlaybackTime(13)
    music.emit('playbackTimeDidChange')
    expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: 'catalog-song.1' } })
  })
  test('requires a post-request queue transition to confirm collection targets', async () => {
    for (const kind of ['album', 'playlist', 'station'] as const) {
      const { provider, music } = setup(); await provider.configure()
      const oldSong = { id: 'old-song', type: 'songs', attributes: { name: 'Old', artistName: 'Artist', durationInMillis: 1000 } }
      const newSong = { id: `${kind}-song`, type: 'songs', attributes: { name: 'New', artistName: 'Artist', durationInMillis: 1000 } }
      music.setQueueItems([oldSong])
      music.setNowPlaying(oldSong)
      music.emit('nowPlayingItemDidChange')
      const album = (await provider.libraryList('albums')).items[0]
      const playlist = (await provider.libraryList('playlists')).items[0]
      if (album?.kind !== 'album' || playlist?.kind !== 'playlist') throw new Error('collection fixture missing')
      const target = kind === 'album'
        ? { kind, album } as const
        : kind === 'playlist'
          ? { kind, playlist } as const
          : { kind, station: { kind: 'station', key: playlist.key, provider: 'apple', catalogId: 'station.1', name: 'Station', live: false } } as const
      await provider.play(target)

      music.emit('nowPlayingItemDidChange')
      expect(provider.playback.status).toBe('loading')
      music.emit('queueItemsDidChange')
      expect(provider.playback.status).toBe('loading')
      music.emit('nowPlayingItemDidChange')
      expect(provider.playback.status).toBe('loading')
      music.setQueueItems([newSong])
      music.emit('queueItemsDidChange')
      expect(provider.playback.status).toBe('loading')
      music.setNowPlaying(newSong)
      music.emit('nowPlayingItemDidChange')
      expect(provider.playback.status).toBe('loading')
      music.setCurrentPlaybackTime(13)
      music.emit('playbackTimeDidChange')
      expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: `${kind}-song` } })
    }
  })
  test('confirms same-collection replay from matching queue container identity and membership', async () => {
    for (const kind of ['album', 'playlist', 'station'] as const) {
      const { provider, music } = setup(); await provider.configure()
      const song = { id: `${kind}-song`, type: 'songs', attributes: { name: 'Replay', artistName: 'Artist', durationInMillis: 1000 } }
      const album = (await provider.libraryList('albums')).items[0]
      const playlist = (await provider.libraryList('playlists')).items[0]
      if (album?.kind !== 'album' || playlist?.kind !== 'playlist') throw new Error('collection fixture missing')
      const target = kind === 'album'
        ? { kind, album } as const
        : kind === 'playlist'
          ? { kind, playlist } as const
          : { kind, station: { kind: 'station', key: playlist.key, provider: 'apple', catalogId: 'station.1', name: 'Station', live: false } } as const
      const catalogId = kind === 'album' ? album.catalogId : kind === 'playlist' ? playlist.catalogId : 'station.1'
      music.setQueueContainer({ id: catalogId, type: `${kind}s`, attributes: {} })
      music.setQueueItems([song])
      music.setNowPlaying(song)
      music.emit('nowPlayingItemDidChange')

      await provider.play(target)
      music.emit('queueItemsDidChange')
      music.emit('nowPlayingItemDidChange')

      expect(provider.playback).toMatchObject({ status: 'loading', now: { catalogId: `${kind}-song` } })
      music.setCurrentPlaybackTime(13)
      music.emit('playbackTimeDidChange')
      expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: `${kind}-song` } })
    }
  })
  test('does not confirm a collection request from another collection queue and stale item', async () => {
    const { provider, music } = setup(); await provider.configure()
    const album = (await provider.libraryList('albums')).items[0]
    if (album?.kind !== 'album') throw new Error('album fixture missing')
    const staleSong = { id: 'stale-song', type: 'songs', attributes: { name: 'Stale', artistName: 'Artist', durationInMillis: 1000 } }
    music.setQueueContainer({ id: 'different-album', type: 'albums', attributes: {} })
    music.setQueueItems([staleSong])
    music.setNowPlaying(staleSong)

    await provider.play({ kind: 'album', album })
    music.emit('queueItemsDidChange')
    music.emit('nowPlayingItemDidChange')

    expect(provider.playback.status).toBe('loading')
    expect(provider.playback.now?.catalogId).toBe('stale-song')
  })
  test('times out an unconfirmed selection and permits an identical retry', async () => {
    let timeoutCallback: (() => void) | undefined
    const { provider, music } = setup({
      playbackConfirmationTimeoutMs: 50,
      setTimeout(callback) { timeoutCallback = callback; return 1 },
      clearTimeout() {},
    })
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    expect(provider.playback.status).toBe('loading')

    timeoutCallback?.()

    expect(provider.playback).toMatchObject({ status: 'error', now: null })
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(2)
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(2)
  })
  test('sign-out cancels pending confirmation and ignores late callbacks', async () => {
    let timeoutCallback: (() => void) | undefined
    let clears = 0
    const { provider, music } = setup({
      setTimeout(callback) { timeoutCallback = callback; return 1 },
      clearTimeout() { clears += 1 },
    })
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    const states: string[] = []
    provider.onPlaybackChange((playback) => states.push(playback.status))
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    await provider.unauthorize()
    const stateCountAfterSignOut = states.length

    timeoutCallback?.()
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('queueItemsDidChange')
    music.emit('nowPlayingItemDidChange')

    expect(clears).toBe(1)
    expect(provider.playback).toMatchObject({ status: 'idle', now: null })
    expect(states).toHaveLength(stateCountAfterSignOut)
  })
  test('a rejected sign-out preserves the authorized playback transaction and event stream', async () => {
    const { provider, music } = setup(); await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    music.unauthorize = async () => { throw new Error('sign-out rejected') }

    await expect(provider.unauthorize()).rejects.toThrow('sign-out rejected')
    expect(provider.session?.status).toBe('authorized')
    expect(provider.playback.status).toBe('loading')
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')

    expect(provider.playback.status).toBe('loading')
    music.setCurrentPlaybackTime(13)
    music.emit('playbackTimeDidChange')
    expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: 'catalog-song.1' } })
  })
  test('propagates queue and playback rejections without inventing playback state', async () => {
    const queueFailure = setup(); await queueFailure.provider.configure(); queueFailure.music.setQueue = async () => { throw new Error('queue rejected') }
    await expect(queueFailure.provider.play({ kind: 'tracks', tracks: [], startIndex: 0 })).rejects.toThrow('queue rejected')
    expect(queueFailure.provider.playback.status).not.toBe('loading')
    expect(queueFailure.provider.playback.now).toBeNull()

    const recoveredQueue = setup(); await recoveredQueue.provider.configure()
    const selected = (await recoveredQueue.provider.libraryList('songs')).items[0]
    if (selected?.kind !== 'track') throw new Error('library track missing')
    const neighbour = { ...selected, catalogId: 'unavailable-neighbour' }
    let queueAttempts = 0
    recoveredQueue.music.stop = async () => { recoveredQueue.music.calls.push('stop') }
    recoveredQueue.music.setQueue = async (descriptor) => {
      recoveredQueue.music.calls.push('setQueue')
      recoveredQueue.music.queueDescriptors.push(descriptor)
      queueAttempts += 1
      if (queueAttempts === 1) throw new Error('bulk queue rejected')
      return { items: [] }
    }
    await recoveredQueue.provider.play({ kind: 'tracks', tracks: [neighbour, selected], startIndex: 1 })
    expect(recoveredQueue.music.queueDescriptors).toEqual([
      { songs: ['unavailable-neighbour', 'catalog-song.1'] },
      { songs: ['catalog-song.1'] },
    ])
    expect(recoveredQueue.music.calls).toContain('stop')

    const playFailure = setup(); await playFailure.provider.configure(); playFailure.music.play = async () => { throw new Error('play rejected') }
    await expect(playFailure.provider.play()).rejects.toThrow('play rejected')
    expect(playFailure.provider.playback.now).toBeNull()
  })
  test('fails immediately when MusicKit reports playback unsupported by resolving setQueue with void', async () => {
    const names: string[] = []
    const { provider, music } = setup({ playbackDiagnostics: { capture(event) { names.push(event) } } })
    await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    music.setQueue = async () => undefined

    await expect(provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })).rejects.toThrow('unavailable in this browser runtime')

    expect(provider.playback.status).not.toBe('loading')
    expect(provider.playback.now).toBeNull()
    expect(names).toEqual(['setQueue', 'setQueueResolve'])
  })
  test('suppresses a browser process shim throughout MusicKit runtime configuration and restores it', async () => {
    const music = fakeMusic()
    const browserProcess = { env: {} }
    const runtimeGlobal: Record<string, unknown> = { process: browserProcess }
    let processDuringConfigure: unknown = browserProcess
    const kit: MusicKitGlobalLike = {
      async configure() { processDuringConfigure = runtimeGlobal['process']; await Promise.resolve(); return music },
      getInstance() { return music },
    }
    const provider = createAppleProvider({
      async loadMusicKit() { return kit },
      async fetchDeveloperToken() { return { token: 'test-token-never-logged', expiresAt: 2_000 } },
      runtimeGlobal,
    })

    await provider.configure()

    expect(processDuringConfigure).toBeUndefined()
    expect(runtimeGlobal['process']).toBe(browserProcess)
  })
  test('keeps library and catalog counterparts on one local identity after SDK emission', async () => {
    const { provider, music } = setup(); await provider.configure()
    const library = (await provider.libraryList('songs')).items[0]
    if (library?.kind !== 'track') throw new Error('library track missing')
    music.setNowPlaying({ id: 'catalog-song.1', type: 'song', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback.now?.key).toBe(library.key)
    expect(provider.playback.now?.catalogId).toBe(library.catalogId)
  })
  test('publishes MusicKit queue position only with an emitted now-playing item', async () => {
    const { provider, music } = setup(); await provider.configure()
    music.setQueuePosition(2)
    music.emit('queueItemsDidChange')
    expect(provider.playback.queueIndex).toBeNull()
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.emit('nowPlayingItemDidChange')
    expect(provider.playback.queueIndex).toBe(2)
    music.setQueuePosition(0)
    music.emit('playbackStateDidChange')
    expect(provider.playback.queueIndex).toBe(0)
  })
  test('starts station transport exactly once', async () => { const { provider, music } = setup(); await provider.configure(); await provider.stationStart({ type: 'station', ref: 'station.1' }); expect(music.calls.filter((call) => call === 'play')).toHaveLength(1); expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1) })
  test('pauses active media before replacing it with a station queue', async () => {
    const { provider, music } = setup()
    await provider.configure()
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
    music.setPlaybackState(3)
    music.emit('nowPlayingItemDidChange')
    music.calls.length = 0

    await provider.stationStart({ type: 'station', ref: 'station.1' })

    expect(music.calls).toEqual(['pause', 'setQueue', 'play'])
  })
  test('keeps the legacy MusicKit library facade as a compatibility fallback', async () => { const { provider } = setup(); await provider.configure(); expect((await provider.libraryList('albums')).items.map((album) => album.kind)).toEqual(['album']); const playlist = (await provider.libraryList('playlists')).items[0]; if (playlist?.kind !== 'playlist') throw new Error('playlist fixture missing'); expect((await provider.relatedTracks(playlist)).map((track) => track.title)).toEqual(['Night']); const artist = { kind: 'artist', key: playlist.key, provider: 'apple', catalogId: 'artist.1', name: 'Artist' } as const; expect((await provider.relatedAlbums(artist)).map((album) => album.title)).toEqual(['Album']) })
})
