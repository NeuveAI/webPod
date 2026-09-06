import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect, type BrowserContext, type Page } from '@playwright/test'
import { handleAppleDeveloperTokenRequest } from '@webpod/server-core'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { getSticker, isStickerInventory, type StickerInventory } from '@webpod/stickers'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const evidence = resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/session')

/** Built production /, real Start endpoints, native browser cookies and isolated SQLite.
 * Only MusicKit and the server's trusted Apple/signing dependencies are synthetic.
 * No browser API interception, production test switch, alternate renderer or stored secrets. */
test('production browser signs in, collects, reloads, revokes and reconnects its device collection', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'webpod-sticker-browser-'))
  const cleanup: (() => Promise<unknown>)[] = [() => rm(directory, { recursive: true, force: true })]
  let cleanupFailed: boolean
  try {
  const databasePath = resolve(directory, 'collection.sqlite')
  const clientRoot = resolve(import.meta.dirname, '../dist/client')
  const builtPath = resolve(import.meta.dirname, '../dist/server/server.js')
  const started = performance.now()
  let now = Date.now()
  let verifications = 0
  let signed = 0
  const requests: { method: string; path: string; status: number }[] = []
  const service = createLiveStickerServer({
    databasePath, now: () => now, developerToken: async () => 'synthetic-developer',
    fetch: async (input) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/storefront')) { verifications++; return Response.json({ data: [{ id: 'us' }] }) }
      if (path.includes('/library/')) return Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: 240000, genreNames: ['Rock'] } }] })
      return Response.json({ data: [] })
    },
  })
  cleanup.push(() => service.dispose())
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
      const response = await entry.fetch(request, { context: { stickerServer: service, appleTokenOptions } })
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
    expect(initial.stickerIds).toHaveLength(1)
    expect(initial.packs).toHaveLength(1)
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
    const opened = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/packs/open' && response.status() === 200)
    await first.page.getByRole('button', { name: 'Open earned pack' }).click(); await opened
    const saved = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/placements' && response.request().method() === 'PUT' && response.status() === 200)
    const peel = first.page.getByRole('button', { name: new RegExp(`^Peel ${art.name}`) })
    const peelBox = await peel.boundingBox()
    if (peelBox === null) throw new Error('Peel surface missing')
    await first.page.mouse.move(peelBox.x + peelBox.width / 2, peelBox.y + peelBox.height / 2)
    await first.page.mouse.down(); await first.page.mouse.move(640, 450, { steps: 12 })
    await browserExpect(first.page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'placing')
    await first.page.mouse.up(); await saved
    const placed = await readInventory(first.context)
    expect(placed.placements).toHaveLength(1)
    expect(placed.packs[0]?.openedAt !== null).toBe(true)
    await first.page.getByRole('button', { name: 'Put pack away' }).click()
    await captureRenderedSticker(first.page, 'browser-02-real-placement.png')
    const restored = first.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'POST' && response.status() === 200)
    await first.page.reload(); await restored
    const reloaded = await readInventory(first.context)
    expect(reloaded.placements).toEqual(placed.placements)
    expect(reloaded.packs).toEqual(placed.packs)
    await flipRear(first.page)
    await captureRenderedSticker(first.page, 'browser-03-reloaded.png')
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
    const builtHash = createHash('sha256').update(await readFile(builtPath)).digest('hex')
    await writeFile(resolve(evidence, 'browser-verification.json'), JSON.stringify({ passed: true, durationMs: Math.round(performance.now() - started), builtServerSha256: builtHash, routes: requests, appleVerifications: verifications, syntheticSignatures: signed, nativeHttpOnlyCookies: true, realSQLite: true, sameDeviceReloadAndReconnect: true, separateBrowserIsolation: true, apiInterceptions: 0 }, null, 2))
  } finally {
    const outcomes = []
    for (const dispose of cleanup.reverse()) outcomes.push(await Promise.allSettled([Promise.resolve().then(dispose)]))
    cleanupFailed = outcomes.some((results) => results.some((result) => result.status === 'rejected'))
  }
  if (cleanupFailed) throw new Error('Browser integration cleanup failed')
}, 120_000)
