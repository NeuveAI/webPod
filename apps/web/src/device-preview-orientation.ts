import {
  DEVICE_ORIENTATION_PRESETS,
  FRONT_DEVICE_ORIENTATION,
  clampDeviceOrientation,
  type Colourway,
  type DeviceOrientation,
  type DeviceOrientationGrabStart,
  type DevicePosePreset,
} from '@webpod/device'

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

export const DEVICE_ORIENTATION_DRAG_GAIN = Object.freeze({
  pitchDegPerPixel: 0.28,
  yawDegPerPixel: 0.42,
  rollDegPerPixel: 0.18,
})

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
  readonly onMove: EventListener
  readonly onRelease: EventListener
  readonly onCancel: EventListener
  readonly onLostCapture: EventListener
  readonly onBlur: EventListener
}

export type DeviceOrientationControls = {
  /** Called only after the device package raycasts a visible enclosure edge. */
  readonly begin: (start: DeviceOrientationGrabStart) => boolean
  readonly setGrabbable: (grabbable: boolean) => void
  readonly dispose: () => void
  readonly isActive: () => boolean
}

export type DeviceOrientationControlStage = EventTarget & {
  readonly dataset: { [name: string]: string | undefined }
  focus(options?: FocusOptions): void
}

/**
 * Binds edge-initiated free orientation without owning render state.
 *
 * Pointer capture and listeners exist only for one active grab. Movement writes
 * the external store directly; R3F's demand canvas renders those updates and
 * no animation frame is retained after release.
 */
export function bindDeviceOrientationControls(
  stage: DeviceOrientationControlStage,
  store: DevicePreviewStore,
  blurHost: EventTarget = window,
): DeviceOrientationControls {
  let active: ActiveOrientationGrab | null = null
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
  }

  const finish = (pointerId: number, releaseCapture: boolean): boolean => {
    const current = active
    if (current === null || current.start.pointerId !== pointerId) return false
    active = null
    current.start.host.removeEventListener('pointermove', current.onMove)
    current.start.host.removeEventListener('pointerup', current.onRelease)
    current.start.host.removeEventListener('pointercancel', current.onCancel)
    current.start.host.removeEventListener(
      'lostpointercapture',
      current.onLostCapture,
    )
    blurHost.removeEventListener('blur', current.onBlur)
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
    return true
  }

  const begin = (start: DeviceOrientationGrabStart): boolean => {
    if (active !== null) return false
    try {
      start.capture.setPointerCapture(start.pointerId)
    } catch {
      return false
    }

    const onMove: EventListener = (event) => {
      const pointer = pointerMoveOf(event)
      if (pointer === null || pointer.pointerId !== start.pointerId) return
      if (event.cancelable) event.preventDefault()
      store.setOrientation(
        orientationFromDeviceDrag(
          startOrientation,
          pointer.clientX - start.clientX,
          pointer.clientY - start.clientY,
          start.rollMode,
        ),
      )
    }
    const onRelease: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId === null) return
      if (finish(pointerId, true) && event.cancelable) event.preventDefault()
    }
    const onCancel: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId !== null) finish(pointerId, false)
    }
    const onLostCapture: EventListener = (event) => {
      const pointerId = pointerIdOf(event)
      if (pointerId !== null) finish(pointerId, false)
    }
    const onBlur: EventListener = () => {
      finish(start.pointerId, true)
    }
    const startOrientation = store.getSnapshot().orientation
    active = {
      start,
      onMove,
      onRelease,
      onCancel,
      onLostCapture,
      onBlur,
    }
    start.host.addEventListener('pointermove', onMove, { passive: false })
    start.host.addEventListener('pointerup', onRelease, { passive: false })
    start.host.addEventListener('pointercancel', onCancel)
    start.host.addEventListener('lostpointercapture', onLostCapture)
    blurHost.addEventListener('blur', onBlur)
    stage.focus({ preventScroll: true })
    reflectAffordance()
    return true
  }

  const onKeyDown: EventListener = (event) => {
    if (event.target !== stage) return
    const keyboard = keyboardInputOf(event)
    if (keyboard === null) return
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

  stage.addEventListener('keydown', onKeyDown)
  return {
    begin,
    setGrabbable(next) {
      grabbable = next
      reflectAffordance()
    },
    dispose() {
      const current = active
      if (current !== null) finish(current.start.pointerId, true)
      stage.removeEventListener('keydown', onKeyDown)
      grabbable = false
      reflectAffordance()
    },
    isActive: () => active !== null,
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

function pointerMoveOf(event: Event): {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
} | null {
  const pointerId = pointerIdOf(event)
  const clientX: unknown = Reflect.get(event, 'clientX')
  const clientY: unknown = Reflect.get(event, 'clientY')
  if (
    pointerId === null ||
    typeof clientX !== 'number' ||
    !Number.isFinite(clientX) ||
    typeof clientY !== 'number' ||
    !Number.isFinite(clientY)
  ) {
    return null
  }
  return { pointerId, clientX, clientY }
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
