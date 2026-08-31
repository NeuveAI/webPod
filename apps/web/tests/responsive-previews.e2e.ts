import {
  expect,
  test,
  type Locator,
  type Page,
} from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidenceDirectory = resolve(
  process.env['RESPONSIVE_PREVIEW_EVIDENCE_DIR'] ??
    resolve(import.meta.dirname, 'test-results/responsive-previews'),
)

const mobileViewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
] as const

const screenshotViewports = [
  ...mobileViewports.slice(0, 3),
  { name: 'desktop-1440x900', width: 1440, height: 900 },
] as const

test.use({
  channel: 'chrome',
  launchOptions: {
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
})

async function freezeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
}

async function afterTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }),
  )
}

async function settleCompositePaint(page: Page): Promise<void> {
  const host = page.locator('.wp-composite-panel-host')
  await expect
    .poll(() =>
      host.evaluate((element) =>
        element.parentElement instanceof HTMLCanvasElement &&
        getComputedStyle(element).transform !== 'none',
      ),
    )
    .toBe(true)
  await page.evaluate(
    () => new Promise<void>((resolve) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '.wp-composite-preview__device canvas',
      )
      if (canvas === null || !('requestPaint' in canvas)) {
        throw new Error('T1 canvas cannot request an HTML paint')
      }
      const requestPaint = Reflect.get(canvas, 'requestPaint')
      if (typeof requestPaint !== 'function') {
        throw new Error('T1 canvas requestPaint member is not callable')
      }
      canvas.addEventListener('paint', () => resolve(), { once: true })
      Reflect.apply(requestPaint, canvas, [])
    }),
  )
  await afterTwoFrames(page)
}

async function settleDevicePaint(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const calibration = Reflect.get(window, '__deviceCalibration')
        return typeof calibration === 'object' && calibration !== null
      }),
    )
    .toBe(true)
  const readingCount = await page.evaluate(() => {
    const calibration = Reflect.get(window, '__deviceCalibration')
    if (typeof calibration !== 'object' || calibration === null) {
      throw new Error('Device calibration API is not mounted')
    }
    const sample = Reflect.get(calibration, 'sample')
    if (typeof sample !== 'function') throw new Error('Device sample command is absent')
    const result = Reflect.apply(sample, calibration, [])
    return Array.isArray(result) ? result.length : 0
  })
  expect(readingCount).toBeGreaterThan(0)
  await afterTwoFrames(page)
}

async function expectNoViewportOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth)
}

async function expectCentred(locator: Locator, page: Page): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  if (box === null || viewport === null) return
  const elementCentre = box.x + box.width / 2
  expect(Math.abs(elementCentre - viewport.width / 2)).toBeLessThanOrEqual(1)
}

async function expectAuthoredDeviceRatio(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (box === null) return
  expect(box.width).toBeLessThanOrEqual(330.01)
  expect(box.height).toBeLessThanOrEqual(552.01)
  expect(Math.abs(box.width / box.height - 330 / 552)).toBeLessThan(0.002)
}

async function expectContainedVertically(locator: Locator, viewportHeight: number): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (box === null) return
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight)
}

async function readDevicePixelMetrics(page: Page): Promise<{
  browserDpr: number
  source: { logicalWidth: number; logicalHeight: number; pixelWidth: number; pixelHeight: number }
  webgl: { cssWidth: number; cssHeight: number; pixelWidth: number; pixelHeight: number }
}> {
  type Metrics = {
    browserDpr: number
    source: { logicalWidth: number; logicalHeight: number; pixelWidth: number; pixelHeight: number }
    webgl: { cssWidth: number; cssHeight: number; pixelWidth: number; pixelHeight: number }
  }
  let reading: Metrics | null = null
  await expect.poll(async () => {
    reading = await page.evaluate(() => {
      const calibration = Reflect.get(window, '__deviceCalibration')
      if (typeof calibration !== 'object' || calibration === null) return null
      const pixels = Reflect.get(calibration, 'pixels')
      if (typeof pixels !== 'function') return null
      return Reflect.apply(pixels, calibration, [])
    })
    return reading !== null
  }).toBe(true)
  if (reading === null) throw new Error('Device pixel diagnostic did not settle')
  return reading
}

