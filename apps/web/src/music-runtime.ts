import { createProgressiveMusicSource } from '@webpod/music-management'
import { manageMusic, musicManager } from '@webpod/music-management/playback'
import { createMusicAuth, musicAuthReady, type MusicAuthPhase, type MusicAuthSnapshot, type MusicAuthResult } from '@webpod/music-management/auth'
export { createProgressiveMusicSource as createProgressiveAppleSource } from '@webpod/music-management'
import {
  createAppleProvider,
  appleMusicAuth,
  spotifyMusicAuth,
  createSpotifyProvider,
  browserAppleProviderOptions,
  type MusicProvider,
} from '@webpod/providers'
import type { NavigationDataSource } from '@webpod/panel'
import { applePlaybackDiagnostics } from './apple-playback-diagnostics'
import { bootstrapStickerCollection, restoreStickerSession, startStickerRuntime, disconnectStickerMusic } from './sticker-runtime'

export type MusicRuntimeMode = 'apple' | 'spotify'
export type MusicRuntimePhase = MusicAuthPhase
export type MusicRuntimeSnapshot = MusicAuthSnapshot<MusicRuntimeMode, NavigationDataSource>

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
/** App composition owns storage, optional stickers and playback activation, never auth attempts. */
export function createMusicRuntimeController(provider: ReturnType<typeof createAppleProvider>, spotify: MusicProvider, stickers = {
  restore: restoreStickerSession, start: startStickerRuntime, bootstrap: bootstrapStickerCollection, disconnect: disconnectStickerMusic,
}) {
  const auth = createMusicAuth<MusicRuntimeMode, NavigationDataSource>({
    connectors: { apple: appleMusicAuth(provider), spotify: spotifyMusicAuth(spotify) },
    initialMode: 'apple', empty: emptySource,
    begin(incoming, outgoing) { musicManager(outgoing).deactivate(); musicManager(incoming).activate() },
    retire(outgoing) { musicManager(outgoing).deactivate() },
    connected(incoming) {
      musicManager(incoming).activate()
      if (incoming === provider) {
        stickers.restore(provider)
        stickers.start(provider, refresh => stickers.bootstrap(provider, refresh))
      }
    },
    async load(incoming, isCurrent) {
      const { source, completion } = await createProgressiveMusicSource(incoming, isCurrent)
      void completion
      return source
    },
  })
  let current = auth.getSnapshot()
  let mapped: MusicRuntimeSnapshot = { ...current, provider: manageMusic(current.provider) }
  const getSnapshot = (): MusicRuntimeSnapshot => {
    const next = auth.getSnapshot()
    if (next !== current) { current = next; mapped = { ...next, provider: manageMusic(next.provider) } }
    return mapped
  }
  const result = async (pending: ReturnType<typeof auth.restore>): Promise<MusicRuntimeResult> => {
    const completed = await pending
    return { ...completed, snapshot: getSnapshot(), ready: completed.ready && completed.snapshot === auth.getSnapshot() }
  }
  const selectMusicRuntime = (mode: MusicRuntimeMode) => result(auth.restore(mode))
  const authorizeAppleRuntime = () => { rememberProvider('apple'); return result(auth.authorize('apple')) }
  const authorizeMusicRuntime = (mode: MusicRuntimeMode) => { rememberProvider(mode); return result(auth.authorize(mode)) }
  const signOutAppleRuntime = async (): Promise<void> => {
    await auth.logout()
    if (auth.getSnapshot().phase === 'signed-out') { stickers.disconnect(provider); rememberProvider('apple') }
  }
  const ensureMusicRuntime = (): void => {
    if (auth.hasStarted()) return
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
  const musicLoginUrl = (mode: MusicRuntimeMode): string | undefined => { const flow = auth.getFlow(mode); return flow.flow === 'redirect' ? flow.loginUrl : undefined }
  return { musicLoginUrl, musicRuntime: { getSnapshot, subscribe: auth.subscribe }, selectMusicRuntime, authorizeAppleRuntime, authorizeMusicRuntime, signOutAppleRuntime, ensureMusicRuntime, auth }
}
export type MusicRuntimeResult = MusicAuthResult<MusicRuntimeMode, NavigationDataSource>
export const musicRuntimeReady = musicAuthReady
function rememberProvider(mode: MusicRuntimeMode): void {
  try { localStorage.setItem('webpod-music-provider', mode) } catch { /* Storage is optional. */ }
}
/** Stops an outgoing provider before its controls and status leave the screen. */
export async function quiesceMusicProvider(provider: MusicProvider): Promise<void> {
  if (provider.supports('transport') && provider.session?.status === 'authorized') await provider.pause()
}
const controller = (import.meta.hot?.data['musicAuthRuntimeController'] as ReturnType<typeof createMusicRuntimeController> | undefined)
  ?? createMusicRuntimeController(createAppleProvider(appleProviderOptions()), createSpotifyProvider())
if (import.meta.hot) import.meta.hot.data['musicAuthRuntimeController'] = controller
export const { musicRuntime, selectMusicRuntime, authorizeAppleRuntime, authorizeMusicRuntime, signOutAppleRuntime, ensureMusicRuntime, musicLoginUrl } = controller
