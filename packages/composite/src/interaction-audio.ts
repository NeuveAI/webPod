import {
  interactionFeedbackAtom,
  type DeviceStore,
  type InteractionFeedbackEvent,
} from '@webpod/state'

/** Maximum audible wheel ticks per second, from the clicker contract. */
export const WHEEL_TICK_RATE_HZ = 30

/** Maximum voices that may be active or scheduled at once. */
export const MAX_INTERACTION_AUDIO_VOICES = 12

/** Maximum feedback events retained while the first activation resumes. */
export const MAX_PENDING_FEEDBACK_EVENTS = 8

/** The clicker's allowed random pitch range around its nominal frequency. */
export const WHEEL_PITCH_JITTER = 0.02

const WHEEL_TICK_DURATION_SECONDS = 0.008
const SELECT_CLICK_DURATION_SECONDS = 0.016
const BUTTON_CLICK_DURATION_SECONDS = 0.012
const MAX_WHEEL_QUEUE_AHEAD_SECONDS =
  (MAX_INTERACTION_AUDIO_VOICES - 1) / WHEEL_TICK_RATE_HZ

/** A sound that the backend can synthesize without an external asset. */
export type InteractionVoiceKind = 'wheel' | 'select' | 'button'

/**
 * Complete, deterministic instructions for one short procedural voice.
 * Tests inject a graph backend and assert these values before a browser ever
 * touches the real audio hardware.
 */
export type InteractionVoiceSpec = {
  readonly kind: InteractionVoiceKind
  readonly startTimeSeconds: number
  readonly durationSeconds: number
  readonly filter: 'bandpass' | 'lowpass'
  readonly filterFrequencyHz: number
  readonly filterQ: number
  readonly peakGain: number
  readonly playbackRate: number
}

/** A scheduled voice whose resources can be stopped before natural completion. */
export type InteractionAudioVoice = {
  stop(): void
}

/** Narrow lifecycle surface implemented by the browser Web Audio graph. */
export type InteractionAudioBackend = {
  readonly state: AudioContextState | 'interrupted'
  readonly currentTime: number
  resume(): Promise<void>
  suspend(): Promise<void>
  close(): Promise<void>
  schedule(spec: InteractionVoiceSpec, onEnded: () => void): InteractionAudioVoice
}

/** Why one feedback request did or did not schedule sound. */
export type InteractionAudioReason =
  | 'scheduled'
  | 'budget-zero'
  | 'silenced'
  | 'disabled'
  | 'not-activated'
  | 'unlocking'
  | 'unsupported'
  | 'context-suspended'
  | 'context-closed'
  | 'voice-cap'
  | 'rate-limit'
  | 'graph-failed'
  | 'disposed'

/** Structured result for every request; failures never need console output. */
export type InteractionAudioResult = {
  readonly status: 'scheduled' | 'silent' | 'deferred' | 'unavailable'
  readonly reason: InteractionAudioReason
  readonly requested: number
  readonly scheduled: number
  readonly dropped: number
}

/** Result of creating or resuming the audio context after human activation. */
export type InteractionAudioActivationResult = {
  readonly status: 'running' | 'unavailable' | 'failed' | 'interrupted' | 'disposed'
  readonly reason: 'running' | 'unsupported' | 'resume-failed' | 'interrupted' | 'disposed'
}

/** Inspectable bounded counters used by diagnostics and leak tests. */
export type InteractionAudioSnapshot = {
  readonly lifecycle:
    | 'locked'
    | 'activating'
    | 'running'
    | 'suspended'
    | 'unsupported'
    | 'failed'
    | 'disposed'
  readonly enabled: boolean
  readonly activeVoices: number
  readonly pendingEvents: number
  readonly scheduledTotal: number
  readonly droppedTotal: number
  readonly lastResult: InteractionAudioResult | null
}

/** Dependencies for a deterministic, browser-independent audio scheduler. */
export type InteractionAudioDependencies = {
  readonly createBackend: () => InteractionAudioBackend | null
  readonly random?: () => number
}

