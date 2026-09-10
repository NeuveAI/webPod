import { manageMusic } from '@webpod/music-management'
import { describe, expect, test } from 'bun:test'
import { APPLE_SUPPORTS, createFixtureProvider, type MusicProvider, type PlaybackState } from '@webpod/providers'
import { createProgressiveAppleSource, type MusicRuntimeSnapshot } from './music-runtime'
import { accountStatusForRuntime, pauseProductionPlaybackAtRoot, skipProductionPlayback, toggleProductionPlayback } from './production-device-view'

describe('production device provider status', () => {
  test('keeps failures visible while Apple Music remains the active provider', () => {
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'error' })).toBe('error')
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'signing-in' })).toBe('loading')
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'permission-denied' })).toBeNull()
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'authorized' })).toBeUndefined()
  })

  test('pauses provider playback when navigation returns to the root', async () => {
    const runtime = await fixtureRuntime()
    const { provider, source } = runtime
    await provider.play({ kind: 'tracks', tracks: source.songs, startIndex: 0 })
    expect(provider.playback.status).toBe('playing')

    expect(await pauseProductionPlaybackAtRoot(runtime)).toBe(true)
    expect(provider.playback.status).toBe('paused')

    expect(await toggleProductionPlayback(runtime)).toBe(true)
    expect(provider.playback.status).toBe('playing')
  })

  test('delegates next and previous to the provider-owned ad-hoc queue', async () => {
    const runtime = await fixtureRuntime()
    const { provider, source } = runtime
    const context = runtimeContext(runtime)
    const [first, second, third] = source.songs
    if (first === undefined || second === undefined || third === undefined) throw new Error('fixture songs missing')
    await provider.play({ kind: 'tracks', tracks: [third, first, second], startIndex: 0 })
    expect(await skipProductionPlayback('next', runtime, context)).toBe(true)
    expect(provider.playback.now?.key).toBe(first.key)

    if (!('tick' in provider) || typeof provider.tick !== 'function') throw new Error('fixture clock missing')
    provider.tick(4_000)
    expect(await skipProductionPlayback('previous', runtime, context)).toBe(true)
    expect(provider.playback.now?.key).toBe(first.key)
    expect(provider.playback.positionMs).toBe(0)
    expect(await skipProductionPlayback('previous', runtime, context)).toBe(true)
    expect(provider.playback.now?.key).toBe(third.key)
  })

  test('defers loading transport exactly once and routes Play/Pause through provider cancellation', async () => {
    const runtime = await fixtureRuntime()
    await runtime.provider.play({ kind: 'tracks', tracks: runtime.source.songs, startIndex: 0 })
    let pauses = 0
    let skips = 0
    let playback: PlaybackState = { ...runtime.provider.playback, status: 'loading', now: null }
    const playbackListeners = new Set<(state: PlaybackState) => void>()
    const loadingProvider: MusicProvider = {
      ...runtime.provider,
      get playback() { return playback },
      onPlaybackChange(listener) { playbackListeners.add(listener); return () => { playbackListeners.delete(listener) } },
      async pause() { pauses += 1 },
      async skip() { skips += 1 },
    }
    const loadingRuntime = { ...runtime, provider: loadingProvider }
    const runtimeListeners = new Set<() => void>()
    const runtimeContext = { getSnapshot: () => loadingRuntime, subscribe(listener: () => void) { runtimeListeners.add(listener); return () => { runtimeListeners.delete(listener) } } }

    const skipping = skipProductionPlayback('next', loadingRuntime, runtimeContext)
    expect(skips).toBe(0)
    playback = { ...runtime.provider.playback, status: 'playing', now: runtime.provider.playback.now }
    for (const listener of playbackListeners) listener(playback)
    expect(await skipping).toBe(true)
    expect(skips).toBe(1)
    expect(await toggleProductionPlayback(loadingRuntime)).toBe(true)
    expect(pauses).toBe(1)
  })

  test('cancels a deferred loading skip when its provider context is replaced', async () => {
    const runtime = await fixtureRuntime()
    let skips = 0
    const playbackListeners = new Set<(state: PlaybackState) => void>()
    const loadingProvider: MusicProvider = {
      ...runtime.provider,
      playback: { ...runtime.provider.playback, status: 'loading' as const, now: null },
      onPlaybackChange(listener) { playbackListeners.add(listener); return () => { playbackListeners.delete(listener) } },
      async skip() { skips += 1 },
    }
    const loadingRuntime = { ...runtime, provider: loadingProvider }
    let activeProvider: MusicProvider = loadingProvider
    const runtimeListeners = new Set<() => void>()
    const runtimeContext = { getSnapshot: () => ({ provider: activeProvider }), subscribe(listener: () => void) { runtimeListeners.add(listener); return () => { runtimeListeners.delete(listener) } } }

    const skipping = skipProductionPlayback('previous', loadingRuntime, runtimeContext)
    activeProvider = runtime.provider
    for (const listener of runtimeListeners) listener()

    await expect(skipping).rejects.toThrow('Playback transport context was superseded')
    expect(skips).toBe(0)
  })

  test('rejects admitted immediate and deferred provider failures without declaring fallback', async () => {
    const runtime = await fixtureRuntime()
    await runtime.provider.play({ kind: 'tracks', tracks: runtime.source.songs, startIndex: 0 })
    const immediateProvider: MusicProvider = {
      ...runtime.provider,
      async skip() { throw new Error('immediate transport failure') },
    }
    const immediateRuntime = { ...runtime, provider: immediateProvider }
    const immediateContext = { getSnapshot: () => immediateRuntime, subscribe: () => () => {} }
    await expect(skipProductionPlayback('next', immediateRuntime, immediateContext)).rejects.toThrow('immediate transport failure')

    let playback: PlaybackState = { ...runtime.provider.playback, status: 'loading' }
    const listeners = new Set<(state: PlaybackState) => void>()
    const deferredProvider: MusicProvider = {
      ...runtime.provider,
      get playback() { return playback },
      onPlaybackChange(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
      async skip() { throw new Error('deferred transport failure') },
    }
    const deferredRuntime = { ...runtime, provider: deferredProvider }
    const deferredContext = { getSnapshot: () => deferredRuntime, subscribe: () => () => {} }
    const deferred = skipProductionPlayback('previous', deferredRuntime, deferredContext)
    playback = { ...playback, status: 'playing' }
    for (const listener of listeners) listener(playback)
    await expect(deferred).rejects.toThrow('deferred transport failure')
  })

  test('keeps playlist traversal in provider order', async () => {
    const runtime = await fixtureRuntime()
    const { provider, source } = runtime
    const playlist = source.playlists[0]
    if (playlist === undefined) throw new Error('fixture playlist missing')
    const tracks = await source.tracksForPlaylist(playlist.key)
    if (tracks.length < 2) throw new Error('fixture playlist needs two tracks')
    await provider.play({ kind: 'playlist', playlist })

    expect(await skipProductionPlayback('next', runtime, runtimeContext(runtime))).toBe(true)
    expect(provider.playback.now?.key).toBe(tracks[1]?.key)
  })

  test('keeps shuffled playback on the provider-owned queue order', async () => {
    const runtime = await fixtureRuntime()
    const { provider, source } = runtime
    const [first, second, third] = source.songs
    if (first === undefined || second === undefined || third === undefined) throw new Error('fixture songs missing')
    await provider.setShuffle('songs')
    await provider.play({ kind: 'tracks', tracks: [third, first, second], startIndex: 0 })

    expect(await skipProductionPlayback('next', runtime, runtimeContext(runtime))).toBe(true)
    expect(provider.playback.shuffle).toBe('songs')
    expect(provider.playback.now?.key).toBe(first.key)
  })

  test('a second Play/Pause press during a pending resume becomes pause instead of another play', async () => {
    const runtime = await fixtureRuntime()
    let playback: PlaybackState = { ...runtime.provider.playback, status: 'paused', now: null }
    let releasePlay: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { releasePlay = resolve })
    const calls: string[] = []
    const provider: MusicProvider = {
      ...runtime.provider,
      get playback() { return playback },
      async play() {
        calls.push('play:start')
        await gate
        playback = { ...playback, status: 'playing', now: runtime.source.songs[0] ?? null }
        calls.push('play:end')
      },
      async pause() {
        calls.push('pause')
        playback = { ...playback, status: 'paused' }
      },
    }
    const snapshot = { ...runtime, provider }

    const resume = toggleProductionPlayback(snapshot)
    const cancel = toggleProductionPlayback(snapshot)
    for (let index = 0; index < 4; index += 1) await Promise.resolve()
    expect(calls).toEqual(['play:start', 'pause'])
    releasePlay?.()
    expect(await resume).toBe(false)
    expect(await cancel).toBe(true)
    expect(calls).toEqual(['play:start', 'pause', 'play:end', 'pause'])
    expect(playback.status).toBe('paused')
    expect(manageMusic(provider).playback.status).toBe('paused')
  })

  test('ordinary skip waits behind an admitted root pause on the same transport queue', async () => {
    const runtime = await fixtureRuntime()
    await runtime.provider.play({ kind: 'tracks', tracks: runtime.source.songs, startIndex: 0 })
    let releasePause: (() => void) | undefined
    const pauseGate = new Promise<void>((resolve) => { releasePause = resolve })
    const calls: string[] = []
    const provider: MusicProvider = {
      ...runtime.provider,
      get playback() { return runtime.provider.playback },
      async pause() { calls.push('pause:start'); await pauseGate; calls.push('pause:end') },
      async skip() { calls.push('skip') },
    }
    const snapshot = { ...runtime, provider }
    const context = runtimeContext(snapshot)

    const pausing = pauseProductionPlaybackAtRoot(snapshot)
    const skipping = skipProductionPlayback('next', snapshot, context)
    for (let index = 0; index < 4; index += 1) await Promise.resolve()
    expect(calls).toEqual(['pause:start'])
    releasePause?.()
    expect(await pausing).toBe(true)
    expect(await skipping).toBe(true)
    expect(calls).toEqual(['pause:start', 'pause:end', 'skip'])
  })

  test('an out-of-band Panel selection after root pause makes the next physical press pause', async () => {
    const runtime = await fixtureRuntime()
    await runtime.provider.play({ kind: 'tracks', tracks: runtime.source.songs, startIndex: 0 })
    expect(await pauseProductionPlaybackAtRoot(runtime)).toBe(true)
    await manageMusic(runtime.provider).play({ kind: 'tracks', tracks: runtime.source.songs, startIndex: 1 })
    expect(runtime.provider.playback.status).toBe('playing')

    expect(await toggleProductionPlayback(runtime)).toBe(true)

    expect(runtime.provider.playback.status).toBe('paused')
  })

  test('a settled request does not leave stale intent after an external stop', async () => {
    const runtime = await fixtureRuntime()
    let playback: PlaybackState = { ...runtime.provider.playback, status: 'paused', now: runtime.source.songs[0] ?? null }
    let plays = 0
    const provider: MusicProvider = {
      ...runtime.provider,
      get playback() { return playback },
      async play() { plays += 1; playback = { ...playback, status: 'playing' } },
      async pause() { playback = { ...playback, status: 'paused' } },
    }
    const snapshot = { ...runtime, provider }
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    playback = { ...playback, status: 'stopped' }

    expect(await toggleProductionPlayback(snapshot)).toBe(true)

    expect(plays).toBe(2)
    expect(playback.status).toBe('playing')
  })

})

