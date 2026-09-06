import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect, type BrowserContext, type Page } from '@playwright/test'
import { handleAppleDeveloperTokenRequest } from '@webpod/server-core'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { getSticker, isStickerInventory, type StickerInventory, type StickerPlacement } from '@webpod/stickers'
import { fingerprintBrowserSources } from '../../../scripts/browser-source-fingerprint'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const evidence = process.env.WEBPOD_STICKER_EVIDENCE_DIR ?? resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/tactile-collection/browser')

/** Native drag of the exposed liner, including a visibly intermediate position. */
async function pullLiner(page: Page): Promise<void> {
  const handle = page.getByRole('button', { name: 'Pull sticker liner open' })
  await browserExpect(handle).toBeVisible()
  const box = await handle.boundingBox()
  const pack = await page.locator('[data-sticker-collection]').boundingBox()
  if (box === null || pack === null) throw new Error('Physical liner handle missing')
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  if ((page.viewportSize()?.width ?? 1280) < 960) {
    const touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let step = 1; step <= 16; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.max(2, y - pack.height * .8 * step / 16) }] })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally { await touch.detach() }
  } else {
    await page.mouse.move(x, y); await page.mouse.down()
    await page.mouse.move(x, y - pack.height * .8, { steps: 16 }); await page.mouse.up()
  }
  await browserExpect(page.locator('[data-sticker-slot]')).toHaveCount(5)
}

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
  let releaseArtwork!: () => void
  const artworkGate = new Promise<void>((resolve) => { releaseArtwork = resolve })
  let heldArtworkRequests = 0
  let artworkReleased = false
  let failFirstArtwork = true
  let lockedArtworkGate: Promise<void> | null = null
  let heldLockedArtwork = 0
  let importMode: 'complete' | 'partial' | 'failed' = 'complete'
  let conflictNextPlacement = false
  let placementGate: Promise<void> | null = null
  let heldPlacement = false
  let failNextPlacement = false
  let simulatedServiceFailures = 0
  const requests: { method: string; path: string; status: number }[] = []
  const service = createLiveStickerServer({
    databasePath, now: () => now, developerToken: async () => 'synthetic-developer',
    fetch: async (input) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/storefront')) { verifications++; return Response.json({ data: [{ id: 'us' }] }) }
      if (path.includes('/library/') && importMode === 'failed') return new Response('Synthetic Apple outage', { status: 503 })
      if (path.includes('/library/')) return Response.json({ ...(importMode === 'partial' ? { next: `/v1/me/library/songs?offset=${Number(new URL(String(input)).searchParams.get('offset') ?? 0) + 100}` } : {}), data: ['Rock', 'Electronic', 'Jazz'].map((genre, index) => ({ attributes: { playParams: { catalogId: String(123 + index) }, durationInMillis: 240000, genreNames: [genre] } })) })
      return Response.json({ data: [] })
    },
  })
  cleanup.push(() => service.dispose())
  const httpService = { ...service, handle: async (request: Request) => {
    if (new URL(request.url).pathname === '/api/stickers/placements') {
      if (placementGate !== null) { heldPlacement = true; await placementGate; placementGate = null }
      if (conflictNextPlacement) {
        conflictNextPlacement = false
        const body = await request.clone().json() as { revision: number; placements: StickerPlacement[] }
        const concurrent = new Request(request.url, { method: 'PUT', headers: request.headers, body: JSON.stringify({ ...body, placements: body.placements.map((item) => item.stickerId === 'PW-C01' ? { ...item, x: .55, y: .45, width: .18, rotationDeg: 23 } : item) }) })
        const result = await service.handle(concurrent)
        if (result.status !== 200) throw new Error('Concurrent native fixture write failed')
      }
    }
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
      if (!artworkReleased && pathname.startsWith('/stickers/') && pathname.endsWith('.png')) { heldArtworkRequests++; await artworkGate }
      if (lockedArtworkGate !== null && pathname.includes('pw-c05-')) { heldLockedArtwork++; await lockedArtworkGate }
      if (failFirstArtwork && pathname.includes('pw-c05-')) { failFirstArtwork = false; return new Response('Synthetic artwork unavailable', { status: 503 }) }
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
      const region = await page.locator('[data-sticker-placed="PW-C01"]').boundingBox()
      if (region === null) return 0
      return page.evaluate(async ({ png, region }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${png}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = 200; canvas.height = 250
        const context = canvas.getContext('2d')
        if (context === null) return 0
        // Actual orange Rock artwork pixels in the rear landing region; a blank
        // canvas, DOM lip or silver backplate cannot satisfy this assertion.
        context.drawImage(image, region.x - 38, region.y - 48, 120, 140, 0, 0, 200, 250)
        const pixels = context.getImageData(0, 0, 200, 250).data
        let artwork = 0
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i] ?? 0, g = pixels[i + 1] ?? 0, b = pixels[i + 2] ?? 0
          if (r > 100 && g > 40 && b < g * .9 && r > g * 1.1) artwork++
        }
        return artwork
      }, { png: capture.toString('base64'), region })
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
  const flipRear = async (page: Page, ready = true): Promise<void> => {
    const stage = page.locator('.webpod-device-preview__stage')
    await stage.focus(); await page.keyboard.press('Home')
    for (let step = 0; step < 15; step++) await page.keyboard.press('Shift+ArrowRight')
    if (ready) await browserExpect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
  }
    await mkdir(evidence, { recursive: true })
    const first = await open()
    expect((await first.context.request.get(server.url.origin + '/api/stickers')).status()).toBe(401)
    await flipRear(first.page, false)
    await browserExpect(first.page.locator('[data-sticker-collection]')).toHaveCount(0)
    await signIn(first.page)
    const initial = await readInventory(first.context)
    expect(initial.stickerIds).toHaveLength(3)
    expect(initial.packs).toHaveLength(1)
    await browserExpect.poll(() => heldArtworkRequests).toBeGreaterThanOrEqual(5)
    await browserExpect(first.page.locator('[data-sticker-collection]')).toHaveCount(0)
    await browserExpect(first.page.getByRole('button', { name: 'Pull sticker pack into view' })).toHaveCount(0)
    await first.page.screenshot({ path: resolve(evidence, 'desktop-owned-assets-pending.png') })
    artworkReleased = true; releaseArtwork()
    await browserExpect(first.page.getByRole('button', { name: 'Retry artwork' })).toBeVisible()
    await browserExpect(first.page.locator('[data-sticker-collection]')).toHaveCount(0)
    await first.page.screenshot({ path: resolve(evidence, 'desktop-first-artwork-failure.png') })
    await first.page.getByRole('button', { name: 'Retry artwork' }).click()
    await browserExpect(first.page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
    await first.page.screenshot({ path: resolve(evidence, 'desktop-first-ready-tease.png') })
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
    await browserExpect(lip).toBeVisible()
    const lipBox = await lip.boundingBox()
    if (lipBox === null) throw new Error('Pack lip missing')
    await first.page.mouse.move(lipBox.x + lipBox.width / 2, lipBox.y + lipBox.height / 2)
    await first.page.mouse.down(); await first.page.mouse.move(lipBox.x + lipBox.width / 2, lipBox.y - 180, { steps: 12 }); await first.page.mouse.up()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-sealed-sleeve.png') })
    await pullLiner(first.page)
    await browserExpect.poll(async () => (await readInventory(first.context)).packs.filter((pack) => pack.openedAt === null).length).toBe(0)
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
    await pullLiner(first.page)
    await browserExpect(first.page.locator('[data-sticker-slot]')).toHaveCount(5)
    await browserExpect(first.page.locator('[data-sticker-slot-state="earned"]')).toHaveCount(1)
    await first.page.screenshot({ path: resolve(evidence, 'desktop-electronic-sheet.png') })
    await first.page.getByRole('button', { name: 'Previous sticker collection' }).click()
    await pullLiner(first.page)
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
    const contact = first.page.waitForFunction(() => { const element = document.querySelector('[data-sticker-peel]'); const peel = Number(element?.getAttribute('data-sticker-peel')); return peel > .05 && peel < .35 }, undefined, { timeout: 5000 })
    await first.page.screenshot({ path: resolve(evidence, 'desktop-progressive-press-0.png') })
    await contact
    await first.page.screenshot({ path: resolve(evidence, 'desktop-progressive-contact-mid.png') })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-progressive-press-rest.png') })
    const placed = await readInventory(first.context)
    expect(placed.placements).toHaveLength(1)
    expect(placed.packs[0]?.openedAt !== null).toBe(true)
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    const equipped = first.page.locator('[data-sticker-placed="PW-C01"]')
    const equippedBox = await equipped.boundingBox()
    if (equippedBox === null) throw new Error('Placed print semantic projection missing')
    const grabX = equippedBox.x + equippedBox.width / 2 + 4, grabY = equippedBox.y + equippedBox.height / 2
    await first.page.mouse.move(grabX, grabY); await first.page.mouse.down()
    await first.page.mouse.move(grabX + 48, grabY, { steps: 6 })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-rear-partial-lift.png') })
    await first.page.mouse.move(700, 310, { steps: 12 })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-rear-move-preview.png') })
    const moved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 200)
    await first.page.mouse.up(); await moved
    let movedInventory = await readInventory(first.context)
    expect(movedInventory.placements).toHaveLength(1)
    expect(movedInventory.placements[0]?.x).not.toBe(placed.placements[0]?.x)
    expect(movedInventory.placements[0]?.width).toBe(placed.placements[0]?.width)
    expect(movedInventory.placements[0]?.rotationDeg).toBe(placed.placements[0]?.rotationDeg)
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    const pickRear = async (): Promise<void> => {
      const origin = await equipped.boundingBox()
      if (origin === null) throw new Error('Rear source missing')
      await first.page.mouse.move(origin.x + 22, origin.y + 22); await first.page.mouse.down()
      await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    }
    // Real optimistic-revision conflict changes the authoritative transform in
    // SQLite; the rejected move must reconcile, not resurrect its saved origin.
    conflictNextPlacement = true
    await pickRear(); await first.page.mouse.move(620, 430, { steps: 12 })
    const conflicted = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 409)
    await first.page.mouse.up(); await conflicted
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    movedInventory = await readInventory(first.context)
    expect(movedInventory.placements[0]).toMatchObject({ x: .55, y: .45, width: .18, rotationDeg: 23 })
    await first.page.screenshot({ path: resolve(evidence, 'desktop-authoritative-conflict-reconciled.png') })
    // Cancellation while native persistence is pending supersedes presentation,
    // while the eventual permitted server outcome still becomes authoritative.
    let finishPlacement!: () => void
    placementGate = new Promise<void>((resolve) => { finishPlacement = resolve })
    await pickRear(); await first.page.mouse.move(760, 300, { steps: 12 }); await first.page.mouse.move(655, 410, { steps: 12 })
    const late = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 200)
    void late.catch(() => {}) // Preserve the primary assertion if cleanup closes a failed probe.
    await first.page.mouse.up(); await browserExpect.poll(() => heldPlacement).toBe(true)
    await first.page.keyboard.press('Escape')
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    finishPlacement(); await late
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    movedInventory = await readInventory(first.context)
    expect(movedInventory.placements[0]?.width).toBe(.18)
    expect(movedInventory.placements[0]?.rotationDeg).toBe(23)
    await first.page.getByRole('button', { name: 'Put pack away' }).click()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'tease')
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-sheet-reveal', '0')
    const closedLip = await lip.boundingBox()
    expect(closedLip?.y).toBeGreaterThan(845)
    await lip.focus(); await first.page.keyboard.press('Enter')
    await pullLiner(first.page)
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
    // Existing rear vinyl remains a live gesture surface while a locked image on
    // its own sheet is withheld. Readiness must not gate its animation or host size.
    await first.page.setViewportSize({ width: 375, height: 812 })
    await first.page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
    const unreadyOrigin = await equipped.boundingBox()
    if (unreadyOrigin === null) throw new Error('Existing rear origin missing before artwork reload')
    let releaseLocked!: () => void
    lockedArtworkGate = new Promise<void>((resolve) => { releaseLocked = resolve })
    await first.page.reload(); await flipRear(first.page, false)
    await browserExpect.poll(() => heldLockedArtwork).toBeGreaterThan(0)
    await browserExpect(first.page.locator('[data-sticker-collection]')).toHaveCount(0)
    // Verify the saved orange print actually painted before touching its known
    // physical coordinates, rather than relying on an absent semantic overlay.
    await browserExpect.poll(async () => {
      const png = await first.page.screenshot()
      return first.page.evaluate(async ({ png, point }) => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = 44; canvas.height = 44
        const context = canvas.getContext('2d'); if (context === null) return 0
        context.drawImage(image, point.x, point.y, 44, 44, 0, 0, 44, 44)
        const pixels = context.getImageData(0, 0, 44, 44).data; let orange = 0
        for (let i = 0; i < pixels.length; i += 4) if ((pixels[i] ?? 0) > (pixels[i + 1] ?? 255) * 1.1 && (pixels[i + 1] ?? 0) > (pixels[i + 2] ?? 255)) orange++
        return orange
      }, { png: png.toString('base64'), point: unreadyOrigin })
    }).toBeGreaterThan(20)
    const pendingTouch = await first.context.newCDPSession(first.page)
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: unreadyOrigin.x + 22, y: unreadyOrigin.y + 22 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 340, y: 330 }] })
    await first.page.screenshot({ path: resolve(evidence, 'mobile-rear-carry-own-art-pending.png') })
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveCount(0)
    expect((await readInventory(first.context)).placements).toEqual(movedInventory.placements)
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: unreadyOrigin.x + 22, y: unreadyOrigin.y + 22 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 340, y: 330 }] })
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 300 }] })
    const unreadySave = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 200)
    await pendingTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await unreadySave
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveCount(0)
    movedInventory = await readInventory(first.context)
    await pendingTouch.detach(); lockedArtworkGate = null; releaseLocked()
    await browserExpect(first.page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'tease')
    await first.page.screenshot({ path: resolve(evidence, 'mobile-ready-after-unready-rear-carry.png') })
    await first.page.setViewportSize({ width: 1280, height: 900 })
    const restored = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'POST' && response.status() === 200)
    await first.page.reload(); await restored
    const reloaded = await readInventory(first.context)
    expect(reloaded.placements).toEqual(movedInventory.placements)
    expect(reloaded.packs).toEqual(placed.packs)
    await flipRear(first.page)
    await captureRenderedSticker(first.page, 'browser-03-reloaded.png')
    await lip.focus(); await first.page.keyboard.press('Enter'); await pullLiner(first.page)
    const returnOrigin = await first.page.locator('[data-sticker-placed="PW-C01"]').boundingBox()
    const returnSeat = await first.page.locator('[data-sticker-slot="PW-C01"]').boundingBox()
    if (returnOrigin === null || returnSeat === null) throw new Error('Own-sheet return target missing')
    await first.page.mouse.move(returnOrigin.x + returnOrigin.width / 2, returnOrigin.y + returnOrigin.height / 2)
    await first.page.mouse.down(); await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling'); await first.page.mouse.move(returnSeat.x + returnSeat.width / 2, returnSeat.y + returnSeat.height / 2, { steps: 18 })
    await first.page.screenshot({ path: resolve(evidence, 'desktop-own-seat-drop.png') })
    const returnedToSeat = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 200)
    await first.page.mouse.up(); await returnedToSeat
    for (let frame = 0; frame < 3; frame++) {
      await first.page.screenshot({ path: resolve(evidence, `desktop-own-seat-return-${frame}.png`) })
      await first.page.evaluate(() => new Promise<void>((done) => { let frames = 0; const next = (): void => { if (++frames >= 6) done(); else requestAnimationFrame(next) }; requestAnimationFrame(next) }))
    }
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await first.page.screenshot({ path: resolve(evidence, 'desktop-own-seat-return-rest.png') })
    expect((await readInventory(first.context)).placements).toHaveLength(0)
    await first.page.reload(); await flipRear(first.page)
    expect((await readInventory(first.context)).placements).toHaveLength(0)
    await lip.focus(); await first.page.keyboard.press('Enter'); await pullLiner(first.page)
    const reappliedSeat = await first.page.locator('[data-sticker-slot="PW-C01"]').boundingBox()
    if (reappliedSeat === null) throw new Error('Returned sheet print missing')
    await first.page.mouse.move(reappliedSeat.x + reappliedSeat.width / 2, reappliedSeat.y + reappliedSeat.height / 2)
    await first.page.mouse.down(); await first.page.mouse.move(700, 310, { steps: 16 })
    const reapplied = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 200)
    await first.page.mouse.up(); await reapplied
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    const finalRockInventory = await readInventory(first.context)
    await first.page.setViewportSize({ width: 375, height: 812 })
    await first.page.emulateMedia({ reducedMotion: 'reduce' })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-reduced-motion', 'true')
    await first.page.getByRole('button', { name: 'Pull sticker pack into view' }).focus()
    await first.page.keyboard.press('Enter')
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    await first.page.screenshot({ path: resolve(evidence, 'mobile-sealed-sleeve.png') })
    await pullLiner(first.page)
    await browserExpect(first.page.locator('[data-sticker-slot-state="placed"]')).toHaveCount(1)
    await captureSheet(first.page, 'mobile-open-sheet.png')
    await first.page.locator('[data-sticker-slot-state="locked"]').first().click()
    await browserExpect(first.page.locator('#sticker-meaning')).toBeVisible()
    await first.page.screenshot({ path: resolve(evidence, 'mobile-locked-meaning.png') })
    await first.page.getByRole('button', { name: 'Dismiss sticker meaning' }).click()
    await first.page.getByRole('button', { name: 'Next sticker collection' }).click()
    await pullLiner(first.page)
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
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    const mobilePlaced = (await readInventory(first.context)).placements.find((item) => item.stickerId !== 'PW-C01')
    if (mobilePlaced === undefined) throw new Error('Touch placement missing')
    await first.page.getByRole('button', { name: 'Put pack away' }).click()
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'tease')
    const mobileOrigin = await first.page.locator(`[data-sticker-placed="${mobilePlaced.stickerId}"]`).boundingBox()
    if (mobileOrigin === null) throw new Error('Touch rear origin missing')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mobileOrigin.x + 22, y: mobileOrigin.y + 22 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 280 }] })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    await first.page.screenshot({ path: resolve(evidence, 'mobile-rear-move-preview.png') })
    const mobileMoved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === 200)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await mobileMoved
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    const movedMobile = (await readInventory(first.context)).placements.find((item) => item.stickerId === mobilePlaced.stickerId)
    expect(movedMobile?.width).toBe(mobilePlaced.width)
    expect(movedMobile?.rotationDeg).toBe(mobilePlaced.rotationDeg)
    expect(movedMobile?.y).not.toBe(mobilePlaced.y)
    // A physical bottom approach exposes the sticker's own pack. The first save
    // fails at the native service; the original authoritative placement survives.
    for (const reject of [true, false]) {
      const origin = await first.page.locator(`[data-sticker-placed="${mobilePlaced.stickerId}"]`).boundingBox()
      if (origin === null) throw new Error('Moved touch origin missing')
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: origin.x + 22, y: origin.y + 22 }] })
      await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330, y: 790 }] })
      const ownSeat = first.page.locator(`[data-sticker-slot="${mobilePlaced.stickerId}"]`)
      await browserExpect(ownSeat).toBeVisible()
      const seat = await ownSeat.boundingBox()
      if (seat === null) throw new Error('Own mobile return seat missing')
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: seat.x + seat.width / 2, y: seat.y + seat.height / 2 }] })
      let heldCapture: Buffer | undefined
      await browserExpect.poll(async () => {
        heldCapture = await first.page.screenshot()
        return first.page.evaluate(async ({ png, seat }) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = Math.ceil(seat.width); canvas.height = Math.ceil(seat.height)
          const context = canvas.getContext('2d'); if (context === null) return 0
          context.drawImage(image, seat.x, seat.y, seat.width, seat.height, 0, 0, canvas.width, canvas.height)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          let blue = 0
          for (let i = 0; i < pixels.length; i += 4) if ((pixels[i + 2] ?? 0) > (pixels[i] ?? 255) + 15) blue++
          return blue
        }, { png: heldCapture.toString('base64'), seat })
      }, { message: 'Held Pulse Code must visibly follow touch over its own seat before release' }).toBeGreaterThan(20)
      if (heldCapture !== undefined) await writeFile(resolve(evidence, reject ? 'mobile-own-seat-before-failure.png' : 'mobile-own-seat-drop.png'), heldCapture)
      failNextPlacement = reject
      const returned = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.status() === (reject ? 503 : 200))
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await returned
      await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
      const authoritative = (await readInventory(first.context)).placements.find((item) => item.stickerId === mobilePlaced.stickerId)
      if (reject) expect(authoritative).toEqual(movedMobile)
      else expect(authoritative).toBeUndefined()
    }
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
    expect(recovered.placements).toEqual(finalRockInventory.placements)
    expect(recovered.packs).toEqual(placed.packs)
    expect(verifications).toBeGreaterThanOrEqual(2)
    const second = await open()
    expect((await second.context.request.get(server.url.origin + '/api/stickers')).status()).toBe(401)
    await signIn(second.page)
    const separate = await readInventory(second.context)
    expect(separate.placements).toHaveLength(0)
    expect(separate.packs[0]?.id).not.toBe(placed.packs[0]?.id)
    expect(separate.packs[0]?.openedAt).toBeNull()
    // Status fixtures use native imports and distinct real device sessions.
    importMode = 'partial'
    const partial = await open(); await signIn(partial.page); await flipRear(partial.page)
    expect((await readInventory(partial.context)).importStatus).toBe('partial')
    await browserExpect(partial.page.getByRole('status')).toContainText('Your stickers are ready.')
    await partial.page.screenshot({ path: resolve(evidence, 'desktop-partial-sync-status.png') })
    await partial.page.setViewportSize({ width: 375, height: 812 })
    await partial.page.screenshot({ path: resolve(evidence, 'mobile-partial-sync-status.png') })
    importMode = 'failed'
    const failure = await open(); await signIn(failure.page); await flipRear(failure.page, false)
    await browserExpect(failure.page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await browserExpect(failure.page.locator('[data-sticker-collection]')).toHaveCount(0)
    await failure.page.screenshot({ path: resolve(evidence, 'desktop-failed-sync-status.png') })
    await failure.page.setViewportSize({ width: 375, height: 812 })
    await failure.page.screenshot({ path: resolve(evidence, 'mobile-failed-sync-status.png') })
    importMode = 'complete'; now += 6000
    await failure.page.getByRole('button', { name: 'Try again' }).click()
    await browserExpect(failure.page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
    expect(signed).toBeGreaterThan(0)
    expect((await stat(databasePath)).size).toBeGreaterThan(0)
    expect(fingerprintBrowserSources()).toEqual(sourceFingerprint)
    const clientHash = createHash('sha256')
    const clientFiles = []
    for await (const path of new Bun.Glob('**/*').scan({ cwd: clientRoot, onlyFiles: true })) clientFiles.push(path)
    for (const path of clientFiles.sort()) { clientHash.update(path); clientHash.update(await readFile(resolve(clientRoot, path))) }
    const builtHash = createHash('sha256').update(await readFile(builtPath)).digest('hex')
    await writeFile(resolve(evidence, 'browser-verification.json'), JSON.stringify({ passed: true, sourceFingerprint, builtClientSha256: clientHash.digest('hex'), materialConstruction: 'matte-laminated printed sleeve with raw edges, translated release liner, laminated vinyl', nativeMobileTouch: true, simulatedServiceFailures, lowerRearVisiblePreview: true, twoEarnedKeyboardIdentity: true, closeAndFlickDuringLinerReturn: true, durationMs: Math.round(performance.now() - started), builtServerSha256: builtHash, routes: requests, appleVerifications: verifications, syntheticSignatures: signed, nativeHttpOnlyCookies: true, realSQLite: true, sameDeviceReloadAndReconnect: true, separateBrowserIsolation: true, apiInterceptions: 0 }, null, 2))
  } finally {
    const outcomes = []
    for (const dispose of cleanup.reverse()) outcomes.push(await Promise.allSettled([Promise.resolve().then(dispose)]))
    cleanupFailed = outcomes.some((results) => results.some((result) => result.status === 'rejected'))
  }
  if (cleanupFailed) throw new Error('Browser integration cleanup failed')
}, 120_000)
