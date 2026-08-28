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
  densityOverrideAtom,
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
  deviceStore,
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

    store.set(densityOverrideAtom, 'airy')
    expect(store.get(densityOverrideAtom)).toBe('airy')

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

    a.set(densityOverrideAtom, 'airy')
    expect(a.get(densityOverrideAtom)).toBe('airy')
    expect(b.get(densityOverrideAtom)).toBeNull()
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

describe('D-051 — exactly one device per document', () => {
  test('`deviceStore` is the module singleton, and repeated imports get it', async () => {
    const again = (await import('./store')).deviceStore
    expect(again).toBe(deviceStore)
  })

  test('a second device outside a test throws, rather than quietly working', () => {
    // ⚑ The failure this prevents has no symptom of its own. A React tree
    // handed `<Provider store={createDeviceStore()}>` gets a store that is
    // valid, React-free, and passes every other test in this package — while
    // tool callbacks address the singleton. Two devices, no type error, and
    // the UI and the tools moving different screens. "State is reachable
    // outside React" stays true and the product's premise is dead.
    //
    // Constructing a second device is legitimate for a *test*, which needs
    // isolation from the previous test's screen stack. That is the only
    // legitimate case, so it is the only one allowed.
    const previous = process.env['NODE_ENV']
    try {
      process.env['NODE_ENV'] = 'production'
      expect(() => createDeviceStore()).toThrow(/exactly one device per document/)
    } finally {
      if (previous === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = previous
    }
  })

  test('the store a consumer should hand a Provider is named, and is not the factory', () => {
    // A structural reading of the same rule: the module's default path to a
    // device is the singleton. `createDeviceStore` is reachable but gated.
    expect(typeof deviceStore.get).toBe('function')
    expect(typeof deviceStore.set).toBe('function')
    expect(typeof deviceStore.sub).toBe('function')
  })
})

describe('D-051 — nothing outside a test builds a device', () => {
  test('no source file in the repo calls createDeviceStore', async () => {
    // The static half of the gate. The runtime guard catches a second device
    // at construction; this catches the line that would construct it, in
    // review, before it ships — including in packages this one cannot import.
    const { spawn } = await import('bun')
    const proc = spawn(
      [
        'grep',
        '-rn',
        '--include=*.ts',
        '--include=*.tsx',
        'createDeviceStore',
        'packages',
        'apps',
      ],
      { cwd: `${import.meta.dir}/../../..`, stdout: 'pipe', stderr: 'pipe' },
    )
    const output = await new Response(proc.stdout).text()
    await proc.exited

    const offenders = output
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => !line.includes('.test.ts'))
      // Its own definition, its own TSDoc, and the doc comments that name it.
      .filter((line) => !line.startsWith('packages/state/src/store.ts'))
      .filter((line) => !line.startsWith('packages/state/src/contract.ts'))
      .filter((line) => !line.startsWith('packages/state/src/menu.ts'))

    expect(offenders).toEqual([])
  })
})

describe('Menu on a device with no screens', () => {
  test('does not bump — an empty stack has no top to announce', () => {
    // `popScreen` used to guard with `<= 1`, so a stack of zero was treated as
    // the root and published an elastic "this is the top" for a top that did
    // not exist. The atoms are exported, so this state is reachable by a
    // consumer that reads them directly rather than through the factory.
    const store = createDeviceStore({ initialStack: [] })

    const bump = store.set(popScreenActionAtom, 0)

    expect(bump).toBeNull()
    expect(store.get(bumpAtom)).toBeNull()
    expect(store.get(screenStackAtom)).toEqual([])
    expect(store.get(currentScreenAtom)).toBeNull()
  })

  test('a device with one screen still bumps, as the root must', () => {
    const store = createDeviceStore()
    expect(store.set(popScreenActionAtom, 0)?.direction).toBe('right')
  })
})

describe('menu rows the provider cannot serve are absent, not greyed', () => {
  test('a visibility predicate drops rows and re-indexes what is left', () => {
    const store = createDeviceStore({
      isVisible: (node) => node.label !== 'Radio' && node.label !== 'Now Playing',
    })

    // The whole frame, not the visible window — a filtered row must be absent
    // from the list itself, not merely scrolled past.
    const rows = store.get(currentScreenAtom)?.rows ?? []
    const labels = rows.map((row) => row.label)
    expect(labels).not.toContain('Radio')
    expect(labels).not.toContain('Now Playing')
    expect(labels[0]).toBe('Music')

    // Indices count the rows the human can see. An index that counted hidden
    // rows would send a navigation tool to a different row than the one it was
    // told about.
    expect(rows.map((row) => row.index)).toEqual(rows.map((_row, i) => i))
  })

  test('the default admits everything, which is the honest pre-provider answer', () => {
    const store = createDeviceStore()
    const labels = (store.get(currentScreenAtom)?.rows ?? []).map((row) => row.label)
    expect(labels).toContain('Radio')
    expect(labels).toContain('Now Playing')
  })
})
