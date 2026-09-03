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
  pose: 'three-quarter',
  orientation: DEVICE_ORIENTATION_PRESETS['three-quarter'],
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
  let state = freezePreviewState(initial)
  const listeners = new Set<() => void>()

  const publish = (next: DevicePreviewState): DevicePreviewState => {
    if (samePreviewState(state, next)) return state
    state = freezePreviewState(next)
    for (const listener of listeners) listener()
    return state
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => state,
    setColourway: (colourway) => publish({ ...state, colourway }),
    setOrientation(orientation) {
      if (!isFiniteOrientation(orientation)) return state
      const next = clampDeviceOrientation(orientation)
      return publish({ ...state, pose: poseForOrientation(next), orientation: next })
    },
    setPose: (pose) =>
      publish({ ...state, pose, orientation: DEVICE_ORIENTATION_PRESETS[pose] }),
    setRoom: (room) => publish({ ...state, room }),
    resetOrientation: () =>
      publish({
        ...state,
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
  /** Called only after the device package raycasts a visible enclosure edge. */
  readonly begin: (start: DeviceOrientationGrabStart) => boolean
  readonly setGrabbable: (grabbable: boolean) => void
  readonly dispose: () => void
  readonly isActive: () => boolean
  readonly isAnimating: () => boolean
}

export type DeviceOrientationControlStage = EventTarget & {
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
): DeviceOrientationControls {
  let active: ActiveOrientationGrab | null = null
  let releaseMotion: DeviceOrientationReleaseMotion | null = null
  let motionFrame: number | null = null
  let lastMotionFrameMs = 0
  let grabbable = false

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
    const elapsedSeconds = (timestampMs - lastMotionFrameMs) / 1_000
    lastMotionFrameMs = timestampMs
    const advanced = advanceDeviceOrientationRelease(current, elapsedSeconds)
    store.setOrientation(advanced.orientation)
    releaseMotion = advanced.motion
    reflectAffordance()
    if (releaseMotion !== null) {
      motionFrame = motionEnvironment.requestFrame(onMotionFrame)
    }
  }

  const beginReleaseMotion = (grab: ActiveOrientationGrab, timestampMs: number) => {
    const pointerVelocity = estimatePointerReleaseVelocity(
      grab.samples,
      timestampMs,
    )
    const deviceVelocity = pointerVelocityToDeviceVelocity(
      pointerVelocity,
      grab.start.rollMode,
    )
    stage.dataset['orientationReleaseYawVelocity'] =
      deviceVelocity.yawDegPerSecond.toFixed(3)
    const release = beginDeviceOrientationRelease(
      grab.startOrientation,
      grab.currentOrientation,
      deviceVelocity,
      motionEnvironment.reducedMotion(),
    )
    store.setOrientation(release.orientation)
    releaseMotion = release.motion
    if (releaseMotion !== null) {
      lastMotionFrameMs = motionEnvironment.now()
      motionFrame = motionEnvironment.requestFrame(onMotionFrame)
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
    if (active !== null) return false
    stopMotion()
    try {
      start.capture.setPointerCapture(start.pointerId)
    } catch {
      return false
    }

    const onMove: EventListener = (event) => {
      const current = active
      const pointer = pointerMoveOf(event, motionEnvironment.now())
      if (current === null) return
      if (pointer === null || pointer.pointerId !== start.pointerId) return
      if (event.cancelable) event.preventDefault()
      updateGrab(
        current,
        pointer,
        store,
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
      updateGrab(current, pointer, store)
      const released = finish(pointer.pointerId, true)
      if (released !== null) beginReleaseMotion(released, pointer.timestampMs)
      if (released !== null && event.cancelable) event.preventDefault()
    }
    const onCancel: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId !== null) finish(pointerId, false)
    }
    const onLostCapture: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId !== null) finish(pointerId, false)
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
    start.host.addEventListener('pointermove', onMove, { passive: false })
    start.host.addEventListener('pointerup', onRelease, { passive: false })
    start.host.addEventListener('pointercancel', onCancel)
    start.host.addEventListener('lostpointercapture', onLostCapture)
    stage.focus({ preventScroll: true })
    reflectAffordance()
    return true
  }

  const onKeyDown: EventListener = (event) => {
    if (event.target !== stage) return
    const keyboard = keyboardInputOf(event)
    if (keyboard === null) return
    stopMotion()
    const step = keyboard.shiftKey ? 12 : 5
    const current = store.getSnapshot().orientation
    if (keyboard.key === 'ArrowLeft') {
      store.setOrientation(
        keyboard.altKey
          ? { ...current, rollDeg: current.rollDeg - step }
          : { ...current, yawDeg: current.yawDeg - step },
      )
    } else if (keyboard.key === 'ArrowRight') {
      store.setOrientation(
        keyboard.altKey
          ? { ...current, rollDeg: current.rollDeg + step }
          : { ...current, yawDeg: current.yawDeg + step },
      )
    } else if (keyboard.key === 'ArrowUp') {
      store.setOrientation({ ...current, pitchDeg: current.pitchDeg + step })
    } else if (keyboard.key === 'ArrowDown') {
      store.setOrientation({ ...current, pitchDeg: current.pitchDeg - step })
    } else if (keyboard.key === 'Home') {
      store.resetOrientation()
    } else {
      return
    }
    event.preventDefault()
  }

  const onBlur: EventListener = () => {
    const current = active
    if (current !== null) finish(current.start.pointerId, true)
    stopMotion()
  }

  stage.addEventListener('keydown', onKeyDown)
  blurHost.addEventListener('blur', onBlur)
  return {
    begin,
    setGrabbable(next) {
      grabbable = next
      reflectAffordance()
    },
    dispose() {
      const current = active
      if (current !== null) finish(current.start.pointerId, true)
      stopMotion()
      stage.removeEventListener('keydown', onKeyDown)
      blurHost.removeEventListener('blur', onBlur)
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
  store: DevicePreviewStore,
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
  grab.samples.push(pointer)
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
