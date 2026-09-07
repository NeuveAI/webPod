import { expect, test } from 'bun:test'
import { beginDeviceOrientationRelease, advanceDeviceOrientationRelease, estimatePointerReleaseVelocity, pointerVelocityToDeviceVelocity } from './device-orientation-motion'

const pose = (yawDeg: number) => ({ pitchDeg: 0, yawDeg, rollDeg: 0 })
const velocity = (yawDegPerSecond: number) => ({ pitchDegPerSecond: 0, yawDegPerSecond, rollDegPerSecond: 0 })
function rest(current: number, speed: number, reduced = false) {
  let release = beginDeviceOrientationRelease(pose(current), velocity(speed), reduced)
  for (let frame = 0; frame < 300 && release.motion !== null; frame++) release = advanceDeviceOrientationRelease(release.motion, 1 / 60)
  return release
}

test('slow held drag preserves the selected angle', () => {
  expect(rest(100, 0).orientation.yawDeg).toBe(100)
  expect(rest(70, 0).orientation.yawDeg).toBe(70)
  expect(rest(260, 0).orientation.yawDeg).toBe(260)
})
test('passing the rear before releasing does not add a full revolution', () => {
  expect(rest(190, 900).orientation.yawDeg).toBe(310)
  expect(rest(-190, -900).orientation.yawDeg).toBe(-310)
})
test('a short deliberate flick works below the former binary speed cliff', () => {
  expect(rest(20, 300).orientation.yawDeg).toBe(60)
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
  expect(rest(100, 0, true)).toEqual({ orientation: pose(100), motion: null })
})

test('tiny reversal cannot borrow the preceding drag distance to flip', () => {
  for (const lastX of [99, 98, 97, 96, 80, 60]) {
    const measured = estimatePointerReleaseVelocity([
      { clientX: 0, clientY: 0, timestampMs: 0 },
      { clientX: 100, clientY: 0, timestampMs: 40 },
      { clientX: lastX, clientY: 0, timestampMs: lastX > 80 ? 41 : 60 },
    ], lastX > 80 ? 41 : 60)
    let release = beginDeviceOrientationRelease(pose(lastX * 0.42), pointerVelocityToDeviceVelocity(measured, false), false)
    for (let n = 0; n < 300 && release.motion !== null; n++) release = advanceDeviceOrientationRelease(release.motion, 1 / 60)
    expect(release.orientation.yawDeg).toBeCloseTo(lastX * 0.42 + measured.xPxPerSecond * 0.42 / 7.5, 8)
  }
})
