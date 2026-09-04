import type {
  AlbumRef,
  Artwork,
  ArtistRef,
  Entity,
  GenreRef,
  LocalKey,
  MusicProvider,
  PlayTarget,
  PlaylistRef,
  StationRef,
  TrackRef,
} from '@webpod/providers'
import type { NavigationRoute, PanelRow, ScreenFrame } from '@webpod/state'
import { BoundedAsyncCache } from './bounded-async-cache'

export interface NavigationLoadOptions {
  readonly signal?: AbortSignal
  readonly priority?: 'low' | 'high'
}

/** Provider-domain relationship data required by the screen graph. */
export interface NavigationDataSource {
  readonly albums: readonly AlbumRef[]
  readonly artists: readonly ArtistRef[]
  readonly genres: readonly GenreRef[]
  readonly playlists: readonly PlaylistRef[]
  readonly songs: readonly TrackRef[]
  readonly stations: readonly StationRef[]
  /** Optional live-library posture. Incomplete counts are rendered as lower bounds. */
  readonly libraryStatus?: Readonly<Record<NavigationLibraryCollection, NavigationLibraryCollectionStatus>>
  /** True only when relationship methods cancel their underlying I/O signal. */
  readonly relationshipRequestsAbortable?: boolean
  subscribe?(listener: () => void): () => void
  getRevision?(): number
  rememberTracks?(tracks: readonly TrackRef[]): void
  trackByKey(trackKey: LocalKey): TrackRef | null
  tracksForAlbum(albumKey: LocalKey, options?: NavigationLoadOptions): readonly TrackRef[] | Promise<readonly TrackRef[]>
  tracksForPlaylist(playlistKey: LocalKey, options?: NavigationLoadOptions): readonly TrackRef[] | Promise<readonly TrackRef[]>
  albumsForArtist(artistKey: LocalKey, options?: NavigationLoadOptions): readonly AlbumRef[] | Promise<readonly AlbumRef[]>
  albumsForGenre(genreKey: LocalKey): readonly AlbumRef[]
  artistsForGenre(genreKey: LocalKey): readonly ArtistRef[]
  tracksForGenre(genreKey: LocalKey): readonly TrackRef[]
}

export type NavigationLibraryCollection = 'playlists' | 'artists' | 'albums' | 'songs'
export interface NavigationLibraryCollectionStatus {
  readonly loaded: number
  readonly state: 'loading' | 'complete' | 'error'
}

export interface NavigationSelection {
  readonly frame: ScreenFrame | null
  readonly played: boolean
  /** Replaces an already-visible loading frame without delaying navigation. */
  readonly resolution?: Promise<ScreenFrame>
  /** Settles the requested transport without delaying the pending frame. */
  readonly playback?: Promise<void>
}

export interface NavigationPreparation {
  readonly key: string
  readonly artwork: Artwork | null
  readonly playTarget: PlayTarget | null
  prefetchData(): Promise<void>
}

/** Exact provider queue represented by a rendered track frame. */
export interface PlaybackQueueContext {
  readonly tracks: readonly TrackRef[]
  readonly sourceLabel: string | null
  readonly startIndex: number | null
}

type TrackScreenFrame = ScreenFrame & { readonly playbackQueue: PlaybackQueueContext }
type AlbumScreenFrame = ScreenFrame & { readonly albumCollection: readonly AlbumRef[] }
type LoadingScreenFrame = ScreenFrame & {
  readonly navigationLoading: true
  /** Survives the store's frame normalization clone and rejects stale loads. */
  readonly navigationRequestId: number
}

let navigationRequestSequence = 0

const RELATIONSHIP_CACHE_MAX_ENTRIES = 32
const RELATIONSHIP_CACHE_TTL_MS = 5 * 60 * 1_000
interface RelationshipCaches {
  readonly tracks: BoundedAsyncCache<readonly TrackRef[]>
  readonly albums: BoundedAsyncCache<readonly AlbumRef[]>
}
const relationshipRequests = new WeakMap<NavigationDataSource, RelationshipCaches>()

function relationshipCaches(source: NavigationDataSource): RelationshipCaches {
  const existing = relationshipRequests.get(source)
  if (existing !== undefined) return existing
  const created = {
    tracks: new BoundedAsyncCache<readonly TrackRef[]>({ maxEntries: RELATIONSHIP_CACHE_MAX_ENTRIES, ttlMs: RELATIONSHIP_CACHE_TTL_MS }),
    albums: new BoundedAsyncCache<readonly AlbumRef[]>({ maxEntries: RELATIONSHIP_CACHE_MAX_ENTRIES, ttlMs: RELATIONSHIP_CACHE_TTL_MS }),
  }
  relationshipRequests.set(source, created)
  return created
}

