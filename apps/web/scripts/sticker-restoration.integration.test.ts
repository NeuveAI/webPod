import { expect, test } from 'bun:test'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect, type Page } from '@playwright/test'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const evidence = resolve(import.meta.dirname, '../../../docs/workstreams/020-browser-sticker-storage/evidence')

/** Actual production Start route + SQLite worker/OPFS. Only Apple dependencies are synthetic. */
test('local collection restores without Apple session and transfers through backup UI', async () => {
  await mkdir(evidence, { recursive: true })
  const clientRoot = resolve(import.meta.dirname, '../dist/client')
  const { default: entry } = await import(resolve(import.meta.dirname, '../dist/server/server.js')) as { default: { fetch(request: Request, options: { context: Record<string, unknown> }): Promise<Response> } }
  const paths: string[] = []
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    paths.push(path)
    const filePath = resolve(clientRoot, '.' + decodeURIComponent(path))
    if (request.method === 'GET' && filePath.startsWith(clientRoot + sep) && !path.split('/').some(part => part.startsWith('.')) && (await stat(filePath).catch(() => null))?.isFile()) return new Response(Bun.file(filePath))
    return entry.fetch(request, { context: { appleStickerOptions: {
      developerToken: async () => 'synthetic-developer',
      fetch: async (input: RequestInfo | URL) => String(input).endsWith('/storefront') ? Response.json({ data: [{ id: 'us' }] }) : Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: 240000, genreNames: ['Rock'] } }] }),
    } } })
  } })
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
    const page = await context.newPage()
    await installDeterministicAppleMusic(page, { authorized: true })
    const rear = async () => {
      await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
      await page.locator('.webpod-device-preview__stage').focus(); await page.keyboard.press('Home')
      for (let step = 0; step < 15; step++) await page.keyboard.press('Shift+ArrowRight')
    }
    const openBackups = async (target: Page) => {
      await target.getByRole('button', { name: 'Settings', exact: true }).click()
      const details = target.locator('details').filter({ has: target.getByText('Sticker backups', { exact: true }) })
      if (!(await details.evaluate(element => element.hasAttribute('open')))) await target.getByText('Sticker backups', { exact: true }).click()
    }
    const exported = async () => {
      await openBackups(page)
      const event = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export stickers', exact: true }).click()
      const download = await event
      const path = await download.path(); if (path === null) throw new Error('Missing backup download')
      const json = await readFile(path, 'utf8')
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      return json
    }
    await page.goto(server.url.origin + '/webpod')
    await rear()
    await browserExpect(page.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
    await browserExpect(page.getByRole('button', { name: 'Export stickers', exact: true })).toBeHidden()
    await page.screenshot({ path: resolve(evidence, 'browser-stickers-without-backup-banner.png') })
    const backup = await exported()
    const data = JSON.parse(backup)
    expect(data.format).toBe('webpod-stickers'); expect(data.packs[0].stickerIds).toContain('PW-C01')
    await page.evaluate(() => sessionStorage.setItem('deterministic-musickit-authorized', 'false'))
    await page.reload(); await rear()
    const restored = JSON.parse(await exported())
    expect(restored.packs).toEqual(data.packs)
    // Restore on a genuinely fresh origin storage partition through the user controls.
    await context.clearCookies()
    const second = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
    const fresh = await second.newPage()
    await installDeterministicAppleMusic(fresh, { authorized: false })
    await fresh.goto(server.url.origin + '/webpod')
    await browserExpect(fresh.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
    await fresh.locator('.webpod-device-preview__stage').focus(); await fresh.keyboard.press('Home')
    for (let step = 0; step < 15; step++) await fresh.keyboard.press('Shift+ArrowRight')
    await openBackups(fresh)
    await fresh.getByLabel('Choose sticker backup').setInputFiles({ name: 'webpod-stickers.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
    await fresh.getByRole('button', { name: 'Replace collection', exact: true }).click()
    await browserExpect(fresh.getByRole('status').filter({ hasText: 'Backup complete.' })).toBeVisible()
    await fresh.screenshot({ path: resolve(evidence, 'browser-local-backup-success.png') })
    await fresh.getByLabel('Choose sticker backup').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":999}') })
    await fresh.getByRole('button', { name: 'Replace collection', exact: true }).click()
    await browserExpect(fresh.getByRole('status').filter({ hasText: 'Backup could not complete' })).toBeVisible()
    await fresh.screenshot({ path: resolve(evidence, 'browser-local-backup.png') })
    await fresh.getByRole('button', { name: 'Close', exact: true }).click()
    await browserExpect(fresh.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
    await browserExpect(fresh.getByRole('button', { name: 'Export stickers', exact: true })).toBeHidden()
    // A restored failed-import flag cannot be retried while signed out. Its
    // visible action must authorize from the user's click, then sync locally.
    await openBackups(fresh)
    const paused = { ...data, collection: { ...data.collection, importStatus: 'failed' } }
    await fresh.getByLabel('Choose sticker backup').setInputFiles({ name: 'paused.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(paused)) })
    await fresh.getByRole('button', { name: 'Replace collection', exact: true }).click()
    await browserExpect(fresh.getByRole('status').filter({ hasText: 'Backup complete.' })).toBeVisible()
    await fresh.getByRole('button', { name: 'Close', exact: true }).click()
    await browserExpect(fresh.getByRole('button', { name: 'Try again', exact: true })).toBeHidden()
    const sync = fresh.waitForResponse(response => new URL(response.url()).pathname === '/api/apple/stickers' && response.status() === 200)
    await fresh.getByRole('button', { name: 'Sign in to Apple Music', exact: true }).click()
    await sync
    await browserExpect(fresh.getByText('Library sync paused.', { exact: false })).toBeHidden()
    await browserExpect(fresh.getByRole('button', { name: 'Pull sticker pack into view' })).toBeVisible()
    await fresh.screenshot({ path: resolve(evidence, 'browser-paused-sync-reconnected.png') })
    expect(paths.filter(path => path.startsWith('/api/stickers'))).toEqual([])
    await writeFile(resolve(evidence, 'restoration.json'), JSON.stringify({ passed: true, localPersistence: true, unauthorizedRestoration: true, backupTransfer: true, invalidBackupPreserved: true, signedOutReconnect: true, oldCookieRequests: 0 }, null, 2))
  } finally { await browser.close(); await server.stop(true) }
}, 120000)
