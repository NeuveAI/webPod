import type {
  AlbumRef,
  ArtistRef,
  GenreRef,
  MusicProvider,
  PlaylistRef,
  StationRef,
  TrackRef,
} from '@webpod/providers'
import type { NavigationRoute, PanelRow, ScreenFrame } from '@webpod/state'

/** Provider-domain relationship data required by the screen graph. */
export interface NavigationDataSource {
  readonly albums: readonly AlbumRef[]
  readonly artists: readonly ArtistRef[]
  readonly genres: readonly GenreRef[]
  readonly playlists: readonly PlaylistRef[]
  readonly songs: readonly TrackRef[]
  readonly stations: readonly StationRef[]
  tracksForAlbum(albumKey: string): readonly TrackRef[]
  tracksForPlaylist(playlistKey: string): readonly TrackRef[]
  albumsForArtist(artistKey: string): readonly AlbumRef[]
  albumsForGenre(genreKey: string): readonly AlbumRef[]
  artistsForGenre(genreKey: string): readonly ArtistRef[]
  tracksForGenre(genreKey: string): readonly TrackRef[]
}

export interface NavigationSelection {
  readonly frame: ScreenFrame | null
  readonly played: boolean
}

const descendRow = (index: number, label: string, sublabel: string | null = null): PanelRow => ({
  index,
  label,
  sublabel,
  glyphs: ['descend'],
  provenance: null,
})

const trackRow = (track: TrackRef, index: number): PanelRow => ({
  index,
  label: track.title,
  sublabel: track.artistName,
  glyphs: [],
  provenance: null,
})

const frame = (
  screenId: ScreenFrame['screenId'],
  title: string,
  route: NavigationRoute,
  rows: readonly PanelRow[],
  density: ScreenFrame['density'] = 'compact',
): ScreenFrame => ({
  screenId,
  title,
  route,
  density,
  rows,
  highlightIndex: rows.length === 0 ? -1 : 0,
  windowStart: 0,
})

/** Builds the complete capability-filtered root from provider-domain data. */
export function navigationRoot(source: NavigationDataSource, provider: MusicProvider): ScreenFrame {
  const destinations = [
    ['Cover Flow', source.albums.length],
    ['Playlists', source.playlists.length],
    ['Artists', source.artists.length],
    ['Albums', source.albums.length],
    ['Songs', source.songs.length],
    ['Genres', source.genres.length],
    ...(provider.supports('stations') ? [['Radio', source.stations.length] as const] : []),
    ['Search', null],
  ] as const
  return frame(
    'S03',
    'Music',
    { kind: 'root' },
    destinations.map(([label, count], index) => descendRow(index, label, count === null ? null : String(count))),
  )
}

/** Resolves one center-button selection through the typed route graph. */
export async function selectNavigation(
  current: ScreenFrame,
  source: NavigationDataSource,
  provider: MusicProvider,
): Promise<NavigationSelection> {
  const route = current.route
  const index = current.highlightIndex
  if (route === undefined || index < 0) return { frame: null, played: false }

  if (route.kind === 'root') return { frame: rootDestination(current.rows[index]?.label, source), played: false }
  if (route.kind === 'cover-flow' || route.kind === 'albums') {
    const album = source.albums[index]
    return { frame: album === undefined ? null : tracksFrame(album, source.tracksForAlbum(album.key)), played: false }
  }
  if (route.kind === 'playlists') {
    const playlist = source.playlists[index]
    return { frame: playlist === undefined ? null : playlistFrame(playlist, source.tracksForPlaylist(playlist.key)), played: false }
  }
  if (route.kind === 'artists' || route.kind === 'genre-artists') {
    const artists = route.kind === 'artists' ? source.artists : source.artistsForGenre(route.genreKey)
    const artist = artists[index]
    return { frame: artist === undefined ? null : artistAlbumsFrame(artist, source.albumsForArtist(artist.key)), played: false }
  }
  if (route.kind === 'artist-albums' || route.kind === 'genre-albums') {
    const albums = route.kind === 'artist-albums' ? source.albumsForArtist(route.artistKey) : source.albumsForGenre(route.genreKey)
    const album = albums[index]
    return { frame: album === undefined ? null : tracksFrame(album, source.tracksForAlbum(album.key)), played: false }
  }
  if (route.kind === 'genres') {
    const genre = source.genres[index]
    return { frame: genre === undefined ? null : genreFrame(genre), played: false }
  }
  if (route.kind === 'genre-facets') {
    const destination = current.rows[index]?.label
    return { frame: genreDestination(route.genreKey, destination, source), played: false }
  }
  if (route.kind === 'album-tracks' || route.kind === 'playlist-tracks' || route.kind === 'songs' || route.kind === 'genre-tracks' || route.kind === 'search-results') {
    const tracks = tracksForRoute(route, source)
    if (tracks[index] === undefined) return { frame: null, played: false }
    await provider.play({ kind: 'tracks', tracks, startIndex: index })
    return { frame: nowPlayingFrame(), played: true }
  }
  if (route.kind === 'stations') {
    const station = source.stations[index]
    if (station === undefined) return { frame: null, played: false }
    await provider.stationStart({ type: 'station', ref: station.catalogId })
    await provider.play({ kind: 'station', station })
    return { frame: nowPlayingFrame(), played: true }
  }
  if (route.kind === 'search-entry') {
    const results = await provider.search({ term: '', scope: 'library', kinds: ['track'], limit: 25 })
    return { frame: searchResultsFrame('', results.tracks), played: false }
  }
  return { frame: null, played: false }
}

