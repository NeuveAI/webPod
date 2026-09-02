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

describe('external device preview orientation', () => {
  test('publishes only real changes and reset preserves room and colourway', () => {
    const store = createDevicePreviewStore()
    let notifications = 0
    const unsubscribe = store.subscribe(() => {
      notifications += 1
    })

    store.setPose('three-quarter')
    expect(notifications).toBe(0)
    store.setColourway('white')
    store.setRoom('light')
    store.setPose('rear')
    expect(notifications).toBe(3)

    const reset = store.resetOrientation()
    expect(reset).toEqual({
      colourway: 'white',
      pose: 'front',
      orientation: FRONT_DEVICE_ORIENTATION,
      room: 'light',
    })
    expect(notifications).toBe(4)
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
    expect(firstCapture.releases).toEqual([])

    expect(controls.begin(grabStart(host, firstCapture, 'touch', 13, 0, 0))).toBe(
      true,
    )
    blurHost.dispatchEvent(new Event('blur'))
    expect(firstCapture.releases).toEqual([13])
    expect(controls.isActive()).toBe(false)

    expect(controls.begin(grabStart(host, firstCapture, 'mouse', 14, 0, 0))).toBe(
      true,
    )
    controls.dispose()
    expect(firstCapture.releases).toEqual([13, 14])
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
): Event {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
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
