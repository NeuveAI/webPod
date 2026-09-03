import { describe, expect, test } from 'bun:test'
import { createAppleProvider, MUSICKIT_SCRIPT_URL, type MusicKitGlobalLike, type MusicKitInstanceLike } from './apple-provider.ts'

function fakeMusic(): MusicKitInstanceLike & { emit(name: string): void; setNowPlaying(item: unknown): void; setQueuePosition(position: number | undefined): void; removed: string[]; calls: string[]; queueDescriptors: Readonly<Record<string, unknown>>[] } {
  const listeners = new Map<string, Set<(event: unknown) => void>>(); const calls: string[] = []; const removed: string[] = []
  const queueDescriptors: Readonly<Record<string, unknown>>[] = []; let nowPlaying: unknown; let queuePosition: number | undefined
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
    isAuthorized: true, storefrontId: 'se', volume: 0.5, shuffleMode: 0, repeatMode: 0, playbackState: 3, currentPlaybackTime: 12, currentPlaybackDuration: 240,
    get nowPlayingItem() { return nowPlaying },
    get queue() { return queuePosition === undefined ? undefined : { position: queuePosition } },
    async authorize() { calls.push('authorize'); return 'opaque-user' }, async unauthorize() { calls.push('unauthorize') }, async setQueue(descriptor) { calls.push('setQueue'); queueDescriptors.push(descriptor) }, async play() { calls.push('play') }, async pause() { calls.push('pause') }, async skipToNextItem() { calls.push('next') }, async skipToPreviousItem() { calls.push('previous') }, async seekToTime(value) { calls.push(`seek:${String(value)}`) }, async playLater() { calls.push('later') }, async playNext() { calls.push('nextQueue') },
    addEventListener(name, callback) { const set = listeners.get(name) ?? new Set(); set.add(callback); listeners.set(name, set) }, removeEventListener(name, callback) { listeners.get(name)?.delete(callback); removed.push(name) }, emit(name) { for (const callback of listeners.get(name) ?? []) callback({}) }, setNowPlaying(item) { nowPlaying = item }, setQueuePosition(position) { queuePosition = position }, removed, calls, queueDescriptors,
  }
}
function setup(timing: Pick<NonNullable<Parameters<typeof createAppleProvider>[0]>, 'playbackConfirmationTimeoutMs' | 'setTimeout' | 'clearTimeout'> = {}) { const music = fakeMusic(); const kit: MusicKitGlobalLike = { async configure() { return music }, getInstance() { return music }, PlaybackStates: { playing: 3 }, PlayerShuffleMode: { off: 0, songs: 1, albums: 2 }, PlayerRepeatMode: { off: 0, one: 1, all: 2 } }; return { music, provider: createAppleProvider({ async loadMusicKit() { return kit }, async fetchDeveloperToken() { return { token: 'test-token-never-logged', expiresAt: 2_000 } }, setTimeout: () => 1, clearTimeout() {}, ...timing }) } }

