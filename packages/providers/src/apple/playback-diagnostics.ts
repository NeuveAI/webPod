export type ApplePlaybackDiagnosticEventName =
  | 'setQueue'
  | 'playCall'
  | 'playResolve'
  | 'mediaItemDidChange'
  | 'playbackStateDidChange'
  | 'mediaPlaybackError'

export interface ApplePlaybackDiagnosticError {
  readonly name?: string
  readonly message?: string
  readonly code?: string | number | boolean
}

export interface ApplePlaybackDiagnosticMedia {
  readonly paused: boolean | null
  readonly muted: boolean | null
  readonly volume: number | null
  readonly readyState: number | null
  readonly networkState: number | null
  readonly errorCode: number | null
}

export interface ApplePlaybackDiagnosticSnapshot {
  readonly enabled: boolean
  readonly events: readonly ApplePlaybackDiagnosticEvent[]
}

export interface ApplePlaybackDiagnosticEvent {
  readonly sequence: number
  readonly event: ApplePlaybackDiagnosticEventName
  readonly timestampMs: number
  readonly error?: ApplePlaybackDiagnosticError
  readonly musicKit: {
    readonly playbackState: number | null
    readonly currentTime: number | null
    readonly duration: number | null
    readonly volume: number | null
  }
  readonly audio: ApplePlaybackDiagnosticMedia
  readonly userActivation: {
    readonly isActive: boolean | null
    readonly hasBeenActive: boolean | null
  }
}

export interface ApplePlaybackDiagnosticInput {
  readonly event: ApplePlaybackDiagnosticEventName
  readonly error?: unknown
  readonly playbackState?: unknown
  readonly currentTime?: unknown
  readonly duration?: unknown
  readonly volume?: unknown
  readonly audio?: Partial<ApplePlaybackDiagnosticMedia> | null
  readonly userActivation?: { readonly isActive?: unknown; readonly hasBeenActive?: unknown } | null
  readonly timestampMs?: number
}

const MAX_EVENTS = 40
const MAX_TEXT = 240
let sequence = 0
let snapshot: ApplePlaybackDiagnosticSnapshot = Object.freeze({ enabled: false, events: Object.freeze([]) })
const listeners = new Set<() => void>()

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const bool = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value
    .replace(/\b(?:blob:https?|https?):\/\/\S+/giu, '[redacted URL]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [redacted token]')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu, '[redacted token]')
    .replace(/\b[A-Za-z0-9_-]{48,}\b/gu, '[redacted identifier]')
    .slice(0, MAX_TEXT)
}

function primitiveCode(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') return text(value)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return typeof value === 'boolean' ? value : undefined
}

export function sanitizeApplePlaybackError(value: unknown): ApplePlaybackDiagnosticError | undefined {
  const outer = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : null
  const detail = outer?.['detail']
  const detailRecord = typeof detail === 'object' && detail !== null && !Array.isArray(detail) ? detail as Readonly<Record<string, unknown>> : null
  const candidate = outer?.['error'] ?? detailRecord?.['error'] ?? detail ?? value
  const error = typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate) ? candidate as Readonly<Record<string, unknown>> : null
  const name = text(error?.['name'])
  const message = text(error?.['message'])
  const code = primitiveCode(error?.['code'])
  return name === undefined && message === undefined && code === undefined ? undefined : { ...(name === undefined ? {} : { name }), ...(message === undefined ? {} : { message }), ...(code === undefined ? {} : { code }) }
}

function publish(next: ApplePlaybackDiagnosticSnapshot): void {
  snapshot = Object.freeze({ ...next, events: Object.freeze([...next.events]) })
  for (const listener of listeners) listener()
}

export const applePlaybackDiagnostics = {
  enable(): void { sequence = 0; publish({ enabled: true, events: [] }) },
  disable(): void { sequence = 0; publish({ enabled: false, events: [] }) },
  clear(): void { sequence = 0; publish({ enabled: snapshot.enabled, events: [] }) },
  getSnapshot(): ApplePlaybackDiagnosticSnapshot { return snapshot },
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
  capture(input: ApplePlaybackDiagnosticInput): void {
    if (!snapshot.enabled) return
    if (input.event === 'setQueue') { sequence = 0; publish({ enabled: true, events: [] }) }
    const event: ApplePlaybackDiagnosticEvent = Object.freeze({
      sequence: ++sequence,
      event: input.event,
      timestampMs: finite(input.timestampMs) ?? Math.round(performance.now() * 10) / 10,
      ...(input.event === 'mediaPlaybackError' ? { error: sanitizeApplePlaybackError(input.error) } : {}),
      musicKit: Object.freeze({ playbackState: finite(input.playbackState), currentTime: finite(input.currentTime), duration: finite(input.duration), volume: finite(input.volume) }),
      audio: Object.freeze({
        paused: bool(input.audio?.paused), muted: bool(input.audio?.muted), volume: finite(input.audio?.volume),
        readyState: finite(input.audio?.readyState), networkState: finite(input.audio?.networkState), errorCode: finite(input.audio?.errorCode),
      }),
      userActivation: Object.freeze({ isActive: bool(input.userActivation?.isActive), hasBeenActive: bool(input.userActivation?.hasBeenActive) }),
    })
    publish({ enabled: true, events: [...snapshot.events, event].slice(-MAX_EVENTS) })
    console.info('[webPod:ApplePlaybackDiagnostic]', event)
  },
}
