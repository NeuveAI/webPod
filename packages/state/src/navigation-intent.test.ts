import { describe, expect, test } from 'bun:test'

import { currentScreenAtom, navigationIntentAtom } from './contract'
import { pressActionAtom, returnToRootActionAtom } from './store'
import { createDeviceStore } from './testing'

describe('navigation intent bridge', () => {
  test('center publishes an exact-once selectable intent outside React', () => {
    const store = createDeviceStore()
    expect(store.get(navigationIntentAtom)).toBeNull()
    store.set(pressActionAtom, { button: 'center', source: 'human' })
    expect(store.get(navigationIntentAtom)).toEqual({ kind: 'select', seq: 1 })
    store.set(pressActionAtom, { button: 'center', source: 'human' })
    expect(store.get(navigationIntentAtom)).toEqual({ kind: 'select', seq: 2 })
  })

  test('long-Menu root reset is one atomic external-store action', () => {
    const store = createDeviceStore()
    store.set(returnToRootActionAtom)
    expect(store.get(navigationIntentAtom)).toEqual({ kind: 'root', seq: 1 })
    expect(store.get(currentScreenAtom)?.screenId).toBe('S03')
  })
})