/** Lifecycle and scheduling API consumed by the composite browser boundary. */
export type InteractionAudioRuntime = {
  activate(): Promise<InteractionAudioActivationResult>
  consume(event: InteractionFeedbackEvent): InteractionAudioResult
  setEnabled(enabled: boolean): void
  interrupt(): Promise<void>
  snapshot(): InteractionAudioSnapshot
  dispose(): void
}

const silentResult = (
  reason: InteractionAudioReason,
  requested: number,
): InteractionAudioResult => ({
  status: reason === 'unlocking' ? 'deferred' : 'silent',
  reason,
  requested,
  scheduled: 0,
  dropped: requested,
})

/**
 * Creates the bounded clicker scheduler.
 *
 * It never constructs an audio backend until {@link InteractionAudioRuntime.activate}
 * runs from a trusted browser activation. Feedback before activation is not
 * replayed later; feedback arriving while that activation is resolving is held
 * in a small bounded queue so the first physical click is not lost.
 */
export function createInteractionAudioRuntime(
  dependencies: InteractionAudioDependencies,
): InteractionAudioRuntime {
  const random = dependencies.random ?? Math.random
  let backend: InteractionAudioBackend | null = null
  let activation: Promise<InteractionAudioActivationResult> | null = null
  let lifecycle: InteractionAudioSnapshot['lifecycle'] = 'locked'
  let enabled = true
  let disposed = false
  let activationEpoch = 0
  let nextWheelStartSeconds = 0
  let scheduledTotal = 0
  let droppedTotal = 0
  let lastResult: InteractionAudioResult | null = null
  const pending: InteractionFeedbackEvent[] = []
  const voices = new Set<InteractionAudioVoice>()

  const remember = (result: InteractionAudioResult): InteractionAudioResult => {
    scheduledTotal += result.scheduled
    droppedTotal += result.dropped
    lastResult = result
    return result
  }

  const stopVoices = () => {
    for (const voice of [...voices]) voice.stop()
    voices.clear()
    nextWheelStartSeconds = 0
  }

  const clearPending = () => {
    for (const event of pending) droppedTotal += normalizedTicks(event.clickerTicks)
    pending.length = 0
  }

  const scheduleEvent = (event: InteractionFeedbackEvent): InteractionAudioResult => {
    const requested = normalizedTicks(event.clickerTicks)
    if (requested === 0) return remember(silentResult('budget-zero', 0))
    if (event.silenced) return remember(silentResult('silenced', requested))
    if (!enabled) return remember(silentResult('disabled', requested))
    if (disposed) return remember({
      status: 'unavailable',
      reason: 'disposed',
      requested,
      scheduled: 0,
      dropped: requested,
    })
    if (lifecycle === 'unsupported') return remember({
      status: 'unavailable',
      reason: 'unsupported',
      requested,
      scheduled: 0,
      dropped: requested,
    })
    if (lifecycle === 'failed' && backend === null) return remember({
      status: 'unavailable',
      reason: 'graph-failed',
      requested,
      scheduled: 0,
      dropped: requested,
    })
    if (backend === null) return remember(silentResult('not-activated', requested))
    if (backend.state === 'closed') return remember({
      status: 'unavailable',
      reason: 'context-closed',
      requested,
      scheduled: 0,
      dropped: requested,
    })
    if (backend.state !== 'running') {
      if (
        lifecycle === 'activating' &&
        activation !== null &&
        pending.length < MAX_PENDING_FEEDBACK_EVENTS
      ) {
        pending.push(event)
        return remember({
          status: 'deferred',
          reason: 'unlocking',
          requested,
          scheduled: 0,
          dropped: 0,
        })
      }
      return remember(silentResult('context-suspended', requested))
    }

    const kind = voiceKind(event)
    let scheduled = 0
    let limitedBy: InteractionAudioReason = 'scheduled'
    for (let index = 0; index < requested; index += 1) {
      if (voices.size >= MAX_INTERACTION_AUDIO_VOICES) {
        limitedBy = 'voice-cap'
        break
      }
      const now = backend.currentTime
      const startTimeSeconds =
        kind === 'wheel' ? Math.max(now, nextWheelStartSeconds) : now
      if (
        kind === 'wheel' &&
        startTimeSeconds - now > MAX_WHEEL_QUEUE_AHEAD_SECONDS
      ) {
        limitedBy = 'rate-limit'
        break
      }

      const spec = voiceSpec(kind, startTimeSeconds, random)
      let voice: InteractionAudioVoice | null = null
      try {
        voice = backend.schedule(spec, () => {
          if (voice !== null) voices.delete(voice)
        })
      } catch {
        limitedBy = 'graph-failed'
        break
      }
      voices.add(voice)
      scheduled += 1
      if (kind === 'wheel') {
        nextWheelStartSeconds = startTimeSeconds + 1 / WHEEL_TICK_RATE_HZ
      }
    }

    const dropped = requested - scheduled
    return remember({
      status: scheduled > 0 ? 'scheduled' : 'unavailable',
      reason: dropped === 0 ? 'scheduled' : limitedBy,
      requested,
      scheduled,
      dropped,
    })
  }

  const flushPending = () => {
    const queued = pending.splice(0)
    for (const event of queued) scheduleEvent(event)
  }

  return {
    activate() {
      if (disposed) {
        return Promise.resolve({ status: 'disposed', reason: 'disposed' })
      }
      if (activation !== null) return activation
      if (backend?.state === 'running') {
        lifecycle = 'running'
        flushPending()
        return Promise.resolve({ status: 'running', reason: 'running' })
      }
      if (backend?.state === 'closed') backend = null
      if (backend === null) {
        try {
          backend = dependencies.createBackend()
        } catch {
          lifecycle = 'failed'
          return Promise.resolve({ status: 'failed', reason: 'resume-failed' })
        }
        if (backend === null) {
          lifecycle = 'unsupported'
          return Promise.resolve({ status: 'unavailable', reason: 'unsupported' })
        }
      }

      if (backend.state === 'running') {
        lifecycle = 'running'
        flushPending()
        return Promise.resolve({ status: 'running', reason: 'running' })
      }

      lifecycle = 'activating'
      const current = backend
      const epoch = activationEpoch
      activation = current.resume().then<
        InteractionAudioActivationResult,
        InteractionAudioActivationResult
      >(
        () => {
          if (disposed) return { status: 'disposed', reason: 'disposed' }
          if (epoch !== activationEpoch || !enabled) {
            if (current.state === 'running') {
              void current.suspend().catch(() => undefined)
            }
            lifecycle = 'suspended'
            clearPending()
            return { status: 'interrupted', reason: 'interrupted' }
          }
          if (current.state !== 'running') {
            lifecycle = 'failed'
            clearPending()
            return { status: 'failed', reason: 'resume-failed' }
          }
          lifecycle = 'running'
          flushPending()
          return { status: 'running', reason: 'running' }
        },
        () => {
          lifecycle = 'failed'
          clearPending()
          return { status: 'failed', reason: 'resume-failed' }
        },
      ).finally(() => {
        activation = null
      })
      return activation
    },

    consume: scheduleEvent,

    setEnabled(nextEnabled) {
      enabled = nextEnabled
      if (enabled) return
      activationEpoch += 1
      clearPending()
      stopVoices()
      if (backend?.state === 'running') {
        void backend.suspend().catch(() => undefined)
      }
      lifecycle = backend === null ? 'locked' : 'suspended'
    },

    async interrupt() {
      if (disposed) return
      activationEpoch += 1
      clearPending()
      stopVoices()
      if (backend !== null && backend.state === 'running') {
        try {
          await backend.suspend()
        } catch {
          lifecycle = 'failed'
          return
        }
      }
      if (backend !== null) lifecycle = 'suspended'
    },

    snapshot() {
      return {
        lifecycle,
        enabled,
        activeVoices: voices.size,
        pendingEvents: pending.length,
        scheduledTotal,
        droppedTotal,
        lastResult,
      }
    },

    dispose() {
      if (disposed) return
      disposed = true
      activationEpoch += 1
      lifecycle = 'disposed'
      clearPending()
      stopVoices()
      const current = backend
      backend = null
      if (current !== null && current.state !== 'closed') {
        void current.close().catch(() => undefined)
      }
    },
  }
}