async function fixtureRuntime(): Promise<MusicRuntimeSnapshot> {
  const provider = createFixtureProvider({ supports: APPLE_SUPPORTS })
  const { source, completion } = await createProgressiveAppleSource(provider)
  await completion
  return { requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider, source, message: null }
}

function runtimeContext(runtime: MusicRuntimeSnapshot) {
  return { getSnapshot: () => runtime, subscribe: () => () => {} }
}

for (const status of [200, 204]) test(`physical Spotify Play/Pause accepts ${status} command acknowledgement without decoding JSON`, async () => {
  const { createSpotifyProvider, mintLocalKey } = await import('@webpod/providers')
  const { musicManager } = await import('@webpod/music-management')
  const originalFetch = globalThis.fetch
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const events = new Map<string, (...args: never[]) => void>()
  let pauses = 0
  let playRequests = 0
  class Player {
    addListener(event: string, callback: (...args: never[]) => void) { events.set(event, callback) }
    async connect() { const ready = events.get('ready'); if (ready) Reflect.apply(ready, null, [{ device_id: 'test-device' }]); return true }
    disconnect() {}
    async activateElement() {}
    async getCurrentState() { return null }
    async pause() { pauses += 1 }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { Spotify: { Player } } })
  globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/spotify/token') return Response.json({ accessToken: 'synthetic-token', expiresAt: Date.now() + 3600000 })
    if (path.endsWith('/v1/me')) return Response.json({ id: 'synthetic-user', product: 'premium' })
    if (path.includes('/me/player/play?')) {
      expect(init?.method).toBe('PUT')
      playRequests += 1
      // Synthetic opaque acknowledgement, matching live status/body shape without copying it.
      return new Response(status === 200 ? new TextEncoder().encode('synthetic-command-ack') : null, { status })
    }
    if (path.endsWith('/me/player/queue')) return Response.json({ currently_playing: null, queue: [] })
    throw new Error('Unexpected synthetic Spotify request')
  }, { preconnect: originalFetch.preconnect })
  const adapter = createSpotifyProvider()
  const manager = musicManager(adapter)
  try {
    await adapter.configure()
    const fixture = await fixtureRuntime()
    const first = fixture.source.songs[0]
    if (!first) throw new Error('Missing synthetic track fixture')
    const track = { ...first, kind: 'track' as const, key: mintLocalKey(), provider: 'spotify' as const, catalogId: 'track1', title: 'Synthetic song', artistName: 'Synthetic artist', durationMs: 180000 }
    const snapshot: MusicRuntimeSnapshot = { ...fixture, requestedMode: 'spotify', activeMode: 'spotify', provider: manager.provider, source: { ...fixture.source, songs: [track] } }
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    expect(playRequests).toBe(1)
    // A command acknowledgement alone is not proof of audible playback.
    expect(manager.getSnapshot().playback.status).toBe('loading')
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    expect(pauses).toBe(1)
    const changed = events.get('player_state_changed')
    if (!changed) throw new Error('Missing SDK listener')
    Reflect.apply(changed, null, [{ paused: true, position: 250, duration: 180000, shuffle: false, repeat_mode: 0, track_window: { current_track: { id: 'track1', type: 'track', uri: 'spotify:track:track1', name: 'Synthetic song', duration_ms: 180000, artists: [], album: { name: 'Synthetic album', uri: 'spotify:album:album1', images: [] } } } }])
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    expect(playRequests).toBe(2)
  } finally {
    manager.dispose()
    globalThis.fetch = originalFetch
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

async function appleControlRuntime() {
  const { setup } = await import('../../../packages/providers/src/apple/test-fixtures')
  const { musicManager } = await import('@webpod/music-management')
  const { provider: adapter, music } = setup()
  music.setPlaybackState(0); music.setCurrentPlaybackTime(0)
  await adapter.configure()
  const first = (await adapter.libraryList('songs')).items[0]
  if (first?.kind !== 'track') throw new Error('Missing Apple track fixture')
  const tracks = [first, { ...first, catalogId: 'catalog-song.2', title: 'Second native song' }, first]
  const fixture = await fixtureRuntime()
  const manager = musicManager(adapter)
  const snapshot: MusicRuntimeSnapshot = { ...fixture, provider: manager.provider, source: { ...fixture.source, songs: tracks } }
  const confirm = (index: number, seconds: number): void => {
    const items = tracks.map((track) => ({ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }))
    music.setQueueItems(items); music.setQueuePosition(index); music.setNowPlaying(items[index])
    music.setPlaybackState(3); music.setCurrentPlaybackTime(0)
    music.emit('queueItemsDidChange'); music.emit('nowPlayingItemDidChange'); music.emit('playbackTimeDidChange')
    music.setCurrentPlaybackTime(seconds); music.emit('playbackStateDidChange'); music.emit('playbackTimeDidChange')
  }
  return { adapter, manager, music, snapshot, tracks, confirm }
}

test('physical Apple Play/Pause uses void native commands and preserves confirmed selection through pause/resume', async () => {
  const { adapter, manager, music, snapshot, tracks, confirm } = await appleControlRuntime()
  try {
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'loading', queueIndex: 0, queueTotal: 3 })
    confirm(0, 0.25)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'playing', queueIndex: 0, queueTotal: 3, positionMs: 250 })
    await manager.provider.play({ kind: 'tracks', tracks, startIndex: 1 })
    confirm(1, 0.5)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'playing', queueIndex: 1, queueTotal: 3 })
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    music.setPlaybackState(2); music.emit('playbackStateDidChange')
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'paused', queueIndex: 1, queueTotal: 3 })
    const before = music.calls.filter((call) => call === 'play').length
    // fakeMusic.play resolves undefined, as allowed by MusicKit's Promise<void> contract.
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    expect(music.calls.filter((call) => call === 'play').length).toBe(before + 1)
    confirm(1, 1)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'playing', queueIndex: 1, queueTotal: 3, positionMs: 1000 })
  } finally { manager.dispose(); await adapter.unauthorize() }
})

