import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  assertBrowserSourceIdentity,
  readReviewedBrowserSource,
  type BrowserSourceHealth,
} from './source-identity'

const evidenceDirectory = resolve(
  process.env['LCD_ACUITY_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/lcd-acuity'),
)
const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const COMPOSITE_P95_MIN = {
  1: 50,
  2: 70,
  3: 80,
} as const

const COMPOSITE_P99_MIN = {
  1: 85,
  2: 130,
  3: 145,
} as const

const COMPOSITE_RETENTION_P95_MIN = {
  1: 0.38,
  2: 0.52,
  3: 0.56,
} as const

const COMPOSITE_RETENTION_P99_MIN = {
  1: 0.38,
  2: 0.52,
  3: 0.59,
} as const

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

const BARE_ROUTE =
  '/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=bare&pose=front'
const COMPOSITE_ROUTE =
  '/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=composited&pose=front'

async function gotoRoute(page: Page, url: string): Promise<BrowserSourceHealth> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.body !== null && document.querySelector('main') !== null,
  )
  return assertBrowserSourceIdentity(page)
}

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

test('LCD acuity survives DPR 1/2/3 on the real T1 HTMLTexture path', async ({ browser }) => {
  test.setTimeout(120_000)
  const reviewedSource = readReviewedBrowserSource()
  const results: DprMeasurement[] = []
  let healthAfter: BrowserSourceHealth | null = null

  for (const dpr of [1, 2, 3] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: dpr,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
    })
    try {
      const page = await context.newPage()
      await freezeVisuals(page)
      const compositeSourceDensity = dpr

      const bare = await captureBarePanel(page, dpr)
      const composite = await captureCompositePanel(page, dpr)
      healthAfter = await assertBrowserSourceIdentity(page)

      const retentionP95 = composite.edge.p95 / bare.edge.p95
      const retentionP99 = composite.edge.p99 / bare.edge.p99
      results.push({
        dpr,
        bare,
        composite,
        retentionP95,
        retentionP99,
      })

      expect(composite.edge.p95).toBeGreaterThan(COMPOSITE_P95_MIN[dpr])
      expect(composite.edge.p99).toBeGreaterThan(COMPOSITE_P99_MIN[dpr])
      expect(retentionP95).toBeGreaterThan(COMPOSITE_RETENTION_P95_MIN[dpr])
      expect(retentionP99).toBeGreaterThan(COMPOSITE_RETENTION_P99_MIN[dpr])
      expect(composite.host.pixelWidth).toBe(320 * compositeSourceDensity)
      expect(composite.host.pixelHeight).toBe(240 * compositeSourceDensity)
      expect(composite.canvas.pixelWidth).toBe(330 * dpr)
      expect(composite.canvas.pixelHeight).toBe(552 * dpr)
    } finally {
      await context.close()
    }
  }

  await writeFile(
    resolve(evidenceDirectory, 'metrics.json'),
    JSON.stringify({ reviewedSource, healthAfter, results }, null, 2),
  )
})

test('the LCD acuity gate fails closed when the composited LCD is blurred', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  })
  try {
    const page = await context.newPage()
    await freezeVisuals(page)
    await gotoRoute(page, COMPOSITE_ROUTE)
    await waitForCompositePaint(page)
    await page.addStyleTag({
      content: '.wp-composite-preview__device canvas{filter:blur(1px)!important}',
    })
    const filter = await page.locator('.wp-composite-preview__device canvas').evaluate(
      (element) => getComputedStyle(element).filter,
    )
    expect(filter).toBe('blur(1px)')
    const diagnostics = await readCompositeCanvasDiagnostics(page)
    const blur = await screenshotMetrics(
      page,
      diagnostics.clip,
      272,
      204,
      'composite-blur-dpr-2.png',
    )
    expect(blur.p95).toBeLessThan(COMPOSITE_P95_MIN[2])
    expect(blur.p99).toBeLessThan(COMPOSITE_P99_MIN[2])
  } finally {
    await context.close()
  }
})

