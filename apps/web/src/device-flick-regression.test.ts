import { expect, test } from 'bun:test'
import { beginDeviceOrientationRelease, advanceDeviceOrientationRelease, estimatePointerReleaseVelocity, pointerVelocityToDeviceVelocity, DEVICE_ORIENTATION_DRAG_GAIN } from './device-orientation-motion'

const pose = (yawDeg: number) => ({ pitchDeg: 0, yawDeg, rollDeg: 0 })
const velocity = (yawDegPerSecond: number) => ({ pitchDegPerSecond: 0, yawDegPerSecond, rollDegPerSecond: 0 })
function rest(start: number, current: number, speed: number, reduced = false) {
  let release = beginDeviceOrientationRelease(pose(start), pose(current), velocity(speed), reduced)
  for (let frame = 0; frame < 300 && release.motion !== null; frame++) release = advanceDeviceOrientationRelease(release.motion, 1 / 60)
  return release
}

test('slow held drag settles a useful face instead of remaining edge-on', () => {
  expect(rest(0, 100, 0).orientation.yawDeg).toBe(180)
  expect(rest(0, 70, 0).orientation.yawDeg).toBe(0)
  expect(rest(180, 260, 0).orientation.yawDeg).toBe(180)
})
test('passing the rear before releasing does not add a full revolution', () => {
  expect(rest(0, 190, 900).orientation.yawDeg).toBe(180)
  expect(rest(0, -190, -900).orientation.yawDeg).toBe(-180)
})
test('a short deliberate flick works below the former binary speed cliff', () => {
  expect(rest(0, 20, 300).orientation.yawDeg).toBe(180)
})
test('release direction follows a fresh reversal rather than the earlier drag', () => {
  const measured = estimatePointerReleaseVelocity([
    { clientX: 0, clientY: 0, timestampMs: 0 },
    { clientX: 60, clientY: 0, timestampMs: 20 },
    { clientX: 120, clientY: 0, timestampMs: 40 },
    { clientX: 110, clientY: 0, timestampMs: 60 },
  ], 60)
  expect(measured.xPxPerSecond).toBeLessThan(0)
})
test('reduced motion settles the held drag immediately without frames', () => {
  expect(rest(0, 100, 0, true)).toEqual({ orientation: pose(180), motion: null })
})

test('tiny reversal cannot borrow the preceding drag distance to flip', () => {
  for (const lastX of [99, 98, 97, 96, 80, 60]) {
    const measured = estimatePointerReleaseVelocity([
      { clientX: 0, clientY: 0, timestampMs: 0 },
      { clientX: 100, clientY: 0, timestampMs: 40 },
      { clientX: lastX, clientY: 0, timestampMs: lastX > 80 ? 41 : 60 },
    ], lastX > 80 ? 41 : 60)
    let release = beginDeviceOrientationRelease(pose(0), pose(lastX * 0.42), pointerVelocityToDeviceVelocity(measured, false), false, measured.xImpulseTravelPx * DEVICE_ORIENTATION_DRAG_GAIN.yawDegPerPixel)
    for (let n = 0; n < 300 && release.motion !== null; n++) release = advanceDeviceOrientationRelease(release.motion, 1 / 60)
    expect(release.orientation.yawDeg).toBe(lastX > 80 ? 0 : -180)
  }
})
