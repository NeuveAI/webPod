import { atom, createStore } from 'jotai/vanilla'
import type { MusicAuthConnector, MusicProvider } from '@webpod/providers'

export type MusicAuthPhase = 'signed-out' | 'signing-in' | 'authorized' | 'permission-denied' | 'error'
export interface MusicAuthSnapshot<Mode extends string, Data> {
  readonly requestedMode: Mode
  readonly activeMode: Mode
  readonly phase: MusicAuthPhase
  readonly provider: MusicProvider
  readonly source: Data
  readonly message: string | null
}
export interface MusicAuthResult<Mode extends string, Data> {
  readonly snapshot: MusicAuthSnapshot<Mode, Data>
  readonly ready: boolean
  readonly redirect?: string
}
export function musicAuthReady(snapshot: { readonly phase: MusicAuthPhase; readonly provider: MusicProvider }): boolean {
  return snapshot.phase === 'authorized' && snapshot.provider.session?.status === 'authorized'
}

/** Owns auth attempts and initial-data readiness, independently of transport/queue state. */
export function createMusicAuth<Mode extends string, Data>(options: {
  readonly connectors: Readonly<Record<Mode, MusicAuthConnector>>
  readonly initialMode: Mode
  readonly empty: Data
  readonly load: (provider: MusicProvider, isCurrent: () => boolean) => Promise<Data>
  readonly begin?: (incoming: MusicProvider, outgoing: MusicProvider) => void
  readonly retire?: (provider: MusicProvider) => void
  readonly connected?: (provider: MusicProvider) => void
}) {
  const store = createStore()
  const state = atom<MusicAuthSnapshot<Mode, Data>>({ requestedMode: options.initialMode, activeMode: options.initialMode, phase: 'signing-in', provider: options.connectors[options.initialMode].provider, source: options.empty, message: null })
  let generation = 0
  let disposed = false
  let stopSession: (() => void) | undefined
  const snapshot = () => store.get(state)
  const publish = (next: MusicAuthSnapshot<Mode, Data>) => store.set(state, next)
  const run = async (mode: Mode, action: 'restore' | 'authorize' | 'logout'): Promise<MusicAuthResult<Mode, Data>> => {
    if (disposed) return { snapshot: snapshot(), ready: false }
    const id = ++generation
    const connector = options.connectors[mode]
    const provider = connector.provider
    const outgoing = snapshot().provider
    stopSession?.(); stopSession = undefined
    if (action === 'logout') options.retire?.(outgoing)
    else options.begin?.(provider, outgoing)
    publish({ requestedMode: mode, activeMode: mode, phase: 'signing-in', provider, source: options.empty, message: null })
    const current = () => !disposed && generation === id
    let observedSession = provider.session
    let loading = false
    stopSession = provider.onSessionChange(session => {
      if (!current() || session === observedSession) return
      observedSession = session
      options.retire?.(provider)
      if (loading || snapshot().phase === 'authorized') {
        generation += 1
        publish({ ...snapshot(), phase: loading && session === null ? 'error' : 'signed-out', source: options.empty, message: 'Your music session changed. Please connect again.' })
      }
    })
    try {
      if (action === 'logout') {
        await connector.logout()
        if (current()) publish({ ...snapshot(), phase: 'signed-out', source: options.empty, message: null })
      } else if (action === 'authorize' && connector.flow === 'redirect') {
        publish({ ...snapshot(), phase: 'signed-out' })
        return { snapshot: snapshot(), ready: false, redirect: connector.loginUrl }
      } else {
        if (action === 'authorize' && connector.flow === 'gesture') await connector.authorize()
        else await connector.restore()
        if (!current()) return { snapshot: snapshot(), ready: false }
        if (provider.session?.status !== 'authorized') {
          publish({ ...snapshot(), phase: 'signed-out', message: action === 'authorize' ? 'Access wasn’t granted. Please try again.' : null })
        } else {
          options.connected?.(provider)
          loading = true
          const source = await options.load(provider, current)
          loading = false
          if (current() && provider.session?.status === 'authorized') publish({ ...snapshot(), phase: 'authorized', source, message: null })
        }
      }
    } catch (cause) {
      if (current()) {
        options.retire?.(provider)
        const denied = cause instanceof Error && '_tag' in cause && cause._tag === 'NotAuthorized'
        publish({ ...snapshot(), phase: denied ? 'permission-denied' : 'error', source: options.empty, message: denied ? 'Access wasn’t granted. Please connect again.' : `Couldn’t connect to ${provider.displayName}. Please try again.` })
      }
    }
    return { snapshot: snapshot(), ready: current() && musicAuthReady(snapshot()) }
  }
  return {
    getSnapshot: snapshot,
    subscribe: (listener: () => void) => store.sub(state, listener),
    restore: (mode: Mode) => run(mode, 'restore'),
    authorize: (mode: Mode) => run(mode, 'authorize'),
    logout: () => run(snapshot().activeMode, 'logout'),
    getFlow: (mode: Mode) => options.connectors[mode],
    hasStarted: () => generation !== 0,
    dispose() { if (disposed) return; disposed = true; generation += 1; stopSession?.(); stopSession = undefined; options.retire?.(snapshot().provider); publish({ ...snapshot(), phase: 'signed-out', source: options.empty, message: null }) },
  }
}
