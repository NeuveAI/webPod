import type {
  AlbumRef,
  ArtistRef,
  GenreRef,
  LocalKey,
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
  trackByKey(trackKey: LocalKey): TrackRef | null
  tracksForAlbum(albumKey: LocalKey): readonly TrackRef[]
  tracksForPlaylist(playlistKey: LocalKey): readonly TrackRef[]
  albumsForArtist(artistKey: LocalKey): readonly AlbumRef[]
  albumsForGenre(genreKey: LocalKey): readonly AlbumRef[]
  artistsForGenre(genreKey: LocalKey): readonly ArtistRef[]
  tracksForGenre(genreKey: LocalKey): readonly TrackRef[]
}

export interface NavigationSelection {
  readonly frame: ScreenFrame | null
  readonly played: boolean
}

export type NavigationStatus = Extract<NavigationRoute, { readonly kind: 'status' }>['state']

/** Creates a typed terminal posture; provider/session events never bypass the route model. */
export function statusFrame(state: NavigationStatus, providerName = 'Music'): ScreenFrame {
  const title = state === 'signed-out'
    ? `Sign in to ${providerName}`
    : state === 'playback-unavailable'
      ? 'Playback unavailable'
      : state === 'offline'
        ? 'Offline'
        : state === 'loading'
          ? 'Loading'
          : state === 'empty'
            ? 'Nothing here'
            : 'Unavailable'
  return frame('S27', title, { kind: 'status', state }, [], 'airy')
}

/** Maps the provider's observable account posture to a typed navigation frame. */
export function providerStatusFrame(provider: MusicProvider): ScreenFrame | null {
  if (provider.session === null) return statusFrame('signed-out', provider.displayName)
  if (!provider.session.canPlay) return statusFrame('playback-unavailable', provider.displayName)
  return null
}

