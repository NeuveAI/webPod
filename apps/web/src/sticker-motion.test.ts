import { describe, expect, test } from 'bun:test'
import { advanceStickerSpring, resolveStickerPullRelease } from './sticker-motion'

describe('sticker pull physics', () => {
  test('a fresh upward flick opens; holding that gesture restores distance-based release', () => {
    const samples = [{ clientX: 0, clientY: 180, timestampMs: 0 }, { clientX: 0, clientY: 120, timestampMs: 50 }]
    expect(resolveStickerPullRelease(0.2, samples, 50, 240).target).toBe(1)
    expect(resolveStickerPullRelease(0.2, samples, 200, 240).target).toBe(0)
  })
  test('analytic response is invariant to frame subdivision before settling', () => {
    const spring = { position: 0.2, velocity: 1, target: 1 }
    const whole = advanceStickerSpring(spring, 0.04)
    const half = advanceStickerSpring(spring, 0.02)
    if (half === null || whole === null) throw new Error('Spring settled too early')
    const subdivided = advanceStickerSpring(half, 0.02)
    expect(subdivided?.position).toBeCloseTo(whole.position, 10)
    expect(subdivided?.velocity).toBeCloseTo(whole.velocity, 10)
  })
  test('settled springs stop scheduling and background pauses terminate safely', () => {
    expect(advanceStickerSpring({ position: 1, velocity: 0, target: 1 }, 0.016)).toBeNull()
    expect(advanceStickerSpring({ position: 0.2, velocity: 6, target: 1 }, 30)).toBeNull()
  })
})
