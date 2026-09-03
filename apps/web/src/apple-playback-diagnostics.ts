import type { ApplePlaybackDiagnosticEventName, ApplePlaybackDiagnosticSink, ApplePlaybackDiagnosticSource } from '@webpod/providers'

export type ApplePlaybackErrorClass = 'autoplay-denied' | 'aborted' | 'network' | 'decode' | 'unsupported-source' | 'drm-or-entitlement' | 'unknown'
export interface ApplePlaybackDiagnosticEvent {
  readonly sequence: number
  readonly event: ApplePlaybackDiagnosticEventName
  readonly timestampMs: number
  readonly errorClass?: ApplePlaybackErrorClass
  readonly musicKit: { readonly playbackState: number | null; readonly currentTime: number | null; readonly duration: number | null; readonly volume: number | null }
  readonly audio: { readonly paused: boolean | null; readonly muted: boolean | null; readonly volume: number | null; readonly readyState: number | null; readonly networkState: number | null; readonly errorCode: number | null }
  readonly userActivation: { readonly isActive: boolean | null; readonly hasBeenActive: boolean | null }
}
export interface ApplePlaybackDiagnosticSnapshot { readonly enabled: boolean; readonly events: readonly ApplePlaybackDiagnosticEvent[] }

const MAX_EVENTS = 40
let sequence = 0
let snapshot: ApplePlaybackDiagnosticSnapshot = Object.freeze({ enabled: false, events: Object.freeze([]) })
const listeners = new Set<() => void>()
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null

function errorFields(value: unknown): Readonly<Record<string, unknown>> | null {
  const outer = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : null
  const detail = outer?.['detail']
  const detailRecord = typeof detail === 'object' && detail !== null && !Array.isArray(detail) ? detail as Readonly<Record<string, unknown>> : null
  const candidate = outer?.['error'] ?? detailRecord?.['error'] ?? detail ?? value
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate) ? candidate as Readonly<Record<string, unknown>> : null
}

/** Maps untrusted MusicKit errors to a closed vocabulary; raw fields never cross this boundary. */
export function classifyApplePlaybackError(value: unknown): ApplePlaybackErrorClass {
  const fields = errorFields(value)
  const name = typeof fields?.['name'] === 'string' ? fields['name'].toLowerCase() : ''
  const message = typeof fields?.['message'] === 'string' ? fields['message'].toLowerCase() : ''
  const code = fields?.['code']
  const combined = `${name} ${message}`
  if (name === 'notallowederror' || combined.includes('not allowed') || combined.includes('autoplay')) return 'autoplay-denied'
  if (name === 'aborterror' || combined.includes('abort')) return 'aborted'
  if (code === 2 || combined.includes('network')) return 'network'
  if (code === 3 || combined.includes('decode')) return 'decode'
  if (code === 4 || combined.includes('not supported') || combined.includes('unsupported')) return 'unsupported-source'
  if (combined.includes('drm') || combined.includes('fairplay') || combined.includes('entitlement') || combined.includes('key session')) return 'drm-or-entitlement'
  return 'unknown'
}

function publish(next: ApplePlaybackDiagnosticSnapshot): void {
  snapshot = Object.freeze({ ...next, events: Object.freeze([...next.events]) })
  for (const listener of listeners) listener()
}

function eventFrom(event: ApplePlaybackDiagnosticEventName, source: ApplePlaybackDiagnosticSource): ApplePlaybackDiagnosticEvent {
  const audio = source.audio
  return Object.freeze({
    sequence: ++sequence, event, timestampMs: Math.round(performance.now() * 10) / 10,
    ...(event === 'mediaPlaybackError' ? { errorClass: classifyApplePlaybackError(source.error) } : {}),
    musicKit: Object.freeze({ playbackState: finite(source.music.playbackState), currentTime: finite(source.music.currentPlaybackTime), duration: finite(source.music.currentPlaybackDuration), volume: finite(source.music.volume) }),
    audio: Object.freeze({ paused: audio?.paused ?? null, muted: audio?.muted ?? null, volume: finite(audio?.volume), readyState: finite(audio?.readyState), networkState: finite(audio?.networkState), errorCode: finite(audio?.error?.code) }),
    userActivation: Object.freeze({ isActive: source.userActivation?.isActive ?? null, hasBeenActive: source.userActivation?.hasBeenActive ?? null }),
  })
}

export const applePlaybackDiagnostics: ApplePlaybackDiagnosticSink & {
  enable(): void; disable(): void; clear(): void; getSnapshot(): ApplePlaybackDiagnosticSnapshot; subscribe(listener: () => void): () => void
} = {
  enable(): void { sequence = 0; publish({ enabled: true, events: [] }) },
  disable(): void { sequence = 0; publish({ enabled: false, events: [] }) },
  clear(): void { sequence = 0; publish({ enabled: snapshot.enabled, events: [] }) },
  getSnapshot(): ApplePlaybackDiagnosticSnapshot { return snapshot },
  subscribe(listener): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
  capture(event, source): void {
    if (!snapshot.enabled) return
    if (event === 'setQueue') { sequence = 0; publish({ enabled: true, events: [] }) }
    const captured = eventFrom(event, source())
    publish({ enabled: true, events: [...snapshot.events, captured].slice(-MAX_EVENTS) })
    console.info('[webPod:ApplePlaybackDiagnostic]', captured)
  },
}
