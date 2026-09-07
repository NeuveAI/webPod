import { describe, expect, test } from 'bun:test'
import { createDeviceStore } from '@webpod/state/testing'
import { currentScreenAtom, detentActionAtom, holdEngagedAtom, interactionFeedbackAtom, resetStackActionAtom, type ScreenFrame } from '@webpod/state'
import { createInteractionTools, listStatus, navigationProgressAtom, navigationStepInterval, type InteractionDependencies } from './interactions'
import { modelContextOf, registerTools, type NativeTool, type NativeModelContext } from './native'

function frame(count = 30): ScreenFrame {
  return { screenId: 'S04', title: 'Albums', density: 'medium', rows: Array.from({ length: count }, (_, index) => ({ index, label: `Album ${index}`, sublabel: null, glyphs: [], provenance: null })), highlightIndex: count ? 0 : -1, windowStart: 0, route: { kind: 'albums' } }
}
function setup(overrides: Partial<InteractionDependencies> = {}) {
  const store = createDeviceStore({ initialStack: [frame()] })
  let time = 0
  const times: number[] = []
  const waits: number[] = []
  const tools = createInteractionTools({ setVolume: async level => level, store, pageState: () => ({ interactionReady: true, status: 'ready' }), press: async () => true, rotate: (x, y) => ({ x, y }), flick: async (face) => ({ face }), now: () => time, wait: async (ms, signal) => { signal.throwIfAborted(); waits.push(ms); time += ms; times.push(time) }, ...overrides })
  const call = (name: string, input: unknown = {}, signal = new AbortController().signal) => {
    const found = tools.find((tool) => tool.name === `webpod_${name}`)
    if (found === undefined) throw new Error('Missing tool')
    return found.execute(input, { signal })
  }
  return { store, tools, call, times, waits }
}

