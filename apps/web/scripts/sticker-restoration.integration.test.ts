import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect } from '@playwright/test'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { isStickerInventory, type StickerInventory } from '@webpod/stickers'
import { fingerprintBrowserSources } from '../../../scripts/browser-source-fingerprint'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const evidence = process.env.WEBPOD_STICKER_RESTORATION_EVIDENCE_DIR ?? resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/session-restoration')
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done }); return { promise, resolve } }

/** Actual built Start route, native cookies and SQLite; only trusted Apple/signing
 * dependencies are synthetic. No intercepted browser inventory/session endpoints. */
test('registered reload paints saved rear before SDK setup or passive Apple import, preserving concurrent access', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'webpod-session-restoration-'))
  const cleanup: (() => Promise<unknown>)[] = [() => rm(directory, { recursive: true, force: true })]
  let tokenGate: ReturnType<typeof deferred> | null = null
  let importGate: ReturnType<typeof deferred> | null = null
  try {
    const source = fingerprintBrowserSources()
    await mkdir(evidence, { recursive: true })
    let now = Date.now(), importAttempts = 0, tokenRequests = 0
    let failImport = false, failConfiguration = false
    const service = createLiveStickerServer({ databasePath: resolve(directory, 'collection.sqlite'), now: () => now, developerToken: async () => 'synthetic-developer', fetch: async (input, options) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/storefront')) return Response.json({ data: [{ id: 'us' }] })
      if (path.includes('/library/')) {
        importAttempts++
        if (importGate !== null) {
          const signal = options?.signal
          await Promise.race([importGate.promise, new Promise<never>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))])
        }
        if (failImport) return new Response('Synthetic upstream unavailable', { status: 503 })
        return Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: 240000, genreNames: ['Rock'] } }] })
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
      if (path === '/api/apple/developer-token') { tokenRequests++; if (tokenGate !== null) await tokenGate.promise; if (failConfiguration) return new Response('{}', { status: 503 }) }
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
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
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
    const placement = { stickerId: 'PW-C01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0 }
    expect((await context.request.put(origin + '/api/stickers/placements', { headers, data: { revision: 0, placements: [placement] } })).status()).toBe(200)
    const saved = await read()
    const seedAttempts = importAttempts
    now += 6000
    tokenGate = deferred(); importGate = deferred()
    const page = await context.newPage()
    await installDeterministicAppleMusic(page, { authorized: true, mockDeveloperToken: false })
    const turnRear = async (): Promise<void> => {
      await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
      const stage = page.locator('.webpod-device-preview__stage')
      await stage.focus(); await page.keyboard.press('Home')
      for (let step = 0; step < 15; step++) await page.keyboard.press('Shift+ArrowRight')
    }
    const painted = async (filename: string): Promise<void> => {
      let screenshot: Buffer | undefined
      await browserExpect.poll(async () => {
        screenshot = await page.screenshot()
        return page.evaluate(async (png) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160
          const ctx = canvas.getContext('2d'); if (ctx === null) return 0
          ctx.drawImage(image, 560, 370, 160, 160, 0, 0, 160, 160)
          const pixels = ctx.getImageData(0, 0, 160, 160).data; let ink = 0
          for (let i = 0; i < pixels.length; i += 4) if ((pixels[i] ?? 0) > 100 && (pixels[i] ?? 0) > (pixels[i + 1] ?? 255) * 1.1 && (pixels[i + 1] ?? 0) > (pixels[i + 2] ?? 255)) ink++
          return ink
        }, screenshot.toString('base64'))
      }, { message: 'Actual saved orange vinyl must paint while upstream is withheld', timeout: 10000 }).toBeGreaterThan(100)
      if (screenshot !== undefined) await writeFile(resolve(evidence, filename), screenshot)
    }
    await page.goto(origin + '/')
    await turnRear()
    await browserExpect.poll(() => tokenRequests).toBeGreaterThan(0)
    await painted('cold-valid-cookie-before-musickit.png')
    expect(importAttempts).toBe(seedAttempts)
    expect((await read()).placements).toEqual(saved.placements)
    tokenGate.resolve(); tokenGate = null
    await browserExpect.poll(() => importAttempts).toBeGreaterThan(seedAttempts)
    await painted('restored-while-apple-import-held.png')
    // Background ownership changes are made by the actual measured-listening
    // policy, not fabricated inventory; their publication waits for the import.
    for (let play = 0; play < 4; play++) for (let sequence = 0; sequence <= 15; sequence++) {
      now += 15000
      expect((await context.request.post(origin + '/api/stickers/listening', { headers, data: { eventId: `restore-${play}-${sequence}`, streamId: `restore-${play}`, sequence, catalogId: '123', positionMs: sequence * 15000, playing: true } })).status()).toBe(200)
    }
    expect((await read()).stickerIds).toContain('PW-C02')
    await page.getByRole('button', { name: 'Pull sticker pack into view' }).focus(); await page.keyboard.press('Enter')
    await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    const imported = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stickers/session' && response.request().method() === 'POST' && response.status() === 200)
    importGate.resolve(); importGate = null; await imported
    await browserExpect(page.locator('[data-sticker-collection]')).toContainText('2 OF 5 COLLECTED')
    await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open')
    expect((await read()).placements).toEqual(saved.placements)
    expect((await read()).placementRevision).toBe(saved.placementRevision)
    await painted('background-access-added-with-placement-intact.png')
    failImport = true; now += 6000
    await page.reload(); await turnRear()
    await painted('reload-with-failed-ingestion.png')
    await browserExpect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect((await read()).placements).toEqual(saved.placements)
    failImport = false; now += 6000
    await page.getByRole('button', { name: 'Try again' }).click()
    await browserExpect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    // A rejected SDK configuration is not proof that the native session expired.
    failConfiguration = true
    await page.reload(); await turnRear(); await painted('transient-musickit-failure-keeps-validated-rear.png')
    expect((await read()).placements).toEqual(saved.placements)
    failConfiguration = false
    // A successful SDK configuration confirming unauthorized is definitive,
    // unlike the transient rejection above: clear and revoke the native lease.
    await page.evaluate(() => sessionStorage.setItem('deterministic-musickit-authorized', 'false'))
    await page.reload()
    await browserExpect.poll(async () => (await context.request.get(origin + '/api/stickers')).status()).toBe(401)
    await turnRear()
    await browserExpect(page.locator('[data-sticker-placed]')).toHaveCount(0)
    await browserExpect(page.locator('[data-sticker-collection]')).toHaveCount(0)
    expect(fingerprintBrowserSources()).toEqual(source)
    await writeFile(resolve(evidence, 'native-verification.json'), JSON.stringify({ source, passed: true, nativeCookies: true, realSQLite: true, paintedBeforeSdk: true, paintedBeforeImport: true, failedImportPreservesPlacement: true, passiveAccessPublication: true, sdkFailureVsUnauthorized: true, requests }, null, 2))
  } finally {
    tokenGate?.resolve(); importGate?.resolve()
    const outcomes = []
    for (const dispose of cleanup.reverse()) outcomes.push(await Promise.allSettled([Promise.resolve().then(dispose)]))
    expect(outcomes.flat().filter((outcome) => outcome.status === 'rejected')).toEqual([])
  }
}, 120000)
