import { selectAtom } from 'jotai/vanilla/utils'
import type { PreviewMotionAuthority } from './device-motion-authority'
import { atom, createStore } from 'jotai/vanilla'
import {
  DEVICE_ORIENTATION_PRESETS,
  FRONT_DEVICE_ORIENTATION,
  clampDeviceOrientation,
  type Colourway,
  type DeviceOrientation,
  type DeviceOrientationGrabStart,
  type DevicePosePreset,
} from '@webpod/device'

import {
  DEVICE_ORIENTATION_DRAG_GAIN,
  advanceDeviceOrientationRelease,
  beginDeviceOrientationRelease,
  estimatePointerReleaseVelocity,
  pointerVelocityToDeviceVelocity,
  type DeviceOrientationReleaseMotion,
  type PointerMotionSample,
} from './device-orientation-motion'

export { DEVICE_ORIENTATION_DRAG_GAIN } from './device-orientation-motion'

export type DevicePreviewRoom = 'dark' | 'light'

export type DevicePreviewState = {
  readonly colourway: Colourway
  readonly pose: DevicePosePreset | 'custom'
  readonly orientation: DeviceOrientation
  readonly room: DevicePreviewRoom
}

export const INITIAL_DEVICE_PREVIEW_STATE: DevicePreviewState = Object.freeze({
  colourway: 'black',
  pose: 'front',
  orientation: FRONT_DEVICE_ORIENTATION,
  room: 'dark',
})

const DEVICE_POSES = [
  'front',
  'three-quarter',
  'edge',
  'rear',
] as const satisfies readonly DevicePosePreset[]

/** External preview store shared by React, pointer callbacks, and browser tests. */
export type DevicePreviewStore = {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => DevicePreviewState
  /** Stable across orientation ticks; full live tool state stays getSnapshot. */
  readonly getAppearanceSnapshot: () => DevicePreviewState
  readonly setColourway: (colourway: Colourway) => DevicePreviewState
  readonly setOrientation: (orientation: DeviceOrientation) => DevicePreviewState
  readonly setPose: (pose: DevicePosePreset) => DevicePreviewState
  readonly setRoom: (room: DevicePreviewRoom) => DevicePreviewState
  /** Restores the physical orientation only; colourway and room remain chosen. */
  readonly resetOrientation: () => DevicePreviewState
}

/** Creates the one mutable owner of diagnostic device orientation. */
export function createDevicePreviewStore(
  initial: DevicePreviewState = INITIAL_DEVICE_PREVIEW_STATE,
): DevicePreviewStore {
  const authority = createStore()
  const stateAtom = atom(freezePreviewState(initial))
  const appearanceAtom = selectAtom(stateAtom, state => state, (a, b) => a.colourway === b.colourway && a.room === b.room)
  const read = () => authority.get(stateAtom)
  const publish = (next: DevicePreviewState): DevicePreviewState => {
    if (samePreviewState(read(), next)) return read()
    authority.set(stateAtom, freezePreviewState(next))
    // A reentrant subscriber may have replaced this publication synchronously.
    return read()
  }

  return {
    subscribe: (listener) => authority.sub(stateAtom, listener),
    getSnapshot: read,
    getAppearanceSnapshot: () => authority.get(appearanceAtom),
    setColourway: (colourway) => publish({ ...read(), colourway }),
    setOrientation(orientation) {
      if (!isFiniteOrientation(orientation)) return read()
      const next = clampDeviceOrientation(orientation)
      return publish({ ...read(), pose: poseForOrientation(next), orientation: next })
    },
    setPose: (pose) =>
      publish({ ...read(), pose, orientation: DEVICE_ORIENTATION_PRESETS[pose] }),
    setRoom: (room) => publish({ ...read(), room }),
    resetOrientation: () =>
      publish({
        ...read(),
        pose: 'front',
        orientation: FRONT_DEVICE_ORIENTATION,
      }),
  }
}

/** Resolves exact diagnostic presets without making pose a second state root. */
export function poseForOrientation(
  orientation: DeviceOrientation,
): DevicePosePreset | 'custom' {
  for (const pose of DEVICE_POSES) {
    if (sameOrientation(orientation, DEVICE_ORIENTATION_PRESETS[pose])) return pose
  }
  return 'custom'
}