describe('WebMCP interaction contracts', () => {
  test('volume is global, validates input, and reports provider rounding', async () => {
    const levels: number[] = []
    const { call } = setup({ pageState: () => ({ interactionReady: false, status: 'loading' }), setVolume: async level => { levels.push(level); return Math.round(level) } })
    for (const level of [0, 37.5, 100]) expect(await call('set_volume', { level0to100: level })).toEqual({ volume0to100: Math.round(level) })
    for (const level of [-1, 101, NaN, Infinity, '50', null, undefined]) await expect(call('set_volume', { level0to100: level })).rejects.toThrow()
    await expect(call('set_volume', { level0to100: 30, extra: true })).rejects.toThrow()
    expect(levels).toEqual([0, 37.5, 100])
  })
  test('volume respects Hold, cancellation, the interaction lock, and provider failures', async () => {
    let calls = 0
    let finish = () => {}
    const { call, store } = setup({ setVolume: () => { calls++; return new Promise<number>(resolve => { finish = () => resolve(25) }) } })
    store.set(holdEngagedAtom, true)
    await expect(call('set_volume', { level0to100: 25 })).rejects.toThrow('Hold')
    store.set(holdEngagedAtom, false)
    const controller = new AbortController(); controller.abort()
    await expect(call('set_volume', { level0to100: 25 }, controller.signal)).rejects.toThrow()
    expect(calls).toBe(0)
    const pending = call('set_volume', { level0to100: 25 })
    await expect(call('click_wheel', { button: 'menu' })).rejects.toThrow('Another device')
    finish(); await pending
    expect(await call('click_wheel', { button: 'menu' })).toMatchObject({ accepted: true })
    const failed = setup({ setVolume: async () => { throw new Error('Provider unavailable') } })
    await expect(failed.call('set_volume', { level0to100: 10 })).rejects.toThrow('Provider unavailable')
    expect(await failed.call('click_wheel', { button: 'menu' })).toMatchObject({ accepted: true })
  })
  test('full list and separate zero-based selection include rows outside the viewport', () => {
    const { store } = setup()
    store.set(detentActionAtom, { path: 'direct', source: 'agent', detents: 17, timestampMs: 0 })
    const status = listStatus(store)
    expect(status.count).toBe(30)
    expect(status.selectedItem?.position).toBe(17)
    expect(status.items[17]).toBe(status.selectedItem?.item)
    store.set(resetStackActionAtom, [frame(0)])
    expect(listStatus(store)).toMatchObject({ count: 0, selectedItem: null, items: [] })
    store.set(resetStackActionAtom, [])
    expect(listStatus(store)).toMatchObject({ isList: false, selectedItem: null })
  })
  test('long traversal accelerates without exceeding five audible items per second', async () => {
    const { call, store, waits, times } = setup()
    const actors: string[] = []
    const stop = store.sub(interactionFeedbackAtom, () => actors.push(store.get(interactionFeedbackAtom)?.actor ?? 'missing'))
    const result = await call('navigate_list', { direction: 'next', items: 20 })
    expect(result).toMatchObject({ requestedItems: 20, completedItems: 20, destination: { selectedItem: { position: 20 } } })
    expect(waits[0]).toBe(350)
    expect(waits.at(-1)).toBe(200)
    for (let i = 1; i < times.length; i++) expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(200)
    expect(actors).toEqual(Array(20).fill('agent:unknown'))
    expect(store.get(navigationProgressAtom)).toBeNull()
    stop()
  })
  test('clamps next/previous at boundaries with honest requested and actual counts', async () => {
    const { call } = setup()
    expect(await call('navigate_list', { direction: 'previous', items: 10 })).toMatchObject({ completedItems: 0 })
    expect(await call('navigate_list', { direction: 'next', items: 100 })).toMatchObject({ completedItems: 29 })
    expect(await call('navigate_list', { direction: 'previous', items: 1 })).toMatchObject({ completedItems: 1, destination: { selectedItem: { position: 28 } } })
    expect(navigationStepInterval(1, 0)).toBe(350)
  })
  test('read-only status works during movement and concurrent mutation is rejected', async () => {
    let resume = () => {}
    const { call, store } = setup({ wait: () => new Promise<void>((resolve) => { resume = resolve }) })
    const pending = call('navigate_list', { direction: 'next', items: 1 })
    expect(store.get(navigationProgressAtom)).toMatchObject({ direction: 'next', completedItems: 0, requestedItems: 1 })
    expect(await call('page_state')).toMatchObject({ navigation: { requestedItems: 1 } })
    await expect(call('click_wheel', { button: 'menu' })).rejects.toThrow('Another device')
    resume(); await pending
  })
  test('list replacement or human selection interrupts before the next detent', async () => {
    for (const replace of [true, false]) {
      let resume = () => {}
      const { call, store } = setup({ wait: () => new Promise<void>((resolve) => { resume = resolve }) })
      const pending = call('navigate_list', { direction: 'next', items: 1 })
      if (replace) store.set(resetStackActionAtom, [frame()])
      else store.set(detentActionAtom, { path: 'direct', source: 'human', detents: 3, timestampMs: 1 })
      resume()
      await expect(pending).rejects.toThrow('interrupted')
      expect(store.get(currentScreenAtom)?.highlightIndex).toBe(replace ? 0 : 3)
      expect(store.get(navigationProgressAtom)).toBeNull()
    }
  })
  test('cancellation clears in-flight progress and permits a later call', async () => {
    const controller = new AbortController()
    const { call, store } = setup({ wait: async () => { controller.abort(); } })
    await expect(call('navigate_list', { direction: 'next', items: 10 }, controller.signal)).rejects.toThrow()
    expect(store.get(currentScreenAtom)?.highlightIndex).toBe(0)
    expect(store.get(navigationProgressAtom)).toBeNull()
    expect(await call('click_wheel', { button: 'menu' })).toMatchObject({ accepted: true })
  })
  test('background refreshes and appended pages preserve traversal of the original targets', async () => {
    const { store, call } = setup({ wait: async () => {
      const current = store.get(currentScreenAtom)
      if (current === null) throw new Error('Missing frame')
      store.set(resetStackActionAtom, [{ ...current, rows: [...current.rows.map(row => ({ ...row, sublabel: 'Updated metadata' })), { ...frame(1).rows[0], label: 'Appended', sublabel: null, glyphs: [], provenance: null, index: current.rows.length, entityKey: `appended-${current.rows.length}` }] }])
    } })
    store.set(resetStackActionAtom, [{ ...frame(5), rows: frame(5).rows.map((row, index) => ({ ...row, entityKey: `album-${index}` })) }])
    expect(await call('navigate_list', { direction: 'next', items: 3 })).toMatchObject({ completedItems: 3, destination: { selectedItem: { position: 3 } } })
  })
  test('root count refreshes preserve destination identity', async () => {
    const { store, call } = setup({ wait: async () => {
      const current = store.get(currentScreenAtom)
      if (current === null) throw new Error('Missing frame')
      store.set(resetStackActionAtom, [{ ...current, rows: current.rows.map(row => ({ ...row, sublabel: '100+' })) }])
    } })
    const root = frame(2)
    store.set(resetStackActionAtom, [{ ...root, route: { kind: 'root' }, rows: root.rows.map((row, index) => ({ ...row, destination: index === 0 ? { kind: 'albums' as const } : { kind: 'songs' as const } })) }])
    expect(await call('navigate_list', { direction: 'next', items: 1 })).toMatchObject({ completedItems: 1 })
  })
  test('same-label entity replacements and route changes still interrupt before movement', async () => {
    for (const changeRoute of [false, true]) {
      const { store, call } = setup({ wait: async () => {
        const current = store.get(currentScreenAtom)
        if (current === null) throw new Error('Missing frame')
        store.set(resetStackActionAtom, [{ ...current, ...(changeRoute ? { route: { kind: 'songs' as const } } : {}), rows: current.rows.map(row => ({ ...row, entityKey: changeRoute ? row.entityKey : 'different-entity' })) }])
      } })
      store.set(resetStackActionAtom, [{ ...frame(3), rows: frame(3).rows.map((row, index) => ({ ...row, entityKey: `album-${index}` })) }])
      await expect(call('navigate_list', { direction: 'next', items: 2 })).rejects.toThrow('interrupted')
      expect(store.get(currentScreenAtom)?.highlightIndex).toBe(0)
      expect(store.get(navigationProgressAtom)).toBeNull()
    }
  })
  test('delayed wakes cannot cause catch-up bursts and consecutive calls retain the speed bound', async () => {
    let time = 0
    const dispatches: number[] = []
    const { call, store } = setup({ now: () => time, wait: async (ms) => { time += ms + 500 } })
    const stop = store.sub(interactionFeedbackAtom, () => dispatches.push(time))
    await call('navigate_list', { direction: 'next', items: 10 })
    await call('navigate_list', { direction: 'next', items: 1 })
    for (let index = 1; index < dispatches.length; index++) expect((dispatches[index] ?? 0) - (dispatches[index - 1] ?? 0)).toBeGreaterThanOrEqual(200)
    expect(dispatches).toHaveLength(11)
    stop()
  })
  test('pre-aborted calls and readiness/Hold changes during a wait cannot mutate', async () => {
    const first = setup()
    await expect(first.call('navigate_list', { direction: 'next', items: 1 }, AbortSignal.abort())).rejects.toThrow()
    expect(first.store.get(currentScreenAtom)?.highlightIndex).toBe(0)
    for (const hold of [true, false]) {
      let ready = true
      let resume = () => {}
      const { call, store } = setup({ pageState: () => ({ interactionReady: ready, status: ready ? 'ready' : 'loading' }), wait: () => new Promise<void>((resolve) => { resume = resolve }) })
      const pending = call('navigate_list', { direction: 'next', items: 2 })
      if (hold) store.set(holdEngagedAtom, true)
      else ready = false
      resume()
      await expect(pending).rejects.toThrow('interrupted')
      expect(store.get(currentScreenAtom)?.highlightIndex).toBe(0)
      expect(store.get(navigationProgressAtom)).toBeNull()
    }
  })
  test('strict runtime schemas reject extra fields, invalid counts, numbers, and buttons', async () => {
    const { call } = setup()
    for (const items of [0, -1, 1.2, 1001, NaN, Infinity, '3', undefined]) await expect(call('navigate_list', { direction: 'next', items })).rejects.toThrow()
    await expect(call('navigate_list', { direction: 'down', items: 1 })).rejects.toThrow()
    await expect(call('list_status', { extra: true })).rejects.toThrow()
    await expect(call('list_status', null)).rejects.toThrow()
    await expect(call('rotate_ipod', { xDeg: Infinity, yDeg: 0 })).rejects.toThrow()
    await expect(call('rotate_ipod', { xDeg: 0, yDeg: 361 })).rejects.toThrow()
    await expect(call('click_wheel', { button: 'hold' })).rejects.toThrow()
    await expect(call('flick_ipod', { face: 'rear' })).rejects.toThrow()
  })
  test('Hold and non-ready pages reject navigation; global menu remains available while loading', async () => {
    const { call, store } = setup({ pageState: () => ({ status: 'loading', interactionReady: false }) })
    await expect(call('select_item')).rejects.toThrow('not interaction ready')
    await expect(call('navigate_list', { direction: 'next', items: 1 })).rejects.toThrow('not interaction ready')
    expect(await call('click_wheel', { button: 'menu' })).toMatchObject({ accepted: true })
    store.set(holdEngagedAtom, true)
    await expect(call('click_wheel', { button: 'menu' })).rejects.toThrow('Hold')
  })
  test('selection reports actionable failure if Hold or the control blocks the press after admission', async () => {
    const { call } = setup({ press: async () => false })
    await expect(call('select_item')).rejects.toThrow('did not accept the press; check Hold and page state')
    expect(await call('click_wheel', { button: 'center' })).toMatchObject({ accepted: false, reason: 'The mounted control did not accept the press; check Hold and page state.' })
  })
  test('all five buttons and physical orientation delegate with cancellation', async () => {
    const buttons: string[] = []
    const { call } = setup({ press: async (button, signal) => { signal.throwIfAborted(); buttons.push(button); return true } })
    for (const button of ['menu', 'previous', 'next', 'play-pause', 'center']) await call('click_wheel', { button })
    await call('select_item')
    expect(buttons).toEqual(['menu', 'previous', 'next', 'play-pause', 'center', 'center'])
    expect(await call('rotate_ipod', { xDeg: -5, yDeg: 20 })).toEqual({ x: -5, y: 20 })
    expect(await call('flick_ipod', { face: 'back' })).toEqual({ face: 'back' })
  })
})

