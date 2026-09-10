import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

// Run with the local app running: bun apps/web/scripts/generate-social-cards.ts
// Capture the real model and fonts; no provider account or generated device artwork.
const origin = process.env['SOCIAL_CAPTURE_ORIGIN'] ?? 'http://localhost:3000'
const output = resolve(import.meta.dirname, '../public/social')
const formats = [
  { name: 'og', width: 1200, height: 630 },
  { name: 'x', width: 1200, height: 600 },
  { name: 'square', width: 1080, height: 1080 },
] as const

await mkdir(output, { recursive: true })
const browser = await chromium.launch()
try {
  for (const format of formats) {
    const square = format.name === 'square'
    const page = await browser.newPage({ viewport: format, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const captureUrl = new URL(origin)
    captureUrl.searchParams.set('social-card', '1')
    await page.goto(captureUrl.href)
    await page.locator('[data-teaser-entrance="complete"]').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: `
      .webpod-welcome { position: fixed !important; inset: 0; display: block !important; padding: 0 !important; height: 100vh !important; min-height: 0 !important; background: #171b22; }
      .webpod-welcome__banner, .webpod-welcome__edition, .webpod-welcome__description, .webpod-welcome__play-action, .webpod-welcome__caption, .webpod-welcome__footer { display: none !important; }
      .webpod-welcome__masthead { position: absolute; left: 64px; top: ${square ? '46px' : 'calc(var(--card-device-top, 76px) - 6px)'}; min-height: 0; }
      .webpod-welcome__wordmark { font-size: 56px; line-height: 1; letter-spacing: -2.8px; }
      .webpod-welcome__showcase { position: absolute; inset: 0; display: block !important; }
      .webpod-welcome__content { position: absolute; left: 64px; top: ${square ? '170px' : 'auto'}; bottom: ${square ? 'auto' : 'calc(100vh - var(--card-device-bottom, 554px) + 8px)'}; width: ${square ? 952 : 680}px; height: auto !important; min-height: 0; padding: 0 !important; display: block; }
      .webpod-welcome h2 { font-size: ${square ? 84 : 78}px !important; line-height: 1; letter-spacing: -2.8px; margin: 0; }
      .webpod-welcome__aside { font-size: 23px; margin: 16px 0 26px; }
      .webpod-welcome__model { position: absolute; right: ${square ? 270 : 22}px; top: ${square ? 442 : 0}px; width: ${square ? 540 : 450}px; height: ${square ? 614 : format.height}px; max-height: none; }
    ` })
    // Wait for R3F's resized canvas and camera to settle before the static capture.
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas')
      const model = document.querySelector('.webpod-welcome__model')
      return canvas && model && Math.abs(canvas.getBoundingClientRect().height - model.getBoundingClientRect().height) < 1
    })
    await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.webpod-welcome')
      const model = document.querySelector('.webpod-welcome__model')
      const showcase = document.querySelector('.webpod-welcome__showcase')
      if (!root || !model || !showcase) throw new Error('Social card device is missing')
      const bounds = model.getBoundingClientRect()
      const projected = getComputedStyle(showcase)
      root.style.setProperty('--card-device-top', `${bounds.top + parseFloat(projected.getPropertyValue('--device-top'))}px`)
      root.style.setProperty('--card-device-bottom', `${bounds.bottom - parseFloat(projected.getPropertyValue('--device-bottom-inset'))}px`)
    })
    const path = resolve(output, `webpod-${format.name}-v1.jpg`)
    await page.screenshot({ path, type: 'jpeg', quality: 92 })
    console.log(`${format.width}×${format.height}: ${path}`)
    await page.close()
  }
} finally {
  await browser.close()
}
