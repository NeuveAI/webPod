import { expect, test } from '@playwright/test'
import { installDeterministicAppleMusic } from './deterministic-apple-music'
import { STICKER_GENRES } from '../../../packages/stickers/src/index'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })

for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
  test(`pack controls remain usable at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    await installDeterministicAppleMusic(page)
    await page.route('**/api/stickers**', route => route.fulfill({ json: {
      stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'],
      packs: [{ id: 'controls', source: 'starter', stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'], earnedAt: 1, openedAt: 2 }],
      placements: [], placementRevision: 0, importStatus: 'complete',
      progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
    } }))
    await page.goto('/')
    await expect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
    await page.evaluate(() => (window as typeof window & { __webpodDevicePreview?: { setPose(pose: string): void } }).__webpodDevicePreview?.setPose('rear'))
    const overlay = page.locator('[data-sticker-stage]')
    await page.getByRole('button', { name: 'Pull sticker pack into view' }).click()
    const liner = page.getByRole('button', { name: 'Pull sticker liner open' })
    await expect(liner).toBeVisible()
    await liner.click()
    await expect(overlay).toHaveAttribute('data-sticker-sheet-reveal', '1')
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Next sticker collection' }).click()
      await expect(overlay).toHaveAttribute('data-sticker-sheet-reveal', '1')
      await expect(page.locator('[data-sticker-slot]')).toHaveCount(5)
    }
    const nav = page.getByRole('navigation', { name: 'Sticker collections' })
    for (const button of await nav.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: info.outputPath('pack-open.png') })
    await liner.click()
    await expect(overlay).toHaveAttribute('data-sticker-sheet-reveal', '0')
    await page.getByRole('button', { name: 'Put pack away' }).click()
    await expect(overlay).toHaveAttribute('data-sticker-stage', 'tease')
    await page.getByRole('button', { name: 'Pull sticker pack into view' }).click()
    await liner.click()
    await expect(overlay).toHaveAttribute('data-sticker-sheet-reveal', '1')
    await page.getByRole('button', { name: 'Put pack away' }).click()
    await expect(overlay).toHaveAttribute('data-sticker-stage', 'tease')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Pull sticker pack into view' }).click()
    await liner.focus()
    await page.keyboard.press('Enter')
    await expect(overlay).toHaveAttribute('data-sticker-sheet-reveal', '1')
    await page.keyboard.press('Escape')
    await expect(overlay).toHaveAttribute('data-sticker-stage', 'tease')
  })
}
