import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

/** A fresh process exercises Vercel startup without sharing the built server singleton. */
test('production serves the page without storage and fails sticker requests safely', async () => {
  const script = `
    import { startWebPod } from './apps/web/scripts/start.ts'
    const app = await startWebPod({ port: 0 })
    try {
      const page = await fetch(app.server.url)
      const html = await page.text()
      const stickers = await fetch(new URL('/api/stickers', app.server.url))
      console.log(JSON.stringify({ page: page.status, html: html.includes('<html'),
        stickers: stickers.status, cache: stickers.headers.get('cache-control'),
        body: await stickers.json() }))
    } finally { await app.stop() }
  `
  const process = Bun.spawn(['bun', '-e', script], {
    cwd: resolve(import.meta.dirname, '../../..'),
    env: { PATH: Bun.env['PATH'], NODE_ENV: 'production', VERCEL: '1' },
    stdout: 'pipe', stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited,
  ])
  expect(stderr).toBe('')
  expect(code).toBe(0)
  expect(JSON.parse(stdout)).toEqual({
    page: 200, html: true, stickers: 503, cache: 'no-store',
    body: { code: 'unavailable', message: 'Your sticker collection is temporarily unavailable.' },
  })
})
