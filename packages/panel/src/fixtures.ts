import { APPLE_SUPPORTS, createFixtureProvider, mintLocalKey, type FixtureProvider } from '@webpod/providers'
import type { PanelRow, ScreenFrame } from '@webpod/state'

import { formatDuration } from './model'
import type { NavigationDataSource } from './navigation'

/** Explicit test/showcase provider. Production Panel callers must inject Apple. */
export const fixtureProvider: FixtureProvider = createFixtureProvider({ supports: APPLE_SUPPORTS })

/** Explicit test/showcase relationship adapter. */
export const fixtureNavigationSource: NavigationDataSource = {
  albums: fixtureProvider.catalog.albums,
  artists: fixtureProvider.catalog.artists,
  genres: fixtureProvider.catalog.genres,
  playlists: fixtureProvider.catalog.playlists,
  songs: fixtureProvider.catalog.tracks,
  stations: fixtureProvider.catalog.stations,
  trackByKey(trackKey) {
    return fixtureProvider.catalog.tracks.find((track) => track.key === trackKey) ?? null
  },
  tracksForAlbum(albumKey) {
    const album = fixtureProvider.catalog.albums.find((item) => item.key === albumKey)
    return album === undefined ? [] : fixtureProvider.catalog.tracksByAlbum.get(album.key) ?? []
  },
  tracksForPlaylist(playlistKey) {
    const playlist = fixtureProvider.catalog.playlists.find((item) => item.key === playlistKey)
    return playlist === undefined ? [] : fixtureProvider.catalog.tracksByPlaylist.get(playlist.key) ?? []
  },
  albumsForArtist(artistKey) {
    const artist = fixtureProvider.catalog.artists.find((item) => item.key === artistKey)
    return artist === undefined ? [] : fixtureProvider.catalog.albums.filter((album) => album.artistName === artist.name)
  },
  albumsForGenre(genreKey) {
    const genre = fixtureProvider.catalog.genres.find((item) => item.key === genreKey)
    return genre === undefined ? [] : fixtureProvider.catalog.albums.filter((album) => fixtureProvider.catalog.genreByAlbum.get(album.key)?.key === genre.key)
  },
  artistsForGenre(genreKey) {
    const names = new Set(this.albumsForGenre(genreKey).map((album) => album.artistName))
    return fixtureProvider.catalog.artists.filter((artist) => names.has(artist.name))
  },
  tracksForGenre(genreKey) {
    return this.albumsForGenre(genreKey).flatMap((album) => fixtureProvider.catalog.tracksByAlbum.get(album.key) ?? [])
  },
}

const row = (index: number, label: string, sublabel: string | null = null): PanelRow => ({
  index,
  label,
  sublabel,
  glyphs: ['descend'],
  provenance: null,
})

export function mainMenuFrame(provider: FixtureProvider = fixtureProvider): ScreenFrame {
  const rows = [
    row(0, 'Cover Flow'),
    row(1, 'Playlists', String(provider.catalog.playlists.length)),
    row(2, 'Artists', String(provider.catalog.artists.length)),
    row(3, 'Albums', String(provider.catalog.albums.length)),
    row(4, 'Songs', String(provider.catalog.tracks.length)),
    row(5, 'Genres', String(provider.catalog.genres.length)),
    ...(provider.supports('stations') ? [row(6, 'Radio', String(provider.catalog.stations.length))] : []),
    row(7, 'Search'),
  ]
  return { screenId: 'S03', title: 'Music', route: { kind: 'root' }, density: 'compact', rows, highlightIndex: 3, windowStart: 0 }
}

export function albumTracksFrame(provider: FixtureProvider = fixtureProvider, minimumRows = 0): ScreenFrame {
  const album = provider.catalog.albums[0]
  if (album === undefined) {
    return { screenId: 'S08', title: 'Album', route: { kind: 'album-tracks', albumKey: mintLocalKey() }, density: 'compact', rows: [], highlightIndex: -1, windowStart: 0 }
  }
  const tracks = provider.catalog.tracksByAlbum.get(album.key) ?? []
  const rowCount = Math.max(tracks.length, minimumRows)
  return {
    screenId: 'S08',
    route: { kind: 'album-tracks', albumKey: album.key },
    title: album.title,
    density: 'compact',
    rows: Array.from({ length: rowCount }, (_, index) => {
      const track = tracks[index % tracks.length]
      if (track === undefined) throw new Error('A long fixture requires at least one album track')
      return {
        index,
        label: index < tracks.length ? track.title : `${track.title} · ${index + 1}`,
        sublabel: formatDuration(track.durationMs),
        glyphs: index === 0 ? ['playing'] : [],
        provenance: null,
      }
    }),
    highlightIndex: tracks.length === 0 ? -1 : 0,
    windowStart: 0,
  }
}