function rootDestination(label: string | undefined, source: NavigationDataSource): ScreenFrame | null {
  if (label === 'Cover Flow') return albumsFrame('Cover Flow', 'cover-flow', source.albums)
  if (label === 'Playlists') return listFrame('S05', 'Playlists', { kind: 'playlists' }, source.playlists.map((item, index) => descendRow(index, item.name, String(item.trackCount))))
  if (label === 'Artists') return artistsFrame('Artists', { kind: 'artists' }, source.artists)
  if (label === 'Albums') return albumsFrame('Albums', 'albums', source.albums)
  if (label === 'Songs') return songsFrame('Songs', { kind: 'songs' }, source.songs)
  if (label === 'Genres') return listFrame('S10', 'Genres', { kind: 'genres' }, source.genres.map((item, index) => descendRow(index, item.name)))
  if (label === 'Radio') return listFrame('S18', 'Radio', { kind: 'stations' }, source.stations.map((item, index) => descendRow(index, item.name, item.live ? 'Live' : null)), 'medium')
  if (label === 'Search') return listFrame('S12', 'Search', { kind: 'search-entry' }, [descendRow(0, 'Search library', 'All songs')])
  return null
}

function artistsFrame(title: string, route: NavigationRoute, artists: readonly ArtistRef[]): ScreenFrame {
  return listFrame('S06', title, route, artists.map((item, index) => descendRow(index, item.name)))
}

function albumsFrame(title: string, kind: 'albums' | 'cover-flow', albums: readonly AlbumRef[]): ScreenFrame {
  return listFrame(kind === 'cover-flow' ? 'S19' : 'S08', title, { kind }, albums.map((item, index) => descendRow(index, item.title, item.artistName)))
}

function artistAlbumsFrame(artist: ArtistRef, albums: readonly AlbumRef[]): ScreenFrame {
  return listFrame('S07', artist.name, { kind: 'artist-albums', artistKey: artist.key }, albums.map((item, index) => descendRow(index, item.title, String(item.trackCount))), 'medium')
}

function tracksFrame(album: AlbumRef, tracks: readonly TrackRef[]): ScreenFrame {
  return listFrame('S08', album.title, { kind: 'album-tracks', albumKey: album.key }, tracks.map(trackRow))
}

function playlistFrame(playlist: PlaylistRef, tracks: readonly TrackRef[]): ScreenFrame {
  return listFrame('S08', playlist.name, { kind: 'playlist-tracks', playlistKey: playlist.key }, tracks.map(trackRow))
}

function songsFrame(title: string, route: NavigationRoute, tracks: readonly TrackRef[]): ScreenFrame {
  return listFrame('S09', title, route, tracks.map(trackRow))
}

function genreFrame(genre: GenreRef): ScreenFrame {
  return listFrame('S10', genre.name, { kind: 'genre-facets', genreKey: genre.key }, ['Artists', 'Albums', 'Songs'].map((label, index) => descendRow(index, label)), 'medium')
}

function genreDestination(genreKey: string, label: string | undefined, source: NavigationDataSource): ScreenFrame | null {
  if (label === 'Artists') return artistsFrame('Artists', { kind: 'genre-artists', genreKey }, source.artistsForGenre(genreKey))
  if (label === 'Albums') return listFrame('S07', 'Albums', { kind: 'genre-albums', genreKey }, source.albumsForGenre(genreKey).map((item, index) => descendRow(index, item.title, item.artistName)), 'medium')
  if (label === 'Songs') return songsFrame('Songs', { kind: 'genre-tracks', genreKey }, source.tracksForGenre(genreKey))
  return null
}

function tracksForRoute(route: NavigationRoute, source: NavigationDataSource): readonly TrackRef[] {
  if (route.kind === 'album-tracks') return source.tracksForAlbum(route.albumKey)
  if (route.kind === 'playlist-tracks') return source.tracksForPlaylist(route.playlistKey)
  if (route.kind === 'genre-tracks') return source.tracksForGenre(route.genreKey)
  if (route.kind === 'search-results') {
    const keys = new Set(route.trackKeys)
    return source.songs.filter((track) => keys.has(track.key))
  }
  return source.songs
}

function searchResultsFrame(query: string, tracks: readonly TrackRef[]): ScreenFrame {
  return listFrame('S12', query === '' ? 'All Songs' : query, { kind: 'search-results', query, trackKeys: tracks.map((track) => track.key) }, tracks.map(trackRow))
}

function nowPlayingFrame(): ScreenFrame {
  return frame('S13', 'Now Playing', { kind: 'now-playing' }, [], 'airy')
}

function listFrame(screenId: ScreenFrame['screenId'], title: string, route: NavigationRoute, rows: readonly PanelRow[], density: ScreenFrame['density'] = 'compact'): ScreenFrame {
  return frame(screenId, title, route, rows, density)
}
