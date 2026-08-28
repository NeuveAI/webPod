/**
 * The store, exercised with **no React tree mounted**.
 *
 * ⚑ This file is the evidence for the property the whole state architecture
 * rests on. Nothing here imports React, renders a component, or wraps anything
 * in a provider. Every read is `store.get`, every write is `store.set`, and
 * every subscription is `store.sub` — exactly the surface a tool callback has,
 * because a tool callback runs outside the React tree and gets nothing else.
 *
 * If this file ever needs a component to pass, the architecture has quietly
 * become one where tools cannot reach the device, and the product's premise
 * goes with it.
 */

import { describe, expect, test } from 'bun:test'

import {
  VISIBLE_ROWS,
  agentActiveAtom,
  agentThrottledAtom,
  appModeAtom,
  bumpAtom,
  connectionAtom,
  currentScreenAtom,
  densityAtom,
  deviceStateAtom,
  faceAtom,
  highlightIndexAtom,
  holdEngagedAtom,
  screenSnapshotAtom,
  screenStackAtom,
  visibleRowsAtom,
} from './contract'
import type { PanelRow, ScreenFrame } from './contract'
import { MENU_ROOT, menuFrame } from './menu'
import {
  createDeviceStore,
  moveHighlightActionAtom,
  popScreenActionAtom,
  pressActionAtom,
  pushScreenActionAtom,
} from './store'

function trackFrame(count: number): ScreenFrame {
  const rows: readonly PanelRow[] = Array.from({ length: count }, (_, index) => ({
    index,
    label: `Track ${String(index + 1)}`,
    sublabel: 'An Artist',
    glyphs: [],
    provenance: null,
  }))
  return {
    screenId: 'S08',
    title: 'An Album',
    density: 'compact',
    rows,
    highlightIndex: 0,
    windowStart: 0,
  }
}

describe('read, write and subscribe with no React mounted', () => {
  test('React is not reachable from this package at all', () => {
    // The structural form of the claim, checked rather than asserted: the
    // package declares no React dependency and the isolated linker gives it no
    // path to one, so nothing in this file *could* have mounted a tree.
    expect(() => Bun.resolveSync('react', import.meta.dir)).toThrow()
    expect(() => Bun.resolveSync('react-dom', import.meta.dir)).toThrow()
  })

  test('store.get reads device state', () => {
    const store = createDeviceStore()

    expect(store.get(deviceStateAtom)).toBe('USER_ACTIVE')
    expect(store.get(faceAtom)).toBe('front')
    expect(store.get(currentScreenAtom)?.screenId).toBe('S03')
  })

  test('store.set writes device state and store.get reads it back', () => {
    const store = createDeviceStore()

    store.set(densityAtom, 'airy')
    expect(store.get(densityAtom)).toBe('airy')

    store.set(faceAtom, 'back')
    expect(store.get(faceAtom)).toBe('back')

    store.set(appModeAtom, 'REVIEW_PENDING')
    expect(store.get(appModeAtom)).toBe('REVIEW_PENDING')
  })

  test('store.sub notifies an outside-React listener on change', () => {
    const store = createDeviceStore()
    const seen: number[] = []

    const unsubscribe = store.sub(highlightIndexAtom, () => {
      seen.push(store.get(highlightIndexAtom))
    })

    store.set(pushScreenActionAtom, trackFrame(20))
    store.set(moveHighlightActionAtom, 3, 0)
    store.set(moveHighlightActionAtom, 2, 10)

    unsubscribe()
    store.set(moveHighlightActionAtom, 1, 20)

    expect(seen).toEqual([3, 5])
    // The unsubscribed movement still happened; it was simply not observed.
    expect(store.get(highlightIndexAtom)).toBe(6)
  })

  test('a derived atom is subscribable from outside React too', () => {
    const store = createDeviceStore()
    const states: string[] = []
    const unsubscribe = store.sub(deviceStateAtom, () => {
      states.push(store.get(deviceStateAtom))
    })

    store.set(agentActiveAtom, true)
    store.set(holdEngagedAtom, true)
    store.set(holdEngagedAtom, false)
    store.set(agentActiveAtom, false)
    unsubscribe()

    expect(states).toEqual(['AGENT_ACTIVE', 'HOLD_ENGAGED', 'AGENT_ACTIVE', 'USER_ACTIVE'])
  })

  test('two stores are genuinely separate devices', () => {
    const a = createDeviceStore()
    const b = createDeviceStore()

    a.set(densityAtom, 'airy')
    expect(a.get(densityAtom)).toBe('airy')
    expect(b.get(densityAtom)).toBe('medium')
  })
})

