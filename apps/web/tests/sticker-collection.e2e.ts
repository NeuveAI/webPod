import { expect, test } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { STICKER_GENRES, type StickerInventory } from '../../../packages/stickers/src/index'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] }, viewport: { width: 1280, height: 900 } })

test('production rear pack opens, sticks, removes and survives reload through server inventory', async ({ page }, info) => {
  test.setTimeout(90_000)
  await installDeterministicAppleMusic(page)
  let artworkRequests = 0
  await page.route('**/stickers/playworn/metal/pw-a01-night-shift.png', async (route) => { artworkRequests += 1; if (artworkRequests === 1) await route.fulfill({ status: 503, body: '' }); else await route.continue() })
  let inventory: StickerInventory = { stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'], packs: [{ id: 'test-starter', source: 'starter', stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'], earnedAt: 1, openedAt: null }], placements: [], placementRevision: 0, importStatus: 'complete', progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })) }
  await page.route('**/api/stickers**', async (route) => {
    const request = route.request()
    if (request.url().endsWith('/packs/open')) inventory = { ...inventory, packs: inventory.packs.map((pack) => ({ ...pack, openedAt: 2 })) }
    if (request.url().endsWith('/placements')) { const body = request.postDataJSON() as { revision: number; placements: StickerInventory['placements'] }; expect(body.revision).toBe(inventory.placementRevision); inventory = { ...inventory, placements: body.placements, placementRevision: inventory.placementRevision + 1 } }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inventory) })
  })
  await page.goto('/')
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
  await page.evaluate(() => { const preview = (window as typeof window & { __webpodDevicePreview?: { setPose(pose: string): void } }).__webpodDevicePreview; preview?.setPose('rear') })
  const lip = page.getByRole('button', { name: 'Pull sticker pack into view' })
  await expect(lip).toBeVisible()
  await page.screenshot({ path: info.outputPath('01-rear-tease.png') })
  await lip.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Open earned pack' }).click()
  await page.getByRole('button', { name: 'Retry artwork' }).click()
  await expect(page.getByRole('button', { name: 'Retry artwork' })).toHaveCount(0)
  expect(artworkRequests).toBe(2)
  await expect(page.getByRole('button', { name: 'Stick Night Shift', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('02-pack-open.png') })
  const peel = page.getByRole('button', { name: /^Peel Night Shift/ })
  const peelBounds = await peel.boundingBox()
  if (peelBounds === null) throw new Error('Peel handle missing')
  await page.mouse.move(peelBounds.x + peelBounds.width / 2, peelBounds.y + peelBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(peelBounds.x + peelBounds.width / 2, peelBounds.y + peelBounds.height / 2 - 45, { steps: 5 })
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.screenshot({ path: info.outputPath('02b-partial-peel.png') })
  await peel.dispatchEvent('pointercancel', { pointerId: 1 })
  await page.mouse.up()
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
  await page.mouse.move(peelBounds.x + peelBounds.width / 2, peelBounds.y + peelBounds.height / 2)
  await page.mouse.down(); await page.mouse.move(640, 450, { steps: 12 })
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
  await page.mouse.up()
  await expect.poll(() => inventory.placements.length).toBe(1)
  await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
  await page.getByRole('button', { name: 'Stick Night Shift', exact: true }).click()
  await expect.poll(() => inventory.placements.length).toBe(1)
  await page.getByRole('button', { name: 'Put pack away' }).click()
  await page.screenshot({ path: info.outputPath('03-stuck.png') })
  await page.evaluate("import('/src/sticker-interaction.ts').then(m => m.setStickerFinishCalibration(false))")
  await page.screenshot({ path: info.outputPath('03b-flat-comparison.png') })
  await page.evaluate("import('/src/sticker-interaction.ts').then(m => m.setStickerFinishCalibration(true))")
  await page.reload()
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
  await page.evaluate(() => (window as typeof window & { __webpodDevicePreview?: { setPose(pose: string): void } }).__webpodDevicePreview?.setPose('rear'))
  await lip.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Night Shift', exact: true }).click()
  await expect.poll(() => inventory.placements.length).toBe(0)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await lip.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
  await peel.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter')
  await expect.poll(() => inventory.placements.length).toBe(1)
  expect(inventory.placements[0]?.x).toBeCloseTo(0.46)
  await page.screenshot({ path: info.outputPath('04-mobile-reduced-motion.png') })
  await page.keyboard.press('Escape')
  await expect(lip).toBeFocused()
})

