import { describe, expect, test } from 'bun:test'

import {
  DETENT,
  IDLE_DETENT_ACCUMULATOR,
  detentAccumulatorAtom,
  interactionFeedbackAtom,
  type InteractionFeedbackEvent,
} from './contract'
import {
  coastActionAtom,
  detentActionAtom,
  pressActionAtom,
} from './store'
import { createDeviceStore } from './testing'

describe('authoritative interaction feedback stream', () => {
  test('the public event shape cannot represent agent-owned audible feedback', () => {
    const malformed: InteractionFeedbackEvent = {
      seq: 1,
      control: 'wheel',
      origin: 'detent',
      clickerTicks: 1,
      silenced: false,
      // @ts-expect-error Only human actors can inhabit an eligible feedback event.
      actor: 'agent:review-plant',
    }
    void malformed
  })

  test('one eligible human press publishes exactly one click budget', () => {
    const store = createDeviceStore()
    const seen: InteractionFeedbackEvent[] = []
    const unsubscribe = store.sub(interactionFeedbackAtom, () => {
      const event = store.get(interactionFeedbackAtom)
      if (event !== null) seen.push(event)
    })

    const outcome = store.set(pressActionAtom, { button: 'center', source: 'human' })
    unsubscribe()

    expect(outcome.clickerTicks).toBe(1)
    expect(seen).toEqual([{
      seq: 1,
      control: 'press',
      origin: 'press',
      button: 'center',
      clickerTicks: 1,
      silenced: false,
      actor: 'human:touch',
    }])
  })

  test('N authoritative human detents publish one event carrying N ticks', () => {
    const store = createDeviceStore()
    const outcome = store.set(detentActionAtom, {
      path: 'direct',
      source: 'human',
      detents: 5,
      timestampMs: 1,
    })

    expect(outcome.clickerTicks).toBe(5)
    expect(store.get(interactionFeedbackAtom)).toMatchObject({
      control: 'wheel',
      origin: 'detent',
      clickerTicks: 5,
      silenced: false,
    })
  })

  test('sub-detent travel and agent/system actions publish nothing', () => {
    const store = createDeviceStore()
    let notifications = 0
    const unsubscribe = store.sub(interactionFeedbackAtom, () => {
      notifications += 1
    })

    const subDetent = store.set(detentActionAtom, {
      path: 'touch-arc',
      source: 'human',
      angleDeg: 0.5,
      timestampMs: 1,
    })
    const agent = store.set(detentActionAtom, {
      path: 'direct',
      source: 'agent',
      detents: 9,
      timestampMs: 2,
    })
    const system = store.set(pressActionAtom, { button: 'menu', source: 'system' })
    unsubscribe()

    expect(subDetent.clickerTicks).toBe(0)
    expect(agent.silenced).toBeTrue()
    expect(agent.clickerTicks).toBe(0)
    expect(system.silenced).toBeTrue()
    expect(system.clickerTicks).toBe(0)
    expect(notifications).toBe(0)
    expect(store.get(interactionFeedbackAtom)).toBeNull()
  })

  test('coasted detents publish only the budget returned by the coast action', () => {
    const store = createDeviceStore()
    store.set(detentAccumulatorAtom, {
      ...IDLE_DETENT_ACCUMULATOR,
      path: 'touch-arc',
      source: 'human',
      direction: 1,
      speedDegPerSec: DETENT.maxAngularSpeedDegPerSec,
      armed: true,
      coasting: true,
    })

    const outcome = store.set(coastActionAtom, 1 / DETENT.coastReferenceFps)
    const event = store.get(interactionFeedbackAtom)

    expect(outcome.clickerTicks).toBeGreaterThan(0)
    expect(event).toMatchObject({
      control: 'wheel',
      origin: 'coast',
      clickerTicks: outcome.clickerTicks,
      silenced: false,
    })
  })

  test('identical consecutive budgets remain distinct by sequence', () => {
    const store = createDeviceStore()
    store.set(pressActionAtom, { button: 'center', source: 'human' })
    const first = store.get(interactionFeedbackAtom)
    store.set(pressActionAtom, { button: 'center', source: 'human' })
    const second = store.get(interactionFeedbackAtom)

    expect(first?.seq).toBe(1)
    expect(second?.seq).toBe(2)
  })
})
