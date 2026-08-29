import { describe, expect, test } from 'bun:test'
import {
  detentAccumulatorAtom,
  highlightIndexAtom,
  type DeviceStore,
  type PanelRow,
  type ScreenFrame,
  pushScreenActionAtom,
} from '@webpod/state'
import { createDeviceStore } from '@webpod/state/testing'

import {
  WHEEL_IDLE_MS,
  createClickWheelRuntime,
  shortestAngleDelta,
  type ClickWheelRuntimeDependencies,
  type ReducedMotionQuery,
  type RuntimeEventTarget,
  type RuntimeFrame,
  type RuntimeTimer,
} from './click-wheel-runtime'

describe('click-wheel runtime', () => {
  test('keeps seam crossings short and signed', () => {
    expect(shortestAngleDelta(179, -179)).toBe(2)
    expect(shortestAngleDelta(-179, 179)).toBe(-2)
    expect(shortestAngleDelta(0, 90)).toBe(90)
    expect(shortestAngleDelta(90, 0)).toBe(-90)
  })

  test('routes mouse and touch arcs through their reducer paths', () => {
    const mouse = makeHarness()
    driveArc(mouse, 'mouse', 1, 0, 90)
    expect(mouse.store.get(highlightIndexAtom)).toBeGreaterThan(0)
    expect(mouse.store.get(detentAccumulatorAtom).path).toBe('mouse-arc')

    const touch = makeHarness()
    driveArc(touch, 'touch', 2, 0, 90)
    expect(touch.store.get(highlightIndexAtom)).toBeGreaterThan(0)
    expect(touch.store.get(detentAccumulatorAtom).path).toBe('touch-arc')
  })

  test('a new gesture cancels an existing coast', () => {
    const harness = makeHarness()
    driveArc(harness, 'mouse', 1, 0, 150, 10)
    harness.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason: 'release' })
    expect(harness.frames.size).toBe(1)

    harness.runtime.arcStart({ pointerId: 2, pointerType: 'touch', angleDeg: 0, timestampMs: 30 })
    expect(harness.frames.size).toBe(0)
    expect(harness.store.get(detentAccumulatorAtom).coasting).toBe(false)
  })

  test('release coasts only when requested and reduced motion is off', () => {
    const normal = makeHarness()
    driveArc(normal, 'touch', 1, 0, 150, 10)
    normal.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason: 'release' })
    expect(normal.frames.size).toBe(1)

    const reduced = makeHarness({ reduced: true })
    driveArc(reduced, 'touch', 1, 0, 150, 10)
    reduced.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason: 'release' })
    expect(reduced.frames.size).toBe(0)
    expect(reduced.store.get(detentAccumulatorAtom).coasting).toBe(false)
  })

  test('the external driver settles on the same row from 15 to 240Hz', () => {
    const settledRows = [15, 30, 60, 120, 240].map((hz) => {
      const harness = makeHarness()
      driveArc(harness, 'touch', 1, 0, 150, 10)
      harness.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason: 'release' })
      harness.drainFrames(1000 / hz)
      expect(harness.frames.size).toBe(0)
      expect(harness.store.get(detentAccumulatorAtom).coasting).toBe(false)
      return harness.store.get(highlightIndexAtom)
    })
    expect(new Set(settledRows).size).toBe(1)
  })

  test('cancellation paths never coast', () => {
    for (const reason of ['cancel', 'lost-capture'] as const) {
      const harness = makeHarness()
      driveArc(harness, 'pen', 1, 0, 150, 10)
      harness.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason })
      expect(harness.frames.size).toBe(0)
      expect(harness.store.get(detentAccumulatorAtom).path).toBeNull()
    }
  })

  test('wheel modes pass through and settle at the 120ms idle boundary', () => {
    for (const deltaMode of [0, 1, 2] as const) {
      const harness = makeHarness()
      harness.runtime.wheel({ deltaY: 36, deltaMode, timestampMs: 1 })
      expect(harness.store.get(detentAccumulatorAtom).path).toBe('scroll')
      expect([...harness.timers.values()][0]?.ms).toBe(WHEEL_IDLE_MS)
      harness.fireTimer()
      expect(harness.store.get(detentAccumulatorAtom).path).toBeNull()
      expect(harness.frames.size).toBe(0)
    }
  })

  test('dispose removes listeners, timers, frames, and transient input', () => {
    const harness = makeHarness()
    driveArc(harness, 'mouse', 1, 0, 150, 10)
    harness.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason: 'release' })
    expect(harness.frames.size).toBe(1)
    harness.runtime.dispose()
    expect(harness.frames.size).toBe(0)
    expect(harness.timers.size).toBe(0)
    expect(harness.documentTarget.listenerCount()).toBe(0)
    expect(harness.windowTarget.listenerCount()).toBe(0)
    expect(harness.reducedMotion.listenerCount()).toBe(0)
    expect(harness.store.get(detentAccumulatorAtom).path).toBeNull()
  })

  test('visibility, blur, and a new reduced-motion preference cancel input', () => {
    const hidden = makeHarness()
    driveArc(hidden, 'mouse', 1, 0, 90)
    hidden.documentTarget.hidden = true
    hidden.documentTarget.emit('visibilitychange')
    expect(hidden.store.get(detentAccumulatorAtom).path).toBeNull()

    const blurred = makeHarness()
    driveArc(blurred, 'mouse', 1, 0, 90)
    blurred.windowTarget.emit('blur')
    expect(blurred.store.get(detentAccumulatorAtom).path).toBeNull()

    const reduced = makeHarness()
    driveArc(reduced, 'mouse', 1, 0, 150, 10)
    reduced.runtime.arcEnd({ pointerId: 1, timestampMs: 20, reason: 'release' })
    reduced.reducedMotion.matches = true
    reduced.reducedMotion.emit('change')
    expect(reduced.frames.size).toBe(0)
    expect(reduced.store.get(detentAccumulatorAtom).path).toBeNull()
  })
})

