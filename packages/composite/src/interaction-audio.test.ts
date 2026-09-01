import { describe, expect, test } from 'bun:test'
import {
  detentActionAtom,
  pressActionAtom,
  type InteractionFeedbackEvent,
} from '@webpod/state'
import { createDeviceStore } from '@webpod/state/testing'

import {
  MAX_INTERACTION_AUDIO_VOICES,
  MAX_PENDING_FEEDBACK_EVENTS,
  WHEEL_PITCH_JITTER,
  WHEEL_TICK_RATE_HZ,
  attachInteractionAudioRuntime,
  createInteractionAudioRuntime,
  type InteractionAudioBackend,
  type InteractionAudioVoice,
  type InteractionVoiceSpec,
} from './interaction-audio'

describe('interaction audio scheduler', () => {
  test('keeps the clicker budgets literal and reviewable', () => {
    expect(WHEEL_TICK_RATE_HZ).toBe(30)
    expect(MAX_INTERACTION_AUDIO_VOICES).toBe(12)
    expect(MAX_PENDING_FEEDBACK_EVENTS).toBe(8)
    expect(WHEEL_PITCH_JITTER).toBe(0.02)
  })

  test('does not construct audio or replay feedback before human activation', () => {
    const backend = new FakeBackend('running')
    let constructions = 0
    const runtime = createInteractionAudioRuntime({
      createBackend: () => {
        constructions += 1
        return backend
      },
    })

    const result = runtime.consume(wheelEvent(3))

    expect(result).toEqual({
      status: 'silent',
      reason: 'not-activated',
      requested: 3,
      scheduled: 0,
      dropped: 3,
    })
    expect(constructions).toBe(0)
    expect(backend.specs).toHaveLength(0)
  })

  test('holds the first click only while a suspended context resumes', async () => {
    const resume = Promise.withResolvers<void>()
    const backend = new FakeBackend('suspended', resume.promise)
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })

    const activation = runtime.activate()
    const pending = runtime.consume(pressEvent('center'))
    expect(pending.reason).toBe('unlocking')
    expect(runtime.snapshot().pendingEvents).toBe(1)
    expect(backend.specs).toHaveLength(0)

    backend.state = 'running'
    resume.resolve()
    expect(await activation).toEqual({ status: 'running', reason: 'running' })
    expect(backend.specs).toHaveLength(1)
    expect(backend.specs[0]?.kind).toBe('select')
    expect(runtime.snapshot().pendingEvents).toBe(0)
  })

  test('bounds activation-time feedback and reports unsupported audio precisely', async () => {
    const resume = Promise.withResolvers<void>()
    const backend = new FakeBackend('suspended', resume.promise)
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    const activation = runtime.activate()

    for (let seq = 1; seq <= MAX_PENDING_FEEDBACK_EVENTS + 3; seq += 1) {
      runtime.consume(pressEvent('center', seq))
    }
    expect(runtime.snapshot().pendingEvents).toBe(MAX_PENDING_FEEDBACK_EVENTS)
    expect(runtime.snapshot().droppedTotal).toBe(3)
    runtime.dispose()
    resume.resolve()
    expect(await activation).toEqual({ status: 'disposed', reason: 'disposed' })

    const unsupported = createInteractionAudioRuntime({ createBackend: () => null })
    expect(await unsupported.activate()).toEqual({
      status: 'unavailable',
      reason: 'unsupported',
    })
    expect(unsupported.consume(pressEvent('center'))).toEqual({
      status: 'unavailable',
      reason: 'unsupported',
      requested: 1,
      scheduled: 0,
      dropped: 1,
    })
  })

  test('an interruption during resume cannot revive audio in the background', async () => {
    const resume = Promise.withResolvers<void>()
    const backend = new FakeBackend('suspended', resume.promise)
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    const activation = runtime.activate()
    runtime.consume(pressEvent('center'))

    await runtime.interrupt()
    expect(runtime.snapshot()).toMatchObject({
      lifecycle: 'suspended',
      pendingEvents: 0,
      activeVoices: 0,
    })
    backend.state = 'running'
    resume.resolve()
    expect(await activation).toEqual({ status: 'interrupted', reason: 'interrupted' })
    await Promise.resolve()
    expect(backend.suspendCalls).toBe(1)
    expect(backend.specs).toHaveLength(0)
  })

  test('a newer trusted activation wins over an older deferred blur suspension', async () => {
    const suspend = Promise.withResolvers<void>()
    const backend = new FakeBackend('running')
    backend.suspendResult = suspend.promise.then(() => {
      backend.state = 'suspended'
    })
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()

    const interruption = runtime.interrupt()
    const activation = runtime.activate()
    suspend.resolve()

    await interruption
    expect(await activation).toEqual({ status: 'running', reason: 'running' })
    expect(runtime.snapshot().lifecycle).toBe('running')
    expect(backend.state).toBe('running')
  })

  test('a newer trusted activation wins over an older deferred mute suspension', async () => {
    const suspend = Promise.withResolvers<void>()
    const backend = new FakeBackend('running')
    backend.suspendResult = suspend.promise.then(() => {
      backend.state = 'suspended'
    })
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()

    runtime.setEnabled(false)
    runtime.setEnabled(true)
    const activation = runtime.activate()
    suspend.resolve()

    expect(await activation).toEqual({ status: 'running', reason: 'running' })
    expect(runtime.snapshot()).toMatchObject({ lifecycle: 'running', enabled: true })
    expect(backend.state).toBe('running')
  })

  test('one press schedules one restrained physical click', async () => {
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()

    const select = runtime.consume(pressEvent('center'))
    backend.currentTime = 0.1
    const secondary = runtime.consume(pressEvent('menu', 2))

    expect(select.scheduled).toBe(1)
    expect(secondary.scheduled).toBe(1)
    expect(backend.specs.map((spec) => spec.kind)).toEqual(['select', 'button'])
    expect(backend.specs[0]?.durationSeconds).toBe(0.016)
    expect(backend.specs[1]?.durationSeconds).toBe(0.012)
    expect(backend.specs[0]?.peakGain).toBeLessThan(0.08)
  })

  test('N detents schedule N lighter, 30Hz-spaced ticks with ±2% jitter', async () => {
    const backend = new FakeBackend('running')
    const randomValues = [0, 0.25, 0.5, 0.75, 1]
    let randomIndex = 0
    const runtime = createInteractionAudioRuntime({
      createBackend: () => backend,
      random: () => randomValues[randomIndex++] ?? 0.5,
    })
    await runtime.activate()

    const result = runtime.consume(wheelEvent(5))

    expect(result).toEqual({
      status: 'scheduled',
      reason: 'scheduled',
      requested: 5,
      scheduled: 5,
      dropped: 0,
    })
    expect(backend.specs).toHaveLength(5)
    expect(backend.specs.every((spec) => spec.kind === 'wheel')).toBeTrue()
    expect(backend.specs.every((spec) => spec.durationSeconds === 0.008)).toBeTrue()
    expect(backend.specs.every((spec) => spec.peakGain === 0.05)).toBeTrue()
    expect(backend.specs.map((spec) => spec.playbackRate)).toEqual([
      1 - WHEEL_PITCH_JITTER,
      0.99,
      1,
      1.01,
      1 + WHEEL_PITCH_JITTER,
    ])
    expect(backend.specs.map((spec) => spec.startTimeSeconds)).toEqual([
      0,
      1 / WHEEL_TICK_RATE_HZ,
      2 / WHEEL_TICK_RATE_HZ,
      3 / WHEEL_TICK_RATE_HZ,
      4 / WHEEL_TICK_RATE_HZ,
    ])
  })

  test('zero budgets and the explicit mute seam create no voices', async () => {
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()

    expect(runtime.consume(wheelEvent(0)).reason).toBe('budget-zero')
    runtime.setEnabled(false)
    expect(runtime.consume(pressEvent('center', 3)).reason).toBe('disabled')
    expect(backend.specs).toHaveLength(0)
    expect(backend.suspendCalls).toBe(1)

    let mutedConstructions = 0
    const muted = createInteractionAudioRuntime({
      createBackend: () => {
        mutedConstructions += 1
        return new FakeBackend('running')
      },
    })
    muted.setEnabled(false)
    expect(await muted.activate()).toEqual({
      status: 'interrupted',
      reason: 'interrupted',
    })
    expect(mutedConstructions).toBe(0)
  })

  test('malformed agent provenance remains silent even when its boolean is false', async () => {
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()
    const malformed = wheelEvent(1)
    Reflect.set(malformed, 'actor', 'agent:review-plant')

    expect(runtime.consume(malformed)).toEqual({
      status: 'silent',
      reason: 'silenced',
      requested: 1,
      scheduled: 0,
      dropped: 1,
    })
    expect(backend.specs).toHaveLength(0)
  })

  test('rapid detents are articulate, bounded, and cannot build runaway gain', async () => {
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()

    const result = runtime.consume(wheelEvent(100))

    expect(result.requested).toBe(100)
    expect(result.scheduled).toBe(MAX_INTERACTION_AUDIO_VOICES)
    expect(result.dropped).toBe(100 - MAX_INTERACTION_AUDIO_VOICES)
    expect(result.reason).toBe('voice-cap')
    expect(runtime.snapshot().activeVoices).toBe(MAX_INTERACTION_AUDIO_VOICES)
    for (let index = 1; index < backend.specs.length; index += 1) {
      const previous = backend.specs[index - 1]
      const current = backend.specs[index]
      if (previous === undefined || current === undefined) throw new Error('Missing voice spec')
      expect(current.startTimeSeconds - previous.startTimeSeconds)
        .toBeCloseTo(1 / WHEEL_TICK_RATE_HZ, 10)
      expect(previous.durationSeconds).toBeLessThan(1 / WHEEL_TICK_RATE_HZ)
      expect(previous.peakGain).toBeLessThanOrEqual(0.05)
    }
  })

  test('natural endings release the cap; dispose stops every remaining voice', async () => {
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()
    runtime.consume(wheelEvent(MAX_INTERACTION_AUDIO_VOICES))
    for (const voice of backend.voices) voice.finish()
    expect(runtime.snapshot().activeVoices).toBe(0)

    backend.currentTime = 1
    runtime.consume(wheelEvent(2, 2))
    expect(runtime.snapshot().activeVoices).toBe(2)
    runtime.dispose()

    expect(runtime.snapshot()).toMatchObject({ lifecycle: 'disposed', activeVoices: 0 })
    expect(backend.voices.filter((voice) => voice.stopped)).toHaveLength(2)
    expect(backend.closeCalls).toBe(1)
    expect(runtime.consume(wheelEvent(1, 3)).reason).toBe('disposed')
  })

  test('resume failure is structured, clears pending work, and never rejects outward', async () => {
    const backend = new FakeBackend('suspended', Promise.reject(new Error('blocked')))
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    const activation = runtime.activate()
    runtime.consume(pressEvent('center'))

    expect(await activation).toEqual({ status: 'failed', reason: 'resume-failed' })
    expect(runtime.snapshot()).toMatchObject({
      lifecycle: 'failed',
      pendingEvents: 0,
      activeVoices: 0,
    })
  })

  test('a stale resume rejection cannot overwrite disposal', async () => {
    const resume = Promise.withResolvers<void>()
    const backend = new FakeBackend('suspended', resume.promise)
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    const activation = runtime.activate()
    runtime.consume(pressEvent('center'))

    runtime.dispose()
    resume.reject(new Error('late resume rejection'))

    expect(await activation).toEqual({ status: 'disposed', reason: 'disposed' })
    expect(runtime.snapshot()).toMatchObject({
      lifecycle: 'disposed',
      pendingEvents: 0,
      activeVoices: 0,
    })
  })

  test('a stale resume rejection cannot overwrite a newer interruption', async () => {
    const resume = Promise.withResolvers<void>()
    const backend = new FakeBackend('suspended', resume.promise)
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    const activation = runtime.activate()

    await runtime.interrupt()
    resume.reject(new Error('late resume rejection'))

    expect(await activation).toEqual({ status: 'interrupted', reason: 'interrupted' })
    expect(runtime.snapshot().lifecycle).toBe('suspended')
  })

  test('graph scheduling failure returns a no-sound result instead of throwing', async () => {
    const backend = new FakeBackend('running')
    backend.failScheduling = true
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()

    expect(runtime.consume(wheelEvent(2))).toEqual({
      status: 'unavailable',
      reason: 'graph-failed',
      requested: 2,
      scheduled: 0,
      dropped: 2,
    })
  })
})

