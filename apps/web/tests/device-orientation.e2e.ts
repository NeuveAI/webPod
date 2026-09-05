import { expect, test, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { DEVICE_LAYOUT } from '../../../packages/device/src/layout'

test.use({
  channel: 'chrome',
  launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] },
  hasTouch: true,
  viewport: { width: 1280, height: 900 },
})

test.beforeEach(async ({ page }) => {
  await page.goto('/_spike/device', { waitUntil: 'domcontentloaded' })
  const device = page.locator('.webpod-device-preview__device')
  await expect(device).toHaveAttribute('data-composite-tier', 'T1')
  await expect
    .poll(() => device.locator('canvas').getAttribute('data-wp-camera-fit-distance'))
    .not.toBeNull()
  await resetOrientation(page)
})

test('a visible shell edge captures free yaw/pitch through release', async ({ page }) => {
  const { left, top, width, height } = await projectedDeviceBox(page)
  const start = { x: left + width * 0.025, y: top + height * 0.5 }
  const stage = page.locator('.webpod-device-preview__stage')

  await page.mouse.move(start.x, start.y)
  await expect(stage).toHaveAttribute('data-orientation-grab', 'ready')
  await page.mouse.down()
  await expect(stage).toHaveAttribute('data-orientation-grab', 'active')
  await expect(stage).toHaveCSS('user-select', 'none')
  await page.mouse.move(start.x + 150, start.y + 50, { steps: 3 })

  await expect.poll(async () => (await orientation(page)).pitchDeg).toBeCloseTo(14, 4)
  await expect.poll(async () => (await orientation(page)).yawDeg).toBeCloseTo(63, 4)
  expect((await orientation(page)).rollDeg).toBe(0)
  await page.mouse.up()
  await expect(stage).not.toHaveAttribute('data-orientation-grab', 'active')
  await expect(page.locator('.webpod-device-preview')).toHaveAttribute(
    'data-pose',
    'custom',
  )
})

test('pointer release keeps moving across frames and a fast flick lands on the opposite face', async ({
  page,
}) => {
  const { left, top, width, height } = await projectedDeviceBox(page)
  const start = { x: left + width * 0.025, y: top + height * 0.5 }
  const stage = page.locator('.webpod-device-preview__stage')

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  // Leave headroom above the flick threshold despite browser event-delivery latency.
  for (const [index, offset] of [60, 120, 180].entries()) {
    await page.mouse.move(start.x + offset, start.y)
    if (index < 2) await page.waitForTimeout(14)
  }
  await page.mouse.up()

  const atRelease = await orientation(page)
  expect(
    Math.abs(Number(await stage.getAttribute('data-orientation-release-yaw-velocity'))),
  ).toBeGreaterThanOrEqual(340)
  expect(await stage.getAttribute('data-orientation-motion')).toBe('opposite-face')
  const laterFrames: number[] = []
  for (let frame = 0; frame < 4; frame += 1) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    laterFrames.push((await orientation(page)).yawDeg)
  }

  expect(Math.abs((laterFrames[0] ?? atRelease.yawDeg) - atRelease.yawDeg)).toBeGreaterThan(0.2)
  expect(new Set(laterFrames.map((yaw) => yaw.toFixed(4))).size).toBeGreaterThan(2)
  await expect
    .poll(async () => (await orientation(page)).yawDeg, { timeout: 5_000 })
    .toBeCloseTo(180, 6)
  await expect(stage).not.toHaveAttribute('data-orientation-motion')
})

test('ordinary production coast scales with measured release velocity', async ({ page }) => {
  const slow = await measureOrdinaryRelease(page, 14, 30)
  const fast = await measureOrdinaryRelease(page, 18, 25)

  expect(slow.velocity).toBeGreaterThan(0)
  expect(fast.velocity).toBeGreaterThan(slow.velocity * 1.25)
  expect(fast.travel).toBeGreaterThan(slow.travel * 1.25)
  expect(fast.travel / fast.velocity).toBeCloseTo(
    slow.travel / slow.velocity,
    2,
  )
})

