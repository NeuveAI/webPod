import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music'
import { resolve } from 'node:path'

const label = process.argv[2] ?? 'before'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })
await installDeterministicAppleMusic(page)
const views = [
  ['front', 0, 0, 0], ['quarter', 10, -48, -2],
  ['rear', 0, 180, 0], ['rear-quarter', 10, 146, -2],
  ['rear-low', -24, 146, -5], ['rear-high', 24, 210, 5],
] as const
for (const colourway of ['black', 'white']) {
  await page.goto(`http://localhost:3000/_spike/device?capture=&colourway=${colourway}`)
  await page.waitForFunction(() => window.__webpodDevicePreview !== undefined)
  await page.waitForTimeout(800)
  for (const [name, pitchDeg, yawDeg, rollDeg] of views) {
    await page.evaluate((orientation) => window.__webpodDevicePreview?.setOrientation(orientation), { pitchDeg, yawDeg, rollDeg })
    await page.waitForTimeout(250)
    await page.screenshot({ path: resolve(import.meta.dirname, `${label}-${colourway}-${name}.png`) })
  }
}
for (const contribution of ['combined', 'key-only', 'fill-only']) {
  await page.goto(`http://localhost:3000/_spike/device?capture=&diagnostic=production-surface&colourway=black&lighting=${contribution}`)
  await page.waitForFunction(() => window.__webpodDevicePreview !== undefined)
  await page.evaluate(() => window.__webpodDevicePreview?.setOrientation({ pitchDeg: 10, yawDeg: -48, rollDeg: -2 }))
  await page.waitForTimeout(700)
  await page.screenshot({ path: resolve(import.meta.dirname, `${label}-isolation-${contribution}.png`) })
}
if (label === 'final') {
  for (const colourway of ['black', 'white']) {
    for (const contribution of ['combined', 'key-only', 'fill-only']) {
      await page.goto(`http://localhost:3000/_spike/device?capture=&diagnostic=production-surface&colourway=${colourway}&lighting=${contribution}`)
      await page.waitForFunction(() => window.__webpodDevicePreview !== undefined)
      await page.evaluate(() => window.__webpodDevicePreview?.setOrientation({ pitchDeg: 0, yawDeg: 0, rollDeg: 0 }))
      await page.waitForTimeout(500)
      await page.screenshot({ path: resolve(import.meta.dirname, `${label}-${colourway}-front-${contribution}.png`) })
      await page.evaluate(() => window.__webpodDevicePreview?.setOrientation({ pitchDeg: -24, yawDeg: 195, rollDeg: 0 }))
      await page.waitForTimeout(250)
      await page.screenshot({ path: resolve(import.meta.dirname, `${label}-${colourway}-worst-rear-${contribution}.png`) })
    }
    await page.goto(`http://localhost:3000/_spike/device?capture=&colourway=${colourway}`)
    await page.waitForFunction(() => window.__webpodDevicePreview !== undefined)
    for (const pitchDeg of [-24, 0, 24]) {
      for (const yawDeg of [150, 165, 180, 195, 210]) {
        await page.evaluate((orientation) => window.__webpodDevicePreview?.setOrientation(orientation), { pitchDeg, yawDeg, rollDeg: 0 })
        await page.waitForTimeout(160)
        await page.screenshot({ path: resolve(import.meta.dirname, `${label}-${colourway}-sweep-${pitchDeg}-${yawDeg}.png`) })
      }
    }
  }
}
await browser.close()
