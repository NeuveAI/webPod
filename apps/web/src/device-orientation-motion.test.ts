import { describe, expect, test } from 'bun:test'

import {
  ORIENTATION_FLIP_MAX_OVERSHOOT_DEG,
  ORIENTATION_OPPOSITE_FACE_FLICK_DEG_PER_SECOND,
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
    ).toEqual({ xPxPerSecond: 0, yPxPerSecond: 0 })
    expect(
      estimatePointerReleaseVelocity(
        [
          { clientX: 0, clientY: 0, timestampMs: 0 },
          { clientX: 10_000, clientY: 0, timestampMs: 20 },
        ],
        20,
      ),
    ).toEqual({ xPxPerSecond: 0, yPxPerSecond: 0 })
  })

  test('ordinary coast is time-based at 30, 60, 120 and variable frame rates', () => {
    const velocity = {
      pitchDegPerSecond: 80,
      yawDegPerSecond: 360,
      rollDegPerSecond: -40,
    }
    const schedules = [
      Array.from({ length: 30 }, () => 1 / 30),
      Array.from({ length: 60 }, () => 1 / 60),
      Array.from({ length: 120 }, () => 1 / 120),
      [0.011, 0.027, 0.008, 0.044, 0.019, 0.031, 0.06, 0.08, 0.12, 0.2, 0.4],
    ]
    const results = schedules.map((frames) =>
      advanceFor(
        beginDeviceOrientationRelease(
          { pitchDeg: 0, yawDeg: 0, rollDeg: 0 },
          { pitchDeg: 0, yawDeg: 15, rollDeg: 0 },
          velocity,
          false,
        ),
        frames,
      ),
    )

    for (const result of results.slice(1)) {
      expect(result.orientation.pitchDeg).toBeCloseTo(
        results[0]?.orientation.pitchDeg ?? 0,
        9,
      )
      expect(result.orientation.yawDeg).toBeCloseTo(
        results[0]?.orientation.yawDeg ?? 0,
        9,
      )
      expect(result.orientation.rollDeg).toBeCloseTo(
        results[0]?.orientation.rollDeg ?? 0,
        9,
      )
    }
    expect(results[0]?.orientation.yawDeg).toBeGreaterThan(15)
  })

  test('ordinary release travel is proportional to measured release velocity', () => {
    const start = { pitchDeg: 0, yawDeg: 12, rollDeg: 0 }
    const slow = beginDeviceOrientationRelease(
      start,
      start,
      { ...ZERO_VELOCITY, yawDegPerSecond: 160 },
      false,
    )
    const fast = beginDeviceOrientationRelease(
      start,
      start,
      { ...ZERO_VELOCITY, yawDegPerSecond: 320 },
      false,
    )
    if (slow.motion === null || fast.motion === null) {
      throw new Error('ordinary release unexpectedly settled before its first frame')
    }
    const slowFrame = advanceDeviceOrientationRelease(slow.motion, 0.032)
    const fastFrame = advanceDeviceOrientationRelease(fast.motion, 0.032)
    const slowTravel = slowFrame.orientation.yawDeg - start.yawDeg
    const fastTravel = fastFrame.orientation.yawDeg - start.yawDeg

    expect(slowTravel).toBeGreaterThan(0)
    expect(fastTravel).toBeCloseTo(slowTravel * 2, 10)
  })

  for (const testCase of [
    { name: 'front to rear clockwise', start: 0, current: 40, velocity: 900, target: 180 },
    { name: 'front to rear counter-clockwise', start: 0, current: -40, velocity: -900, target: -180 },
    { name: 'rear to front clockwise', start: 180, current: 220, velocity: 900, target: 360 },
    { name: 'rear to front counter-clockwise', start: 180, current: 140, velocity: -900, target: 0 },
  ] as const) {
    test(`a semantic flick settles exactly ${testCase.name}`, () => {
      const started = beginDeviceOrientationRelease(
        { pitchDeg: 8, yawDeg: testCase.start, rollDeg: 3 },
        { pitchDeg: 8, yawDeg: testCase.current, rollDeg: 3 },
        { ...ZERO_VELOCITY, yawDegPerSecond: testCase.velocity },
        false,
      )
      expect(started.motion?.kind).toBe('opposite-face')
      expect(started.motion?.targetYawDeg).toBe(testCase.target)

      const result = runToRest(started, 1 / 120)
      expect(result.motion).toBeNull()
      expect(result.orientation.yawDeg).toBe(testCase.target)
    })
  }

  test('opposite-face settling ends identically at 30, 60, 120 and variable rates', () => {
    const initial = beginDeviceOrientationRelease(
      { pitchDeg: 7, yawDeg: 0, rollDeg: -3 },
      { pitchDeg: 7, yawDeg: 38, rollDeg: -3 },
      {
        pitchDegPerSecond: 60,
        yawDegPerSecond: 900,
        rollDegPerSecond: -25,
      },
      false,
    )
    const patterns = [[1 / 30], [1 / 60], [1 / 120], [0.011, 0.027, 0.019, 0.043]]
    const results = patterns.map((pattern) => runPatternToRest(initial, pattern))

    for (const result of results) {
      expect(result.motion).toBeNull()
      expect(result.orientation.yawDeg).toBe(180)
    }
    for (const result of results.slice(1)) {
      expect(result.orientation.pitchDeg).toBeCloseTo(
        results[0]?.orientation.pitchDeg ?? 0,
        9,
      )
      expect(result.orientation.rollDeg).toBeCloseTo(
        results[0]?.orientation.rollDeg ?? 0,
        9,
      )
    }
  })

  test('the flick threshold and edge-hemisphere tie are deterministic', () => {
    expect(ORIENTATION_OPPOSITE_FACE_FLICK_DEG_PER_SECOND).toBe(340)
    const below = beginDeviceOrientationRelease(
      { pitchDeg: 0, yawDeg: 90, rollDeg: 0 },
      { pitchDeg: 0, yawDeg: 100, rollDeg: 0 },
      {
        ...ZERO_VELOCITY,
        yawDegPerSecond: ORIENTATION_OPPOSITE_FACE_FLICK_DEG_PER_SECOND - 1,
      },
      false,
    )
    const at = beginDeviceOrientationRelease(
      { pitchDeg: 0, yawDeg: 90, rollDeg: 0 },
      { pitchDeg: 0, yawDeg: 100, rollDeg: 0 },
      {
        ...ZERO_VELOCITY,
        yawDegPerSecond: ORIENTATION_OPPOSITE_FACE_FLICK_DEG_PER_SECOND,
      },
      false,
    )

    expect(below.motion?.kind).toBe('coast')
    expect(at.motion?.kind).toBe('opposite-face')
    expect(at.motion?.targetYawDeg).toBe(180)
  })

  test('reduced motion resolves a semantic flick immediately and never coasts', () => {
    const semantic = beginDeviceOrientationRelease(
      { pitchDeg: 10, yawDeg: 0, rollDeg: 2 },
      { pitchDeg: 10, yawDeg: 30, rollDeg: 2 },
      { ...ZERO_VELOCITY, yawDegPerSecond: 900 },
      true,
    )
    const ordinary = beginDeviceOrientationRelease(
      { pitchDeg: 10, yawDeg: 0, rollDeg: 2 },
      { pitchDeg: 10, yawDeg: 30, rollDeg: 2 },
      { ...ZERO_VELOCITY, yawDegPerSecond: 300 },
      true,
    )

    expect(semantic).toEqual({
      orientation: { pitchDeg: 10, yawDeg: 180, rollDeg: 2 },
      motion: null,
    })
    expect(ordinary).toEqual({
      orientation: { pitchDeg: 10, yawDeg: 30, rollDeg: 2 },
      motion: null,
    })
  })

  test('the semantic spring never exceeds its authored overshoot', () => {
    let release = beginDeviceOrientationRelease(
      { pitchDeg: 0, yawDeg: 0, rollDeg: 0 },
      { pitchDeg: 0, yawDeg: 20, rollDeg: 0 },
      { ...ZERO_VELOCITY, yawDegPerSecond: 2_100 },
      false,
    )
    let maximum = Number.NEGATIVE_INFINITY
    for (let frame = 0; frame < 600 && release.motion !== null; frame += 1) {
      release = advanceDeviceOrientationRelease(release.motion, 1 / 240)
      maximum = Math.max(maximum, release.orientation.yawDeg)
    }
    expect(maximum).toBeLessThanOrEqual(
      180 + ORIENTATION_FLIP_MAX_OVERSHOOT_DEG,
    )
    expect(release.orientation.yawDeg).toBe(180)
  })
})

function advanceFor(
  initial: DeviceOrientationRelease,
  frames: readonly number[],
): DeviceOrientationRelease {
  let release = initial
  for (const elapsed of frames) {
    if (release.motion === null) break
    release = advanceDeviceOrientationRelease(release.motion, elapsed)
  }
  return release
}

function runToRest(
  initial: DeviceOrientationRelease,
  frameSeconds: number,
): DeviceOrientationRelease {
  let release = initial
  for (let frame = 0; frame < 2_000 && release.motion !== null; frame += 1) {
    release = advanceDeviceOrientationRelease(release.motion, frameSeconds)
  }
  return release
}

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
