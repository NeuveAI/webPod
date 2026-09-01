import {
  expect,
  test,
  type Page,
} from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  DEFAULT_LIGHT_RIG,
  areaLightIntensity,
  keyDescentAngleDeg,
  keyLightPosition,
  keyLightPower,
  kickLightPosition,
  kickLightPower,
  viewerAzimuthAngleDeg,
} from '@webpod/device'

import {
  assertBrowserSourceIdentity,
  readReviewedBrowserSource,
} from './source-identity'

const evidenceDirectory = resolve(
  process.env['PRODUCT_LIGHTING_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/product-lighting'),
)
const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

type LightingPass = 'combined' | 'key-only' | 'fill-only' | 'neutral'
type Colourway = 'black' | 'white'
type Pose = 'front' | 'three-quarter' | 'right-edge'
type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type Region = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type RegionMetrics = {
  readonly mean: number
  readonly p50: number
  readonly p90: number
  readonly p95: number
  readonly p99: number
  readonly max: number
  readonly maxAdjacentRowDelta: number
}

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
  viewport: { width: 1024, height: 768 },
})

test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }))

function proofRoute(
  pass: LightingPass,
  colourway: Colourway,
  pose: Pose,
): string {
  const diagnostic = pass === 'neutral' ? 'neutral' : 'production-surface'
  const params = new URLSearchParams({
    diagnostic,
    view: pose,
    colourway,
  })
  params.set('capture', '')
  if (pass !== 'neutral') params.set('lighting', pass)
  return `/_spike/device?${params.toString()}`
}

async function prepareProof(
  page: Page,
  pass: LightingPass,
  colourway: Colourway,
  pose: Pose,
): Promise<Box> {
  await page.goto(proofRoute(pass, colourway, pose), {
    waitUntil: 'domcontentloaded',
  })
  const root = page.locator('.webpod-device-preview')
  const canvas = root.locator('canvas')
  await canvas.waitFor({ state: 'visible' })
  await expect(root).toHaveAttribute('data-lighting-pass', pass)
  await expect(root).toHaveAttribute('data-colourway', colourway)
  await expect(root).toHaveAttribute('data-evidence-view', pose)
  await expect.poll(
    () => canvas.getAttribute('data-wp-camera-fit-distance'),
  ).not.toBeNull()
  await page.waitForTimeout(120)
  return projectedModelBox(page)
}

async function projectedModelBox(page: Page): Promise<Box> {
  return page.locator('.webpod-device-preview canvas').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect()
    const extentX = Number(canvas.getAttribute('data-wp-projected-extent-x'))
    const extentY = Number(canvas.getAttribute('data-wp-projected-extent-y'))
    if (![extentX, extentY].every(Number.isFinite)) {
      throw new Error('projected model diagnostics are incomplete')
    }
    return {
      x: rect.left + rect.width * (1 - extentX) / 2,
      y: rect.top + rect.height * (1 - extentY) / 2,
      width: rect.width * extentX,
      height: rect.height * extentY,
    }
  })
}

async function capture(page: Page, filename: string): Promise<Buffer> {
  const bytes = await page.screenshot()
  await writeFile(resolve(evidenceDirectory, filename), bytes)
  return bytes
}

async function screenshotRegions(
  page: Page,
  png: Buffer,
  model: Box,
  regions: Readonly<Record<string, Region>>,
): Promise<Record<string, RegionMetrics>> {
  return page.evaluate(
    async ({ pngBase64, model, regions }) => {
      const image = new Image()
      const ready = new Promise<void>((resolveImage, rejectImage) => {
        image.onload = () => resolveImage()
        image.onerror = () => rejectImage(new Error('lighting screenshot decode failed'))
      })
      image.src = `data:image/png;base64,${pngBase64}`
      await ready
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('lighting metrics require a 2D context')
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const lumaAt = (x: number, y: number): number => {
        const offset = (y * canvas.width + x) * 4
        return 0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]
      }
      const percentile = (values: readonly number[], ratio: number): number =>
        values[Math.min(values.length - 1, Math.floor(values.length * ratio))]
      const result: Record<string, RegionMetrics> = {}
      for (const [name, region] of Object.entries(regions)) {
        const left = Math.max(0, Math.floor(model.x + region.x * model.width))
        const top = Math.max(0, Math.floor(model.y + region.y * model.height))
        const right = Math.min(canvas.width, Math.ceil(model.x + (region.x + region.width) * model.width))
        const bottom = Math.min(canvas.height, Math.ceil(model.y + (region.y + region.height) * model.height))
        const values: number[] = []
        const rowMeans: number[] = []
        for (let y = top; y < bottom; y += 1) {
          let rowSum = 0
          for (let x = left; x < right; x += 1) {
            const value = lumaAt(x, y)
            values.push(value)
            rowSum += value
          }
          rowMeans.push(rowSum / Math.max(1, right - left))
        }
        values.sort((leftValue, rightValue) => leftValue - rightValue)
        let maxAdjacentRowDelta = 0
        for (let index = 1; index < rowMeans.length; index += 1) {
          maxAdjacentRowDelta = Math.max(
            maxAdjacentRowDelta,
            Math.abs(rowMeans[index] - rowMeans[index - 1]),
          )
        }
        result[name] = {
          mean: values.reduce((sum, value) => sum + value, 0) / values.length,
          p50: percentile(values, 0.5),
          p90: percentile(values, 0.9),
          p95: percentile(values, 0.95),
          p99: percentile(values, 0.99),
          max: values[values.length - 1],
          maxAdjacentRowDelta,
        }
      }
      return result
    },
    { pngBase64: png.toString('base64'), model, regions },
  )
}

