import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect } from '@playwright/test'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { isStickerInventory, type StickerInventory } from '@webpod/stickers'
import { fingerprintBrowserSources } from '../../../scripts/browser-source-fingerprint'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const evidence = process.env.WEBPOD_STICKER_HUD_EVIDENCE_DIR ?? resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/sticker-hud/implementer')

/** Actual built Start route, native cookies and SQLite; only trusted Apple/signing
 * dependencies are synthetic. No intercepted browser inventory/session endpoints. */
test('HUD transforms, gesture saves, cancellation and recovery use actual route and artwork', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'webpod-sticker-editor-'))
  const cleanup: (() => Promise<unknown>)[] = [() => rm(directory, { recursive: true, force: true })]
  const fault: { status: number; gate: Promise<void> | null; release: (() => void) | null } = { status: 0, gate: null, release: null }
  try {
    const source = fingerprintBrowserSources()
    await mkdir(evidence, { recursive: true })
    const now = Date.now()
    const service = createLiveStickerServer({ databasePath: resolve(directory, 'collection.sqlite'), now: () => now, developerToken: async () => 'synthetic-developer', fetch: async (input) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/storefront')) return Response.json({ data: [{ id: 'us' }] })
      if (path.includes('/library/')) {
        return Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: 240000, genreNames: ['Rock'] } }, { attributes: { playParams: { catalogId: '124' }, durationInMillis: 240000, genreNames: ['Electronic'] } }] })
      }
      return Response.json({ data: [] })
    } })
    cleanup.push(() => service.dispose())
    await service.ready()
    const clientRoot = resolve(import.meta.dirname, '../dist/client')
    const { default: entry } = await import(resolve(import.meta.dirname, '../dist/server/server.js')) as { default: { fetch(request: Request, options: { context: Record<string, unknown> }): Promise<Response> } }
    const requests: { path: string; method: string; status: number }[] = []
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/api/stickers/placements' && request.method === 'PUT') {
        if (fault.gate !== null) await fault.gate
        if (fault.status !== 0) { const status = fault.status; fault.status = 0; requests.push({ path, method: request.method, status }); return new Response('{}', { status }) }
      }
      const filePath = resolve(clientRoot, '.' + decodeURIComponent(path))
      if (request.method === 'GET' && filePath.startsWith(clientRoot + sep) && !path.split('/').some((part) => part.startsWith('.'))) {
        if ((await stat(filePath).catch(() => null))?.isFile()) return new Response(Bun.file(filePath))
      }
      const response = await entry.fetch(request, { context: { stickerServer: service, appleTokenOptions: {
        env: { APPLE_TEAM_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_PATH: '/synthetic/no-key-read.p8' }, signer: { async sign() { return new Uint8Array(64) } },
      } } })
      requests.push({ path, method: request.method, status: response.status })
      return response
    } })
    cleanup.push(async () => server.stop(true))
    const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
    cleanup.push(() => browser.close())
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: resolve(evidence, 'video'), size: { width: 1280, height: 900 } } })
    const origin = server.url.origin
    const headers = { origin }
    const read = async (): Promise<StickerInventory> => {
      const response = await context.request.get(origin + '/api/stickers')
      expect(response.status()).toBe(200)
      const value: unknown = await response.json()
      if (!isStickerInventory(value)) throw new Error('Invalid native inventory')
      return value
    }
    expect((await context.request.post(origin + '/api/stickers/device', { headers })).status()).toBe(200)
    expect((await context.request.post(origin + '/api/stickers/session', { headers, data: { musicUserToken: 'synthetic-user' } })).status()).toBe(200)
    const earned = await read(), packId = earned.packs[0]?.id
    if (packId === undefined) throw new Error('Seed pack missing')
    expect((await context.request.post(origin + '/api/stickers/packs/open', { headers, data: { packId } })).status()).toBe(200)
    const placement = { stickerId: 'PW-C01', surface: 'back', x: .4, y: .4, width: .25, rotationDeg: 0 }
    expect((await context.request.put(origin + '/api/stickers/placements', { headers, data: { revision: 0, placements: [placement, { stickerId: 'PW-F01', surface: 'back', x: .65, y: .72, width: .25, rotationDeg: 0 }] } })).status()).toBe(200)
    const page = await context.newPage()
    // Test-owned instrumentation installed before WebGL contexts/programs exist.
    // Counts every standard WebGL draw entry point without a product testing API.
    await page.addInitScript(() => {
      const target = window as Window & { __hudDrawProbe?: { calls: number; methods: string[] } }
      const probe = { calls: 0, methods: [] as string[] }; target.__hudDrawProbe = probe
      const wrap = (prototype: object, label: string, name: string): void => {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
        const original: unknown = descriptor?.value
        if (descriptor === undefined || typeof original !== 'function') return
        Object.defineProperty(prototype, name, { ...descriptor, value: function(this: WebGLRenderingContext | WebGL2RenderingContext, ...args: unknown[]) { probe.calls++; return Reflect.apply(original, this, args) } })
        probe.methods.push(`${label}.${name}`)
      }
      for (const name of ['drawArrays', 'drawElements']) wrap(WebGLRenderingContext.prototype, 'WebGL', name)
      if (typeof WebGL2RenderingContext !== 'undefined') for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) wrap(WebGL2RenderingContext.prototype, 'WebGL2', name)
    })
    const consoleErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    await installDeterministicAppleMusic(page, { authorized: true, mockDeveloperToken: false })
    const rear = async () => {
      await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
      await page.locator('.webpod-device-preview__stage').focus(); await page.keyboard.press('Home')
      for (let i = 0; i < 15; i++) await page.keyboard.press('Shift+ArrowRight')
      await browserExpect(page.locator('[data-sticker-placed]')).toHaveCount(2)
    }
    const shot = async (name: string, expectedId = 'PW-C01') => {
      const png = await page.screenshot({ path: resolve(evidence, name) })
      expect(consoleErrors.filter((error) => /WebGLProgram|SHADER|VALIDATE_STATUS|ReferenceError/.test(error))).toEqual([])
      const id = await page.locator('[data-sticker-editor]').count() > 0 ? await page.locator('[data-sticker-editor]').getAttribute('data-sticker-editor') : expectedId
      const p = await point(id ?? expectedId)
      const colored = await page.evaluate(async ({ png, point }) => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = 70; canvas.height = 70
        const ctx = canvas.getContext('2d'); if (ctx === null) return 0
        ctx.drawImage(image, point.x - 35, point.y - 35, 70, 70, 0, 0, 70, 70)
        const pixels = ctx.getImageData(0, 0, 70, 70).data; let count = 0
        for (let i = 0; i < pixels.length; i += 4) { const r = pixels[i] ?? 0, g = pixels[i+1] ?? 0, b = pixels[i+2] ?? 0; if (Math.max(r,g,b) - Math.min(r,g,b) > 35 && Math.max(r,g,b) > 90) count++ }
        return count
      }, { png: png.toString('base64'), point: p })
      expect(colored).toBeGreaterThan(70)
      return png
    }
    const point = async (id: string) => {
      const box = await page.locator(`[data-sticker-placed="${id}"]`).boundingBox()
      if (box === null) throw new Error('Missing actual sticker projection')
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const response = () => page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT')
    const currentPlacement = async (id = 'PW-C01') => { const p = (await read()).placements.find(p => p.stickerId === id); if (p === undefined) throw new Error('Missing saved placement'); return p }
    const center = async (selector: string) => { const box = await page.locator(selector).boundingBox(); if (box === null) throw new Error('Missing control'); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } }
    const select = async (id: string) => { const p = await point(id); await page.mouse.click(p.x, p.y); await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', id); await page.waitForTimeout(350) }
    await page.goto(origin)
    await rear()
    const selected = await point('PW-C01')
    await page.mouse.click(selected.x, selected.y)
    await browserExpect(page.locator('[data-hud-handle="rotate"]')).toBeVisible()
    await shot('desktop-enter.png')
    await page.waitForTimeout(500)
    await shot('desktop-selected.png')
    const beforeTransformDraws = await page.evaluate(() => (window as Window & { __hudDrawProbe?: { calls: number } }).__hudDrawProbe?.calls ?? -1)
    const grip = await page.locator('[data-hud-handle="rotate"]').boundingBox()
    if (grip === null) throw new Error('No rotation grip')
    await page.mouse.move(grip.x + 22, grip.y + 22); await page.mouse.down()
    await page.mouse.move(grip.x + 65, grip.y + 50, { steps: 8 })
    await shot('desktop-rotate-active.png')
    const activeTransformDraws = await page.evaluate(() => (window as Window & { __hudDrawProbe?: { calls: number } }).__hudDrawProbe?.calls ?? -1)
    expect(beforeTransformDraws).toBeGreaterThan(0); expect(activeTransformDraws).toBeGreaterThan(beforeTransformDraws)
    const saved = page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT')
    await page.mouse.up(); await saved
    await shot('desktop-release.png')
    expect(Math.abs((await currentPlacement()).rotationDeg)).toBeGreaterThan(5)
    await page.waitForTimeout(80); await shot('desktop-release-mid.png')
    const other = await point('PW-F01'); await page.mouse.click(other.x, other.y)
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', 'PW-F01')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-release', '1')
    await shot('desktop-rapid-retarget.png', 'PW-F01')
    await select('PW-C01')
    await page.waitForTimeout(500); await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-release', '1')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-presence', '1.000')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase', 'editing')
    const idle = await page.evaluate(async () => {
      const probe = (window as Window & { __hudDrawProbe?: { calls: number; methods: string[] } }).__hudDrawProbe
      if (probe === undefined) throw new Error('Draw instrumentation missing')
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const before = probe.calls, started = performance.now()
      await new Promise(resolve => setTimeout(resolve, 3000))
      return { methods: probe.methods, before, after: probe.calls, elapsedMs: performance.now() - started, hudCount: document.querySelectorAll('[data-sticker-editor]').length, presence: document.querySelector('[data-sticker-editor]')?.getAttribute('data-hud-presence') }
    })
    await writeFile(resolve(evidence, 'settled-hud-idle.json'), JSON.stringify({ source, beforeTransformDraws, activeTransformDraws, ...idle }, null, 2))
    expect(idle.methods).toContain('WebGL2.drawElements'); expect(idle.elapsedMs).toBeGreaterThanOrEqual(2990)
    expect(idle.hudCount).toBe(1); expect(idle.presence).toBe('1.000'); expect(idle.after).toBe(idle.before)
    const undoSaved = response(); await page.getByRole('button', { name: 'Undo sticker change' }).click(); await undoSaved
    expect((await currentPlacement()).rotationDeg).toBe(0)
    // Large rotation preserves the actual captured grip under each pointer sample.
    const start = await center('[data-hud-handle="rotate"]'), pivot = await point('PW-C01')
    const beforeHandleCancel = requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length
    await page.mouse.move(start.x, start.y); await page.mouse.down()
    for (let i=1; i<=12; i++) {
      const angle = i * Math.PI / 24, dx = start.x-pivot.x, dy = start.y-pivot.y
      const p = { x: pivot.x+dx*Math.cos(angle)-dy*Math.sin(angle), y: pivot.y+dx*Math.sin(angle)+dy*Math.cos(angle) }
      await page.mouse.move(p.x, p.y)
      const actual = await center('[data-hud-handle="rotate"]'); expect(Math.hypot(actual.x-p.x, actual.y-p.y)).toBeLessThan(2)
    }
    await shot('desktop-quarter-turn-active.png')
    await page.keyboard.press('Escape'); await page.mouse.up()
    expect((await currentPlacement()).rotationDeg).toBe(0)
    expect(requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length).toBe(beforeHandleCancel)
    // Native keyboard uses the same gesture commit and guarded failure recovery.
    fault.status = 503
    await page.locator('[data-hud-handle="rotate"]').focus()
    const failed = response(); await page.keyboard.press('ArrowRight'); expect((await failed).status()).toBe(503)
    await browserExpect(page.getByRole('alert')).toContainText('Couldn’t save')
    expect((await currentPlacement()).rotationDeg).toBe(0)
    await shot('desktop-save-failure.png')
    const retried = response(); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await retried
    expect((await currentPlacement()).rotationDeg).toBe(1)
    fault.status = 409
    await page.locator('[data-hud-handle="rotate"]').focus(); const conflicted = response(); await page.keyboard.press('ArrowRight'); expect((await conflicted).status()).toBe(409)
    await browserExpect(page.getByRole('alert')).toContainText('Changed elsewhere')
    expect((await currentPlacement()).rotationDeg).toBe(1)
    // An unknown outcome remains locked through dismissal and re-selection.
    fault.gate = new Promise<void>(resolve => { fault.release = resolve })
    await page.locator('[data-hud-handle="rotate"]').focus(); await page.keyboard.press('ArrowRight')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase', 'saving')
    await page.keyboard.press('Escape'); await select('PW-C01')
    await browserExpect(page.locator('[data-hud-handle="rotate"]')).toBeDisabled()
    const delayed = response(); fault.release?.(); fault.gate = null; await delayed
    await browserExpect(page.locator('[data-hud-handle="rotate"]')).toBeEnabled()
    // Surface wear is one native range gesture and persists independently of placement.
    await page.getByRole('button', { name: 'Sticker wear' }).click()
    const worn = response(); await page.locator('#sticker-hud-value').press('End'); await worn
    expect((await currentPlacement()).wear).toBe(1)
    await shot('desktop-worn.png')
    const rangeBox = await page.locator('#sticker-hud-value').boundingBox()
    if (rangeBox === null) throw new Error('Missing wear range')
    const beforeCancel = requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length
    await page.mouse.move(rangeBox.x+rangeBox.width*.8, rangeBox.y+rangeBox.height/2); await page.mouse.down()
    await page.mouse.move(rangeBox.x+rangeBox.width*.3, rangeBox.y+rangeBox.height/2)
    await page.keyboard.press('Escape')
    await page.mouse.move(rangeBox.x+rangeBox.width*.5, rangeBox.y+rangeBox.height/2); await page.mouse.up()
    await page.waitForTimeout(100)
    expect(requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length).toBe(beforeCancel)
    expect((await currentPlacement()).wear).toBe(1)
    await page.keyboard.press('Escape'); await shot('desktop-exit.png'); await page.waitForTimeout(500); await browserExpect(page.locator('[data-sticker-editor]')).toHaveCount(0); await shot('desktop-dismissed.png')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500)
    const mobile = await point('PW-F01'); await page.mouse.click(mobile.x, mobile.y)
    await browserExpect(page.locator('[data-hud-handle="rotate"]')).toBeVisible()
    await page.waitForTimeout(500)
    await shot('mobile-selected.png', 'PW-F01')
    const touch = await context.newCDPSession(page)
    const resizeGrip = await center('[data-hud-handle="size"]'), mobilePivot = await point('PW-F01')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: resizeGrip.x, y: resizeGrip.y }] })
    const small = { x: mobilePivot.x+(resizeGrip.x-mobilePivot.x)*.38, y: mobilePivot.y+(resizeGrip.y-mobilePivot.y)*.38 }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: small.x, y: small.y }] })
    const visibleGrip = await center('[data-hud-handle="size"]'); expect(Math.hypot(visibleGrip.x-small.x, visibleGrip.y-small.y)).toBeLessThan(2)
    const resized = response(); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await resized
    expect((await currentPlacement('PW-F01')).width).toBeLessThan(.15)
    await page.waitForTimeout(500); await shot('mobile-small-sticker.png', 'PW-F01')
    const targets = await page.locator('[data-hud-handle], [data-hud-tools] button').evaluateAll(elements => elements.map(e => { const r=e.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height } }))
    for (const r of targets) { expect(r.width).toBeGreaterThanOrEqual(43.9); expect(r.height).toBeGreaterThanOrEqual(43.9); expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(375) }
    for (let i=0;i<2;i++) for (let j=i+1;j<targets.length;j++) { const a=targets[i],b=targets[j]; if (a===undefined||b===undefined) throw new Error('Missing target'); expect(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top).toBe(true) }
    // Actual native pointercancel followed by a new keyboard wear gesture remains usable.
    await page.getByRole('button', { name: 'Sticker wear' }).click()
    const wearBox = await page.locator('#sticker-hud-value').boundingBox()
    if (wearBox === null) throw new Error('Missing touch wear range')
    const beforePointerCancel = requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: wearBox.x+wearBox.width*.7, y: wearBox.y+wearBox.height/2 }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    expect(requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length).toBe(beforePointerCancel)
    await page.locator('#sticker-hud-value').focus(); const afterCancelSave = response(); await page.keyboard.press('ArrowRight'); await afterCancelSave
    expect((await currentPlacement('PW-F01')).wear).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await select('PW-F01')
    const body = await point('PW-F01'), beforeBody = await currentPlacement('PW-F01')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: body.x, y: body.y }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: body.x, y: body.y-9 }] })
    await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: body.x, y: body.y-88 }] })
    await page.screenshot({ path: resolve(evidence, 'mobile-selected-body-carry.png') })
    const moved = response(); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await moved
    expect((await currentPlacement('PW-F01')).y).toBeLessThan(beforeBody.y)
    expect((await currentPlacement('PW-F01')).wear).toBe(beforeBody.wear)
    await page.waitForTimeout(650)
    await select('PW-C01')
    const returned = response(); await page.getByRole('button', { name: 'Return to pack', exact: true }).click(); await returned
    await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open', { timeout: 10000 })
    const returnedInventory = await read(); expect(returnedInventory.placements.some(p => p.stickerId === 'PW-C01')).toBe(false)
    expect(returnedInventory.appearances?.find(a => a.stickerId === 'PW-C01')?.wear).toBe(1)
    await page.screenshot({ path: resolve(evidence, 'mobile-returned-worn-sheet.png') })
    await page.locator('[data-sticker-slot="PW-C01"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowLeft')
    const restuck = response(); await page.keyboard.press('Enter'); await restuck
    expect((await currentPlacement()).wear).toBe(1)
    await page.getByRole('button', { name: 'Put pack away', exact: true }).click(); await page.waitForTimeout(650)
    await shot('mobile-restuck-worn.png')
    await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
    await page.keyboard.press('Escape'); await select('PW-C01'); await shot('mobile-reduced-motion.png')
    await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'no-preference' })
    await page.reload(); await rear(); expect((await currentPlacement()).wear).toBe(1)
    await shot('mobile-reloaded-wear.png')
    await touch.detach()
    expect(fingerprintBrowserSources()).toEqual(source)
    expect(consoleErrors.filter(e => /WebGLProgram|SHADER|ReferenceError/.test(e))).toEqual([])
    await writeFile(resolve(evidence, 'native-verification.json'), JSON.stringify({ source, requests, consoleErrors, idle, passed: true }, null, 2))
  } finally {
    fault.release?.()
    const outcomes = []
    for (const dispose of cleanup.reverse()) outcomes.push(await Promise.allSettled([Promise.resolve().then(dispose)]))
    expect(outcomes.flat().filter((outcome) => outcome.status === 'rejected')).toEqual([])
  }
}, 120000)
