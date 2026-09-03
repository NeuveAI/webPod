import type { ApplePlaybackDiagnosticEventName, ApplePlaybackDiagnosticSink, ApplePlaybackDiagnosticSource } from '@webpod/providers'

export type ApplePlaybackErrorClass = 'autoplay-denied' | 'aborted' | 'network' | 'decode' | 'unsupported-source' | 'drm-or-entitlement' | 'unknown'
export type AppleMediaItemStateName = 'none' | 'loading' | 'ready' | 'playing' | 'ended' | 'unavailable' | 'restricted' | 'error' | 'unknown'
export type ApplePlaybackStateName = 'none' | 'loading' | 'playing' | 'paused' | 'stopped' | 'ended' | 'seeking' | 'waiting' | 'stalled' | 'completed' | 'unknown'
export type AppleEmeCapability = 'requestMediaKeySystemAccess unavailable' | 'widevine-supported' | 'playready-supported' | 'neither-supported' | 'probe-error'
export type AppleAudioDiagnosticEventName = 'waiting' | 'stalled' | 'canplay' | 'playing' | 'error' | 'emptied'
export type ApplePlaybackDiagnosticName = ApplePlaybackDiagnosticEventName | `audio:${AppleAudioDiagnosticEventName}`

interface NumericState<TName extends string> { readonly value: number | null; readonly name: TName | null }
export interface ApplePlaybackDiagnosticEvent {
  readonly sequence: number
  readonly event: ApplePlaybackDiagnosticName
  readonly timestampMs: number
  readonly errorClass?: ApplePlaybackErrorClass
  readonly mediaItemState?: NumericState<AppleMediaItemStateName>
  readonly playbackEventState?: NumericState<ApplePlaybackStateName>
  readonly musicKit: { readonly playbackState: number | null; readonly playbackStateName: ApplePlaybackStateName | null; readonly currentTime: number | null; readonly duration: number | null; readonly volume: number | null }
  readonly audio: { readonly paused: boolean | null; readonly muted: boolean | null; readonly volume: number | null; readonly readyState: number | null; readonly networkState: number | null; readonly errorCode: number | null }
  readonly userActivation: { readonly isActive: boolean | null; readonly hasBeenActive: boolean | null }
}
export interface ApplePlaybackDiagnosticSnapshot { readonly enabled: boolean; readonly emeCapability: AppleEmeCapability | null; readonly events: readonly ApplePlaybackDiagnosticEvent[] }

interface DiagnosticEnvironment {
  readonly development: boolean
  readonly navigatorRef?: Pick<Navigator, 'requestMediaKeySystemAccess'>
  readonly now?: () => number
}

const MAX_EVENTS = 40
const AUDIO_EVENTS: readonly AppleAudioDiagnosticEventName[] = ['waiting', 'stalled', 'canplay', 'playing', 'error', 'emptied']
const MEDIA_ITEM_STATES: Readonly<Record<number, AppleMediaItemStateName>> = { 0: 'none', 1: 'loading', 2: 'ready', 3: 'playing', 4: 'ended', 5: 'unavailable', 6: 'restricted', 7: 'error' }
const PLAYBACK_STATES: Readonly<Record<number, ApplePlaybackStateName>> = { 0: 'none', 1: 'loading', 2: 'playing', 3: 'paused', 4: 'stopped', 5: 'ended', 6: 'seeking', 8: 'waiting', 9: 'stalled', 10: 'completed' }
const EME_CONFIGURATION: readonly MediaKeySystemConfiguration[] = [{ initDataTypes: ['cenc', 'keyids'], audioCapabilities: [{ contentType: 'audio/mp4' }], distinctiveIdentifier: 'optional', persistentState: 'required' }]

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const object = (value: unknown): Readonly<Record<string, unknown>> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : null
export const appleMediaItemStateName = (value: unknown): AppleMediaItemStateName | null => { const numeric = finite(value); return numeric === null ? null : MEDIA_ITEM_STATES[numeric] ?? 'unknown' }
export const applePlaybackStateName = (value: unknown): ApplePlaybackStateName | null => { const numeric = finite(value); return numeric === null ? null : PLAYBACK_STATES[numeric] ?? 'unknown' }
const numericState = <TName extends string>(value: unknown, map: (value: unknown) => TName | null): NumericState<TName> => Object.freeze({ value: finite(value), name: map(value) })

