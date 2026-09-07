import { describe, expect, test } from 'bun:test'

import {
  ORIENTATION_COAST_DECAY_PER_SECOND,
  advanceDeviceOrientationRelease,
  beginDeviceOrientationRelease,
  estimatePointerReleaseVelocity,
  type DeviceOrientationRelease,
  type DeviceOrientationVelocity,
} from './device-orientation-motion'

const ZERO_VELOCITY: DeviceOrientationVelocity = {
  pitchDegPerSecond: 0,
  yawDegPerSecond: 0,
  rollDegPerSecond: 0,
}

describe('device release motion', () => {
  test('weights recent timestamped samples and rejects stale, zero-time and outlier input', () => {
    const measured = estimatePointerReleaseVelocity(
      [
        { clientX: 0, clientY: 0, timestampMs: 0 },
        { clientX: 10, clientY: 5, timestampMs: 20 },
        { clientX: 30, clientY: 15, timestampMs: 40 },
        { clientX: 10_000, clientY: 10_000, timestampMs: 40 },
        { clientX: 50, clientY: 25, timestampMs: 60 },
      ],
      60,
    )
    expect(measured.xPxPerSecond).toBeCloseTo(880.952381, 5)
    expect(measured.yPxPerSecond).toBeCloseTo(440.47619, 5)
    expect(
      estimatePointerReleaseVelocity(
        [
          { clientX: 0, clientY: 0, timestampMs: 0 },
          { clientX: 30, clientY: 0, timestampMs: 20 },
        ],
        200,
      ),
    ).toEqual({ xImpulseTravelPx: 0, xPxPerSecond: 0, yPxPerSecond: 0 })
    expect(
      estimatePointerReleaseVelocity(
        [
          { clientX: 0, clientY: 0, timestampMs: 0 },
          { clientX: 10_000, clientY: 0, timestampMs: 20 },
        ],
        20,
      ),
    ).toEqual({ xImpulseTravelPx: 0, xPxPerSecond: 0, yPxPerSecond: 0 })
  })


  test('a stationary or reduced-motion release retains any chosen angle', () => {
    for (const yawDeg of [-179, -90, -12, 34, 90, 179, 405]) {
      const pose = { pitchDeg: 12, yawDeg, rollDeg: -7 }
      expect(beginDeviceOrientationRelease(pose, ZERO_VELOCITY, false)).toEqual({ orientation: pose, motion: null })
      expect(beginDeviceOrientationRelease(pose, { ...ZERO_VELOCITY, yawDegPerSecond: 900 }, true)).toEqual({ orientation: pose, motion: null })
    }
  })

  test('coast distance scales continuously with speed in either direction', () => {
    for (const speed of [-2100, -900, -280, -160, 160, 279, 280, 900, 2100]) {
      const pose = { pitchDeg: 0, yawDeg: 38, rollDeg: 0 }
      let release = beginDeviceOrientationRelease(pose, { ...ZERO_VELOCITY, yawDegPerSecond: speed }, false)
      let previous = pose.yawDeg
      for (let frame = 0; frame < 2000 && release.motion !== null; frame++) {
        release = advanceDeviceOrientationRelease(release.motion, 1 / 120)
        expect((release.orientation.yawDeg - previous) * Math.sign(speed)).toBeGreaterThanOrEqual(0)
        previous = release.orientation.yawDeg
      }
      expect(release.motion).toBeNull()
      expect(release.orientation.yawDeg).toBeCloseTo(38 + speed / ORIENTATION_COAST_DECAY_PER_SECOND, 9)
    }
  })

  test('diagonal coasting has the same destination at different frame rates', () => {
    const pose = { pitchDeg: 7, yawDeg: 170, rollDeg: -3 }
    const velocity = { pitchDegPerSecond: 60, yawDegPerSecond: 900, rollDegPerSecond: -25 }
    const initial = beginDeviceOrientationRelease(pose, velocity, false)
    for (const pattern of [[1 / 30], [1 / 60], [1 / 120], [0.011, 0.027, 0.019, 0.043]]) {
      const result = runPatternToRest(initial, pattern)
      expect(result.motion).toBeNull()
      expect(result.orientation.pitchDeg).toBeCloseTo(15, 9)
      expect(result.orientation.yawDeg).toBeCloseTo(290, 9)
      expect(result.orientation.rollDeg).toBeCloseTo(-3 - 25 / 7.5, 9)
    }
  })

  test('coasting respects pitch and roll limits without reversing yaw', () => {
    const result = runPatternToRest(beginDeviceOrientationRelease(
      { pitchDeg: 44, yawDeg: -170, rollDeg: -17 },
      { pitchDegPerSecond: 900, yawDegPerSecond: -900, rollDegPerSecond: -900 }, false,
    ), [1 / 60])
    expect(result.orientation).toEqual({ pitchDeg: 45, yawDeg: -290, rollDeg: -18 })
    expect(result.motion).toBeNull()
  })

  test('a late reversal follows the latest movement direction', () => {
    const velocity = estimatePointerReleaseVelocity([
      { clientX: 0, clientY: 0, timestampMs: 0 },
      { clientX: 60, clientY: 30, timestampMs: 20 },
      { clientX: 55, clientY: 25, timestampMs: 40 },
    ], 40)
    expect(velocity.xPxPerSecond).toBeLessThan(0)
    expect(velocity.yPxPerSecond).toBeLessThan(0)
  })
})

