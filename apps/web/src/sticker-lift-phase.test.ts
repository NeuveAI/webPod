import { expect, test } from 'bun:test'
import { stickerLiftAnimation, stickerLiftPhase, stickerLiftProgress } from './sticker-lift-phase'
import { stickerPeelMotion } from './sticker-collections-model'

test('physical lift is continuous at both subphase boundaries with nonzero transport displacement', () => {
  for (const boundary of [.8, 1]) {
    const before = stickerLiftPhase(boundary - 1e-7), after = stickerLiftPhase(boundary + 1e-7)
    expect(Math.abs(after.sourcePeelFront - before.sourcePeelFront)).toBeLessThan(2e-6)
    // Last row transport under a large offset cannot jump at full peel.
    expect(Math.abs(after.detachTransport * 120 - before.detachTransport * 120)).toBeLessThan(.001)
  }
  for (const q of [.1, .79999, .8, .9, 1]) {
    const p = stickerLiftPhase(q)
    if (p.detachTransport > 0) expect(p.sourcePeelFront).toBe(1)
    expect(stickerLiftProgress({ peel: .4, ...p })).toBeCloseTo(q)
  }
  for (const distance of [63.9999, 64, 64.0001, 164]) {
    const p = stickerPeelMotion(distance, 0, false)
    expect(p.sourcePeelFront).toBe(1)
    expect(p.detachTransport).toBeGreaterThan(.9999)
  }
})

test('retarget and return reverse transport before physical contact, independently of free curl', () => {
  const free = { peel: .4, sourcePeelFront: 1, detachTransport: 1 }
  const start = stickerLiftProgress(free)
  const transport = stickerLiftAnimation(start, .4, 0, .36)
  expect(transport.sourcePeelFront).toBe(1); expect(transport.detachTransport).toBeCloseTo(.5)
  const contact = stickerLiftAnimation(start, .4, 0, .2)
  expect(contact.detachTransport).toBe(0); expect(contact.sourcePeelFront).toBeCloseTo(.625)
  for (const phase of [.3, .9]) {
    const state = stickerLiftPhase(phase), current = stickerLiftProgress({ peel: phase, ...state })
    expect(stickerLiftAnimation(current, phase, 0, phase)).toEqual(state)
    expect(stickerLiftAnimation(current, phase, 1, phase)).toEqual(state)
  }
  expect(stickerLiftAnimation(1, 0, 0, 0)).toEqual({ sourcePeelFront: 0, detachTransport: 0 })
  expect(stickerPeelMotion(12, 0, true)).toMatchObject({ peel: 0, sourcePeelFront: 1, detachTransport: 1 })
})