function errorFields(value: unknown): Readonly<Record<string, unknown>> | null {
  const outer = object(value); const detail = outer?.['detail']; const detailRecord = object(detail)
  return object(outer?.['error'] ?? detailRecord?.['error'] ?? detail ?? value)
}

/** Maps untrusted MusicKit errors to a closed vocabulary; raw fields never cross this boundary. */
export function classifyApplePlaybackError(value: unknown): ApplePlaybackErrorClass {
  const fields = errorFields(value)
  const name = typeof fields?.['name'] === 'string' ? fields['name'].toLowerCase() : ''
  const message = typeof fields?.['message'] === 'string' ? fields['message'].toLowerCase() : ''
  const code = fields?.['code']; const combined = `${name} ${message}`
  if (name === 'notallowederror' || combined.includes('not allowed') || combined.includes('autoplay')) return 'autoplay-denied'
  if (name === 'aborterror' || combined.includes('abort')) return 'aborted'
  if (code === 2 || combined.includes('network')) return 'network'
  if (code === 3 || combined.includes('decode')) return 'decode'
  if (code === 4 || combined.includes('not supported') || combined.includes('unsupported')) return 'unsupported-source'
  if (combined.includes('drm') || combined.includes('fairplay') || combined.includes('entitlement') || combined.includes('key session')) return 'drm-or-entitlement'
  return 'unknown'
}

