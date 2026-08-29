import { describe, expect, test } from 'bun:test'

import {
  attachCompositeWheelListener,
  normalizeWheelDeltaMode,
  type WheelInput,
  type WheelListenerRoot,
} from './click-wheel-runtime'

describe('composite browser wheel boundary', () => {
  test('uses one non-passive capture listener and removes that listener', () => {
    const root = new FakeWheelRoot()
    const writes: WheelInput[] = []
    const detach = attachCompositeWheelListener(root, { wheel: (input) => writes.push(input) })
    expect(root.addOptions).toEqual({ capture: true, passive: false })

    const event = makeWheelEvent({ deltaY: 42, deltaMode: 1, timeStamp: 73 })
    root.dispatch(event)
    expect(event.prevented).toBe(true)
    expect(event.stopped).toBe(true)
    expect(writes).toEqual([{ deltaY: 42, deltaMode: 1, timestampMs: 73 }])

    detach()
    expect(root.removeOptions).toEqual({ capture: true })
    root.dispatch(makeWheelEvent({ deltaY: 12, deltaMode: 0, timeStamp: 90 }))
    expect(writes).toHaveLength(1)
  })

  test('normalizes unknown modes to pixels without changing line or page', () => {
    expect(normalizeWheelDeltaMode(0)).toBe(0)
    expect(normalizeWheelDeltaMode(1)).toBe(1)
    expect(normalizeWheelDeltaMode(2)).toBe(2)
    expect(normalizeWheelDeltaMode(99)).toBe(0)
  })
})

type FakeWheelEvent = WheelEvent & {
  prevented: boolean
  stopped: boolean
}

class FakeWheelRoot implements WheelListenerRoot {
  listener: ((event: WheelEvent) => void) | null = null
  addOptions: AddEventListenerOptions | null = null
  removeOptions: EventListenerOptions | null = null

  addEventListener(
    _type: 'wheel',
    listener: (event: WheelEvent) => void,
    options: AddEventListenerOptions,
  ): void {
    this.listener = listener
    this.addOptions = options
  }

  removeEventListener(
    _type: 'wheel',
    listener: (event: WheelEvent) => void,
    options: EventListenerOptions,
  ): void {
    if (this.listener === listener) this.listener = null
    this.removeOptions = options
  }

  dispatch(event: WheelEvent): void {
    this.listener?.(event)
  }
}

function makeWheelEvent(values: {
  readonly deltaY: number
  readonly deltaMode: number
  readonly timeStamp: number
}): FakeWheelEvent {
  return {
    ...values,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
  } as FakeWheelEvent
}
