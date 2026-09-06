import { describe, expect, test } from 'bun:test'
import {
  DEVICE_ORIENTATION_PRESETS,
  FRONT_DEVICE_ORIENTATION,
  type DeviceOrientationGrabStart,
  type DeviceOrientationPointerCapture,
} from '@webpod/device'

import {
  DEVICE_ORIENTATION_DRAG_GAIN,
  bindDeviceOrientationControls,
  createDevicePreviewStore,
  orientationFromDeviceDrag,
  type DeviceOrientationMotionEnvironment,
} from './device-preview-orientation'

class FakeStage extends EventTarget {
  readonly dataset: { [name: string]: string | undefined } = {}
  focusCount = 0

  focus(): void {
    this.focusCount += 1
  }
}

class FakeCapture implements DeviceOrientationPointerCapture {
  readonly captured = new Set<number>()
  readonly releases: number[] = []

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
    this.releases.push(pointerId)
  }
}

class ThrowingReleaseCapture extends FakeCapture {
  override releasePointerCapture(): void {
    throw new DOMException('pointer already released', 'NotFoundError')
  }
}

class FrameEnvironment implements DeviceOrientationMotionEnvironment {
  currentTimeMs = 0
  reduced = false
  private nextHandle = 0
  private readonly frames = new Map<number, FrameRequestCallback>()

  readonly now = (): number => this.currentTimeMs

  readonly requestFrame = (callback: FrameRequestCallback): number => {
    this.nextHandle += 1
    this.frames.set(this.nextHandle, callback)
    return this.nextHandle
  }

  readonly cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  readonly reducedMotion = (): boolean => this.reduced

  get pendingFrames(): number {
    return this.frames.size
  }

  step(elapsedMs: number): void {
    this.currentTimeMs += elapsedMs
    const callbacks = [...this.frames.values()]
    this.frames.clear()
    for (const callback of callbacks) callback(this.currentTimeMs)
  }

  runUntilIdle(frameMs = 1_000 / 60): void {
    for (let frame = 0; frame < 2_000 && this.frames.size > 0; frame += 1) {
      this.step(frameMs)
    }
    if (this.frames.size > 0) throw new Error('orientation release did not settle')
  }
}

