import {
  coastActionAtom,
  detentAccumulatorAtom,
  detentActionAtom,
  endGestureActionAtom,
  resetInputState,
  type DeviceStore,
} from '@webpod/state'
import type { ClickWheelArcEnd, ClickWheelArcSample } from '@webpod/device'

export type { ClickWheelArcEnd, ClickWheelArcSample } from '@webpod/device'

export const WHEEL_IDLE_MS = 120

export type WheelInput = {
  readonly deltaY: number
  readonly deltaMode: 0 | 1 | 2
  readonly timestampMs: number
}

export type RuntimeTimer = ReturnType<typeof setTimeout> | number
export type RuntimeFrame = number

export type RuntimeEventTarget = {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

export type ReducedMotionQuery = RuntimeEventTarget & {
  readonly matches: boolean
}

export type ClickWheelRuntimeDependencies = {
  readonly store: DeviceStore
  readonly viewportPx: number
  readonly requestFrame: (callback: FrameRequestCallback) => RuntimeFrame
  readonly cancelFrame: (frame: RuntimeFrame) => void
  readonly setTimer: (callback: () => void, ms: number) => RuntimeTimer
  readonly clearTimer: (timer: RuntimeTimer) => void
  readonly reducedMotion: ReducedMotionQuery
  readonly documentTarget: RuntimeEventTarget & { readonly hidden: boolean }
  readonly windowTarget: RuntimeEventTarget
}

export type ClickWheelRuntime = {
  arcStart(sample: ClickWheelArcSample): void
  arcMove(sample: ClickWheelArcSample): void
  arcEnd(end: ClickWheelArcEnd): void
  wheel(input: WheelInput): void
  cancel(reason: string): void
  dispose(): void
}

export type WheelListenerRoot = {
  addEventListener(
    type: 'wheel',
    listener: (event: WheelEvent) => void,
    options: AddEventListenerOptions,
  ): void
  removeEventListener(
    type: 'wheel',
    listener: (event: WheelEvent) => void,
    options: EventListenerOptions,
  ): void
}

/**
 * Bridges browser gestures into the one device store without reproducing any
 * detent physics. The reducer remains the sole owner of dead zones,
 * acceleration, hysteresis, clamping, and coast decay.
 *
 * The runtime owns browser lifecycle only: competing gestures cancel each
 * other, releases schedule coast frames, and every listener/timer/frame is
 * removed by {@link ClickWheelRuntime.dispose}. It contains no render-loop or
 * tier knowledge, so the demand-rendered Three scene stays idle at rest.
 */
export function createClickWheelRuntime(
  dependencies: ClickWheelRuntimeDependencies,
): ClickWheelRuntime {
  let activeArc: ClickWheelArcSample | null = null
  let wheelActive = false
  let wheelTimer: RuntimeTimer | null = null
  let coastFrame: RuntimeFrame | null = null
  let previousFrameMs: number | null = null
  let disposed = false

  const stopWheelTimer = () => {
    if (wheelTimer === null) return
    dependencies.clearTimer(wheelTimer)
    wheelTimer = null
  }

  const stopCoast = () => {
    if (coastFrame !== null) dependencies.cancelFrame(coastFrame)
    coastFrame = null
    previousFrameMs = null
  }

  const resetTransientInput = () => {
    stopWheelTimer()
    stopCoast()
    wheelActive = false
    activeArc = null
    resetInputState(dependencies.store)
  }

  const coast = (frameMs: number) => {
    coastFrame = null
    if (disposed || dependencies.reducedMotion.matches) {
      resetTransientInput()
      return
    }

    const previous = previousFrameMs
    previousFrameMs = frameMs
    if (previous !== null) {
      dependencies.store.set(coastActionAtom, Math.max(0, frameMs - previous) / 1000)
    }

    if (dependencies.store.get(detentAccumulatorAtom).coasting) {
      coastFrame = dependencies.requestFrame(coast)
    } else {
      previousFrameMs = null
    }
  }

  const beginCoast = () => {
    if (
      dependencies.reducedMotion.matches ||
      !dependencies.store.get(detentAccumulatorAtom).coasting
    ) {
      if (dependencies.reducedMotion.matches) resetInputState(dependencies.store)
      return
    }
    previousFrameMs = null
    coastFrame = dependencies.requestFrame(coast)
  }

  const cancel = (reason: string) => {
    if (disposed) return
    void reason
    resetTransientInput()
  }

  const onVisibilityChange: EventListener = () => {
    if (dependencies.documentTarget.hidden) cancel('document-hidden')
  }
  const onWindowBlur: EventListener = () => cancel('window-blur')
  const onReducedMotionChange: EventListener = () => {
    if (dependencies.reducedMotion.matches) cancel('reduced-motion')
  }

  dependencies.documentTarget.addEventListener('visibilitychange', onVisibilityChange)
  dependencies.windowTarget.addEventListener('blur', onWindowBlur)
  dependencies.reducedMotion.addEventListener('change', onReducedMotionChange)

  return {
    arcStart(sample) {
      if (disposed) return
      resetTransientInput()
      activeArc = sample
    },

    arcMove(sample) {
      if (disposed || activeArc?.pointerId !== sample.pointerId) return
      const previous = activeArc
      activeArc = sample
      dependencies.store.set(detentActionAtom, {
        path: sample.pointerType === 'mouse' ? 'mouse-arc' : 'touch-arc',
        source: 'human',
        angleDeg: shortestAngleDelta(previous.angleDeg, sample.angleDeg),
        timestampMs: sample.timestampMs,
      })
    },

    arcEnd(end) {
      if (disposed || activeArc?.pointerId !== end.pointerId) return
      activeArc = null
      if (end.reason !== 'release') {
        resetTransientInput()
        return
      }
      dependencies.store.set(endGestureActionAtom)
      beginCoast()
    },

    wheel(input) {
      if (disposed) return
      if (!wheelActive) {
        resetTransientInput()
        wheelActive = true
      } else {
        stopWheelTimer()
      }

      dependencies.store.set(detentActionAtom, {
        path: 'scroll',
        source: 'human',
        deltaY: input.deltaY,
        deltaMode: input.deltaMode,
        viewportPx: dependencies.viewportPx,
        timestampMs: input.timestampMs,
      })

      wheelTimer = dependencies.setTimer(() => {
        wheelTimer = null
        wheelActive = false
        dependencies.store.set(endGestureActionAtom)
      }, WHEEL_IDLE_MS)
    },

    cancel,

    dispose() {
      if (disposed) return
      resetTransientInput()
      disposed = true
      dependencies.documentTarget.removeEventListener('visibilitychange', onVisibilityChange)
      dependencies.windowTarget.removeEventListener('blur', onWindowBlur)
      dependencies.reducedMotion.removeEventListener('change', onReducedMotionChange)
    },
  }
}

/** Returns the shortest signed clockwise-positive angular travel. */
export function shortestAngleDelta(previousDeg: number, currentDeg: number): number {
  return ((currentDeg - previousDeg + 540) % 360) - 180
}

/**
 * Claims wheel input at the composite boundary before the nested DOM panel or
 * R3F can observe it. The non-passive capture listener is required because
 * preventing page scroll after bubbling would be too late and would also let
 * the panel's standalone fallback move the device a second time.
 */
export function attachCompositeWheelListener(
  root: WheelListenerRoot,
  runtime: Pick<ClickWheelRuntime, 'wheel'>,
): () => void {
  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()
    runtime.wheel({
      deltaY: event.deltaY,
      deltaMode: normalizeWheelDeltaMode(event.deltaMode),
      timestampMs: event.timeStamp,
    })
  }
  root.addEventListener('wheel', onWheel, { capture: true, passive: false })
  return () => root.removeEventListener('wheel', onWheel, { capture: true })
}

/** Narrows arbitrary browser values to the state contract's three modes. */
export function normalizeWheelDeltaMode(deltaMode: number): 0 | 1 | 2 {
  if (deltaMode === 1) return 1
  if (deltaMode === 2) return 2
  return 0
}

export function browserClickWheelRuntimeDependencies(
  store: DeviceStore,
  viewportPx: number,
): ClickWheelRuntimeDependencies {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  return {
    store,
    viewportPx,
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (frame) => window.cancelAnimationFrame(frame),
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (timer) => window.clearTimeout(Number(timer)),
    reducedMotion,
    documentTarget: document,
    windowTarget: window,
  }
}
