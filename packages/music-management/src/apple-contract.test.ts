import { expect, test } from 'bun:test'
import { setup } from '../../providers/src/apple/test-fixtures'
import { musicManager } from './manager'

/** Native MusicKit contract: setQueue descriptor, seconds and event confirmation. */
test('Apple adapter through common manager preserves exact selection, seek units and native queue confirmation', async () => {
  const { provider: adapter, music } = setup()
  await adapter.configure()
  const entity = (await adapter.libraryList('songs')).items[0]
  if (entity?.kind !== 'track') throw new Error('Expected native mapped song')
  const manager = musicManager(adapter)
  try {
    const tracks = [entity, { ...entity, catalogId: 'catalog-song.2' }, entity]
    music.setPlaybackState(2); music.setCurrentPlaybackTime(0)
    const playing = manager.provider.play({ kind: 'tracks', tracks, startIndex: 2 })
    expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: 2, queueTotal: 3, now: entity, status: 'loading' })
    for (let n = 0; n < 20; n++) await Promise.resolve()
    expect(music.queueDescriptors[0]).toEqual({ songs: tracks.map((track) => track.catalogId) })
    music.setQueueItems(tracks.map((track) => ({ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } })))
    music.setQueuePosition(2)
    music.setNowPlaying({ id: entity.catalogId, type: 'songs', attributes: { name: entity.title, artistName: entity.artistName, durationInMillis: entity.durationMs } })
    music.setPlaybackState(3); music.setCurrentPlaybackTime(0)
    music.emit('queueItemsDidChange'); music.emit('nowPlayingItemDidChange'); music.emit('playbackTimeDidChange')
    music.setCurrentPlaybackTime(0.25); music.emit('playbackTimeDidChange')
    await playing
    expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: 2, queueTotal: 3, status: 'playing', positionMs: 250 })
    await manager.provider.pause()
    music.setPlaybackState(2); music.emit('playbackStateDidChange')
    const seeking = manager.commitSeek(2500)
    for (let n = 0; n < 20; n++) await Promise.resolve()
    music.setPlaybackState(3); music.setCurrentPlaybackTime(2.5); music.emit('playbackStateDidChange'); music.emit('playbackTimeDidChange')
    await seeking
    expect(music.calls).toContain('seek:2.5')
    expect(manager.getSnapshot().playback.status).toBe('playing')
  } finally { manager.dispose(); await adapter.unauthorize() }
})

for (const fallback of [false, true]) test(`Apple ${fallback ? 'single-track fallback' : 'native window'} keeps absolute selection separate from queue snapshot size`, async () => {
  const { provider: adapter, music } = setup(); await adapter.configure()
  const first = (await adapter.libraryList('songs')).items[0]
  if (first?.kind !== 'track') throw new Error('Expected native song')
  const tracks = Array.from({ length: 250 }, (_, index) => ({ ...first, catalogId: `catalog-song.${index}` }))
  if (fallback) {
    music.setQueue = async (descriptor) => {
      music.queueDescriptors.push(descriptor)
      const songs = descriptor['songs']
      if (Array.isArray(songs) && songs.length > 1) throw new Error('Stale library neighbour')
      return { items: [] }
    }
  }
  const manager = musicManager(adapter)
  try {
    await manager.provider.play({ kind: 'tracks', tracks, startIndex: 175 })
    expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: 175, queueTotal: 250 })
    const nativeTracks = fallback ? tracks.slice(175, 176) : tracks.slice(125, 225)
    const nativeItems = nativeTracks.map((track) => ({ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }))
    music.setQueueItems(nativeItems); music.setQueuePosition(fallback ? 0 : 50)
    music.setNowPlaying(nativeItems[fallback ? 0 : 50]); music.setPlaybackState(3); music.setCurrentPlaybackTime(0)
    music.emit('queueItemsDidChange'); music.emit('nowPlayingItemDidChange'); music.emit('playbackTimeDidChange')
    music.setCurrentPlaybackTime(0.25); music.emit('playbackTimeDidChange')
    await manager.refreshQueue()
    expect(manager.getSnapshot().playback).toMatchObject({ queueIndex: 175, queueTotal: 250, status: 'playing' })
    expect(manager.getSnapshot().queue.items).toHaveLength(fallback ? 1 : 100)
    expect(adapter.playback.queueTotal).toBeNull()
  } finally { manager.dispose(); await adapter.unauthorize() }
})

test('Apple station lookup cannot enqueue media after manager deactivation', async () => {
  const { provider: adapter, music } = setup(); await adapter.configure()
  let resolveLookup: ((value: unknown) => void) | undefined
  music.api.music = () => new Promise((resolve) => { resolveLookup = resolve })
  const manager = musicManager(adapter)
  try {
    const starting = manager.provider.stationStart({ type: 'track', ref: 'catalog-song.1' }).catch(() => undefined)
    for (let n = 0; n < 10; n++) await Promise.resolve()
    manager.deactivate()
    const before = [...music.calls]
    resolveLookup?.({ data: { data: [{ id: 'ra.song', type: 'stations', attributes: { name: 'Song station', isLive: false } }] } })
    await starting
    expect(music.calls).toEqual(before)
    expect(manager.getSnapshot().playback.now).toBeNull()
  } finally { manager.dispose(); await adapter.unauthorize() }
})

test('Apple late pause completion cannot overwrite a newer playback transaction', async () => {
  const { provider: adapter, music } = setup(); await adapter.configure()
  let releasePause: (() => void) | undefined
  music.pause = () => new Promise<void>((resolve) => { releasePause = resolve })
  const pausing = adapter.pause()
  // Resume is a new native transaction and must survive the prior pause acknowledgement.
  const resuming = adapter.play()
  music.setPlaybackState(3); music.setCurrentPlaybackTime(1); music.emit('playbackStateDidChange')
  releasePause?.(); await pausing; await resuming
  expect(adapter.playback.status).toBe('playing')
  await adapter.unauthorize()
})

test('Apple window append never combines absolute occurrence with native short-window total', async () => {
  const { provider: adapter, music } = setup(); await adapter.configure()
  const first = (await adapter.libraryList('songs')).items[0]
  if (first?.kind !== 'track') throw new Error('Expected song')
  const tracks = Array.from({ length: 250 }, (_, index) => ({ ...first, catalogId: `catalog-song.${index}` }))
  const manager = musicManager(adapter)
  try {
    await manager.provider.play({ kind: 'tracks', tracks, startIndex: 175 })
    const items = tracks.slice(125, 225).map((track) => ({ id: track.catalogId, type: 'songs', attributes: { name: track.title, artistName: track.artistName, durationInMillis: track.durationMs } }))
    music.setQueueItems(items); music.setQueuePosition(50); music.setNowPlaying(items[50]); music.setCurrentPlaybackTime(0); music.emit('nowPlayingItemDidChange')
    music.setCurrentPlaybackTime(0.25); music.emit('playbackTimeDidChange')
    music.playLater = async () => { music.setQueueItems([...items, items[0]]) }
    await manager.provider.queueAppend([first])
    expect(manager.getSnapshot().queue.items).toHaveLength(101)
    expect(manager.getSnapshot().playback).toMatchObject({ queueTotal: null, queueIndex: null })
  } finally { manager.dispose(); await adapter.unauthorize() }
})
