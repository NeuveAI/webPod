import { navigationRoot, selectNavigationImmediate, refreshNavigationFrame } from '../../../packages/panel/src/navigation'
import { describe, expect, test } from 'bun:test'
import { APPLE_SUPPORTS, createFixtureProvider, mintLocalKey, type MusicProvider, type TrackRef } from '@webpod/providers'
import { createProgressiveAppleSource, quiesceMusicProvider, resolveMusicRuntimeMode } from './music-runtime'

describe('music runtime selection', () => {
  test('defaults to Apple and recognizes Spotify selection', () => {
    expect(resolveMusicRuntimeMode('spotify', undefined)).toBe('spotify')
    expect(resolveMusicRuntimeMode(null, 'spotify')).toBe('spotify')
    expect(resolveMusicRuntimeMode(null, undefined)).toBe('apple')
    expect(resolveMusicRuntimeMode(null, 'apple')).toBe('apple')
    expect(resolveMusicRuntimeMode('fixture', 'apple')).toBe('apple')
    expect(resolveMusicRuntimeMode('apple', undefined)).toBe('apple')
    expect(resolveMusicRuntimeMode('other', 'apple')).toBe('apple')
  })

  test('quiesces an authorized transport before its controls leave the screen', async () => {
    const base = createFixtureProvider({ supports: APPLE_SUPPORTS })
    let pauses = 0
    const provider: MusicProvider = {
      ...base,
      async pause() { pauses += 1 },
    }

    await quiesceMusicProvider(provider)
    expect(pauses).toBe(1)
  })

  test('unlocks after one page per collection and streams later pages into the same source', async () => {
    const base = createFixtureProvider({ supports: APPLE_SUPPORTS })
    const [firstSong, secondSong] = base.catalog.tracks
    if (firstSong === undefined || secondSong === undefined) throw new Error('fixture songs missing')
    let releaseSecondPage: (() => void) | undefined
    const secondPageGate = new Promise<void>((resolve) => { releaseSecondPage = resolve })
    const provider: MusicProvider = {
      ...base,
      async libraryList(kind, cursor) {
        if (kind === 'songs') {
          if (cursor === undefined) return { items: [firstSong], next: 'songs-page-2', total: 2 }
          await secondPageGate
          return { items: [secondSong], next: null, total: 2 }
        }
        const items = kind === 'albums' ? base.catalog.albums : kind === 'artists' ? base.catalog.artists : kind === 'playlists' ? base.catalog.playlists : []
        return { items, next: null, total: items.length }
      },
      async stationsList() { return [] },
    }

    const { source, completion } = await createProgressiveAppleSource(provider)
    let notifications = 0
    source.subscribe?.(() => { notifications += 1 })

    expect(source.songs).toEqual([firstSong])
    expect(source.libraryStatus?.songs).toEqual({ loaded: 1, state: 'loading' })
    releaseSecondPage?.()
    await completion
    expect(source.songs).toEqual([firstSong, secondSong])
    expect(source.libraryStatus?.songs).toEqual({ loaded: 2, state: 'complete' })
    expect(notifications).toBeGreaterThan(0)
  })

  for (const result of ['empty', 'error', 'pending'] as const) {
    test(`optional ${result} radio discovery preserves completed Apple library loading`, async () => {
      const base = createFixtureProvider({ supports: APPLE_SUPPORTS })
      let calls = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => { release = resolve })
      const provider: MusicProvider = {
        ...base,
        async stationsList() {
          calls++
          if (result === 'error') throw new Error('Synthetic radio unavailable')
          if (result === 'pending') await gate
          return []
        },
      }
      const { source, completion } = await createProgressiveAppleSource(provider)
      await completion
      expect(calls).toBe(1)
      expect(source.songs.length).toBeGreaterThan(0)
      expect(source.libraryStatus?.songs.state).toBe('complete')
      expect(source.stations).toEqual([])
      release?.()
    })
  }

  test('bounds relationship and search track identity memory', async () => {
    const provider = createFixtureProvider({ supports: APPLE_SUPPORTS })
    const { source, completion } = await createProgressiveAppleSource(provider)
    await completion
    const seed = provider.catalog.tracks[0]
    if (seed === undefined) throw new Error('fixture song missing')
    const remembered: TrackRef[] = Array.from({ length: 300 }, (_, index) => ({
      ...seed,
      key: mintLocalKey(),
      catalogId: `remembered.${String(index)}`,
    }))

    source.rememberTracks?.(remembered)

    expect(source.trackByKey(remembered[0]?.key ?? seed.key)).toBeNull()
    expect(source.trackByKey(remembered.at(-1)?.key ?? seed.key)?.catalogId).toBe('remembered.299')
  })
})


