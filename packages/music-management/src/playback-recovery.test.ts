import { afterEach, expect, test } from 'bun:test'
import type { MusicProvider } from '@webpod/providers'
import { createSpotifyProvider } from '../../providers/src/spotify/spotify-provider'
import { setup } from '../../providers/src/apple/test-fixtures'
import { managedPlaybackPresentation } from '../../panel/src/playback-presentation'
import { musicManager, type MusicManager } from './manager'

const managers: MusicManager[] = []
const originalFetch = globalThis.fetch
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose()
  globalThis.fetch = originalFetch
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

test('Apple playhead event recovers native playing from loading without a playback-state event', async () => {
  const { provider, music } = setup()
  await provider.configure()
  music.setNowPlaying({ id: 'recovery-song', type: 'songs', attributes: { name: 'Recovery', artistName: 'Artist', durationInMillis: 180000 } })
  music.setCurrentPlaybackTime(0)
  music.setPlaybackState(1)
  music.emit('playbackStateDidChange')
  const manager = musicManager(provider); managers.push(manager)
  expect(managedPlaybackPresentation(manager.provider).phase).toBe('starting')
  music.setPlaybackState(3)
  music.setCurrentPlaybackTime(4)
  music.emit('playbackTimeDidChange')
  expect(provider.playback).toMatchObject({ status: 'playing', positionMs: 4000 })
  expect(managedPlaybackPresentation(manager.provider)).toMatchObject({ phase: 'ready', playback: { status: 'playing', positionMs: 4000 }, track: { title: 'Recovery' } })
  music.setPlaybackState(8); music.emit('playbackTimeDidChange')
  expect(managedPlaybackPresentation(manager.provider).phase).toBe('starting')
  music.setPlaybackState(2); music.emit('playbackTimeDidChange')
  expect(managedPlaybackPresentation(manager.provider)).toMatchObject({ phase: 'ready', playback: { status: 'paused' } })
})

test('Spotify progress recovers a transport event missed by a subscriber, preserving initial metadata and errors', async () => {
  const listeners = new Map<string, (...args: never[]) => void>()
  class Player {
    addListener(name: string, callback: (...args: never[]) => void) { listeners.set(name, callback) }
    async connect() { const ready = listeners.get('ready'); if (ready) Reflect.apply(ready, null, [{ device_id: 'recovery-device' }]); return true }
    disconnect() {}
    async activateElement() {}
    async pause() {}
    async getCurrentState() { return null }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { Spotify: { Player } } })
  globalThis.fetch = Object.assign(async (input: string | URL | Request) => {
    const path = String(input)
    if (path === '/api/spotify/token') return Response.json({ accessToken: 'synthetic', expiresAt: Date.now() + 3600000 })
    if (path.endsWith('/v1/me')) return Response.json({ id: 'recovery-user', product: 'premium' })
    if (path.endsWith('/v1/me/player/queue')) return Response.json({ currently_playing: null, queue: [] })
    throw new Error(`Unexpected test request: ${path}`)
  }, { preconnect: originalFetch.preconnect })
  const native = createSpotifyProvider()
  await native.configure()
  const changed = listeners.get('player_state_changed')
  if (!changed) throw new Error('Missing Spotify state listener')
  const sdkState = {
    loading: true, paused: false, position: 0, duration: 180000, shuffle: false, repeat_mode: 0,
    track_window: { current_track: {
      id: 'recovery-track', type: 'track', name: 'Recovery', uri: 'spotify:track:recovery-track', duration_ms: 180000,
      artists: [{ name: 'Artist', uri: 'spotify:artist:recovery-artist' }],
      album: { name: 'Album', uri: 'spotify:album:recovery-album', images: [] },
    } },
  }
  Reflect.apply(changed, null, [sdkState])
  let omitTransportEvent = true
  // A subscriber can miss an event during rebinding; the native snapshot and
  // its independently delivered progress notification remain authoritative.
  const adapter: MusicProvider = {
    ...native, get playback() { return native.playback }, get session() { return native.session },
    onPlaybackChange(callback) { return native.onPlaybackChange((value) => { if (!omitTransportEvent) callback(value) }) },
  }
  const manager = musicManager(adapter); managers.push(manager)
  expect(managedPlaybackPresentation(manager.provider)).toMatchObject({ phase: 'starting', track: { title: 'Recovery' } })
  const progressed = new Promise<void>((resolve) => {
    const stop = manager.provider.onProgress(() => { stop(); resolve() })
  })
  Reflect.apply(changed, null, [{ ...sdkState, loading: false, position: 4000 }])
  await progressed
  expect(managedPlaybackPresentation(manager.provider)).toMatchObject({ phase: 'ready', playback: { status: 'playing' } })
  expect(manager.getSnapshot().playback.positionMs).toBeGreaterThanOrEqual(4000)
  omitTransportEvent = false
  Reflect.apply(changed, null, [{ ...sdkState, loading: true, position: 4500 }])
  expect(managedPlaybackPresentation(manager.provider).phase).toBe('starting')
  const failed = listeners.get('playback_error')
  if (!failed) throw new Error('Missing Spotify error listener')
  Reflect.apply(failed, null, [{}])
  expect(managedPlaybackPresentation(manager.provider).phase).toBe('failed')
})