test('front center, LCD, click wheel, and Select do not begin orientation', async ({ page }) => {
  const box = await projectedDeviceBox(page)
  const bodyCenter = devicePoint(box, 0, 0)
  const screenCenter = devicePoint(
    box,
    DEVICE_LAYOUT.screen.centerX,
    DEVICE_LAYOUT.screen.centerY,
  )
  const wheelRing = devicePoint(
    box,
    DEVICE_LAYOUT.wheel.centerX + DEVICE_LAYOUT.wheel.outerR * 0.68,
    DEVICE_LAYOUT.wheel.centerY,
  )
  const selectCenter = devicePoint(
    box,
    DEVICE_LAYOUT.wheel.centerX,
    DEVICE_LAYOUT.wheel.centerY,
  )
  const probes = [
    { name: 'body center', ...bodyCenter },
    { name: 'LCD', ...screenCenter },
    { name: 'wheel', ...wheelRing },
    { name: 'Select', ...selectCenter },
  ]

  for (const probe of probes) {
    await test.step(probe.name, async () => {
      await resetOrientation(page)
      await page.mouse.move(probe.x, probe.y)
      await page.mouse.down()
      await page.mouse.move(probe.x + 80, probe.y + 30)
      await page.mouse.up()
      expect(await orientation(page)).toEqual({ pitchDeg: 0, yawDeg: 0, rollDeg: 0 })
    })
  }
})

test('touch captures the same physical edge and rotates without scrolling', async ({ page }) => {
  const box = await projectedDeviceBox(page)
  const edge = { x: box.left + box.width * 0.025, y: box.top + box.height * 0.5 }
  const session = await page.context().newCDPSession(page)
  const touch = (x: number, y: number) => [
    { x, y, id: 31, radiusX: 4, radiusY: 4, force: 1 },
  ]

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touch(edge.x, edge.y),
  })
  await expect(page.locator('.webpod-device-preview__stage')).toHaveAttribute(
    'data-orientation-grab',
    'active',
  )
  for (const amount of [33, 66, 100]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touch(edge.x + amount, edge.y + amount * 0.2),
    })
    await page.waitForTimeout(20)
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  const touchRelease = await orientation(page)
  await expect(page.locator('.webpod-device-preview__stage')).not.toHaveAttribute(
    'data-orientation-motion',
  )
  const touchSettled = await orientation(page)
  expect(touchSettled.yawDeg).toBeGreaterThan(touchRelease.yawDeg + 1)
  expect(touchSettled.pitchDeg).toBeGreaterThan(touchRelease.pitchDeg)
  expect(
    await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    })),
  ).toEqual({ x: 0, y: 0 })
})

test('edge drag reaches the rear, pitch is bounded, and Option drag rolls', async ({ page }) => {
  const box = await projectedDeviceBox(page)
  const edge = { x: box.left + box.width * 0.025, y: box.top + box.height * 0.5 }

  await drag(page, edge, { x: edge.x + 180 / 0.42, y: edge.y })
  await expect
    .poll(async () => angularErrorDegrees((await orientation(page)).yawDeg, 180))
    .toBeLessThan(0.001)
  expect(await orientation(page)).toEqual({
    pitchDeg: 0,
    yawDeg: expect.any(Number),
    rollDeg: 0,
  })
  const rearBox = await projectedDeviceBox(page)
  const rearEdge = {
    x: rearBox.left + rearBox.width * 0.025,
    y: rearBox.top + rearBox.height * 0.5,
  }
  await drag(page, rearEdge, { x: rearEdge.x + 20, y: rearEdge.y })
  await expect.poll(async () => (await orientation(page)).yawDeg).toBeLessThan(-170)

  await resetOrientation(page)
  await drag(page, edge, { x: edge.x, y: edge.y + 400 })
  await expect.poll(() => orientation(page)).toEqual({ pitchDeg: 45, yawDeg: 0, rollDeg: 0 })

  await resetOrientation(page)
  await page.keyboard.down('Alt')
  await drag(page, edge, { x: edge.x + 100, y: edge.y })
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await orientation(page)).rollDeg).toBeCloseTo(18, 4)
  expect(await orientation(page)).toMatchObject({ pitchDeg: 0, yawDeg: 0 })
})