/** Maps one captured viewport drag into the bounded device orientation seam. */
export function orientationFromDeviceDrag(
  start: DeviceOrientation,
  deltaX: number,
  deltaY: number,
  rollMode: boolean,
): DeviceOrientation {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    return clampDeviceOrientation(start)
  }
  return clampDeviceOrientation({
    pitchDeg:
      start.pitchDeg + deltaY * DEVICE_ORIENTATION_DRAG_GAIN.pitchDegPerPixel,
    yawDeg:
      start.yawDeg +
      (rollMode ? 0 : deltaX * DEVICE_ORIENTATION_DRAG_GAIN.yawDegPerPixel),
    rollDeg:
      start.rollDeg +
      (rollMode ? deltaX * DEVICE_ORIENTATION_DRAG_GAIN.rollDegPerPixel : 0),
  })
}

type ActiveOrientationGrab = {
  readonly start: DeviceOrientationGrabStart
  readonly startOrientation: DeviceOrientation
  currentOrientation: DeviceOrientation
  readonly samples: PointerMotionSample[]
  readonly onMove: EventListener
  readonly onRelease: EventListener
  readonly onCancel: EventListener
  readonly onLostCapture: EventListener
}

export type DeviceOrientationMotionEnvironment = {
  readonly now: () => number
  readonly requestFrame: (callback: FrameRequestCallback) => number
  readonly cancelFrame: (handle: number) => void
  readonly reducedMotion: () => boolean
}

export type DeviceOrientationControls = {
  readonly reset: () => DevicePreviewState
  readonly read: () => DevicePreviewState
  /** Applies finite degree deltas (x=pitch, y=yaw) and returns clamped state. */
  readonly rotate: (xDeg: number, yDeg: number) => DevicePreviewState
  /** Uses the physical face spring; resolves only at rest and rejects interruption. */
  readonly flick: (face: 'front' | 'back', signal: AbortSignal) => Promise<DevicePreviewState>
  /** Called only after the device package raycasts a visible enclosure edge. */
  readonly begin: (start: DeviceOrientationGrabStart) => boolean
  readonly setGrabbable: (grabbable: boolean) => void
  readonly dispose: () => void
  readonly isActive: () => boolean
  readonly isAnimating: () => boolean
}

export type DeviceOrientationControlStage = EventTarget & {
  readonly ownerDocument?: EventTarget & { readonly hidden: boolean }
  readonly dataset: { [name: string]: string | undefined }
  focus(options?: FocusOptions): void
}

/**
 * Binds edge-initiated free orientation without owning render state.
 *
 * Pointer capture and move listeners exist only for one active grab. Movement
 * and bounded release motion write the external store directly, so R3F's
 * demand canvas renders only changed orientations. The release scheduler owns
 * at most one frame and relinquishes it at rest, cancellation, blur, or dispose.
 */