test('the composited route remains centered when page scale changes', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  })
  try {
    const page = await context.newPage()
    await freezeVisuals(page)
    const reviewedSource = readReviewedBrowserSource()

    const composite = await captureZoomSnapshot(
      page,
      COMPOSITE_ROUTE,
      '.wp-composite-preview__device-frame',
    )
    expect(composite.visualViewportScale).toBe(1.25)
    expect(composite.overflow).toEqual({ clientWidth: 390, scrollWidth: 390 })
    expect(composite.centerOffsetPx).toBeLessThan(0.6)

    await writeFile(
      resolve(evidenceDirectory, 'zoom.json'),
      JSON.stringify({
        reviewedSource,
        healthAfter: await assertBrowserSourceIdentity(page),
        composite,
      }, null, 2),
    )
  } finally {
    await context.close()
  }
})

type EdgeMetrics = {
  readonly p95: number
  readonly p99: number
}

type ImageSample = {
  readonly edge: EdgeMetrics
  readonly file: string
}

type BareSample = ImageSample

type CompositeSample = ImageSample & {
  readonly host: {
    readonly pixelWidth: number
    readonly pixelHeight: number
    readonly rasterDensity: string | null
  }
  readonly canvas: {
    readonly pixelWidth: number
    readonly pixelHeight: number
  }
}

type DprMeasurement = {
  readonly dpr: 1 | 2 | 3
  readonly bare: BareSample
  readonly composite: CompositeSample
  readonly retentionP95: number
  readonly retentionP99: number
}

async function captureBarePanel(page: Page, dpr: 1 | 2 | 3): Promise<BareSample> {
  await gotoRoute(page, BARE_ROUTE)
  await freezeVisuals(page)
  const clip = await requireBoundingBox(page.locator('.wp-composite-preview__bare-frame'))
  return {
    edge: await screenshotMetrics(page, clip, 272, 204, `bare-dpr-${String(dpr)}.png`),
    file: `bare-dpr-${String(dpr)}.png`,
  }
}

async function captureCompositePanel(page: Page, dpr: 1 | 2 | 3): Promise<CompositeSample> {
  await gotoRoute(page, COMPOSITE_ROUTE)
  await freezeVisuals(page)
  await waitForCompositePaint(page)
  const diagnostics = await readCompositeCanvasDiagnostics(page)
  const edge = await screenshotMetrics(page, diagnostics.clip, 272, 204, `composite-dpr-${String(dpr)}.png`)
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector('.wp-composite-preview__device canvas')
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Composite canvas is missing')
    }
    return {
      host: {
        pixelWidth: Number(canvas.dataset['wpRasterPixelWidth'] ?? '0'),
        pixelHeight: Number(canvas.dataset['wpRasterPixelHeight'] ?? '0'),
        rasterDensity: canvas.dataset['wpRasterDensity'] ?? null,
      },
      canvas: {
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
      },
    }
  })
  return {
    edge,
    file: `composite-dpr-${String(dpr)}.png`,
    ...geometry,
  }
}

async function captureZoomSnapshot(
  page: Page,
  url: string,
  frameSelector: string,
): Promise<{
  readonly centerOffsetPx: number
  readonly overflow: { readonly clientWidth: number; readonly scrollWidth: number }
  readonly visualViewportScale: number | null
}> {
  await gotoRoute(page, url)
  await freezeVisuals(page)
  await waitForCompositePaint(page)
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.25 })
  await page.waitForTimeout(250)
  return page.evaluate((selector) => {
    const frame = document.querySelector(selector)
    if (!(frame instanceof HTMLElement)) throw new Error(`Missing frame ${selector}`)
    const rect = frame.getBoundingClientRect()
    const centerOffsetPx = Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2)
    return {
      centerOffsetPx,
      overflow: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
      visualViewportScale: window.visualViewport?.scale ?? null,
    }
  }, frameSelector)
}