export function createApplePlaybackDiagnostics(environment: DiagnosticEnvironment): ApplePlaybackDiagnosticSink & {
  enable(): void; disable(): void; clear(): void; getSnapshot(): ApplePlaybackDiagnosticSnapshot; subscribe(listener: () => void): () => void
} {
  let sequence = 0; let generation = 0; let probed = false; let observedAudio: HTMLAudioElement | null = null; let observedSource: ApplePlaybackDiagnosticSource | null = null
  let snapshot: ApplePlaybackDiagnosticSnapshot = Object.freeze({ enabled: false, emeCapability: null, events: Object.freeze([]) })
  const listeners = new Set<() => void>()
  const now = environment.now ?? (() => performance.now())
  const publish = (next: ApplePlaybackDiagnosticSnapshot): void => { snapshot = Object.freeze({ ...next, events: Object.freeze([...next.events]) }); for (const listener of listeners) listener() }
  const append = (event: ApplePlaybackDiagnosticEvent): void => { publish({ ...snapshot, events: [...snapshot.events, Object.freeze(event)].slice(-MAX_EVENTS) }); console.info('[webPod:ApplePlaybackDiagnostic]', event) }
  const baseEvent = (event: ApplePlaybackDiagnosticName, source: ApplePlaybackDiagnosticSource): ApplePlaybackDiagnosticEvent => {
    const audio = source.audio; const playbackState = finite(source.music.playbackState)
    return { sequence: ++sequence, event, timestampMs: Math.round(now() * 10) / 10,
      musicKit: Object.freeze({ playbackState, playbackStateName: applePlaybackStateName(playbackState), currentTime: finite(source.music.currentPlaybackTime), duration: finite(source.music.currentPlaybackDuration), volume: finite(source.music.volume) }),
      audio: Object.freeze({ paused: audio?.paused ?? null, muted: audio?.muted ?? null, volume: finite(audio?.volume), readyState: finite(audio?.readyState), networkState: finite(audio?.networkState), errorCode: finite(audio?.error?.code) }),
      userActivation: Object.freeze({ isActive: source.userActivation?.isActive ?? null, hasBeenActive: source.userActivation?.hasBeenActive ?? null }) }
  }
  const audioChanged = (event: Event): void => {
    if (!snapshot.enabled || !AUDIO_EVENTS.includes(event.type as AppleAudioDiagnosticEventName)) return
    const audio = observedAudio; const source = observedSource; if (audio === null || source === null) return
    append(baseEvent(`audio:${event.type as AppleAudioDiagnosticEventName}`, { ...source, error: undefined, event: undefined, audio }))
  }
  const detachAudio = (): void => { if (observedAudio !== null) for (const name of AUDIO_EVENTS) observedAudio.removeEventListener(name, audioChanged); observedAudio = null; observedSource = null }
  const observeAudio = (source: ApplePlaybackDiagnosticSource): void => {
    const audio = source.audio
    const safeSource: ApplePlaybackDiagnosticSource = { music: source.music, audio, userActivation: source.userActivation }
    if (audio === observedAudio) { observedSource = safeSource; return }
    detachAudio()
    if (audio === null) return
    observedSource = safeSource; observedAudio = audio
    for (const name of AUDIO_EVENTS) audio.addEventListener(name, audioChanged)
  }
  const probe = (): void => {
    if (probed) return; probed = true; const selectedGeneration = generation
    const request = environment.navigatorRef?.requestMediaKeySystemAccess
    if (request === undefined) { publish({ ...snapshot, emeCapability: 'requestMediaKeySystemAccess unavailable' }); return }
    void (async () => {
      const attempt = async (keySystem: string): Promise<'supported' | 'unsupported' | 'probe-error'> => {
        let pending: Promise<MediaKeySystemAccess>
        try { pending = request.call(environment.navigatorRef, keySystem, EME_CONFIGURATION) }
        catch { return 'probe-error' }
        if (typeof pending?.then !== 'function') return 'probe-error'
        try { await pending; return 'supported' } catch { return 'unsupported' }
      }
      const widevine = await attempt('com.widevine.alpha')
      let result: AppleEmeCapability
      if (widevine === 'probe-error') result = 'probe-error'
      else if (widevine === 'supported') result = 'widevine-supported'
      else {
        const playready = await attempt('com.microsoft.playready')
        result = playready === 'probe-error' ? 'probe-error' : playready === 'supported' ? 'playready-supported' : 'neither-supported'
      }
      if (snapshot.enabled && selectedGeneration === generation) publish({ ...snapshot, emeCapability: result })
    })()
  }
  return {
    enable(): void { if (!environment.development || snapshot.enabled) return; sequence = 0; generation += 1; probed = false; publish({ enabled: true, emeCapability: null, events: [] }); probe() },
    disable(): void { generation += 1; detachAudio(); sequence = 0; probed = false; publish({ enabled: false, emeCapability: null, events: [] }) },
    clear(): void { sequence = 0; publish({ ...snapshot, events: [] }) },
    getSnapshot(): ApplePlaybackDiagnosticSnapshot { return snapshot },
    subscribe(listener): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
    capture(event, source): void {
      if (!environment.development || !snapshot.enabled) return
      if (event === 'setQueue') { sequence = 0; publish({ ...snapshot, events: [] }) }
      const value = source(); observeAudio(value); const captured = baseEvent(event, value); const payload = object(value.event)
      append(Object.freeze({ ...captured,
        ...(event === 'mediaPlaybackError' ? { errorClass: classifyApplePlaybackError(value.error) } : {}),
        ...(event === 'playbackStateDidChange' ? { playbackEventState: numericState(payload?.['state'], applePlaybackStateName) } : {}),
        ...(event === 'mediaItemStateDidChange' ? { mediaItemState: numericState(payload?.['state'], appleMediaItemStateName) } : {}),
      }))
    },
  }
}

const DEVELOPMENT_DIAGNOSTICS = import.meta.env.DEV
export const applePlaybackDiagnostics = createApplePlaybackDiagnostics({
  development: DEVELOPMENT_DIAGNOSTICS,
  ...(DEVELOPMENT_DIAGNOSTICS && typeof navigator !== 'undefined' ? { navigatorRef: navigator } : {}),
})