export function bindDeviceOrientationControls(
  stage: DeviceOrientationControlStage,
  store: DevicePreviewStore,
  blurHost: EventTarget = window,
  motionEnvironment: DeviceOrientationMotionEnvironment =
    browserDeviceOrientationMotionEnvironment(),
  onTrace?: (kind: string, detail: Readonly<Record<string, unknown>>) => void,
  rendererMotion?: PreviewMotionAuthority,
): DeviceOrientationControls {
  const visibilityHost = stage.ownerDocument ?? (typeof document === 'undefined' ? null : document)
  let active: ActiveOrientationGrab | null = null
  let releaseMotion: DeviceOrientationReleaseMotion | null = null
  let motionFrame: number | null = null
  let cancelRemoteMotion: (() => void) | null = null
  let lastMotionFrameMs = 0
  let grabbable = false
  let publishingOrientation: DeviceOrientation | null = null
  let observedOrientation = store.getSnapshot().orientation
  let disposed = false
  let motionGeneration = 0
  let pendingFlick: {
    readonly resolve: (state: DevicePreviewState) => void
    readonly reject: (reason: Error) => void
    readonly cleanup: () => void
  } | null = null
  const trace = (kind: string, detail: Readonly<Record<string, unknown>> = {}) => {
    try { onTrace?.(kind, { ...detail, orientation: store.getSnapshot().orientation, held: active !== null, moving: releaseMotion !== null, frameScheduled: motionFrame !== null, generation: motionGeneration }) } catch { /* Observation cannot interrupt controls. */ }
  }
  trace('orientation-mounted')
  const settleFlick = (error?: Error) => {
    const pending = pendingFlick
    pendingFlick = null
    if (pending === null) return
    trace(error === undefined ? 'flick-settled' : 'flick-interrupted', { reason: error?.message ?? null })
    pending.cleanup()
    if (error === undefined) pending.resolve(store.getSnapshot())
    else pending.reject(error)
  }
  const publishOrientation = (orientation: DeviceOrientation, fromRenderer = false) => {
    const previousPublication = publishingOrientation
    publishingOrientation = clampDeviceOrientation(orientation)
    try {
      const next = store.setOrientation(orientation)
      if (!fromRenderer) rendererMotion?.publishIntent(next.orientation)
      return next
    } finally { publishingOrientation = previousPublication }
  }

  const reflectAffordance = () => {
    if (active !== null) {
      stage.dataset['orientationGrab'] = 'active'
      stage.dataset['orientationPointerId'] = String(active.start.pointerId)
    } else if (grabbable) {
      stage.dataset['orientationGrab'] = 'ready'
      delete stage.dataset['orientationPointerId']
    } else {
      delete stage.dataset['orientationGrab']
      delete stage.dataset['orientationPointerId']
    }
    if (releaseMotion === null) {
      delete stage.dataset['orientationMotion']
    } else {
      stage.dataset['orientationMotion'] = releaseMotion.kind
    }
  }

  const stopMotion = () => {
    if (releaseMotion !== null || pendingFlick !== null) trace('motion-stopped')
    motionGeneration += 1
    const cancelRemote = cancelRemoteMotion
    cancelRemoteMotion = null
    cancelRemote?.()
    settleFlick(new DOMException('Device orientation motion interrupted', 'AbortError'))
    releaseMotion = null
    if (motionFrame !== null) {
      motionEnvironment.cancelFrame(motionFrame)
      motionFrame = null
    }
    reflectAffordance()
  }

  const onMotionFrame = (timestampMs: number) => {
    motionFrame = null
    const current = releaseMotion
    if (current === null) return
    const generation = motionGeneration
    const elapsedSeconds = (timestampMs - lastMotionFrameMs) / 1_000
    if (elapsedSeconds > .25) trace('motion-frame-gap', { elapsedMs: elapsedSeconds * 1000 })
    lastMotionFrameMs = timestampMs
    const advanced = motionEnvironment.reducedMotion()
      ? { orientation: current.kind === 'coast' ? current.orientation : { ...current.orientation, ...(current.kind === 'flick-snap' ? { pitchDeg: 0, rollDeg: 0 } : {}), yawDeg: current.targetYawDeg }, motion: null }
      : advanceDeviceOrientationRelease(current, elapsedSeconds)
    publishOrientation(advanced.orientation)
    if (generation !== motionGeneration) return
    releaseMotion = advanced.motion
    reflectAffordance()
    if (releaseMotion !== null) {
      motionFrame = motionEnvironment.requestFrame(onMotionFrame)
    } else {
      settleFlick()
    }
  }

  const scheduleMotion = () => {
    const current = releaseMotion
    if (current === null) return
    const generation = motionGeneration
    const remote = rendererMotion?.startOrientation(current,
      (orientation) => { if (generation === motionGeneration && !disposed) publishOrientation(orientation, true) },
      (error) => {
        if (generation !== motionGeneration || disposed) return
        cancelRemoteMotion = null
        releaseMotion = null
        reflectAffordance()
        settleFlick(error)
      },
    )
    if (remote !== undefined && remote !== null) { cancelRemoteMotion = remote; return }
    lastMotionFrameMs = motionEnvironment.now()
    motionFrame = motionEnvironment.requestFrame(onMotionFrame)
  }

  const beginReleaseMotion = (grab: ActiveOrientationGrab, timestampMs: number, cancelled = false) => {
    const pointerVelocity = estimatePointerReleaseVelocity(
      cancelled ? [] : grab.samples,
      timestampMs,
    )
    const deviceVelocity = pointerVelocityToDeviceVelocity(
      pointerVelocity,
      grab.start.rollMode,
    )
    stage.dataset['orientationReleaseYawVelocity'] =
      deviceVelocity.yawDegPerSecond.toFixed(3)
    const release = beginDeviceOrientationRelease(
      grab.currentOrientation,
      deviceVelocity,
      motionEnvironment.reducedMotion(),
      { startYawDeg: grab.startOrientation.yawDeg, yawImpulseTravelDeg: pointerVelocity.xImpulseTravelPx * DEVICE_ORIENTATION_DRAG_GAIN.yawDegPerPixel },
    )
    publishOrientation(release.orientation)
    releaseMotion = release.motion
    if (releaseMotion !== null) {
      scheduleMotion()
    }
    reflectAffordance()
  }

  const finish = (
    pointerId: number,
    releaseCapture: boolean,
  ): ActiveOrientationGrab | null => {
    const current = active
    if (current === null || current.start.pointerId !== pointerId) return null
    active = null
    trace('grab-finished', { pointerId, releaseCapture })
    current.start.host.removeEventListener('pointermove', current.onMove)
    current.start.host.removeEventListener('pointerup', current.onRelease)
    current.start.host.removeEventListener('pointercancel', current.onCancel)
    current.start.host.removeEventListener(
      'lostpointercapture',
      current.onLostCapture,
    )
    try {
      if (
        releaseCapture &&
        current.start.capture.hasPointerCapture(current.start.pointerId)
      ) {
        current.start.capture.releasePointerCapture(current.start.pointerId)
      }
    } catch {
      // Capture may already have been released by the browser during teardown.
    }
    reflectAffordance()
    return current
  }

  const begin = (start: DeviceOrientationGrabStart): boolean => {
    if (disposed || active !== null || visibilityHost?.hidden) { trace('grab-rejected', { disposed }); return false }
    try {
      start.capture.setPointerCapture(start.pointerId)
    } catch {
      trace('capture-failed', { pointerId: start.pointerId })
      return false
    }
    stopMotion()

    const onMove: EventListener = (event) => {
      const current = active
      const pointer = pointerMoveOf(event, motionEnvironment.now())
      if (current === null) return
      if (pointer === null || pointer.pointerId !== start.pointerId) return
      if (event.cancelable) event.preventDefault()
      updateGrab(
        current,
        pointer,
        { setOrientation: publishOrientation },
      )
    }
    const onRelease: EventListener = (event) => {
      const pointer = pointerMoveOf(event, motionEnvironment.now())
      const current = active
      if (
        pointer === null ||
        current === null ||
        pointer.pointerId !== current.start.pointerId
      ) {
        return
      }
      updateGrab(current, pointer, { setOrientation: publishOrientation })
      rendererMotion?.pointer('pointer-release', {...pointer, pointerType: current.start.pointerType, timestampMs: motionTimestamp(pointer.timestampMs)})
      const released = finish(pointer.pointerId, true)
      if (released !== null) beginReleaseMotion(released, pointer.timestampMs)
      if (released !== null && event.cancelable) event.preventDefault()
    }
    const onCancel: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId !== null) {
        const current = active
        if (current !== null && current.start.pointerId === pointerId) {
          const sample = current.samples.at(-1) ?? current.start
          rendererMotion?.pointer('pointer-cancel', {clientX: sample.clientX, clientY: sample.clientY, pointerId, pointerType: current.start.pointerType, timestampMs: motionTimestamp(motionEnvironment.now())})
        }
        const cancelled = finish(pointerId, true)
        if (cancelled !== null) beginReleaseMotion(cancelled, motionEnvironment.now(), true)
      }
    }
    const onLostCapture: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId !== null) {
        const current = active
        if (current !== null && current.start.pointerId === pointerId) {
          const sample = current.samples.at(-1) ?? current.start
          rendererMotion?.pointer('pointer-cancel', {clientX: sample.clientX, clientY: sample.clientY, pointerId, pointerType: current.start.pointerType, timestampMs: motionTimestamp(motionEnvironment.now())})
        }
        const cancelled = finish(pointerId, true)
        if (cancelled !== null) beginReleaseMotion(cancelled, motionEnvironment.now(), true)
      }
    }
    const startOrientation = store.getSnapshot().orientation
    active = {
      start,
      startOrientation,
      currentOrientation: startOrientation,
      samples: [
        {
          clientX: start.clientX,
          clientY: start.clientY,
          timestampMs: Number.isFinite(start.timestampMs)
            ? start.timestampMs
            : motionEnvironment.now(),
        },
      ],
      onMove,
      onRelease,
      onCancel,
      onLostCapture,
    }
    rendererMotion?.pointer('pointer-start', {pointerId: start.pointerId, pointerType: start.pointerType, clientX: start.clientX, clientY: start.clientY, timestampMs: motionTimestamp(Number.isFinite(start.timestampMs) ? start.timestampMs : motionEnvironment.now())})
    trace('grab-started', { pointerId: start.pointerId })
    start.host.addEventListener('pointermove', onMove, { passive: false })
    start.host.addEventListener('pointerup', onRelease, { passive: false })
    start.host.addEventListener('pointercancel', onCancel)
    start.host.addEventListener('lostpointercapture', onLostCapture)
    stage.focus({ preventScroll: true })
    reflectAffordance()
    return true
  }

  // ANIMATION STORYBOARD: reset interrupts the current gesture, springs all
  // axes to the nearest front, then relinquishes the scheduler at rest.
  // Reduced motion reaches the identical state immediately.
  const reset = (): DevicePreviewState => {
    if (disposed) return store.getSnapshot()
    if (active !== null) finish(active.start.pointerId, true)
    stopMotion()
    const current = store.getSnapshot().orientation
    const targetYawDeg = Math.round(current.yawDeg / 360) * 360
    if (motionEnvironment.reducedMotion()) return publishOrientation(FRONT_DEVICE_ORIENTATION)
    releaseMotion = {
      kind: 'flick-snap', orientation: current,
      velocity: { pitchDegPerSecond: 0, yawDegPerSecond: 0, rollDegPerSecond: 0 },
      targetYawDeg, flickDirection: targetYawDeg < current.yawDeg ? -1 : 1,
    }
    scheduleMotion()
    reflectAffordance()
    return store.getSnapshot()
  }

  const onKeyDown: EventListener = (event) => {
    if (event.target !== stage) return
    const keyboard = keyboardInputOf(event)
    if (keyboard === null) return
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(keyboard.key)) return
    trace('orientation-key', { key: keyboard.key })
    const grab = active
    if (grab !== null) finish(grab.start.pointerId, true)
    stopMotion()
    const step = keyboard.shiftKey ? 12 : 5
    const current = store.getSnapshot().orientation
    if (keyboard.key === 'ArrowLeft') {
      publishOrientation(
        keyboard.altKey
          ? { ...current, rollDeg: current.rollDeg - step }
          : { ...current, yawDeg: current.yawDeg - step },
      )
    } else if (keyboard.key === 'ArrowRight') {
      publishOrientation(
        keyboard.altKey
          ? { ...current, rollDeg: current.rollDeg + step }
          : { ...current, yawDeg: current.yawDeg + step },
      )
    } else if (keyboard.key === 'ArrowUp') {
      publishOrientation({ ...current, pitchDeg: current.pitchDeg + step })
    } else if (keyboard.key === 'ArrowDown') {
      publishOrientation({ ...current, pitchDeg: current.pitchDeg - step })
    } else if (keyboard.key === 'Home') {
      reset()
    } else {
      return
    }
    event.preventDefault()
  }

  const interruptForVisibility = () => {
    const current = active
    if (current !== null) {
      const sample = current.samples.at(-1) ?? current.start
      rendererMotion?.pointer('pointer-cancel', { clientX: sample.clientX, clientY: sample.clientY, pointerId: current.start.pointerId, pointerType: current.start.pointerType, timestampMs: motionTimestamp(motionEnvironment.now()) })
      finish(current.start.pointerId, true)
    }
    stopMotion()
  }
  const onBlur: EventListener = () => { trace('orientation-blur'); interruptForVisibility() }
  const onVisibility: EventListener = () => {
    if (visibilityHost?.hidden) { trace('orientation-hidden'); interruptForVisibility() }
  }

  const unsubscribe = store.subscribe(() => {
    const next = store.getSnapshot().orientation
    const changed = !sameOrientation(observedOrientation, next)
    observedOrientation = next
    // Ignore only our intended value, not external mutations made by another
    // synchronous subscriber while our publication is still on the stack.
    if (!changed || (publishingOrientation !== null && sameOrientation(publishingOrientation, next))) return
    trace('external-orientation-write')
    rendererMotion?.publishIntent(next)
    // Reset/preset/tool writes supersede the gesture rather than being undone
    // by its next animation frame or pointer sample.
    if (active !== null) finish(active.start.pointerId, true)
    stopMotion()
  })
  stage.addEventListener('keydown', onKeyDown)
  blurHost.addEventListener('blur', onBlur)
  visibilityHost?.addEventListener('visibilitychange', onVisibility)
  return {
    begin,
    reset,
    read: store.getSnapshot,
    rotate(xDeg, yDeg) {
      trace('rotate-request', { xDeg, yDeg })
      if (disposed) throw new Error('Device orientation controller disposed')
      if (!Number.isFinite(xDeg) || !Number.isFinite(yDeg)) throw new TypeError('Rotation deltas must be finite degrees')
      if (active !== null) throw new Error('Device is being held by a person')
      const current = store.getSnapshot().orientation
      const pitchDeg = current.pitchDeg + xDeg
      const yawDeg = current.yawDeg + yDeg
      if (!Number.isFinite(pitchDeg) || !Number.isFinite(yawDeg)) throw new RangeError('Rotation exceeds finite degree range')
      stopMotion()
      return publishOrientation({ ...current, pitchDeg, yawDeg })
    },
    flick(face, signal) {
      trace('flick-request', { face, aborted: signal.aborted })
      if (disposed) return Promise.reject(new Error('Device orientation controller disposed'))
      if (face !== 'front' && face !== 'back') return Promise.reject(new TypeError('Face must be front or back'))
      if (signal.aborted) return Promise.reject(new DOMException('Device orientation motion aborted', 'AbortError'))
      if (active !== null || releaseMotion !== null || pendingFlick !== null) return Promise.reject(new Error('Device orientation is busy'))
      const current = store.getSnapshot().orientation
      const baseYaw = face === 'front' ? 0 : 180
      const targetYawDeg = baseYaw + Math.round((current.yawDeg - baseYaw) / 360) * 360
      if (motionEnvironment.reducedMotion() || current.yawDeg === targetYawDeg) {
        return Promise.resolve(publishOrientation({ ...current, yawDeg: targetYawDeg }))
      }
      // Admission → existing physical face spring → settlement. No guessed timer.
      return new Promise<DevicePreviewState>((resolve, reject) => {
        const onAbort = () => stopMotion()
        pendingFlick = { resolve, reject, cleanup: () => signal.removeEventListener('abort', onAbort) }
        signal.addEventListener('abort', onAbort, { once: true })
        releaseMotion = {
          kind: 'opposite-face',
          orientation: current,
          velocity: { pitchDegPerSecond: 0, yawDegPerSecond: 0, rollDegPerSecond: 0 },
          targetYawDeg,
          flickDirection: targetYawDeg < current.yawDeg ? -1 : 1,
        }
        scheduleMotion()
        reflectAffordance()
      })
    },
    setGrabbable(next) {
      grabbable = next
      reflectAffordance()
    },
    dispose() {
      if (disposed) return
      trace('orientation-disposed')
      disposed = true
      unsubscribe()
      const current = active
      if (current !== null) finish(current.start.pointerId, true)
      stopMotion()
      stage.removeEventListener('keydown', onKeyDown)
      blurHost.removeEventListener('blur', onBlur)
      visibilityHost?.removeEventListener('visibilitychange', onVisibility)
      grabbable = false
      reflectAffordance()
    },
    isActive: () => active !== null,
    isAnimating: () => releaseMotion !== null || motionFrame !== null,
  }
}

