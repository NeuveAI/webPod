import { writeFile } from 'node:fs/promises'
import { expect, test } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { STICKER_GENRES, type StickerInventory } from '../../../packages/stickers/src/index'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] }, viewport: { width: 1280, height: 900 } })

test('production palette laminate survives context recovery and settles at rest', async ({ page }, info) => {
  test.setTimeout(90_000)
  await installDeterministicAppleMusic(page)
  await page.addInitScript(() => {
    const counts = { draws: 0 }
    Object.assign(window, { __stickerMaterialDraws: counts })
    const original = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (...args: Parameters<typeof original>) { counts.draws++; return original.apply(this, args) }
    const originalArrays = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args: Parameters<typeof originalArrays>) { counts.draws++; return originalArrays.apply(this, args) }
  })
  const inventory: StickerInventory = {
    stickerIds: ['PW-A01', 'PW-B01', 'PW-J01'],
    packs: [{ id: 'material-starter', source: 'starter', stickerIds: ['PW-A01', 'PW-B01', 'PW-J01'], earnedAt: 1, openedAt: 2 }],
    placements: [
      { stickerId: 'PW-A01', surface: 'back', x: .34, y: .28, width: .28, rotationDeg: -8 },
      { stickerId: 'PW-B01', surface: 'back', x: .64, y: .49, width: .28, rotationDeg: 9 },
      { stickerId: 'PW-J01', surface: 'back', x: .37, y: .70, width: .30, rotationDeg: -5 },
    ], placementRevision: 0, importStatus: 'complete',
    progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
  }
  await page.route('**/api/stickers**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inventory) }))
  const loaded = new Set<string>()
  page.on('response', (response) => { if (response.url().includes('/stickers/playworn/') && response.ok()) loaded.add(response.url()) })
  // T1 describes GPU capability, not provider authorization or inventory readiness.
  const bootstrapReady = page.waitForResponse((response) => response.url().endsWith('/api/stickers/session') && response.request().method() === 'POST' && response.status() === 200, { timeout: 30_000 })
  await page.goto('/')
  const device = page.locator('.webpod-device-preview__device')
  await expect(device).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
  await bootstrapReady
  await expect.poll(() => loaded.size).toBe(3)
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  await expect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
  await page.waitForTimeout(1_500)
  await page.screenshot({ path: info.outputPath('01-dark-bright-ivory-rear-finished.png') })
  await page.evaluate("import('/src/sticker-interaction.ts').then(m => m.setStickerFinishCalibration(false))")
  await page.waitForTimeout(250)
  await page.screenshot({ path: info.outputPath('02-dark-bright-ivory-rear-base.png') })
  await page.evaluate(() => window.__webpodDevicePreview?.setOrientation({ pitchDeg: 10, yawDeg: 146, rollDeg: -2 }))
  await page.waitForTimeout(250)
  await page.screenshot({ path: info.outputPath('03-dark-bright-ivory-oblique-base.png') })
  await page.evaluate("import('/src/sticker-interaction.ts').then(m => m.setStickerFinishCalibration(true))")
  await page.waitForTimeout(250)
  await page.screenshot({ path: info.outputPath('04-dark-bright-ivory-oblique-finished.png') })
  // Draw calls observe actual GPU activity, rather than merely inspecting frameloop props.
  await page.waitForTimeout(1_000)
  const before = await page.evaluate<number>('window.__stickerMaterialDraws.draws')
  expect(before).toBeGreaterThan(0)
  await page.waitForTimeout(700)
  const after = await page.evaluate<number>('window.__stickerMaterialDraws.draws')
  expect(after).toBe(before)
  await info.attach('demand-render-rest', { body: JSON.stringify({ before, after, intervalMs: 700 }), contentType: 'application/json' })
  const lost = await device.locator('canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    Object.assign(window, { __stickerContextExtension: extension })
    extension?.loseContext()
    return extension !== null && extension !== undefined
  })
  expect(lost).toBe(true)
  await expect(device).toHaveAttribute('data-composite-tier', 'T4')
  await expect(page.getByRole('status').filter({ hasText: 'Restoring device view…' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('05-context-lost-fallback.png') })
  await page.evaluate('window.__stickerContextExtension.restoreContext()')
  await expect(device).toHaveAttribute('data-composite-tier', 'T1', { timeout: 20_000 })
  await expect(page.getByRole('status').filter({ hasText: 'Restoring device view…' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
  await page.waitForTimeout(1_000)
  await page.screenshot({ path: info.outputPath('06-context-restored.png') })
  const restoredBefore = await page.evaluate<number>('window.__stickerMaterialDraws.draws')
  await page.waitForTimeout(700)
  const restoredAfter = await page.evaluate<number>('window.__stickerMaterialDraws.draws')
  expect(restoredAfter).toBe(restoredBefore)
  await writeFile(info.outputPath('material-runtime.json'), JSON.stringify({ before, after, restoredBefore, restoredAfter, intervalMs: 700, loadedArtworkCount: loaded.size, restored: true }, null, 2))
  await info.attach('context-recovery-rest', { body: JSON.stringify({ restoredBefore, restoredAfter, intervalMs: 700, loadedArtworkCount: loaded.size }), contentType: 'application/json' })
})