describe('current-draft native registration', () => {
  test('async registration uses only canonical dictionary fields and abort cleanup', async () => {
    const { tools } = setup()
    const registrations: { tool: NativeTool; signal: AbortSignal }[] = []
    const context: NativeModelContext = { registerTool: async (tool, options) => { registrations.push({ tool, signal: options.signal }); return undefined } }
    const mount = registerTools(context, tools)
    await mount.ready
    expect(registrations).toHaveLength(8)
    for (const registration of registrations) {
      expect(Object.keys(registration.tool).sort()).toEqual(['annotations', 'description', 'execute', 'inputSchema', 'name'])
      expect(Object.keys(registration.tool.annotations).sort()).toEqual(['consequentialHint', 'readOnlyHint', 'untrustedContentHint'])
      await expect(registration.tool.execute({}, { signal: AbortSignal.abort() })).rejects.toThrow()
    }
    mount.dispose()
    expect(registrations.every((entry) => entry.signal.aborted)).toBe(true)
  })
  test('native feature detection preserves receiver, caches document identity and leaves unsupported documents untouched', async () => {
    const unsupported = {}
    expect(modelContextOf(unsupported)).toBeNull()
    expect('modelContext' in unsupported).toBe(false)
    let calls = 0
    const native = { registerTool(this: unknown) { expect(this).toBe(native); calls += 1; return Promise.resolve(undefined) } }
    Object.defineProperty(unsupported, 'modelContext', { value: native })
    const context = modelContextOf(unsupported)
    expect(context).not.toBeNull()
    expect(modelContextOf(unsupported)).toBe(context)
    const definition = setup().tools[0]
    if (definition === undefined || context === null) throw new Error('fixture missing')
    const mount = registerTools(context, [definition])
    await mount.ready
    expect(calls).toBe(1)
    mount.dispose()
  })
  test('disposal stops pending registered navigation without clearing a remounted operation', async () => {
    const store = createDeviceStore({ initialStack: [frame()] })
    const registered = new Map<string, NativeTool>()
    const context: NativeModelContext = { registerTool: async (tool, { signal }) => { registered.set(tool.name, tool); signal.addEventListener('abort', () => { if (registered.get(tool.name) === tool) registered.delete(tool.name) }, { once: true }); return undefined } }
    const options: InteractionDependencies = { setVolume: async level => level, store, pageState: () => ({ interactionReady: true, status: 'ready' }), press: async () => true, rotate: () => ({}), flick: async () => ({}) }
    const first = registerTools(context, createInteractionTools(options)); await first.ready
    const oldTool = registered.get('webpod_navigate_list')
    if (oldTool === undefined) throw new Error('fixture missing')
    const oldExecution = oldTool.execute({ direction: 'next', items: 10 }, { signal: new AbortController().signal }).then(() => false, () => true)
    first.dispose()
    let resume = () => {}
    const second = registerTools(context, createInteractionTools({ ...options, wait: () => new Promise<void>((resolve) => { resume = resolve }) })); await second.ready
    const newTool = registered.get('webpod_navigate_list')
    if (newTool === undefined) throw new Error('fixture missing')
    const newExecution = newTool.execute({ direction: 'next', items: 1 }, { signal: new AbortController().signal })
    expect(await oldExecution).toBe(true)
    expect(store.get(navigationProgressAtom)?.requestedItems).toBe(1)
    expect(store.get(currentScreenAtom)?.highlightIndex).toBe(0)
    resume(); await newExecution
    expect(store.get(currentScreenAtom)?.highlightIndex).toBe(1)
    second.dispose()
  })
  test('duplicate mount rejected, partial failures abort previous registrations and allow remount', async () => {
    const { tools } = setup()
    const signals: AbortSignal[] = []
    const context: NativeModelContext = { registerTool: async (_tool, { signal }) => { signals.push(signal); if (signals.length === 2) throw new Error('registration denied'); return undefined } }
    const mount = registerTools(context, tools)
    expect(() => registerTools(context, tools)).toThrow('already mounted')
    await expect(mount.ready).rejects.toThrow('registration denied')
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    const next = registerTools(context, tools); await next.ready; next.dispose()
  })
  test('dispose aborts executing callbacks and abort before registration stops registration', async () => {
    let registered: NativeTool | null = null
    let invocationSignal: AbortSignal | null = null
    const { tools } = setup()
    const original = tools[0]
    if (original === undefined) throw new Error('missing fixture')
    const context: NativeModelContext = { registerTool: async (tool) => { registered = tool; return undefined } }
    const mount = registerTools(context, [{ ...original, execute: async (_input, { signal }) => { invocationSignal = signal; return {} } }])
    await mount.ready
    const getRegistered = (): NativeTool | null => registered
    await getRegistered()?.execute({}, { signal: new AbortController().signal })
    mount.dispose()
    const readSignal = (): AbortSignal | null => invocationSignal
    expect(readSignal()?.aborted).toBe(true)
    const next = registerTools(context, tools); next.dispose(); await expect(next.ready).rejects.toThrow()
  })
})
