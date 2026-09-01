import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Page } from '@playwright/test'

const outputArgument = process.argv[2]
if (outputArgument === undefined) throw new Error('Pass an evidence output directory')
const output = resolve(outputArgument)
const baseUrl = process.env['WEBPOD_CAPTURE_BASE_URL'] ?? 'http://127.0.0.1:3000'
mkdirSync(output, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-blink-features=CanvasDrawElement'],
})

try {
  for (const deviceScaleFactor of [1, 2, 3] as const) {
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    await freezeVisuals(page)

    await page.goto(
      `${baseUrl}/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=bare&pose=front`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForFunction(() => document.body !== null && document.querySelector('main') !== null)
    const bareBytes = await page.locator('.wp-composite-preview__bare-frame').screenshot({
      path: resolve(output, `source-panel-dpr-${String(deviceScaleFactor)}.png`),
    })
    const sourceMetric = await measureBareAcuity(page, bareBytes)

    await page.goto(
      `${baseUrl}/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=composited&pose=front`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForFunction(() => document.body !== null && document.querySelector('main') !== null)
    await settleCompositePaint(page)
    const compositedBytes = await page.screenshot({
      clip: await readCompositeScreenClip(page),
      path: resolve(output, `lcd-native-dpr-${String(deviceScaleFactor)}.png`),
    })
    const compositeMetric = await measureAcuity(page, compositedBytes)
    const retentionP95 = compositeMetric.edgeP95 / Math.max(1, sourceMetric.edgeP95)
    const retentionP99 = compositeMetric.edgeP99 / Math.max(1, sourceMetric.edgeP99)

    const minimumP95 = { 1: 14, 2: 23, 3: 27 }[deviceScaleFactor]
    if (compositeMetric.edgeP95 < minimumP95) {
      throw new Error(
        `DPR ${String(deviceScaleFactor)} LCD edge acuity ${compositeMetric.edgeP95.toFixed(3)} is below ${String(minimumP95)}`,
      )
    }
    if (retentionP95 < 0.74) {
      throw new Error(
        `DPR ${String(deviceScaleFactor)} LCD edge retention ${retentionP95.toFixed(3)} is below 0.740`,
      )
    }

    process.stdout.write(
      `${JSON.stringify({
        deviceScaleFactor,
        sourceMetric,
        compositeMetric,
        retention: { edgeP95: retentionP95, edgeP99: retentionP99 },
      })}\n`,
    )
    await context.close()
  }
} finally {
  await browser.close()
}

async function freezeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
}

async function settleCompositePaint(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('.wp-composite-preview__device canvas') instanceof HTMLCanvasElement,
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
    const canvas = document.querySelector<HTMLCanvasElement>('.wp-composite-preview__device canvas')
    if (canvas === null || !('requestPaint' in canvas)) {
      throw new Error('T1 WebGL canvas cannot request an HTML paint')
    }
    const requestPaint = Reflect.get(canvas, 'requestPaint')
    if (typeof requestPaint !== 'function') {
      throw new Error('T1 WebGL canvas requestPaint member is not callable')
    }
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
    () => new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
    }),
  )
}

async function measureBareAcuity(page: Page, encoded: Buffer): Promise<AcuityMetric> {
  return measureAcuity(page, encoded)
}

type AcuityMetric = {
  readonly edgeP95: number
  readonly edgeP99: number
  readonly rowHighFrequencyMean: number
}

async function measureAcuity(
  page: Page,
  encoded: Uint8Array | readonly number[],
): Promise<AcuityMetric> {
  return page.evaluate(async ({ encodedBytes }) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(encodedBytes)]))
    const target = new OffscreenCanvas(272, 204)
    const context2d = target.getContext('2d', { willReadFrequently: true })
    if (context2d === null) throw new Error('2D acuity context unavailable')
    context2d.imageSmoothingEnabled = false
    context2d.drawImage(bitmap, 0, 0, 272, 204)
    bitmap.close()
    const { data } = context2d.getImageData(0, 0, 272, 204)
    const luminance = new Float64Array(272 * 204)
    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 4
      luminance[index] =
        (data[offset] ?? 0) * 0.2126 +
        (data[offset + 1] ?? 0) * 0.7152 +
        (data[offset + 2] ?? 0) * 0.0722
    }
    const gradients: number[] = []
    for (let y = 8; y < 196; y += 1) {
      for (let x = 8; x < 264; x += 1) {
        const here = luminance[y * 272 + x] ?? 0
        gradients.push(Math.abs(here - (luminance[y * 272 + x + 1] ?? 0)))
        gradients.push(Math.abs(here - (luminance[(y + 1) * 272 + x] ?? 0)))
      }
    }
    gradients.sort((a, b) => a - b)
    const percentile = (fraction: number): number =>
      gradients[Math.floor((gradients.length - 1) * fraction)] ?? 0
    const rows = Array.from({ length: 204 }, (_, y) => {
      let sum = 0
      for (let x = 12; x < 260; x += 1) sum += luminance[y * 272 + x] ?? 0
      return sum / 248
    })
    let periodicResidual = 0
    let periodicSamples = 0
    for (let y = 12; y < 192; y += 1) {
      const local = ((rows[y - 1] ?? 0) + (rows[y] ?? 0) + (rows[y + 1] ?? 0)) / 3
      periodicResidual += Math.abs((rows[y] ?? 0) - local)
      periodicSamples += 1
    }
    return {
      edgeP95: percentile(0.95),
      edgeP99: percentile(0.99),
      rowHighFrequencyMean: periodicResidual / periodicSamples,
    }
  }, { encodedBytes: Array.from(encoded) })
}

async function readCompositeScreenClip(page: Page): Promise<{
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
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
      x: rect.left + left,
      y: rect.top + top,
      width,
      height,
    }
  })
}