/** Event targets needed to bind activation and interruption lifecycle. */
export type InteractionAudioBrowserTargets = {
  readonly root: EventTarget
  readonly documentTarget: EventTarget & { readonly hidden: boolean }
  readonly windowTarget: EventTarget
  readonly isHumanActivation?: (event: Event) => boolean
  readonly onSnapshot?: (snapshot: InteractionAudioSnapshot) => void
}

/**
 * Subscribes one runtime to the authoritative store stream and browser
 * lifecycle. Only trusted pointer/key events activate Web Audio by default.
 */
export function attachInteractionAudioRuntime(
  runtime: InteractionAudioRuntime,
  store: DeviceStore,
  targets: InteractionAudioBrowserTargets,
): () => void {
  const isHumanActivation = targets.isHumanActivation ?? ((event: Event) => event.isTrusted)
  const report = () => targets.onSnapshot?.(runtime.snapshot())
  const activate: EventListener = (event) => {
    if (!isHumanActivation(event)) return
    void runtime.activate().then(report)
  }
  const interrupt: EventListener = () => {
    void runtime.interrupt().then(report)
  }
  const visibility: EventListener = () => {
    if (targets.documentTarget.hidden) void runtime.interrupt().then(report)
  }
  const unsubscribe = store.sub(interactionFeedbackAtom, () => {
    const event = store.get(interactionFeedbackAtom)
    if (event !== null) {
      runtime.consume(event)
      report()
    }
  })

  targets.root.addEventListener('pointerdown', activate, { capture: true })
  targets.root.addEventListener('keydown', activate, { capture: true })
  targets.documentTarget.addEventListener('visibilitychange', visibility)
  targets.windowTarget.addEventListener('blur', interrupt)
  report()

  return () => {
    unsubscribe()
    targets.root.removeEventListener('pointerdown', activate, { capture: true })
    targets.root.removeEventListener('keydown', activate, { capture: true })
    targets.documentTarget.removeEventListener('visibilitychange', visibility)
    targets.windowTarget.removeEventListener('blur', interrupt)
  }
}

