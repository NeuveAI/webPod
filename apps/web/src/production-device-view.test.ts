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
    expect(calls).toEqual(['play:start'])
    releasePlay?.()
    expect(await resume).toBe(true)
    expect(await cancel).toBe(true)
    expect(calls).toEqual(['play:start', 'play:end', 'pause'])
    expect(playback.status).toBe('paused')
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
    await runtime.provider.play({ kind: 'tracks', tracks: runtime.source.songs, startIndex: 1 })
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
