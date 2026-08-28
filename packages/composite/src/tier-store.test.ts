import { afterEach, describe, expect, test } from 'bun:test'

import {
  compositeTierAtom,
  compositeTierStore,
  markCompositeContextLost,
  resetCompositeTierForTest,
  subscribeCompositeTier,
} from './tier-store'

afterEach(resetCompositeTierForTest)

describe('authoritative composite tier atom', () => {
  test('publishes context loss through Jotai to external subscribers', () => {
    let notifications = 0
    const unsubscribe = subscribeCompositeTier(() => { notifications += 1 })
    markCompositeContextLost()
    const snapshot = compositeTierStore.get(compositeTierAtom)

    expect(typeof snapshot).not.toBe('symbol')
    if (typeof snapshot === 'symbol') throw new Error('tier stayed unresolved')
    expect(snapshot.tier).toBe('T4')
    expect(snapshot.contextLost).toBe(true)
    expect(notifications).toBe(1)
    unsubscribe()
  })
})
