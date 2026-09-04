import type { Capability } from '../capability.ts'
import type { Cursor, Entity, LibraryKind, Page, PlaybackState, PlayTarget, ProgressTick, QueueSnapshot, SearchResults, Session, Unsubscribe } from '../domain.ts'
import { CapabilityUnsupportedError, InvalidCursorError, NotAuthorizedError, NotImplementedError } from '../errors.ts'
import type { AlbumRef, ArtistRef, Artwork, LocalKey, PlaylistRef, StationRef, TrackRef } from '../identity.ts'
import { mintLocalKey } from '../identity.ts'
import type { MusicProvider } from '../provider.ts'
import { APPLE_SUPPORTS, APPLE_UNSUPPORTED_REASONS } from './matrix.ts'

export const MUSICKIT_SCRIPT_URL = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js' as const
export const APPLE_DEVELOPER_TOKEN_PATH = '/api/apple/developer-token' as const
const APPLE_LIBRARY_PAGE_SIZE = 100
const APPLE_PLAYBACK_QUEUE_LIMIT = 100
export const APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS = 60_000
const APPLE_DEVELOPER_TOKEN_REFRESH_RETRY_MS = 10_000

type JsonRecord = Readonly<Record<string, unknown>>
type MusicKitParameters = Readonly<Record<string, string | number>>
export interface MusicKitLibraryApiLike {
  albums(parameters?: MusicKitParameters): Promise<unknown>
  artists(parameters?: MusicKitParameters): Promise<unknown>
  playlists(parameters?: MusicKitParameters): Promise<unknown>
  songs(parameters?: MusicKitParameters): Promise<unknown>
  search(term: string, parameters?: MusicKitParameters): Promise<unknown>
  albumRelationship(id: string, relationship: string, parameters?: MusicKitParameters): Promise<unknown>
  artistRelationship(id: string, relationship: string, parameters?: MusicKitParameters): Promise<unknown>
  playlistRelationship(id: string, relationship: string, parameters?: MusicKitParameters): Promise<unknown>
}
export interface MusicKitApiLike {
  readonly library?: MusicKitLibraryApiLike
  music?(path: string, parameters?: MusicKitParameters): Promise<unknown>
  search(term: string, parameters?: MusicKitParameters): Promise<unknown>
  artistRelationship(id: string, relationship: string, parameters?: MusicKitParameters): Promise<unknown>
  playlistRelationship(id: string, relationship: string, parameters?: MusicKitParameters): Promise<unknown>
  songRelationship(id: string, relationship: string, parameters?: MusicKitParameters): Promise<unknown>
  station(id: string, parameters?: MusicKitParameters): Promise<unknown>
  stations(parameters?: MusicKitParameters): Promise<unknown>
}
export interface MusicKitQueueLike { readonly items?: readonly unknown[]; readonly position?: number; readonly itemContainer?: unknown }
export interface MusicKitInstanceLike {
  readonly api: MusicKitApiLike; readonly isAuthorized: boolean; readonly storefrontId?: string; readonly storefrontCountryCode?: string
  readonly nowPlayingItem?: unknown; readonly currentPlaybackTime?: number; readonly currentPlaybackDuration?: number; readonly playbackState?: number; readonly queue?: MusicKitQueueLike
  readonly previewOnly?: boolean; volume: number; shuffleMode: number; repeatMode: number
  authorize(): Promise<string | void>; unauthorize(): Promise<void>; setQueue(options: Readonly<Record<string, unknown>>): Promise<unknown>
  play(): Promise<void> | void; pause(): Promise<void> | void; stop?(): Promise<void> | void; changeToMediaAtIndex?(index: number): Promise<void>; skipToNextItem(): Promise<void>; skipToPreviousItem(): Promise<void>; seekToTime(seconds: number): Promise<void>
  playLater(options: Readonly<Record<string, unknown>>): Promise<unknown>; playNext(options: Readonly<Record<string, unknown>>): Promise<unknown>
  addEventListener(name: string, callback: (event: unknown) => void): void; removeEventListener(name: string, callback: (event: unknown) => void): void
}

export type ApplePlaybackDiagnosticEventName = 'setQueue' | 'setQueueResolve' | 'setQueueReject' | 'playCall' | 'playResolve' | 'playReject' | 'playbackConfirmationTimeout' | 'queueItemsDidChange' | 'nowPlayingItemDidChange' | 'playbackStateDidChange' | 'playbackTimeDidChange' | 'mediaPlaybackError' | 'mediaCanPlay' | 'mediaItemStateDidChange' | 'bufferedProgressDidChange'
export interface ApplePlaybackDiagnosticOperation {
  readonly targetKind?: PlayTarget['kind']
  readonly targetItemCount?: number
  readonly queuedItemCount?: number
  readonly startIndex?: number
  readonly queueOffset?: number
  readonly queueResult?: 'queue' | 'void' | 'other'
}
export interface ApplePlaybackDiagnosticSource {
  readonly error?: unknown
  readonly event?: unknown
  readonly operation?: ApplePlaybackDiagnosticOperation
  readonly music: MusicKitInstanceLike
  readonly audio: HTMLAudioElement | null
  readonly userActivation: UserActivation | null
}
export interface ApplePlaybackDiagnosticSink {
  capture(event: ApplePlaybackDiagnosticEventName, source: () => ApplePlaybackDiagnosticSource): void
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
  readonly playbackConfirmationTimeoutMs?: number
  readonly setTimeout?: (callback: () => void, delayMs: number) => unknown
  readonly clearTimeout?: (handle: unknown) => void
  readonly now?: () => number
  readonly scheduleDeveloperTokenRefresh?: (callback: () => void, delayMs: number) => unknown
  readonly cancelDeveloperTokenRefresh?: (handle: unknown) => void
  readonly progressPollIntervalMs?: number
  readonly setInterval?: (callback: () => void, delayMs: number) => unknown
  readonly clearInterval?: (handle: unknown) => void
  readonly playbackDiagnostics?: ApplePlaybackDiagnosticSink
  /** Dependency-injected so browser-only globals can be tested without mutating Bun's process object. */
  readonly runtimeGlobal?: Record<string, unknown>
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

type AppleLibraryContinuation =
  | { readonly kind: LibraryKind; readonly source: 'array'; readonly offset: number; readonly previousFingerprint: string }
  | { readonly kind: LibraryKind; readonly source: 'structured'; readonly path: string }

class InvalidAppleDataError extends Error {}

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new InvalidAppleDataError(`Apple ${context} response is invalid`)
  return value as JsonRecord
}
const asText = (value: unknown): string | undefined => typeof value === 'string' && value !== '' ? value : undefined
const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const asBoolean = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value : undefined
const millisecondsFromSeconds = (value: unknown, fallbackMs: number): number => {
  const seconds = asNumber(value)
  return seconds === undefined ? fallbackMs : Math.max(0, seconds * 1_000)
}
const asList = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []
function payload(value: unknown): JsonRecord { const outer = record(value, 'API'); const data = outer['data']; return typeof data === 'object' && data !== null && !Array.isArray(data) ? record(data, 'API payload') : outer }
function resources(value: unknown): readonly unknown[] { return Array.isArray(value) ? value : asList(payload(value)['data']) }

