import { describe, expect, test } from 'bun:test'
import { APPLE_SUPPORTS, createFixtureProvider } from '@webpod/providers'

import { fixtureNavigationSource } from './model'
import { navigationRoot, selectNavigation } from './navigation'

const provider = createFixtureProvider({ supports: APPLE_SUPPORTS })

function highlight<T extends { readonly highlightIndex: number }>(frame: T, index: number): T {
  return { ...frame, highlightIndex: index }
}

describe('typed navigation graph', () => {
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

  test('genre offers artist, album and track facets', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const genres = (await selectNavigation(highlight(root, 5), fixtureNavigationSource, provider)).frame
    if (genres === null) throw new Error('genres frame missing')
    const facets = (await selectNavigation(genres, fixtureNavigationSource, provider)).frame
    expect(facets?.rows.map((row) => row.label)).toEqual(['Artists', 'Albums', 'Songs'])
  })

  test('every supported root row resolves to its declared real section', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const expected = ['cover-flow', 'playlists', 'artists', 'albums', 'songs', 'genres', 'stations', 'search-entry']
    const resolved = await Promise.all(root.rows.map(async (_row, index) =>
      (await selectNavigation(highlight(root, index), fixtureNavigationSource, provider)).frame?.route?.kind))
    expect(resolved).toEqual(expected)
  })

  test('search entry retains the provider result LocalKeys into playback', async () => {
    const root = navigationRoot(fixtureNavigationSource, provider)
    const entry = (await selectNavigation(highlight(root, root.rows.length - 1), fixtureNavigationSource, provider)).frame
    if (entry === null) throw new Error('search entry missing')
    const results = (await selectNavigation(entry, fixtureNavigationSource, provider)).frame
    expect(results?.route?.kind).toBe('search-results')
    if (results === null) throw new Error('search results missing')
    await selectNavigation(results, fixtureNavigationSource, provider)
    expect(provider.playback.now?.key).toBe(fixtureNavigationSource.songs[0]?.key)
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
})