test('physical Apple rapid Play/Pause cancels a pending void native start and preserves its queue occurrence', async () => {
  const { adapter, manager, music, snapshot, confirm } = await appleControlRuntime()
  let releaseStart: (() => void) | undefined
  const pending = new Promise<void>((resolve) => { releaseStart = resolve })
  music.play = async () => { music.calls.push('play:pending'); await pending; confirm(0, 0.25) }
  try {
    const starting = toggleProductionPlayback(snapshot)
    for (let n = 0; n < 20; n++) await Promise.resolve()
    expect(music.calls).toContain('play:pending')
    const pausing = toggleProductionPlayback(snapshot)
    for (let n = 0; n < 5; n++) await Promise.resolve()
    expect(music.calls.at(-1)).toBe('pause')
    releaseStart?.()
    expect(await starting).toBe(false)
    expect(await pausing).toBe(true)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'paused', queueIndex: 0, queueTotal: 3 })
    expect(music.calls.filter((call) => call === 'play:pending')).toHaveLength(1)
  } finally { releaseStart?.(); manager.dispose(); await adapter.unauthorize() }
})

test('physical Apple rejected resume settles failure and the next void resume recovers without losing the queue', async () => {
  const { adapter, manager, music, snapshot, confirm } = await appleControlRuntime()
  try {
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    confirm(0, 0.25)
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    music.setPlaybackState(2); music.emit('playbackStateDidChange')
    let attempts = 0
    music.play = async () => { attempts += 1; if (attempts === 1) throw new Error('Synthetic native resume failure') }
    expect(await toggleProductionPlayback(snapshot)).toBe(false)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'error', queueIndex: 0, queueTotal: 3 })
    expect(await toggleProductionPlayback(snapshot)).toBe(true)
    expect(attempts).toBe(2)
    confirm(0, 1)
    expect(manager.getSnapshot().playback).toMatchObject({ status: 'playing', queueIndex: 0, queueTotal: 3, positionMs: 1000 })
  } finally { manager.dispose(); await adapter.unauthorize() }
})
