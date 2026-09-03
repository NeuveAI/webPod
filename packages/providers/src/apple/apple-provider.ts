import type { Capability } from '../capability.ts'
import type { Cursor, Entity, LibraryKind, Page, PlaybackState, ProgressTick, QueueSnapshot, SearchResults, Session, Unsubscribe } from '../domain.ts'
import { CapabilityUnsupportedError, InvalidCursorError, NotAuthorizedError, NotImplementedError } from '../errors.ts'
import type { AlbumRef, ArtistRef, Artwork, LocalKey, PlaylistRef, StationRef, TrackRef } from '../identity.ts'
import { mintLocalKey } from '../identity.ts'
import type { MusicProvider } from '../provider.ts'
import { APPLE_SUPPORTS, APPLE_UNSUPPORTED_REASONS } from './matrix.ts'

export const MUSICKIT_SCRIPT_URL = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js' as const
export const APPLE_DEVELOPER_TOKEN_PATH = '/api/apple/developer-token' as const

type JsonRecord = Readonly<Record<string, unknown>>
export interface MusicKitApiLike { music(path: string, parameters?: Readonly<Record<string, string>>): Promise<unknown> }
export interface MusicKitQueueLike { readonly items?: readonly unknown[]; readonly position?: number }
export interface MusicKitInstanceLike {
  readonly api: MusicKitApiLike; readonly isAuthorized: boolean; readonly storefrontId?: string; readonly storefrontCountryCode?: string
  readonly nowPlayingItem?: unknown; readonly currentPlaybackTime?: number; readonly currentPlaybackDuration?: number; readonly playbackState?: number; readonly queue?: MusicKitQueueLike
  readonly previewOnly?: boolean; volume: number; shuffleMode: number; repeatMode: number
  authorize(): Promise<string | void>; unauthorize(): Promise<void>; setQueue(options: Readonly<Record<string, unknown>>): Promise<unknown>
  play(): Promise<void>; pause(): Promise<void>; skipToNextItem(): Promise<void>; skipToPreviousItem(): Promise<void>; seekToTime(seconds: number): Promise<void>
  playLater(options: Readonly<Record<string, unknown>>): Promise<unknown>; playNext(options: Readonly<Record<string, unknown>>): Promise<unknown>
  addEventListener(name: string, callback: (event: unknown) => void): void; removeEventListener(name: string, callback: (event: unknown) => void): void
}
export interface MusicKitGlobalLike {
  configure(config: { readonly developerToken: string; readonly app: { readonly name: string; readonly build: string } }): Promise<MusicKitInstanceLike | void>
  getInstance(): MusicKitInstanceLike
  readonly PlaybackStates?: Readonly<Record<string, number>>; readonly PlayerShuffleMode?: Readonly<Record<string, number>>; readonly PlayerRepeatMode?: Readonly<Record<string, number>>
}
export interface AppleProviderOptions {
  readonly loadMusicKit: () => Promise<MusicKitGlobalLike>
  readonly fetchDeveloperToken: () => Promise<{ readonly token: string; readonly expiresAt: number }>
  readonly appName?: string; readonly appBuild?: string
}
export type AppleSessionState =
  | { readonly status: 'signed-out' }
  | { readonly status: 'signing-in' }
  | { readonly status: 'authorized'; readonly session: Session }
  | { readonly status: 'permission-denied'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }
export interface AppleMusicProvider extends MusicProvider {
  readonly appleSessionState: AppleSessionState
  onAppleSessionStateChange(callback: (state: AppleSessionState) => void): Unsubscribe
}

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Apple ${context} response is invalid`)
  return value as JsonRecord
}
const asText = (value: unknown): string | undefined => typeof value === 'string' && value !== '' ? value : undefined
const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const asBoolean = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value : undefined
const asList = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []
function payload(value: unknown): JsonRecord { const outer = record(value, 'API'); const data = outer['data']; return typeof data === 'object' && data !== null && !Array.isArray(data) ? record(data, 'API payload') : outer }
function resources(value: unknown): readonly unknown[] { return asList(payload(value)['data']) }

function artwork(attributes: JsonRecord): Artwork | undefined {
  const value = attributes['artwork']; if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = record(value, 'artwork'); const template = asText(raw['url']); if (template === undefined || !template.includes('{w}') || !template.includes('{h}')) return undefined
  const width = asNumber(raw['width']); const height = asNumber(raw['height'])
  return width === undefined || height === undefined ? { kind: 'template', template } : { kind: 'template', template, sizes: [{ url: template, w: width, h: height }] }
}
function identityCache(): (type: string, catalogId: string, libraryId?: string) => LocalKey {
  const keys = new Map<string, LocalKey>()
  return (type, catalogId, libraryId) => { const id = `${type}:${libraryId ?? catalogId}`; const known = keys.get(id); if (known !== undefined) return known; const key = mintLocalKey(); keys.set(id, key); return key }
}
function normalize(raw: unknown, keyFor: ReturnType<typeof identityCache>): Entity {
  const resource = record(raw, 'resource'); const id = asText(resource['id']); const type = asText(resource['type']); const attrs = record(resource['attributes'], 'attributes')
  if (id === undefined || type === undefined) throw new Error('Apple resource has no id or type')
  const library = type.startsWith('library-'); const playRaw = attrs['playParams']; const play = typeof playRaw === 'object' && playRaw !== null && !Array.isArray(playRaw) ? record(playRaw, 'play parameters') : {}
  const catalogId = asText(play['globalId']) ?? id; const libraryId = library ? id : undefined; const art = artwork(attrs); const key = keyFor(type.replace('library-', ''), catalogId, libraryId)
  const optional = <T>(value: T | undefined, name: string): object => value === undefined ? {} : { [name]: value }
  if (type === 'songs' || type === 'library-songs') {
    const title = asText(attrs['name']); const artistName = asText(attrs['artistName']); if (title === undefined || artistName === undefined) throw new Error('Apple song is missing metadata')
    return { kind: 'track', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), title, artistName, ...optional(asText(attrs['albumName']), 'albumName'), durationMs: asNumber(attrs['durationInMillis']) ?? 0, ...optional(art, 'artwork'), playable: asBoolean(attrs['playable']) ?? true, ...optional(asText(attrs['isrc']), 'isrc') } as TrackRef
  }
  if (type === 'albums' || type === 'library-albums') {
    const title = asText(attrs['name']); const artistName = asText(attrs['artistName']); if (title === undefined || artistName === undefined) throw new Error('Apple album is missing metadata')
    const year = Number(asText(attrs['releaseDate'])?.slice(0, 4)); return { kind: 'album', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), title, artistName, trackCount: asNumber(attrs['trackCount']) ?? 0, ...(Number.isInteger(year) && year > 0 ? { releaseYear: year } : {}), ...optional(art, 'artwork') } as AlbumRef
  }
  if (type === 'artists' || type === 'library-artists') { const name = asText(attrs['name']); if (name === undefined) throw new Error('Apple artist has no name'); return { kind: 'artist', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), name, ...optional(art, 'artwork') } as ArtistRef }
  if (type === 'playlists' || type === 'library-playlists') {
    const name = asText(attrs['name']); if (name === undefined) throw new Error('Apple playlist has no name'); const descriptionValue = attrs['description']; const description = typeof descriptionValue === 'object' && descriptionValue !== null ? asText(record(descriptionValue, 'description')['standard']) : undefined
    return { kind: 'playlist', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), name, ...optional(description, 'description'), trackCount: asNumber(attrs['trackCount']) ?? 0, editable: asBoolean(attrs['canEdit']) ?? false, ...optional(art, 'artwork') } as PlaylistRef
  }
  if (type === 'stations') { const name = asText(attrs['name']); if (name === undefined) throw new Error('Apple station has no name'); return { kind: 'station', key, provider: 'apple', catalogId, name, live: asBoolean(attrs['isLive']) ?? false, ...optional(art, 'artwork') } as StationRef }
  if (type === 'genres') { const name = asText(attrs['name']); if (name === undefined) throw new Error('Apple genre has no name'); return { kind: 'genre', key, provider: 'apple', catalogId, name } }
  throw new Error(`Apple resource type ${type} is unsupported`)
}
function unsupported(capability: Capability): never { throw new CapabilityUnsupportedError('apple', capability, APPLE_UNSUPPORTED_REASONS[capability] ?? 'This action is unavailable on Apple Music.') }

export function createAppleProvider(options?: AppleProviderOptions): AppleMusicProvider {
  const configuredOptions = options ?? browserAppleProviderOptions(); let kit: MusicKitGlobalLike | null = null; let music: MusicKitInstanceLike | null = null; let currentSession: Session | null = null
  let appleState: AppleSessionState = { status: 'signed-out' }
  let currentPlayback: PlaybackState = { status: 'idle', now: null, positionMs: 0, durationMs: 0, volume0to100: 100, shuffle: 'off', repeat: 'off' }
  const sessions = new Set<(value: Session | null) => void>(); const appleStates = new Set<(value: AppleSessionState) => void>(); const playback = new Set<(value: PlaybackState) => void>(); const progress = new Set<(value: ProgressTick) => void>(); const cursors = new Set<string>(); const keyFor = identityCache()
  const instance = (method: string): MusicKitInstanceLike => { if (music === null) throw new NotAuthorizedError('apple', method); return music }
  const authorized = (method: string): MusicKitInstanceLike => { const value = instance(method); if (!value.isAuthorized) throw new NotAuthorizedError('apple', method); return value }
  const emitAppleState = (value: AppleSessionState): void => { appleState = value; for (const listener of appleStates) listener(value) }
  const emitSession = (value: Session | null): void => { currentSession = value; for (const listener of sessions) listener(value); emitAppleState(value === null ? { status: 'signed-out' } : { status: 'authorized', session: value }) }
  const sessionOf = (value: MusicKitInstanceLike, user: string | null): Session => ({ provider: 'apple', status: 'authorized', userIdentifier: user, storefront: value.storefrontId ?? value.storefrontCountryCode ?? null, canPlay: value.previewOnly !== true, expiresAt: null })
  const stateOf = (value: MusicKitInstanceLike): PlaybackState => {
    const now = (() => { try { const item = value.nowPlayingItem === undefined ? null : normalize(value.nowPlayingItem, keyFor); return item?.kind === 'track' ? item : null } catch { return null } })()
    const raw = value.playbackState; const states = kit?.PlaybackStates; const status = raw === states?.['playing'] ? 'playing' : raw === states?.['paused'] ? 'paused' : raw === states?.['loading'] || raw === states?.['waiting'] ? 'loading' : now === null ? 'idle' : 'stopped'
    return { status, now, positionMs: Math.max(0, (value.currentPlaybackTime ?? 0) * 1_000), durationMs: Math.max(0, (value.currentPlaybackDuration ?? 0) * 1_000), volume0to100: Math.round(Math.min(1, Math.max(0, value.volume)) * 100), shuffle: value.shuffleMode === kit?.PlayerShuffleMode?.['songs'] ? 'songs' : value.shuffleMode === kit?.PlayerShuffleMode?.['albums'] ? 'albums' : 'off', repeat: value.repeatMode === kit?.PlayerRepeatMode?.['one'] ? 'one' : value.repeatMode === kit?.PlayerRepeatMode?.['all'] ? 'all' : 'off' }
  }
  const bind = (value: MusicKitInstanceLike): void => {
    const changed = (): void => { currentPlayback = stateOf(value); for (const listener of playback) listener(currentPlayback) }
    const tick = (): void => { const state = stateOf(value); for (const listener of progress) listener({ positionMs: state.positionMs, durationMs: state.durationMs, interpolated: false }) }
    for (const name of ['playbackStateDidChange', 'nowPlayingItemDidChange', 'queueItemsDidChange']) value.addEventListener(name, changed)
    value.addEventListener('playbackTimeDidChange', tick)
  }
  const api = async (path: string, parameters?: Readonly<Record<string, string>>): Promise<unknown> => authorized('api').api.music(path, parameters)
  const cursorPath = (cursor: Cursor | undefined, first: string): string => { if (cursor === undefined) return first; if (!cursors.delete(cursor)) throw new InvalidCursorError('apple', cursor); return cursor }
  const page = (response: unknown): Page<Entity> => { const body = payload(response); const next = asText(body['next']) ?? null; if (next !== null) cursors.add(next); const meta = body['meta']; const total = typeof meta === 'object' && meta !== null ? asNumber(record(meta, 'metadata')['total']) ?? null : null; return { items: resources(response).map((item) => normalize(item, keyFor)), next, total } }
  const storefront = (method: string): string => authorized(method).storefrontId ?? authorized(method).storefrontCountryCode ?? 'us'
  return {
    id: 'apple', displayName: 'Apple Music', supports: (capability) => APPLE_SUPPORTS[capability], unsupportedReason: (capability) => APPLE_SUPPORTS[capability] ? null : APPLE_UNSUPPORTED_REASONS[capability],
    async configure() { if (music !== null) return; kit = await configuredOptions.loadMusicKit(); const token = await configuredOptions.fetchDeveloperToken(); const result = await kit.configure({ developerToken: token.token, app: { name: configuredOptions.appName ?? 'webPod', build: configuredOptions.appBuild ?? 'local' } }); music = result ?? kit.getInstance(); bind(music); if (music.isAuthorized) emitSession(sessionOf(music, null)); currentPlayback = stateOf(music) },
    async authorize() { if (music === null) await this.configure(); emitAppleState({ status: 'signing-in' }); const value = instance('authorize'); try { const user = await value.authorize(); if (!value.isAuthorized || user === undefined) { const error = new NotAuthorizedError('apple', 'authorize'); emitAppleState({ status: 'permission-denied', message: error.message }); throw error } const session = sessionOf(value, user); emitSession(session); return session } catch (cause) { if (appleState.status !== 'permission-denied') emitAppleState({ status: 'error', message: cause instanceof Error ? cause.message : 'Apple Music sign-in failed' }); throw cause } },
    async unauthorize() { const value = instance('unauthorize'); await value.unauthorize(); emitSession(null) }, get session() { return currentSession }, onSessionChange(callback) { sessions.add(callback); return () => { sessions.delete(callback) } }, get appleSessionState() { return appleState }, onAppleSessionStateChange(callback) { appleStates.add(callback); return () => { appleStates.delete(callback) } },
    async search(query) { const types = query.kinds.map((kind) => kind === 'track' ? 'songs' : `${kind}s`).filter((kind) => kind !== 'stations'); const path = query.scope === 'library' ? '/v1/me/library/search' : `/v1/catalog/${storefront('search')}/search`; const response = await api(path, { term: query.term, types: (query.scope === 'library' ? types.map((type) => `library-${type}`) : types).join(','), limit: String(Math.min(25, Math.max(1, query.limit ?? 25))), ...(query.cursor === undefined ? {} : { offset: query.cursor }) }); const resultMap = record(payload(response)['results'], 'search results'); const entities: Entity[] = []; for (const section of Object.values(resultMap)) for (const item of resources(section)) entities.push(normalize(item, keyFor)); return { tracks: entities.filter((x): x is TrackRef => x.kind === 'track'), albums: entities.filter((x): x is AlbumRef => x.kind === 'album'), artists: entities.filter((x): x is ArtistRef => x.kind === 'artist'), playlists: entities.filter((x): x is PlaylistRef => x.kind === 'playlist'), stations: entities.filter((x): x is StationRef => x.kind === 'station'), next: null } satisfies SearchResults },
    async libraryList(kind, cursor) { const names: Record<LibraryKind, string | null> = { playlists: 'playlists', artists: 'artists', albums: 'albums', songs: 'songs', genres: null, composers: null }; const name = names[kind]; if (name === null) throw new NotImplementedError('apple', `libraryList(${kind}): Apple exposes no matching library collection endpoint`); return page(await api(cursorPath(cursor, `/v1/me/library/${name}`))) },
    async relatedTracks(ref) { const path = ref.libraryId === undefined ? `/v1/catalog/${storefront('relatedTracks')}/${ref.kind}s/${encodeURIComponent(ref.catalogId)}/tracks` : `/v1/me/library/${ref.kind}s/${encodeURIComponent(ref.libraryId)}/tracks`; return resources(await api(path)).map((item) => normalize(item, keyFor)).filter((item): item is TrackRef => item.kind === 'track') },
    async relatedAlbums(ref) { const path = ref.libraryId === undefined ? `/v1/catalog/${storefront('relatedAlbums')}/artists/${encodeURIComponent(ref.catalogId)}/albums` : `/v1/me/library/artists/${encodeURIComponent(ref.libraryId)}/albums`; return resources(await api(path)).map((item) => normalize(item, keyFor)).filter((item): item is AlbumRef => item.kind === 'album') },
    async libraryAdd() { throw new NotImplementedError('apple', 'libraryAdd (writes are out of scope)') }, async libraryRemove() { return unsupported('libraryRemove') }, async playlistCreate() { throw new NotImplementedError('apple', 'playlistCreate (writes are out of scope)') }, async playlistAddTracks() { throw new NotImplementedError('apple', 'playlistAddTracks (writes are out of scope)') }, async playlistRemoveTracks() { return unsupported('playlistRemoveTracks') }, async playlistReorder() { return unsupported('playlistReorder') },
    async play(target) { const value = authorized('play'); if (target !== undefined) { let descriptor: Readonly<Record<string, unknown>>; switch (target.kind) { case 'tracks': descriptor = { songs: target.tracks.map((track) => track.catalogId), startPosition: target.startIndex ?? 0 }; break; case 'album': descriptor = { album: target.album.catalogId }; break; case 'playlist': descriptor = { playlist: target.playlist.catalogId }; break; case 'station': descriptor = { station: target.station.catalogId }; break } await value.setQueue(descriptor) } await value.play() }, async pause() { await instance('pause').pause() }, async skip(direction, count = 1) { const value = instance('skip'); for (let index = 0; index < Math.max(1, count); index += 1) await (direction === 'next' ? value.skipToNextItem() : value.skipToPreviousItem()) }, async seek(positionMs) { const value = instance('seek'); await value.seekToTime(Math.min(Math.max(0, value.currentPlaybackDuration ?? 0), Math.max(0, positionMs / 1_000))) }, async setVolume(level) { instance('setVolume').volume = Math.min(100, Math.max(0, level)) / 100 }, async setShuffle(mode) { instance('setShuffle').shuffleMode = kit?.PlayerShuffleMode?.[mode] ?? 0 }, async setRepeat(mode) { instance('setRepeat').repeatMode = kit?.PlayerRepeatMode?.[mode] ?? 0 }, get playback() { return currentPlayback }, onPlaybackChange(callback) { playback.add(callback); return () => { playback.delete(callback) } }, onProgress(callback) { progress.add(callback); return () => { progress.delete(callback) } },
    async queueRead() { const queue = instance('queueRead').queue; const items = (queue?.items ?? []).map((item) => normalize(item, keyFor)).filter((item): item is TrackRef => item.kind === 'track'); const position = Math.max(0, queue?.position ?? 0); return { now: currentPlayback.now, history: items.slice(0, position), next: items.slice(position + 1) } satisfies QueueSnapshot }, async queueAppend(tracks) { await instance('queueAppend').playLater({ songs: tracks.map((track) => track.catalogId) }) }, async queueInsertNext(tracks) { await instance('queueInsertNext').playNext({ songs: tracks.map((track) => track.catalogId) }) }, async queueRemove() { return unsupported('queueRemove') }, async queueReorder() { return unsupported('queueReorder') },
    async stationsList() { const response = await api(`/v1/catalog/${storefront('stationsList')}/stations`); return resources(response).map((item) => normalize(item, keyFor)).filter((item): item is StationRef => item.kind === 'station') },
    async stationStart(seed) { let station: StationRef; if (seed.type === 'track') { const response = await api(`/v1/catalog/${storefront('stationStart')}/songs/${encodeURIComponent(seed.ref)}/station`); const entity = normalize(resources(response)[0], keyFor); if (entity.kind !== 'station') throw new Error('Apple station response is invalid'); station = entity } else { station = { kind: 'station', key: keyFor('stations', seed.ref), provider: 'apple', catalogId: seed.ref, name: 'Apple Music station', live: false } } const value = instance('stationStart'); await value.setQueue({ station: station.catalogId }); await value.play(); return station },
    async lyrics() { return unsupported('lyrics') }, async ratingSet() { throw new NotImplementedError('apple', 'ratingSet (writes are out of scope)') }, async saveToggle() { throw new NotImplementedError('apple', 'saveToggle (writes are out of scope)') },
  }
}

export function browserAppleProviderOptions(): AppleProviderOptions { return { loadMusicKit: loadMusicKitScript, fetchDeveloperToken: fetchAppleDeveloperToken } }
export async function fetchAppleDeveloperToken(fetcher: typeof fetch = fetch): Promise<{ readonly token: string; readonly expiresAt: number }> { const response = await fetcher(APPLE_DEVELOPER_TOKEN_PATH, { credentials: 'same-origin', headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(`Apple Music token service returned ${String(response.status)}`); const value = record(await response.json(), 'token service'); const token = asText(value['token']); const expiresAt = asNumber(value['expiresAt']); if (token === undefined || expiresAt === undefined) throw new Error('Apple Music token service response is invalid'); return { token, expiresAt } }
export async function loadMusicKitScript(documentRef: Document = document): Promise<MusicKitGlobalLike> {
  const existing = (globalThis as { MusicKit?: MusicKitGlobalLike }).MusicKit; if (existing !== undefined) return existing
  return new Promise((resolve, reject) => {
    const found = documentRef.querySelector<HTMLScriptElement>(`script[src="${MUSICKIT_SCRIPT_URL}"]`)
    const script = found ?? documentRef.createElement('script')
    const cleanup = (): void => { documentRef.removeEventListener('musickitloaded', loaded); script.removeEventListener('error', failed) }
    const loaded = (): void => { cleanup(); const value = (globalThis as { MusicKit?: MusicKitGlobalLike }).MusicKit; if (value === undefined) reject(new Error('MusicKit loaded without its global')); else resolve(value) }
    const failed = (): void => { cleanup(); reject(new Error('MusicKit script could not be loaded')) }
    documentRef.addEventListener('musickitloaded', loaded, { once: true }); script.addEventListener('error', failed, { once: true })
    if (found === null) { script.src = MUSICKIT_SCRIPT_URL; script.async = true; documentRef.head.append(script) }
  })
}