describe('store and browser lifecycle binding', () => {
  test('duplicate bindings consume one authoritative sequence exactly once', async () => {
    const store = createDeviceStore()
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()
    const targets = {
      root: new EventTarget(),
      documentTarget: Object.assign(new EventTarget(), { hidden: false }),
      windowTarget: new EventTarget(),
      isHumanActivation: () => true,
    }
    const detachFirst = attachInteractionAudioRuntime(runtime, store, targets)
    const detachSecond = attachInteractionAudioRuntime(runtime, store, targets)

    store.set(pressActionAtom, { button: 'center', source: 'human' })

    expect(backend.specs).toHaveLength(1)
    detachSecond()
    detachFirst()
    runtime.dispose()
  })

  test('multiple mounted runtimes share exact-once sequence ownership', async () => {
    const store = createDeviceStore()
    const firstBackend = new FakeBackend('running')
    const secondBackend = new FakeBackend('running')
    const first = createInteractionAudioRuntime({ createBackend: () => firstBackend })
    const second = createInteractionAudioRuntime({ createBackend: () => secondBackend })
    await first.activate()
    await second.activate()
    const common = {
      documentTarget: Object.assign(new EventTarget(), { hidden: false }),
      windowTarget: new EventTarget(),
      isHumanActivation: () => true,
    }
    const detachFirst = attachInteractionAudioRuntime(first, store, {
      ...common,
      root: new EventTarget(),
    })
    const detachSecond = attachInteractionAudioRuntime(second, store, {
      ...common,
      root: new EventTarget(),
    })

    store.set(detentActionAtom, {
      path: 'direct',
      source: 'human',
      detents: 3,
      timestampMs: 1,
    })

    expect(firstBackend.specs.length + secondBackend.specs.length).toBe(3)
    detachSecond()
    detachFirst()
    second.dispose()
    first.dispose()
  })

  test('trusted activation unlocks once, then authoritative events drive sound', async () => {
    const store = createDeviceStore()
    const backend = new FakeBackend('suspended')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    const root = new EventTarget()
    const documentTarget = Object.assign(new EventTarget(), { hidden: false })
    const windowTarget = new EventTarget()
    const detach = attachInteractionAudioRuntime(runtime, store, {
      root,
      documentTarget,
      windowTarget,
      isHumanActivation: () => true,
    })

    root.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()
    store.set(pressActionAtom, { button: 'center', source: 'human' })
    store.set(detentActionAtom, {
      path: 'direct',
      source: 'human',
      detents: 3,
      timestampMs: 1,
    })
    store.set(detentActionAtom, {
      path: 'direct',
      source: 'agent',
      detents: 5,
      timestampMs: 2,
    })

    expect(backend.resumeCalls).toBe(1)
    expect(backend.specs.map((spec) => spec.kind)).toEqual([
      'select',
      'wheel',
      'wheel',
      'wheel',
    ])

    windowTarget.dispatchEvent(new Event('blur'))
    await Promise.resolve()
    expect(backend.suspendCalls).toBe(1)
    expect(runtime.snapshot().activeVoices).toBe(0)

    detach()
    backend.state = 'running'
    store.set(pressActionAtom, { button: 'menu', source: 'human' })
    expect(backend.specs).toHaveLength(4)
    runtime.dispose()
  })

  test('hidden documents interrupt and clean the graph deterministically', async () => {
    const store = createDeviceStore()
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()
    const documentTarget = Object.assign(new EventTarget(), { hidden: false })
    const detach = attachInteractionAudioRuntime(runtime, store, {
      root: new EventTarget(),
      documentTarget,
      windowTarget: new EventTarget(),
      isHumanActivation: () => true,
    })
    store.set(pressActionAtom, { button: 'center', source: 'human' })

    documentTarget.hidden = true
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()

    expect(backend.suspendCalls).toBe(1)
    expect(runtime.snapshot()).toMatchObject({ lifecycle: 'suspended', activeVoices: 0 })
    detach()
    runtime.dispose()
  })

  test('a failing diagnostic observer cannot escape the audio boundary', async () => {
    const store = createDeviceStore()
    const backend = new FakeBackend('running')
    const runtime = createInteractionAudioRuntime({ createBackend: () => backend })
    await runtime.activate()
    const detach = attachInteractionAudioRuntime(runtime, store, {
      root: new EventTarget(),
      documentTarget: Object.assign(new EventTarget(), { hidden: false }),
      windowTarget: new EventTarget(),
      onSnapshot: () => {
        throw new Error('diagnostic failed')
      },
    })

    expect(() => {
      store.set(pressActionAtom, { button: 'center', source: 'human' })
    }).not.toThrow()
    expect(backend.specs).toHaveLength(1)
    detach()
    runtime.dispose()
  })
})

