import { expect, test, type Page } from '@playwright/test'
import type { NativeTool } from '../../../packages/tools/src/native'
import { compileSmokeTests, runSmokeTest } from '../../../../.better-coding-agents/resources/webmcp-tools/webmcp-evals/src/evaluator/smokeEvaluator'
import { matchesArgument } from '../../../../.better-coding-agents/resources/webmcp-tools/webmcp-evals/src/matcher'
import type { Eval } from '../../../../.better-coding-agents/resources/webmcp-tools/webmcp-evals/src/types/evals'
import fixture from './webmcp-evals.json'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { assertBrowserSourceIdentity } from './source-identity'
import { STICKER_CATALOGUE } from '../../../packages/stickers/src/index'
import { installNativeStickerInventory, type NativeStickerMock } from './webmcp-native-stickers'

type ListedTool = Pick<NativeTool, 'name' | 'description' | 'inputSchema' | 'annotations'>
/** Browser-agent inspection methods from the same September 4 draft as NativeTool.
 * Registered objects stay in the browser realm; only their metadata is serialized. */
interface BrowserModelContext {
  getTools(): Promise<(Omit<ListedTool, 'inputSchema'> & { inputSchema: object | string })[]>
  executeTool(tool: Omit<ListedTool, 'inputSchema'> & { inputSchema: object | string }, input: object | string, options?: { signal: AbortSignal }): Promise<string>
}

const coreNames = ['webpod_set_volume', 'webpod_debug_trace', 'webpod_device_state', 'webpod_list_status', 'webpod_navigate_list', 'webpod_select_item', 'webpod_page_state', 'webpod_click_wheel', 'webpod_rotate_ipod', 'webpod_flick_ipod']
const stickerNames = ['webpod_open_sticker_pack', 'webpod_close_sticker_pack', 'webpod_navigate_sticker_collection', 'webpod_sticker_list', 'webpod_get_sticker', 'webpod_release_sticker', 'webpod_rotate_sticker', 'webpod_scale_sticker', 'webpod_add_sticker_wear', 'webpod_place_sticker']
const stickerMocks = new WeakMap<Page, NativeStickerMock>()
const cases: Eval[] = fixture.map(entry => ({ ...entry, messages: entry.messages.map(message => ({ ...message, role: 'user', type: 'message' })) }))

test.use({
  launchOptions: {
    executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    args: ['--enable-features=WebMCP', '--enable-blink-features=CanvasDrawElement'],
  },
})

test.beforeEach(async ({ page }) => {
  await installDeterministicAppleMusic(page, { trackCount: 11 })
  stickerMocks.set(page, await installNativeStickerInventory(page))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const health = await assertBrowserSourceIdentity(page)
  test.info().annotations.push({ type: 'source-fingerprint', description: health.current })
  await expect(page.locator('.wp-panel')).toHaveAttribute('data-screen', 'S03')
  await expect.poll(async () => (await discover(page)).map(tool => tool.name)).toEqual(expect.arrayContaining([...coreNames, ...stickerNames]))
})

/** The only assertion boundary is the feature-detected native document object.
 * It is never replaced or shimmed; responses remain unknown until asserted. */
async function discover(page: Page): Promise<ListedTool[]> {
  return page.evaluate(async () => {
    const value: unknown = Reflect.get(document, 'modelContext')
    if (typeof value !== 'object' || value === null || !('getTools' in value) || typeof value.getTools !== 'function' || !('executeTool' in value) || typeof value.executeTool !== 'function') throw new Error('Native WebMCP inspection/execution API unavailable')
    const context = value as BrowserModelContext
    return (await context.getTools()).map(({ name, description, inputSchema, annotations }) => {
      // Canary 155 exposes serialized schemas; current draft exposes objects.
      const schema: unknown = typeof inputSchema === 'string' ? JSON.parse(inputSchema) : inputSchema
      if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) throw new Error('Invalid native input schema')
      return { name, description, inputSchema: Object.fromEntries(Object.entries(schema)), annotations }
    })
  })
}

