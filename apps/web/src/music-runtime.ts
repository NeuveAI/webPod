import {
  createAppleProvider,
  createSpotifyProvider,
  browserAppleProviderOptions,
  type AlbumRef,
  type ArtistRef,
  type Entity,
  type GenreRef,
  type LocalKey,
  type MusicProvider,
  type PlaylistRef,
  type StationRef,
  type TrackRef,
} from '@webpod/providers'
import type { NavigationDataSource, NavigationLibraryCollection, NavigationLibraryCollectionStatus } from '@webpod/panel'
import { applePlaybackDiagnostics } from './apple-playback-diagnostics'
import { bootstrapStickerCollection, restoreStickerSession, startStickerRuntime, disconnectStickerMusic } from './sticker-runtime'

export type MusicRuntimeMode = 'apple' | 'spotify'
export type MusicRuntimePhase = 'signed-out' | 'signing-in' | 'authorized' | 'permission-denied' | 'error'
export interface MusicRuntimeSnapshot {
  readonly requestedMode: MusicRuntimeMode
  readonly activeMode: MusicRuntimeMode
  readonly phase: MusicRuntimePhase
  readonly provider: MusicProvider
  readonly source: NavigationDataSource
  readonly message: string | null
}

/** Resolves the explicit development query override ahead of the safe build-time default. */
export function resolveMusicRuntimeMode(queryValue: string | null, configuredValue: string | undefined): MusicRuntimeMode {
  return (queryValue ?? configuredValue) === 'spotify' ? 'spotify' : 'apple'
}

const emptySource: NavigationDataSource = {
  albums: [], artists: [], genres: [], playlists: [], songs: [], stations: [],
  trackByKey: () => null, tracksForAlbum: () => [], tracksForPlaylist: () => [], albumsForArtist: () => [],
  albumsForGenre: () => [], artistsForGenre: () => [], tracksForGenre: () => [],
}

const appleProviderOptions = () => ({
  ...browserAppleProviderOptions(),
  ...(import.meta.env.DEV ? { playbackDiagnostics: applePlaybackDiagnostics } : {}),
})
interface RuntimeState {
  readonly provider: ReturnType<typeof createAppleProvider>
  readonly spotify: MusicProvider
  snapshot: MusicRuntimeSnapshot
  operation: number
  readonly listeners: Set<() => void>
}
function createRuntimeState(): RuntimeState {
  const provider = createAppleProvider(appleProviderOptions())
  return { provider, spotify: createSpotifyProvider(), snapshot: { requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider, source: emptySource, message: null }, operation: 0, listeners: new Set() }
}
// MusicKit caches its API service against the store from its first configure.
// Preserve the provider AND operation state so HMR cannot split authentication,
// API credentials, pending library work, and React subscriptions across runtimes.
const runtimeState = (import.meta.hot?.data['musicRuntimeState'] as RuntimeState | undefined) ?? createRuntimeState()
if (import.meta.hot) import.meta.hot.data['musicRuntimeState'] = runtimeState
const publish = (next: MusicRuntimeSnapshot): void => { runtimeState.snapshot = next; for (const listener of runtimeState.listeners) listener() }
const failureMessage = (stage: string, cause: unknown): string => {
  const detail = cause instanceof Error ? cause.message : 'Unknown failure'
  const safeDetail = detail.replace(/[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[redacted token]')
  console.error(`Apple Music ${stage} failed: ${safeDetail}`)
  return `Apple Music ${stage} failed: ${safeDetail}`
}

/** Stops an outgoing provider before its controls and status leave the screen. */
export async function quiesceMusicProvider(provider: MusicProvider): Promise<void> {
  if (!provider.supports('transport') || provider.session?.status !== 'authorized') return
  await provider.pause()
}

type ProgressiveAppleSource = { readonly source: NavigationDataSource; readonly completion: Promise<void> }
const navigationLoadAborted = (options: { readonly signal?: AbortSignal } | undefined): boolean => options?.signal?.aborted ?? false

/** Loads one useful page per collection, then streams all remaining pages into the same source. */
export async function createProgressiveAppleSource(provider: MusicProvider, isCurrent: () => boolean = () => true): Promise<ProgressiveAppleSource> {
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

/** Selects the production Apple Music runtime. */
export async function selectMusicRuntime(mode: MusicRuntimeMode): Promise<void> {
  const selectedOperation = ++runtimeState.operation
  if (mode === 'spotify') { await selectSpotifyRuntime(selectedOperation); return }
  const provider = runtimeState.provider
  publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider, source: emptySource, message: null })
  try {
    restoreStickerSession(provider)
    await provider.configure()
    if (selectedOperation !== runtimeState.operation) return
    if (provider.session?.status !== 'authorized') { restoreStickerSession(provider); publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signed-out', provider, source: emptySource, message: null }); return }
    restoreStickerSession(provider)
    startStickerRuntime(provider, (refresh) => bootstrapStickerCollection(provider, refresh))
    const { source, completion } = await createProgressiveAppleSource(provider, () => selectedOperation === runtimeState.operation); if (selectedOperation !== runtimeState.operation) return
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider, source, message: null })
    void completion
  } catch (cause) {
    if (selectedOperation !== runtimeState.operation) return
    const message = failureMessage('library loading', cause)
    try {
      await quiesceMusicProvider(provider)
    } catch (pauseCause) {
      if (selectedOperation === runtimeState.operation) publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider, source: emptySource, message: failureMessage('runtime switch', pauseCause) })
      return
    }
    if (selectedOperation === runtimeState.operation) publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider, source: emptySource, message })
  }
}

