import { expect, test } from '@playwright/test'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { STICKER_GENRES, type StickerInventory } from '../../../packages/stickers/src/index'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })
test('placement order survives camera changes, appearance edits and reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installDeterministicAppleMusic(page)
  let inventory: StickerInventory = {
    stickerIds: ['PW-A01', 'PW-B01'], packs: [{ id: 'stack', source: 'starter', stickerIds: ['PW-A01', 'PW-B01'], earnedAt: 1, openedAt: 2 }],
    placements: [
      { stickerId: 'PW-A01', surface: 'back', x: .45, y: .5, width: .5, rotationDeg: 0, wear: 0 },
      { stickerId: 'PW-B01', surface: 'back', x: .5, y: .5, width: .75, rotationDeg: 0, wear: 0 },
    ],
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
  for (const yawDeg of [180, 150, 210]) {
    await page.evaluate(yaw => window.__webpodDevicePreview?.setOrientation({ pitchDeg: 8, yawDeg: yaw, rollDeg: 0 }), yawDeg)
    await expect(page.locator('[data-sticker-editor]')).toHaveCount(0)
    const target = page.locator('[data-sticker-placed="PW-B01"]')
    await expect(target).toBeAttached()
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing projected sticker center')
    await page.mouse.click(box.x + 22, box.y + 22)
    await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', 'PW-B01')
    await page.mouse.move(20, 60)
    await page.screenshot({ path: info.outputPath(`stack-${yawDeg}.png`) })
  }
  // Editing the lower sticker is not a new placement.
  await page.locator('[data-sticker-placed="PW-A01"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', 'PW-A01')
  await page.getByRole('slider', { name: 'Sticker wear' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => inventory.placementRevision).toBe(1)
  expect(inventory.placements.map(p => p.stickerId)).toEqual(['PW-A01', 'PW-B01'])
  await page.reload()
  await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  const box = await page.locator('[data-sticker-placed="PW-B01"]').boundingBox()
  if (!box) throw new Error('Missing restored sticker')
  await page.mouse.click(box.x + 22, box.y + 22)
  await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', 'PW-B01')
})