async function execute(page: Page, name: string, input: object = {}): Promise<unknown> {
  const serialized = await page.evaluate(async ({ name, input }) => {
    const value: unknown = Reflect.get(document, 'modelContext')
    if (typeof value !== 'object' || value === null || !('getTools' in value) || typeof value.getTools !== 'function' || !('executeTool' in value) || typeof value.executeTool !== 'function') throw new Error('Native WebMCP unavailable')
    const context = value as BrowserModelContext
    const tool = (await context.getTools()).find(candidate => candidate.name === name)
    if (tool === undefined) throw new Error(`Missing native tool ${name}`)
    // Version-local browser consumer adapter. Production registration remains
    // current-spec; Canary 155's inspection API still takes a JSON string.
    return context.executeTool(tool, typeof tool.inputSchema === 'string' ? JSON.stringify(input) : input)
  }, { name, input })
  const output: unknown = JSON.parse(serialized)
  return output
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected result object')
  return Object.fromEntries(Object.entries(value))
}

async function readOrientation(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const preview: unknown = Reflect.get(window, '__webpodDevicePreview')
    if (typeof preview !== 'object' || preview === null || !('get' in preview) || typeof preview.get !== 'function') throw new Error('Existing orientation inspection helper unavailable')
    const state: unknown = preview.get()
    if (typeof state !== 'object' || state === null || !('orientation' in state)) throw new Error('Orientation missing')
    return state.orientation
  })
}

test('native registry exposes unique current-draft schemas and complete selected list', async ({ page }) => {
  const tools = await discover(page)
  expect(tools).toHaveLength(coreNames.length + stickerNames.length)
  expect(new Set(tools.map(tool => tool.name)).size).toBe(tools.length)
  for (const tool of tools) {
    expect(tool.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/u)
    expect(tool.description.length).toBeGreaterThan(20)
    expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false })
    expect(tool.annotations.readOnlyHint).toBe(['webpod_debug_trace', 'webpod_device_state', 'webpod_page_state', 'webpod_list_status', 'webpod_sticker_list'].includes(tool.name))
  }
  const list = object(await execute(page, 'webpod_list_status'))
  const selected = object(list['selectedItem'])
  const rows = list['items']
  if (!Array.isArray(rows)) throw new Error('Complete list missing')
  expect(rows.length).toBe(list['count'])
  expect(rows[Number(selected['position'])]).toEqual(selected['item'])
  const before = await execute(page, 'webpod_list_status')
  await execute(page, 'webpod_page_state')
  await execute(page, 'webpod_page_state')
  expect(await execute(page, 'webpod_list_status')).toEqual(before)
})

test('volume tool works from a list without navigating and exposes current volume', async ({ page }) => {
  const before = object(await execute(page, 'webpod_page_state'))
  const list = await execute(page, 'webpod_list_status')
  try {
    expect(await execute(page, 'webpod_set_volume', { level0to100: 25 })).toMatchObject({ volume0to100: 25 })
    expect(await execute(page, 'webpod_page_state')).toMatchObject({ volume0to100: 25 })
    expect(await execute(page, 'webpod_list_status')).toEqual(list)
  } finally {
    await execute(page, 'webpod_set_volume', { level0to100: before['volume0to100'] })
  }
})