function runPatternToRest(
  initial: DeviceOrientationRelease,
  framePattern: readonly number[],
): DeviceOrientationRelease {
  let release = initial
  for (let frame = 0; frame < 2_000 && release.motion !== null; frame += 1) {
    const elapsed = framePattern[frame % framePattern.length]
    if (elapsed === undefined) throw new Error('frame pattern is empty')
    release = advanceDeviceOrientationRelease(release.motion, elapsed)
  }
  return release
}

describe('optional flick snap', () => {
  const pose = { pitchDeg: 12, yawDeg: 40, rollDeg: -6 }
  const gesture = { startYawDeg: 0, yawImpulseTravelDeg: 20 }

  test('speed and recent travel must both reach the threshold', () => {
    for (const [speed, travel, kind] of [[699, 20, 'coast'], [700, 13.9, 'coast'], [700, 14, 'flick-snap']] as const) {
      const release = beginDeviceOrientationRelease(pose, { ...ZERO_VELOCITY, yawDegPerSecond: speed }, false, { ...gesture, yawImpulseTravelDeg: travel })
      expect(release.motion?.kind).toBe(kind)
    }
  })

  test('both faces snap flat in either direction across frame rates', () => {
    for (const [start, current, speed, target] of [[0, 40, 900, 180], [0, -40, -900, -180], [180, 220, 900, 360], [180, 140, -900, 0]]) {
      if (start === undefined || current === undefined || speed === undefined || target === undefined) throw new Error('missing case')
      for (const pattern of [[1 / 30], [1 / 120], [0.01, 0.03, 0.02]]) {
        const release = beginDeviceOrientationRelease({ ...pose, yawDeg: current }, { pitchDegPerSecond: 40, yawDegPerSecond: speed, rollDegPerSecond: -15 }, false, { startYawDeg: start, yawImpulseTravelDeg: Math.sign(speed) * 20 })
        expect(release.motion?.kind).toBe('flick-snap')
        expect(runPatternToRest(release, pattern)).toEqual({ orientation: { pitchDeg: 0, yawDeg: target, rollDeg: 0 }, motion: null })
      }
    }
  })

  test('tiny corrections, diagonal gestures, and already-passed faces coast', () => {
    expect(beginDeviceOrientationRelease(pose, { ...ZERO_VELOCITY, yawDegPerSecond: -1200 }, false, { ...gesture, yawImpulseTravelDeg: -2 }).motion?.kind).toBe('coast')
    expect(beginDeviceOrientationRelease(pose, { pitchDegPerSecond: 800, yawDegPerSecond: 900, rollDegPerSecond: 0 }, false, gesture).motion?.kind).toBe('coast')
    expect(beginDeviceOrientationRelease({ ...pose, yawDeg: 190 }, { ...ZERO_VELOCITY, yawDegPerSecond: 900 }, false, gesture).motion?.kind).toBe('coast')
  })

  test('reduced motion applies only an intentional snap immediately', () => {
    expect(beginDeviceOrientationRelease(pose, { ...ZERO_VELOCITY, yawDegPerSecond: 900 }, true, gesture)).toEqual({ orientation: { pitchDeg: 0, yawDeg: 180, rollDeg: 0 }, motion: null })
    expect(beginDeviceOrientationRelease(pose, { ...ZERO_VELOCITY, yawDegPerSecond: 699 }, true, gesture)).toEqual({ orientation: pose, motion: null })
  })
})