const tracksForAlbum = (source: NavigationDataSource, album: AlbumRef, priority: 'low' | 'high' = 'high'): Promise<readonly TrackRef[]> =>
  relationshipCaches(source).tracks.get(`album:${album.key}`, priority, (signal, requestPriority) => Promise.resolve(source.tracksForAlbum(album.key, { signal, priority: requestPriority })), { supersedeLowPriority: source.relationshipRequestsAbortable === true })

const tracksForPlaylist = (source: NavigationDataSource, playlist: PlaylistRef, priority: 'low' | 'high' = 'high'): Promise<readonly TrackRef[]> =>
  relationshipCaches(source).tracks.get(`playlist:${playlist.key}`, priority, (signal, requestPriority) => Promise.resolve(source.tracksForPlaylist(playlist.key, { signal, priority: requestPriority })), { supersedeLowPriority: source.relationshipRequestsAbortable === true })

const albumsForArtist = (source: NavigationDataSource, artist: ArtistRef, priority: 'low' | 'high' = 'high'): Promise<readonly AlbumRef[]> =>
  relationshipCaches(source).albums.get(`artist:${artist.key}`, priority, (signal, requestPriority) => Promise.resolve(source.albumsForArtist(artist.key, { signal, priority: requestPriority })), { supersedeLowPriority: source.relationshipRequestsAbortable === true })

/** Aborts speculative relationship work when a source leaves the mounted player. */
export function clearNavigationCaches(source: NavigationDataSource): void {
  const caches = relationshipRequests.get(source)
  caches?.tracks.clear()
  caches?.albums.clear()
  relationshipRequests.delete(source)
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
  const destinations: readonly (readonly [string, string | null, NavigationRoute])[] = [
    ['Cover Flow', libraryCount(source, 'albums'), { kind: 'cover-flow' }],
    ['Playlists', libraryCount(source, 'playlists'), { kind: 'playlists' }],
    ['Artists', libraryCount(source, 'artists'), { kind: 'artists' }],
    ['Albums', libraryCount(source, 'albums'), { kind: 'albums' }],
    ['Songs', libraryCount(source, 'songs'), { kind: 'songs' }],
    ['Genres', String(source.genres.length), { kind: 'genres' }],
    ...(provider.supports('stations') ? [['Radio', String(source.stations.length), { kind: 'stations' } as const] as const] : []),
    ['Search', null, { kind: 'search-entry' }],
  ] as const
  const root = frame(
    'S03',
    'Music',
    { kind: 'root' },
    destinations.map(([label, count, destination], index) => descendRow(index, label, count, destination)),
  )
  return { ...root, highlightIndex: Math.min(3, root.rows.length - 1) }
}

function libraryCount(source: NavigationDataSource, collection: NavigationLibraryCollection): string {
  const count = source[collection].length
  return source.libraryStatus?.[collection].state === 'loading' || source.libraryStatus?.[collection].state === 'error'
    ? `${String(count)}+`
    : String(count)
}

/** Rebuilds live collection frames while preserving the listener's position. */
export function refreshNavigationFrame(current: ScreenFrame, source: NavigationDataSource, provider: MusicProvider): ScreenFrame {
  const route = current.route
  if (route === undefined) return current
  let refreshed: ScreenFrame | null = null
  if (route.kind === 'root') refreshed = navigationRoot(source, provider)
  else if (route.kind === 'cover-flow') refreshed = albumsFrame('Cover Flow', 'cover-flow', source.albums)
  else if (route.kind === 'playlists') refreshed = listFrame('S05', 'Playlists', route, source.playlists.map((item, index) => descendRow(index, item.name)))
  else if (route.kind === 'artists') refreshed = artistsFrame('Artists', route, source.artists)
  else if (route.kind === 'albums') refreshed = albumsFrame('Albums', 'albums', source.albums)
  else if (route.kind === 'songs') refreshed = songsFrame('Songs', route, source.songs)
  else if (route.kind === 'stations') refreshed = listFrame('S18', 'Radio', route, source.stations.map((item, index) => descendRow(index, item.name, item.live ? 'Live' : null)))
  if (refreshed === null) return current
  const highlightIndex = refreshed.rows.length === 0 ? -1 : Math.min(Math.max(0, current.highlightIndex), refreshed.rows.length - 1)
  const windowStart = Math.min(Math.max(0, current.windowStart), Math.max(0, refreshed.rows.length - 1))
  return { ...refreshed, highlightIndex, windowStart }
}

