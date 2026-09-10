import { createAppleProvider, type MusicKitGlobalLike, type MusicKitInstanceLike } from './apple-provider'
type FakeMusic = MusicKitInstanceLike & {
  readonly api: MusicKitInstanceLike['api'] & { readonly library: NonNullable<MusicKitInstanceLike['api']['library']> }
  emit(name: string, event?: unknown): void
  setNowPlaying(item: unknown): void
  setPlaybackState(state: number): void
  setCurrentPlaybackTime(seconds: number): void
  setQueueContainer(container: unknown): void
  setQueueItems(items: readonly unknown[]): void
  setQueuePosition(position: number | undefined): void
  removed: string[]
  calls: string[]
  queueDescriptors: Readonly<Record<string, unknown>>[]
}

export function fakeMusic(): FakeMusic {
  const listeners = new Map<string, Set<(event: unknown) => void>>(); const calls: string[] = []; const removed: string[] = []
  const queueDescriptors: Readonly<Record<string, unknown>>[] = []; let nowPlaying: unknown; let playbackState = 3; let currentPlaybackTime = 12; let queueContainer: unknown; let queueItems: readonly unknown[] = []; let queuePosition: number | undefined
  const empty = async () => ({ data: { data: [] } })
  const tracks = async () => [{ id: 'song.1', type: 'library-songs', attributes: { name: 'Night', artistName: 'Artist', durationInMillis: 180000, playParams: { catalogId: 'catalog-song.1' } } }]
  const albums = async () => [{ id: 'album.1', type: 'library-albums', attributes: { name: 'Album', artistName: 'Artist', trackCount: 1 } }]
  return {
    api: {
      library: {
        albums, artists: empty,
        async playlists() { return { data: { data: [{ id: 'p.1', type: 'library-playlists', attributes: { name: 'Focus', canEdit: true, playParams: { globalId: 'pl.1' } } }], meta: { total: 1 } } } },
        songs: tracks, search: empty, albumRelationship: tracks, artistRelationship: albums, playlistRelationship: tracks,
      },
      search: empty, artistRelationship: albums, playlistRelationship: tracks, songRelationship: tracks, station: empty, stations: empty,
    },
    isAuthorized: true, storefrontId: 'se', volume: 0.5, shuffleMode: 0, repeatMode: 0, get playbackState() { return playbackState }, get currentPlaybackTime() { return currentPlaybackTime }, currentPlaybackDuration: 240,
    get nowPlayingItem() { return nowPlaying },
    get queue() { return queueItems.length === 0 && queuePosition === undefined && queueContainer === undefined ? undefined : { items: queueItems, position: queuePosition, itemContainer: queueContainer } },
    async authorize() { calls.push('authorize'); return 'opaque-user' }, async unauthorize() { calls.push('unauthorize') }, async setQueue(descriptor) { calls.push('setQueue'); queueDescriptors.push(descriptor); return { items: [] } }, async play() { calls.push('play') }, async pause() { calls.push('pause') }, async skipToNextItem() { calls.push('next') }, async skipToPreviousItem() { calls.push('previous') }, async seekToTime(value) { calls.push(`seek:${String(value)}`); currentPlaybackTime = value }, async playLater() { calls.push('later') }, async playNext() { calls.push('nextQueue') },
    addEventListener(name, callback) { const set = listeners.get(name) ?? new Set(); set.add(callback); listeners.set(name, set) }, removeEventListener(name, callback) { listeners.get(name)?.delete(callback); removed.push(name) }, emit(name, event = {}) { for (const callback of listeners.get(name) ?? []) callback(event) }, setNowPlaying(item) { nowPlaying = item }, setPlaybackState(state) { playbackState = state }, setCurrentPlaybackTime(seconds) { currentPlaybackTime = seconds }, setQueueContainer(container) { queueContainer = container }, setQueueItems(items) { queueItems = items }, setQueuePosition(position) { queuePosition = position }, removed, calls, queueDescriptors,
  }
}
export function setup(timing: Pick<NonNullable<Parameters<typeof createAppleProvider>[0]>, 'playbackConfirmationTimeoutMs' | 'setTimeout' | 'clearTimeout' | 'progressPollIntervalMs' | 'setInterval' | 'clearInterval' | 'playbackDiagnostics' | 'runtimeGlobal'> = {}) { const music = fakeMusic(); const kit: MusicKitGlobalLike = { async configure() { return music }, getInstance() { return music }, PlaybackStates: { loading: 1, paused: 2, playing: 3, waiting: 8 }, PlayerShuffleMode: { off: 0, songs: 1, albums: 2 }, PlayerRepeatMode: { off: 0, one: 1, all: 2 } }; return { music, provider: createAppleProvider({ async loadMusicKit() { return kit }, async fetchDeveloperToken() { return { token: 'test-token-never-logged', expiresAt: 4_102_444_800 } }, setTimeout: () => 1, clearTimeout() {}, ...timing }) } }