class FakeVoice implements InteractionAudioVoice {
  stopped = false
  private ended = false

  constructor(private readonly onEnded: () => void) {}

  stop(): void {
    this.stopped = true
    this.finish()
  }

  finish(): void {
    if (this.ended) return
    this.ended = true
    this.onEnded()
  }
}

class FakeBackend implements InteractionAudioBackend {
  currentTime = 0
  resumeCalls = 0
  suspendCalls = 0
  closeCalls = 0
  failScheduling = false
  suspendResult: Promise<void> | null = null
  readonly specs: InteractionVoiceSpec[] = []
  readonly voices: FakeVoice[] = []

  constructor(
    public state: AudioContextState | 'interrupted',
    private readonly resumeResult: Promise<void> | null = null,
  ) {}

  async resume(): Promise<void> {
    this.resumeCalls += 1
    if (this.resumeResult !== null) return this.resumeResult
    this.state = 'running'
  }

  async suspend(): Promise<void> {
    this.suspendCalls += 1
    if (this.suspendResult !== null) return this.suspendResult
    this.state = 'suspended'
  }

  async close(): Promise<void> {
    this.closeCalls += 1
    this.state = 'closed'
  }

  schedule(spec: InteractionVoiceSpec, onEnded: () => void): InteractionAudioVoice {
    if (this.failScheduling) throw new Error('graph unavailable')
    this.specs.push(spec)
    const voice = new FakeVoice(onEnded)
    this.voices.push(voice)
    return voice
  }
}

function wheelEvent(ticks: number, seq = 1): InteractionFeedbackEvent {
  return {
    seq,
    control: 'wheel',
    origin: 'detent',
    clickerTicks: ticks,
    silenced: false,
    actor: 'human:touch',
  }
}

function pressEvent(
  button: 'center' | 'menu' | 'next' | 'previous',
  seq = 1,
): InteractionFeedbackEvent {
  return {
    seq,
    control: 'press',
    origin: 'press',
    button,
    clickerTicks: 1,
    silenced: false,
    actor: 'human:touch',
  }
}
