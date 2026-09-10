import { expect, test } from '@playwright/test'
import { utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { installDeterministicAppleMusic } from './deterministic-apple-music'

test.use({ channel: 'chrome', launchOptions: { args: ['--enable-blink-features=CanvasDrawElement'] } })

test('hot updates preserve the store used by mounted orientation callbacks', async ({ page }) => {
  await installDeterministicAppleMusic(page)
  await page.goto('/?projection-diagnostics=1', { waitUntil: 'domcontentloaded' })
  const root = page.locator('.webpod-device-preview')
  const canvas = root.locator('canvas')
  await expect(canvas).toHaveAttribute('data-wp-scene-orientation', '0,0,0')
  // Retain the mounted callback, just as the pointer and WebMCP owners do.
  const owner = await page.evaluateHandle(() => {
    const value = window.__webpodDevicePreview
    if (value === undefined) throw new Error('Orientation owner is not mounted')
    return value
  })
  await owner.evaluate(value => value.setOrientation({ pitchDeg: 3, yawDeg: 40, rollDeg: 0 }))
  await expect(root).toHaveAttribute('data-orientation', '3,40,0')
  for (const file of ['webmcp.ts', 'device-preview-store.ts']) {
    const refreshed = page.waitForEvent('console', { predicate: message => message.text().includes('hot updated: /src/device-page.tsx') })
    // The standard test config serves an isolated source snapshot. Never touch
    // the developer's live checkout or trigger HMR in their open player.
    const path = resolve(tmpdir(), 'webpod-web-playwright/served-snapshot/apps/web/src', file)
    const now = new Date()
    utimesSync(path, now, now)
    await refreshed
    await expect(root).toHaveAttribute('data-orientation', '3,40,0')
    await owner.evaluate(value => value.setOrientation({ pitchDeg: 5, yawDeg: 180, rollDeg: 0 }))
    await expect(root).toHaveAttribute('data-orientation', '5,180,0')
    await expect(canvas).toHaveAttribute('data-wp-scene-orientation', '5,180,0')
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await expect.poll(() => owner.evaluate(value => value.get().orientation)).toEqual({ pitchDeg: 0, yawDeg: 0, rollDeg: 0 })
    await owner.evaluate(value => value.setOrientation({ pitchDeg: 3, yawDeg: 40, rollDeg: 0 }))
    await expect(root).toHaveAttribute('data-orientation', '3,40,0')
  }
  await owner.dispose()
})
