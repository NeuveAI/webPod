import { expect, test } from 'bun:test'
import { deviceStore } from '@webpod/state'
import { animateStickerPackPresence, resetStickerPackPresence, stickerPackPresenceAtom } from './sticker-pack-presence'

test('pack remains in motion until settled, reverses without jumping, and cancels stale dismissal', () => {
  const request = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame, media = globalThis.matchMedia
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0, now = performance.now(), reduced = false
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id }
  globalThis.cancelAnimationFrame = handle => { frames.delete(handle) }
  globalThis.matchMedia = query => Object.assign(new EventTarget(), { matches: reduced, media: query, onchange: null, addListener: () => {}, removeListener: () => {} })
  const step = () => { now += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)) }
  const settle = () => { for (let n = 0; n < 150 && frames.size; n++) step(); expect(frames.size).toBe(0) }
  try {
    resetStickerPackPresence()
    animateStickerPackPresence(1, () => {})
    step()
    expect(deviceStore.get(stickerPackPresenceAtom)).toBeGreaterThan(0)
    expect(deviceStore.get(stickerPackPresenceAtom)).toBeLessThan(1)
    settle()
    let dismissed = false
    animateStickerPackPresence(0, () => { dismissed = true })
    step()
    const position = deviceStore.get(stickerPackPresenceAtom)
    animateStickerPackPresence(1, () => {})
    expect(deviceStore.get(stickerPackPresenceAtom)).toBe(position)
    settle()
    expect(dismissed).toBe(false)
    expect(deviceStore.get(stickerPackPresenceAtom)).toBe(1)
    reduced = true
    animateStickerPackPresence(0, () => { dismissed = true })
    expect(dismissed).toBe(true)
    expect(deviceStore.get(stickerPackPresenceAtom)).toBe(0)
    expect(frames.size).toBe(0)
  } finally {
    resetStickerPackPresence()
    globalThis.requestAnimationFrame = request; globalThis.cancelAnimationFrame = cancel; globalThis.matchMedia = media
  }
})