for (const [caseIndex, smoke] of compileSmokeTests(cases).entries()) test(`upstream deterministic smoke: ${smoke.name}`, async ({ page }) => {
  const authored = fixture[caseIndex]
  if (smoke === undefined || authored === undefined) throw new Error('Authored smoke case missing')
  const results = await runSmokeTest(smoke, {
    getCurrentTools: async () => (await discover(page)).map(tool => ({ functionName: tool.name, description: tool.description, parameters: tool.inputSchema })),
    executeToolChecked: async (name, args) => {
      try {
        if (caseIndex > 0 && ['webpod_open_sticker_pack', 'webpod_navigate_sticker_collection', 'webpod_get_sticker'].includes(name)) await stickerReady(page)
        return { success: true, result: await execute(page, name, args) }
      }
      catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) } }
    },
  }, 30_000)
  expect(results).toHaveLength(authored.expectedCall.length)
  for (const [index, result] of results.entries()) {
    const expected = authored.expectedCall[index]
    if (expected === undefined) throw new Error('Missing result expectation')
    expect(result.outcome, JSON.stringify(result)).toBe('pass')
    expect(matchesArgument(expected.result, result.result), `${result.functionName}: ${JSON.stringify(result.result)}`).toBe(true)
  }
  // Negative control: the external smoke executor ignores result constraints.
  // This wrapper must reject a deliberately wrong selection expectation.
  expect(matchesArgument({ selectedItem: { position: 999 } }, results[0]?.result)).toBe(false)
  await test.info().attach('upstream-smoke-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })
})

test('native invalid arguments reject without changing selection or orientation', async ({ page }) => {
  const before = await execute(page, 'webpod_list_status')
  const pose = await readOrientation(page)
  for (const [name, args] of [
    ['webpod_navigate_list', { direction: 'next', items: 0 }],
    ['webpod_navigate_list', { direction: 'next', items: 1.5 }],
    ['webpod_navigate_list', { direction: 'next', items: 1001 }],
    ['webpod_navigate_list', { direction: 'sideways', items: 1 }],
    ['webpod_list_status', { unexpected: true }],
    ['webpod_rotate_ipod', { xDeg: 361, yDeg: 0 }],
    ['webpod_click_wheel', { button: 'unknown' }],
  ] as const) await expect(execute(page, name, args)).rejects.toThrow()
  expect(await execute(page, 'webpod_list_status')).toEqual(before)
  expect(await readOrientation(page)).toEqual(pose)
})

async function songs(page: Page): Promise<void> {
  await execute(page, 'webpod_navigate_list', { direction: 'next', items: 1 })
  await execute(page, 'webpod_select_item')
  await expect(page.locator('.wp-panel')).toHaveAttribute('data-screen', 'S09')
  expect(await execute(page, 'webpod_list_status')).toMatchObject({ count: 11, selectedItem: { position: 0 } })
}

test('native traversal is paced in the visible list and emits SFX after trusted unlock', async ({ page }) => {
  // An actual keyboard contact unlocks Web Audio through the ordinary UI.
  const panel = page.locator('.wp-panel')
  await panel.focus()
  await page.keyboard.press('Escape')
  const audio = page.locator('[data-wp-audio-lifecycle]').first()
  await expect(audio).toHaveAttribute('data-wp-audio-lifecycle', 'running')
  await songs(page)
  const audioBefore = Number(await audio.getAttribute('data-wp-audio-scheduled-total'))
  await page.evaluate(() => {
    const list = document.querySelector('.wp-panel')
    if (list === null) throw new Error('Visible panel absent')
    const samples: { label: string; at: number }[] = []
    let previous = list.querySelector('[aria-selected="true"]')?.textContent ?? ''
    const observer = new MutationObserver(() => {
      const label = list.querySelector('[aria-selected="true"]')?.textContent ?? ''
      if (label !== previous) { previous = label; samples.push({ label, at: performance.now() }) }
    })
    observer.observe(list, { subtree: true, attributes: true, childList: true })
    Reflect.set(window, '__webmcpNativeSamples', { samples, observer })
  })
  const started = Date.now()
  expect(await execute(page, 'webpod_navigate_list', { direction: 'next', items: 8 })).toMatchObject({ completedItems: 8, destination: { selectedItem: { position: 8 } } })
  expect(Date.now() - started).toBeGreaterThanOrEqual(1600)
  const samples = await page.evaluate(() => {
    // Test-only observation record, never a product state mutation API.
    const value = Reflect.get(window, '__webmcpNativeSamples') as { samples: { label: string; at: number }[]; observer: MutationObserver }
    value.observer.disconnect()
    Reflect.deleteProperty(window, '__webmcpNativeSamples')
    return value.samples
  })
  expect(samples).toHaveLength(8)
  for (let index = 1; index < samples.length; index++) {
    // DOM paint delivery jitter is separate from exact injected-clock unit proof.
    const current = samples[index]
    const previous = samples[index - 1]
    if (current === undefined || previous === undefined) throw new Error('Traversal sample missing')
    expect(current.at - previous.at).toBeGreaterThanOrEqual(175)
  }
  expect(Number(await audio.getAttribute('data-wp-audio-scheduled-total')) - audioBefore).toBeGreaterThanOrEqual(8)
  await test.info().attach('visible-traversal-timestamps', { body: JSON.stringify(samples), contentType: 'application/json' })
})