/** Restore the saved session once when the landing is the first route opened. */
export function ensureMusicRuntime(): void {
  if (runtimeState.operation !== 0) return
  const query = new URLSearchParams(window.location.search)
  let saved: string | null = null
  try { saved = localStorage.getItem('webpod-music-provider') } catch { /* Storage is optional. */ }
  const mode = resolveMusicRuntimeMode(query.get('music'), saved ?? undefined)
  if (query.has('music')) {
    const url = new URL(window.location.href); url.searchParams.delete('music'); window.history.replaceState(window.history.state, '', url)
    rememberProvider(mode)
  }
  void selectMusicRuntime(mode)
}

/** Runs MusicKit authorization from a user gesture and hydrates provider-neutral navigation data. */
export async function authorizeAppleRuntime(): Promise<void> {
  const selectedOperation = ++runtimeState.operation
  const provider = runtimeState.provider
  rememberProvider('apple')
  restoreStickerSession(provider)
  publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider, source: emptySource, message: null })
  try {
    try { await provider.authorize() } catch (cause) {
      if (selectedOperation !== runtimeState.operation) return
      const denied = provider.appleSessionState.status === 'permission-denied'
      if (denied) disconnectStickerMusic(provider)
      publish({ requestedMode: 'apple', activeMode: 'apple', phase: denied ? 'permission-denied' : 'error', provider, source: emptySource, message: failureMessage('authorization', cause) })
      return
    }
    if (selectedOperation !== runtimeState.operation) return
    startStickerRuntime(provider, (refresh) => bootstrapStickerCollection(provider, refresh))
    try {
      const { source, completion } = await createProgressiveAppleSource(provider, () => selectedOperation === runtimeState.operation); if (selectedOperation !== runtimeState.operation) return
      publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider, source, message: null })
      void completion
    } catch (cause) {
      if (selectedOperation !== runtimeState.operation) return
      publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider, source: emptySource, message: failureMessage('library loading', cause) })
    }
  } catch (cause) {
    if (selectedOperation !== runtimeState.operation) return
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider, source: emptySource, message: failureMessage('configuration', cause) })
  }
}

/** Invalidates the MusicKit user session and returns to the signed-out Apple frame. */
export async function signOutAppleRuntime(): Promise<void> {
  const selectedOperation = ++runtimeState.operation
  if (runtimeState.snapshot.activeMode === 'spotify') {
    const provider = runtimeState.spotify
    try { await provider.unauthorize() } catch {
      publish({ ...runtimeState.snapshot, phase: 'error', message: 'Could not sign out of Spotify. Please try again.' })
      return
    }
    rememberProvider('apple')
    if (selectedOperation === runtimeState.operation) publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'signed-out', provider, source: emptySource, message: null })
    return
  }
  const provider = runtimeState.provider
  publish({ ...runtimeState.snapshot, phase: 'signing-in', message: null })
  try {
    await provider.unauthorize()
    if (selectedOperation !== runtimeState.operation) return
    disconnectStickerMusic(provider)
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signed-out', provider, source: emptySource, message: null })
  } catch (cause) {
    if (selectedOperation !== runtimeState.operation) return
    publish({ ...runtimeState.snapshot, phase: 'error', message: failureMessage('sign-out', cause) })
  }
}
export const musicRuntime = { getSnapshot: (): MusicRuntimeSnapshot => runtimeState.snapshot, subscribe(listener: () => void): () => void { runtimeState.listeners.add(listener); return () => { runtimeState.listeners.delete(listener) } } }

function rememberProvider(mode: MusicRuntimeMode): void {
  try { localStorage.setItem('webpod-music-provider', mode) } catch { /* Storage is optional. */ }
}

/** Restores Spotify without initializing MusicKit or Apple-only sticker import. */
async function selectSpotifyRuntime(operation: number): Promise<void> {
  const provider = runtimeState.spotify
  publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'signing-in', provider, source: emptySource, message: null })
  try {
    await provider.configure()
    if (operation !== runtimeState.operation) return
    if (provider.session?.status !== 'authorized') {
      publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'signed-out', provider, source: emptySource, message: null })
      return
    }
    rememberProvider('spotify')
    const { source, completion } = await createProgressiveAppleSource(provider, () => operation === runtimeState.operation)
    if (operation !== runtimeState.operation) return
    publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'authorized', provider, source, message: null })
    void completion
  } catch (cause) {
    if (operation !== runtimeState.operation) return
    publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'error', provider, source: emptySource, message: cause instanceof Error ? cause.message : 'Could not connect to Spotify. Please try again.' })
  }
}
