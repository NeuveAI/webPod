import { chromium, expect } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music.ts'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Start a built app locally; no production requests or persistent app data are modified.
const base = process.env['WEBPOD_UPDATE_SMOKE_URL'] ?? 'http://127.0.0.1:4339'
const identityResponse = await fetch(`${base}/api/version`)
const identity: { buildId: string } = await identityResponse.json()
expect(identityResponse.headers.get('cache-control')).toBe('no-store')
const htmlResponse = await fetch(`${base}/webpod`)
expect(htmlResponse.headers.get('cache-control')).toContain('must-revalidate')
const assets = resolve(import.meta.dir, '../../../../../apps/web/dist/client/assets')
const compiled = await Promise.all((await readdir(assets)).filter(name => name.endsWith('.js')).map(name => readFile(resolve(assets, name), 'utf8')))
expect(compiled.some(source => source.includes(identity.buildId))).toBe(true)
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await context.newPage()
await page.clock.install()
const errors: string[] = []
page.on('pageerror', error => errors.push(error.message))
await installDeterministicAppleMusic(page)
let mode: 'same' | 'bad' | 'failed' | 'first' | 'second' = 'same'
let requests = 0
let concurrent = 0, maximumConcurrent = 0
let delayNext = false
let releaseDelayed: (() => void) | undefined
const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'
await page.route('**/api/version', async route => {
  requests += 1
  concurrent += 1; maximumConcurrent = Math.max(maximumConcurrent, concurrent)
  if (delayNext) { delayNext = false; await new Promise<void>(resolve => { releaseDelayed = resolve }) }
  if (mode === 'failed') { await route.abort(); concurrent -= 1; return }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mode === 'bad' ? { buildId: 'not-a-version' } : { buildId: mode === 'same' ? identity.buildId : mode === 'first' ? first : second }) })
  concurrent -= 1
})
const notice = page.getByRole('complementary', { name: 'App update' })
const foreground = async () => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
}
try {
  await page.goto(`${base}/webpod?updateProbe=kept#listen`, { waitUntil: 'domcontentloaded' })
  await expect.poll(() => requests).toBe(1)
  await expect(notice).toHaveCount(0)
  mode = 'bad'; await foreground(); await expect.poll(() => requests).toBe(2); await expect(notice).toHaveCount(0)
  mode = 'failed'; await foreground(); await expect.poll(() => requests).toBe(3); await expect(notice).toHaveCount(0)
  await context.setOffline(true)
  await foreground(); await page.waitForTimeout(100)
  expect(requests).toBe(3)
  mode = 'same'; await context.setOffline(false); await expect.poll(() => requests).toBe(4)
  delayNext = true
  const beforeDelayed = requests
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => requests).toBe(beforeDelayed + 1)
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.dispatchEvent(new Event('online')) })
  await page.waitForTimeout(50)
  expect(requests).toBe(beforeDelayed + 1)
  releaseDelayed?.()
  await expect.poll(() => requests).toBe(beforeDelayed + 2)
  expect(maximumConcurrent).toBe(1)
  mode = 'first'; await foreground(); await expect(notice).toBeVisible()
  await page.getByRole('button', { name: 'Later', exact: true }).click()
  await expect(notice).toHaveCount(0)
  const afterLater = requests; await foreground(); await expect.poll(() => requests).toBeGreaterThan(afterLater)
  await expect(notice).toHaveCount(0)
  mode = 'second'; await foreground(); await expect(notice).toBeVisible()
  await page.locator('[data-composite-tier="T1"]').waitFor()
  await page.locator('[data-device-reveal="complete"]').waitFor()
  const layouts = []
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(250)
    const box = await notice.boundingBox()
    const buttons = await notice.getByRole('button').evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(); return { text: element.textContent, width: box.width, height: box.height } }))
    expect(buttons.every(button => button.width >= 44 && button.height >= 44)).toBe(true)
    expect(box !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height).toBe(true)
    layouts.push({ viewport, box, buttons })
    await page.screenshot({ path: `${import.meta.dir}/notice-${viewport.width}x${viewport.height}.png` })
  }
  await page.evaluate(() => localStorage.setItem('webpod-update-probe', 'retained'))
  let reloads = 0
  const frameNavigations: string[] = []
  page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') reloads += 1 })
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) frameNavigations.push(frame.url()) })
  mode = 'same'
  const beforeReload = requests
  await page.getByRole('button', { name: 'Reload', exact: true }).click()
  await page.waitForURL(url => url.searchParams.get('_webpod_version') === second)
  await page.waitForTimeout(300)
  const location = new URL(page.url())
  expect(location.pathname).toBe('/webpod'); expect(location.searchParams.get('updateProbe')).toBe('kept'); expect(location.hash).toBe('#listen')
  expect(await page.evaluate(() => localStorage.getItem('webpod-update-probe'))).toBe('retained')
  expect(reloads).toBe(1)
  await expect(notice).toHaveCount(0)
  await expect.poll(() => requests).toBe(beforeReload + 1)
  const beforeInterval = requests
  await page.clock.fastForward(60_010)
  await expect.poll(() => requests).toBe(beforeInterval + 1)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  const beforeHidden = requests
  await page.clock.fastForward(120_000)
  expect(requests).toBe(beforeHidden)
  await foreground(); await expect.poll(() => requests).toBe(beforeHidden + 1)
  const reloadDocumentRequests = reloads
  const reloadFrameNavigations = [...frameNavigations]
  const beforeCleanup = requests
  await page.goto(`${base}/favicon.svg`)
  await page.clock.fastForward(120_000)
  expect(requests).toBe(beforeCleanup)
  expect(errors).toEqual([])
  await Bun.write(`${import.meta.dir}/browser-smoke.json`, JSON.stringify({ identity, endpointCache: identityResponse.headers.get('cache-control'), htmlCache: htmlResponse.headers.get('cache-control'), clientParity: true, checks: ['same hidden', 'malformed quiet', 'failed quiet', 'offline quiet', 'online/foreground check', 'Later suppresses same version', 'distinct version shown', 'mobile controls >=44px', 'explicit reload preserves route/query/hash/storage', 'one navigation', 'visible-only 60s interval', 'one concurrent request', 'document cleanup'], maximumConcurrent, requests, reloadDocumentRequests, reloadFrameNavigations, layouts, errors }, null, 2))
} finally { await browser.close() }
