import { createPreviewMotionAuthority } from './device-motion-authority'
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
  constructor(readonly ownerDocument?: EventTarget & { readonly hidden: boolean }) { super() }
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

  test('production release continues over frames and a fast yaw flick coasts to an arbitrary angle', () => {
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
    expect(stage.dataset['orientationMotion']).toBe('coast')
    expect(frames.pendingFrames).toBe(1)

    frames.step(16)
    const afterOneFrame = store.getSnapshot().orientation.yawDeg
    frames.step(16)
    const afterTwoFrames = store.getSnapshot().orientation.yawDeg
    expect(afterOneFrame).toBeGreaterThan(atRelease)
    expect(afterTwoFrames).toBeGreaterThan(afterOneFrame)

    frames.runUntilIdle()
    expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(121.8, 8)
    expect(controls.isAnimating()).toBe(false)
    expect(stage.dataset['orientationMotion']).toBeUndefined()
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('a deliberate horizontal flick snaps flat and can be caught midway', () => {
    const stage = new FakeStage()
    const host = new EventTarget()
    const frames = new FrameEnvironment()
    const store = createDevicePreviewStore()
    const controls = bindDeviceOrientationControls(stage, store, new EventTarget(), frames)
    store.setOrientation({ pitchDeg: 12, yawDeg: 0, rollDeg: -6 })
    controls.begin(grabStart(host, new FakeCapture(), 'mouse', 31, 0, 0))
    host.dispatchEvent(pointerEvent('pointermove', 31, 50, 0, 20))
    host.dispatchEvent(pointerEvent('pointerup', 31, 100, 0, 40))
    expect(stage.dataset['orientationMotion']).toBe('flick-snap')
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation).toEqual({ pitchDeg: 0, yawDeg: 180, rollDeg: 0 })
    controls.begin(grabStart(host, new FakeCapture(), 'mouse', 32, 0, 0))
    host.dispatchEvent(pointerEvent('pointermove', 32, 50, 0, 20))
    host.dispatchEvent(pointerEvent('pointerup', 32, 100, 0, 40))
    frames.step(16)
    const caught = store.getSnapshot().orientation
    controls.begin(grabStart(host, new FakeCapture(), 'mouse', 33, 100, 0))
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation).toEqual(caught)
    expect(controls.isAnimating()).toBe(false)
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

  test('reduced motion preserves the release pose without scheduling', () => {
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

    expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(-25.2, 8)
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
    test(`${ending} preserves an edge pose, clears capture and permits another grab`, () => {
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
      expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(100.8, 8)
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
    expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(25.2, 8)
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
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation.yawDeg).toBe(0)
    expect(controls.isActive()).toBe(false)
    expect(capture.captured.size).toBe(0)
    controls.begin(grabStart(host, capture, 'mouse', 6, 0, 0))
    host.dispatchEvent(pointerEvent('pointerup', 6, 60, 0, 40))
    stage.dispatchEvent(keyboardEvent('Tab', { altKey: false, shiftKey: false }))
    expect(controls.isAnimating()).toBe(true)
    frames.reduced = true
    frames.step(16)
    expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(25.2, 8)
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
    expect(store.getSnapshot().orientation.yawDeg).toBeCloseTo(109.2, 8)
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
    const frames = new FrameEnvironment()
    const controls = bindDeviceOrientationControls(stage, store, new EventTarget(), frames)

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
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation).toEqual(FRONT_DEVICE_ORIENTATION)
    controls.dispose()
  })
})