test('artist catalogue albums remain navigable even when absent from the saved library', async () => {
  const fixture = createFixtureProvider()
  const artist = fixture.catalog.artists[0]
  const album = fixture.catalog.albums[0]
  const song = fixture.catalog.tracks[0]
  if (!artist || !album || !song) throw new Error('Missing fixture entities')
  const provider: MusicProvider = {
    ...fixture,
    async libraryList(kind) { return { items: kind === 'artists' ? [artist] : [], next: null, total: kind === 'artists' ? 1 : 0 } },
    async relatedAlbums() { return [album] },
    async relatedTracks(ref) { expect(ref).toBe(album); return [song] },
  }
  const { source, completion } = await createProgressiveAppleSource(provider)
  expect(source.albums).toHaveLength(0)
  const albums = await source.albumsForArtist(artist.key)
  expect(albums).toEqual([album])
  expect(await source.tracksForAlbum(album.key)).toEqual([song])
  await completion
})


test('artist pages update the visible list before completion and retain selection', async () => {
  const fixture = createFixtureProvider()
  const artist = fixture.catalog.artists[0]
  const first = fixture.catalog.albums[0]
  if (!artist || !first) throw new Error('Missing fixtures')
  const second = { ...first, key: mintLocalKey(), catalogId: 'second', title: 'Second page' }
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const provider: MusicProvider = {
    ...fixture,
    async relatedAlbums(_ref, options) {
      options?.onPage?.([first])
      await gate
      options?.onPage?.([first, second])
      return [first, second]
    },
  }
  const { source, completion } = await createProgressiveAppleSource(provider)
  await completion
  const root = navigationRoot(source, provider)
  const artists = selectNavigationImmediate({ ...root, highlightIndex: 1 }, source, provider).frame
  if (!artists) throw new Error('Missing artist list')
  const selection = selectNavigationImmediate({ ...artists, highlightIndex: 0 }, source, provider)
  await Promise.resolve()
  if (!selection.frame) throw new Error('Missing artist frame')
  let visible = refreshNavigationFrame(selection.frame, source, provider)
  expect(visible.rows.map(row => row.label)).toEqual([first.title])
  visible = { ...visible, highlightIndex: 0, windowStart: 0 }
  release()
  await selection.resolution
  visible = refreshNavigationFrame(visible, source, provider)
  expect(visible.rows.map(row => row.label)).toEqual([first.title, 'Second page'])
  expect(visible.highlightIndex).toBe(0)
  expect(visible.windowStart).toBe(0)
  const tracks = selectNavigationImmediate({ ...visible, highlightIndex: 1 }, source, provider)
  expect(tracks.frame?.title).toBe('Second page')
  await tracks.resolution
})


test('a later artist page failure preserves browsable albums and allows retry', async () => {
  const fixture = createFixtureProvider()
  const artist = fixture.catalog.artists[0]
  const album = fixture.catalog.albums[0]
  if (!artist || !album) throw new Error('Missing fixtures')
  let attempts = 0
  const provider: MusicProvider = {
    ...fixture,
    async relatedAlbums(_ref, options) {
      options?.onPage?.([album])
      if (++attempts === 1) throw new Error('Later page failed')
      return [album]
    },
  }
  const { source, completion } = await createProgressiveAppleSource(provider)
  await completion
  await expect(source.albumsForArtist(artist.key)).rejects.toThrow('Later page failed')
  expect(source.artistAlbumsSnapshot?.(artist.key)).toEqual([album])
  expect(source.artistAlbumsFailed?.(artist.key)).toBe(true)
  await source.albumsForArtist(artist.key)
  expect(source.artistAlbumsFailed?.(artist.key)).toBe(false)
})