function artwork(attributes: JsonRecord): Artwork | undefined {
  const value = attributes['artwork']; if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = record(value, 'artwork'); const template = asText(raw['url']); if (template === undefined || !template.includes('{w}') || !template.includes('{h}')) return undefined
  const width = asNumber(raw['width']); const height = asNumber(raw['height'])
  return width === undefined || height === undefined ? { kind: 'template', template } : { kind: 'template', template, sizes: [{ url: template, w: width, h: height }] }
}
const RESOURCE_TYPE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  song: 'songs', album: 'albums', artist: 'artists', playlist: 'playlists', station: 'stations', genre: 'genres',
  'library-song': 'library-songs', 'library-album': 'library-albums', 'library-artist': 'library-artists', 'library-playlist': 'library-playlists',
})
export const APPLE_CONTINUATION_CACHE_MAX_ENTRIES = 32
const canonicalResourceType = (type: string): string => RESOURCE_TYPE_ALIASES[type] ?? type
type AppleIdentityCache = ((type: string, catalogId: string, libraryId?: string) => LocalKey) & { clear(): void }
function identityCache(): AppleIdentityCache {
  const keys = new Map<string, LocalKey>()
  const keyFor = ((type: string, catalogId: string, libraryId?: string): LocalKey => {
    const catalogIdentity = `${type}:catalog:${catalogId}`
    const libraryIdentity = libraryId === undefined ? undefined : `${type}:library:${libraryId}`
    const known = keys.get(catalogIdentity) ?? (libraryIdentity === undefined ? undefined : keys.get(libraryIdentity))
    const key = known ?? mintLocalKey()
    keys.set(catalogIdentity, key)
    if (libraryIdentity !== undefined) keys.set(libraryIdentity, key)
    return key
  }) as AppleIdentityCache
  keyFor.clear = () => keys.clear()
  return keyFor
}
function normalize(raw: unknown, keyFor: ReturnType<typeof identityCache>): Entity {
  const resource = record(raw, 'resource'); const id = asText(resource['id']); const rawType = asText(resource['type']); const attrs = record(resource['attributes'], 'attributes')
  if (id === undefined || rawType === undefined) throw new InvalidAppleDataError('Apple resource has no id or type')
  const type = canonicalResourceType(rawType)
  const library = type.startsWith('library-'); const playRaw = attrs['playParams']; const play = typeof playRaw === 'object' && playRaw !== null && !Array.isArray(playRaw) ? record(playRaw, 'play parameters') : {}
  const catalogId = asText(play['globalId']) ?? asText(play['catalogId']) ?? id; const libraryId = library ? id : undefined; const art = artwork(attrs); const key = keyFor(type.replace('library-', ''), catalogId, libraryId)
  const optional = <T>(value: T | undefined, name: string): object => value === undefined ? {} : { [name]: value }
  if (type === 'songs' || type === 'library-songs') {
    const title = asText(attrs['name']); const artistName = asText(attrs['artistName']); if (title === undefined || artistName === undefined) throw new InvalidAppleDataError('Apple song is missing metadata')
    return { kind: 'track', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), title, artistName, ...optional(asText(attrs['albumName']), 'albumName'), durationMs: asNumber(attrs['durationInMillis']) ?? 0, ...optional(art, 'artwork'), playable: asBoolean(attrs['playable']) ?? true, ...optional(asText(attrs['isrc']), 'isrc') } as TrackRef
  }
  if (type === 'albums' || type === 'library-albums') {
    const title = asText(attrs['name']); const artistName = asText(attrs['artistName']); if (title === undefined || artistName === undefined) throw new InvalidAppleDataError('Apple album is missing metadata')
    const year = Number(asText(attrs['releaseDate'])?.slice(0, 4)); return { kind: 'album', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), title, artistName, trackCount: asNumber(attrs['trackCount']) ?? 0, ...(Number.isInteger(year) && year > 0 ? { releaseYear: year } : {}), ...optional(art, 'artwork') } as AlbumRef
  }
  if (type === 'artists' || type === 'library-artists') { const name = asText(attrs['name']); if (name === undefined) throw new InvalidAppleDataError('Apple artist has no name'); return { kind: 'artist', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), name, ...optional(art, 'artwork') } as ArtistRef }
  if (type === 'playlists' || type === 'library-playlists') {
    const name = asText(attrs['name']); if (name === undefined) throw new InvalidAppleDataError('Apple playlist has no name'); const descriptionValue = attrs['description']; const description = typeof descriptionValue === 'object' && descriptionValue !== null ? asText(record(descriptionValue, 'description')['standard']) : undefined
    return { kind: 'playlist', key, provider: 'apple', catalogId, ...optional(libraryId, 'libraryId'), name, ...optional(description, 'description'), trackCount: asNumber(attrs['trackCount']) ?? 0, editable: asBoolean(attrs['canEdit']) ?? false, ...optional(art, 'artwork') } as PlaylistRef
  }
  if (type === 'stations') { const name = asText(attrs['name']); if (name === undefined) throw new InvalidAppleDataError('Apple station has no name'); return { kind: 'station', key, provider: 'apple', catalogId, name, live: asBoolean(attrs['isLive']) ?? false, ...optional(art, 'artwork') } as StationRef }
  if (type === 'genres') { const name = asText(attrs['name']); if (name === undefined) throw new InvalidAppleDataError('Apple genre has no name'); return { kind: 'genre', key, provider: 'apple', catalogId, name } }
  throw new InvalidAppleDataError(`Apple resource type ${rawType} is unsupported`)
}
function unsupported(capability: Capability): never { throw new CapabilityUnsupportedError('apple', capability, APPLE_UNSUPPORTED_REASONS[capability] ?? 'This action is unavailable on Apple Music.') }

function playTargetKey(target: PlayTarget): string {
  const plan = queuePlan(target)
  return JSON.stringify(target.kind === 'tracks'
    ? [target.kind, plan.descriptor['songs'], target.startIndex ?? 0, plan.offset]
    : [target.kind, target.kind === 'album' ? target.album.catalogId : target.kind === 'playlist' ? target.playlist.catalogId : target.station.catalogId])
}

interface AppleQueuePlan {
  readonly descriptor: Readonly<Record<string, unknown>>
  readonly offset: number
  readonly queuedItemCount: number
}

function queuePlan(target: PlayTarget): AppleQueuePlan {
  switch (target.kind) {
    case 'tracks': {
      const selected = Math.min(Math.max(0, target.startIndex ?? 0), Math.max(0, target.tracks.length - 1))
      const offset = Math.max(0, Math.min(selected - Math.floor(APPLE_PLAYBACK_QUEUE_LIMIT / 2), target.tracks.length - APPLE_PLAYBACK_QUEUE_LIMIT))
      const tracks = target.tracks.slice(offset, offset + APPLE_PLAYBACK_QUEUE_LIMIT)
      return { descriptor: { songs: tracks.map((track) => track.catalogId) }, offset, queuedItemCount: tracks.length }
    }
    case 'album': return { descriptor: { album: target.album.catalogId }, offset: 0, queuedItemCount: 1 }
    case 'playlist': return { descriptor: { playlist: target.playlist.catalogId }, offset: 0, queuedItemCount: 1 }
    case 'station': return { descriptor: { station: target.station.catalogId }, offset: 0, queuedItemCount: 1 }
  }
}

function playbackTargetDiagnostics(target: PlayTarget): ApplePlaybackDiagnosticOperation {
  const plan = queuePlan(target)
  return target.kind === 'tracks'
    ? { targetKind: target.kind, targetItemCount: target.tracks.length, queuedItemCount: plan.queuedItemCount, startIndex: target.startIndex ?? 0, queueOffset: plan.offset }
    : { targetKind: target.kind, targetItemCount: 1, queuedItemCount: plan.queuedItemCount, queueOffset: 0 }
}

/** MusicKit v3 treats any global `process` object as Node while configuring its runtime. */
async function withoutBrowserProcessShim<T>(globalObject: Record<string, unknown>, operation: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalObject, 'process')
  const value = globalObject['process']
  const fields = typeof value === 'object' && value !== null ? value as Readonly<Record<string, unknown>> : null
  const versions = fields?.['versions']
  const hasNodeVersion = typeof versions === 'object' && versions !== null && typeof (versions as Readonly<Record<string, unknown>>)['node'] === 'string'
  const isBrowserShim = fields !== null && !hasNodeVersion && descriptor?.configurable !== false
  if (!isBrowserShim) return operation()
  delete globalObject['process']
  try {
    return await operation()
  } finally {
    if (descriptor === undefined) delete globalObject['process']
    else Object.defineProperty(globalObject, 'process', descriptor)
  }
}

