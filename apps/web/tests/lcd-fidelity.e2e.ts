import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { assertBrowserSourceIdentity } from './source-identity'

const evidenceDirectory = resolve(
  process.env['LCD_FIDELITY_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/lcd-fidelity'),
)
const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

const COMPOSITE_ROUTE =
  '/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=composited&pose=front'
const BARE_ROUTE =
  '/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=bare&pose=front'

async function gotoRoute(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.body !== null && document.querySelector('main') !== null,
  )
  await assertBrowserSourceIdentity(page)
}

async function freezeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
}

async function settleCompositePaint(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('.wp-composite-preview') !== null)
  await page.waitForFunction(() => document.querySelector('.wp-composite-preview__device canvas') !== null)
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.wp-composite-preview__device canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return false
    const state = canvas.dataset['wpCompositeSourceState']
    if (state === 'attach-error') {
      throw new Error(canvas.dataset['wpCompositeSourceError'] ?? 'Composite attach failed')
    }
    return state !== undefined
  })
  await page.locator('.wp-composite-raster-canvas').waitFor({ state: 'attached', timeout: 30_000 })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const host = document.querySelector<HTMLElement>('.wp-composite-panel-host')
        const rasterCanvas = document.querySelector<HTMLCanvasElement>('.wp-composite-raster-canvas')
        return host !== null && rasterCanvas !== null && rasterCanvas.contains(host)
      }),
    )
    .toBe(true)
  await page.evaluate(() => {
    const rasterCanvas = document.querySelector<HTMLCanvasElement>('.wp-composite-raster-canvas')
    if (rasterCanvas === null || !('requestPaint' in rasterCanvas)) throw new Error('T1 raster paint is unavailable')
    const requestPaint = Reflect.get(rasterCanvas, 'requestPaint')
    if (typeof requestPaint !== 'function') throw new Error('T1 raster requestPaint is not callable')
    Reflect.apply(requestPaint, rasterCanvas, [])
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.wp-composite-preview__device canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return false
    const state = canvas.dataset['wpCompositeSourceState']
    if (state === 'attach-error') {
      throw new Error(canvas.dataset['wpCompositeSourceError'] ?? 'Composite attach failed')
    }
    return state === 'painted'
  })
  await page.evaluate(() => new Promise<void>((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))))
}

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('LCD keeps the authored title, row, split, artwork, and icon geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoRoute(page, COMPOSITE_ROUTE)
  await freezeVisuals(page)
  await settleCompositePaint(page)

  const panel = page.getByRole('application', {
    name: 'webPod music player',
    includeHidden: true,
  })
  const geometry = await panel.evaluate((element) => {
    const rect = (selector: string) => {
      const target = element.querySelector(selector)
      if (!(target instanceof HTMLElement || target instanceof SVGElement)) throw new Error(`${selector} is absent`)
      if (target instanceof HTMLElement) return { width: target.offsetWidth, height: target.offsetHeight }
      return { width: target.width.baseVal.value, height: target.height.baseVal.value }
    }
    return {
      panel: rect('.wp-screen'),
      title: rect('.wp-titlebar'),
      row: rect('.wp-menu-row'),
      list: rect('.wp-menu-list'),
      preview: rect('.wp-menu-preview'),
      art: rect('.wp-art'),
      chevron: rect('.wp-icon--chevron'),
    }
  })
  expect(geometry.panel).toEqual({ width: 272, height: 204 })
  expect(geometry.title.height).toBe(21)
  expect(geometry.row.height).toBe(21)
  expect(geometry.list.width).toBe(168)
  expect(geometry.preview.width).toBe(104)
  expect(geometry.art).toEqual({ width: 88, height: 88 })
  expect(geometry.chevron).toEqual({ width: 12, height: 12 })
  await expect(panel.locator('.wp-menu-preview strong')).toHaveText('4 albums')
})

test('selection and Now Playing retain native hierarchy through interaction', async ({ page }) => {
  await gotoRoute(page, COMPOSITE_ROUTE)
  await freezeVisuals(page)
  await settleCompositePaint(page)
  const panel = page.getByRole('application', {
    name: 'webPod music player',
    includeHidden: true,
  })
  await panel.focus()
  await expect(panel.getByRole('option', { selected: true, includeHidden: true })).toContainText('Albums')
  await panel.press('ArrowDown')
  await expect(panel.getByRole('option', { selected: true, includeHidden: true })).toContainText('Songs')
  await panel.press('ArrowUp')
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S08')
  await panel.press('Enter')
  await expect(panel).toHaveAttribute('data-screen', 'S13')
  await expect(panel.locator('.wp-titlebar strong')).toHaveText('Now Playing')
  await expect(panel.locator('.wp-now-meta h1')).not.toBeEmpty()
  await expect(panel.locator('.wp-now-meta p')).toHaveCount(2)
  await expect(panel.locator('.wp-art--large')).toHaveCSS('width', '88px')
  await expect(panel.locator('.wp-actions .wp-icon')).toHaveCount(5)
  await expect(
    panel.getByRole('button', { name: 'Love track', includeHidden: true }),
  ).toHaveAttribute('aria-pressed', 'false')
})

for (const viewport of [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
] as const) {
  test(`captures the LCD presentation at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoRoute(page, BARE_ROUTE)
    await freezeVisuals(page)
    const barePanel = page.getByRole('application', { name: 'webPod music player' })
    await expect(barePanel).toBeVisible()
    await page.locator('.wp-composite-preview__bare-frame').screenshot({
      path: resolve(evidenceDirectory, `source-panel-${viewport.name}.png`),
    })
    await barePanel.focus()
    await barePanel.press('Enter')
    await barePanel.press('Enter')
    await expect(barePanel).toHaveAttribute('data-screen', 'S13')
    await page.locator('.wp-composite-preview__bare-frame').screenshot({
      path: resolve(evidenceDirectory, `source-now-playing-${viewport.name}.png`),
    })

    await gotoRoute(page, COMPOSITE_ROUTE)
    await freezeVisuals(page)
    await settleCompositePaint(page)
    await page.screenshot({
      path: resolve(evidenceDirectory, `music-menu-${viewport.name}.png`),
      fullPage: true,
    })

    const panel = page.getByRole('application', {
      name: 'webPod music player',
      includeHidden: true,
    })
    await panel.focus()
    await panel.press('Enter')
    await panel.press('Enter')
    await expect(panel).toHaveAttribute('data-screen', 'S13')
    await settleCompositePaint(page)
    await page.screenshot({
      path: resolve(evidenceDirectory, `now-playing-${viewport.name}.png`),
      fullPage: true,
    })
  })
}
