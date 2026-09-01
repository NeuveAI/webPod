import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const outputArgument = process.argv[2]
if (outputArgument === undefined) throw new Error('Pass an evidence output directory')
const output = resolve(outputArgument)
const baseUrl = process.env['WEBPOD_CAPTURE_BASE_URL'] ?? 'http://127.0.0.1:3000'
const COMPOSITE_ROUTE =
  '/_probe/composite?colourway=white&state=ready&scale=1&fov=30&mode=composited&pose=front'
mkdirSync(output, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-blink-features=CanvasDrawElement'],
})

try {
  for (const deviceScaleFactor of [1, 2, 3] as const) {
    const compositeSourceDensity = deviceScaleFactor
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${baseUrl}${COMPOSITE_ROUTE}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.body !== null && document.querySelector('main') !== null)
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLCanvasElement>('.wp-composite-preview__device canvas')?.dataset['wpRasterDensity'] ===
        String(compositeSourceDensity),
      compositeSourceDensity,
    )
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.wp-composite-preview__device canvas')
      if (!(canvas instanceof HTMLCanvasElement)) return false
      const state = canvas.dataset['wpCompositeSourceState']
      if (state === 'attach-error') {
        throw new Error(canvas.dataset['wpCompositeSourceError'] ?? 'Composite attach failed')
      }
      return state === 'painted'
    })
    await page.waitForTimeout(250)

    const metrics = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-composite-tier='T1']")
      const canvas = document.querySelector<HTMLCanvasElement>('.wp-composite-preview__device canvas')
      if (root === null || canvas === null) {
        throw new Error('Composite texture diagnostics are missing')
      }
      const bounds = root.getBoundingClientRect()
      return {
        devicePixelRatio: window.devicePixelRatio,
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        root: { x: bounds.x, width: bounds.width },
        webgl: {
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
          width: canvas.width,
          height: canvas.height,
        },
        host: {
          density: Number(canvas.dataset['wpRasterDensity'] ?? '0'),
          pixelWidth: Number(canvas.dataset['wpRasterPixelWidth'] ?? '0'),
          pixelHeight: Number(canvas.dataset['wpRasterPixelHeight'] ?? '0'),
        },
      }
    })

    const expectedWidth = Math.round(metrics.webgl.cssWidth * deviceScaleFactor)
    const expectedHeight = Math.round(metrics.webgl.cssHeight * deviceScaleFactor)
    if (metrics.webgl.width !== expectedWidth || metrics.webgl.height !== expectedHeight) {
      throw new Error(`DPR ${String(deviceScaleFactor)} backing store mismatch: ${JSON.stringify(metrics.webgl)}`)
    }
    if (
      metrics.host.density !== compositeSourceDensity ||
      metrics.host.pixelWidth !== 320 * compositeSourceDensity ||
      metrics.host.pixelHeight !== 240 * compositeSourceDensity
    ) {
      throw new Error(`DPR ${String(deviceScaleFactor)} host raster mismatch: ${JSON.stringify(metrics.host)}`)
    }
    if (metrics.scrollWidth !== metrics.viewportWidth) {
      throw new Error(`DPR ${String(deviceScaleFactor)} overflowed horizontally: ${JSON.stringify(metrics)}`)
    }
    const left = metrics.root.x
    const right = metrics.viewportWidth - metrics.root.x - metrics.root.width
    if (Math.abs(left - right) > 1) {
      throw new Error(`DPR ${String(deviceScaleFactor)} composite is not centered: ${JSON.stringify(metrics.root)}`)
    }
    if (errors.length > 0) throw new Error(`DPR ${String(deviceScaleFactor)} page errors: ${errors.join(' | ')}`)

    await page.screenshot({
      path: resolve(output, `white-mobile-dpr-${String(deviceScaleFactor)}.png`),
      fullPage: false,
    })
    process.stdout.write(`${JSON.stringify({ deviceScaleFactor, metrics })}\n`)
    await context.close()
  }
} finally {
  await browser.close()
}