function keyboardInputOf(event: Event): {
  readonly key: string
  readonly altKey: boolean
  readonly shiftKey: boolean
} | null {
  const key: unknown = Reflect.get(event, 'key')
  const altKey: unknown = Reflect.get(event, 'altKey')
  const shiftKey: unknown = Reflect.get(event, 'shiftKey')
  if (
    typeof key !== 'string' ||
    typeof altKey !== 'boolean' ||
    typeof shiftKey !== 'boolean'
  ) {
    return null
  }
  return { key, altKey, shiftKey }
}

function pointerIdOf(event: Event): number | null {
  const value: unknown = Reflect.get(event, 'pointerId')
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function pointerMoveOf(event: Event, fallbackTimestampMs: number): {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly timestampMs: number
} | null {
  const pointerId = pointerIdOf(event)
  const clientX: unknown = Reflect.get(event, 'clientX')
  const clientY: unknown = Reflect.get(event, 'clientY')
  const eventTimestamp: unknown = Reflect.get(event, 'timeStamp')
  if (
    pointerId === null ||
    typeof clientX !== 'number' ||
    !Number.isFinite(clientX) ||
    typeof clientY !== 'number' ||
    !Number.isFinite(clientY)
  ) {
    return null
  }
  return {
    pointerId,
    clientX,
    clientY,
    timestampMs:
      typeof eventTimestamp === 'number' && Number.isFinite(eventTimestamp)
        ? eventTimestamp
        : fallbackTimestampMs,
  }
}

function updateGrab(
  grab: ActiveOrientationGrab,
  pointer: PointerMotionSample & { readonly pointerId: number },
  store: Pick<DevicePreviewStore, 'setOrientation'>,
): void {
  const deltaX = pointer.clientX - grab.start.clientX
  const deltaY = pointer.clientY - grab.start.clientY
  const bounded = orientationFromDeviceDrag(
    grab.startOrientation,
    deltaX,
    deltaY,
    grab.start.rollMode,
  )
  grab.currentOrientation = {
    ...bounded,
    yawDeg:
      grab.startOrientation.yawDeg +
      (grab.start.rollMode
        ? 0
        : deltaX * DEVICE_ORIENTATION_DRAG_GAIN.yawDegPerPixel),
  }
  const last = grab.samples.at(-1)
  if (last?.clientX !== pointer.clientX || last.clientY !== pointer.clientY) grab.samples.push(pointer)
  if (grab.samples.length > 12) grab.samples.splice(0, grab.samples.length - 12)
  store.setOrientation(grab.currentOrientation)
}

function browserDeviceOrientationMotionEnvironment(): DeviceOrientationMotionEnvironment {
  const requestFrame = globalThis.requestAnimationFrame
  const cancelFrame = globalThis.cancelAnimationFrame
  return {
    now: () => performance.now(),
    requestFrame:
      typeof requestFrame === 'function'
        ? (callback) => requestFrame(callback)
        : requestFallbackFrame,
    cancelFrame:
      typeof cancelFrame === 'function'
        ? (handle) => cancelFrame(handle)
        : cancelFallbackFrame,
    reducedMotion: () =>
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

let nextFallbackFrame = 0
const fallbackFrames = new Map<number, ReturnType<typeof setTimeout>>()

function requestFallbackFrame(callback: FrameRequestCallback): number {
  nextFallbackFrame += 1
  const handle = nextFallbackFrame
  const timeout = setTimeout(() => {
    fallbackFrames.delete(handle)
    callback(performance.now())
  }, 16)
  fallbackFrames.set(handle, timeout)
  return handle
}

function cancelFallbackFrame(handle: number): void {
  const timeout = fallbackFrames.get(handle)
  if (timeout === undefined) return
  clearTimeout(timeout)
  fallbackFrames.delete(handle)
}

function isFiniteOrientation(orientation: DeviceOrientation): boolean {
  return (
    Number.isFinite(orientation.pitchDeg) &&
    Number.isFinite(orientation.yawDeg) &&
    Number.isFinite(orientation.rollDeg)
  )
}

function freezePreviewState(state: DevicePreviewState): DevicePreviewState {
  return Object.freeze({
    ...state,
    orientation: Object.freeze({ ...state.orientation }),
  })
}

function sameOrientation(
  left: DeviceOrientation,
  right: DeviceOrientation,
): boolean {
  return (
    left.pitchDeg === right.pitchDeg &&
    left.yawDeg === right.yawDeg &&
    left.rollDeg === right.rollDeg
  )
}

function samePreviewState(
  left: DevicePreviewState,
  right: DevicePreviewState,
): boolean {
  return (
    left.colourway === right.colourway &&
    left.pose === right.pose &&
    left.room === right.room &&
    sameOrientation(left.orientation, right.orientation)
  )
}

/** Event timestamps can already be epoch-relative on legacy event sources. */
function motionTimestamp(timestampMs: number): number {
  return timestampMs >= performance.timeOrigin ? timestampMs : performance.timeOrigin + timestampMs
}