async function screenshotDifference(
  page: Page,
  leftPng: Buffer,
  rightPng: Buffer,
  model: Box,
  region: Region,
): Promise<{ readonly mean: number; readonly p95: number }> {
  return page.evaluate(
    async ({ leftBase64, rightBase64, model, region }) => {
      const decode = async (base64: string): Promise<ImageData> => {
        const image = new Image()
        const ready = new Promise<void>((resolveImage, rejectImage) => {
          image.onload = () => resolveImage()
          image.onerror = () => rejectImage(new Error('lighting comparison decode failed'))
        })
        image.src = `data:image/png;base64,${base64}`
        await ready
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        if (context === null) throw new Error('lighting comparison requires a 2D context')
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, canvas.width, canvas.height)
      }
      const [left, right] = await Promise.all([decode(leftBase64), decode(rightBase64)])
      if (left.width !== right.width || left.height !== right.height) {
        throw new Error('lighting comparison images have different dimensions')
      }
      const x0 = Math.floor(model.x + region.x * model.width)
      const y0 = Math.floor(model.y + region.y * model.height)
      const x1 = Math.ceil(model.x + (region.x + region.width) * model.width)
      const y1 = Math.ceil(model.y + (region.y + region.height) * model.height)
      const differences: number[] = []
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * left.width + x) * 4
          const luma = (data: Uint8ClampedArray): number =>
            0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]
          differences.push(Math.abs(luma(left.data) - luma(right.data)))
        }
      }
      differences.sort((a, b) => a - b)
      return {
        mean: differences.reduce((sum, value) => sum + value, 0) / differences.length,
        p95: differences[Math.floor(differences.length * 0.95)],
      }
    },
    {
      leftBase64: leftPng.toString('base64'),
      rightBase64: rightPng.toString('base64'),
      model,
      region,
    },
  )
}

