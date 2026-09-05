import { expect, test, type Locator, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidenceDirectory = resolve(
  process.env['D6_EVIDENCE_DIR'] ?? resolve(import.meta.dirname, 'test-results/d6-playback-error'),
)
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

test.use({ launchOptions: { executablePath: CHROME_EXECUTABLE } })

async function openFailedNowPlaying(page: Page, scale: 1 | 2): Promise<readonly [Locator, Locator]> {
  await page.goto(`/?scale=${String(scale)}`, { waitUntil: 'domcontentloaded' })
  const panels = page.locator('.wp-panel')
  const dark = panels.nth(0)
  const light = panels.nth(1)
  await expect(dark).toHaveAttribute('data-screen', 'S03')
  await dark.focus()
  await dark.press('Enter')
  await expect(dark).toHaveAttribute('data-screen', 'S08')
  await expect.poll(async () => {
    const screen = await dark.getAttribute('data-screen')
    if (screen === 'S08') await dark.press('Enter')
    return dark.getAttribute('data-screen')
  }).toBe('S13')
  await expect(light).toHaveAttribute('data-screen', 'S13')
  await page.evaluate(() => {
    const next = new URL(window.location.href)
    next.searchParams.set('state', 'error')
    window.history.pushState({}, '', next)
  })
  await expect(dark).toHaveAttribute('data-state', 'error')
  await expect(light).toHaveAttribute('data-state', 'error')
  return [dark, light]
}

async function assertStatusGeometry(panel: Locator): Promise<void> {
  await expect(panel.locator('.wp-now-alert')).toHaveText('Playback unavailable')
  await expect(panel.locator('.wp-status-shelf')).toHaveCount(0)
  await expect(panel.locator('.wp-actions')).toHaveCount(0)
  await expect(panel.locator('.wp-now-meta h1')).not.toBeEmpty()
  await expect(panel.locator('.wp-now-meta p')).toHaveCount(2)
  await expect(panel.locator('.wp-art--large')).toBeVisible()
  await expect(panel.locator('.wp-progress')).toBeVisible()
  await expect(panel.locator('.wp-times')).toHaveCount(0)

  const geometry = await panel.evaluate((root) => {
    const selectors = ['.wp-art--large', '.wp-now-meta', '.wp-progress', '.wp-now-alert'] as const
    type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; readonly width: number; readonly height: number }
    const rects = Object.fromEntries(selectors.map((selector) => {
      const element = root.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`${selector} is absent`)
      const rect = element.getBoundingClientRect()
      return [selector, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }]
    })) as Record<(typeof selectors)[number], Rect>
    const intersects = (first: Rect, second: Rect) =>
      first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
    const status = rects['.wp-now-alert']
    const alert = root.querySelector<HTMLElement>('.wp-now-alert')
    if (alert === null) throw new Error('.wp-now-alert is absent')
    return {
      offset: { width: root.offsetWidth, height: root.offsetHeight },
      rects,
      intersections: selectors.filter((selector) => selector !== '.wp-now-alert').filter((selector) => intersects(status, rects[selector])),
      statusOverflow: {
        inline: alert.scrollWidth - alert.clientWidth,
        block: alert.scrollHeight - alert.clientHeight,
      },
    }
  })

  expect(geometry.offset).toEqual({ width: 272, height: 204 })
  expect(geometry.intersections).toEqual([])
  expect(geometry.statusOverflow.inline).toBeLessThanOrEqual(0)
  expect(geometry.statusOverflow.block).toBeLessThanOrEqual(0)
}

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('failed playback owns one collision-free text line in both colourways', async ({ page }) => {
  const [dark, light] = await openFailedNowPlaying(page, 1)
  await assertStatusGeometry(dark)
  await assertStatusGeometry(light)
  await dark.screenshot({ path: resolve(evidenceDirectory, 'd6-error-dark-272x204.png') })
  await light.screenshot({ path: resolve(evidenceDirectory, 'd6-error-light-272x204.png') })
})

test('failed playback stays collision-free at the product 200% Dynamic Type setting', async ({ page }) => {
  const [dark, light] = await openFailedNowPlaying(page, 2)
  for (const panel of [dark, light]) {
    await expect(panel).toHaveAttribute('data-density', 'airy')
    expect(await panel.locator('..').evaluate((stage) => Number(getComputedStyle(stage).getPropertyValue('--wp-raster-scale')))).toBe(1.25)
    await assertStatusGeometry(panel)
  }
  await dark.screenshot({ path: resolve(evidenceDirectory, 'd6-error-dark-200-percent.png') })
  await light.screenshot({ path: resolve(evidenceDirectory, 'd6-error-light-200-percent.png') })
})

test('Apple runtime failure offers direct retry without a demo fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let tokenRequests = 0
  await page.route('**/api/apple/developer-token', async (route) => {
    tokenRequests += 1
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store, private' },
      body: JSON.stringify({ error: { code: 'signing_failed', message: 'Apple Music token service failed' } }),
    })
  })
  await page.goto('/_spike/device', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const retry = page.getByRole('button', { name: 'Retry Apple Music' })
  await expect(retry).toBeVisible()
  expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(tokenRequests).toBe(1)
  await expect(page.getByRole('button', { name: 'Use demo library' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign in to Apple Music' })).toHaveCount(0)
  await retry.click()
  await expect.poll(() => tokenRequests).toBe(2)
  await expect(retry).toBeVisible()
  await page.locator('.webpod-device-preview__controls').screenshot({
    path: resolve(evidenceDirectory, 'd6-apple-error-retry.png'),
  })
})