describe('Apple provider', () => {
  test('uses the stable MusicKit script required by the production integration', () => { expect(MUSICKIT_SCRIPT_URL).toBe('https://js-cdn.music.apple.com/musickit/v1/musickit.js') })
  test('coalesces concurrent configuration before authorization', async () => {
    const music = fakeMusic(); let loads = 0; let tokens = 0; let configures = 0
    const kit: MusicKitGlobalLike = { async configure() { configures += 1; return music }, getInstance() { return music } }
    const provider = createAppleProvider({ async loadMusicKit() { loads += 1; await Promise.resolve(); return kit }, async fetchDeveloperToken() { tokens += 1; return { token: 'test-token-never-logged', expiresAt: 2_000 } } })
    await Promise.all([provider.configure(), provider.configure(), provider.configure()])
    expect({ loads, tokens, configures }).toEqual({ loads: 1, tokens: 1, configures: 1 })
  })
  test('configures, authorizes, signs out, and reports storefront', async () => { const { provider, music } = setup(); const sessions: unknown[] = []; const off = provider.onSessionChange((value) => sessions.push(value)); await provider.configure(); const session = await provider.authorize(); expect(session.storefront).toBe('se'); expect(session.userIdentifier).toBe('opaque-user'); await provider.unauthorize(); off(); expect(sessions.at(-1)).toBeNull(); expect(music.calls).toContain('unauthorize') })
  test('maps library pages, preserves stable local identity, and rejects invented cursors', async () => { const { provider } = setup(); await provider.configure(); const first = await provider.libraryList('playlists'); expect(first.total).toBe(1); expect(first.items[0]?.kind).toBe('playlist'); const firstKey = first.items[0]?.key; const again = await provider.libraryList('playlists'); expect(again.items[0]?.key).toBe(firstKey); await expect(provider.libraryList('playlists', '/invented')).rejects.toHaveProperty('_tag', 'InvalidCursor') })
  test('subscribes to playback and removes consumer callbacks cleanly', async () => { const { provider, music } = setup(); await provider.configure(); let changes = 0; let ticks = 0; const offState = provider.onPlaybackChange(() => { changes += 1 }); const offTick = provider.onProgress(() => { ticks += 1 }); music.emit('playbackStateDidChange'); music.emit('playbackTimeDidChange'); expect(changes).toBe(1); expect(ticks).toBe(1); offState(); offTick(); music.emit('playbackStateDidChange'); music.emit('playbackTimeDidChange'); expect(changes).toBe(1); expect(ticks).toBe(1) })
  test('drives documented transport primitives', async () => { const { provider, music } = setup(); await provider.configure(); await provider.play(); await provider.pause(); await provider.seek(500_000); await provider.skip('next'); expect(music.calls).toEqual(expect.arrayContaining(['play', 'pause', 'seek:240', 'next'])) })
  test('queues the exact track target and start index before invoking playback', async () => {
    const { provider, music } = setup(); await provider.configure()
    const page = await provider.libraryList('songs'); const track = page.items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    await provider.play({ kind: 'tracks', tracks: [track, { ...track, catalogId: 'catalog-song.2' }], startIndex: 1 })
    expect(music.queueDescriptors).toEqual([{ songs: ['catalog-song.1', 'catalog-song.2'], startPosition: 1 }])
    expect(music.calls.slice(-2)).toEqual(['setQueue', 'play'])
  })
  test('coalesces duplicate selections and stays loading until MusicKit confirms the item', async () => {
    const { provider, music } = setup(); await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    let releaseQueue: (() => void) | undefined
    music.setQueue = async (descriptor) => {
      music.calls.push('setQueue')
      music.queueDescriptors.push(descriptor)
      await new Promise<void>((resolve) => { releaseQueue = resolve })
    }
    const states: string[] = []
    provider.onPlaybackChange((playback) => states.push(`${playback.status}:${playback.now?.catalogId ?? 'none'}`))

    const first = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    const duplicate = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
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
    expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: 'catalog-song.1' } })
    expect(states).toEqual(['loading:none', 'loading:none', 'playing:catalog-song.1'])
  })
  test('rejects a distinct selection while another queue transaction is in flight', async () => {
    const { provider, music } = setup(); await provider.configure()
    const track = (await provider.libraryList('songs')).items[0]
    if (track?.kind !== 'track') throw new Error('library track missing')
    let releaseQueue: (() => void) | undefined
    music.setQueue = async () => { music.calls.push('setQueue'); await new Promise<void>((resolve) => { releaseQueue = resolve }) }
    const first = provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })

    await expect(provider.play({ kind: 'tracks', tracks: [{ ...track, catalogId: 'different-song' }], startIndex: 0 })).rejects.toThrow('already in progress')
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(1)
    releaseQueue?.()
    await first
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
    expect(provider.playback).toMatchObject({ status: 'playing', now: { catalogId: 'catalog-song.1' } })
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

    expect(provider.playback.status).not.toBe('loading')
    await provider.play({ kind: 'tracks', tracks: [track], startIndex: 0 })
    expect(music.calls.filter((call) => call === 'setQueue')).toHaveLength(2)
    expect(music.calls.filter((call) => call === 'play')).toHaveLength(2)
  })
  test('propagates queue and playback rejections without inventing playback state', async () => {
    const queueFailure = setup(); await queueFailure.provider.configure(); queueFailure.music.setQueue = async () => { throw new Error('queue rejected') }
    await expect(queueFailure.provider.play({ kind: 'tracks', tracks: [], startIndex: 0 })).rejects.toThrow('queue rejected')
    expect(queueFailure.provider.playback.status).not.toBe('loading')
    expect(queueFailure.provider.playback.now).toBeNull()
    const playFailure = setup(); await playFailure.provider.configure(); playFailure.music.play = async () => { throw new Error('play rejected') }
    await expect(playFailure.provider.play()).rejects.toThrow('play rejected')
    expect(playFailure.provider.playback.now).toBeNull()
  })
  test('keeps library and catalog counterparts on one local identity after SDK emission', async () => {
    const { provider, music } = setup(); await provider.configure()
    const library = (await provider.libraryList('songs')).items[0]
    if (library?.kind !== 'track') throw new Error('library track missing')
    music.setNowPlaying({ id: 'catalog-song.1', type: 'songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000 } })
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
  test('uses the MusicKit v1 library surface and array responses for lists and relationships', async () => { const { provider } = setup(); await provider.configure(); expect((await provider.libraryList('albums')).items.map((album) => album.kind)).toEqual(['album']); const playlist = (await provider.libraryList('playlists')).items[0]; if (playlist?.kind !== 'playlist') throw new Error('playlist fixture missing'); expect((await provider.relatedTracks(playlist)).map((track) => track.title)).toEqual(['Night']); const artist = { kind: 'artist', key: playlist.key, provider: 'apple', catalogId: 'artist.1', name: 'Artist' } as const; expect((await provider.relatedAlbums(artist)).map((album) => album.title)).toEqual(['Album']) })
})
