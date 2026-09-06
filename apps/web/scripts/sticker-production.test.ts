import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { startWebPod } from './start'

/** Real built Start SSR plus static server. All database state lives in a fresh private temp directory. */
test('production Bun entry serves public SSR and every immutable sticker asset', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'webpod-production-'))
  const previous = process.env['WEBPOD_STICKER_DATABASE_PATH']
  process.env['WEBPOD_STICKER_DATABASE_PATH'] = resolve(directory, 'collection.sqlite')
  const app = await startWebPod({ port: 0 })
  try {
    const page = await fetch(app.server.url)
    expect(page.status).toBe(200)
    const html = await page.text(); expect(html).toContain('<html')
    const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../assets/stickers/playworn/manifest.json'), 'utf8')) as { stickers: readonly { file: string; sha256: string }[] }
    expect(manifest.stickers).toHaveLength(60)
    for (const sticker of manifest.stickers) {
      const response = await fetch(new URL(`/stickers/playworn/${sticker.file}`, app.server.url))
      expect(response.status).toBe(200)
      expect(createHash('sha256').update(new Uint8Array(await response.arrayBuffer())).digest('hex')).toBe(sticker.sha256)
    }
    const response = await fetch(new URL('/api/stickers', app.server.url))
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
  } finally {
    await app.stop()
    if (previous === undefined) delete process.env['WEBPOD_STICKER_DATABASE_PATH']; else process.env['WEBPOD_STICKER_DATABASE_PATH'] = previous
    rmSync(directory, { recursive: true, force: true })
  }
})