test('a projected rounded corner is an orientation handle', async ({ page }) => {
  const box = await projectedDeviceBox(page)
  const radius = DEVICE_LAYOUT.body.cornerR
  const corner = devicePoint(
    box,
    DEVICE_LAYOUT.body.width / 2 - radius,
    DEVICE_LAYOUT.body.height / 2 - 12,
  )
  const stage = page.locator('.webpod-device-preview__stage')

  await page.mouse.move(corner.x, corner.y)
  await expect(stage).toHaveAttribute('data-orientation-grab', 'ready')
  await drag(page, corner, { x: corner.x + 35, y: corner.y + 20 })
  await expect.poll(async () => (await orientation(page)).yawDeg).toBeGreaterThan(10)
})

test('pointer cancellation ends capture and Reset view preserves chosen appearance', async ({ page }) => {
  const box = await projectedDeviceBox(page)
  const edge = { x: box.left + box.width * 0.025, y: box.top + box.height * 0.5 }
  const stage = page.locator('.webpod-device-preview__stage')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Silver' }).click()
  await page.getByRole('button', { name: 'Light room' }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.mouse.move(edge.x, edge.y)
  await page.mouse.down()
  const pointerId = Number(await stage.getAttribute('data-orientation-pointer-id'))
  expect(Number.isFinite(pointerId)).toBe(true)
  await page.locator('.webpod-device-preview canvas').dispatchEvent('pointercancel', {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    bubbles: true,
  })
  await expect(stage).not.toHaveAttribute('data-orientation-grab', 'active')
  await page.mouse.up()

  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'Reset view' }).click()
  const state = await page.evaluate(() => window.__webpodDevicePreview?.get())
  expect(state).toEqual({
    colourway: 'white',
    pose: 'front',
    orientation: { pitchDeg: 0, yawDeg: 0, rollDeg: 0 },
    room: 'light',
  })
})

test('pose presets stay absent and the device stage does not select labels', async ({ page }) => {
  for (const name of ['Front', 'Quarter', 'Edge', 'Rear']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible()
  await expect(page.locator('.webpod-device-preview__selection-note')).toHaveCSS(
    'user-select',
    'none',
  )
  await expect(page.locator('.webpod-device-preview__stage')).toHaveCSS(
    'user-select',
    'none',
  )
})

async function resetOrientation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const preview = window.__webpodDevicePreview
    if (preview === undefined) throw new Error('preview API missing')
    preview.setColourway('black')
    preview.setRoom('dark')
    preview.reset()
  })
  await expect(page.locator('.webpod-device-preview')).toHaveAttribute('data-pose', 'front')
}

async function orientation(page: Page): Promise<{
  readonly pitchDeg: number
  readonly yawDeg: number
  readonly rollDeg: number
}> {
  return page.evaluate(() => {
    const value = window.__webpodDevicePreview?.get().orientation
    if (value === undefined) throw new Error('preview orientation missing')
    return value
  })
}

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

async function drag(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y)
  // This helper models a held release. Velocity older than the release window
  // must not be replayed as inertia; deliberate flick tests release immediately.
  await page.waitForTimeout(90)
  await page.mouse.up()
}

async function measureOrdinaryRelease(
  page: Page,
  stepPixels: number,
  waitMs: number,
): Promise<{
  readonly velocity: number
  readonly travel: number
}> {
  await resetOrientation(page)
  const box = await projectedDeviceBox(page)
  const start = {
    x: box.left + box.width * 0.025,
    y: box.top + box.height * 0.5,
  }
  const stage = page.locator('.webpod-device-preview__stage')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (const multiplier of [1, 2, 3]) {
    await page.mouse.move(start.x + stepPixels * multiplier, start.y)
    await page.waitForTimeout(waitMs)
  }
  await page.mouse.up()
  const velocity = Number(
    await stage.getAttribute('data-orientation-release-yaw-velocity'),
  )
  await expect(stage).not.toHaveAttribute('data-orientation-motion')
  const settled = await orientation(page)
  const directYawDeg = stepPixels * 3 * 0.42
  return {
    velocity,
    travel: settled.yawDeg - directYawDeg,
  }
}

function angularErrorDegrees(value: number, target: number): number {
  return Math.abs((((value - target + 180) % 360) + 360) % 360 - 180)
}