export function createAppleProvider(options?: AppleProviderOptions): AppleMusicProvider {
  const configuredOptions = options ?? browserAppleProviderOptions(); let kit: MusicKitGlobalLike | null = null; let music: MusicKitInstanceLike | null = null; let currentSession: Session | null = null
  let configurePromise: Promise<void> | null = null
  let playPromise: Promise<void> | null = null
  let replacementPausePromise: Promise<void> | null = null
  let playRequestGeneration = 0
  let preparationPromise: Promise<string | null> | null = null
  let preparationKey: string | null = null
  let preparationTarget: PlayTarget | null = null
  let preparedKey: string | null = null
  let preparedTarget: PlayTarget | null = null
  let preparationGeneration = 0
  let awaitingPlaybackStart = false
  let pendingPlaybackPositionMs: number | null = null
  let pendingPlayKey: string | null = null
  let expectedNowPlayingCatalogId: string | null = null
  let pendingQueueGeneration = 0
  let queueGeneration = 0
  let pendingQueueFingerprint: string | null = null
  let confirmedCollectionQueueIds: ReadonlySet<string> | null = null
  let pendingCollectionKey: string | null = null
  let transactionGeneration = 0
  let failedPlaybackGeneration: number | null = null
  let playbackQueueOffset = 0
  let playbackEventsEnabled = true
  let playbackConfirmationTimer: unknown | null = null
  let progressTimer: unknown | null = null
  let developerTokenRefreshTimer: unknown | null = null
  let developerTokenRefreshPromise: Promise<void> | null = null
  let developerTokenExpiresAtMs = 0
  let unbindMusicKit: (() => void) | null = null
  let appleState: AppleSessionState = { status: 'signed-out' }
  let currentPlayback: PlaybackState = { status: 'idle', now: null, queueIndex: null, positionMs: 0, durationMs: 0, volume0to100: 100, shuffle: 'off', repeat: 'off' }
  const sessions = new Set<(value: Session | null) => void>(); const appleStates = new Set<(value: AppleSessionState) => void>(); const playback = new Set<(value: PlaybackState) => void>(); const progress = new Set<(value: ProgressTick) => void>(); const continuations = new Map<Cursor, AppleLibraryContinuation>(); const keyFor = identityCache()
  const instance = (method: string): MusicKitInstanceLike => { if (music === null) throw new NotAuthorizedError('apple', method); return music }
  const authorized = (method: string): MusicKitInstanceLike => { const value = instance(method); if (!value.isAuthorized) throw new NotAuthorizedError('apple', method); return value }
  const emitAppleState = (value: AppleSessionState): void => { appleState = value; for (const listener of appleStates) listener(value) }
  const emitSession = (value: Session | null): void => { currentSession = value; for (const listener of sessions) listener(value); emitAppleState(value === null ? { status: 'signed-out' } : { status: 'authorized', session: value }) }
  const sessionOf = (value: MusicKitInstanceLike, user: string | null): Session => ({ provider: 'apple', status: 'authorized', userIdentifier: user, storefront: value.storefrontId ?? value.storefrontCountryCode ?? null, canPlay: value.previewOnly !== true, expiresAt: null })
  const playbackStatusOf = (value: MusicKitInstanceLike, hasNowPlayingItem = value.nowPlayingItem !== undefined): PlaybackState['status'] => {
    const raw = value.playbackState
    const states = kit?.PlaybackStates
    return raw === states?.['playing']
      ? 'playing'
      : raw === states?.['paused']
        ? 'paused'
        : raw === states?.['loading'] || raw === states?.['waiting']
          ? 'loading'
          : !hasNowPlayingItem
            ? 'idle'
            : 'stopped'
  }
  const stateOf = (value: MusicKitInstanceLike): PlaybackState => {
    const now = (() => { try { const item = value.nowPlayingItem === undefined ? null : normalize(value.nowPlayingItem, keyFor); return item?.kind === 'track' ? item : null } catch { return null } })()
    const observedStatus = playbackStatusOf(value, now !== null)
    const queuePosition = value.queue?.position
    const queueIndex = now !== null && queuePosition !== undefined && Number.isInteger(queuePosition) && queuePosition >= 0 ? queuePosition + playbackQueueOffset : null
    const positionMs = millisecondsFromSeconds(value.currentPlaybackTime, currentPlayback.positionMs)
    const durationMs = millisecondsFromSeconds(value.currentPlaybackDuration, now?.durationMs ?? currentPlayback.durationMs)
    const volume = asNumber(value.volume) ?? currentPlayback.volume0to100 / 100
    return { status: awaitingPlaybackStart ? 'loading' : observedStatus, now, queueIndex, positionMs, durationMs, volume0to100: Math.round(Math.min(1, Math.max(0, volume)) * 100), shuffle: value.shuffleMode === kit?.PlayerShuffleMode?.['songs'] ? 'songs' : value.shuffleMode === kit?.PlayerShuffleMode?.['albums'] ? 'albums' : 'off', repeat: value.repeatMode === kit?.PlayerRepeatMode?.['one'] ? 'one' : value.repeatMode === kit?.PlayerRepeatMode?.['all'] ? 'all' : 'off' }
  }
  const queueCatalogIds = (value: MusicKitInstanceLike): readonly string[] => {
    const ids: string[] = []
    for (const item of value.queue?.items ?? []) {
      try {
        const entity = normalize(item, keyFor)
        if (entity.kind === 'track') ids.push(entity.catalogId)
      } catch {
        // MusicKit may expose transitional queue entries; they cannot confirm a request.
      }
    }
    return ids
  }
  const queueFingerprint = (value: MusicKitInstanceLike): string => JSON.stringify(queueCatalogIds(value))
  const queueContainerKey = (value: MusicKitInstanceLike): string | null => {
    const container = value.queue?.itemContainer
    if (typeof container !== 'object' || container === null || Array.isArray(container)) return null
    try {
      const resource = record(container, 'queue container')
      const rawType = asText(resource['type'])
      const resourceId = asText(resource['id'])
      if (rawType === undefined || resourceId === undefined) return null
      const attributes = typeof resource['attributes'] === 'object' && resource['attributes'] !== null && !Array.isArray(resource['attributes']) ? record(resource['attributes'], 'queue container attributes') : {}
      const playParams = typeof attributes['playParams'] === 'object' && attributes['playParams'] !== null && !Array.isArray(attributes['playParams']) ? record(attributes['playParams'], 'queue container play parameters') : {}
      const catalogId = asText(playParams['globalId']) ?? asText(playParams['catalogId']) ?? resourceId
      const type = rawType.replace('library-', '').replace(/s$/, '')
      return `${type}:${catalogId}`
    } catch {
      return null
    }
  }
  const queueMatchesTarget = (value: MusicKitInstanceLike, target: PlayTarget, allowPreparedPosition = false): boolean => {
    if (target.kind === 'tracks') {
      const plan = queuePlan(target)
      const expectedIds = target.tracks.slice(plan.offset, plan.offset + plan.queuedItemCount).map((track) => track.catalogId)
      const position = value.queue?.position
      return JSON.stringify(queueCatalogIds(value)) === JSON.stringify(expectedIds)
        && (
          position === (target.startIndex ?? 0) - plan.offset
          || (allowPreparedPosition && stateOf(value).now === null)
        )
    }
    const catalogId = target.kind === 'album'
      ? target.album.catalogId
      : target.kind === 'playlist'
        ? target.playlist.catalogId
        : target.station.catalogId
    return queueContainerKey(value) === `${target.kind}:${catalogId}`
  }
  const invalidatePreparation = (): Promise<string | null> | null => {
    const pending = preparationPromise
    preparationGeneration += 1
    preparationKey = null
    preparationTarget = null
    preparedKey = null
    preparedTarget = null
    return pending
  }
  const waitForPreparationBeforeQueueMutation = async (): Promise<void> => {
    await invalidatePreparation()?.catch(() => null)
  }
  const emitPlayback = (value: PlaybackState): void => { currentPlayback = value; for (const listener of playback) listener(value) }
  const stopProgressClock = (): void => {
    if (progressTimer === null || configuredOptions.clearInterval === undefined) return
    configuredOptions.clearInterval(progressTimer)
    progressTimer = null
  }
  const refreshProgress = (value: MusicKitInstanceLike): void => {
    if (!playbackEventsEnabled || failedPlaybackGeneration === transactionGeneration) return
    let state = stateOf(value)
    const playbackStarted = confirmPendingPlaybackStart(state)
    if (playbackStarted) {
      finishPendingPlayback()
      state = stateOf(value)
      if (currentSession !== null && appleState.status === 'error') emitAppleState({ status: 'authorized', session: currentSession })
    }
    if (playbackStarted) emitPlayback(state)
    else currentPlayback = state
    for (const listener of progress) listener({ positionMs: state.positionMs, durationMs: state.durationMs, interpolated: false })
    const observedStatus = playbackStatusOf(value)
    if (observedStatus !== 'playing' && observedStatus !== 'loading') stopProgressClock()
  }
  const startProgressClock = (value: MusicKitInstanceLike): void => {
    if (progressTimer !== null || configuredOptions.setInterval === undefined || configuredOptions.clearInterval === undefined) return
    progressTimer = configuredOptions.setInterval(() => { refreshProgress(value) }, configuredOptions.progressPollIntervalMs ?? 250)
  }
  const capturePlaybackDiagnostic = (event: ApplePlaybackDiagnosticEventName, payload?: unknown, operation?: ApplePlaybackDiagnosticOperation): void => {
    const value = music
    if (value === null) return
    configuredOptions.playbackDiagnostics?.capture(event, () => {
      const audio = typeof document === 'undefined' ? null : document.querySelector<HTMLAudioElement>('audio#apple-music-player')
      const activation = typeof navigator === 'undefined' ? null : navigator.userActivation
      const rejected = event === 'mediaPlaybackError' || event === 'setQueueReject' || event === 'playReject'
      return { error: rejected ? payload : undefined, event: rejected ? undefined : payload, operation, music: value, audio, userActivation: activation ?? null }
    })
  }
  const setQueueForTarget = async (value: MusicKitInstanceLike, target: PlayTarget): Promise<unknown> => {
    const operation = playbackTargetDiagnostics(target)
    capturePlaybackDiagnostic('setQueue', undefined, operation)
    let result: unknown
    try {
      result = await value.setQueue(queuePlan(target).descriptor)
    } catch (cause) {
      capturePlaybackDiagnostic('setQueueReject', cause, operation)
      throw cause
    }
    const queueResult: ApplePlaybackDiagnosticOperation['queueResult'] = result === undefined
      ? 'void'
      : typeof result === 'object' && result !== null && 'items' in result
        ? 'queue'
        : 'other'
    capturePlaybackDiagnostic('setQueueResolve', undefined, { ...operation, queueResult })
    if (result === undefined) throw new Error('Apple Music playback is unavailable in this browser runtime')
    return result
  }
  const selectedTrackIndex = (target: Extract<PlayTarget, { readonly kind: 'tracks' }>): number => Math.min(
    Math.max(0, target.startIndex ?? 0),
    Math.max(0, target.tracks.length - 1),
  )
  const selectedQueueIndex = (value: MusicKitInstanceLike, target: Extract<PlayTarget, { readonly kind: 'tracks' }>): number => {
    const plan = queuePlan(target)
    const selected = selectedTrackIndex(target)
    const selectedInPlan = selected - plan.offset
    const requestedIds = target.tracks.slice(plan.offset, plan.offset + plan.queuedItemCount).map((track) => track.catalogId)
    const selectedId = requestedIds[selectedInPlan]
    if (selectedId === undefined) return 0
    const requestedOccurrence = requestedIds.slice(0, selectedInPlan + 1).filter((id) => id === selectedId).length
    let observedOccurrence = 0
    let lastObservedMatch: number | null = null
    for (const [index, id] of queueCatalogIds(value).entries()) {
      if (id !== selectedId) continue
      observedOccurrence += 1
      lastObservedMatch = index
      if (observedOccurrence === requestedOccurrence) return index
    }
    return lastObservedMatch ?? selectedInPlan
  }
  const startQueuedTarget = async (value: MusicKitInstanceLike, queuedTarget: PlayTarget | undefined, requestedTarget: PlayTarget | undefined): Promise<void> => {
    if (queuedTarget?.kind === 'tracks' && value.changeToMediaAtIndex !== undefined) {
      const queueIndex = selectedQueueIndex(value, queuedTarget)
      const publicIndex = requestedTarget?.kind === 'tracks' ? selectedTrackIndex(requestedTarget) : selectedTrackIndex(queuedTarget)
      playbackQueueOffset = publicIndex - queueIndex
      await value.changeToMediaAtIndex(queueIndex)
      return
    }
    await value.play()
  }
  const stopForQueueReplacement = async (value: MusicKitInstanceLike): Promise<void> => {
    if (value.stop !== undefined) await value.stop()
    else await value.pause()
  }
  const clearPlaybackConfirmationTimer = (): void => {
    if (playbackConfirmationTimer === null) return
    if (configuredOptions.clearTimeout === undefined) globalThis.clearTimeout(playbackConfirmationTimer as ReturnType<typeof globalThis.setTimeout>)
    else configuredOptions.clearTimeout(playbackConfirmationTimer)
    playbackConfirmationTimer = null
  }
  const finishPendingPlayback = (): void => {
    clearPlaybackConfirmationTimer()
    awaitingPlaybackStart = false
    pendingPlaybackPositionMs = null
    pendingPlayKey = null
    expectedNowPlayingCatalogId = null
    pendingQueueFingerprint = null
    confirmedCollectionQueueIds = null
    pendingCollectionKey = null
  }
  const pendingPlaybackMatches = (observed: TrackRef | null): boolean => observed !== null && (
    expectedNowPlayingCatalogId === null
      ? confirmedCollectionQueueIds?.has(observed.catalogId) === true
      : observed.catalogId === expectedNowPlayingCatalogId
  )
  /** Seeds the selected item's clock without treating queue readiness as playback. */
  const primePendingPlaybackClock = (state: PlaybackState): void => {
    if (!awaitingPlaybackStart || !pendingPlaybackMatches(state.now)) return
    if (pendingPlaybackPositionMs === null || state.positionMs < pendingPlaybackPositionMs) pendingPlaybackPositionMs = state.positionMs
  }
  /** Confirms playback only after the selected item's playhead moves forward. */
  const confirmPendingPlaybackStart = (state: PlaybackState): boolean => {
    if (!awaitingPlaybackStart || !pendingPlaybackMatches(state.now)) return false
    if (pendingPlaybackPositionMs === null || state.positionMs <= pendingPlaybackPositionMs) {
      pendingPlaybackPositionMs = state.positionMs
      return false
    }
    return true
  }
  const playbackErrorMessage = (event: unknown): string => {
    void event
    return 'Apple Music could not start playback.'
  }
  const bind = (value: MusicKitInstanceLike): void => {
    if (unbindMusicKit !== null) return
    const changed = (event: unknown): void => {
      capturePlaybackDiagnostic('playbackStateDidChange', event)
      if (!playbackEventsEnabled || failedPlaybackGeneration === transactionGeneration) return
      const state = stateOf(value)
      primePendingPlaybackClock(state)
      emitPlayback(state)
      const observedStatus = playbackStatusOf(value)
      if (observedStatus === 'playing') startProgressClock(value)
      else if (observedStatus !== 'loading') stopProgressClock()
    }
    const nowPlayingChanged = (): void => {
      capturePlaybackDiagnostic('nowPlayingItemDidChange')
      if (!playbackEventsEnabled || failedPlaybackGeneration === transactionGeneration) return
      const observed = stateOf(value).now
      const matchesExpected = pendingPlaybackMatches(observed)
      if (matchesExpected) {
        primePendingPlaybackClock(stateOf(value))
      }
      const state = stateOf(value)
      emitPlayback(state)
      if (playbackStatusOf(value) === 'playing') startProgressClock(value)
    }
    const queueChanged = (): void => {
      capturePlaybackDiagnostic('queueItemsDidChange')
      if (!playbackEventsEnabled || failedPlaybackGeneration === transactionGeneration) return
      const expectedPreparation = preparationTarget ?? preparedTarget
      if (expectedPreparation === null || !queueMatchesTarget(value, expectedPreparation, true)) invalidatePreparation()
      queueGeneration += 1
      if (awaitingPlaybackStart && expectedNowPlayingCatalogId === null && queueGeneration > pendingQueueGeneration) {
        const ids = queueCatalogIds(value)
        const fingerprintChanged = JSON.stringify(ids) !== pendingQueueFingerprint
        const containerMatches = pendingCollectionKey !== null && queueContainerKey(value) === pendingCollectionKey
        if (ids.length > 0 && (containerMatches || (queueContainerKey(value) === null && fingerprintChanged))) {
          confirmedCollectionQueueIds = new Set(ids)
        }
      }
      emitPlayback(stateOf(value))
    }
    const tick = (): void => { capturePlaybackDiagnostic('playbackTimeDidChange'); refreshProgress(value) }
    const mediaCanPlay = (): void => { capturePlaybackDiagnostic('mediaCanPlay') }
    const mediaItemStateChanged = (event: unknown): void => { capturePlaybackDiagnostic('mediaItemStateDidChange', event) }
    const bufferedProgressChanged = (): void => { capturePlaybackDiagnostic('bufferedProgressDidChange') }
    const playbackFailed = (event: unknown): void => {
      capturePlaybackDiagnostic('mediaPlaybackError', event)
      if (!playbackEventsEnabled) return
      if (developerTokenExpiresAtMs > 0 && currentTimeMs() >= developerTokenExpiresAtMs - APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS) {
        void refreshDeveloperToken().catch(() => {
          if (!playbackEventsEnabled) return
          failedPlaybackGeneration = transactionGeneration
          stopProgressClock()
          finishPendingPlayback()
          emitPlayback({ ...stateOf(value), status: 'error' })
          emitAppleState({ status: 'error', message: playbackErrorMessage(event) })
        })
        return
      }
      // MusicKit dispatches a raw error and provides no media identity. Treat
      // it as a provider-level transport failure; never attribute it to a track.
      failedPlaybackGeneration = transactionGeneration
      stopProgressClock()
      finishPendingPlayback()
      const message = playbackErrorMessage(event)
      emitPlayback({ ...stateOf(value), status: 'error' })
      emitAppleState({ status: 'error', message })
    }
    value.addEventListener('playbackStateDidChange', changed)
    value.addEventListener('queueItemsDidChange', queueChanged)
    value.addEventListener('nowPlayingItemDidChange', nowPlayingChanged)
    value.addEventListener('mediaPlaybackError', playbackFailed)
    value.addEventListener('playbackTimeDidChange', tick)
    if (configuredOptions.playbackDiagnostics !== undefined) {
      value.addEventListener('mediaCanPlay', mediaCanPlay)
      value.addEventListener('mediaItemStateDidChange', mediaItemStateChanged)
      value.addEventListener('bufferedProgressDidChange', bufferedProgressChanged)
    }
    unbindMusicKit = () => {
      stopProgressClock()
      value.removeEventListener('playbackStateDidChange', changed)
      value.removeEventListener('queueItemsDidChange', queueChanged)
      value.removeEventListener('nowPlayingItemDidChange', nowPlayingChanged)
      value.removeEventListener('mediaPlaybackError', playbackFailed)
      value.removeEventListener('playbackTimeDidChange', tick)
      if (configuredOptions.playbackDiagnostics !== undefined) {
        value.removeEventListener('mediaCanPlay', mediaCanPlay)
        value.removeEventListener('mediaItemStateDidChange', mediaItemStateChanged)
        value.removeEventListener('bufferedProgressDidChange', bufferedProgressChanged)
      }
      unbindMusicKit = null
    }
  }
  const currentTimeMs = (): number => (configuredOptions.now ?? Date.now)()
  const clearDeveloperTokenRefresh = (): void => {
    if (developerTokenRefreshTimer === null || configuredOptions.cancelDeveloperTokenRefresh === undefined) return
    configuredOptions.cancelDeveloperTokenRefresh(developerTokenRefreshTimer)
    developerTokenRefreshTimer = null
  }
  const scheduleDeveloperTokenRefresh = (retryDelayMs?: number): void => {
    const schedule = configuredOptions.scheduleDeveloperTokenRefresh
    if (schedule === undefined || configuredOptions.cancelDeveloperTokenRefresh === undefined || developerTokenExpiresAtMs <= 0) return
    clearDeveloperTokenRefresh()
    const delayMs = retryDelayMs ?? Math.max(0, developerTokenExpiresAtMs - currentTimeMs() - APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS)
    developerTokenRefreshTimer = schedule(() => {
      developerTokenRefreshTimer = null
      void refreshDeveloperToken().catch(() => {
        // Keep the current instance and authorization usable when the token
        // endpoint is temporarily unavailable, then try again without surfacing
        // a sign-in error for a background credential refresh.
        scheduleDeveloperTokenRefresh(APPLE_DEVELOPER_TOKEN_REFRESH_RETRY_MS)
      })
    }, delayMs)
  }
  const configureMusicKit = async (loadedKit: MusicKitGlobalLike): Promise<MusicKitInstanceLike> => {
    const token = await configuredOptions.fetchDeveloperToken()
    const runtimeGlobal = configuredOptions.runtimeGlobal ?? globalThis as unknown as Record<string, unknown>
    const result = await withoutBrowserProcessShim(runtimeGlobal, () => loadedKit.configure({ developerToken: token.token, app: { name: configuredOptions.appName ?? 'webPod', build: configuredOptions.appBuild ?? 'local' } }))
    developerTokenExpiresAtMs = token.expiresAt * 1_000
    return result ?? loadedKit.getInstance()
  }
  async function refreshDeveloperToken(): Promise<void> {
    if (developerTokenRefreshPromise !== null) return developerTokenRefreshPromise
    if (kit === null || music === null) return configure()
    const loadedKit = kit
    const priorSession = currentSession
    const priorPlayback = currentPlayback
    developerTokenRefreshPromise = (async () => {
      const next = await configureMusicKit(loadedKit)
      playbackEventsEnabled = false
      unbindMusicKit?.()
      music = next
      transactionGeneration += 1
      invalidatePreparation()
      failedPlaybackGeneration = null
      playbackQueueOffset = 0
      finishPendingPlayback()
      bind(next)
      playbackEventsEnabled = next.isAuthorized
      if (next.isAuthorized) {
        if (priorSession === null) emitSession(sessionOf(next, null))
        else {
          // MusicKit persists and restores the Music User Token itself. Keep the
          // same Session identity so React consumers do not reset navigation
          // merely because the short-lived developer token rotated.
          currentSession = priorSession
          emitAppleState({ status: 'authorized', session: priorSession })
        }
      } else if (priorSession !== null) {
        emitSession(null)
      }
      const refreshedPlayback = stateOf(next)
      emitPlayback(refreshedPlayback.now === null && priorPlayback.now !== null
        ? { ...priorPlayback, status: priorPlayback.status === 'playing' ? 'paused' : priorPlayback.status }
        : refreshedPlayback)
      scheduleDeveloperTokenRefresh()
    })().finally(() => { developerTokenRefreshPromise = null })
    return developerTokenRefreshPromise
  }
  const ensureFreshDeveloperToken = async (): Promise<void> => {
    if (developerTokenNeedsRefresh()) {
      await refreshDeveloperToken()
    }
  }
  const developerTokenNeedsRefresh = (): boolean => developerTokenExpiresAtMs > 0 && currentTimeMs() >= developerTokenExpiresAtMs - APPLE_DEVELOPER_TOKEN_REFRESH_LEAD_MS
  const api = async (path: string, parameters?: Readonly<Record<string, string>>): Promise<unknown> => {
    await ensureFreshDeveloperToken()
    const value = authorized('api').api
    const url = new URL(path, 'https://api.music.apple.com')
    const query: Record<string, string | number> = Object.fromEntries(url.searchParams)
    Object.assign(query, parameters)
    if (value.music !== undefined) return value.music(url.pathname, query)
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    if (parts[1] === 'me' && parts[2] === 'library') {
      const collection = parts[3]
      const library = value.library
      if (library === undefined) throw new Error('MusicKit library API is unavailable')
      if (parts.length === 4 && (collection === 'albums' || collection === 'artists' || collection === 'playlists' || collection === 'songs')) return library[collection](query)
      if (collection === 'search') { const term = String(query['term'] ?? ''); const options = { ...query }; delete options['term']; return library.search(term, options) }
      const id = parts[4]; const relationship = parts[5]
      if (id !== undefined && relationship !== undefined) {
        if (collection === 'albums') return library.albumRelationship(id, relationship, query)
        if (collection === 'artists') return library.artistRelationship(id, relationship, query)
        if (collection === 'playlists') return library.playlistRelationship(id, relationship, query)
      }
    }
    if (parts[1] === 'catalog') {
      const collection = parts[3]
      if (collection === 'search') { const term = String(query['term'] ?? ''); const options = { ...query }; delete options['term']; return value.search(term, options) }
      const id = parts[4]; const relationship = parts[5]
      if (id !== undefined && relationship !== undefined) {
        if (collection === 'artists') return value.artistRelationship(id, relationship, query)
        if (collection === 'playlists') return value.playlistRelationship(id, relationship, query)
        if (collection === 'songs') return value.songRelationship(id, relationship, query)
      }
      if (collection === 'stations') return id === undefined ? value.stations(query) : value.station(id, query)
    }
    throw new Error(`Apple MusicKit cannot request ${url.pathname}`)
  }
  const issueContinuation = (continuation: AppleLibraryContinuation): Cursor => {
    let cursor: Cursor
    do {
      cursor = `apple-library:${crypto.randomUUID()}`
    } while (continuations.has(cursor))
    continuations.set(cursor, continuation)
    while (continuations.size > APPLE_CONTINUATION_CACHE_MAX_ENTRIES) {
      const oldest = continuations.keys().next().value as Cursor | undefined
      if (oldest === undefined) break
      continuations.delete(oldest)
    }
    return cursor
  }
  const consumeContinuation = (cursor: Cursor, kind: LibraryKind): AppleLibraryContinuation => {
    const continuation = continuations.get(cursor)
    continuations.delete(cursor)
    if (continuation === undefined || continuation.kind !== kind) throw new InvalidCursorError('apple', cursor)
    return continuation
  }
  const normalizeLibraryItems = (rawItems: readonly unknown[]): readonly Entity[] => {
    const items: Entity[] = []
    for (const rawItem of rawItems) {
      try {
        items.push(normalize(rawItem, keyFor))
      } catch (cause) {
        // MusicKit can return incomplete library records. Omit only that record;
        // never invent display metadata or expose the rejected payload in logs.
        if (!(cause instanceof InvalidAppleDataError)) throw cause
      }
    }
    return items
  }
  const pageFingerprint = (rawItems: readonly unknown[]): string => JSON.stringify(rawItems.map((rawItem, index) => {
    try {
      const resource = record(rawItem, 'resource')
      return [asText(resource['type']) ?? null, asText(resource['id']) ?? null]
    } catch {
      return [null, index]
    }
  }))
  const libraryPage = (response: unknown, kind: LibraryKind, request: AppleLibraryContinuation | null): Page<Entity> => {
    const rawItems = resources(response)
    const items = normalizeLibraryItems(rawItems)
    if (Array.isArray(response)) {
      const fingerprint = pageFingerprint(rawItems)
      if (request?.source === 'array' && fingerprint === request.previousFingerprint) throw new Error('Apple Music library pagination did not advance')
      const offset = request?.source === 'array' ? request.offset : 0
      const next = rawItems.length === APPLE_LIBRARY_PAGE_SIZE
        ? issueContinuation({ kind, source: 'array', offset: offset + APPLE_LIBRARY_PAGE_SIZE, previousFingerprint: fingerprint })
        : null
      return { items, next, total: null }
    }
    const body = payload(response)
    const nextPath = asText(body['next']) ?? null
    if (request?.source === 'structured' && nextPath === request.path) throw new Error('Apple Music library pagination did not advance')
    const next = nextPath === null ? null : issueContinuation({ kind, source: 'structured', path: nextPath })
    const meta = body['meta']
    const total = typeof meta === 'object' && meta !== null ? asNumber(record(meta, 'metadata')['total']) ?? null : null
    return { items, next, total }
  }
  const relationships = async <T extends AlbumRef | TrackRef>(first: string, kind: T['kind']): Promise<readonly T[]> => {
    const items: T[] = []; let path: string | null = first; let pages = 0
    while (path !== null) { const response = await api(path); items.push(...resources(response).map((item) => normalize(item, keyFor)).filter((item): item is T => item.kind === kind)); path = Array.isArray(response) ? null : asText(payload(response)['next']) ?? null; pages += 1; if (pages > 1_000) throw new Error('Apple Music relationship pagination did not terminate') }
    return items
  }
  const storefront = (method: string): string => authorized(method).storefrontId ?? authorized(method).storefrontCountryCode ?? 'us'
  const configure = async (): Promise<void> => {
    if (music !== null) return
    configurePromise ??= (async () => {
      const loadedKit = await configuredOptions.loadMusicKit()
      kit = loadedKit
      music = await configureMusicKit(loadedKit)
      bind(music)
      if (music.isAuthorized) emitSession(sessionOf(music, null))
      currentPlayback = stateOf(music)
      scheduleDeveloperTokenRefresh()
    })().catch((cause) => { configurePromise = null; throw cause })
    await configurePromise
  }
  return {
    id: 'apple', displayName: 'Apple Music', supports: (capability) => APPLE_SUPPORTS[capability], unsupportedReason: (capability) => APPLE_SUPPORTS[capability] ? null : APPLE_UNSUPPORTED_REASONS[capability],
    configure,
    async authorize() { if (music === null) await configure(); else if (developerTokenNeedsRefresh()) await refreshDeveloperToken(); emitAppleState({ status: 'signing-in' }); const value = instance('authorize'); try { const user = await value.authorize(); if (!value.isAuthorized || user === undefined) { const error = new NotAuthorizedError('apple', 'authorize'); emitAppleState({ status: 'permission-denied', message: error.message }); throw error } playbackEventsEnabled = true; failedPlaybackGeneration = null; bind(value); const session = sessionOf(value, user); emitSession(session); return session } catch (cause) { if (appleState.status !== 'permission-denied') emitAppleState({ status: 'error', message: cause instanceof Error ? cause.message : 'Apple Music sign-in failed' }); throw cause } },
    async unauthorize() { const value = instance('unauthorize'); await value.unauthorize(); playbackEventsEnabled = false; transactionGeneration += 1; invalidatePreparation(); continuations.clear(); keyFor.clear(); failedPlaybackGeneration = null; playbackQueueOffset = 0; stopProgressClock(); finishPendingPlayback(); unbindMusicKit?.(); emitPlayback({ ...currentPlayback, status: 'idle', now: null, queueIndex: null, positionMs: 0, durationMs: 0 }); emitSession(null) }, get session() { return currentSession }, onSessionChange(callback) { sessions.add(callback); return () => { sessions.delete(callback) } }, get appleSessionState() { return appleState }, onAppleSessionStateChange(callback) { appleStates.add(callback); return () => { appleStates.delete(callback) } },
    async search(query) { const types = query.kinds.map((kind) => kind === 'track' ? 'songs' : `${kind}s`).filter((kind) => kind !== 'stations'); const path = query.scope === 'library' ? '/v1/me/library/search' : `/v1/catalog/${storefront('search')}/search`; const response = await api(path, { term: query.term, types: (query.scope === 'library' ? types.map((type) => `library-${type}`) : types).join(','), limit: String(Math.min(25, Math.max(1, query.limit ?? 25))), ...(query.cursor === undefined ? {} : { offset: query.cursor }) }); const resultMap = record(payload(response)['results'], 'search results'); const entities: Entity[] = []; for (const section of Object.values(resultMap)) for (const item of resources(section)) entities.push(normalize(item, keyFor)); return { tracks: entities.filter((x): x is TrackRef => x.kind === 'track'), albums: entities.filter((x): x is AlbumRef => x.kind === 'album'), artists: entities.filter((x): x is ArtistRef => x.kind === 'artist'), playlists: entities.filter((x): x is PlaylistRef => x.kind === 'playlist'), stations: entities.filter((x): x is StationRef => x.kind === 'station'), next: null } satisfies SearchResults },
    async libraryList(kind, cursor) {
      const names: Record<LibraryKind, string | null> = { playlists: 'playlists', artists: 'artists', albums: 'albums', songs: 'songs', genres: null, composers: null }
      const name = names[kind]
      if (name === null) throw new NotImplementedError('apple', `libraryList(${kind}): Apple exposes no matching library collection endpoint`)
      const path = `/v1/me/library/${name}`
      const continuation = cursor === undefined ? null : consumeContinuation(cursor, kind)
      const response = continuation?.source === 'structured'
        ? await api(continuation.path, { limit: String(APPLE_LIBRARY_PAGE_SIZE) })
        : await api(path, {
            limit: String(APPLE_LIBRARY_PAGE_SIZE),
            offset: String(continuation?.source === 'array' ? continuation.offset : 0),
          })
      return libraryPage(response, kind, continuation)
    },
    async relatedTracks(ref) { const path = ref.libraryId === undefined ? `/v1/catalog/${storefront('relatedTracks')}/${ref.kind}s/${encodeURIComponent(ref.catalogId)}/tracks` : `/v1/me/library/${ref.kind}s/${encodeURIComponent(ref.libraryId)}/tracks`; return relationships<TrackRef>(path, 'track') },
    async relatedAlbums(ref) { const path = ref.libraryId === undefined ? `/v1/catalog/${storefront('relatedAlbums')}/artists/${encodeURIComponent(ref.catalogId)}/albums` : `/v1/me/library/artists/${encodeURIComponent(ref.libraryId)}/albums`; return relationships<AlbumRef>(path, 'album') },
    async libraryAdd() { throw new NotImplementedError('apple', 'libraryAdd (writes are out of scope)') }, async libraryRemove() { return unsupported('libraryRemove') }, async playlistCreate() { throw new NotImplementedError('apple', 'playlistCreate (writes are out of scope)') }, async playlistAddTracks() { throw new NotImplementedError('apple', 'playlistAddTracks (writes are out of scope)') }, async playlistRemoveTracks() { return unsupported('playlistRemoveTracks') }, async playlistReorder() { return unsupported('playlistReorder') },
    async prepare(target, signal) {
      if (developerTokenNeedsRefresh()) await refreshDeveloperToken()
      const value = authorized('prepare')
      if (signal?.aborted === true || playPromise !== null || awaitingPlaybackStart) return
      const observed = stateOf(value)
      if (observed.status !== 'idle' || observed.now !== null) return
      const targetKey = playTargetKey(target)
      if (preparedKey === targetKey && preparedTarget !== null && queueMatchesTarget(value, preparedTarget, true)) return
      if (preparationPromise !== null && preparationKey === targetKey) {
        await preparationPromise
        return
      }
      const priorPreparation = preparationPromise
      const selectedGeneration = ++preparationGeneration
      preparedKey = null
      preparedTarget = null
      preparationKey = targetKey
      preparationTarget = target
      const cancel = (): void => {
        if (selectedGeneration !== preparationGeneration) return
        invalidatePreparation()
      }
      signal?.addEventListener('abort', cancel, { once: true })
      const operation = (async (): Promise<string | null> => {
        try {
          await priorPreparation?.catch(() => null)
          if (signal?.aborted === true || selectedGeneration !== preparationGeneration || playPromise !== null || awaitingPlaybackStart) return null
          const latest = stateOf(value)
          if (latest.status !== 'idle' || latest.now !== null) return null
          await setQueueForTarget(value, target)
          if (selectedGeneration === preparationGeneration) {
            preparedKey = targetKey
            preparedTarget = target
          }
          return targetKey
        } finally {
          signal?.removeEventListener('abort', cancel)
        }
      })()
      preparationPromise = operation
      try {
        await operation
      } finally {
        if (preparationPromise === operation) {
          preparationPromise = null
          preparationKey = null
          preparationTarget = null
        }
      }
    },
    async play(target) {
      if (target !== undefined && developerTokenNeedsRefresh()) await refreshDeveloperToken()
      const targetKey = target === undefined ? null : playTargetKey(target)
      if (targetKey !== null && awaitingPlaybackStart && pendingPlayKey === targetKey) return playPromise ?? Promise.resolve()
      const requestedPlay = ++playRequestGeneration
      let replacementBoundaryApplied = false
      if (playPromise !== null) {
        // A newer accepted selection owns the output. Invalidate the older
        // transaction, wait for its non-abortable MusicKit call to settle, and
        // establish a pause boundary before replacing its queue.
        const superseded = playPromise
        transactionGeneration += 1
        finishPendingPlayback()
        await superseded.catch(() => undefined)
        if (requestedPlay !== playRequestGeneration) throw new Error('Apple Music playback selection was superseded')
        const replacementPause = Promise.resolve(authorized('play').pause())
        replacementPausePromise = replacementPause
        try {
          await replacementPause
          replacementBoundaryApplied = true
        } finally {
          if (replacementPausePromise === replacementPause) replacementPausePromise = null
        }
      } else if (replacementPausePromise !== null) {
        await replacementPausePromise.catch(() => undefined)
      }
      if (requestedPlay !== playRequestGeneration) throw new Error('Apple Music playback selection was superseded')
      if (targetKey !== null && awaitingPlaybackStart) finishPendingPlayback()
      const value = authorized('play')
      const queuedPreparation = preparationPromise
      const reusablePreparationKey = preparedKey === targetKey || preparationKey === targetKey ? targetKey : null
      invalidatePreparation()
      failedPlaybackGeneration = null
      const previous = currentPlayback
      const previousQueueOffset = playbackQueueOffset
      if (target !== undefined) {
        const selectedTransaction = ++transactionGeneration
        awaitingPlaybackStart = true
        pendingPlaybackPositionMs = null
        pendingPlayKey = targetKey
        expectedNowPlayingCatalogId = target.kind === 'tracks' ? target.tracks[target.startIndex ?? 0]?.catalogId ?? null : null
        pendingCollectionKey = target.kind === 'tracks' ? null : `${target.kind}:${target.kind === 'album' ? target.album.catalogId : target.kind === 'playlist' ? target.playlist.catalogId : target.station.catalogId}`
        pendingQueueGeneration = queueGeneration
        pendingQueueFingerprint = queueFingerprint(value)
        confirmedCollectionQueueIds = null
        playbackQueueOffset = target.kind === 'tracks' ? queuePlan(target).offset : 0
        emitPlayback({ ...currentPlayback, status: 'loading', now: null, queueIndex: null, positionMs: 0, durationMs: 0 })
        const pendingKey = targetKey
        playbackConfirmationTimer = (configuredOptions.setTimeout ?? globalThis.setTimeout)(() => {
          if (!playbackEventsEnabled || selectedTransaction !== transactionGeneration || !awaitingPlaybackStart || pendingPlayKey !== pendingKey) return
          capturePlaybackDiagnostic('playbackConfirmationTimeout', undefined, playbackTargetDiagnostics(target))
          finishPendingPlayback()
          emitPlayback({ ...stateOf(value), status: 'error' })
        }, configuredOptions.playbackConfirmationTimeoutMs ?? 8_000)
      } else {
        transactionGeneration += 1
      }
      const selectedTransaction = transactionGeneration
      playPromise = (async () => {
        let queuedTarget = target
        try {
          if (target !== undefined) {
            if (queuedPreparation !== null) await queuedPreparation.catch(() => null)
            if (reusablePreparationKey !== targetKey || !queueMatchesTarget(value, target, true)) {
              const observed = stateOf(value)
              if (!replacementBoundaryApplied && (observed.now !== null || previous.now !== null || previous.status === 'playing' || previous.status === 'paused' || previous.status === 'loading')) await value.pause()
              try {
                await setQueueForTarget(value, target)
              } catch (cause) {
                if (target.kind !== 'tracks' || target.tracks.length <= 1) throw cause
                // A mixed library queue can contain stale or unavailable ids.
                // Stop the rejected replacement and retry only the selected
                // song so one bad neighbour cannot make the user's choice fail.
                await stopForQueueReplacement(value)
                const selected = selectedTrackIndex(target)
                const selectedTrack = target.tracks[selected]
                if (selectedTrack === undefined) throw cause
                playbackQueueOffset = selected
                queuedTarget = { kind: 'tracks', tracks: [selectedTrack], startIndex: 0 }
                await setQueueForTarget(value, queuedTarget)
              }
            }
          }
          if (!playbackEventsEnabled || selectedTransaction !== transactionGeneration) throw new Error('Apple Music playback selection was cancelled')
          capturePlaybackDiagnostic('playCall')
          try {
            await startQueuedTarget(value, queuedTarget, target)
          } catch (cause) {
            capturePlaybackDiagnostic('playReject', cause)
            throw cause
          }
          capturePlaybackDiagnostic('playResolve')
        } catch (cause) {
          if (playbackEventsEnabled && selectedTransaction === transactionGeneration) {
            finishPendingPlayback()
            playbackQueueOffset = previousQueueOffset
            emitPlayback(previous)
          }
          throw cause
        } finally {
          playPromise = null
        }
      })()
      return playPromise
    }, async pause() {
      const value = instance('pause')
      const pending = playPromise
      // A user pause also invalidates a replacement selection that is between
      // the superseded transaction and its mandatory pause boundary.
      playRequestGeneration += 1
      // A pause is also a cancellation boundary for queue transport. MusicKit can
      // resolve a skip before its replacement item is playable; never let that
      // older transition restart playback after the user has paused.
      transactionGeneration += 1
      if (pending !== null || awaitingPlaybackStart) {
        finishPendingPlayback()
      }
      await value.pause()
      if (pending !== null) {
        await pending.catch(() => undefined)
        await value.pause()
      }
      emitPlayback({ ...stateOf(value), status: 'paused' })
    },
    async skip(direction, count = 1) {
      await waitForPreparationBeforeQueueMutation()
      const value = instance('skip')
      const initialState = stateOf(value)
      const shouldRemainPaused = currentPlayback.status === 'paused' || initialState.status === 'paused'
      const selectedTransaction = ++transactionGeneration
      let restartedCurrentItem = false
      let changedItem = false
      for (let index = 0; index < Math.max(1, count); index += 1) {
        if (direction === 'previous' && index === 0 && (value.currentPlaybackTime ?? 0) > 3) {
          await value.seekToTime(0)
          restartedCurrentItem = true
        } else {
          await (direction === 'next' ? value.skipToNextItem() : value.skipToPreviousItem())
          changedItem = true
        }
      }
      if (shouldRemainPaused && changedItem && playbackEventsEnabled && selectedTransaction === transactionGeneration) {
        // MusicKit implicitly starts the replacement media after skip even when
        // its facade previously reported paused. Reassert the user's intent.
        await value.pause()
      }
      if (!playbackEventsEnabled || selectedTransaction !== transactionGeneration) return
      const next = stateOf(value)
      emitPlayback({ ...next, ...(restartedCurrentItem ? { positionMs: 0 } : {}), ...(shouldRemainPaused && changedItem ? { status: 'paused' as const } : {}) })
    },
    async seek(positionMs) {
      const value = instance('seek')
      await value.seekToTime(Math.min(Math.max(0, value.currentPlaybackDuration ?? 0), Math.max(0, positionMs / 1_000)))
      emitPlayback(stateOf(value))
    },
    async setVolume(level) {
      const value = instance('setVolume')
      value.volume = Math.min(100, Math.max(0, level)) / 100
      emitPlayback(stateOf(value))
    },
    async setShuffle(mode) { await waitForPreparationBeforeQueueMutation(); instance('setShuffle').shuffleMode = kit?.PlayerShuffleMode?.[mode] ?? 0 }, async setRepeat(mode) { instance('setRepeat').repeatMode = kit?.PlayerRepeatMode?.[mode] ?? 0 }, get playback() { return currentPlayback }, onPlaybackChange(callback) { playback.add(callback); return () => { playback.delete(callback) } }, onProgress(callback) { progress.add(callback); return () => { progress.delete(callback) } },
    async queueRead() {
      const queue = instance('queueRead').queue; const items = (queue?.items ?? []).map((item) => normalize(item, keyFor)).filter((item): item is TrackRef => item.kind === 'track'); const position = Math.max(0, queue?.position ?? 0); return { now: currentPlayback.now, history: items.slice(0, position), next: items.slice(position + 1) } satisfies QueueSnapshot
    }, async queueAppend(tracks) { await waitForPreparationBeforeQueueMutation(); await instance('queueAppend').playLater({ songs: tracks.map((track) => track.catalogId) }) }, async queueInsertNext(tracks) { await waitForPreparationBeforeQueueMutation(); await instance('queueInsertNext').playNext({ songs: tracks.map((track) => track.catalogId) }) }, async queueRemove() { return unsupported('queueRemove') }, async queueReorder() { return unsupported('queueReorder') },
    async stationsList() { const response = await api(`/v1/catalog/${storefront('stationsList')}/stations`); return resources(response).map((item) => normalize(item, keyFor)).filter((item): item is StationRef => item.kind === 'station') },
    async stationStart(seed) { await waitForPreparationBeforeQueueMutation(); let station: StationRef; if (seed.type === 'track') { const response = await api(`/v1/catalog/${storefront('stationStart')}/songs/${encodeURIComponent(seed.ref)}/station`); const entity = normalize(resources(response)[0], keyFor); if (entity.kind !== 'station') throw new Error('Apple station response is invalid'); station = entity } else { station = { kind: 'station', key: keyFor('stations', seed.ref), provider: 'apple', catalogId: seed.ref, name: 'Apple Music station', live: false } } const value = instance('stationStart'); if (currentPlayback.now !== null || currentPlayback.status === 'playing' || currentPlayback.status === 'paused' || currentPlayback.status === 'loading') await value.pause(); playbackQueueOffset = 0; await value.setQueue({ station: station.catalogId }); await value.play(); return station },
    async lyrics() { return unsupported('lyrics') }, async ratingSet() { throw new NotImplementedError('apple', 'ratingSet (writes are out of scope)') }, async saveToggle() { throw new NotImplementedError('apple', 'saveToggle (writes are out of scope)') },
  }
}