/** Resolves one center-button selection through the typed route graph. */
export function selectNavigationImmediate(
  current: ScreenFrame,
  source: NavigationDataSource,
  provider: MusicProvider,
  searchQuery = '',
): NavigationSelection {
  const route = current.route
  const index = current.highlightIndex
  if (route === undefined || index < 0) return { frame: null, played: false }

  if (route.kind === 'root') return { frame: rootDestination(current.rows[index]?.destination, source), played: false }
  if (route.kind === 'cover-flow' || route.kind === 'albums') {
    const album = source.albums[index]
    if (album === undefined) return { frame: null, played: false }
    return { frame: loadingTracksFrame(album), resolution: tracksForAlbum(source, album).then((tracks) => tracksFrame(album, tracks)), played: false }
  }
  if (route.kind === 'playlists') {
    const playlist = source.playlists[index]
    if (playlist === undefined) return { frame: null, played: false }
    return { frame: loadingPlaylistFrame(playlist), resolution: tracksForPlaylist(source, playlist).then((tracks) => playlistFrame(playlist, tracks)), played: false }
  }
  if (route.kind === 'artists' || route.kind === 'genre-artists') {
    const artists = route.kind === 'artists' ? source.artists : source.artistsForGenre(route.genreKey)
    const artist = artists[index]
    if (artist === undefined) return { frame: null, played: false }
    return { frame: loadingArtistFrame(artist), resolution: albumsForArtist(source, artist).then((albums) => artistAlbumsFrame(artist, albums)), played: false }
  }
  if (route.kind === 'artist-albums' || route.kind === 'genre-albums') {
    let albums = albumCollectionForFrame(current)
    if (albums === null) {
      if (route.kind === 'artist-albums') {
        const artist = source.artists.find((item) => item.key === route.artistKey)
        if (artist === undefined) return { frame: null, played: false }
        const loading = loadingArtistFrame(artist)
        return {
          frame: loading,
          resolution: albumsForArtist(source, artist).then(async (resolved) => {
            const album = resolved[index]
            return album === undefined ? loading : tracksFrame(album, await tracksForAlbum(source, album))
          }),
          played: false,
        }
      } else {
        albums = source.albumsForGenre(route.genreKey)
      }
    }
    const album = albums[index]
    if (album === undefined) return { frame: null, played: false }
    return { frame: loadingTracksFrame(album), resolution: tracksForAlbum(source, album).then((tracks) => tracksFrame(album, tracks)), played: false }
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
    const tracks = playbackQueueForFrame(current)?.tracks ?? synchronousTracksForRoute(route, source)
    if (tracks[index] === undefined) return { frame: null, played: false }
    const playback = provider.play({ kind: 'tracks', tracks, startIndex: index })
    return { frame: nowPlayingFrame(tracks, index, current.title), played: true, playback }
  }
  if (route.kind === 'stations') {
    const station = source.stations[index]
    if (station === undefined) return { frame: null, played: false }
    // Existing station entities use the same serialized play boundary as every
    // other queue target, so rapid cross-kind selections remain latest-wins.
    const playback = provider.play({ kind: 'station', station })
    return { frame: nowPlayingFrame(), played: true, playback }
  }
  if (route.kind === 'search-entry' && current.rows[index]?.destination?.kind === 'search-request') {
    const resolution = Promise.all([
      provider.search({ term: searchQuery, scope: 'library', kinds: ['track'], limit: 25 }),
      provider.search({ term: searchQuery, scope: 'catalog', kinds: ['track'], limit: 25 }),
    ]).then(([library, catalog]) => {
      source.rememberTracks?.([...library.tracks, ...catalog.tracks])
      return searchResultsFrame(searchQuery, library.tracks, catalog.tracks)
    })
    return { frame: loadingSearchFrame(searchQuery), resolution, played: false }
  }
  return { frame: null, played: false }
}