const descendRow = (index: number, label: string, sublabel: string | null = null, destination?: NavigationRoute): PanelRow => ({
  index,
  label,
  sublabel,
  glyphs: ['descend'],
  provenance: null,
  ...(destination === undefined ? {} : { destination }),
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
  const destinations: readonly (readonly [string, number | null, NavigationRoute])[] = [
    ['Cover Flow', source.albums.length, { kind: 'cover-flow' }],
    ['Playlists', source.playlists.length, { kind: 'playlists' }],
    ['Artists', source.artists.length, { kind: 'artists' }],
    ['Albums', source.albums.length, { kind: 'albums' }],
    ['Songs', source.songs.length, { kind: 'songs' }],
    ['Genres', source.genres.length, { kind: 'genres' }],
    ...(provider.supports('stations') ? [['Radio', source.stations.length, { kind: 'stations' } as const] as const] : []),
    ['Search', null, { kind: 'search-entry' }],
  ] as const
  const root = frame(
    'S03',
    'Music',
    { kind: 'root' },
    destinations.map(([label, count, destination], index) => descendRow(index, label, count === null ? null : String(count), destination)),
  )
  return { ...root, highlightIndex: Math.min(3, root.rows.length - 1) }
}

/** Resolves one center-button selection through the typed route graph. */
export async function selectNavigation(
  current: ScreenFrame,
  source: NavigationDataSource,
  provider: MusicProvider,
  searchQuery = '',
): Promise<NavigationSelection> {
  const route = current.route
  const index = current.highlightIndex
  if (route === undefined || index < 0) return { frame: null, played: false }

  if (route.kind === 'root') return { frame: rootDestination(current.rows[index]?.destination, source), played: false }
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
    const destination = current.rows[index]?.destination
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
  if (route.kind === 'search-entry' && current.rows[index]?.destination?.kind === 'search-request') {
    const [library, catalog] = await Promise.all([
      provider.search({ term: searchQuery, scope: 'library', kinds: ['track'], limit: 25 }),
      provider.search({ term: searchQuery, scope: 'catalog', kinds: ['track'], limit: 25 }),
    ])
    return { frame: searchResultsFrame(searchQuery, library.tracks, catalog.tracks), played: false }
  }
  return { frame: null, played: false }
}

function rootDestination(destination: NavigationRoute | undefined, source: NavigationDataSource): ScreenFrame | null {
  if (destination?.kind === 'cover-flow') return albumsFrame('Cover Flow', 'cover-flow', source.albums)
  if (destination?.kind === 'playlists') return listFrame('S05', 'Playlists', destination, source.playlists.map((item, index) => descendRow(index, item.name, String(item.trackCount))))
  if (destination?.kind === 'artists') return artistsFrame('Artists', destination, source.artists)
  if (destination?.kind === 'albums') return albumsFrame('Albums', 'albums', source.albums)
  if (destination?.kind === 'songs') return songsFrame('Songs', destination, source.songs)
  if (destination?.kind === 'genres') return listFrame('S10', 'Genres', destination, source.genres.map((item, index) => descendRow(index, item.name)))
  if (destination?.kind === 'stations') return listFrame('S18', 'Radio', destination, source.stations.map((item, index) => descendRow(index, item.name, item.live ? 'Live' : null)))
  if (destination?.kind === 'search-entry') return listFrame('S12', 'Search', destination, [descendRow(0, 'Search Library & Apple Music', 'Type a query', { kind: 'search-request' })])
  return null
}

function artistsFrame(title: string, route: NavigationRoute, artists: readonly ArtistRef[]): ScreenFrame {
  return listFrame('S06', title, route, artists.map((item, index) => descendRow(index, item.name)))
}

function albumsFrame(title: string, kind: 'albums' | 'cover-flow', albums: readonly AlbumRef[]): ScreenFrame {
  return listFrame(kind === 'cover-flow' ? 'S19' : 'S08', title, { kind }, albums.map((item, index) => descendRow(index, item.title, item.artistName)))
}

function artistAlbumsFrame(artist: ArtistRef, albums: readonly AlbumRef[]): ScreenFrame {
  return listFrame('S07', artist.name, { kind: 'artist-albums', artistKey: artist.key }, albums.map((item, index) => descendRow(index, item.title, String(item.trackCount))))
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
  const choices: readonly (readonly [string, NavigationRoute])[] = [
    ['Artists', { kind: 'genre-artists', genreKey: genre.key }],
    ['Albums', { kind: 'genre-albums', genreKey: genre.key }],
    ['Songs', { kind: 'genre-tracks', genreKey: genre.key }],
  ]
  return listFrame('S10', genre.name, { kind: 'genre-facets', genreKey: genre.key }, choices.map(([label, destination], index) => descendRow(index, label, null, destination)))
}

function genreDestination(genreKey: LocalKey, destination: NavigationRoute | undefined, source: NavigationDataSource): ScreenFrame | null {
  if (destination?.kind === 'genre-artists') return artistsFrame('Artists', destination, source.artistsForGenre(genreKey))
  if (destination?.kind === 'genre-albums') return listFrame('S07', 'Albums', destination, source.albumsForGenre(genreKey).map((item, index) => descendRow(index, item.title, item.artistName)))
  if (destination?.kind === 'genre-tracks') return songsFrame('Songs', destination, source.tracksForGenre(genreKey))
  return null
}

function tracksForRoute(route: NavigationRoute, source: NavigationDataSource): readonly TrackRef[] {
  if (route.kind === 'album-tracks') return source.tracksForAlbum(route.albumKey)
  if (route.kind === 'playlist-tracks') return source.tracksForPlaylist(route.playlistKey)
  if (route.kind === 'genre-tracks') return source.tracksForGenre(route.genreKey)
  if (route.kind === 'search-results') {
    return route.trackKeys.flatMap((key) => {
      const track = source.trackByKey(key)
      return track === null ? [] : [track]
    })
  }
  return source.songs
}

function searchResultsFrame(query: string, library: readonly TrackRef[], catalog: readonly TrackRef[]): ScreenFrame {
  const tracks = [...library, ...catalog.filter((track) => !library.some((item) => item.key === track.key))]
  const rows = tracks.map((track, index) => ({ ...trackRow(track, index), sublabel: library.some((item) => item.key === track.key) ? 'Library' : 'Apple Music' }))
  return listFrame('S12', query === '' ? 'All Songs' : query, { kind: 'search-results', query, trackKeys: tracks.map((track) => track.key) }, rows)
}

function nowPlayingFrame(): ScreenFrame {
  return frame('S13', 'Now Playing', { kind: 'now-playing' }, [], 'airy')
}

function listFrame(screenId: ScreenFrame['screenId'], title: string, route: NavigationRoute, rows: readonly PanelRow[]): ScreenFrame {
  return frame(screenId, title, route, rows, 'compact')
}
