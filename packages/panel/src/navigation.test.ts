import { describe, expect, test } from 'bun:test'
import { APPLE_SUPPORTS, createFixtureProvider, mintLocalKey, type LocalKey, type MusicProvider, type PlayTarget, type TrackRef } from '@webpod/providers'
import type { NavigationRoute } from '@webpod/state'

import { fixtureNavigationSource } from './fixtures'
import { albumCollectionForFrame, clearNavigationCaches, isNavigationLoadingFrame, navigationRoot, playbackQueueForFrame, preparationForFrame, preparationsForFrame, previewEntityForFrame, providerStatusFrame, refreshNavigationFrame, selectNavigation, selectNavigationImmediate } from './navigation'

const provider = createFixtureProvider({ supports: APPLE_SUPPORTS })

function highlight<T extends { readonly highlightIndex: number }>(frame: T, index: number): T {
  return { ...frame, highlightIndex: index }
}

describe('typed navigation graph', () => {
  test('marks progressive counts as lower bounds and refreshes without moving the highlight', () => {
    const albums = [...fixtureNavigationSource.albums]
    const source = {
      ...fixtureNavigationSource,
      albums,
      libraryStatus: {
        playlists: { loaded: fixtureNavigationSource.playlists.length, state: 'complete' as const },
        artists: { loaded: fixtureNavigationSource.artists.length, state: 'complete' as const },
        albums: { loaded: albums.length, state: 'loading' as const },
        songs: { loaded: fixtureNavigationSource.songs.length, state: 'complete' as const },
      },
    }
    const root = highlight(navigationRoot(source, provider), 1)
    expect(root.rows.find((row) => row.label === 'Albums')?.sublabel).toBe(`${String(albums.length)}+`)
    const album = albums[0]
    if (album === undefined) throw new Error('fixture album missing')
    albums.push({ ...album, key: mintLocalKey(), title: 'Later page' })

    const refreshed = refreshNavigationFrame(root, source, provider)

    expect(refreshed.highlightIndex).toBe(1)
    expect(refreshed.rows.find((row) => row.label === 'Albums')?.sublabel).toBe(`${String(albums.length)}+`)
  })

  test('playlist rows omit misleading provider counts', async () => {
    const playlists = (await selectNavigation(highlight(navigationRoot(fixtureNavigationSource, provider), 1), fixtureNavigationSource, provider)).frame
    expect(playlists?.rows.length).toBeGreaterThan(0)
    expect(playlists?.rows.every((row) => row.sublabel === null)).toBe(true)
  })

  test('artists descend through albums and tracks into provider playback', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const artists = (await selectNavigation(highlight(root, 2), fixtureNavigationSource, provider)).frame
    expect(artists?.route?.kind).toBe('artists')
    if (artists === null) throw new Error('artists frame missing')
    const albums = (await selectNavigation(artists, fixtureNavigationSource, provider)).frame
    expect(albums?.route?.kind).toBe('artist-albums')
    if (albums === null) throw new Error('artist albums frame missing')
    const tracks = (await selectNavigation(albums, fixtureNavigationSource, provider)).frame
    expect(tracks?.route?.kind).toBe('album-tracks')
    if (tracks === null) throw new Error('album tracks frame missing')
    const nowPlaying = await selectNavigation(tracks, fixtureNavigationSource, provider)
    expect(nowPlaying.frame?.route?.kind).toBe('now-playing')
    expect(nowPlaying.played).toBe(true)
    expect(provider.playback.now?.title).toBe(tracks.rows[0]?.label)
  })

  test('playlist membership produces its own track frame', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const playlists = (await selectNavigation(highlight(root, 1), fixtureNavigationSource, provider)).frame
    if (playlists === null) throw new Error('playlists frame missing')
    const tracks = (await selectNavigation(playlists, fixtureNavigationSource, provider)).frame
    expect(tracks?.route?.kind).toBe('playlist-tracks')
    expect(tracks?.rows.length).toBeGreaterThan(0)
  })

  test('songs, albums, playlists and artists preserve the selected queue and index', async () => {
    const targets: PlayTarget[] = []
    const playbackProvider: MusicProvider = { ...createFixtureProvider({ supports: APPLE_SUPPORTS }), play: async (target) => { if (target !== undefined) targets.push(target) } }
    const root = navigationRoot(fixtureNavigationSource, playbackProvider)
    const songs = (await selectNavigation(highlight(root, 4), fixtureNavigationSource, playbackProvider)).frame
    const albums = (await selectNavigation(highlight(root, 3), fixtureNavigationSource, playbackProvider)).frame
    const playlists = (await selectNavigation(highlight(root, 1), fixtureNavigationSource, playbackProvider)).frame
    const artists = (await selectNavigation(highlight(root, 2), fixtureNavigationSource, playbackProvider)).frame
    if (songs === null || albums === null || playlists === null || artists === null) throw new Error('fixture collection frame missing')
    const albumTracks = (await selectNavigation(highlight(albums, 1), fixtureNavigationSource, playbackProvider)).frame
    const playlistTracks = (await selectNavigation(playlists, fixtureNavigationSource, playbackProvider)).frame
    const artistAlbums = (await selectNavigation(artists, fixtureNavigationSource, playbackProvider)).frame
    if (albumTracks === null || playlistTracks === null || artistAlbums === null) throw new Error('fixture relationship frame missing')
    const artistTracks = (await selectNavigation(artistAlbums, fixtureNavigationSource, playbackProvider)).frame
    if (artistTracks === null) throw new Error('fixture artist tracks missing')

    await selectNavigation(highlight(songs, 2), fixtureNavigationSource, playbackProvider)
    await selectNavigation(highlight(albumTracks, 1), fixtureNavigationSource, playbackProvider)
    await selectNavigation(highlight(playlistTracks, 1), fixtureNavigationSource, playbackProvider)
    await selectNavigation(artistTracks, fixtureNavigationSource, playbackProvider)

    expect(targets.map((target) => target.kind === 'tracks' ? [target.tracks.map((track) => track.key), target.startIndex] : null)).toEqual([
      [playbackQueueForFrame(songs)?.tracks.map((track) => track.key), 2],
      [playbackQueueForFrame(albumTracks)?.tracks.map((track) => track.key), 1],
      [playbackQueueForFrame(playlistTracks)?.tracks.map((track) => track.key), 1],
      [playbackQueueForFrame(artistTracks)?.tracks.map((track) => track.key), 0],
    ])
  })

  test('plays the exact rendered relationship queue without fetching it again', async () => {
    const playlist = fixtureNavigationSource.playlists[0]
    if (playlist === undefined) throw new Error('fixture playlist missing')
    const stableTracks = await fixtureNavigationSource.tracksForPlaylist(playlist.key)
    let relationshipReads = 0
    let playedTarget: PlayTarget | undefined
    const changingSource = {
      ...fixtureNavigationSource,
      tracksForPlaylist: () => {
        relationshipReads += 1
        return relationshipReads === 1 ? stableTracks : [...stableTracks].reverse()
      },
    }
    const playbackProvider: MusicProvider = { ...provider, play: async (target) => { playedTarget = target } }
    const playlists = (await selectNavigation(highlight(navigationRoot(changingSource, playbackProvider), 1), changingSource, playbackProvider)).frame
    if (playlists === null) throw new Error('playlists frame missing')
    const tracks = (await selectNavigation(playlists, changingSource, playbackProvider)).frame
    if (tracks === null) throw new Error('playlist tracks missing')
    const renderedQueue = playbackQueueForFrame(tracks)?.tracks

    await selectNavigation(highlight(tracks, 1), changingSource, playbackProvider)

    expect(relationshipReads).toBe(1)
    expect(renderedQueue).toBe(stableTracks)
    expect(playedTarget).toEqual({ kind: 'tracks', tracks: stableTracks, startIndex: 1 })
  })

  test('stable album intent prefetches relationship data reused by selection', async () => {
    const album = fixtureNavigationSource.albums[0]
    if (album === undefined) throw new Error('fixture album missing')
    let reads = 0
    const source = {
      ...fixtureNavigationSource,
      tracksForAlbum: (key: typeof album.key) => {
        reads += 1
        return fixtureNavigationSource.tracksForAlbum(key)
      },
    }
    const albums = (await selectNavigation(highlight(navigationRoot(source, provider), 3), source, provider)).frame
    if (albums === null) throw new Error('albums frame missing')
    const preparation = preparationForFrame(albums, source)
    if (preparation === null) throw new Error('album preparation missing')

    await preparation.prefetchData()
    const tracks = (await selectNavigation(albums, source, provider)).frame

    expect(reads).toBe(1)
    expect(tracks?.route?.kind).toBe('album-tracks')
  })

  test('prefetch scope follows only the highlighted row instead of speculative neighbors', async () => {
    const albums = (await selectNavigation(highlight(navigationRoot(fixtureNavigationSource, provider), 3), fixtureNavigationSource, provider)).frame
    if (albums === null) throw new Error('albums frame missing')
    const preparations = preparationsForFrame(highlight(albums, 2), fixtureNavigationSource)

    expect(preparations).toHaveLength(1)
    expect(preparations[0]?.key).toBe(preparationForFrame(highlight(albums, 2), fixtureNavigationSource)?.key)
  })

  test('accepted album input returns a typed shell before its relationship resolves', async () => {
    let resolveTracks: ((tracks: readonly TrackRef[]) => void) | undefined
    const relationship = new Promise<readonly TrackRef[]>((resolve) => { resolveTracks = resolve })
    const source = { ...fixtureNavigationSource, tracksForAlbum: () => relationship }
    const albums = (await selectNavigation(highlight(navigationRoot(source, provider), 3), source, provider)).frame
    if (albums === null) throw new Error('albums frame missing')

    const selection = selectNavigationImmediate(albums, source, provider)

    expect(selection.frame?.route?.kind).toBe('album-tracks')
    expect(selection.frame === null ? false : isNavigationLoadingFrame(selection.frame)).toBe(true)
    expect(selection.frame?.rows).toEqual([])
    resolveTracks?.(fixtureNavigationSource.songs.slice(0, 2))
    const resolved = await selection.resolution
    expect(resolved?.rows).toHaveLength(2)
    expect(resolved?.route?.kind).toBe('album-tracks')
  })

  test('accepted input promotes a non-abortable production relationship without duplicate I/O', async () => {
    let reads = 0
    let resolveTracks: ((tracks: readonly TrackRef[]) => void) | undefined
    const relationship = new Promise<readonly TrackRef[]>((resolve) => { resolveTracks = resolve })
    const source = {
      ...fixtureNavigationSource,
      relationshipRequestsAbortable: false,
      tracksForAlbum: () => { reads += 1; return relationship },
    }
    const albums = (await selectNavigation(highlight(navigationRoot(source, provider), 3), source, provider)).frame
    if (albums === null) throw new Error('albums frame missing')
    const preparation = preparationForFrame(albums, source)
    if (preparation === null) throw new Error('album preparation missing')
    const speculative = preparation.prefetchData()
    await Promise.resolve()

    const accepted = selectNavigationImmediate(albums, source, provider)
    expect(reads).toBe(1)
    resolveTracks?.(fixtureNavigationSource.songs.slice(0, 2))
    await Promise.all([speculative, accepted.resolution])
    expect(reads).toBe(1)
  })

  test('source teardown aborts outstanding speculative relationships', async () => {
    let aborted = false
    const source = {
      ...fixtureNavigationSource,
      tracksForAlbum: (_key: LocalKey, options?: { readonly signal?: AbortSignal }) => new Promise<readonly TrackRef[]>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('source disposed')) }, { once: true })
      }),
    }
    const albums = (await selectNavigation(highlight(navigationRoot(source, provider), 3), source, provider)).frame
    if (albums === null) throw new Error('albums frame missing')
    const preparation = preparationForFrame(albums, source)
    if (preparation === null) throw new Error('album preparation missing')
    const request = preparation.prefetchData()
    await Promise.resolve()

    clearNavigationCaches(source)

    await expect(request).rejects.toThrow('source disposed')
    expect(aborted).toBe(true)
  })

  test('track preparation retains the rendered duplicate occurrence and artwork', async () => {
    const [first, second] = fixtureNavigationSource.songs
    if (first === undefined || second === undefined) throw new Error('fixture tracks missing')
    const songs = [first, second, first]
    const source = { ...fixtureNavigationSource, songs }
    const frame = (await selectNavigation(highlight(navigationRoot(source, provider), 4), source, provider)).frame
    if (frame === null) throw new Error('songs frame missing')
    const selected = highlight(frame, 2)
    const preparation = preparationForFrame(selected, source)

    expect(preparation?.playTarget).toEqual({ kind: 'tracks', tracks: songs, startIndex: 2 })
    expect(preparation?.artwork).toBe(first.artwork ?? null)
  })

  test('root preview comes from the highlighted live collection and has a neutral null case', () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const album = fixtureNavigationSource.albums[0]
    if (album === undefined) throw new Error('fixture album missing')
    expect(previewEntityForFrame(highlight(root, 3), fixtureNavigationSource)).toBe(album)
    expect(previewEntityForFrame(highlight(root, 5), fixtureNavigationSource)).toBeNull()
  })

  test('selects the exact rendered artist album without fetching the collection again', async () => {
    const stableAlbums = fixtureNavigationSource.albums.slice(0, 2)
    let relationshipReads = 0
    const changingSource = {
      ...fixtureNavigationSource,
      albumsForArtist: () => {
        relationshipReads += 1
        return relationshipReads === 1 ? stableAlbums : [...stableAlbums].reverse()
      },
    }
    const root = navigationRoot(changingSource, provider)
    const artists = (await selectNavigation(highlight(root, 2), changingSource, provider)).frame
    if (artists === null) throw new Error('artists frame missing')
    const albums = (await selectNavigation(artists, changingSource, provider)).frame
    if (albums === null) throw new Error('artist albums missing')
    const selectedAlbum = stableAlbums[1]
    if (selectedAlbum === undefined) throw new Error('second album missing')

    const tracks = (await selectNavigation(highlight(albums, 1), changingSource, provider)).frame

    expect(relationshipReads).toBe(1)
    expect(albumCollectionForFrame(albums)).toBe(stableAlbums)
    expect(tracks?.title).toBe(selectedAlbum.title)
    expect(tracks?.route).toEqual({ kind: 'album-tracks', albumKey: selectedAlbum.key })
  })

  test('empty and rejected playable selections never claim success', async () => {
    const emptySource = { ...fixtureNavigationSource, songs: [] }
    const songs = (await selectNavigation(highlight(navigationRoot(emptySource, provider), 4), emptySource, provider)).frame
    if (songs === null) throw new Error('songs frame missing')
    expect(await selectNavigation(songs, emptySource, provider)).toEqual({ frame: null, played: false })

    const rejectedProvider: MusicProvider = { ...provider, play: async () => { throw new Error('playback refused') } }
    const populatedSongs = (await selectNavigation(highlight(navigationRoot(fixtureNavigationSource, rejectedProvider), 4), fixtureNavigationSource, rejectedProvider)).frame
    if (populatedSongs === null) throw new Error('populated songs frame missing')
    const rejected = await selectNavigation(populatedSongs, fixtureNavigationSource, rejectedProvider)
    expect(rejected.frame?.route?.kind).toBe('now-playing')
    expect(rejected.played).toBe(true)
    expect(rejected.playback).toBeDefined()
    await expect(rejected.playback as Promise<void>).rejects.toThrow('playback refused')
  })

  test('genre offers artist, album and track facets', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const genres = (await selectNavigation(highlight(root, 5), fixtureNavigationSource, provider)).frame
    if (genres === null) throw new Error('genres frame missing')
    const facets = (await selectNavigation(genres, fixtureNavigationSource, provider)).frame
    expect(facets?.rows.map((row) => row.label)).toEqual(['Artists', 'Albums', 'Songs'])
  })

  test('every supported root row resolves to its declared real section', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const expected: NavigationRoute['kind'][] = ['cover-flow', 'playlists', 'artists', 'albums', 'songs', 'genres', 'stations', 'search-entry']
    const resolved = await Promise.all(root.rows.map(async (_row, index) =>
      (await selectNavigation(highlight(root, index), fixtureNavigationSource, provider)).frame?.route?.kind))
    expect(resolved).toEqual(expected)
  })

  test('search entry retains the provider result LocalKeys into playback', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const entry = (await selectNavigation(highlight(root, root.rows.length - 1), fixtureNavigationSource, provider)).frame
    if (entry === null) throw new Error('search entry missing')
    const results = (await selectNavigation(entry, fixtureNavigationSource, provider, 'night')).frame
    expect(results?.route?.kind).toBe('search-results')
    if (results === null) throw new Error('search results missing')
    await selectNavigation(results, fixtureNavigationSource, provider)
    expect(provider.playback.now?.key).toBe(playbackQueueForFrame(results)?.tracks[0]?.key)
  })

  test('routes by typed destination even when presentation copy changes', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const renamed = { ...root, rows: root.rows.map((row) => row.destination?.kind === 'artists' ? { ...row, label: 'Performers' } : row) }
    const artistIndex = renamed.rows.findIndex((row) => row.destination?.kind === 'artists')
    const selected = await selectNavigation(highlight(renamed, artistIndex), fixtureNavigationSource, provider)
    expect(selected.frame?.route?.kind).toBe('artists')
  })

  test('queries library and catalogue and can play a catalogue-only result', async () => {
    const seed = fixtureNavigationSource.songs[0]
    if (seed === undefined) throw new Error('fixture song missing')
    const catalogueOnly = { ...seed, key: mintLocalKey(), title: 'Outside the Library' }
    const scopes: string[] = []
    const searchProvider = {
      ...provider,
      search: async (query: Parameters<typeof provider.search>[0]) => {
        scopes.push(`${query.scope}:${query.term}`)
        return {
          tracks: query.scope === 'catalog' ? [catalogueOnly] : [],
          albums: [], artists: [], playlists: [], stations: [], next: null,
        }
      },
    }
    const source = {
      ...fixtureNavigationSource,
      trackByKey: (key: typeof catalogueOnly.key) => key === catalogueOnly.key ? catalogueOnly : fixtureNavigationSource.trackByKey(key),
    }
    const root = navigationRoot(source, searchProvider)
    const entry = (await selectNavigation(highlight(root, root.rows.length - 1), source, searchProvider)).frame
    if (entry === null) throw new Error('search entry missing')
    const results = (await selectNavigation(entry, source, searchProvider, 'outside')).frame
    if (results === null) throw new Error('search results missing')
    expect(scopes).toEqual(['library:outside', 'catalog:outside'])
    expect(results.rows.map((row) => [row.label, row.sublabel])).toEqual([['Outside the Library', 'Apple Music']])
    const played = await selectNavigation(results, source, searchProvider)
    expect(played.played).toBe(true)
    expect(provider.playback.now?.key).toBe(catalogueOnly.key)
  })

  test('unsupported radio is absent instead of disabled', () => {
    const withoutRadio = createFixtureProvider({ supports: { stations: false } })
    const root = navigationRoot(fixtureNavigationSource, withoutRadio)
    expect(root.rows.some((row) => row.label === 'Radio')).toBe(false)
    expect(root.rows.map((row) => row.index)).toEqual(root.rows.map((_row, index) => index))
  })

  test('empty relationships are represented by an empty typed frame', async () => {
    const source = { ...fixtureNavigationSource, playlists: [] }
    const playlists = (await selectNavigation(highlight(navigationRoot(source, provider), 1), source, provider)).frame
    expect(playlists?.route?.kind).toBe('playlists')
    expect(playlists?.rows).toEqual([])
    expect(playlists?.highlightIndex).toBe(-1)
  })

  test('provider session postures are typed frames without caller display state', async () => {
    const signedOut = createFixtureProvider()
    await signedOut.unauthorize()
    expect(providerStatusFrame(signedOut)?.route).toEqual({ kind: 'status', state: 'signed-out' })
    const browseOnly = createFixtureProvider({ canPlay: false })
    expect(providerStatusFrame(browseOnly)?.route).toEqual({ kind: 'status', state: 'playback-unavailable' })
    expect(providerStatusFrame(provider)).toBeNull()
  })
})
