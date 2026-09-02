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
  interactionFeedbackAtom,
  visibleRowsAtom,
} from './contract'
import type { PanelRow, ScreenFrame } from './contract'
import { MENU_ROOT, menuFrame } from './menu'
import {
  acceptedExternalPressActionAtom,
  createDeviceStore,
  deviceStore,
  setDensityActionAtom,
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

    store.set(setDensityActionAtom, 'airy')
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
    store.set(moveHighlightActionAtom, 3)
    store.set(moveHighlightActionAtom, 2)

    unsubscribe()
    store.set(moveHighlightActionAtom, 1)

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

    a.set(setDensityActionAtom, 'airy')
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
    let t = 100
    const store = createDeviceStore({ now: () => t })

    const first = store.set(popScreenActionAtom)
    t = 200
    const second = store.set(popScreenActionAtom)

    expect(first?.direction).toBe('right')
    expect(second?.direction).toBe('right')
    expect(second?.seq).toBe((first?.seq ?? 0) + 1)
    expect(first?.at).toBe(100)
    expect(store.get(bumpAtom)?.at).toBe(200)
    expect(store.get(screenStackAtom)).toHaveLength(1)
  })

  test('descend then Menu restores the exact prior highlight', () => {
    const store = createDeviceStore()
    store.set(moveHighlightActionAtom, 4)
    expect(store.get(highlightIndexAtom)).toBe(4)

    store.set(pushScreenActionAtom, trackFrame(30))
    store.set(moveHighlightActionAtom, 11)
    expect(store.get(highlightIndexAtom)).toBe(11)

    store.set(popScreenActionAtom)
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
    })

    expect(outcome.handled).toBe(false)
    expect(store.get(screenStackAtom)).toHaveLength(1)
  })

  test('an agent press is silent; a human press clicks', () => {
    const store = createDeviceStore()

    const byAgent = store.set(pressActionAtom, {
      button: 'menu',
      source: 'agent',
    })
    expect(byAgent.silenced).toBe(true)
    expect(byAgent.clickerTicks).toBe(0)
    expect(byAgent.actor).toBe('agent:unknown')

    const byHuman = store.set(pressActionAtom, {
      button: 'menu',
      source: 'human',
    })
    expect(byHuman.silenced).toBe(false)
    expect(byHuman.clickerTicks).toBe(1)
    expect(byHuman.actor).toBe('human:touch')
  })

  test('an empty-stack cardinal no-op is rejected before feedback publication', () => {
    const store = createDeviceStore({ initialStack: [] })
    const outcome = store.set(pressActionAtom, {
      button: 'menu',
      source: 'human',
      path: 'mouse-arc',
    })

    expect(outcome).toMatchObject({ handled: false, clickerTicks: 0 })
    expect(store.get(interactionFeedbackAtom)).toBeNull()
  })

  test('provider-owned Play/Pause publishes only an accepted external press', () => {
    const store = createDeviceStore()
    expect(store.get(interactionFeedbackAtom)).toBeNull()

    store.set(acceptedExternalPressActionAtom, {
      button: 'play-pause',
      source: 'agent',
      path: 'key',
    })
    expect(store.get(interactionFeedbackAtom)).toBeNull()

    store.set(acceptedExternalPressActionAtom, {
      button: 'play-pause',
      source: 'human',
      path: 'key',
    })
    expect(store.get(interactionFeedbackAtom)).toMatchObject({
      control: 'press',
      button: 'play-pause',
      clickerTicks: 1,
      actor: 'human:key',
    })
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

  test('the FIRST call in a fresh production module throws', async () => {
    // ⚑ D-058. The previous version of this test stubbed NODE_ENV inside this
    // file and asserted a throw — and was green only because two dozen earlier
    // `createDeviceStore()` calls in the same file had already pushed a
    // counter past its threshold. In a real document the count starts at zero,
    // so the *first* call succeeded: precisely the call D-051 exists to stop,
    // since `<Provider store={createDeviceStore()}>` is written once.
    //
    // The assertion cannot be allowed to depend on anything that happened
    // before it, so it runs in a fresh process with a fresh module registry
    // and no test runner, where the call under test is genuinely the first
    // one. Nothing this file did can make it pass.
    const source = `
      import { createDeviceStore } from '${import.meta.dir}/testing.ts'
      try {
        createDeviceStore()
        console.log('NO_THROW')
      } catch (error) {
        console.log('THREW:' + (error as Error).message.slice(0, 40))
      }
    `
    const proc = Bun.spawn(['bun', 'run', '-'], {
      stdin: new TextEncoder().encode(source),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env['PATH'] ?? '' },
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited

    expect(output).toContain('THREW:')
    expect(output).not.toContain('NO_THROW')
  })

  test('a second call in a fresh production module throws as well', async () => {
    const source = `
      import { createDeviceStore } from '${import.meta.dir}/testing.ts'
      let survived = 0
      for (let i = 0; i < 2; i += 1) {
        try { createDeviceStore(); survived += 1 } catch { /* expected */ }
      }
      console.log('SURVIVED:' + String(survived))
    `
    const proc = Bun.spawn(['bun', 'run', '-'], {
      stdin: new TextEncoder().encode(source),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env['PATH'] ?? '' },
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited

    expect(output).toContain('SURVIVED:0')
  })

  test('the singleton itself is still built, in that same fresh process', async () => {
    // The guard must not be so blunt that it stops the device existing. If
    // importing the package threw, the previous two tests would pass for the
    // wrong reason.
    const source = `
      import { deviceStore } from '${import.meta.dir}/index.ts'
      import { currentScreenAtom } from '${import.meta.dir}/contract.ts'
      console.log('SCREEN:' + String(deviceStore.get(currentScreenAtom)?.screenId))
    `
    const proc = Bun.spawn(['bun', 'run', '-'], {
      stdin: new TextEncoder().encode(source),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env['PATH'] ?? '' },
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited

    expect(output).toContain('SCREEN:S03')
  })

  test('the factory is not reachable from the package entry point', async () => {
    // The shape half of the fix: the import a consumer would actually write
    // does not resolve to anything.
    const entry = await import('./index')
    expect('createDeviceStore' in entry).toBe(false)
    expect('deviceStore' in entry).toBe(true)
  })

  test('the store a consumer hands a Provider is named, and is not the factory', () => {
    expect(typeof deviceStore.get).toBe('function')
    expect(typeof deviceStore.set).toBe('function')
    expect(typeof deviceStore.sub).toBe('function')
  })
})

describe('D-051 — nothing outside a test builds a device', () => {
  test('no non-test source in the repo calls createDeviceStore', async () => {
    // The static half of the gate. The runtime guard catches a second device
    // at construction; this catches the *line* that would construct it, in
    // review, including in packages this one cannot import.
    //
    // ⚑ Filtered by what the line IS, not by which file it is in. An earlier
    // version excluded three of this package's files wholesale, so a real call
    // added inside `store.ts` or `menu.ts` would have been invisible to the
    // gate meant to catch it — the same "green for the wrong reason" shape as
    // the counter this replaces.
    const proc = Bun.spawn(
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
      .filter((line) => !/\.test\.tsx?:/.test(line))
      .filter((line) => {
        const code = line.slice(line.indexOf(':', line.indexOf(':') + 1) + 1).trim()
        // Prose in a TSDoc block or a line comment is not a call.
        if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) return false
        // The definition itself, and the single sanctioned re-export.
        if (code.startsWith('export function createDeviceStore')) return false
        if (code.startsWith('export { createDeviceStore }')) return false
        // Anything else that mentions it without calling it is still reported.
        return true
      })

    expect(offenders).toEqual([])
  })

  test('and the only re-export of it is the test-only entry point', async () => {
    const proc = Bun.spawn(
      ['grep', '-rn', '--include=*.ts', 'export { createDeviceStore }', 'packages', 'apps'],
      { cwd: `${import.meta.dir}/../../..`, stdout: 'pipe', stderr: 'pipe' },
    )
    const output = await new Response(proc.stdout).text()
    await proc.exited

    const lines = output
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => !/\.test\.tsx?:/.test(line))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('packages/state/src/testing.ts')
  })
})

describe('Menu on a device with no screens', () => {
  test('does not bump — an empty stack has no top to announce', () => {
    // `popScreen` used to guard with `<= 1`, so a stack of zero was treated as
    // the root and published an elastic "this is the top" for a top that did
    // not exist. The atoms are exported, so this state is reachable by a
    // consumer that reads them directly rather than through the factory.
    const store = createDeviceStore({ initialStack: [] })

    const bump = store.set(popScreenActionAtom)

    expect(bump).toBeNull()
    expect(store.get(bumpAtom)).toBeNull()
    expect(store.get(screenStackAtom)).toEqual([])
    expect(store.get(currentScreenAtom)).toBeNull()
  })

  test('a device with one screen still bumps, as the root must', () => {
    const store = createDeviceStore()
    expect(store.set(popScreenActionAtom)?.direction).toBe('right')
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