test('native cancellation stops traversal and releases interaction ownership', async ({ page }) => {
  await songs(page)
  const outcome = await page.evaluate(async () => {
    const context = Reflect.get(document, 'modelContext') as BrowserModelContext
    const tools = await context.getTools()
    const navigate = tools.find(tool => tool.name === 'webpod_navigate_list')
    const status = tools.find(tool => tool.name === 'webpod_list_status')
    if (navigate === undefined || status === undefined) throw new Error('Native navigation tools absent')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 750)
    let rejected = false
    const args = { direction: 'next', items: 10 }
    try { await context.executeTool(navigate, typeof navigate.inputSchema === 'string' ? JSON.stringify(args) : args, { signal: controller.signal }) }
    catch { rejected = true }
    finally { clearTimeout(timer) }
    const stopped: unknown = JSON.parse(await context.executeTool(status, typeof status.inputSchema === 'string' ? '{}' : {}))
    await new Promise(resolve => setTimeout(resolve, 550))
    const later: unknown = JSON.parse(await context.executeTool(status, typeof status.inputSchema === 'string' ? '{}' : {}))
    return { rejected, stopped, later }
  })
  expect(outcome.rejected).toBe(true)
  expect(outcome.later).toEqual(outcome.stopped)
  expect(object(object(outcome.stopped)['selectedItem'])['position']).toBeGreaterThan(0)
  expect(object(object(outcome.stopped)['selectedItem'])['position']).toBeLessThan(10)
  expect(await execute(page, 'webpod_page_state')).toMatchObject({ navigation: null })
  expect(await execute(page, 'webpod_navigate_list', { direction: 'previous', items: 1 })).toMatchObject({ completedItems: 1 })
})

test('native orientation returns physical state and document reload registers once', async ({ page }) => {
  expect(await execute(page, 'webpod_device_state')).toMatchObject({ visibleFace: 'front', isAnimating: false, isBeingHeld: false })
  await execute(page, 'webpod_rotate_ipod', { xDeg: 10, yDeg: 20 })
  expect(await readOrientation(page)).toMatchObject({ pitchDeg: 10, yawDeg: 20 })
  await execute(page, 'webpod_flick_ipod', { face: 'back' })
  expect(await execute(page, 'webpod_device_state')).toMatchObject({ visibleFace: 'back', isAnimating: false, orientation: { pitchDeg: 10, yawDeg: 180 }, stickers: { inventoryLoaded: true, placed: [{ id: 'PW-B01', placement: stickerMock(page).inventory().placements[0] }] } })
  expect(await readOrientation(page)).toMatchObject({ pitchDeg: 10, yawDeg: 180 })
  await expect(page.locator('.webpod-device-preview__stage')).not.toHaveAttribute('data-orientation-motion')
  await execute(page, 'webpod_flick_ipod', { face: 'front' })
  expect(await readOrientation(page)).toMatchObject({ pitchDeg: 10, yawDeg: 0 })
  const before = (await discover(page)).map(tool => tool.name).sort()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(async () => (await discover(page)).map(tool => tool.name).sort()).toEqual(before)
  expect(await execute(page, 'webpod_list_status')).toMatchObject({ screenId: 'S03' })
})

function stickerMock(page: Page): NativeStickerMock {
  const mock = stickerMocks.get(page)
  if (mock === undefined) throw new Error('Sticker network mock missing')
  return mock
}