test.describe('responsive diagnostic previews', () => {
  test.beforeAll(async () => {
    await mkdir(evidenceDirectory, { recursive: true })
  })

  for (const viewport of mobileViewports) {
    test(`composite remains centred and contained at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/_probe/composite?colourway=black&mode=composited')
      await freezeVisuals(page)

      const preview = page.locator('.wp-composite-preview')
      const header = page.locator('.wp-composite-preview__header')
      const navigation = header.getByRole('navigation')
      const deviceFrame = page.locator('.wp-composite-preview__device-frame')
      const device = page.locator('.wp-composite-preview__device')
      await expect(preview).toBeVisible()
      await expect(header).toBeVisible()
      await expect(navigation).toBeVisible()
      await expect(device).toHaveAttribute('data-composite-tier', 'T1')
      await expect(device.locator('canvas')).toBeVisible()
      await settleCompositePaint(page)
      await expectNoViewportOverflow(page)
      await expectCentred(deviceFrame, page)
      await expectAuthoredDeviceRatio(deviceFrame)

      await expectContainedVertically(deviceFrame, viewport.height)

      const [headerBox, navigationBox] = await Promise.all([
        header.boundingBox(),
        navigation.boundingBox(),
      ])
      expect(headerBox).not.toBeNull()
      expect(navigationBox).not.toBeNull()
      if (headerBox !== null && navigationBox !== null) {
        expect(headerBox.x).toBeGreaterThanOrEqual(0)
        expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width)
        expect(navigationBox.x).toBeGreaterThanOrEqual(0)
        expect(navigationBox.x + navigationBox.width).toBeLessThanOrEqual(
          viewport.width,
        )
      }
      const targets = await navigation.getByRole('link').all()
      expect(targets.length).toBeGreaterThan(0)
      for (const target of targets) {
        const targetBox = await target.boundingBox()
        expect(targetBox).not.toBeNull()
        if (targetBox !== null) expect(targetBox.height).toBeGreaterThanOrEqual(44)
      }
    })

    test(`device spike remains centred and contained at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/_spike/device')
      await freezeVisuals(page)

      const stage = page.locator('.webpod-device-spike__stage')
      const hud = page.locator('.webpod-device-spike__hud')
      await expect(stage).toBeVisible()
      await expect(stage.locator('canvas')).toBeVisible()
      await expect(hud).toBeVisible()
      await settleDevicePaint(page)
      await expectNoViewportOverflow(page)
      await expectCentred(stage, page)
      await expectAuthoredDeviceRatio(stage)

      const hudButtons = await hud.getByRole('button').all()
      expect(hudButtons.length).toBeGreaterThan(0)
      for (const button of hudButtons) {
        const buttonBox = await button.boundingBox()
        expect(buttonBox).not.toBeNull()
        if (buttonBox !== null) expect(buttonBox.height).toBeGreaterThanOrEqual(44)
      }

      const pixels = await readDevicePixelMetrics(page)
      expect(pixels.webgl.pixelWidth).toBeGreaterThanOrEqual(
        Math.floor(pixels.webgl.cssWidth * pixels.browserDpr),
      )
    })
  }


  for (const deviceScaleFactor of [1, 2, 3] as const) {
    test.describe(`standalone device at DPR ${deviceScaleFactor}`, () => {
      test.use({ deviceScaleFactor })

      test('backs both the LCD source and WebGL canvas with physical pixels', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto('/_spike/device')
        await settleDevicePaint(page)

        const pixels = await readDevicePixelMetrics(page)
        expect(pixels.browserDpr).toBe(deviceScaleFactor)
        expect(pixels.source.logicalWidth).toBe(320)
        expect(pixels.source.logicalHeight).toBe(240)
        expect(pixels.source.pixelWidth).toBe(320 * deviceScaleFactor)
        expect(pixels.source.pixelHeight).toBe(240 * deviceScaleFactor)
        expect(pixels.webgl.pixelWidth).toBeGreaterThanOrEqual(
          Math.floor(pixels.webgl.cssWidth * deviceScaleFactor),
        )
        expect(pixels.webgl.pixelHeight).toBeGreaterThanOrEqual(
          Math.floor(pixels.webgl.cssHeight * deviceScaleFactor),
        )
        expect(pixels.webgl.pixelWidth).toBeLessThanOrEqual(
          Math.ceil(pixels.webgl.cssWidth * deviceScaleFactor) + 1,
        )
        expect(pixels.webgl.pixelHeight).toBeLessThanOrEqual(
          Math.ceil(pixels.webgl.cssHeight * deviceScaleFactor) + 1,
        )
      })
    })
  }

  test('composite refits after dynamic mobile-height changes without losing interaction', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/_probe/composite?colourway=black&mode=composited')
    await freezeVisuals(page)
    await settleCompositePaint(page)

    const application = page.getByRole('application', { name: 'webPod music player' })
    const frame = page.locator('.wp-composite-preview__device-frame')
    const selected = page.getByRole('option', { selected: true })
    await expect(selected).toContainText('Albums')
    await application.focus()
    await application.press('ArrowDown')
    await expect(selected).toContainText('Songs')

    await page.setViewportSize({ width: 390, height: 568 })
    await expect.poll(async () => (await frame.boundingBox())?.height ?? 0).toBeLessThan(400)
    await expectAuthoredDeviceRatio(frame)
    await expectCentred(frame, page)
    await expectContainedVertically(frame, 568)
    await expectNoViewportOverflow(page)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(async () => (await frame.boundingBox())?.height ?? 0).toBeGreaterThan(500)
    await expectAuthoredDeviceRatio(frame)
    await expect(selected).toContainText('Songs')
  })

  test('bare panel preserves its authored raster on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/_probe/composite?colourway=white&mode=bare')
    await freezeVisuals(page)
    const frame = page.locator('.wp-composite-preview__bare-frame')
    const panel = page.getByRole('application', { name: 'webPod music player' })
    await expect(panel).toBeVisible()
    const box = await frame.boundingBox()
    expect(box).not.toBeNull()
    if (box !== null) {
      expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.002)
      expect(box.width).toBeLessThanOrEqual(272.01)
      expect(box.height).toBeLessThanOrEqual(204.01)
    }
    await expectCentred(frame, page)
    await expectNoViewportOverflow(page)
  })

  for (const viewport of screenshotViewports) {
    test(`captures responsive previews at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)

      await page.goto('/_probe/composite?colourway=black&mode=composited')
      await freezeVisuals(page)
      await expect(page.locator('.wp-composite-preview__device')).toHaveAttribute(
        'data-composite-tier',
        'T1',
      )
      await settleCompositePaint(page)
      await page.screenshot({
        path: resolve(evidenceDirectory, `composite-${viewport.name}.png`),
        fullPage: true,
      })

      await page.goto('/_spike/device')
      await freezeVisuals(page)
      await expect(page.locator('.webpod-device-spike__stage canvas')).toBeVisible()
      await settleDevicePaint(page)
      await page.screenshot({
        path: resolve(evidenceDirectory, `device-${viewport.name}.png`),
        fullPage: true,
      })
    })
  }
})
