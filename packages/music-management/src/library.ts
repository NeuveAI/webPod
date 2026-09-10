import type { AlbumRef, ArtistRef, Entity, GenreRef, LocalKey, MusicProvider, PlaylistRef, StationRef, TrackRef } from '@webpod/providers'

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
  artistAlbumsFailed?(artistKey: LocalKey): boolean
  artistAlbumsSnapshot?(artistKey: LocalKey): readonly AlbumRef[] | undefined
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

type ProgressiveMusicSource = { readonly source: NavigationDataSource; readonly completion: Promise<void> }
const navigationLoadAborted = (options: { readonly signal?: AbortSignal } | undefined): boolean => options?.signal?.aborted ?? false

/** Loads one useful page per collection, then streams all remaining pages into the same source. */
export async function createProgressiveMusicSource(provider: MusicProvider, isCurrent: () => boolean = () => true): Promise<ProgressiveMusicSource> {
  const kinds = ['playlists', 'artists', 'albums', 'songs'] as const
  const [playlistsPage, artistsPage, albumsPage, songsPage] = await Promise.all([
    provider.libraryList('playlists'),
    provider.libraryList('artists'),
    provider.libraryList('albums'),
    provider.libraryList('songs'),
  ])
  const firstByKind: Record<NavigationLibraryCollection, Awaited<ReturnType<MusicProvider['libraryList']>>> = {
    playlists: playlistsPage,
    artists: artistsPage,
    albums: albumsPage,
    songs: songsPage,
  }
  const typedPlaylists = firstByKind.playlists.items.filter((item): item is PlaylistRef => item.kind === 'playlist')
  const typedArtists = firstByKind.artists.items.filter((item): item is ArtistRef => item.kind === 'artist')
  const typedAlbums = firstByKind.albums.items.filter((item): item is AlbumRef => item.kind === 'album')
  const typedSongs = firstByKind.songs.items.filter((item): item is TrackRef => item.kind === 'track')
  const stations: StationRef[] = []
  const status: Record<NavigationLibraryCollection, NavigationLibraryCollectionStatus> = {
    playlists: { loaded: typedPlaylists.length, state: playlistsPage.next === null ? 'complete' : 'loading' },
    artists: { loaded: typedArtists.length, state: artistsPage.next === null ? 'complete' : 'loading' },
    albums: { loaded: typedAlbums.length, state: albumsPage.next === null ? 'complete' : 'loading' },
    songs: { loaded: typedSongs.length, state: songsPage.next === null ? 'complete' : 'loading' },
  }
  let revision = 0
  const sourceListeners = new Set<() => void>()
  const notify = (): void => { revision += 1; for (const listener of sourceListeners) listener() }
  const knownTracks = new Map<LocalKey, TrackRef>()
  const discoveredAlbums = new Map<LocalKey, AlbumRef>()
  const artistAlbumPages = new Map<LocalKey, readonly AlbumRef[]>()
  const artistAlbumErrors = new Set<LocalKey>()
  const remember = (tracks: readonly TrackRef[]): readonly TrackRef[] => {
    for (const track of tracks) {
      knownTracks.delete(track.key)
      knownTracks.set(track.key, track)
      while (knownTracks.size > 256) {
        const oldest = knownTracks.keys().next().value
        if (oldest === undefined) break
        knownTracks.delete(oldest)
      }
    }
    return tracks
  }
  const album = (key: LocalKey): AlbumRef | undefined => typedAlbums.find((item) => item.key === key) ?? discoveredAlbums.get(key); const artist = (key: LocalKey): ArtistRef | undefined => typedArtists.find((item) => item.key === key); const playlist = (key: LocalKey): PlaylistRef | undefined => typedPlaylists.find((item) => item.key === key)
  const source: NavigationDataSource = {
    albums: typedAlbums, artists: typedArtists, genres: [] satisfies readonly GenreRef[], playlists: typedPlaylists, songs: typedSongs, stations,
    get libraryStatus() { return status },
    subscribe(listener) { sourceListeners.add(listener); return () => { sourceListeners.delete(listener) } },
    getRevision: () => revision,
    rememberTracks: (tracks) => { remember(tracks) }, trackByKey: (key) => knownTracks.get(key) ?? null,
    tracksForAlbum: async (key, options) => { const ref = album(key); if (ref === undefined || navigationLoadAborted(options)) return []; const tracks = await provider.relatedTracks(ref); return navigationLoadAborted(options) ? [] : remember(tracks) },
    tracksForPlaylist: async (key, options) => { const ref = playlist(key); if (ref === undefined || navigationLoadAborted(options)) return []; const tracks = await provider.relatedTracks(ref); return navigationLoadAborted(options) ? [] : remember(tracks) },
    artistAlbumsSnapshot: (key) => artistAlbumPages.get(key),
    artistAlbumsFailed: (key) => artistAlbumErrors.has(key),
    albumsForArtist: async (key, options) => {
      const ref = artist(key)
      if (ref === undefined || navigationLoadAborted(options)) return []
      artistAlbumErrors.delete(key)
      const accept = (albums: readonly AlbumRef[]): void => {
        if (!isCurrent() || navigationLoadAborted(options)) throw new DOMException('Navigation ended', 'AbortError')
        if (artistAlbumPages.get(key) === albums) return
        for (const value of albums) discoveredAlbums.set(value.key, value)
        artistAlbumPages.set(key, albums)
        notify()
      }
      try {
        const albums = await provider.relatedAlbums(ref, { signal: options?.signal, onPage: accept })
        accept(albums)
        return albums
      } catch (error) {
        if (isCurrent() && !navigationLoadAborted(options)) { artistAlbumErrors.add(key); notify() }
        throw error
      }
    },
    albumsForGenre: () => [], artistsForGenre: () => [], tracksForGenre: () => [],
  }
  const collections: Record<NavigationLibraryCollection, Entity[]> = { playlists: typedPlaylists, artists: typedArtists, albums: typedAlbums, songs: typedSongs }
  const drain = async (kind: NavigationLibraryCollection): Promise<void> => {
    let cursor = firstByKind[kind].next
    let pages = 1
    try {
      while (cursor !== null && isCurrent()) {
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
        const page = await provider.libraryList(kind, cursor)
        if (!isCurrent()) return
        const expectedKind = kind === 'songs' ? 'track' : kind.slice(0, -1)
        collections[kind].push(...page.items.filter((item) => item.kind === expectedKind))
        cursor = page.next
        pages += 1
        if (pages > 1_000) throw new Error('Music library pagination did not terminate')
        status[kind] = { loaded: collections[kind].length, state: cursor === null ? 'complete' : 'loading' }
        notify()
      }
    } catch {
      if (!isCurrent()) return
      status[kind] = { loaded: collections[kind].length, state: 'error' }
      notify()
      console.warn(`${provider.displayName} ${kind} sync stopped before completion`)
    }
  }
  const loadStations = async (): Promise<void> => {
    try {
      const loaded = await provider.stationsList()
      if (!isCurrent()) return
      stations.push(...loaded)
      notify()
    } catch {
      // Stations are optional and must not delay or invalidate the user's library.
    }
  }
  // MusicKit does not expose Fetch priority. Run speculative pagination one
  // collection at a time and yield between pages so relationship/navigation
  // work triggered by a person can enter the SDK queue first.
  const completion = (async () => {
    void loadStations()
    for (const kind of kinds) await drain(kind)
  })()
  return { source, completion }
}