describe('external device preview orientation', () => {
  test('publishes only real changes and reset preserves room and colourway', () => {
    const store = createDevicePreviewStore()
    let notifications = 0
    const unsubscribe = store.subscribe(() => {
      notifications += 1
    })

    expect(store.getSnapshot()).toEqual({
      colourway: 'black',
      pose: 'front',
      orientation: FRONT_DEVICE_ORIENTATION,
      room: 'dark',
    })
    store.setPose('three-quarter')
    expect(notifications).toBe(1)
    store.setColourway('white')
    store.setRoom('light')
    store.setPose('rear')
    expect(notifications).toBe(4)

    const reset = store.resetOrientation()
    expect(reset).toEqual({
      colourway: 'white',
      pose: 'front',
      orientation: FRONT_DEVICE_ORIENTATION,
      room: 'light',
    })
    expect(notifications).toBe(5)
    expect(Object.isFrozen(reset)).toBe(true)
    expect(Object.isFrozen(reset.orientation)).toBe(true)
    unsubscribe()
  })

  test('normal drag reaches the rear, wraps yaw, and clamps pitch', () => {
    expect(DEVICE_ORIENTATION_DRAG_GAIN).toEqual({
      pitchDegPerPixel: 0.28,
      yawDegPerPixel: 0.42,
      rollDegPerPixel: 0.18,
    })
    const toRear = orientationFromDeviceDrag(
      FRONT_DEVICE_ORIENTATION,
      180 / DEVICE_ORIENTATION_DRAG_GAIN.yawDegPerPixel,
      0,
      false,
    )
    expect(toRear.yawDeg).toBeCloseTo(180, 8)
    expect(toRear.pitchDeg).toBe(0)

    expect(
      orientationFromDeviceDrag(FRONT_DEVICE_ORIENTATION, 2_000, 2_000, false),
    ).toEqual({ pitchDeg: 45, yawDeg: 120, rollDeg: 0 })
    expect(
      orientationFromDeviceDrag(FRONT_DEVICE_ORIENTATION, -2_000, -2_000, false),
    ).toEqual({ pitchDeg: -45, yawDeg: -120, rollDeg: 0 })
    expect(
      orientationFromDeviceDrag(FRONT_DEVICE_ORIENTATION, Number.NaN, 10, false),
    ).toEqual(FRONT_DEVICE_ORIENTATION)
  })

  test('malformed external orientation cannot poison the shared store', () => {
    const store = createDevicePreviewStore()
    const before = store.getSnapshot()
    store.setOrientation({ pitchDeg: Number.NaN, yawDeg: 0, rollDeg: 0 })
    store.setOrientation({ pitchDeg: 0, yawDeg: Number.POSITIVE_INFINITY, rollDeg: 0 })
    expect(store.getSnapshot()).toBe(before)
  })

  test('Option drag is an explicit bounded roll gesture without yaw drift', () => {
    expect(
      orientationFromDeviceDrag(
        DEVICE_ORIENTATION_PRESETS['three-quarter'],
        1_000,
        -1_000,
        true,
      ),
    ).toEqual({ pitchDeg: -45, yawDeg: -34, rollDeg: 18 })
  })

  test('captures mouse movement beyond the edge and releases exactly once', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const blurHost = new EventTarget()
    const capture = new FakeCapture()
    const store = createDevicePreviewStore()
    store.resetOrientation()
    const controls = bindDeviceOrientationControls(stage, store, blurHost)

    controls.setGrabbable(true)
    expect(stage.dataset['orientationGrab']).toBe('ready')
    expect(controls.begin(grabStart(host, capture, 'mouse', 7, 20, 30))).toBe(true)
    expect(capture.captured.has(7)).toBe(true)
    expect(stage.dataset['orientationGrab']).toBe('active')
    expect(stage.dataset['orientationPointerId']).toBe('7')
    expect(stage.focusCount).toBe(1)

    const move = pointerEvent('pointermove', 7, 120, 80)
    host.dispatchEvent(move)
    expect(move.defaultPrevented).toBe(true)
    const moved = store.getSnapshot().orientation
    expect(moved.pitchDeg).toBeCloseTo(14, 8)
    expect(moved.yawDeg).toBeCloseTo(42, 8)
    expect(moved.rollDeg).toBe(0)

    const release = pointerEvent('pointerup', 7, 120, 80)
    host.dispatchEvent(release)
    expect(release.defaultPrevented).toBe(true)
    expect(capture.releases).toEqual([7])
    expect(controls.isActive()).toBe(false)
    expect(stage.dataset['orientationGrab']).toBe('ready')
    expect(stage.dataset['orientationPointerId']).toBeUndefined()

    host.dispatchEvent(pointerEvent('pointermove', 7, 500, 500))
    expect(store.getSnapshot().orientation).toEqual(moved)
    controls.dispose()
  })

  test('production release continues over frames and a fast yaw flick lands opposite', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const capture = new FakeCapture()
    const store = createDevicePreviewStore()
    store.resetOrientation()
    const frames = new FrameEnvironment()
    const controls = bindDeviceOrientationControls(
      stage,
      store,
      new EventTarget(),
      frames,
    )

    expect(frames.pendingFrames).toBe(0)
    expect(controls.begin(grabStart(host, capture, 'touch', 31, 0, 0))).toBe(true)
    host.dispatchEvent(pointerEvent('pointermove', 31, 30, 0, 20))
    host.dispatchEvent(pointerEvent('pointermove', 31, 60, 0, 40))
    host.dispatchEvent(pointerEvent('pointerup', 31, 90, 0, 60))

    const atRelease = store.getSnapshot().orientation.yawDeg
    expect(atRelease).toBeCloseTo(37.8, 8)
    expect(controls.isActive()).toBe(false)
    expect(controls.isAnimating()).toBe(true)
    expect(stage.dataset['orientationMotion']).toBe('opposite-face')
    expect(frames.pendingFrames).toBe(1)

    frames.step(16)
    const afterOneFrame = store.getSnapshot().orientation.yawDeg
    frames.step(16)
    const afterTwoFrames = store.getSnapshot().orientation.yawDeg
    expect(afterOneFrame).toBeGreaterThan(atRelease)
    expect(afterTwoFrames).toBeGreaterThan(afterOneFrame)

    frames.runUntilIdle()
    expect(store.getSnapshot().orientation.yawDeg).toBe(180)
    expect(controls.isAnimating()).toBe(false)
    expect(stage.dataset['orientationMotion']).toBeUndefined()
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('a new grab and blur interrupt release motion without an idle frame', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const blurHost = new EventTarget()
    const capture = new FakeCapture()
    const frames = new FrameEnvironment()
    const controls = bindDeviceOrientationControls(
      stage,
      createDevicePreviewStore(),
      blurHost,
      frames,
    )

    expect(controls.begin(grabStart(host, capture, 'mouse', 41, 0, 0))).toBe(true)
    host.dispatchEvent(pointerEvent('pointermove', 41, 30, 0, 20))
    host.dispatchEvent(pointerEvent('pointerup', 41, 60, 0, 40))
    expect(frames.pendingFrames).toBe(1)

    expect(controls.begin(grabStart(host, capture, 'mouse', 42, 60, 0))).toBe(true)
    expect(frames.pendingFrames).toBe(0)
    expect(controls.isAnimating()).toBe(false)
    host.dispatchEvent(pointerEvent('pointercancel', 42, 60, 0, 50))

    expect(controls.begin(grabStart(host, capture, 'mouse', 43, 0, 0))).toBe(true)
    host.dispatchEvent(pointerEvent('pointermove', 43, 30, 0, 70))
    host.dispatchEvent(pointerEvent('pointerup', 43, 60, 0, 90))
    expect(frames.pendingFrames).toBe(1)
    blurHost.dispatchEvent(new Event('blur'))
    expect(frames.pendingFrames).toBe(0)
    expect(controls.isAnimating()).toBe(false)

    frames.step(1_000)
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('reduced motion resolves a fast semantic release without scheduling', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const frames = new FrameEnvironment()
    frames.reduced = true
    const store = createDevicePreviewStore()
    store.resetOrientation()
    const controls = bindDeviceOrientationControls(
      stage,
      store,
      new EventTarget(),
      frames,
    )
    const capture = new FakeCapture()

    expect(controls.begin(grabStart(host, capture, 'pen', 51, 0, 0))).toBe(true)
    host.dispatchEvent(pointerEvent('pointermove', 51, -30, 0, 20))
    host.dispatchEvent(pointerEvent('pointerup', 51, -60, 0, 40))

    expect(store.getSnapshot().orientation.yawDeg).toBe(180)
    expect(controls.isAnimating()).toBe(false)
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('supports touch and makes duplicate pointers, cancel, blur, and dispose safe', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const blurHost = new EventTarget()
    const firstCapture = new FakeCapture()
    const secondCapture = new FakeCapture()
    const store = createDevicePreviewStore()
    const controls = bindDeviceOrientationControls(stage, store, blurHost)

    expect(controls.begin(grabStart(host, firstCapture, 'touch', 11, 0, 0))).toBe(
      true,
    )
    expect(controls.begin(grabStart(host, secondCapture, 'pen', 12, 0, 0))).toBe(
      false,
    )
    const unrelatedRelease = pointerEvent('pointerup', 12, 0, 0)
    host.dispatchEvent(unrelatedRelease)
    expect(unrelatedRelease.defaultPrevented).toBe(false)
    expect(controls.isActive()).toBe(true)
    host.dispatchEvent(pointerEvent('pointercancel', 11, 0, 0))
    expect(controls.isActive()).toBe(false)
    expect(firstCapture.releases).toEqual([11])

    expect(controls.begin(grabStart(host, firstCapture, 'touch', 13, 0, 0))).toBe(
      true,
    )
    blurHost.dispatchEvent(new Event('blur'))
    expect(firstCapture.releases).toEqual([11, 13])
    expect(controls.isActive()).toBe(false)

    expect(controls.begin(grabStart(host, firstCapture, 'mouse', 14, 0, 0))).toBe(
      true,
    )
    controls.dispose()
    expect(firstCapture.releases).toEqual([11, 13, 14])
    expect(stage.dataset['orientationGrab']).toBeUndefined()
    host.dispatchEvent(pointerEvent('pointermove', 14, 300, 300))
  })

  test('teardown remains silent when the browser has already dropped capture', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const capture = new ThrowingReleaseCapture()
    const controls = bindDeviceOrientationControls(
      stage,
      createDevicePreviewStore(),
      new EventTarget(),
    )

    expect(controls.begin(grabStart(host, capture, 'pen', 18, 0, 0))).toBe(true)
    expect(() => controls.dispose()).not.toThrow()
    expect(controls.isActive()).toBe(false)
  })

  for (const ending of ['pointercancel', 'lostpointercapture'] as const) {
    test(`${ending} settles an edge pose, clears capture and permits another grab`, () => {
      const stage = new FakeStage()
      const host = new EventTarget()
      const capture = new FakeCapture()
      const frames = new FrameEnvironment()
      const store = createDevicePreviewStore()
      const controls = bindDeviceOrientationControls(stage, store, new EventTarget(), frames)
      controls.begin(grabStart(host, capture, 'mouse', 5, 0, 0))
      host.dispatchEvent(pointerEvent('pointermove', 5, 240, 0, 200))
      host.dispatchEvent(pointerEvent(ending, 5, 240, 0, 210))
      expect(controls.isActive()).toBe(false)
      expect(capture.captured.size).toBe(0)
      frames.runUntilIdle()
      expect(store.getSnapshot().orientation.yawDeg).toBe(180)
      expect(controls.begin(grabStart(host, capture, 'mouse', 6, 240, 0))).toBe(true)
      controls.dispose()
      expect(frames.pendingFrames).toBe(0)
    })
  }

  test('a held release cannot refresh stale flick samples', () => {
    const host = new EventTarget()
    const frames = new FrameEnvironment()
    const store = createDevicePreviewStore()
    const stage = new FakeStage()
    const controls = bindDeviceOrientationControls(stage, store, new EventTarget(), frames)
    controls.begin(grabStart(host, new FakeCapture(), 'mouse', 5, 0, 0))
    host.dispatchEvent(pointerEvent('pointermove', 5, 60, 0, 20))
    host.dispatchEvent(pointerEvent('pointerup', 5, 60, 0, 100))
    expect(stage.dataset['orientationReleaseYawVelocity']).toBe('0.000')
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation.yawDeg).toBe(0)
    controls.dispose()
  })

  test('keyboard interrupts a captured drag and unrelated keys do not interrupt settling', () => {
    const host = new EventTarget()
    const frames = new FrameEnvironment()
    const store = createDevicePreviewStore()
    const stage = new FakeStage()
    const controls = bindDeviceOrientationControls(stage, store, new EventTarget(), frames)
    const capture = new FakeCapture()
    controls.begin(grabStart(host, capture, 'mouse', 5, 0, 0))
    host.dispatchEvent(pointerEvent('pointermove', 5, 60, 0, 20))
    stage.dispatchEvent(keyboardEvent('Home', { altKey: false, shiftKey: false }))
    host.dispatchEvent(pointerEvent('pointermove', 5, 100, 0, 40))
    expect(store.getSnapshot().orientation.yawDeg).toBe(0)
    expect(controls.isActive()).toBe(false)
    expect(capture.captured.size).toBe(0)
    controls.begin(grabStart(host, capture, 'mouse', 6, 0, 0))
    host.dispatchEvent(pointerEvent('pointerup', 6, 60, 0, 40))
    stage.dispatchEvent(keyboardEvent('Tab', { altKey: false, shiftKey: false }))
    expect(controls.isAnimating()).toBe(true)
    frames.reduced = true
    frames.step(16)
    expect(store.getSnapshot().orientation.yawDeg).toBe(180)
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('re-grabbing samples the current pose and external reset cancels all pending work', () => {
    const host = new EventTarget()
    const frames = new FrameEnvironment()
    const store = createDevicePreviewStore()
    const controls = bindDeviceOrientationControls(new FakeStage(), store, new EventTarget(), frames)
    const capture = new FakeCapture()
    controls.begin(grabStart(host, capture, 'mouse', 5, 0, 0))
    host.dispatchEvent(pointerEvent('pointerup', 5, 60, 0, 40))
    frames.step(80)
    const seen = store.getSnapshot().orientation.yawDeg
    expect(seen).toBeGreaterThan(25.2)
    expect(seen).toBeLessThan(180)
    controls.begin(grabStart(host, capture, 'mouse', 6, 60, 0))
    expect(store.getSnapshot().orientation.yawDeg).toBe(seen)
    host.dispatchEvent(pointerEvent('pointermove', 6, 50, 0, 100))
    expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(seen - 4.2, 8)
    store.resetOrientation()
    host.dispatchEvent(pointerEvent('pointermove', 6, 40, 0, 120))
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation.yawDeg).toBe(0)
    expect(controls.isActive()).toBe(false)
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('failed capture does not strand a settling device', () => {
    const host = new EventTarget()
    const frames = new FrameEnvironment()
    const store = createDevicePreviewStore()
    const controls = bindDeviceOrientationControls(new FakeStage(), store, new EventTarget(), frames)
    controls.begin(grabStart(host, new FakeCapture(), 'mouse', 5, 0, 0))
    host.dispatchEvent(pointerEvent('pointerup', 5, 60, 0, 40))
    const broken = new FakeCapture()
    broken.setPointerCapture = () => { throw new DOMException('inactive pointer', 'NotFoundError') }
    expect(controls.begin(grabStart(host, broken, 'mouse', 6, 0, 0))).toBe(false)
    expect(controls.isAnimating()).toBe(true)
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation.yawDeg).toBe(180)
    controls.dispose()
  })

  test('idle window blur preserves a chosen inspection pose', () => {
    const store = createDevicePreviewStore()
    const blurHost = new EventTarget()
    const controls = bindDeviceOrientationControls(new FakeStage(), store, blurHost, new FrameEnvironment())
    store.setOrientation({ pitchDeg: 10, yawDeg: 45, rollDeg: 2 })
    blurHost.dispatchEvent(new Event('blur'))
    expect(store.getSnapshot().orientation).toEqual({ pitchDeg: 10, yawDeg: 45, rollDeg: 2 })
    controls.dispose()
  })

  test('keyboard fallback is stage-scoped, supports roll, and resets', () => {
    const stage = new FakeStage()
    const store = createDevicePreviewStore()
    store.resetOrientation()
    const controls = bindDeviceOrientationControls(stage, store, new EventTarget())

    const right = keyboardEvent('ArrowRight', { altKey: false, shiftKey: false })
    stage.dispatchEvent(right)
    expect(right.defaultPrevented).toBe(true)
    expect(store.getSnapshot().orientation.yawDeg).toBe(5)

    stage.dispatchEvent(
      keyboardEvent('ArrowRight', { altKey: true, shiftKey: true }),
    )
    expect(store.getSnapshot().orientation).toEqual({
      pitchDeg: 0,
      yawDeg: 5,
      rollDeg: 12,
    })
    stage.dispatchEvent(keyboardEvent('Home', { altKey: false, shiftKey: false }))
    expect(store.getSnapshot().orientation).toEqual(FRONT_DEVICE_ORIENTATION)
    controls.dispose()
  })
})

function grabStart(
  host: EventTarget,
  capture: DeviceOrientationPointerCapture,
  pointerType: DeviceOrientationGrabStart['pointerType'],
  pointerId: number,
  clientX: number,
  clientY: number,
): DeviceOrientationGrabStart {
  return {
    pointerId,
    pointerType,
    clientX,
    clientY,
    timestampMs: 0,
    rollMode: false,
    host,
    capture,
  }
}

function pointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  timestampMs?: number,
): Event {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
    ...(timestampMs === undefined
      ? {}
      : { timeStamp: { value: timestampMs } }),
  })
  return event
}

function keyboardEvent(
  key: string,
  modifiers: { readonly altKey: boolean; readonly shiftKey: boolean },
): Event {
  const event = new Event('keydown', { cancelable: true })
  Object.defineProperties(event, {
    key: { value: key },
    altKey: { value: modifiers.altKey },
    shiftKey: { value: modifiers.shiftKey },
  })
  return event
}