async function openStickerTools(page: Page): Promise<void> {
  await expect.poll(async () => (await discover(page)).map(tool => tool.name)).toEqual(expect.arrayContaining(stickerNames))
  await execute(page, 'webpod_flick_ipod', { face: 'back' })
  await stickerReady(page)
  await execute(page, 'webpod_open_sticker_pack')
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
  await stickerReady(page)
  // Existing UI opens the newest sealed pack's genre (rock in this fixture).
  // Browse through real tools to the earned Night Shift collection.
  for (let step = 0; step < 3; step++) {
    const selected = object(object(await execute(page, 'webpod_sticker_list'))['selectedCollection'])
    if (selected['genre'] === 'metal') return
    await execute(page, 'webpod_navigate_sticker_collection', { direction: 'next' })
    await stickerReady(page)
  }
  throw new Error('Earned fixture collection could not be reached')
}

async function stickerReady(page: Page): Promise<void> {
  await expect.poll(async () => object(object(await execute(page, 'webpod_sticker_list'))['pageState'])['interactionReady'], { timeout: 30_000 }).toBe(true)
}

test('native sticker catalog includes every owned, locked, sealed and placed entry', async ({ page }) => {
  await openStickerTools(page)
  const result = object(await execute(page, 'webpod_sticker_list'))
  const entries = result['items']
  if (!Array.isArray(entries)) throw new Error('Sticker catalog missing')
  expect(result['count']).toBe(STICKER_CATALOGUE.length)
  expect(entries).toHaveLength(STICKER_CATALOGUE.length)
  expect(entries.map(entry => object(entry)['id']).sort()).toEqual(STICKER_CATALOGUE.map(entry => entry.id).sort())
  const byId = (id: string) => entries.find(entry => object(entry)['id'] === id)
  expect(byId('PW-A01')).toMatchObject({ owned: true, available: true, state: 'earned', placement: null })
  expect(byId('PW-B01')).toMatchObject({ owned: true, state: 'placed', placement: stickerMock(page).inventory().placements[0] })
  expect(byId('PW-C01')).toMatchObject({ available: false, state: 'sealed' })
  expect(byId('PW-A02')).toMatchObject({ owned: false, available: false, state: 'locked' })
  for (const stickerId of ['PW-C01', 'PW-A02']) await expect(execute(page, 'webpod_get_sticker', { stickerId, source: 'collection' })).rejects.toThrow()
  expect(stickerMock(page).packWrites()).toBe(0)
  expect(stickerMock(page).placementWrites()).toBe(0)
  expect(stickerMock(page).inventory().packs.find(pack => pack.id === 'native-sealed')?.openedAt).toBeNull()
})

