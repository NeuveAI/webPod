import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { DEVICE_LAYOUT } from '../../../packages/device/src/layout'

test.use({
  channel: 'chrome',
  launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] },
  hasTouch: false,
  viewport: { width: 1280, height: 900 },
})

test('native cursors follow mounted control and authoritative drag state', async ({ page }) => {
  await page.goto('/_spike/device', { waitUntil: 'domcontentloaded' })
  const device = page.locator('.webpod-device-preview__device')
  const canvas = page.locator('.webpod-device-preview canvas')
  const stage = page.locator('.webpod-device-preview__stage')
  await expect(device).toHaveAttribute('data-composite-tier', 'T1')
  await expect(canvas).toHaveCount(1)
  await expect
    .poll(() => canvas.getAttribute('data-wp-projected-extent-x'))
    .not.toBeNull()
  await page.evaluate(() => {
    const preview = window.__webpodDevicePreview
    if (preview === undefined) throw new Error('preview API missing')
    preview.reset()
  })
  await expect(page.locator('.webpod-device-preview')).toHaveAttribute('data-pose', 'front')

  await expect(stage).toHaveCSS('cursor', 'default')
  await expect(page.getByRole('button', { name: 'Reset view' })).toHaveCSS(
    'cursor',
    'pointer',
  )
  await expect(page.locator('.webpod-device-preview__selection-note')).toHaveCSS(
    'user-select',
    'text',
  )

  const box = await projectedDeviceBox(page)
  const wheel = devicePoint(
    box,
    DEVICE_LAYOUT.wheel.centerX + DEVICE_LAYOUT.wheel.outerR * 0.68,
    DEVICE_LAYOUT.wheel.centerY,
  )
  await page.mouse.move(wheel.x, wheel.y)
  await expect(canvas).toHaveAttribute('data-wp-cursor-control', 'true')
  await expect(canvas).toHaveCSS('cursor', 'pointer')

  const edge = { x: box.left + box.width * 0.025, y: box.top + box.height * 0.5 }
  await page.mouse.move(edge.x, edge.y)
  await expect(stage).toHaveAttribute('data-orientation-grab', 'ready')
  await expect(canvas).toHaveCSS('cursor', 'grab')
  await page.mouse.down()
  await expect(stage).toHaveAttribute('data-orientation-grab', 'active')
  await expect(canvas).toHaveCSS('cursor', 'grabbing')

  const pointerId = Number(await stage.getAttribute('data-orientation-pointer-id'))
  await canvas.dispatchEvent('pointercancel', {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    bubbles: true,
  })
  await expect(stage).not.toHaveAttribute('data-orientation-grab', 'active')
  await expect(canvas).not.toHaveCSS('cursor', 'grabbing')
  await page.mouse.up()
})

test.describe('coarse pointer', () => {
  test.use({ hasTouch: true })

  test('wheel and orientation cursors stay inactive while interactions remain mounted', async ({ page }) => {
    await page.goto('/_spike/device', { waitUntil: 'domcontentloaded' })
    const canvas = page.locator('.webpod-device-preview canvas')
    await expect(canvas).toHaveCount(1)
    await expect
      .poll(() => canvas.getAttribute('data-wp-projected-extent-x'))
      .not.toBeNull()
    await page.evaluate(() => {
      const preview = window.__webpodDevicePreview
      if (preview === undefined) throw new Error('preview API missing')
      preview.reset()
    })
    const box = await projectedDeviceBox(page)
    const wheel = devicePoint(
      box,
      DEVICE_LAYOUT.wheel.centerX + DEVICE_LAYOUT.wheel.outerR * 0.68,
      DEVICE_LAYOUT.wheel.centerY,
    )
    await page.mouse.move(wheel.x, wheel.y)
    await expect(canvas).toHaveAttribute('data-wp-cursor-control', 'true')
    await expect(canvas).toHaveCSS('cursor', 'default')
    expect(
      await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches),
    ).toBe(false)

    const stage = page.locator('.webpod-device-preview__stage')
    const edge = { x: box.left + box.width * 0.025, y: box.top + box.height * 0.5 }
    await page.mouse.move(edge.x, edge.y)
    await expect(stage).toHaveAttribute('data-orientation-grab', 'ready')
    await expect(canvas).toHaveCSS('cursor', 'default')
    await page.mouse.down()
    await expect(stage).toHaveAttribute('data-orientation-grab', 'active')
    await expect(stage).toHaveCSS('user-select', 'none')
    await expect(canvas).toHaveCSS('cursor', 'default')
    await page.mouse.up()
    await expect(stage).not.toHaveAttribute('data-orientation-grab', 'active')
  })
})

async function projectedDeviceBox(page: Page): Promise<{
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}> {
  return page.locator('.webpod-device-preview canvas').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect()
    const extentX = Number(canvas.dataset['wpProjectedExtentX'])
    const extentY = Number(canvas.dataset['wpProjectedExtentY'])
    if (!Number.isFinite(extentX) || !Number.isFinite(extentY)) {
      throw new Error('projected model extents missing')
    }
    const width = extentX * rect.width
    const height = extentY * rect.height
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height,
    }
  })
}

function devicePoint(
  box: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  localX: number,
  localY: number,
): { readonly x: number; readonly y: number } {
  return {
    x: box.left + box.width * (0.5 + localX / DEVICE_LAYOUT.body.width),
    y: box.top + box.height * (0.5 - localY / DEVICE_LAYOUT.body.height),
  }
}