test('two-light product rig has isolated proof, broad lower fill, and stable framing', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const reviewedSource = readReviewedBrowserSource()
  const captures: Array<Record<string, unknown>> = []
  const images = new Map<string, Buffer>()
  const boxes = new Map<string, Box>()

  for (const pass of ['combined', 'key-only', 'fill-only', 'neutral'] as const) {
    for (const colourway of ['black', 'white'] as const) {
      for (const pose of ['front', 'three-quarter', 'right-edge'] as const) {
        const box = await prepareProof(page, pass, colourway, pose)
        const key = `${pass}-${colourway}-${pose}`
        const filename = `${key}.png`
        const png = await capture(page, filename)
        images.set(key, png)
        boxes.set(key, box)
        captures.push({ pass, colourway, pose, filename, box })
      }
    }
  }

  const fillWhiteKey = 'fill-only-white-front'
  const combinedWhiteKey = 'combined-white-front'
  const keyWhiteKey = 'key-only-white-front'
  const fillWhite = images.get(fillWhiteKey)
  const combinedWhite = images.get(combinedWhiteKey)
  const keyWhite = images.get(keyWhiteKey)
  const frontBox = boxes.get(fillWhiteKey)
  if (
    fillWhite === undefined ||
    combinedWhite === undefined ||
    keyWhite === undefined ||
    frontBox === undefined
  ) {
    throw new Error('required lighting proof captures are absent')
  }

  const fillMetrics = await screenshotRegions(page, fillWhite, frontBox, {
    lowerAssembly: { x: 0.08, y: 0.48, width: 0.84, height: 0.43 },
    wheel: { x: 0.2, y: 0.52, width: 0.6, height: 0.32 },
    lowerLeftShell: { x: 0.07, y: 0.57, width: 0.12, height: 0.28 },
    bottomShell: { x: 0.12, y: 0.87, width: 0.76, height: 0.06 },
  })
  const lowerContribution = await screenshotDifference(
    page,
    combinedWhite,
    keyWhite,
    frontBox,
    { x: 0.08, y: 0.48, width: 0.84, height: 0.43 },
  )
  const upperContribution = await screenshotDifference(
    page,
    combinedWhite,
    keyWhite,
    frontBox,
    { x: 0.08, y: 0.05, width: 0.84, height: 0.32 },
  )

  expect(fillMetrics.lowerAssembly.p50).toBeGreaterThan(50)
  expect(fillMetrics.wheel.p50).toBeGreaterThan(50)
  expect(fillMetrics.bottomShell.p50).toBeGreaterThan(50)
  expect(fillMetrics.lowerLeftShell.p99 - fillMetrics.lowerLeftShell.p50).toBeLessThan(15)
  expect(fillMetrics.lowerLeftShell.maxAdjacentRowDelta).toBeLessThan(2)
  expect(lowerContribution.mean).toBeGreaterThan(6)
  expect(lowerContribution.p95).toBeGreaterThan(10)
  expect(lowerContribution.mean).toBeGreaterThan(upperContribution.mean * 4)

  await page.setViewportSize({ width: 375, height: 812 })
  const mobileBox = await prepareProof(page, 'combined', 'black', 'three-quarter')
  const mobileDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(mobileDimensions.scrollWidth).toBe(mobileDimensions.clientWidth)
  const mobileCanvas = page.locator('.webpod-device-preview canvas')
  const mobileFit = await mobileCanvas.evaluate((canvas) => ({
    extentX: Number(canvas.getAttribute('data-wp-projected-extent-x')),
    extentY: Number(canvas.getAttribute('data-wp-projected-extent-y')),
    limitX: Number(canvas.getAttribute('data-wp-projected-limit-x')),
    limitY: Number(canvas.getAttribute('data-wp-projected-limit-y')),
  }))
  expect(mobileFit.extentX).toBeLessThanOrEqual(mobileFit.limitX + 0.000002)
  expect(mobileFit.extentY).toBeLessThanOrEqual(mobileFit.limitY + 0.000002)
  const mobileFilename = 'combined-black-three-quarter-mobile-375x812.png'
  await capture(page, mobileFilename)

  const keyPosition = keyLightPosition(DEFAULT_LIGHT_RIG.key)
  const fillPosition = kickLightPosition(DEFAULT_LIGHT_RIG.kick)
  const keyPower = keyLightPower(DEFAULT_LIGHT_RIG)
  const fillPower = kickLightPower(DEFAULT_LIGHT_RIG)
  const keyIntensity = areaLightIntensity(keyPower, DEFAULT_LIGHT_RIG.key.emitter)
  const fillIntensity = areaLightIntensity(fillPower, DEFAULT_LIGHT_RIG.kick.emitter)
  const health = await assertBrowserSourceIdentity(page)
  await writeFile(
    resolve(evidenceDirectory, 'summary.json'),
    `${JSON.stringify({
      route: '/_spike/device?capture',
      reviewedSource,
      health,
      references: [
        'IMG_2239.HEIC',
        'IMG_2240.HEIC',
        'IMG_2242.HEIC',
        'IMG_2243.HEIC',
        'IMG_2244.HEIC',
        'IMG_2245.HEIC',
        'IMG_2246.HEIC',
        'IMG_2248.HEIC',
        'IMG_2249.HEIC',
      ],
      rig: {
        exposure: DEFAULT_LIGHT_RIG.exposure,
        key: {
          position: keyPosition,
          azimuthDeg: viewerAzimuthAngleDeg(keyPosition),
          elevationDeg: keyDescentAngleDeg(keyPosition),
          emitter: DEFAULT_LIGHT_RIG.key.emitter,
          power: keyPower,
          intensity: keyIntensity,
        },
        fill: {
          position: fillPosition,
          azimuthDeg: viewerAzimuthAngleDeg(fillPosition),
          elevationDeg: keyDescentAngleDeg(fillPosition),
          target: DEFAULT_LIGHT_RIG.kick.target,
          emitter: DEFAULT_LIGHT_RIG.kick.emitter,
          power: fillPower,
          powerRatio: fillPower / keyPower,
          intensity: fillIntensity,
          intensityRatio: fillIntensity / keyIntensity,
        },
      },
      fillMetrics,
      lowerContribution,
      upperContribution,
      captures,
      mobile: { box: mobileBox, fit: mobileFit, filename: mobileFilename },
    }, null, 2)}\n`,
  )
})