export function browserAppleProviderOptions(): AppleProviderOptions {
  return {
    loadMusicKit: loadMusicKitScript,
    fetchDeveloperToken: fetchAppleDeveloperToken,
    now: Date.now,
    scheduleDeveloperTokenRefresh: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    cancelDeveloperTokenRefresh: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
    setInterval: (callback, delayMs) => globalThis.setInterval(callback, delayMs),
    clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
  }
}
export async function fetchAppleDeveloperToken(fetcher: typeof fetch = fetch): Promise<{ readonly token: string; readonly expiresAt: number }> { const response = await fetcher(APPLE_DEVELOPER_TOKEN_PATH, { credentials: 'same-origin', headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(`Apple Music token service returned ${String(response.status)}`); const value = record(await response.json(), 'token service'); const token = asText(value['token']); const expiresAt = asNumber(value['expiresAt']); if (token === undefined || expiresAt === undefined) throw new Error('Apple Music token service response is invalid'); return { token, expiresAt } }
export async function loadMusicKitScript(documentRef: Document = document): Promise<MusicKitGlobalLike> {
  const existing = (globalThis as { MusicKit?: MusicKitGlobalLike }).MusicKit; if (existing !== undefined) return existing
  return new Promise((resolve, reject) => {
    const globalObject = globalThis as unknown as Record<string, unknown>
    const processDescriptor = Object.getOwnPropertyDescriptor(globalObject, 'process')
    const browserProcess = typeof globalObject['process'] === 'object' && globalObject['process'] !== null
      ? globalObject['process'] as Readonly<Record<string, unknown>>
      : undefined
    const hideBrowserProcess = browserProcess?.['versions'] === undefined && processDescriptor?.configurable !== false
    if (hideBrowserProcess) delete globalObject['process']
    const found = documentRef.querySelector<HTMLScriptElement>(`script[src="${MUSICKIT_SCRIPT_URL}"]`)
    const script = found ?? documentRef.createElement('script')
    const timeout = globalThis.setTimeout(() => failed(), 10_000)
    const restoreProcess = (): void => {
      if (!hideBrowserProcess) return
      if (processDescriptor === undefined) delete globalObject['process']
      else Object.defineProperty(globalObject, 'process', processDescriptor)
    }
    const cleanup = (): void => { globalThis.clearTimeout(timeout); documentRef.removeEventListener('musickitloaded', loaded); script.removeEventListener('error', failed); restoreProcess() }
    const loaded = (): void => {
      cleanup()
      const value = (globalThis as { MusicKit?: MusicKitGlobalLike }).MusicKit
      if (value === undefined) reject(new Error('MusicKit loaded without its global')); else resolve(value)
    }
    const failed = (): void => { cleanup(); reject(new Error('MusicKit script could not be loaded')) }
    documentRef.addEventListener('musickitloaded', loaded, { once: true }); script.addEventListener('error', failed, { once: true })
    if (found === null) { script.src = MUSICKIT_SCRIPT_URL; script.async = true; documentRef.head.append(script) }
  })
}
