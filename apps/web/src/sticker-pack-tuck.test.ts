import { expect, test } from 'bun:test'
import { deviceStore } from '@webpod/state'
import { resetStickerPackTuck, setStickerPackTucked, stickerPackTuckAtom, stickerPackTuckedAtom } from './sticker-pack-tuck'

test('auto-close is continuous, reverses without snapping, and honors reduced motion', () => {
  const request = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame, media = globalThis.matchMedia
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0, now = performance.now(), reduced = false
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id }
  globalThis.cancelAnimationFrame = handle => { frames.delete(handle) }
  globalThis.matchMedia = query => Object.assign(new EventTarget(), { matches: reduced, media: query, onchange: null, addListener() {}, removeListener() {} })
  const step = () => { now += 16; const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn(now)) }
  try {
    resetStickerPackTuck(); setStickerPackTucked(true)
    expect(deviceStore.get(stickerPackTuckAtom)).toBe(0)
    step()
    expect(deviceStore.get(stickerPackTuckAtom)).toBeGreaterThan(0)
    expect(deviceStore.get(stickerPackTuckAtom)).toBeLessThan(1)
    const current = deviceStore.get(stickerPackTuckAtom)
    setStickerPackTucked(false)
    expect(deviceStore.get(stickerPackTuckAtom)).toBe(current)
    for (let i = 0; i < 150 && frames.size; i++) step()
    expect(deviceStore.get(stickerPackTuckAtom)).toBe(0)
    expect(frames.size).toBe(0)
    reduced = true; setStickerPackTucked(true)
    expect(deviceStore.get(stickerPackTuckAtom)).toBe(1)
    expect(deviceStore.get(stickerPackTuckedAtom)).toBe(true)
    expect(frames.size).toBe(0)
  } finally { resetStickerPackTuck(); globalThis.requestAnimationFrame = request; globalThis.cancelAnimationFrame = cancel; globalThis.matchMedia = media }
})