/** Compatibility helper for callers that intentionally wait for complete data. */
export async function selectNavigation(
  current: ScreenFrame,
  source: NavigationDataSource,
  provider: MusicProvider,
  searchQuery = '',
): Promise<NavigationSelection> {
  const selection = selectNavigationImmediate(current, source, provider, searchQuery)
  if (selection.resolution === undefined) return selection
  return { ...selection, frame: await selection.resolution, resolution: undefined }
}

function loadingTracksFrame(album: AlbumRef): LoadingScreenFrame {
  return { ...trackListFrame('S08', album.title, { kind: 'album-tracks', albumKey: album.key }, []), navigationLoading: true, navigationRequestId: ++navigationRequestSequence }
}

function loadingPlaylistFrame(playlist: PlaylistRef): LoadingScreenFrame {
  return { ...trackListFrame('S08', playlist.name, { kind: 'playlist-tracks', playlistKey: playlist.key }, []), navigationLoading: true, navigationRequestId: ++navigationRequestSequence }
}

function loadingArtistFrame(artist: ArtistRef): LoadingScreenFrame {
  return { ...withAlbumCollection(listFrame('S07', artist.name, { kind: 'artist-albums', artistKey: artist.key }, []), []), navigationLoading: true, navigationRequestId: ++navigationRequestSequence }
}

function loadingSearchFrame(query: string): LoadingScreenFrame {
  return { ...listFrame('S12', query === '' ? 'All Songs' : query, { kind: 'search-results', query, trackKeys: [] }, []), navigationLoading: true, navigationRequestId: ++navigationRequestSequence }
}

export function isNavigationLoadingFrame(frameValue: ScreenFrame): boolean {
  return 'navigationLoading' in frameValue && frameValue.navigationLoading === true
}

/** Identity for the accepted navigation whose shell is currently visible. */
export function navigationLoadingRequestId(frameValue: ScreenFrame): number | null {
  if (!isNavigationLoadingFrame(frameValue) || !('navigationRequestId' in frameValue)) return null
  return typeof frameValue.navigationRequestId === 'number' ? frameValue.navigationRequestId : null
}

function rootDestination(destination: NavigationRoute | undefined, source: NavigationDataSource): ScreenFrame | null {
  if (destination?.kind === 'cover-flow') return albumsFrame('Cover Flow', 'cover-flow', source.albums)
  if (destination?.kind === 'playlists') return listFrame('S05', 'Playlists', destination, source.playlists.map((item, index) => descendRow(index, item.name)))
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
  return withAlbumCollection(listFrame('S07', artist.name, { kind: 'artist-albums', artistKey: artist.key }, albums.map((item, index) => descendRow(index, item.title, item.artistName))), albums)
}

function tracksFrame(album: AlbumRef, tracks: readonly TrackRef[]): ScreenFrame {
  return trackListFrame('S08', album.title, { kind: 'album-tracks', albumKey: album.key }, tracks)
}

function playlistFrame(playlist: PlaylistRef, tracks: readonly TrackRef[]): ScreenFrame {
  return trackListFrame('S08', playlist.name, { kind: 'playlist-tracks', playlistKey: playlist.key }, tracks)
}