test('native held placed-sticker edits release to exact origin and failed save remains retryable', async ({ page }) => {
  await openStickerTools(page)
  const mock = stickerMock(page)
  const original = mock.inventory().placements[0]
  if (original === undefined) throw new Error('Placed sticker fixture missing')
  await execute(page, 'webpod_get_sticker', { stickerId: 'PW-B01', source: 'placed' })
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
  for (const [name, args] of [
    ['webpod_rotate_sticker', { degrees: 361 }],
    ['webpod_add_sticker_wear', { amount: -1 }],
    ['webpod_add_sticker_wear', { amount: 1.1 }],
    ['webpod_place_sticker', { x: -1, y: .5 }],
    ['webpod_place_sticker', { x: .5, y: .5, extra: true }],
  ] as const) await expect(execute(page, name, args)).rejects.toThrow()
  expect(await execute(page, 'webpod_sticker_list')).toMatchObject({ held: { placement: original } })
  await execute(page, 'webpod_rotate_sticker', { degrees: 25 })
  await execute(page, 'webpod_add_sticker_wear', { amount: .2 })
  expect(mock.inventory().placements).toEqual([original])
  expect(await execute(page, 'webpod_release_sticker')).toMatchObject({ held: null })
  expect(mock.inventory().placements).toEqual([original])
  expect(mock.placementWrites()).toBe(0)
  await execute(page, 'webpod_get_sticker', { stickerId: 'PW-B01', source: 'placed' })
  expect(await execute(page, 'webpod_sticker_list')).toMatchObject({ held: { placement: original } })
  await execute(page, 'webpod_scale_sticker', { percent: 45 })
  const hud = page.locator('[data-sticker-editor]')
  await expect(hud).toBeVisible()
  await expect(hud).toHaveAttribute('data-editor-owner', 'agent')
  await expect(hud).toHaveAttribute('data-hud-mode', 'scale')
  await expect(hud).toHaveAttribute('data-hud-width', String(original.width * 1.45))
  await page.screenshot({ path: test.info().outputPath('native-sticker-scale.png') })
  await execute(page, 'webpod_rotate_sticker', { degrees: 15 })
  await expect(hud).toHaveAttribute('data-hud-mode', 'rotate')
  await execute(page, 'webpod_add_sticker_wear', { amount: .25 })
  mock.failNextPlacement()
  await expect(execute(page, 'webpod_place_sticker', { x: .55, y: .56 })).rejects.toThrow()
  expect(mock.inventory().placements).toEqual([original])
  expect(await execute(page, 'webpod_sticker_list')).toMatchObject({ held: { stickerId: 'PW-B01', source: 'placed' } })
  await execute(page, 'webpod_place_sticker', { x: .55, y: .56 })
  expect(mock.inventory().placements).toEqual([{ ...original, width: original.width * 1.45, x: .55, y: .56, rotationDeg: 20, wear: .35 }])
  await expect.poll(async () => object(await execute(page, 'webpod_sticker_list'))['held']).toBeNull()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openStickerTools(page)
  const restored = object(await execute(page, 'webpod_sticker_list'))['items']
  if (!Array.isArray(restored)) throw new Error('Restored sticker catalog missing')
  expect(restored.find(entry => object(entry)['id'] === 'PW-B01')).toMatchObject({ placement: mock.inventory().placements[0] })
})

test('human pack close and front flip interrupt native carry without persistence', async ({ page }) => {
  await openStickerTools(page)
  await execute(page, 'webpod_get_sticker', { stickerId: 'PW-A01', source: 'collection' })
  await page.getByRole('button', { name: 'Put pack away' }).click()
  expect(await execute(page, 'webpod_sticker_list')).toMatchObject({ held: null })
  await openStickerTools(page)
  await execute(page, 'webpod_get_sticker', { stickerId: 'PW-B01', source: 'placed' })
  await execute(page, 'webpod_flick_ipod', { face: 'front' })
  expect(await execute(page, 'webpod_sticker_list')).toMatchObject({ held: null })
  expect(stickerMock(page).placementWrites()).toBe(0)
})

test('native abort during persistence cannot undo an accepted server placement', async ({ page }) => {
  await openStickerTools(page)
  const mock = stickerMock(page)
  await execute(page, 'webpod_get_sticker', { stickerId: 'PW-A01', source: 'collection' })
  const release = mock.holdNextPlacement()
  const interrupted = page.evaluate(async () => {
    const context = Reflect.get(document, 'modelContext') as BrowserModelContext
    const tool = (await context.getTools()).find(entry => entry.name === 'webpod_place_sticker')
    if (tool === undefined) throw new Error('Native placement tool missing')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 500)
    try {
      await context.executeTool(tool, typeof tool.inputSchema === 'string' ? '{"x":0.5,"y":0.5}' : { x: .5, y: .5 }, { signal: controller.signal })
      return false
    } catch { return true }
    finally { clearTimeout(timer) }
  })
  try {
    await expect.poll(mock.placementWrites).toBe(1)
    expect(await interrupted).toBe(true)
    release()
    await expect.poll(() => mock.inventory().placements.some(item => item.stickerId === 'PW-A01')).toBe(true)
    await expect.poll(async () => object(await execute(page, 'webpod_sticker_list'))['held']).toBeNull()
    expect(mock.placementWrites()).toBe(1)
  } finally { release() }
})
