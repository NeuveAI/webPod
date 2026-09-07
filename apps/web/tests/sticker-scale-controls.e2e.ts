import { expect, test } from '@playwright/test'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { STICKER_GENRES, type StickerInventory } from '../../../packages/stickers/src/index'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })
for (const width of [1280, 375]) test(`scale toggle switches grips and persists size at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await installDeterministicAppleMusic(page)
  let inventory: StickerInventory = {
    stickerIds: ['PW-A01'], packs: [{ id: 'scale', source: 'starter', stickerIds: ['PW-A01'], earnedAt: 1, openedAt: 2 }],
    placements: [{ stickerId: 'PW-A01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0, wear: .2 }],
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
  await page.evaluate(() => (window as typeof window & { __webpodDevicePreview?: { setPose(pose: string): void } }).__webpodDevicePreview?.setPose('rear'))
  const placed = page.locator('[data-sticker-placed="PW-A01"]')
  await placed.focus()
  await page.keyboard.press('Enter')
  const hud = page.getByRole('group', { name: 'Sticker controls', exact: true })
  await expect(hud).toHaveAttribute('data-hud-mode', 'rotate')
  const expectPaintedGrips = async () => {
    const handles = page.locator('[data-hud-handle]')
    await expect(handles).toHaveCount(4)
    for (const handle of await handles.all()) {
      // A visible button does not prove its SVG ink survived viewport clipping.
      const bounds = await handle.locator('svg').evaluate(svg => {
        const viewport = svg.getBoundingClientRect()
        const path = svg.querySelector('path:last-child')
        if (path === null) throw new Error('Handle artwork missing')
        const ink = path.getBoundingClientRect()
        return { inside: ink.left >= viewport.left - 2 && ink.right <= viewport.right + 2 && ink.top >= viewport.top - 2 && ink.bottom <= viewport.bottom + 2, width: ink.width, height: ink.height }
      })
      expect(bounds.inside).toBe(true)
      expect(bounds.width).toBeGreaterThan(5)
      expect(bounds.height).toBeGreaterThan(5)
    }
  }
  await expectPaintedGrips()
  const toggle = page.getByRole('button', { name: 'Scale sticker', exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-hud-handle="scale"]')).toHaveCount(4)
  await expect(page.locator('[data-hud-tools]')).toHaveCSS('background-color', 'rgba(185, 223, 250, 0.8)')
  await expect(page.locator('[data-hud-handle]').first().locator('.contour-grip-pulse')).toHaveCSS('animation-name', 'contour-mode-scale')
  await expectPaintedGrips()
  const grip = page.locator('[data-hud-handle="scale"]').first()
  await grip.focus()
  await page.keyboard.press('ArrowUp')
  await expect.poll(() => inventory.placements[0]?.width).toBeCloseTo(.255)
  expect(inventory.placements[0]?.rotationDeg).toBe(0)
  await page.getByRole('slider', { name: 'Sticker wear' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => inventory.placements[0]?.wear).toBeCloseTo(.205)
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(hud).toHaveAttribute('data-editor-phase', 'editing')
  // Pointer scaling shares the same save path and keeps the sticker centered.
  await grip.hover()
  const box = await grip.boundingBox()
  if (!box) throw new Error('Scale handle missing')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 14, box.y + box.height / 2 - 14, { steps: 5 })
  await page.mouse.up()
  await expect.poll(() => inventory.placements[0]?.width ?? 0).toBeGreaterThan(.255)
  expect(inventory.placements[0]?.x).toBe(.5)
  expect(inventory.placements[0]?.y).toBe(.5)
  await page.mouse.move(12, 60)
  await page.screenshot({ path: info.outputPath('scale-mode.png') })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-hud-handle="rotate"]')).toHaveCount(4)
  await expect(page.locator('[data-hud-handle]').first().locator('.contour-grip-pulse')).toHaveCSS('animation-name', 'contour-mode-rotate')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await toggle.click()
  await expect(page.locator('[data-hud-handle]').first().locator('.contour-grip-pulse')).toHaveCSS('animation-name', 'none')
  await toggle.click()
  await expectPaintedGrips()
  const savedWidth = inventory.placements[0]?.width
  await page.locator('[data-hud-handle="rotate"]').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => inventory.placements[0]?.rotationDeg).toBe(1)
  expect(inventory.placements[0]?.width).toBe(savedWidth)
})
