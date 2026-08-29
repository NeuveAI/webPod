import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidenceDirectory = resolve(
  process.env['LCD_FIDELITY_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/lcd-fidelity'),
)

test.use({
  channel: 'chrome',
  launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] },
})

async function freezeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
}

async function settleCompositePaint(page: Page): Promise<void> {
  const host = page.locator('.wp-composite-panel-host')
  await expect.poll(() => host.evaluate((element) =>
    element.parentElement instanceof HTMLCanvasElement &&
    getComputedStyle(element).transform !== 'none')).toBe(true)
  await page.evaluate(() => new Promise<void>((resolvePaint) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.wp-composite-preview__device canvas')
    if (canvas === null || !('requestPaint' in canvas)) throw new Error('T1 paint is unavailable')
    const requestPaint = Reflect.get(canvas, 'requestPaint')
    if (typeof requestPaint !== 'function') throw new Error('T1 requestPaint is not callable')
    canvas.addEventListener('paint', () => resolvePaint(), { once: true })
    Reflect.apply(requestPaint, canvas, [])
  }))
  await page.evaluate(() => new Promise<void>((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))))
}

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('LCD keeps the authored title, row, split, artwork, and icon geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/_probe/composite?colourway=black&mode=composited')
  await freezeVisuals(page)
  await settleCompositePaint(page)

  const panel = page.getByRole('application', { name: 'webPod music player' })
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
  await page.goto('/_probe/composite?colourway=black&mode=composited')
  await freezeVisuals(page)
  await settleCompositePaint(page)
  const panel = page.getByRole('application', { name: 'webPod music player' })
  await panel.focus()
  await expect(panel.getByRole('option', { selected: true })).toContainText('Albums')
  await panel.press('ArrowDown')
  await expect(panel.getByRole('option', { selected: true })).toContainText('Songs')
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
  await expect(panel.getByRole('button', { name: 'Love track' })).toHaveAttribute('aria-pressed', 'false')
})

for (const viewport of [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
] as const) {
  test(`captures the LCD presentation at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/_probe/composite?colourway=black&mode=bare')
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

    await page.goto('/_probe/composite?colourway=black&mode=composited')
    await freezeVisuals(page)
    await settleCompositePaint(page)
    await page.screenshot({
      path: resolve(evidenceDirectory, `music-menu-${viewport.name}.png`),
      fullPage: true,
    })

    const panel = page.getByRole('application', { name: 'webPod music player' })
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