describe('tool orientation controls', () => {
  function setup() {
    const stage = new FakeStage()
    const blur = new EventTarget()
    const store = createDevicePreviewStore()
    const frames = new FrameEnvironment()
    const controls = bindDeviceOrientationControls(stage, store, blur, frames)
    return { stage, blur, store, frames, controls }
  }

  test('reset springs every axis to front and a new command interrupts it', () => {
    const { controls, frames, store } = setup()
    store.setOrientation({ pitchDeg: 25, yawDeg: 170, rollDeg: 20 })
    controls.reset()
    expect(store.getSnapshot().orientation.yawDeg).toBe(170)
    frames.step(100)
    expect(store.getSnapshot().orientation.yawDeg).toBeGreaterThan(0)
    expect(store.getSnapshot().orientation.yawDeg).toBeLessThan(170)
    frames.runUntilIdle()
    expect(store.getSnapshot().orientation).toEqual(FRONT_DEVICE_ORIENTATION)
    store.setPose('rear')
    controls.reset()
    frames.step(32)
    controls.rotate(5, 10)
    const interrupted = store.getSnapshot()
    frames.runUntilIdle()
    expect(store.getSnapshot()).toBe(interrupted)
    frames.reduced = true
    controls.reset()
    expect(store.getSnapshot().orientation).toEqual(FRONT_DEVICE_ORIENTATION)
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('rotates degree deltas with actual clamping and rejects nonfinite input', () => {
    const { controls, store } = setup()
    expect(controls.rotate(90, 20).orientation).toEqual({ pitchDeg: 45, yawDeg: 20, rollDeg: 0 })
    expect(controls.rotate(-5, 10).orientation).toEqual({ pitchDeg: 40, yawDeg: 30, rollDeg: 0 })
    const before = store.getSnapshot()
    expect(() => controls.rotate(NaN, 0)).toThrow('finite')
    expect(() => controls.rotate(0, Infinity)).toThrow('finite')
    expect(store.getSnapshot()).toBe(before)
    controls.dispose()
    expect(() => controls.rotate(0, 0)).toThrow('disposed')
  })

  test('flick resolves only after shared physical spring settles at the requested face', async () => {
    const { controls, frames, store } = setup()
    let settled = false
    const result = controls.flick('back', new AbortController().signal).then((value) => { settled = true; return value })
    frames.step(16)
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(store.getSnapshot().orientation.yawDeg).toBeGreaterThan(0)
    expect(store.getSnapshot().orientation.yawDeg).toBeLessThan(180)
    frames.runUntilIdle()
    expect((await result).orientation.yawDeg).toBe(180)
    expect(controls.isAnimating()).toBe(false)
    const front = controls.flick('front', new AbortController().signal)
    frames.runUntilIdle()
    expect((await front).orientation.yawDeg % 360).toBe(0)
    controls.dispose()
  })

  test('reduced motion settles without frames and reacts during a flick', async () => {
    const { controls, frames } = setup()
    frames.reduced = true
    expect((await controls.flick('back', new AbortController().signal)).orientation.yawDeg).toBe(180)
    expect(frames.pendingFrames).toBe(0)
    frames.reduced = false
    const result = controls.flick('front', new AbortController().signal)
    frames.step(16)
    frames.reduced = true
    frames.step(16)
    expect((await result).orientation.yawDeg % 360).toBe(0)
    expect(frames.pendingFrames).toBe(0)
    controls.dispose()
  })

  test('concurrent and already-aborted calls leave the admitted flick intact', async () => {
    const { controls, frames } = setup()
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(controls.flick('back', cancelled.signal)).rejects.toThrow('aborted')
    expect(frames.pendingFrames).toBe(0)
    const admitted = controls.flick('back', new AbortController().signal)
    await expect(controls.flick('front', new AbortController().signal)).rejects.toThrow('busy')
    frames.runUntilIdle()
    expect((await admitted).orientation.yawDeg).toBe(180)
    controls.dispose()
  })

  for (const interruption of ['abort', 'dispose', 'blur', 'external-write', 'rotate', 'human-grab'] as const) {
    test(`${interruption} rejects the pending flick and removes its frame`, async () => {
      const { controls, frames, store, blur } = setup()
      const abort = new AbortController()
      const result = controls.flick('back', abort.signal)
      const rejected = result.then(() => null, (error: unknown) => error)
      frames.step(16)
      if (interruption === 'abort') abort.abort()
      if (interruption === 'dispose') controls.dispose()
      if (interruption === 'blur') blur.dispatchEvent(new Event('blur'))
      if (interruption === 'external-write') store.setPose('edge')
      if (interruption === 'rotate') controls.rotate(2, 3)
      if (interruption === 'human-grab') {
        expect(controls.begin(grabStart(new EventTarget(), new FakeCapture(), 'mouse', 5, 0, 0))).toBe(true)
        expect(() => controls.rotate(1, 1)).toThrow('held')
        await expect(controls.flick('front', new AbortController().signal)).rejects.toThrow('busy')
      }
      expect(await rejected).toMatchObject({ name: 'AbortError' })
      expect(frames.pendingFrames).toBe(0)
      const stopped = store.getSnapshot()
      frames.step(100)
      expect(store.getSnapshot()).toBe(stopped)
      controls.dispose()
      await expect(controls.flick('front', abort.signal)).rejects.toThrow('disposed')
    })
  }

  test('abort from an orientation subscriber cannot resurrect the frame loop', async () => {
    const { controls, frames, store } = setup()
    const abort = new AbortController()
    const unsubscribe = store.subscribe(() => abort.abort())
    const result = controls.flick('back', abort.signal)
    const rejected = result.then(() => null, (error: unknown) => error)
    frames.step(16)
    expect(await rejected).toMatchObject({ name: 'AbortError' })
    expect(frames.pendingFrames).toBe(0)
    expect(controls.isAnimating()).toBe(false)
    unsubscribe()
    controls.dispose()
  })

  for (const phase of ['intermediate', 'settlement'] as const) {
    test(`nested external mutation during ${phase} publication cancels and preserves the override`, async () => {
      const { controls, frames, store } = setup()
      let overridden = false
      const unsubscribe = store.subscribe(() => {
        if (overridden || (phase === 'settlement' && store.getSnapshot().orientation.yawDeg !== 180)) return
        overridden = true
        store.setPose('edge')
      })
      const result = controls.flick('back', new AbortController().signal)
      const rejected = result.then(() => null, (error: unknown) => error)
      if (phase === 'intermediate') frames.step(16)
      else frames.runUntilIdle()
      expect(overridden).toBe(true)
      expect(await rejected).toMatchObject({ name: 'AbortError' })
      expect(store.getSnapshot().pose).toBe('edge')
      expect(controls.isAnimating()).toBe(false)
      expect(frames.pendingFrames).toBe(0)
      frames.runUntilIdle()
      expect(store.getSnapshot().orientation).toEqual(DEVICE_ORIENTATION_PRESETS.edge)
      unsubscribe()
      controls.dispose()
    })
  }
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


describe('orientation visibility interruption', () => {
  class Visibility extends EventTarget { hidden = false }
  test('hide without blur cancels main/native hold once, preserves pose, and permits a fresh visible grab', () => {
    const visibility = new Visibility(), stage = new FakeStage(visibility), host = new EventTarget(), blur = new EventTarget()
    const capture = new FakeCapture(), frames = new FrameEnvironment(), store = createDevicePreviewStore()
    const sent: {kind: string; pointerId: number}[] = []
    const authority = createPreviewMotionAuthority()
    const controls = bindDeviceOrientationControls(stage, store, blur, frames, undefined, { ...authority, pointer(kind, sample) { sent.push({kind, pointerId: sample.pointerId}); authority.pointer(kind, sample) } })
    expect(controls.begin(grabStart(host, capture, 'touch', 71, 36, 450))).toBe(true)
    host.dispatchEvent(pointerEvent('pointermove', 71, 90, 450, 200))
    const pose = store.getSnapshot().orientation
    visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange'))
    expect(controls.isActive()).toBe(false); expect(controls.isAnimating()).toBe(false)
    expect(capture.captured.size).toBe(0); expect(capture.releases).toEqual([71])
    expect(sent.filter(item => item.kind === 'pointer-cancel')).toEqual([{kind:'pointer-cancel', pointerId:71}])
    expect(store.getSnapshot().orientation).toEqual(pose)
    host.dispatchEvent(pointerEvent('pointermove', 71, 500, 100, 300))
    host.dispatchEvent(pointerEvent('pointerup', 71, 500, 100, 300))
    blur.dispatchEvent(new Event('blur')); visibility.dispatchEvent(new Event('visibilitychange'))
    expect(sent.filter(item => item.kind === 'pointer-cancel')).toHaveLength(1)
    expect(store.getSnapshot().orientation).toEqual(pose); expect(frames.pendingFrames).toBe(0)
    expect(controls.begin(grabStart(host, capture, 'touch', 72, 0, 0))).toBe(false)
    visibility.hidden = false; visibility.dispatchEvent(new Event('visibilitychange'))
    expect(controls.isActive()).toBe(false)
    expect(controls.begin(grabStart(host, capture, 'touch', 73, 0, 0))).toBe(true)
    controls.dispose(); const count = sent.length
    visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange'))
    expect(sent).toHaveLength(count); expect(capture.releases).toEqual([71,73])
  })
  test('hide interrupts a pending flick, cancels its frame and does not resume on return', async () => {
    const visibility = new Visibility(), frames = new FrameEnvironment(), store = createDevicePreviewStore()
    const controls = bindDeviceOrientationControls(new FakeStage(visibility), store, new EventTarget(), frames)
    const flick = controls.flick('back', new AbortController().signal)
    const rejection = flick.then(() => null, (error: unknown) => error)
    frames.step(16); const pose = store.getSnapshot().orientation
    visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange')); expect(await rejection).toMatchObject({name: 'AbortError'})
    expect(controls.isAnimating()).toBe(false); expect(frames.pendingFrames).toBe(0)
    visibility.hidden = false; visibility.dispatchEvent(new Event('visibilitychange')); frames.step(1000)
    expect(store.getSnapshot().orientation).toEqual(pose); controls.dispose()
  })
  test('hide cancels remote motion ownership exactly once and rejects late renderer progress', async () => {
    const visibility = new Visibility(), store = createDevicePreviewStore(), frames = new FrameEnvironment()
    const authority = createPreviewMotionAuthority(); let cancellations = 0
    let progress: ((orientation: typeof FRONT_DEVICE_ORIENTATION) => void) | null = null
    const controls = bindDeviceOrientationControls(new FakeStage(visibility), store, new EventTarget(), frames, undefined, {...authority, startOrientation(_motion, publish) { progress = publish; return () => { cancellations++ } }})
    const rejected = controls.flick('back', new AbortController().signal).then(() => null, (error: unknown) => error)
    expect(controls.isAnimating()).toBe(true); expect(frames.pendingFrames).toBe(0)
    const pose = store.getSnapshot().orientation
    visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange'))
    expect(await rejected).toMatchObject({name:'AbortError'}); expect(cancellations).toBe(1)
    const sendLate = progress as ((orientation: typeof FRONT_DEVICE_ORIENTATION) => void) | null
    sendLate?.({...FRONT_DEVICE_ORIENTATION,yawDeg:180})
    expect(store.getSnapshot().orientation).toEqual(pose); expect(controls.isAnimating()).toBe(false)
    visibility.dispatchEvent(new Event('visibilitychange')); controls.dispose(); expect(cancellations).toBe(1)
  })

})
