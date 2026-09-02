import {
  interactionFeedbackAtom,
  isHumanActor,
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
const BUTTON_DOWN_DURATION_SECONDS = 0.014
const BUTTON_UP_DURATION_SECONDS = 0.01

/** A sound that the backend can synthesize without an external asset. */
export type InteractionVoiceKind = 'wheel' | 'button-down' | 'button-up'

/** The five switches physically actuated by a human hand on the click wheel. */
export type InteractionAudioButton =
  | 'center'
  | 'menu'
  | 'previous'
  | 'next'
  | 'play-pause'

/** Stable identity and timing for one physical button contact. */
export type InteractionAudioButtonDown = {
  readonly id: string
  readonly button: InteractionAudioButton
  readonly source: 'pointer' | 'key'
  readonly timestampMs: number
}

/** The actual terminal edge of an admitted physical button contact. */
export type InteractionAudioButtonUp = {
  readonly id: string
  readonly timestampMs: number
  readonly reason: 'release' | 'cancel' | 'lost-capture' | 'blur' | 'hidden'
}

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
  | 'graph-failed'
  | 'duplicate-contact'
  | 'orphan-release'
  | 'disposed'

/** Structured result for every request; failures never need console output. */
export type InteractionAudioResult = {
  readonly status: 'scheduled' | 'silent' | 'deferred' | 'unavailable'
  readonly reason: InteractionAudioReason
  readonly requested: number
  readonly scheduled: number
  readonly dropped: number
}

/** Result of creating or resuming the audio context after an eligible activation event. */
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
  readonly activeButtonContacts: number
  readonly reservedButtonReleases: number
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
  buttonDown(contact: InteractionAudioButtonDown): InteractionAudioResult
  buttonUp(contact: InteractionAudioButtonUp): InteractionAudioResult
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
 * runs from an eligible browser activation event. Event eligibility satisfies
 * autoplay policy. Wheel actor provenance comes from state; physical button
 * phases enter only through the typed human pointer/key seam.
 * Feedback before activation is not replayed later; feedback arriving while
 * that activation is resolving is held in a small bounded queue so the first
 * physical click is not lost.
 */
export function createInteractionAudioRuntime(
  dependencies: InteractionAudioDependencies,
): InteractionAudioRuntime {
  const random = dependencies.random ?? Math.random
  let backend: InteractionAudioBackend | null = null
  let activation: {
    readonly operation: number
    readonly promise: Promise<InteractionAudioActivationResult>
  } | null = null
  let lifecycle: InteractionAudioSnapshot['lifecycle'] = 'locked'
  let enabled = true
  let disposed = false
  let lifecycleOperation = 0
  let nextWheelStartSeconds = 0
  let scheduledTotal = 0
  let droppedTotal = 0
  let lastResult: InteractionAudioResult | null = null
  type ActiveButtonContact = {
    readonly down: InteractionAudioButtonDown
    admitted: boolean
    downStartTimeSeconds: number | null
    up: InteractionAudioButtonUp | null
  }
  type PendingRequest =
    | { readonly kind: 'wheel'; readonly event: InteractionFeedbackEvent }
    | { readonly kind: 'button-down'; readonly id: string }
  const pending: PendingRequest[] = []
  const voices = new Set<InteractionAudioVoice>()
  const buttonContacts = new Map<string, ActiveButtonContact>()
  const suspensions = new Set<Promise<boolean>>()

  const remember = (result: InteractionAudioResult): InteractionAudioResult => {
    scheduledTotal += result.scheduled
    droppedTotal += result.dropped
    lastResult = result
    return result
  }

  const stopVoices = () => {
    for (const voice of [...voices]) voice.stop()
    voices.clear()
    buttonContacts.clear()
    nextWheelStartSeconds = 0
  }

  const clearPending = () => {
    for (const request of pending) {
      if (request.kind === 'wheel') {
        droppedTotal += requestedVoiceCount(request.event)
      } else {
        const contact = buttonContacts.get(request.id)
        droppedTotal += contact?.up === null ? 2 : 3
        buttonContacts.delete(request.id)
      }
    }
    pending.length = 0
  }

  const reservedButtonReleases = (): number => {
    let count = 0
    for (const contact of buttonContacts.values()) {
      if (contact.admitted) count += 1
    }
    return count
  }

  const scheduleKinds = (
    kinds: readonly InteractionVoiceKind[],
    startTimeSeconds: number,
  ): { readonly scheduled: number; readonly failed: boolean } => {
    const scheduled: InteractionAudioVoice[] = []
    try {
      for (const kind of kinds) {
        const spec = createInteractionVoiceSpec(kind, startTimeSeconds, random)
        let voice: InteractionAudioVoice | null = null
        voice = backend?.schedule(spec, () => {
          if (voice !== null) voices.delete(voice)
        }) ?? null
        if (voice === null) throw new Error('Audio backend unavailable')
        voices.add(voice)
        scheduled.push(voice)
      }
      return { scheduled: scheduled.length, failed: false }
    } catch {
      for (const voice of scheduled) {
        voices.delete(voice)
        voice.stop()
      }
      return { scheduled: 0, failed: true }
    }
  }

  const scheduleWheelEvent = (event: InteractionFeedbackEvent): InteractionAudioResult => {
    const ticks = normalizedTicks(event.clickerTicks)
    const requested = event.control === 'wheel' ? ticks : 0
    if (requested === 0) return remember(silentResult('budget-zero', 0))
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
    if (lifecycle === 'failed') return remember({
      status: 'unavailable',
      reason: 'graph-failed',
      requested,
      scheduled: 0,
      dropped: requested,
    })
    if (event.silenced || !isHumanActor(event.actor)) {
      return remember(silentResult('silenced', requested))
    }
    if (!enabled) return remember(silentResult('disabled', requested))
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
        activation?.operation === lifecycleOperation &&
        pending.length < MAX_PENDING_FEEDBACK_EVENTS
      ) {
        pending.push({ kind: 'wheel', event })
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

    let scheduled = 0
    let limitedBy: InteractionAudioReason = 'scheduled'
    for (let index = 0; index < ticks; index += 1) {
      if (
        voices.size + reservedButtonReleases() + 1 >
        MAX_INTERACTION_AUDIO_VOICES
      ) {
        limitedBy = 'voice-cap'
        break
      }
      const now = backend.currentTime
      const startTimeSeconds = Math.max(now, nextWheelStartSeconds)
      const outcome = scheduleKinds(['wheel'], startTimeSeconds)
      if (outcome.failed) {
        limitedBy = 'graph-failed'
        break
      }
      scheduled += outcome.scheduled
      nextWheelStartSeconds = startTimeSeconds + 1 / WHEEL_TICK_RATE_HZ
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

  const scheduleButtonUp = (
    contact: ActiveButtonContact,
  ): InteractionAudioResult => {
    const requested = 1
    buttonContacts.delete(contact.down.id)
    if (!contact.admitted || contact.downStartTimeSeconds === null) {
      return remember(silentResult('orphan-release', requested))
    }
    if (backend === null || backend.state !== 'running') {
      return remember(silentResult('context-suspended', requested))
    }
    const holdSeconds = Math.max(
      0,
      ((contact.up?.timestampMs ?? contact.down.timestampMs) -
        contact.down.timestampMs) /
        1000,
    )
    const startTimeSeconds = Math.max(
      backend.currentTime,
      contact.downStartTimeSeconds + holdSeconds,
    )
    const outcome = scheduleKinds(['button-up'], startTimeSeconds)
    if (outcome.failed) {
      return remember({
        status: 'unavailable',
        reason: 'graph-failed',
        requested,
        scheduled: 0,
        dropped: requested,
      })
    }
    return remember({
      status: 'scheduled',
      reason: 'scheduled',
      requested,
      scheduled: 1,
      dropped: 0,
    })
  }

  const scheduleButtonDown = (
    contact: ActiveButtonContact,
  ): InteractionAudioResult => {
    const requested = 2
    // Two immediate transients plus one reserved release are one physical
    // admission unit. Wheel traffic can use neither half of that reservation.
    if (
      voices.size + reservedButtonReleases() + 3 >
      MAX_INTERACTION_AUDIO_VOICES
    ) {
      buttonContacts.delete(contact.down.id)
      return remember(silentResult('voice-cap', requested))
    }
    if (backend === null || backend.state !== 'running') {
      buttonContacts.delete(contact.down.id)
      return remember(silentResult('context-suspended', requested))
    }
    const startTimeSeconds = backend.currentTime
    const outcome = scheduleKinds(['wheel', 'button-down'], startTimeSeconds)
    if (outcome.failed) {
      buttonContacts.delete(contact.down.id)
      return remember({
        status: 'unavailable',
        reason: 'graph-failed',
        requested,
        scheduled: 0,
        dropped: requested,
      })
    }
    contact.admitted = true
    contact.downStartTimeSeconds = startTimeSeconds
    const result = remember({
      status: 'scheduled',
      reason: 'scheduled',
      requested,
      scheduled: 2,
      dropped: 0,
    })
    if (contact.up !== null) scheduleButtonUp(contact)
    return result
  }

  const flushPending = () => {
    const queued = pending.splice(0)
    for (const request of queued) {
      if (request.kind === 'wheel') {
        scheduleWheelEvent(request.event)
        continue
      }
      const contact = buttonContacts.get(request.id)
      if (contact !== undefined) scheduleButtonDown(contact)
    }
  }

  const isCurrentOperation = (operation: number): boolean =>
    !disposed && operation === lifecycleOperation

  const interruptedActivationResult = (): InteractionAudioActivationResult =>
    disposed
      ? { status: 'disposed', reason: 'disposed' }
      : { status: 'interrupted', reason: 'interrupted' }

  const requestSuspend = (
    current: InteractionAudioBackend,
    operation: number,
    successLifecycle: InteractionAudioSnapshot['lifecycle'] = 'suspended',
  ): Promise<boolean> => {
    let requested: Promise<void>
    try {
      requested = current.suspend()
    } catch {
      if (isCurrentOperation(operation)) lifecycle = 'failed'
      return Promise.resolve(false)
    }

    const tracked: Promise<boolean> = requested.then(
      () => {
        if (isCurrentOperation(operation)) lifecycle = successLifecycle
        return true
      },
      () => {
        if (isCurrentOperation(operation)) lifecycle = 'failed'
        return false
      },
    ).finally(() => {
      suspensions.delete(tracked)
    })
    suspensions.add(tracked)
    return tracked
  }

  const settleStaleActivation = (
    current: InteractionAudioBackend,
  ): InteractionAudioActivationResult => {
    if (
      !disposed &&
      current.state === 'running' &&
      (lifecycle === 'suspended' || !enabled)
    ) {
      void requestSuspend(current, lifecycleOperation)
    }
    return interruptedActivationResult()
  }

  const unavailableButtonDown = (
    reason: InteractionAudioReason,
  ): InteractionAudioResult => {
    const result = silentResult(reason, 2)
    return remember(
      reason === 'unsupported' || reason === 'graph-failed' || reason === 'disposed'
        ? { ...result, status: 'unavailable' }
        : result,
    )
  }

  const requestButtonDown = (
    down: InteractionAudioButtonDown,
  ): InteractionAudioResult => {
    if (buttonContacts.has(down.id)) {
      return unavailableButtonDown('duplicate-contact')
    }
    if (disposed) return unavailableButtonDown('disposed')
    if (lifecycle === 'unsupported') return unavailableButtonDown('unsupported')
    if (lifecycle === 'failed') return unavailableButtonDown('graph-failed')
    if (!enabled) return unavailableButtonDown('disabled')
    if (backend === null) return unavailableButtonDown('not-activated')
    if (backend.state === 'closed') return unavailableButtonDown('context-closed')

    const contact: ActiveButtonContact = {
      down,
      admitted: false,
      downStartTimeSeconds: null,
      up: null,
    }
    if (backend.state !== 'running') {
      if (
        lifecycle === 'activating' &&
        activation?.operation === lifecycleOperation &&
        pending.length < MAX_PENDING_FEEDBACK_EVENTS
      ) {
        buttonContacts.set(down.id, contact)
        pending.push({ kind: 'button-down', id: down.id })
        return remember({
          status: 'deferred',
          reason: 'unlocking',
          requested: 2,
          scheduled: 0,
          dropped: 0,
        })
      }
      return unavailableButtonDown('context-suspended')
    }

    buttonContacts.set(down.id, contact)
    return scheduleButtonDown(contact)
  }

  const requestButtonUp = (
    up: InteractionAudioButtonUp,
  ): InteractionAudioResult => {
    if (disposed) {
      return remember({
        status: 'unavailable',
        reason: 'disposed',
        requested: 1,
        scheduled: 0,
        dropped: 1,
      })
    }
    const contact = buttonContacts.get(up.id)
    if (contact === undefined || contact.up !== null) {
      return remember(silentResult('orphan-release', 1))
    }
    contact.up = up
    if (!contact.admitted) {
      return remember({
        status: 'deferred',
        reason: 'unlocking',
        requested: 1,
        scheduled: 0,
        dropped: 0,
      })
    }
    return scheduleButtonUp(contact)
  }

  return {
    activate() {
      if (disposed) {
        return Promise.resolve({ status: 'disposed', reason: 'disposed' })
      }
      if (!enabled) {
        return Promise.resolve({ status: 'interrupted', reason: 'interrupted' })
      }
      if (activation?.operation === lifecycleOperation) return activation.promise

      const operation = lifecycleOperation + 1
      lifecycleOperation = operation
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

      const earlierSuspensions = [...suspensions]
      if (backend.state === 'running' && earlierSuspensions.length === 0) {
        lifecycle = 'running'
        flushPending()
        return Promise.resolve({ status: 'running', reason: 'running' })
      }

      lifecycle = 'activating'
      const current = backend
      let initialResume: Promise<void>
      try {
        initialResume = current.resume()
      } catch {
        lifecycle = 'failed'
        clearPending()
        return Promise.resolve({ status: 'failed', reason: 'resume-failed' })
      }

      const run = async (): Promise<InteractionAudioActivationResult> => {
        try {
          await initialResume
        } catch {
          if (!isCurrentOperation(operation)) return interruptedActivationResult()
          lifecycle = 'failed'
          clearPending()
          return { status: 'failed', reason: 'resume-failed' }
        }

        await Promise.all(earlierSuspensions)
        if (!isCurrentOperation(operation)) return settleStaleActivation(current)

        if (current.state !== 'running') {
          try {
            await current.resume()
          } catch {
            if (!isCurrentOperation(operation)) return interruptedActivationResult()
            lifecycle = 'failed'
            clearPending()
            return { status: 'failed', reason: 'resume-failed' }
          }
        }

        if (!isCurrentOperation(operation)) return settleStaleActivation(current)
        if (current.state !== 'running') {
          lifecycle = 'failed'
          clearPending()
          return { status: 'failed', reason: 'resume-failed' }
        }
        lifecycle = 'running'
        flushPending()
        return { status: 'running', reason: 'running' }
      }

      const promise = run().finally(() => {
        if (activation?.operation === operation) activation = null
      })
      activation = { operation, promise }
      return promise
    },

    consume: scheduleWheelEvent,

    buttonDown: requestButtonDown,

    buttonUp: requestButtonUp,

    setEnabled(nextEnabled) {
      if (disposed) return
      if (enabled === nextEnabled) return
      const terminalLifecycle =
        lifecycle === 'unsupported' || lifecycle === 'failed' ? lifecycle : null
      enabled = nextEnabled
      const operation = lifecycleOperation + 1
      lifecycleOperation = operation
      if (enabled) {
        if (terminalLifecycle === null) {
          lifecycle = backend === null ? 'locked' : 'suspended'
        }
        return
      }
      clearPending()
      stopVoices()
      if (terminalLifecycle === null) {
        lifecycle = backend === null ? 'locked' : 'suspended'
      }
      if (backend?.state === 'running') {
        void requestSuspend(backend, operation, terminalLifecycle ?? 'suspended')
      }
    },

    async interrupt() {
      if (disposed) return
      const terminalLifecycle =
        lifecycle === 'unsupported' || lifecycle === 'failed' ? lifecycle : null
      const operation = lifecycleOperation + 1
      lifecycleOperation = operation
      clearPending()
      stopVoices()
      if (terminalLifecycle === null) {
        lifecycle = backend === null ? 'locked' : 'suspended'
      }
      if (backend !== null && backend.state === 'running') {
        await requestSuspend(backend, operation, terminalLifecycle ?? 'suspended')
      }
    },

    snapshot() {
      return {
        lifecycle,
        enabled,
        activeVoices: voices.size,
        activeButtonContacts: buttonContacts.size,
        reservedButtonReleases: reservedButtonReleases(),
        pendingEvents: pending.length,
        scheduledTotal,
        droppedTotal,
        lastResult,
      }
    },

    dispose() {
      if (disposed) return
      disposed = true
      lifecycleOperation += 1
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
  /**
   * Selects events eligible to request Web Audio activation. The default uses
   * `Event.isTrusted`, which identifies user-agent dispatch but does not prove
   * that a human originated the event.
   */
  readonly isActivationEligible?: (event: Event) => boolean
  readonly onSnapshot?: (snapshot: InteractionAudioSnapshot) => void
}

type InteractionAudioBinding = {
  readonly runtime: InteractionAudioRuntime
  readonly report: () => void
  readonly attachmentOrder: number
  activationOrder: number
}

type InteractionAudioBindingHub = {
  readonly bindings: Set<InteractionAudioBinding>
  lastConsumedSequence: number
  unsubscribe: () => void
}

const interactionAudioBindingHubs = new WeakMap<DeviceStore, InteractionAudioBindingHub>()
let nextAttachmentOrder = 0
let nextActivationOrder = 0

/**
 * Subscribes one runtime to the authoritative store stream and browser
 * lifecycle. By default `Event.isTrusted` gates activation for autoplay; actor
 * provenance and sound eligibility remain authoritative state decisions.
 */
export function attachInteractionAudioRuntime(
  runtime: InteractionAudioRuntime,
  store: DeviceStore,
  targets: InteractionAudioBrowserTargets,
): () => void {
  const isActivationEligible =
    targets.isActivationEligible ?? ((event: Event) => event.isTrusted)
  const report = () => {
    try {
      targets.onSnapshot?.(runtime.snapshot())
    } catch {
      // Diagnostics are observational and cannot alter control or audio state.
    }
  }
  const activate: EventListener = (event) => {
    if (!isActivationEligible(event)) return
    binding.markActivated()
    void runtime.activate().then(report)
  }
  const interrupt: EventListener = () => {
    void runtime.interrupt().then(report)
  }
  const visibility: EventListener = () => {
    if (targets.documentTarget.hidden) void runtime.interrupt().then(report)
  }
  const binding = registerInteractionAudioBinding(runtime, store, report)

  targets.root.addEventListener('pointerdown', activate, { capture: true })
  targets.root.addEventListener('keydown', activate, { capture: true })
  targets.documentTarget.addEventListener('visibilitychange', visibility)
  targets.windowTarget.addEventListener('blur', interrupt)
  report()

  return () => {
    binding.detach()
    targets.root.removeEventListener('pointerdown', activate, { capture: true })
    targets.root.removeEventListener('keydown', activate, { capture: true })
    targets.documentTarget.removeEventListener('visibilitychange', visibility)
    targets.windowTarget.removeEventListener('blur', interrupt)
  }
}

function registerInteractionAudioBinding(
  runtime: InteractionAudioRuntime,
  store: DeviceStore,
  report: () => void,
): { readonly markActivated: () => void; readonly detach: () => void } {
  let hub = interactionAudioBindingHubs.get(store)
  if (hub === undefined) {
    const current = store.get(interactionFeedbackAtom)
    hub = {
      bindings: new Set(),
      lastConsumedSequence: current?.seq ?? 0,
      unsubscribe: () => undefined,
    }
    const created = hub
    created.unsubscribe = store.sub(interactionFeedbackAtom, () => {
      const event = store.get(interactionFeedbackAtom)
      if (event === null || event.seq <= created.lastConsumedSequence) return
      created.lastConsumedSequence = event.seq
      const owner = selectInteractionAudioOwner(created.bindings)
      if (owner === null) return
      owner.runtime.consume(event)
      owner.report()
    })
    interactionAudioBindingHubs.set(store, created)
  }

  const binding: InteractionAudioBinding = {
    runtime,
    report,
    attachmentOrder: nextAttachmentOrder + 1,
    activationOrder: 0,
  }
  nextAttachmentOrder = binding.attachmentOrder
  hub.bindings.add(binding)
  let attached = true

  return {
    markActivated() {
      if (!attached) return
      nextActivationOrder += 1
      binding.activationOrder = nextActivationOrder
    },
    detach() {
      if (!attached) return
      attached = false
      hub.bindings.delete(binding)
      if (hub.bindings.size !== 0) return
      hub.unsubscribe()
      interactionAudioBindingHubs.delete(store)
    },
  }
}

function selectInteractionAudioOwner(
  bindings: ReadonlySet<InteractionAudioBinding>,
): InteractionAudioBinding | null {
  let owner: InteractionAudioBinding | null = null
  let ownerRank = -1
  for (const binding of bindings) {
    const snapshot = binding.runtime.snapshot()
    const rank = interactionAudioOwnerRank(snapshot)
    if (rank < 0) continue
    if (
      owner === null ||
      rank > ownerRank ||
      (rank === ownerRank && binding.activationOrder > owner.activationOrder) ||
      (rank === ownerRank &&
        binding.activationOrder === owner.activationOrder &&
        binding.attachmentOrder > owner.attachmentOrder)
    ) {
      owner = binding
      ownerRank = rank
    }
  }
  return owner
}

function interactionAudioOwnerRank(snapshot: InteractionAudioSnapshot): number {
  if (!snapshot.enabled) return -1
  if (snapshot.lifecycle === 'running') return 3
  if (snapshot.lifecycle === 'activating') return 2
  if (snapshot.lifecycle === 'locked' || snapshot.lifecycle === 'suspended') return 1
  return -1
}

function normalizedTicks(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function requestedVoiceCount(event: InteractionFeedbackEvent): number {
  return event.control === 'wheel' ? normalizedTicks(event.clickerTicks) : 0
}

export function createInteractionVoiceSpec(
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
  if (kind === 'button-down') {
    return {
      kind,
      startTimeSeconds,
      durationSeconds: BUTTON_DOWN_DURATION_SECONDS,
      filter: 'lowpass',
      filterFrequencyHz: 3400,
      filterQ: 0.65,
      peakGain: 0.026,
      playbackRate: 1,
    }
  }
  return {
    kind,
    startTimeSeconds,
    durationSeconds: BUTTON_UP_DURATION_SECONDS,
    filter: 'bandpass',
    filterFrequencyHz: 4600,
    filterQ: 0.8,
    peakGain: 0.017,
    playbackRate: 1.04,
  }
}

function finiteOrHalf(value: number): number {
  return Number.isFinite(value) ? value : 0.5
}
