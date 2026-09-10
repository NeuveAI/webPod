import { expect, test, type Page } from '@playwright/test'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import type { StickerInventory } from '@webpod/stickers'
import { installStickerWorkerFixture, stickerWorkerCommand } from './sticker-worker-fixture'

// Exercise the native registry and real browser persistence without external eval checkouts.
test.use({ channel: 'chrome', launchOptions: { args: ['--enable-features=WebMCP', '--enable-blink-features=CanvasDrawElement'] } })
async function execute(page: Page, name: string, input: object = {}): Promise<unknown> {
  return page.evaluate(async ({ name, input }) => {
    const context = Reflect.get(document, 'modelContext') as {
      getTools(): Promise<{ name: string; inputSchema: object | string }[]>
      executeTool(tool: object, input: object | string): Promise<string>
    } | undefined
    if (!context?.getTools) throw new Error('Native WebMCP inspection unavailable')
    const tool = (await context.getTools()).find(item => item.name === name)
    if (!tool) throw new Error(`Missing native tool ${name}`)
    return JSON.parse(await context.executeTool(tool, typeof tool.inputSchema === 'string' ? JSON.stringify(input) : input)) as unknown
  }, { name, input })
}

test('native scale, rotate and wear show the held HUD and persist the resized sticker', async ({ page }, info) => {
  test.setTimeout(90000)
  const { stickerId, original } = await prepareSticker(page)
  await execute(page, 'webpod_get_sticker', { stickerId, source: 'placed' })
  await expect(page.locator('[data-sticker-collection]')).toHaveAttribute('data-sticker-pack-tucked', 'true')
  await expect.poll(async () => Number(await page.locator('[data-sticker-collection]').getAttribute('data-sticker-pack-tuck'))).toBeCloseTo(1, 3)
  await expect(page.getByRole('navigation', { name: 'Sticker collections' })).toBeHidden()
  const hud = page.locator('[data-sticker-editor]')
  await expect(hud).toBeVisible()
  const handleSpan = () => page.locator('[data-hud-handle]').evaluateAll(handles => {
    const xs = handles.map(handle => handle.getBoundingClientRect().x)
    return Math.max(...xs) - Math.min(...xs)
  })
  const originalSpan = await handleSpan()
  await execute(page, 'webpod_scale_sticker', { percent: 45 })
  await expect.poll(handleSpan).toBeGreaterThan(originalSpan * 1.2)
  await expect(hud).toHaveAttribute('data-hud-mode', 'scale')
  await expect(hud).toHaveAttribute('data-hud-width', '0.3625')
  await expect(page.locator('[data-hud-handle="scale"]')).toHaveCount(4)
  await page.screenshot({ path: info.outputPath('native-scale-hud.png') })
  await execute(page, 'webpod_rotate_sticker', { degrees: 45 })
  await expect(hud).toHaveAttribute('data-hud-mode', 'rotate')
  await execute(page, 'webpod_add_sticker_wear', { amount: .25 })
  await expect(page.locator('[aria-label="Sticker wear"]')).toHaveValue('0.35')
  expect((await stickerWorkerCommand<StickerInventory>(page, 'inventory')).placements).toEqual([original])
  await execute(page, 'webpod_place_sticker', { x: .5, y: .5 })
  await expect(hud).toHaveCount(0)
  const expected = { ...original, width: .3625, rotationDeg: 45, wear: .35 }
  expect((await stickerWorkerCommand<StickerInventory>(page, 'inventory')).placements).toEqual([expected])
  await page.reload()
  await expect(async () => {
    expect(await execute(page, 'webpod_device_state')).toMatchObject({ stickers: { placed: [{ placement: expected }] } })
  }).toPass({ timeout: 15000 })
})

async function prepareSticker(page: Page) {
  await installDeterministicAppleMusic(page)
  await installStickerWorkerFixture(page)
  await page.goto('/webpod')
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
  const earned = await stickerWorkerCommand<StickerInventory>(page, 'importTracks', [[{ catalogId: '123', genre: 'rock', durationMs: 300000 }], 'complete'])
  const pack = earned.packs[0]
  if (!pack) throw new Error('Fixture pack missing')
  const opened = await stickerWorkerCommand<StickerInventory>(page, 'openPack', [pack.id])
  const stickerId = pack.stickerIds[0]
  if (!stickerId) throw new Error('Fixture sticker missing')
  const original = { stickerId, surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0, wear: .1 }
  await stickerWorkerCommand(page, 'place', [opened.placementRevision, [original]])
  await page.reload()
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
  await expect(page.locator('[data-device-reveal]')).toHaveAttribute('data-device-reveal', 'complete', { timeout: 15000 })
  await execute(page, 'webpod_flick_ipod', { face: 'back' })
  await expect.poll(async () => execute(page, 'webpod_device_state'), { timeout: 30000 }).toMatchObject({ stickers: { pageState: { rearReady: true } } })
  await execute(page, 'webpod_open_sticker_pack')
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-progress', '1')
  await page.getByRole('button', { name: 'Pull sticker liner open', exact: true }).click()
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-sheet-reveal', '1')
  return { stickerId, original }
}

test('manual selection auto-closes smoothly and returns above the pack at phone width', async ({ page }, info) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 375, height: 900 })
  const { stickerId } = await prepareSticker(page)
  await page.evaluate(() => {
    const samples: number[] = []
    Reflect.set(window, 'packTuckSamples', samples)
    const tick = () => {
      const value = Number(document.querySelector('[data-sticker-pack-tuck]')?.getAttribute('data-sticker-pack-tuck') ?? 0)
      samples.push(value)
      if (samples.length < 180) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.locator(`[data-sticker-placed="${stickerId}"]`).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-sticker-editor]')).toBeVisible()
  await expect.poll(async () => Number(await page.locator('[data-sticker-collection]').getAttribute('data-sticker-pack-tuck'))).toBeCloseTo(1, 3)
  const samples = await page.evaluate(() => Reflect.get(window, 'packTuckSamples') as number[])
  expect(samples.filter(value => value > .01 && value < .99).length).toBeGreaterThan(3)
  await expect(page.getByRole('navigation', { name: 'Sticker collections' })).toBeHidden()
  await page.screenshot({ path: info.outputPath('manual-auto-close-phone.png') })
  await page.getByRole('button', { name: 'Return to pack', exact: true }).click()
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-sticker-stage]')
    const landing = Number(stage?.getAttribute('data-sticker-landing') ?? 0)
    return stage?.getAttribute('data-sticker-stage') === 'settling' && landing > .15 && landing < .85
  })
  await page.screenshot({ path: info.outputPath('return-above-pack-phone.png') })
  await expect(page.locator(`[data-sticker-placed="${stickerId}"]`)).toHaveCount(0)
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-peel', '0')
  expect((await stickerWorkerCommand<StickerInventory>(page, 'inventory')).placements).toEqual([])
  await page.screenshot({ path: info.outputPath('returned-to-pack-phone.png') })
  const slot = page.locator(`[data-sticker-slot="${stickerId}"]`)
  const box = await slot.boundingBox()
  if (!box) throw new Error('Returned slot missing')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(187, 300, { steps: 14 })
  await expect(page.locator('[data-sticker-collection]')).toHaveAttribute('data-sticker-pack-tucked', 'true')
  await page.mouse.up()
  await expect.poll(async () => (await stickerWorkerCommand<StickerInventory>(page, 'inventory')).placements.length).toBe(1)
})
