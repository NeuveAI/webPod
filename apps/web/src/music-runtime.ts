import {
  createAppleProvider,
  createFixtureProvider,
  APPLE_SUPPORTS,
  type AlbumRef,
  type ArtistRef,
  type Entity,
  type GenreRef,
  type LocalKey,
  type MusicProvider,
  type PlaylistRef,
  type TrackRef,
} from '@webpod/providers'
import type { NavigationDataSource } from '@webpod/panel'

export type MusicRuntimeMode = 'fixture' | 'apple'
export type MusicRuntimePhase = 'fixture' | 'signed-out' | 'signing-in' | 'authorized' | 'error'
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
  if (queryValue === 'apple' || queryValue === 'fixture') return queryValue
  return configuredValue === 'apple' ? 'apple' : 'fixture'
}

const fixtureProvider = createFixtureProvider({ supports: APPLE_SUPPORTS })
const emptySource: NavigationDataSource = {
  albums: [], artists: [], genres: [], playlists: [], songs: [], stations: [],
  trackByKey: () => null, tracksForAlbum: () => [], tracksForPlaylist: () => [], albumsForArtist: () => [],
  albumsForGenre: () => [], artistsForGenre: () => [], tracksForGenre: () => [],
}

function fixtureSource(): NavigationDataSource {
  const catalog = fixtureProvider.catalog
  return {
    albums: catalog.albums, artists: catalog.artists, genres: catalog.genres, playlists: catalog.playlists, songs: catalog.tracks, stations: catalog.stations,
    trackByKey: (key) => catalog.tracks.find((track) => track.key === key) ?? null,
    tracksForAlbum: (key) => catalog.tracksByAlbum.get(key) ?? [], tracksForPlaylist: (key) => catalog.tracksByPlaylist.get(key) ?? [],
    albumsForArtist: (key) => { const artist = catalog.artists.find((item) => item.key === key); return artist === undefined ? [] : catalog.albums.filter((album) => album.artistName === artist.name) },
    albumsForGenre: (key) => { const genre = catalog.genres.find((item) => item.key === key); return genre === undefined ? [] : catalog.albums.filter((album) => catalog.genreByAlbum.get(album.key)?.key === genre.key) },
    artistsForGenre(key) { const names = new Set(this.albumsForGenre(key).map((album) => album.artistName)); return catalog.artists.filter((artist) => names.has(artist.name)) },
    tracksForGenre(key) { return this.albumsForGenre(key).flatMap((album) => catalog.tracksByAlbum.get(album.key) ?? []) },
  }
}

const fixtureSnapshot: MusicRuntimeSnapshot = { requestedMode: 'fixture', activeMode: 'fixture', phase: 'fixture', provider: fixtureProvider, source: fixtureSource(), message: null }
let snapshot = fixtureSnapshot
let appleProvider: ReturnType<typeof createAppleProvider> | null = null
const listeners = new Set<() => void>()
const publish = (next: MusicRuntimeSnapshot): void => { snapshot = next; for (const listener of listeners) listener() }

async function all(provider: MusicProvider, kind: Parameters<MusicProvider['libraryList']>[0]): Promise<readonly Entity[]> {
  const items: Entity[] = []; let cursor: string | null = null; let pages = 0
  do { const result: Awaited<ReturnType<MusicProvider['libraryList']>> = await provider.libraryList(kind, cursor ?? undefined); items.push(...result.items); cursor = result.next; pages += 1; if (pages > 1_000) throw new Error('Apple Music pagination did not terminate') } while (cursor !== null)
  return items
}

async function appleSource(provider: MusicProvider): Promise<NavigationDataSource> {
  const [playlists, artists, albums, songs, stations] = await Promise.all([all(provider, 'playlists'), all(provider, 'artists'), all(provider, 'albums'), all(provider, 'songs'), provider.stationsList()])
  const typedPlaylists = playlists.filter((item): item is PlaylistRef => item.kind === 'playlist'); const typedArtists = artists.filter((item): item is ArtistRef => item.kind === 'artist'); const typedAlbums = albums.filter((item): item is AlbumRef => item.kind === 'album'); const typedSongs = songs.filter((item): item is TrackRef => item.kind === 'track')
  const album = (key: LocalKey): AlbumRef | undefined => typedAlbums.find((item) => item.key === key); const artist = (key: LocalKey): ArtistRef | undefined => typedArtists.find((item) => item.key === key); const playlist = (key: LocalKey): PlaylistRef | undefined => typedPlaylists.find((item) => item.key === key)
  return {
    albums: typedAlbums, artists: typedArtists, genres: [] satisfies readonly GenreRef[], playlists: typedPlaylists, songs: typedSongs, stations,
    trackByKey: (key) => typedSongs.find((track) => track.key === key) ?? null,
    tracksForAlbum: async (key) => { const ref = album(key); return ref === undefined ? [] : provider.relatedTracks(ref) },
    tracksForPlaylist: async (key) => { const ref = playlist(key); return ref === undefined ? [] : provider.relatedTracks(ref) },
    albumsForArtist: async (key) => { const ref = artist(key); return ref === undefined ? [] : provider.relatedAlbums(ref) },
    albumsForGenre: () => [], artistsForGenre: () => [], tracksForGenre: () => [],
  }
}

/** Selects the real provider only when explicitly requested; every failure returns to deterministic fixture data. */
export async function selectMusicRuntime(mode: MusicRuntimeMode): Promise<void> {
  if (mode === 'fixture') { publish(fixtureSnapshot); return }
  const provider = appleProvider ?? createAppleProvider(); appleProvider = provider
  publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider, source: emptySource, message: null })
  try {
    await provider.configure()
    if (provider.session === null) { publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signed-out', provider, source: emptySource, message: null }); return }
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider, source: await appleSource(provider), message: null })
  } catch {
    publish({ ...fixtureSnapshot, requestedMode: 'apple', phase: 'error', message: 'Apple Music is unavailable. The demo library is active.' })
  }
}

/** Runs MusicKit authorization from a user gesture and hydrates provider-neutral navigation data. */
export async function authorizeAppleRuntime(): Promise<void> {
  const provider = appleProvider ?? createAppleProvider(); appleProvider = provider
  publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider, source: emptySource, message: null })
  try { await provider.configure(); await provider.authorize(); publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider, source: await appleSource(provider), message: null }) }
  catch { publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider, source: emptySource, message: 'Apple Music sign-in did not complete.' }) }
}

/** Invalidates the MusicKit user session and returns to the signed-out Apple frame. */
export async function signOutAppleRuntime(): Promise<void> { if (appleProvider === null) return; try { await appleProvider.unauthorize() } finally { publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signed-out', provider: appleProvider, source: emptySource, message: null }) } }
export const musicRuntime = { getSnapshot: (): MusicRuntimeSnapshot => snapshot, subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } } }
