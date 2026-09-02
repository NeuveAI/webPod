import { expect, test } from '../../../packages/panel/node_modules/@playwright/test/index.js'

import { DEVICE_LAYOUT } from '@webpod/device'

import {
  assertBrowserSourceIdentity,
} from './source-identity'

const CHROME_EXECUTABLE =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

test.use({
  launchOptions: {
    executablePath: CHROME_EXECUTABLE,
    args: ['--enable-blink-features=CanvasDrawElement'],
  },
  viewport: { width: 1440, height: 900 },
})

test('production cardinal contacts schedule digital/down then release-up', async ({ page }) => {
  await page.goto('/_spike/device?capture=&view=front&colourway=black', {
    waitUntil: 'domcontentloaded',
  })
  await assertBrowserSourceIdentity(page)

  const root = page.locator('[data-wp-audio-lifecycle]')
  const canvas = page.locator('canvas')
  await canvas.waitFor({ state: 'visible' })
  await expect(root).toHaveAttribute('data-composite-tier', 'T1')
  await expect(root).toHaveAttribute('data-wp-audio-lifecycle', 'locked')
  await expect(root).toHaveAttribute('data-wp-audio-scheduled-total', '0')

  const box = await canvas.boundingBox()
  if (box === null) throw new Error('Production canvas has no browser box')
  const projectedBodyHeight = box.height - 68
  const scale = projectedBodyHeight / DEVICE_LAYOUT.body.height
  const wheelX = box.x + box.width / 2
  const wheelY = box.y + box.height / 2 - DEVICE_LAYOUT.wheel.centerY * scale
  const band =
    ((DEVICE_LAYOUT.wheel.labelBandInnerR +
      DEVICE_LAYOUT.wheel.labelBandOuterR) /
      2) * scale
  const menu = { x: wheelX, y: wheelY - band }

  await page.mouse.move(menu.x, menu.y)
  await page.mouse.down()
  await expect(root).toHaveAttribute('data-wp-audio-scheduled-total', '2')
  await expect(root).toHaveAttribute(
    'data-wp-audio-last-result',
    'scheduled:scheduled:2/2',
  )
  await page.waitForTimeout(120)
  await page.mouse.up()
  await expect(root).toHaveAttribute('data-wp-audio-scheduled-total', '3')

  const application = page.getByRole('application')
  await application.focus()
  for (const [index, key] of ['PageDown', ' ', 'PageUp', 'Enter'].entries()) {
    const before = 3 + index * 3
    await page.keyboard.down(key)
    await expect(root).toHaveAttribute(
      'data-wp-audio-scheduled-total',
      String(before + 2),
    )
    await page.waitForTimeout(40 + index * 20)
    await page.keyboard.up(key)
    await expect(root).toHaveAttribute(
      'data-wp-audio-scheduled-total',
      String(before + 3),
    )
  }

  await expect(root).toHaveAttribute('data-wp-audio-lifecycle', 'running')

  // Drag-off suppresses semantic Menu but the real switch still has one down
  // and one pointer-terminal up edge.
  await page.mouse.move(menu.x, menu.y)
  await page.mouse.down()
  await page.mouse.move(wheelX + band, wheelY, { steps: 4 })
  await page.mouse.up()
  const dragTotal = Number(await root.getAttribute('data-wp-audio-scheduled-total'))
  expect(dragTotal).toBeGreaterThanOrEqual(18)
  expect(dragTotal).toBeLessThanOrEqual(30)
  await expect(root).toHaveAttribute(
    'data-wp-audio-last-result',
    'scheduled:scheduled:1/1',
  )
})