test('new selection owns delayed saves and cancellation stops every gesture channel', async ({ page }) => {
  test.setTimeout(90_000)
  await installDeterministicAppleMusic(page)
  let inventory: StickerInventory = { stickerIds: ['PW-A01', 'PW-B01'], packs: [{ id: 'test-open', source: 'starter', stickerIds: ['PW-A01', 'PW-B01'], earnedAt: 1, openedAt: 2 }], placements: [], placementRevision: 0, importStatus: 'complete', progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })) }
  let releaseSave: () => void = () => { throw new Error('Save was not intercepted') }
  let savePending = false
  let failSave = false
  await page.route('**/api/stickers**', async (route) => {
    if (route.request().url().endsWith('/placements')) {
      const body = route.request().postDataJSON() as { revision: number; placements: StickerInventory['placements'] }
      savePending = true
      await new Promise<void>((resolve) => { releaseSave = resolve })
      savePending = false
      if (failSave) { await route.fulfill({ status: 500, body: '{}' }); return }
      inventory = { ...inventory, placements: body.placements, placementRevision: inventory.placementRevision + 1 }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inventory) })
  })
  await page.goto('/')
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
  await page.evaluate(() => (window as typeof window & { __webpodDevicePreview?: { setPose(pose: string): void } }).__webpodDevicePreview?.setPose('rear'))
  const lip = page.getByRole('button', { name: 'Pull sticker pack into view' })
  const overlay = page.locator('[data-sticker-stage]')
  await lip.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
  await page.getByRole('button', { name: 'Stick Night Shift', exact: true }).click()
  await expect.poll(() => savePending).toBe(true)
  await page.getByRole('button', { name: 'On Repeat', exact: true }).click()
  releaseSave()
  await expect.poll(() => inventory.placements.length).toBe(1)
  await expect(page.getByRole('button', { name: 'On Repeat', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Peel On Repeat/ })).toBeVisible()
  failSave = true
  await page.getByRole('button', { name: 'Stick On Repeat', exact: true }).click()
  await expect.poll(() => savePending).toBe(true)
  await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
  releaseSave()
  await expect.poll(() => savePending).toBe(false)
  await expect(page.getByRole('button', { name: 'Night Shift', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Your collection could not save. Try again.')).toHaveCount(0)
  failSave = false
  for (const intent of ['keyboard', 'pointer'] as const) {
    await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
    await page.getByRole('button', { name: 'Stick Night Shift', exact: true }).click()
    await expect.poll(() => savePending).toBe(true)
    const activePeel = page.getByRole('button', { name: /^Peel Night Shift/ })
    if (intent === 'keyboard') { await activePeel.focus(); await page.keyboard.press('ArrowLeft') }
    else {
      const bounds = await activePeel.boundingBox()
      if (bounds === null) throw new Error('Peel target missing')
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 - 24)
    }
    releaseSave()
    await expect.poll(() => savePending).toBe(false)
    await expect(overlay).toHaveAttribute('data-sticker-stage', intent === 'keyboard' ? 'placing' : 'peeling')
    await expect(activePeel).toBeVisible()
    if (intent === 'pointer') { await activePeel.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up() }
  }
  await page.getByRole('button', { name: 'Put pack away' }).click()
  const box = await lip.boundingBox()
  if (box === null) throw new Error('Pack lip missing')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 4 })
  await expect(overlay).toHaveAttribute('data-sticker-stage', 'pulling')
  await lip.dispatchEvent('pointercancel', { pointerId: 1 })
  await page.mouse.up()
  await expect(overlay).toHaveAttribute('data-sticker-stage', 'tease')
  await expect(overlay).toHaveAttribute('data-sticker-progress', '0')
  await lip.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Night Shift', exact: true }).click()
  const peel = page.getByRole('button', { name: /^Peel Night Shift/ })
  const peelBox = await peel.boundingBox()
  if (peelBox === null) throw new Error('Peel handle missing')
  await page.mouse.move(peelBox.x + peelBox.width / 2, peelBox.y + peelBox.height / 2)
  await page.mouse.down(); await page.mouse.move(640, 450, { steps: 10 })
  await expect(overlay).toHaveAttribute('data-sticker-stage', 'placing')
  await peel.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up()
  await expect(overlay).toHaveAttribute('data-sticker-stage', 'open')
  await expect(overlay).toHaveAttribute('data-sticker-landing', '0')
  await page.mouse.move(peelBox.x + peelBox.width / 2, peelBox.y + peelBox.height / 2)
  await page.mouse.down(); await page.mouse.move(peelBox.x + peelBox.width / 2, peelBox.y + 10)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(overlay).toHaveAttribute('data-sticker-stage', 'tease')
  await page.mouse.move(640, 450); await page.mouse.up()
  await expect(overlay).toHaveAttribute('data-sticker-stage', 'tease')
  await expect(overlay).toHaveAttribute('data-sticker-progress', '0')
  await expect(overlay).toHaveAttribute('data-sticker-landing', '0')
})
