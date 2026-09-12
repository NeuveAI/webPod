import { Relationships } from './relationships'
import type { AlbumRef, ArtistRef, Entity, GenreRef, LocalKey, MusicProvider, PlaylistRef, StationRef, TrackRef } from '@webpod/providers'

export interface NavigationLoadOptions {
  readonly signal?: AbortSignal
  readonly priority?: 'low' | 'high'
  /** Desired contiguous prefix; omitted means complete after accepted navigation. */
  readonly limit?: number
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
  ensureLibrary?(kind: NavigationLibraryCollection): Promise<void>
  clearRelationships?(): void
  tracksSnapshot?(kind: 'album' | 'playlist' | 'artist', key: LocalKey): readonly TrackRef[] | undefined
  tracksFailed?(kind: 'album' | 'playlist' | 'artist', key: LocalKey): boolean
  tracksForArtist?(artistKey: LocalKey, options?: NavigationLoadOptions): Promise<readonly TrackRef[]>
  prefetchArtist?(artistKey: LocalKey): Promise<void>
  subscribe?(listener: () => void): () => void
  getRevision?(): number
  rememberTracks?(tracks: readonly TrackRef[]): void
  trackByKey(trackKey: LocalKey): TrackRef | null
  /** Rendered album refs outlive LFU entries; accepted navigation carries its exact entity. */
  tracksForAlbumRef?(album: AlbumRef, options?: NavigationLoadOptions): Promise<readonly TrackRef[]>
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

/** Evictable relationship metadata only; rendered, root-library and playback owners are separate. */
export interface MusicSourceOptions {
  readonly relationshipCache?: {
    readonly tracksMaxBytes?: number
    readonly albumsMaxBytes?: number
    readonly maxEntries?: number
  }
}

type ProgressiveMusicSource = { readonly source: NavigationDataSource; readonly completion: Promise<void> }
const navigationLoadAborted = (options: { readonly signal?: AbortSignal } | undefined): boolean => options?.signal?.aborted ?? false

/** Publishes the first15 entries promptly, then fairly populates all current library collections in the background. */
export async function createProgressiveMusicSource(provider: MusicProvider, isCurrent: () => boolean = () => true, options: MusicSourceOptions = {}): Promise<ProgressiveMusicSource> {
  const [playlistsPage, artistsPage, albumsPage, songsPage] = await Promise.all([
    provider.libraryList('playlists', undefined, { limit: 15 }),
    provider.libraryList('artists', undefined, { limit: 15 }),
    provider.libraryList('albums', undefined, { limit: 15 }),
    provider.libraryList('songs', undefined, { limit: 15 }),
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
  const trackPages = new Relationships<TrackRef>(notify, isCurrent, { maxBytes: options.relationshipCache?.tracksMaxBytes ?? 48 * 1024 * 1024, maxEntries: options.relationshipCache?.maxEntries ?? 512 })
  const albumPages = new Relationships<AlbumRef>(notify, isCurrent, { maxBytes: options.relationshipCache?.albumsMaxBytes ?? 16 * 1024 * 1024, maxEntries: options.relationshipCache?.maxEntries ?? 512 })
  // Artist refs come from the bounded library, while albums remain owned by their LFU entries.
  const discoveredAlbum = (key: LocalKey): AlbumRef | undefined => {
    for (const artist of typedArtists) { const found = albumPages.snapshot(artist.key)?.find((item) => item.key === key); if (found !== undefined) return found }
    return undefined
  }
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
  const album = (key: LocalKey): AlbumRef | undefined => typedAlbums.find((item) => item.key === key) ?? discoveredAlbum(key); const artist = (key: LocalKey): ArtistRef | undefined => typedArtists.find((item) => item.key === key); const playlist = (key: LocalKey): PlaylistRef | undefined => typedPlaylists.find((item) => item.key === key)
  const loadTracksResult = async (ref: AlbumRef | PlaylistRef, options?: NavigationLoadOptions): Promise<{ readonly items: readonly TrackRef[]; readonly complete: boolean }> => {
    if (navigationLoadAborted(options)) throw new DOMException('Navigation ended', 'AbortError')
    const result = await trackPages.loadResult(`${ref.kind}:${ref.key}`, options?.limit ?? Infinity, options?.priority ?? 'high', async (cursor, limit, signal) => {
      if (provider.relatedTracksPage !== undefined) return provider.relatedTracksPage(ref, { cursor, limit, signal, priority: options?.priority })
      return { items: await provider.relatedTracks(ref), next: null, total: null }
    })
    remember(result.items)
    return result
  }
  const loadTracks = async (ref: AlbumRef | PlaylistRef, options?: NavigationLoadOptions): Promise<readonly TrackRef[]> => (await loadTracksResult(ref, options)).items
  const source: NavigationDataSource = {
    albums: typedAlbums, artists: typedArtists, genres: [] satisfies readonly GenreRef[], playlists: typedPlaylists, songs: typedSongs, stations,
    get libraryStatus() { return status },
    subscribe(listener) { sourceListeners.add(listener); return () => { sourceListeners.delete(listener) } },
    getRevision: () => revision,
    rememberTracks: (tracks) => { remember(tracks) }, trackByKey: (key) => knownTracks.get(key) ?? null,
    clearRelationships: () => { trackPages.clear(); albumPages.clear() },
    tracksSnapshot: (kind, key) => trackPages.snapshot(`${kind}:${key}`),
    tracksFailed: (kind, key) => trackPages.failed(`${kind}:${key}`),
    tracksForAlbumRef: loadTracks,
    tracksForAlbum: async (key, options) => { const ref = album(key); if (ref === undefined) throw new Error('Album details expired. Open the artist and try again.'); return loadTracks(ref, options) },
    tracksForPlaylist: async (key, options) => { const ref = playlist(key); return ref === undefined ? [] : loadTracks(ref, options) },
    artistAlbumsSnapshot: (key) => albumPages.snapshot(key),
    artistAlbumsFailed: (key) => albumPages.failed(key),
    albumsForArtist: async (key, options) => {
      const ref = artist(key)
      if (ref === undefined || navigationLoadAborted(options)) return []
      return albumPages.load(key, options?.limit ?? Infinity, options?.priority ?? 'high', async (cursor, limit, signal) => {
        if (provider.relatedAlbumsPage !== undefined) return provider.relatedAlbumsPage(ref, { cursor, limit, signal, priority: options?.priority })
        return { items: await provider.relatedAlbums(ref, { signal }), next: null, total: null }
      }, (item) => item.key)
    },
    tracksForArtist: async (key, options) => {
      const ref = artist(key)
      if (ref === undefined || navigationLoadAborted(options)) return []
      const target = options?.limit ?? Infinity
      // A child may exceed the retention budget. Its request-local result and
      // completion survive eviction while this one All request slices it.
      let activeAlbum: { readonly key: LocalKey; readonly items: readonly TrackRef[]; readonly complete: boolean } | undefined
      return trackPages.load(`artist:${key}`, target, options?.priority ?? 'high', async (cursor, limit, signal) => {
        if (provider.artistTracksPage !== undefined) return provider.artistTracksPage(ref, { cursor, limit: options?.priority === 'low' ? 30 : limit, signal, priority: options?.priority })
        // A flattened cursor is the number of albums already fully consumed. Later
        // album samples never appear before the preceding album is complete.
        const [index = 0, consumed = 0] = cursor === undefined ? [0, 0] : cursor.split(':').map(Number)
        const albums = await source.albumsForArtist(key, { ...options, limit: index + 1 })
        const nextAlbum = albums[index]
        if (nextAlbum === undefined) return { items: [], next: null, total: null }
        if (activeAlbum?.key !== nextAlbum.key || !activeAlbum.complete && activeAlbum.items.length < consumed + limit) {
          const result = await loadTracksResult(nextAlbum, { ...options, limit: Number.isFinite(target) ? consumed + limit : Infinity })
          activeAlbum = { key: nextAlbum.key, ...result }
        }
        const items = activeAlbum.items.slice(consumed, consumed + limit)
        const offset = consumed + items.length
        const completed = activeAlbum.complete && offset >= activeAlbum.items.length
        return { items, next: completed ? `${index + 1}:0` : `${index}:${offset}`, total: null }
      })
    },
    prefetchArtist: async (key) => {
      const albums = await source.albumsForArtist(key, { priority: 'low', limit: 15 })
      // Sequential requests respect album order and avoid flooding MusicKit's queue.
      for (const ref of albums.slice(0, 5)) await loadTracks(ref, { priority: 'low', limit: 5 })
      await source.tracksForArtist?.(key, { priority: 'low', limit: provider.artistTracksPage === undefined ? 15 : 30 })
    },
    albumsForGenre: () => [], artistsForGenre: () => [], tracksForGenre: () => [],
  }
  const collections: Record<NavigationLibraryCollection, Entity[]> = { playlists: typedPlaylists, artists: typedArtists, albums: typedAlbums, songs: typedSongs }
  const libraryPages = new Map<NavigationLibraryCollection, Promise<void>>()
  const pageCounts = new Map<NavigationLibraryCollection, number>()
  /** Background and foreground consumers share one continuation request per collection. */
  const loadLibraryPage = (kind: NavigationLibraryCollection, priority: 'low' | 'high'): Promise<void> => {
    const pending = libraryPages.get(kind)
    if (pending !== undefined) return pending
    const cursor = firstByKind[kind].next
    if (cursor === null || !isCurrent()) return Promise.resolve()
    const work = (async () => {
      try {
        // Yield so a selected destination can enter the provider queue first.
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
        if (!isCurrent()) return
        const page = await provider.libraryList(kind, cursor, { priority })
        if (!isCurrent()) return
        const count = (pageCounts.get(kind) ?? 1) + 1
        if (count > 1000 || page.next === cursor) throw new Error('Music library pagination did not terminate')
        const expectedKind = kind === 'songs' ? 'track' : kind.slice(0, -1)
        collections[kind].push(...page.items.filter((item) => item.kind === expectedKind))
        pageCounts.set(kind, count)
        firstByKind[kind] = page
        status[kind] = { loaded: collections[kind].length, state: page.next === null ? 'complete' : 'loading' }
        notify()
      } catch (error) {
        if (isCurrent()) {
          status[kind] = { loaded: collections[kind].length, state: 'error' }
          notify()
          console.warn(`${provider.displayName} ${kind} sync stopped before completion`)
        }
        throw error
      } finally { libraryPages.delete(kind) }
    })()
    libraryPages.set(kind, work)
    return work
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
  const libraryLoads = new Map<NavigationLibraryCollection, Promise<void>>()
  source.ensureLibrary = (kind) => {
    if (firstByKind[kind].next === null) return Promise.resolve()
    let work = libraryLoads.get(kind)
    if (work === undefined) {
      status[kind] = { loaded: collections[kind].length, state: 'loading' }
      work = (async () => {
        try { while (firstByKind[kind].next !== null && isCurrent()) await loadLibraryPage(kind, 'high') }
        catch { /* The visible partial collection retains its error and can retry on reentry. */ }
        finally { libraryLoads.delete(kind) }
      })()
      libraryLoads.set(kind, work)
    }
    return work
  }
  const completion = (async () => {
    const stations = loadStations()
    const kinds = ['playlists', 'artists', 'albums', 'songs'] as const
    // One low-priority page per collection per round keeps root counts moving
    // fairly. This hydrates current library metadata, never every relationship.
    while (isCurrent()) {
      let continued = false
      for (const kind of kinds) {
        if (firstByKind[kind].next === null || status[kind].state === 'error') continue
        continued = true
        await loadLibraryPage(kind, 'low').catch(() => undefined)
      }
      if (!continued) break
    }
    await stations
  })()
  return { source, completion }
}
