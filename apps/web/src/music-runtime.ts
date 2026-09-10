import { createProgressiveMusicSource, manageMusic, musicManager } from '@webpod/music-management'
export { createProgressiveMusicSource as createProgressiveAppleSource } from '@webpod/music-management'
import {
  createAppleProvider,
  createSpotifyProvider,
  browserAppleProviderOptions,
  type MusicProvider,
} from '@webpod/providers'
import type { NavigationDataSource } from '@webpod/panel'
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
  return { provider, spotify: createSpotifyProvider(), snapshot: { requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider: manageMusic(provider), source: emptySource, message: null }, operation: 0, listeners: new Set() }
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

/** Selects the production Apple Music runtime. */
export async function selectMusicRuntime(mode: MusicRuntimeMode): Promise<void> {
  musicManager(runtimeState.snapshot.provider).deactivate()
  const selectedOperation = ++runtimeState.operation
  if (mode === 'spotify') { await selectSpotifyRuntime(selectedOperation); return }
  const provider = runtimeState.provider
  musicManager(provider).activate()
  publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider: manageMusic(provider), source: emptySource, message: null })
  try {
    restoreStickerSession(provider)
    await provider.configure()
    if (selectedOperation !== runtimeState.operation) return
    if (provider.session?.status !== 'authorized') { restoreStickerSession(provider); publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signed-out', provider: manageMusic(provider), source: emptySource, message: null }); return }
    restoreStickerSession(provider)
    startStickerRuntime(provider, (refresh) => bootstrapStickerCollection(provider, refresh))
    const { source, completion } = await createProgressiveMusicSource(provider, () => selectedOperation === runtimeState.operation); if (selectedOperation !== runtimeState.operation) return
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider: manageMusic(provider), source, message: null })
    void completion
  } catch (cause) {
    if (selectedOperation !== runtimeState.operation) return
    const message = failureMessage('library loading', cause)
    try {
      await quiesceMusicProvider(provider)
    } catch (pauseCause) {
      if (selectedOperation === runtimeState.operation) publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider: manageMusic(provider), source: emptySource, message: failureMessage('runtime switch', pauseCause) })
      return
    }
    if (selectedOperation === runtimeState.operation) publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider: manageMusic(provider), source: emptySource, message })
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
  musicManager(runtimeState.snapshot.provider).deactivate()
  const selectedOperation = ++runtimeState.operation
  const provider = runtimeState.provider
  musicManager(provider).activate()
  rememberProvider('apple')
  restoreStickerSession(provider)
  publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signing-in', provider: manageMusic(provider), source: emptySource, message: null })
  try {
    try { await provider.authorize() } catch (cause) {
      if (selectedOperation !== runtimeState.operation) return
      const denied = provider.appleSessionState.status === 'permission-denied'
      if (denied) disconnectStickerMusic(provider)
      publish({ requestedMode: 'apple', activeMode: 'apple', phase: denied ? 'permission-denied' : 'error', provider: manageMusic(provider), source: emptySource, message: failureMessage('authorization', cause) })
      return
    }
    if (selectedOperation !== runtimeState.operation) return
    startStickerRuntime(provider, (refresh) => bootstrapStickerCollection(provider, refresh))
    try {
      const { source, completion } = await createProgressiveMusicSource(provider, () => selectedOperation === runtimeState.operation); if (selectedOperation !== runtimeState.operation) return
      publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'authorized', provider: manageMusic(provider), source, message: null })
      void completion
    } catch (cause) {
      if (selectedOperation !== runtimeState.operation) return
      publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider: manageMusic(provider), source: emptySource, message: failureMessage('library loading', cause) })
    }
  } catch (cause) {
    if (selectedOperation !== runtimeState.operation) return
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'error', provider: manageMusic(provider), source: emptySource, message: failureMessage('configuration', cause) })
  }
}

/** Invalidates the MusicKit user session and returns to the signed-out Apple frame. */
export async function signOutAppleRuntime(): Promise<void> {
  musicManager(runtimeState.snapshot.provider).deactivate()
  const selectedOperation = ++runtimeState.operation
  if (runtimeState.snapshot.activeMode === 'spotify') {
    const provider = runtimeState.spotify
    try { await manageMusic(provider).unauthorize() } catch {
      publish({ ...runtimeState.snapshot, phase: 'error', message: 'Could not sign out of Spotify. Please try again.' })
      return
    }
    rememberProvider('apple')
    if (selectedOperation === runtimeState.operation) publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'signed-out', provider: manageMusic(provider), source: emptySource, message: null })
    return
  }
  const provider = runtimeState.provider
  publish({ ...runtimeState.snapshot, phase: 'signing-in', message: null })
  try {
    await manageMusic(provider).unauthorize()
    if (selectedOperation !== runtimeState.operation) return
    disconnectStickerMusic(provider)
    publish({ requestedMode: 'apple', activeMode: 'apple', phase: 'signed-out', provider: manageMusic(provider), source: emptySource, message: null })
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
  musicManager(provider).activate()
  publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'signing-in', provider: manageMusic(provider), source: emptySource, message: null })
  try {
    await provider.configure()
    if (operation !== runtimeState.operation) return
    if (provider.session?.status !== 'authorized') {
      publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'signed-out', provider: manageMusic(provider), source: emptySource, message: null })
      return
    }
    rememberProvider('spotify')
    const { source, completion } = await createProgressiveMusicSource(provider, () => operation === runtimeState.operation)
    if (operation !== runtimeState.operation) return
    publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'authorized', provider: manageMusic(provider), source, message: null })
    void completion
  } catch (cause) {
    if (operation !== runtimeState.operation) return
    publish({ requestedMode: 'spotify', activeMode: 'spotify', phase: 'error', provider: manageMusic(provider), source: emptySource, message: cause instanceof Error ? cause.message : 'Could not connect to Spotify. Please try again.' })
  }
}