class FakeEventTarget implements RuntimeEventTarget {
  private readonly listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type))
  }

  listenerCount(): number {
    let count = 0
    for (const listeners of this.listeners.values()) count += listeners.size
    return count
  }
}

class FakeDocumentTarget extends FakeEventTarget {
  hidden = false
}

class FakeReducedMotion extends FakeEventTarget implements ReducedMotionQuery {
  constructor(public matches: boolean) { super() }
}

function makeHarness(options: { readonly reduced?: boolean } = {}) {
  let now = 0
  const store = createDeviceStore({ now: () => now })
  const documentTarget = new FakeDocumentTarget()
  const windowTarget = new FakeEventTarget()
  const reducedMotion = new FakeReducedMotion(options.reduced ?? false)
  const timers = new Map<RuntimeTimer, { readonly callback: () => void; readonly ms: number }>()
  const frames = new Map<RuntimeFrame, FrameRequestCallback>()
  let nextTimer = 1
  let nextFrame = 1

  const dependencies: ClickWheelRuntimeDependencies = {
    store,
    viewportPx: 204,
    requestFrame(callback) {
      const id = nextFrame++
      frames.set(id, callback)
      return id
    },
    cancelFrame(frame) { frames.delete(frame) },
    setTimer(callback, ms) {
      const id = nextTimer++
      timers.set(id, { callback, ms })
      return id
    },
    clearTimer(timer) { timers.delete(timer) },
    reducedMotion,
    documentTarget,
    windowTarget,
  }
  const runtime = createClickWheelRuntime(dependencies)

  return {
    store: store as DeviceStore,
    runtime,
    timers,
    frames,
    documentTarget,
    windowTarget,
    reducedMotion,
    setNow(value: number) { now = value },
    fireTimer() {
      const entry = [...timers.entries()][0]
      if (entry === undefined) throw new Error('No timer is armed')
      timers.delete(entry[0])
      entry[1].callback()
    },
    drainFrames(stepMs: number) {
      let frameMs = 0
      let count = 0
      while (frames.size > 0) {
        const entry = [...frames.entries()][0]
        if (entry === undefined) break
        frames.delete(entry[0])
        frameMs += stepMs
        entry[1](frameMs)
        count += 1
        if (count > 10_000) throw new Error('Coast frame loop did not settle')
      }
    },
  }
}

function driveArc(
  harness: ReturnType<typeof makeHarness>,
  pointerType: 'mouse' | 'touch' | 'pen',
  pointerId: number,
  from: number,
  to: number,
  durationMs = 100,
): void {
  const rows: readonly PanelRow[] = Array.from({ length: 80 }, (_, index) => ({
    index,
    label: `Row ${String(index + 1)}`,
    sublabel: null,
    glyphs: [],
    provenance: null,
  }))
  const frame: ScreenFrame = {
    screenId: 'S09',
    title: 'Runtime test',
    rows,
    highlightIndex: 0,
    windowStart: 0,
    density: 'medium',
  }
  harness.store.set(pushScreenActionAtom, frame)
  harness.runtime.arcStart({ pointerId, pointerType, angleDeg: from, timestampMs: 0 })
  const halfway = from + (to - from) / 2
  harness.runtime.arcMove({
    pointerId,
    pointerType,
    angleDeg: halfway,
    timestampMs: durationMs / 2,
  })
  harness.runtime.arcMove({ pointerId, pointerType, angleDeg: to, timestampMs: durationMs })
}