function normalizedTicks(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function voiceKind(event: InteractionFeedbackEvent): InteractionVoiceKind {
  if (event.control === 'wheel') return 'wheel'
  return event.button === 'center' ? 'select' : 'button'
}

function voiceSpec(
  kind: InteractionVoiceKind,
  startTimeSeconds: number,
  random: () => number,
): InteractionVoiceSpec {
  if (kind === 'wheel') {
    const boundedRandom = Math.min(1, Math.max(0, finiteOrHalf(random())))
    return {
      kind,
      startTimeSeconds,
      durationSeconds: WHEEL_TICK_DURATION_SECONDS,
      filter: 'bandpass',
      filterFrequencyHz: 3000,
      filterQ: 0.9,
      peakGain: 0.05,
      playbackRate: 1 - WHEEL_PITCH_JITTER + boundedRandom * WHEEL_PITCH_JITTER * 2,
    }
  }
  if (kind === 'select') {
    return {
      kind,
      startTimeSeconds,
      durationSeconds: SELECT_CLICK_DURATION_SECONDS,
      filter: 'lowpass',
      filterFrequencyHz: 4200,
      filterQ: 0.7,
      peakGain: 0.075,
      playbackRate: 1,
    }
  }
  return {
    kind,
    startTimeSeconds,
    durationSeconds: BUTTON_CLICK_DURATION_SECONDS,
    filter: 'lowpass',
    filterFrequencyHz: 4800,
    filterQ: 0.7,
    peakGain: 0.06,
    playbackRate: 1,
  }
}

function finiteOrHalf(value: number): number {
  return Number.isFinite(value) ? value : 0.5
}
