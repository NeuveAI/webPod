import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { DEVICE_LAYOUT } from '../packages/device/src/layout'

import { fingerprintBrowserSources } from './browser-source-fingerprint'

const port = 3017
const debugPort = 9337
const profile = mkdtempSync(join(tmpdir(), 'webpod-w7-chrome-'))
const server = Bun.spawn([
  'bun', 'run', '--cwd', 'apps/web', 'dev', '--host', '127.0.0.1', '--port', String(port),
], { stdout: 'pipe', stderr: 'pipe' })
const chrome = Bun.spawn([
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${String(debugPort)}`,
  '--enable-blink-features=CanvasDrawElement',
  'about:blank',
], { stdout: 'pipe', stderr: 'pipe' })

try {
  await waitFor(`http://127.0.0.1:${String(port)}/`)
  await waitFor(`http://127.0.0.1:${String(debugPort)}/json/version`)
  const sourceBefore = fingerprintBrowserSources()
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${String(debugPort)}`)
  const context = browser.contexts()[0]
  if (context === undefined) throw new Error('Fresh Chrome context was not created')
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(
    `http://127.0.0.1:${String(port)}/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=composited`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('[data-composite-tier="T1"]').waitFor()

  const application = page.locator('[role="application"]')
  await application.focus()
  await page.keyboard.press('ArrowDown')
  const selectedBeforeArc = await application.getAttribute('aria-activedescendant')
  const canvas = page.locator('[data-composite-tier="T1"] canvas')
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('Composite canvas has no box')
  const scale = Math.min(
    box.width / DEVICE_LAYOUT.body.width,
    box.height / DEVICE_LAYOUT.body.height,
  )
  const centerX = box.x + box.width / 2
  const centerY = box.y
    + (DEVICE_LAYOUT.body.height / 2 - DEVICE_LAYOUT.wheel.centerY) * scale
  const radius = 86 * scale
  await page.mouse.move(centerX + radius, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX, centerY + radius, { steps: 8 })
  await page.mouse.up()
  const focusAfterArc = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute('role') ?? null,
    label: document.activeElement?.getAttribute('aria-label') ?? null,
  }))
  const selectedAfterArc = await application.getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowUp')
  const selectedAfterKeyboard = await application.getAttribute('aria-activedescendant')
  const sourceAfter = fingerprintBrowserSources()
  const result = {
    route: page.url(),
    chromeVersion: await browser.version(),
    flag: 'CanvasDrawElement',
    requestPaint: await page.evaluate(() => 'requestPaint' in HTMLCanvasElement.prototype),
    tier: await page.locator('[data-composite-tier]').getAttribute('data-composite-tier'),
    sourceBefore,
    sourceAfter,
    sourceStable: sourceBefore.digest === sourceAfter.digest,
    canvas: box,
    selectedBeforeArc,
    selectedAfterArc,
    focusAfterArc,
    selectedAfterKeyboard,
    keyboardContinued: selectedAfterKeyboard !== selectedAfterArc,
    pageErrors: errors,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  await browser.close()
} finally {
  server.kill()
  chrome.kill()
  await Promise.allSettled([server.exited, chrome.exited])
  rmSync(profile, { recursive: true, force: true })
}

async function waitFor(url: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The fresh process has not bound its port yet.
    }
    await Bun.sleep(50)
  }
  throw new Error(`Timed out waiting for ${url}`)
}
