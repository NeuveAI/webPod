import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect, type BrowserContext, type Page } from '@playwright/test'
import { handleAppleDeveloperTokenRequest } from '@webpod/server-core'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { getSticker, isStickerInventory, type StickerInventory } from '@webpod/stickers'
import { fingerprintBrowserSources } from '../../../scripts/browser-source-fingerprint'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const evidence = resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/tactile-collection/browser')

/** Built production /, real Start endpoints, native browser cookies and isolated SQLite.
 * Only MusicKit and the server's trusted Apple/signing dependencies are synthetic.
 * No browser API interception, production test switch, alternate renderer or stored secrets. */
test('production browser signs in, collects, reloads, revokes and reconnects its device collection', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'webpod-sticker-browser-'))
  const cleanup: (() => Promise<unknown>)[] = [() => rm(directory, { recursive: true, force: true })]
  let cleanupFailed: boolean
  try {
  const sourceFingerprint = fingerprintBrowserSources()
  const databasePath = resolve(directory, 'collection.sqlite')
  const clientRoot = resolve(import.meta.dirname, '../dist/client')
  const builtPath = resolve(import.meta.dirname, '../dist/server/server.js')
  const started = performance.now()
  let now = Date.now()
  let verifications = 0
  let signed = 0
  let failNextPlacement = false
  let simulatedServiceFailures = 0
  const requests: { method: string; path: string; status: number }[] = []
  const service = createLiveStickerServer({
    databasePath, now: () => now, developerToken: async () => 'synthetic-developer',
    fetch: async (input) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/storefront')) { verifications++; return Response.json({ data: [{ id: 'us' }] }) }
      if (path.includes('/library/')) return Response.json({ data: ['Rock', 'Electronic', 'Jazz'].map((genre, index) => ({ attributes: { playParams: { catalogId: String(123 + index) }, durationInMillis: 240000, genreNames: [genre] } })) })
      return Response.json({ data: [] })
    },
  })
  cleanup.push(() => service.dispose())
  const httpService = { ...service, handle: async (request: Request) => {
    if (failNextPlacement && new URL(request.url).pathname === '/api/stickers/placements') { failNextPlacement = false; simulatedServiceFailures++; throw new Error('Synthetic storage outage') }
    return service.handle(request)
  } }
  const appleTokenOptions: Parameters<typeof handleAppleDeveloperTokenRequest>[1] = {
    env: { APPLE_TEAM_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_PATH: '/synthetic/no-key-read.p8' },
    signer: { async sign() { signed++; return new Uint8Array(64) } },
  }
  const { default: entry } = await import(builtPath) as { default: { fetch(request: Request, options: { context: { stickerServer: typeof service; appleTokenOptions: typeof appleTokenOptions } }): Promise<Response> } }
  await service.ready()
  const server = Bun.serve({
    port: 0, hostname: '127.0.0.1',
    async fetch(request) {
      const pathname = new URL(request.url).pathname
      if (request.method === 'GET' || request.method === 'HEAD') {
        const path = resolve(clientRoot, '.' + decodeURIComponent(pathname))
        if (path.startsWith(clientRoot + sep) && !pathname.split('/').some((part) => part.startsWith('.'))) {
          const file = await stat(path).catch(() => null)
          if (file?.isFile()) return new Response(request.method === 'HEAD' ? null : Bun.file(path), { headers: { 'content-type': Bun.file(path).type } })
        }
      }
      const response = await entry.fetch(request, { context: { stickerServer: httpService, appleTokenOptions } })
      if (pathname.startsWith('/api/')) requests.push({ method: request.method, path: pathname, status: response.status })
      return response
    },
  })
  cleanup.push(async () => server.stop(true))
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
  cleanup.push(() => browser.close())
  const open = async (): Promise<{ page: Page; context: BrowserContext }> => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' })
    cleanup.push(() => context.close())
    const page = await context.newPage()
    await installDeterministicAppleMusic(page, { authorized: false, mockDeveloperToken: false })
    await page.goto(server.url.origin + '/')
    // An HTML shell is insufficient: the built root must mount the actual product and canvas.
    await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
    await browserExpect(page.locator('canvas')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/')
    expect(await page.evaluate(() => '__webpodDevicePreview' in window)).toBe(false)
    return { page, context }
  }
  const readInventory = async (context: BrowserContext): Promise<StickerInventory> => {
    const response = await context.request.get(server.url.origin + '/api/stickers')
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('no-store')
    const body: unknown = await response.json()
    if (!isStickerInventory(body)) throw new Error('Invalid server inventory')
    return body
  }
  const signIn = async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const signedIn = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'POST' && response.status() === 200)
    await page.getByRole('button', { name: 'Sign in to Apple Music', exact: true }).click()
    await signedIn
    await page.getByRole('button', { name: 'Close', exact: true }).click()
  }
  const captureRenderedSticker = async (page: Page, filename: string): Promise<void> => {
    let capture: Buffer | undefined
    await browserExpect.poll(async () => {
      capture = await page.screenshot()
      return page.evaluate(async (png) => {
        const image = new Image()
        image.src = `data:image/png;base64,${png}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = 200; canvas.height = 250
        const context = canvas.getContext('2d')
        if (context === null) return 0
        // Actual orange Rock artwork pixels in the rear landing region; a blank
        // canvas, DOM lip or silver backplate cannot satisfy this assertion.
        context.drawImage(image, 540, 300, 200, 250, 0, 0, 200, 250)
        const pixels = context.getImageData(0, 0, 200, 250).data
        let artwork = 0
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i] ?? 0, g = pixels[i + 1] ?? 0, b = pixels[i + 2] ?? 0
          if (r > 100 && g > 40 && b < g * .9 && r > g * 1.1) artwork++
        }
        return artwork
      }, capture.toString('base64'))
    }, { timeout: 10_000, message: 'Real rendered orange starter artwork must appear on the rear' }).toBeGreaterThan(100)
    if (capture === undefined) throw new Error('Rendered capture missing')
    await writeFile(resolve(evidence, filename), capture)
  }
  const captureSheet = async (page: Page, filename: string): Promise<void> => {
    let image: Buffer | undefined
    const region = await page.locator('[data-sticker-slot-state="locked"]').first().boundingBox()
    if (region === null) throw new Error('No locked print seat to verify')
    await browserExpect.poll(async () => {
      image = await page.screenshot()
      return page.evaluate(async ({ png, region }) => {
        const source = new Image(); source.src = `data:image/png;base64,${png}`; await source.decode()
        const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80
        const context = canvas.getContext('2d'); if (context === null) return 0
        context.drawImage(source, region.x, region.y, region.width, region.height * .8, 0, 0, 100, 80)
        const data = context.getImageData(0, 0, 100, 80).data
        let ink = 0
        for (let index = 0; index < data.length; index += 4) if ((data[index] ?? 255) < 195 && (data[index + 1] ?? 255) < 195) ink++
        return ink
      }, { png: image.toString('base64'), region })
    }, { timeout: 10000, message: 'Physical locked artwork must have painted in its actual slot' }).toBeGreaterThan(200)
    if (image === undefined) throw new Error('No rendered sheet image')
    await writeFile(resolve(evidence, filename), image)
  }
  const flipRear = async (page: Page): Promise<void> => {
    const stage = page.locator('.webpod-device-preview__stage')
    await stage.focus(); await page.keyboard.press('Home')
    for (let step = 0; step < 15; step++) await page.keyboard.press('Shift+ArrowRight')
    await browserExpect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
  }
    await mkdir(evidence, { recursive: true })
    const first = await open()
    expect((await first.context.request.get(server.url.origin + '/api/stickers')).status()).toBe(401)
    await signIn(first.page)
    const initial = await readInventory(first.context)
    expect(initial.stickerIds).toHaveLength(3)
    expect(initial.packs).toHaveLength(1)
    // Four measured 225-second plays earn the second rock sticker through native API policy.
    for (let play = 0; play < 4; play++) for (let sequence = 0; sequence <= 15; sequence++) {
      now += 15000
      const observation = await first.context.request.post(server.url.origin + '/api/stickers/listening', { headers: { origin: server.url.origin }, data: { eventId: `tactile-${play}-${sequence}`, streamId: `tactile-${play}`, sequence, catalogId: '123', positionMs: sequence * 15000, playing: true } })
      expect(observation.status()).toBe(200)
    }
    expect((await readInventory(first.context)).stickerIds).toContain('PW-C02')
    const refreshed = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'POST' && response.status() === 200)
    await first.page.reload(); await refreshed
    const stickerId = initial.stickerIds[0]
    const art = stickerId === undefined ? undefined : getSticker(stickerId)
    if (art === undefined) throw new Error('Starter artwork missing')
    const cookies = await first.context.cookies()
    for (const name of ['webpod_device', 'webpod_session']) {
      const cookie = cookies.find((item) => item.name === name)
      expect(cookie !== undefined).toBe(true)
      expect(cookie?.httpOnly).toBe(true)
      expect(cookie?.sameSite).toBe('Lax')
      expect(cookie?.path).toBe('/')
    }
    expect(await first.page.evaluate(() => document.cookie.includes('webpod_device') || document.cookie.includes('webpod_session'))).toBe(false)
    await flipRear(first.page)
    await first.page.screenshot({ path: resolve(evidence, 'browser-01-real-starter.png') })
    const lip = first.page.getByRole('button', { name: 'Pull sticker pack into view' })
    const lipBox = await lip.boundingBox()
    if (lipBox === null) throw new Error('Pack lip missing')
    await first.page.mouse.move(lipBox.x + lipBox.width / 2, lipBox.y + lipBox.height / 2)
    await first.page.mouse.down(); await first.page.mouse.move(lipBox.x + lipBox.width / 2, lipBox.y - 180, { steps: 12 }); await first.page.mouse.up()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-sealed-sleeve.png') })
    const opened = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/packs/open' && response.status() === 200)
    await first.page.getByRole('button', { name: 'Open earned pack' }).click(); await opened
    await browserExpect(first.page.locator('[data-sticker-slot]')).toHaveCount(5)
    await browserExpect(first.page.locator('[data-sticker-slot-state="locked"]')).toHaveCount(3)
    await captureSheet(first.page, 'desktop-open-sheet.png')
    // A pending keyboard preview must never be reused for a different earned seat.
    const firstSeat = first.page.locator('[data-sticker-slot="PW-C01"]')
    const secondSeat = first.page.locator('[data-sticker-slot="PW-C02"]')
    for (const useMeaning of [false, true]) {
      await firstSeat.focus(); await first.page.keyboard.press('ArrowRight')
      await secondSeat.focus()
      const savedOther = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
      if (useMeaning) await first.page.getByRole('button', { name: 'Stick Riff Rider', exact: true }).click()
      else await first.page.keyboard.press('Enter')
      await savedOther
      expect((await readInventory(first.context)).placements.map((item) => item.stickerId)).toEqual(['PW-C02'])
      await secondSeat.click()
      const returnedOther = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
      await first.page.getByRole('button', { name: 'Return to sheet' }).click(); await returnedOther
      expect((await readInventory(first.context)).placements).toEqual([])
    }
    const locked = first.page.locator('[data-sticker-slot-state="locked"]').first()
    await locked.focus()
    await browserExpect(first.page.locator('#sticker-meaning')).toContainText('1 hr')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-locked-meaning.png') })
    const beforeLocked = (await readInventory(first.context)).placements
    const lockedBox = await locked.boundingBox()
    if (lockedBox === null) throw new Error('Locked seat missing')
    await first.page.mouse.move(lockedBox.x + lockedBox.width / 2, lockedBox.y + lockedBox.height / 2)
    await first.page.mouse.down(); await first.page.mouse.move(640, 450, { steps: 10 }); await first.page.mouse.up()
    expect((await readInventory(first.context)).placements).toEqual(beforeLocked)
    await first.page.getByRole('button', { name: 'Next sticker collection' }).click()
    await browserExpect(first.page.locator('[data-sticker-collection]')).toHaveAttribute('data-sticker-collection', 'electronic')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-electronic-sleeve.png') })
    await first.page.getByRole('button', { name: 'Open earned pack' }).click()
    await browserExpect(first.page.locator('[data-sticker-slot]')).toHaveCount(5)
    await browserExpect(first.page.locator('[data-sticker-slot-state="earned"]')).toHaveCount(1)
    await first.page.screenshot({ path: resolve(evidence, 'desktop-electronic-sheet.png') })
    await first.page.getByRole('button', { name: 'Previous sticker collection' }).click()
    await first.page.getByRole('button', { name: 'Open earned pack' }).click()
    await browserExpect(first.page.locator('[data-sticker-slot]')).toHaveCount(5)
    const peel = first.page.getByRole('button', { name: new RegExp(`^Peel ${art.name}`) })
    const peelBox = await peel.boundingBox()
    if (peelBox === null) throw new Error('Peel surface missing')
    const seatX = peelBox.x + peelBox.width / 2, seatY = peelBox.y + peelBox.height / 2
    await first.page.mouse.move(seatX, seatY); await first.page.mouse.down()
    await first.page.mouse.move(seatX + 30, seatY - 16, { steps: 4 })
    await first.page.screenshot({ path: resolve(evidence, 'desktop-peel-curl.png') })
    await first.page.mouse.move(seatX + 42, seatY - 23, { steps: 5 })
    await first.page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
    await first.page.screenshot({ path: resolve(evidence, 'desktop-peel-partly-attached.png') })
    await first.page.mouse.move(seatX + 50, seatY - 28, { steps: 5 })
    await first.page.screenshot({ path: resolve(evidence, 'desktop-peel-adhesive-contact.png') })
    await first.page.mouse.move(1190, 500, { steps: 8 })
    await first.page.screenshot({ path: resolve(evidence, 'desktop-peel-off-device.png') })
    await first.page.mouse.up()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    expect((await readInventory(first.context)).placements).toHaveLength(0)
    // Native capture loss while blended onto rear reverses the visual, never saves.
    await first.page.mouse.move(seatX, seatY); await first.page.mouse.down()
    await first.page.mouse.move(640, 450, { steps: 12 })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    await peel.evaluate((node) => { if (!node.hasPointerCapture(1)) throw new Error('Expected native mouse capture'); node.releasePointerCapture(1) })
    await first.page.mouse.move(641, 450); await first.page.mouse.up()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    expect((await readInventory(first.context)).placements).toHaveLength(0)
    const saved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
    await first.page.mouse.move(peelBox.x + peelBox.width / 2, peelBox.y + peelBox.height / 2)
    await first.page.mouse.down(); await first.page.mouse.move(640, 450, { steps: 12 })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-peel-landing.png') })
    await first.page.mouse.up(); await saved
    const placed = await readInventory(first.context)
    expect(placed.placements).toHaveLength(1)
    expect(placed.packs[0]?.openedAt !== null).toBe(true)
    await first.page.getByRole('button', { name: 'Put pack away' }).click()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'tease')
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-sheet-reveal', '0')
    const closedLip = await lip.boundingBox()
    expect(closedLip?.y).toBeGreaterThan(845)
    await lip.focus(); await first.page.keyboard.press('Enter')
    await first.page.getByRole('button', { name: 'Open earned pack' }).click()
    await browserExpect(first.page.locator('[data-sticker-slot]')).toHaveCount(5)
    await first.page.getByRole('button', { name: 'Put pack away' }).click()
    // The device lane can acquire and release native capture while the liner returns.
    const deviceStage = first.page.locator('.webpod-device-preview__stage')
    await first.page.mouse.move(450, 450); await first.page.mouse.down()
    await browserExpect(deviceStage).toHaveAttribute('data-orientation-grab', 'active')
    await first.page.mouse.move(560, 450, { steps: 12 }); await first.page.mouse.up()
    await browserExpect(deviceStage).not.toHaveAttribute('data-orientation-grab', 'active')
    await deviceStage.focus(); await first.page.keyboard.press('Home')
    await flipRear(first.page)
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-sheet-reveal', '0')
    const roundtripLip = await lip.boundingBox()
    expect(roundtripLip?.y).toBeGreaterThan(845)
    await captureRenderedSticker(first.page, 'browser-02-real-placement.png')
    const restored = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'POST' && response.status() === 200)
    await first.page.reload(); await restored
    const reloaded = await readInventory(first.context)
    expect(reloaded.placements).toEqual(placed.placements)
    expect(reloaded.packs).toEqual(placed.packs)
    await flipRear(first.page)
    await captureRenderedSticker(first.page, 'browser-03-reloaded.png')
    await first.page.setViewportSize({ width: 375, height: 812 })
    await first.page.emulateMedia({ reducedMotion: 'reduce' })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-reduced-motion', 'true')
    await first.page.getByRole('button', { name: 'Pull sticker pack into view' }).focus()
    await first.page.keyboard.press('Enter')
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await first.page.getByRole('button', { name: 'Open earned pack' }).click()
    await browserExpect(first.page.locator('[data-sticker-slot-state="placed"]')).toHaveCount(1)
    await captureSheet(first.page, 'mobile-open-sheet.png')
    await first.page.locator('[data-sticker-slot-state="locked"]').first().click()
    await browserExpect(first.page.locator('#sticker-meaning')).toBeVisible()
    await first.page.screenshot({ path: resolve(evidence, 'mobile-locked-meaning.png') })
    await first.page.getByRole('button', { name: 'Dismiss sticker meaning' }).click()
    await first.page.getByRole('button', { name: 'Next sticker collection' }).click()
    await first.page.getByRole('button', { name: 'Open earned pack' }).click()
    // Direct touch follows the rendered seat on a 375px viewport, including reduced motion.
    await captureSheet(first.page, 'mobile-electronic-sheet.png')
    const touchSeat = first.page.locator('[data-sticker-slot-state="earned"]').first()
    const touchBox = await touchSeat.boundingBox()
    if (touchBox === null) throw new Error('Mobile earned seat missing')
    const touch = await first.context.newCDPSession(first.page)
    const touchX = touchBox.x + touchBox.width / 2, touchY = touchBox.y + touchBox.height / 2
    // Real Start503 via its trusted service seam must restore packet and carry state.
    failNextPlacement = true
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 348, y: 360 }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230, y: 425 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    const rejected = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 503)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await rejected
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-workspace-lowering', '0')
    expect((await readInventory(first.context)).placements).toHaveLength(1)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 348, y: 360 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await first.page.screenshot({ path: resolve(evidence, 'mobile-reduced-motion-free-drag.png') })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 130, y: 170 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    await first.page.screenshot({ path: resolve(evidence, 'mobile-touch-placement-range.png') })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230, y: 425 }] })
    // A second valid target keeps stage='placing'; wait for its actual canvas paint.
    await first.page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
    let lowerPreview: Buffer | undefined
    await browserExpect.poll(async () => {
      lowerPreview = await first.page.screenshot()
      return first.page.evaluate(async (png) => {
        const source = new Image(); source.src = `data:image/png;base64,${png}`; await source.decode()
        const canvas = document.createElement('canvas'); canvas.width = 70; canvas.height = 70
        const context = canvas.getContext('2d'); if (context === null) return 0
        context.drawImage(source, 195, 390, 70, 70, 0, 0, 70, 70)
        const pixels = context.getImageData(0, 0, 70, 70).data
        let blue = 0
        for (let index = 0; index < pixels.length; index += 4) if ((pixels[index + 2] ?? 0) > (pixels[index] ?? 255) + 15) blue++
        return blue
      }, lowerPreview.toString('base64'))
    }, { message: 'The lower-rear Pulse Code preview must be visible before release' }).toBeGreaterThan(20)
    if (lowerPreview !== undefined) await writeFile(resolve(evidence, 'mobile-lower-rear-preview.png'), lowerPreview)
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    const touchSaved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touchSaved
    await first.page.screenshot({ path: resolve(evidence, 'mobile-touch-stuck.png') })
    await first.page.locator('[data-sticker-slot-state="placed"]').click()
    const touchRemoved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
    await first.page.getByRole('button', { name: 'Return to sheet' }).click(); await touchRemoved
    await touch.detach()
    const keyboardSticker = first.page.locator('[data-sticker-slot-state="earned"]').first()
    await keyboardSticker.focus(); await first.page.keyboard.press('ArrowUp')
    const keyboardSaved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
    await first.page.keyboard.press('Enter'); await keyboardSaved
    await browserExpect(first.page.locator('[data-sticker-slot-state="placed"]')).toHaveCount(1)
    await first.page.screenshot({ path: resolve(evidence, 'mobile-keyboard-stuck.png') })
    // Restore the baseline single placement so reload/recovery assertions remain exact.
    await first.page.locator('[data-sticker-slot-state="placed"]').click()
    const removed = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
    await first.page.getByRole('button', { name: 'Return to sheet' }).click(); await removed
    await first.page.getByRole('button', { name: 'Put pack away' }).click()
    await first.page.setViewportSize({ width: 1280, height: 900 })
    await first.page.getByRole('button', { name: 'Settings', exact: true }).click()
    const revoked = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'DELETE' && response.status() === 200)
    await first.page.getByRole('button', { name: 'Sign out of Apple Music', exact: true }).click(); await revoked
    await browserExpect(first.page.getByRole('button', { name: 'Sign in to Apple Music', exact: true })).toBeVisible()
    expect((await first.context.request.get(server.url.origin + '/api/stickers')).status()).toBe(401)
    const signedOutCookies = await first.context.cookies()
    expect(signedOutCookies.some((item) => item.name === 'webpod_device')).toBe(true)
    expect(signedOutCookies.some((item) => item.name === 'webpod_session')).toBe(false)
    await first.page.getByRole('button', { name: 'Close', exact: true }).click()
    now += 6_000 // Deterministic server policy clock; avoids a real cooldown sleep.
    await signIn(first.page)
    const recovered = await readInventory(first.context)
    expect(recovered.placements).toEqual(placed.placements)
    expect(recovered.packs).toEqual(placed.packs)
    expect(verifications).toBeGreaterThanOrEqual(2)
    const second = await open()
    expect((await second.context.request.get(server.url.origin + '/api/stickers')).status()).toBe(401)
    await signIn(second.page)
    const separate = await readInventory(second.context)
    expect(separate.placements).toHaveLength(0)
    expect(separate.packs[0]?.id).not.toBe(placed.packs[0]?.id)
    expect(separate.packs[0]?.openedAt).toBeNull()
    expect(signed).toBeGreaterThan(0)
    expect((await stat(databasePath)).size).toBeGreaterThan(0)
    expect(fingerprintBrowserSources()).toEqual(sourceFingerprint)
    const clientHash = createHash('sha256')
    const clientFiles = []
    for await (const path of new Bun.Glob('**/*').scan({ cwd: clientRoot, onlyFiles: true })) clientFiles.push(path)
    for (const path of clientFiles.sort()) { clientHash.update(path); clientHash.update(await readFile(resolve(clientRoot, path))) }
    const builtHash = createHash('sha256').update(await readFile(builtPath)).digest('hex')
    await writeFile(resolve(evidence, 'browser-verification.json'), JSON.stringify({ passed: true, sourceFingerprint, builtClientSha256: clientHash.digest('hex'), materialConstruction: 'fixed paper sleeve, translated release liner, laminated vinyl', nativeMobileTouch: true, simulatedServiceFailures, lowerRearVisiblePreview: true, twoEarnedKeyboardIdentity: true, closeAndFlickDuringLinerReturn: true, durationMs: Math.round(performance.now() - started), builtServerSha256: builtHash, routes: requests, appleVerifications: verifications, syntheticSignatures: signed, nativeHttpOnlyCookies: true, realSQLite: true, sameDeviceReloadAndReconnect: true, separateBrowserIsolation: true, apiInterceptions: 0 }, null, 2))
  } finally {
    const outcomes = []
    for (const dispose of cleanup.reverse()) outcomes.push(await Promise.allSettled([Promise.resolve().then(dispose)]))
    cleanupFailed = outcomes.some((results) => results.some((result) => result.status === 'rejected'))
  }
  if (cleanupFailed) throw new Error('Browser integration cleanup failed')
}, 120_000)
