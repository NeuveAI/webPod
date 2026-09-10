import { musicManager } from '../../../music-management/src/manager'
import { afterEach, expect, spyOn, test } from 'bun:test'
import { mintLocalKey } from '../identity'
import { createSpotifyProvider } from './spotify-provider'

const originalFetch = globalThis.fetch
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

for (const managed of [false, true]) test(`Spotify ${managed ? 'managed' : 'native'} restores session, maps library and routes browser playback`, async () => {
  const listeners = new Map<string, (...args: never[]) => void>()
  const calls: { path: string; body: unknown }[] = []
  let disconnected = false
  let polledState: unknown = null
  class FakePlayer {
    addListener(event: string, cb: (...args: never[]) => void) {
      listeners.set(event, cb)
    }
    async connect() {
      const ready = listeners.get('ready')
      if (ready) Reflect.apply(ready, null, [{ device_id: 'webpod-device' }])
      return true
    }
    disconnect() {
      disconnected = true
    }
    async getCurrentState() {
      return polledState
    }
    async activateElement() {}
    async pause() {}
    async nextTrack() {}
    async previousTrack() {}
    async seek() {}
    async setVolume() {}
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { Spotify: { Player: FakePlayer } },
  })
  const track = {
    type: 'track',
    id: 'track1',
    name: 'Test song',
    duration_ms: 123000,
    artists: [{ id: 'artist1', name: 'Test artist' }],
    album: {
      id: 'album1',
      name: 'Test album',
      artists: [{ id: 'artist1', name: 'Test artist' }],
      images: [],
    },
  }
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input)
      calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })
      if (path === '/api/spotify/token')
        return Response.json({
          accessToken: 'fake-access',
          expiresAt: Date.now() + 3600000,
        })
      if (path === '/api/spotify/logout')
        return new Response(null, { status: 204 })
      if (path.endsWith('/v1/me')) return Response.json({ id: 'test-user' })
      if (path.includes('/artists/artist1/albums')) {
        const url = new URL(path)
        expect(url.searchParams.get('limit')).toBe('10')
        return Response.json({
          items: [
            {
              ...track.album,
              id: url.searchParams.has('offset') ? 'album2' : 'album1',
            },
          ],
          next: url.searchParams.has('offset')
            ? null
            : 'https://api.spotify.com/v1/artists/artist1/albums?limit=10&offset=10',
          total: 2,
        })
      }
      if (path.includes('/me/tracks'))
        return Response.json({ items: [{ track }], next: null, total: 1 })
      if (path.includes('/search?'))
        return Response.json({ playlists: {
          items: [{ id: 'search-valid', name: 'Search playlist' }, { id: 'search-blank', name: ' ' }, null],
          next: null,
        } })
      if (path.includes('/me/playlists?offset=50'))
        return Response.json({ items: [{ id: 'playlist2', name: 'Next page' }], next: null, total: 8 })
      if (path.includes('/me/playlists'))
        return Response.json({
          items: [
            {
              id: 'playlist1',
              name: '  Test playlist  ',
              items: { total: 1 },
              owner: { id: 'test-user' },
              images: [],
            },
            { id: 'unnamed', name: '' },
            { id: 'whitespace', name: '   ' },
            { id: 'missing-name' },
            { id: '', name: 'Missing ID' },
            { name: 'Absent ID' },
            null,
          ],
          next: 'https://api.spotify.com/v1/me/playlists?offset=50',
          total: 8,
        })
      if (path.includes('/albums/album1/tracks')) {
        const albumTrack = { ...track, album: undefined }
        return Response.json({ items: [albumTrack], next: null, total: 1 })
      }
      if (path.includes('/playlists/playlist1/items'))
        return Response.json({ items: [{ item: track }], next: null, total: 1 })
      if (path.endsWith('/me/player/queue')) return Response.json({ currently_playing: track, queue: [{ type: 'episode', id: 'episode1', name: 'Podcast' }, track] })
      if (path.includes('/me/player/play'))
        return new Response(null, { status: 204 })
      throw new Error(`Unexpected test request: ${path}`)
    },
    { preconnect: originalFetch.preconnect },
  )
  const adapter = createSpotifyProvider()
  const manager = managed ? musicManager(adapter) : null
  const provider = manager?.provider ?? adapter
  await provider.configure()
  expect(provider.session?.status).toBe('authorized')
  const albumPages: string[][] = []
  const albums = await provider.relatedAlbums({
    kind: 'artist',
    key: mintLocalKey(),
    provider: 'spotify',
    catalogId: 'artist1',
    name: 'Test artist',
  }, { onPage: (page) => { albumPages.push(page.map((album) => album.catalogId)) } })
  expect(albumPages).toEqual([['album1'], ['album1', 'album2']])
  expect(albums.map((album) => album.catalogId)).toEqual(['album1', 'album2'])
  const parentAlbum = albums[0]
  if (!parentAlbum) throw new Error('Missing album')
  expect(parentAlbum.artwork).toBeUndefined()
  const albumTracks = await provider.relatedTracks(parentAlbum)
  expect(albumTracks[0]?.albumName).toBe(parentAlbum.title)
  expect(albumTracks[0]?.artwork).toEqual(parentAlbum.artwork)
  const library = await provider.libraryList('songs')
  const song = library.items[0]
  if (song?.kind !== 'track') throw new Error('Expected song')
  expect(song.title).toBe('Test song')
  const playlists = await provider.libraryList('playlists')
  const playlist = playlists.items[0]
  if (playlist?.kind !== 'playlist') throw new Error('Expected playlist')
  expect(playlists.items).toHaveLength(1)
  expect(playlist.name).toBe('Test playlist')
  expect(playlist.trackCount).toBe(1)
  expect(playlists.next).toBe('https://api.spotify.com/v1/me/playlists?offset=50')
  const nextPlaylists = await provider.libraryList('playlists', playlists.next ?? undefined)
  expect(nextPlaylists.items.map((item) => item.catalogId)).toEqual(['playlist2'])
  const search = await provider.search({ term: 'playlist', scope: 'catalog', kinds: ['playlist'] })
  expect(search.playlists.map((item) => item.name)).toEqual(['Search playlist'])
  expect((await provider.relatedTracks(playlist))[0]?.key).toBe(song.key)
  const queue = await provider.queueRead()
  expect(queue.history).toEqual([])
  expect(queue.next.map((item) => item.catalogId)).toEqual(['track1'])
  await provider.play({ kind: 'tracks', tracks: [song] })
  expect(calls.at(-1)).toEqual({
    path: 'https://api.spotify.com/v1/me/player/play?device_id=webpod-device',
    body: { uris: ['spotify:track:track1'], offset: { position: 0 } },
  })
  const changed = listeners.get('player_state_changed')
  if (!changed) throw new Error('Missing state listener')
  const sdkState = {
    paused: false,
    position: 500,
    duration: 123000,
    shuffle: false,
    repeat_mode: 0,
    track_window: {
      current_track: {
        ...track,
        uri: 'spotify:track:track1',
        artists: [{ name: 'Test artist', uri: 'spotify:artist:artist1' }],
        album: {
          name: 'Test album',
          uri: 'spotify:album:album1',
          images: [],
        },
      },
    },
  }
  Reflect.apply(changed, null, [sdkState])
  expect(provider.playback.status).toBe('playing')
  expect(provider.playback.now?.artistName).toBe('Test artist')
  for (const [repeat_mode, repeat] of [[1, 'all'], [2, 'one'], [0, 'off']] as const) {
    Reflect.apply(changed, null, [{ ...sdkState, repeat_mode }])
    expect(provider.playback.repeat).toBe(repeat)
  }
  expect(provider.playback.now?.key).toBe(song.key)
  // Duplicate songs need the submitted occurrence index to settle the panel.
  await provider.play({ kind: 'tracks', tracks: [song, song], startIndex: 1 })
  const relinked = {
    ...sdkState,
    track_window: {
      current_track: {
        ...sdkState.track_window.current_track,
        id: 'market-replacement',
        linked_from: { id: 'track1' },
      },
    },
  }
  Reflect.apply(changed, null, [relinked])
  expect(provider.playback.queueIndex).toBe(1)
  expect(provider.playback.queueTotal).toBe(managed ? 2 : null)
  expect(provider.playback.now?.key).toBe(song.key)
  expect(provider.playback.now?.catalogId).toBe(song.catalogId)

  // Recover a successful play even when the SDK omits player_state_changed.
  await provider.play({ kind: 'tracks', tracks: [song] })
  polledState = sdkState
  const stopProgress = provider.onProgress(() => {})
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        stopPlayback()
        reject(new Error('SDK reconciliation did not recover playback'))
      }, 3500)
      const stopPlayback = provider.onPlaybackChange((value) => {
        if (value.status !== 'playing') return
        clearTimeout(timeout)
        stopPlayback()
        resolve()
      })
    })
    expect(provider.playback.queueIndex).toBe(0)
  } finally {
    stopProgress()
  }
  const secondSong = { ...song, key: mintLocalKey(), catalogId: 'track2', title: 'Second song' }
  await provider.play({ kind: 'tracks', tracks: [song, secondSong] })
  Reflect.apply(changed, null, [sdkState])
  expect(provider.playback).toMatchObject({ queueIndex: 0, queueTotal: managed ? 2 : null })
  polledState = { ...sdkState, track_window: { current_track: { ...sdkState.track_window.current_track, id: 'track2', name: 'Second song' } } }
  await provider.skip('next')
  expect(provider.playback).toMatchObject({ queueIndex: 1, queueTotal: managed ? 2 : null })
  polledState = sdkState
  await provider.skip('previous')
  expect(provider.playback).toMatchObject({ queueIndex: 0, queueTotal: managed ? 2 : null })

  // A skip reconciles metadata immediately even if no SDK event is emitted.
  polledState = { ...sdkState, track_window: { current_track: { ...sdkState.track_window.current_track, id: 'next-track', name: 'Next track' } } }
  await provider.skip('next')
  expect(provider.playback.now?.title).toBe('Next track')
  expect(provider.playback.positionMs).toBeLessThan(1000)
  Reflect.apply(changed, null, [sdkState])
  const anchor = Date.now()
  const clock = spyOn(Date, 'now').mockReturnValue(anchor + 5000)
  try {
    expect(provider.playback.positionMs).toBeGreaterThanOrEqual(5500)
    expect(provider.playback.positionMs).toBeLessThan(5600)
    clock.mockReturnValue(anchor + 999999)
    expect(provider.playback.positionMs).toBe(123000)
    Reflect.apply(changed, null, [
      {
        paused: true,
        position: 7000,
        duration: 123000,
        shuffle: false,
        repeat_mode: 0,
        track_window: { current_track: null },
      },
    ])
    clock.mockReturnValue(anchor + 1999999)
    expect(provider.playback.positionMs).toBe(7000)
  } finally {
    clock.mockRestore()
  }

  if (managed) {
    await provider.play({ kind: 'tracks', tracks: [song, secondSong], startIndex: 1 })
    expect(provider.playback.status).toBe('loading')
    const failed = listeners.get('playback_error')
    if (!failed) throw new Error('Missing playback error listener')
    Reflect.apply(failed, null, [{ message: 'Synthetic DRM failure' }])
    expect(provider.playback.status).toBe('error')
    expect(provider.playback.now?.catalogId).toBe(secondSong.catalogId)
    expect(provider.playback.queueIndex).toBe(1)
    await provider.play({ kind: 'tracks', tracks: [song] })
    Reflect.apply(changed, null, [sdkState])
    expect(provider.playback.status).toBe('playing')
  }
  await expect(
    provider.libraryList('songs', 'https://attacker.example'),
  ).rejects.toThrow('Invalid Spotify library cursor')
  await provider.unauthorize()
  expect(disconnected).toBe(true)
  manager?.dispose()
  expect(provider.session).toBeNull()
  expect(provider.playback.status).toBe('idle')
})
