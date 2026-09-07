import { expect, test } from '@playwright/test'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { STICKER_GENRES, type StickerInventory } from '../../../packages/stickers/src/index'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })
test('large sticker scales past the old cap and drops beside the shell', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installDeterministicAppleMusic(page)
  let inventory: StickerInventory = {
    stickerIds: ['PW-C01'], packs: [{ id: 'large', source: 'starter', stickerIds: ['PW-C01'], earnedAt: 1, openedAt: 2 }],
    placements: [{ stickerId: 'PW-C01', surface: 'back', x: .4, y: .35, width: .9, rotationDeg: 0, wear: .2 }],
    placementRevision: 0, importStatus: 'complete',
    progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
  }
  await page.route('**/api/stickers**', async route => {
    if (route.request().url().endsWith('/placements')) {
      const body = route.request().postDataJSON() as { placements: StickerInventory['placements'] }
      inventory = { ...inventory, placements: body.placements, placementRevision: inventory.placementRevision + 1 }
    }
    await route.fulfill({ json: inventory })
  })
  await page.goto('/')
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  const placed = page.locator('[data-sticker-placed="PW-C01"]')
  await placed.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Scale sticker', exact: true }).click()
  const grip = page.locator('[data-hud-handle="scale"]').first()
  await grip.hover()
  const box = await grip.boundingBox()
  if (!box) throw new Error('Missing grip')
  await page.mouse.move(box.x + 22, box.y + 22); await page.mouse.down()
  await page.mouse.move(box.x - 140, box.y - 140, { steps: 16 })
  await expect(page.getByRole('tooltip')).toHaveText('Maximum sticker size reached.')
  const maximum = Number(await page.locator('[data-sticker-editor]').getAttribute('data-hud-width'))
  expect(maximum).toBeGreaterThan(1)
  await page.mouse.move(box.x - 180, box.y - 180, { steps: 8 })
  expect(Number(await page.locator('[data-sticker-editor]').getAttribute('data-hud-width'))).toBeCloseTo(maximum, 5)
  expect(inventory.placementRevision).toBe(0)
  // Reverse without releasing: the same gesture can shrink away from the cap.
  await page.mouse.move(box.x + 22, box.y + 22, { steps: 12 })
  await expect.poll(async () => Number(await page.locator('[data-sticker-editor]').getAttribute('data-hud-width'))).toBeLessThan(maximum)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.mouse.move(box.x - 180, box.y - 180, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => inventory.placements[0]?.width ?? 0).toBeGreaterThan(1)
  await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase', 'editing')
  await page.mouse.move(20, 60)
  await page.screenshot({ path: info.outputPath('large-rear.png') })
  await page.evaluate(() => window.__webpodDevicePreview?.setOrientation({ pitchDeg: 8, yawDeg: 120, rollDeg: 0 }))
  await expect(page.locator('[data-sticker-editor]')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('large-two-edges.png') })
  await page.mouse.move(635, 450); await page.mouse.down()
  await page.mouse.move(850, 340, { steps: 16 })
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
  await page.screenshot({ path: info.outputPath('side-carry.png') })
  await page.keyboard.press('Escape'); await page.mouse.up()
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  // The painted center of this artwork is inside the actual amp design.
  const center = await placed.boundingBox()
  if (!center) throw new Error('Missing sticker')
  const revision = inventory.placementRevision
  await page.mouse.move(center.x + 22, center.y + 22)
  await page.mouse.down()
  const packProgress = await page.locator('[data-sticker-stage]').getAttribute('data-sticker-progress')
  const sheetReveal = await page.locator('[data-sticker-stage]').getAttribute('data-sticker-sheet-reveal')
  await page.mouse.move(1100, 800, { steps: 20 })
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-progress', packProgress ?? '0')
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-sheet-reveal', sheetReveal ?? '0')
  const contacts = JSON.parse(await page.locator('canvas').getAttribute('data-wp-sticker-peel-contacts') ?? '{}') as { queries: number }
  expect(contacts.queries).toBe(0)
  await page.mouse.move(1200, 220, { steps: 20 })
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
  await page.screenshot({ path: info.outputPath('off-device-carry.png') })
  await page.mouse.up()
  await expect.poll(() => inventory.placementRevision).toBeGreaterThan(revision)
  expect(inventory.placements[0]?.width).toBeGreaterThan(1)
  await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
  await page.screenshot({ path: info.outputPath('nearest-drop.png') })
})