describe('the five device states, derived rather than assigned', () => {
  test('Hold outranks everything', () => {
    const store = createDeviceStore()
    store.set(agentActiveAtom, true)
    store.set(agentThrottledAtom, true)
    store.set(connectionAtom, 'disconnected')
    store.set(holdEngagedAtom, true)

    expect(store.get(deviceStateAtom)).toBe('HOLD_ENGAGED')
  })

  test('disconnection outranks the agent states', () => {
    const store = createDeviceStore()
    store.set(agentActiveAtom, true)
    store.set(connectionAtom, 'disconnected')

    expect(store.get(deviceStateAtom)).toBe('DISCONNECTED')
  })

  test('throttling is a sub-mode of agent activity, and reads as its own state', () => {
    const store = createDeviceStore()
    store.set(agentActiveAtom, true)
    store.set(agentThrottledAtom, true)

    expect(store.get(deviceStateAtom)).toBe('AGENT_THROTTLED')
  })

  test('the app mode is orthogonal and never replaces a device state', () => {
    const store = createDeviceStore()
    store.set(appModeAtom, 'REVIEW_PENDING')

    expect(store.get(deviceStateAtom)).toBe('USER_ACTIVE')
    expect(store.get(appModeAtom)).toBe('REVIEW_PENDING')
  })
})

describe('actions', () => {
  test('the store is born on the main menu, with rows, before any network call', () => {
    const store = createDeviceStore()
    const snapshot = store.get(screenSnapshotAtom)

    expect(snapshot?.screenId).toBe('S03')
    expect(snapshot?.rows.length).toBeGreaterThan(0)
    expect(snapshot?.rows[0]?.label).toBe('Music')
  })

  test('Menu at the root bumps, and the bump has a fresh sequence number', () => {
    const store = createDeviceStore()

    const first = store.set(popScreenActionAtom, 100)
    const second = store.set(popScreenActionAtom, 200)

    expect(first?.direction).toBe('right')
    expect(second?.direction).toBe('right')
    expect(second?.seq).toBe((first?.seq ?? 0) + 1)
    expect(store.get(bumpAtom)?.at).toBe(200)
    expect(store.get(screenStackAtom)).toHaveLength(1)
  })

  test('descend then Menu restores the exact prior highlight', () => {
    const store = createDeviceStore()
    store.set(moveHighlightActionAtom, 4, 0)
    expect(store.get(highlightIndexAtom)).toBe(4)

    store.set(pushScreenActionAtom, trackFrame(30))
    store.set(moveHighlightActionAtom, 11, 10)
    expect(store.get(highlightIndexAtom)).toBe(11)

    store.set(popScreenActionAtom, 20)
    expect(store.get(currentScreenAtom)?.screenId).toBe('S03')
    expect(store.get(highlightIndexAtom)).toBe(4)
  })

  test('the visible window follows the density of the screen on top', () => {
    const store = createDeviceStore()
    expect(store.get(visibleRowsAtom)).toHaveLength(VISIBLE_ROWS.medium)

    store.set(pushScreenActionAtom, trackFrame(30))
    expect(store.get(visibleRowsAtom)).toHaveLength(VISIBLE_ROWS.compact)
  })

  test('the transport buttons page a list, and do not select', () => {
    const store = createDeviceStore()
    store.set(pushScreenActionAtom, trackFrame(40))

    const outcome = store.set(pressActionAtom, {
      button: 'next',
      source: 'human',
      timestampMs: 0,
    })

    expect(outcome.handled).toBe(true)
    expect(store.get(highlightIndexAtom)).toBe(VISIBLE_ROWS.compact)
    expect(store.get(currentScreenAtom)?.screenId).toBe('S08')
  })

  test('Center is declined by the machine, for the layer holding the data', () => {
    const store = createDeviceStore()
    const outcome = store.set(pressActionAtom, {
      button: 'center',
      source: 'human',
      timestampMs: 0,
    })

    expect(outcome.handled).toBe(false)
    expect(store.get(screenStackAtom)).toHaveLength(1)
  })

  test('an agent press is silent; a human press clicks', () => {
    const store = createDeviceStore()

    const byAgent = store.set(pressActionAtom, {
      button: 'menu',
      source: 'agent',
      timestampMs: 0,
    })
    expect(byAgent.silenced).toBe(true)
    expect(byAgent.clickerTicks).toBe(0)
    expect(byAgent.actor).toBe('agent:unknown')

    const byHuman = store.set(pressActionAtom, {
      button: 'menu',
      source: 'human',
      timestampMs: 1,
    })
    expect(byHuman.silenced).toBe(false)
    expect(byHuman.clickerTicks).toBe(1)
    expect(byHuman.actor).toBe('human:touch')
  })

  test('a custom initial stack replaces the default main menu', () => {
    const store = createDeviceStore({ initialStack: [menuFrame(MENU_ROOT, 'airy'), trackFrame(3)] })

    expect(store.get(screenStackAtom)).toHaveLength(2)
    expect(store.get(currentScreenAtom)?.screenId).toBe('S08')
  })
})
