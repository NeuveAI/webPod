import { expect, test } from 'bun:test'
import { createStickerProjectionNotifications } from './sticker-projection-notifications'

test('cross-root layout notifications coalesce, yield, and release their frame on teardown', () => {
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0, published = 0
  const notifications = createStickerProjectionNotifications(() => { published++ }, callback => {
    frames.set(++next, callback)
    return next
  }, frame => { frames.delete(frame) })
  const flush = () => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(0)
  }
  for (let i = 0; i < 100; i++) notifications.notify()
  expect(published).toBe(0)
  expect(frames.size).toBe(1)
  flush()
  expect(published).toBe(1)
  expect(frames.size).toBe(0)
  notifications.notify()
  notifications.cancel()
  flush()
  expect(published).toBe(1)
  notifications.notify()
  flush()
  expect(published).toBe(2)
})