async function freezeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
}

async function waitForCompositePaint(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('.wp-composite-preview__device canvas') instanceof HTMLCanvasElement,
    { timeout: 30_000 },
  )
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.wp-composite-preview__device canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return false
    const state = canvas.dataset['wpCompositeSourceState']
    if (state === 'attach-error') {
      throw new Error(canvas.dataset['wpCompositeSourceError'] ?? 'Composite attach failed')
    }
    return state !== undefined
  })
  await page.waitForFunction(() => {
    const host = document.querySelector<HTMLElement>('.wp-composite-panel-host')
    const canvas = document.querySelector<HTMLCanvasElement>('.wp-composite-preview__device canvas')
    return host !== null && canvas !== null && canvas.contains(host)
  })
  await page.evaluate(() => {
    const canvas = document.querySelector('.wp-composite-preview__device canvas')
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Composite WebGL canvas is missing')
    }
    const requestPaint = Reflect.get(canvas, 'requestPaint')
    if (typeof requestPaint !== 'function') throw new Error('requestPaint is unavailable')
    Reflect.apply(requestPaint, canvas, [])
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
  await page.evaluate(
    () =>
      new Promise<void>((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
      ),
  )
}

async function readCompositeCanvasDiagnostics(page: Page): Promise<{
  readonly clip: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector('.wp-composite-preview__device canvas')
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Composite canvas is missing')
    const left = Number(canvas.dataset['wpScreenClipLeft'] ?? 'NaN')
    const top = Number(canvas.dataset['wpScreenClipTop'] ?? 'NaN')
    const width = Number(canvas.dataset['wpScreenClipWidth'] ?? 'NaN')
    const height = Number(canvas.dataset['wpScreenClipHeight'] ?? 'NaN')
    if (![left, top, width, height].every(Number.isFinite)) {
      throw new Error('Composite screen diagnostics are incomplete')
    }
    const rect = canvas.getBoundingClientRect()
    return {
      clip: {
        x: rect.left + left,
        y: rect.top + top,
        width,
        height,
      },
    }
  })
}

async function requireBoundingBox(locator: ReturnType<Page['locator']>): Promise<{
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Expected a visible clip box')
  return box
}

async function screenshotMetrics(
  page: Page,
  clip: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  width: number,
  height: number,
  fileName: string,
): Promise<EdgeMetrics> {
  const png = await page.screenshot({ clip })
  await writeFile(resolve(evidenceDirectory, fileName), png)
  return page.evaluate(
    async ({ pngBase64, width, height }) => {
      const image = new Image()
      const ready = new Promise<void>((resolveImage, rejectImage) => {
        image.onload = () => resolveImage()
        image.onerror = () => rejectImage(new Error('Screenshot decode failed'))
      })
      image.src = `data:image/png;base64,${pngBase64}`
      await ready
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('Missing 2D context for acuity measurement')
      context.imageSmoothingEnabled = false
      context.drawImage(image, 0, 0, width, height)
      const { data } = context.getImageData(0, 0, width, height)
      const luminance = (offset: number): number => {
        const red = data[offset] / 255
        const green = data[offset + 1] / 255
        const blue = data[offset + 2] / 255
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const gradients: number[] = []
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = (y * width + x) * 4
          const gx = Math.abs(luminance(index + 4) - luminance(index - 4))
          const gy = Math.abs(luminance(index + width * 4) - luminance(index - width * 4))
          gradients.push(Math.sqrt(gx * gx + gy * gy) * 255)
        }
      }
      gradients.sort((left, right) => left - right)
      const percentile = (value: number): number =>
        gradients[Math.min(gradients.length - 1, Math.floor(gradients.length * value))]
      return {
        p95: percentile(0.95),
        p99: percentile(0.99),
      }
    },
    { pngBase64: png.toString('base64'), width, height },
  )
}
