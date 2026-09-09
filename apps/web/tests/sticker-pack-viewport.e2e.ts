import { expect, test } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { STICKER_GENRES } from '../../../packages/stickers/src/index'
import { installDeterministicAppleMusic } from './deterministic-apple-music'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })

test('rear pack remains reachable above the frame after reveal and resize', async ({ page }) => {
  await installDeterministicAppleMusic(page)
  await page.route('**/api/stickers**', route => route.fulfill({ json: {
    stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'],
    packs: [{ id: 'viewport-fixture', source: 'starter', stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'], earnedAt: 1, openedAt: 2 }],
    placements: [], placementRevision: 0, importStatus: 'complete',
    progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
  } }))
  await page.goto('/webpod')
  await expect(page.locator('[data-device-reveal]')).toHaveAttribute('data-device-reveal', 'complete')
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  const lip = page.getByRole('button', { name: 'Pull sticker pack into view' })
  for (const viewport of [{ width: 1430, height: 764 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect(lip).toBeVisible()
    await expect.poll(async () => {
      const bounds = await lip.boundingBox()
      return bounds !== null && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height - 24
    }).toBe(true)
    // A real pointer click catches overlays and clipped hit regions too.
    await lip.click()
    await expect(page.getByRole('button', { name: 'Pull sticker liner open' })).toBeVisible()
    await page.getByRole('button', { name: 'Put pack away' }).click()
    await expect(lip).toBeVisible()
  }
})

test('a sticker over the right perimeter cannot steal an enclosure grab', async ({ page }) => {
  await installDeterministicAppleMusic(page)
  await page.route('**/api/stickers**', route => route.fulfill({ json: {
    stickerIds: ['PW-C01'],
    packs: [{ id: 'edge-fixture', source: 'starter', stickerIds: ['PW-C01'], earnedAt: 1, openedAt: 2 }],
    placements: [{ stickerId: 'PW-C01', surface: 'back', x: .95, y: .2, width: .6, rotationDeg: 0 }],
    placementRevision: 0, importStatus: 'complete',
    progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
  } }))
  await page.goto('/webpod')
  const stage = page.locator('[data-device-reveal]')
  await expect(stage).toHaveAttribute('data-device-reveal', 'complete')
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  await expect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
  const point = await page.locator('canvas').evaluate(canvas => {
    const bounds = canvas.getBoundingClientRect()
    const width = Number(canvas.dataset['wpProjectedExtentX']) * bounds.width
    const height = Number(canvas.dataset['wpProjectedExtentY']) * bounds.height
    return { x: bounds.left + (bounds.width + width) / 2 - width * .025, y: bounds.top + (bounds.height - height) / 2 + height * .2 }
  })
  await page.mouse.move(point.x, point.y)
  await expect(stage).toHaveAttribute('data-orientation-grab', 'ready')
  await page.mouse.down()
  await expect(stage).toHaveAttribute('data-orientation-grab', 'active')
  await page.mouse.move(point.x - 50, point.y, { steps: 3 })
  await expect.poll(() => page.evaluate(() => window.__webpodDevicePreview?.get().orientation.yawDeg)).toBeCloseTo(159)
  await page.mouse.up()
  await expect(page.locator('[data-sticker-editor]')).toHaveCount(0)
})

test('home transition keeps the prepared pack hidden throughout the entrance', async ({ page }) => {
  await installDeterministicAppleMusic(page)
  await page.route('**/api/stickers**', route => route.fulfill({ json: {
    stickerIds: ['PW-C01'],
    packs: [{ id: 'entrance-fixture', source: 'starter', stickerIds: ['PW-C01'], earnedAt: 1, openedAt: 2 }],
    placements: [], placementRevision: 0, importStatus: 'complete',
    progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300_000 })),
  } }))
  await page.addInitScript(() => {
    const original = document.startViewTransition
    if (original) Object.defineProperty(document, 'startViewTransition', { value: (...args: unknown[]) => {
      document.documentElement.dataset['testTransition'] = 'started'
      const model = document.querySelector('.webpod-welcome__model')
      document.documentElement.dataset['testPlayerExited'] = String(!!model && model.getBoundingClientRect().top >= innerHeight)
      return Reflect.apply(original, document, args)
    } })
    const sample = () => {
      const phase = document.querySelector('[data-device-reveal]')?.getAttribute('data-device-reveal')
      if ((phase === 'warming' || phase === 'entering') && document.querySelector('canvas[data-wp-pack-visible="true"]')) {
        document.documentElement.dataset['testPackBlink'] = 'true'
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.goto('/')
  await page.getByRole('link', { name: /Lets get playing/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-test-transition', 'started')
  await expect(page.locator('html')).toHaveAttribute('data-test-player-exited', 'true')
  await expect(page.locator('[data-device-reveal]')).toHaveAttribute('data-device-reveal', 'complete')
  await expect(page.locator('html')).not.toHaveAttribute('data-test-pack-blink', 'true')
  await expect(page.locator('canvas')).toHaveAttribute('data-wp-pack-visible', 'false')
  await expect(page.locator('.device-reveal-portal svg')).toHaveCount(0)
  await page.evaluate(() => window.__webpodDevicePreview?.setPose('rear'))
  await expect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveAttribute('data-wp-pack-visible', 'true')
})