function songsFrame(title: string, route: NavigationRoute, tracks: readonly TrackRef[]): ScreenFrame {
  return trackListFrame('S09', title, route, tracks)
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

function synchronousTracksForRoute(route: NavigationRoute, source: NavigationDataSource): readonly TrackRef[] {
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
  return withPlaybackQueue(listFrame('S12', query === '' ? 'All Songs' : query, { kind: 'search-results', query, trackKeys: tracks.map((track) => track.key) }, rows), tracks)
}

function nowPlayingFrame(tracks: readonly TrackRef[] = [], startIndex: number | null = null, sourceLabel: string | null = null): ScreenFrame {
  return withPlaybackQueue(frame('S13', 'Now Playing', { kind: 'now-playing' }, [], 'airy'), tracks, startIndex, sourceLabel)
}

function listFrame(screenId: ScreenFrame['screenId'], title: string, route: NavigationRoute, rows: readonly PanelRow[]): ScreenFrame {
  return frame(screenId, title, route, rows, 'compact')
}

function trackListFrame(screenId: ScreenFrame['screenId'], title: string, route: NavigationRoute, tracks: readonly TrackRef[]): TrackScreenFrame {
  return withPlaybackQueue(listFrame(screenId, title, route, tracks.map(trackRow)), tracks)
}

function withPlaybackQueue(frameValue: ScreenFrame, tracks: readonly TrackRef[], startIndex: number | null = null, sourceLabel: string | null = null): TrackScreenFrame {
  return { ...frameValue, playbackQueue: { tracks, startIndex, sourceLabel } }
}

function withAlbumCollection(frameValue: ScreenFrame, albums: readonly AlbumRef[]): AlbumScreenFrame {
  return { ...frameValue, albumCollection: albums }
}

/** Reads the exact artist albums represented by a rendered frame. */
export function albumCollectionForFrame(frameValue: ScreenFrame): readonly AlbumRef[] | null {
  return isAlbumScreenFrame(frameValue) ? frameValue.albumCollection : null
}

/** Reads queue context only from frames produced by this navigation graph. */
export function playbackQueueForFrame(frameValue: ScreenFrame): PlaybackQueueContext | null {
  return isTrackScreenFrame(frameValue) ? frameValue.playbackQueue : null
}

/** Returns the provider entity represented by the current highlight, if any. */
export function previewEntityForFrame(frameValue: ScreenFrame, source: NavigationDataSource): Entity | null {
  const route = frameValue.route
  const index = frameValue.highlightIndex
  if (route === undefined || index < 0) return null
  if (route.kind === 'root') {
    const destination = frameValue.rows[index]?.destination?.kind
    if (destination === 'cover-flow' || destination === 'albums') return source.albums[0] ?? null
    if (destination === 'playlists') return source.playlists[0] ?? null
    if (destination === 'artists') return source.artists[0] ?? null
    if (destination === 'songs') return source.songs[0] ?? null
    if (destination === 'stations') return source.stations[0] ?? null
    return null
  }
  if (route.kind === 'cover-flow' || route.kind === 'albums') return source.albums[index] ?? null
  if (route.kind === 'playlists') return source.playlists[index] ?? null
  if (route.kind === 'artists') return source.artists[index] ?? null
  if (route.kind === 'stations') return source.stations[index] ?? null
  if (route.kind === 'artist-albums' || route.kind === 'genre-albums') return albumCollectionForFrame(frameValue)?.[index] ?? null
  return playbackQueueForFrame(frameValue)?.tracks[index] ?? null
}

/** Describes safe work for a continuously highlighted row. */
export function preparationForFrame(frameValue: ScreenFrame, source: NavigationDataSource): NavigationPreparation | null {
  const route = frameValue.route
  const index = frameValue.highlightIndex
  const entity = previewEntityForFrame(frameValue, source)
  if (route === undefined || index < 0 || entity === null) return null
  const queue = playbackQueueForFrame(frameValue)
  const selectedTrack = queue?.tracks[index]
  if (selectedTrack !== undefined && queue !== null) {
    return {
      key: `${route.kind}:${selectedTrack.key}:${index}`,
      artwork: selectedTrack.artwork ?? null,
      playTarget: { kind: 'tracks', tracks: queue.tracks, startIndex: index },
      async prefetchData() {},
    }
  }
  if (entity.kind === 'album') {
    return { key: `${route.kind}:${entity.key}:${index}`, artwork: entity.artwork ?? null, playTarget: null, async prefetchData() { await tracksForAlbum(source, entity, 'low') } }
  }
  if (entity.kind === 'playlist') {
    return { key: `${route.kind}:${entity.key}:${index}`, artwork: entity.artwork ?? null, playTarget: null, async prefetchData() { await tracksForPlaylist(source, entity, 'low') } }
  }
  if (entity.kind === 'artist') {
    return { key: `${route.kind}:${entity.key}:${index}`, artwork: entity.artwork ?? null, playTarget: null, async prefetchData() { await albumsForArtist(source, entity, 'low') } }
  }
  return { key: `${route.kind}:${entity.key}:${index}`, artwork: 'artwork' in entity ? entity.artwork ?? null : null, playTarget: null, async prefetchData() {} }
}

/** The single row backed by sustained user focus; surrounding rows are not intent. */
export function preparationsForFrame(frameValue: ScreenFrame, source: NavigationDataSource): readonly NavigationPreparation[] {
  const preparation = preparationForFrame(frameValue, source)
  return preparation === null ? [] : [preparation]
}

function isTrackScreenFrame(frameValue: ScreenFrame): frameValue is TrackScreenFrame {
  return 'playbackQueue' in frameValue
}

function isAlbumScreenFrame(frameValue: ScreenFrame): frameValue is AlbumScreenFrame {
  return 'albumCollection' in frameValue
}
