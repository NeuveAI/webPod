import { describe, expect, test } from 'bun:test'

import { createDelayedRowActivation, VISIBLE_ROW_SELECTION_DELAY_MS } from './visible-row-selection'

function timerHarness() {
  const callbacks = new Map<number, () => void>()
  let nextHandle = 0
  return {
    callbacks,
    setTimer(callback: () => void, delayMs: number) {
      expect(delayMs).toBe(VISIBLE_ROW_SELECTION_DELAY_MS)
      nextHandle += 1
      callbacks.set(nextHandle, callback)
      return nextHandle
    },
    clearTimer(handle: number | ReturnType<typeof setTimeout>) {
      if (typeof handle === 'number') callbacks.delete(handle)
    },
  }
}

describe('visible row selection', () => {
  test('waits eighty milliseconds and accepts one activation', () => {
    const timers = timerHarness()
    const driver = createDelayedRowActivation(timers)
    let activations = 0

    expect(driver.schedule(() => { activations += 1 })).toBe(true)
    expect(driver.schedule(() => { activations += 1 })).toBe(false)
    expect(activations).toBe(0)
    expect(timers.callbacks.size).toBe(1)

    const callback = [...timers.callbacks.values()][0]
    if (callback === undefined) throw new Error('The delayed activation was not armed')
    callback()
    expect(activations).toBe(1)
    expect(driver.schedule(() => { activations += 1 })).toBe(true)
  })

  test('keyboard, wheel, and unmount cancellation leave no activation', () => {
    const timers = timerHarness()
    const driver = createDelayedRowActivation(timers)
    let activations = 0

    driver.schedule(() => { activations += 1 })
    driver.cancel()
    expect(timers.callbacks.size).toBe(0)

    driver.schedule(() => { activations += 1 })
    driver.dispose()
    expect(timers.callbacks.size).toBe(0)
    expect(activations).toBe(0)
  })
})
