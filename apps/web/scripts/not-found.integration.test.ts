import { expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { chromium, expect as browserExpect } from '@playwright/test'
import { prepareBrowserSourceSnapshot } from '../../../scripts/browser-source-fingerprint'

const evidence = resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/session')
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
const missingPaths = ['/missing-page', '/_spike/device/missing-child', '/favicon.ico']

test('built Start returns useful404 for unmatched paths and preserves root200', async () => {
  const warnings = spyOn(console, 'warn')
  try {
    const built = resolve(import.meta.dirname, '../dist/server/server.js')
    const { default: entry } = await import(built) as { default: { fetch(request: Request): Promise<Response> } }
    for (const path of missingPaths) {
      const response = await entry.fetch(new Request(`http://localhost${path}`))
      expect(response.status).toBe(404)
      const body = await response.text()
      expect(body).toContain('This page isn’t here.')
      expect(body).toContain('Return to player')
      expect(body).toContain('href="/"')
    }
    const root = await entry.fetch(new Request('http://localhost/'))
    expect(root.status).toBe(200)
    expect(await root.text()).not.toContain('This page isn’t here.')
    expect(warnings.mock.calls.flat().some((item) => String(item).includes('notFoundComponent'))).toBe(false)
  } finally { warnings.mockRestore() }
})

test('shipped dev missing routes stay404 and keyboard return opens the actual player', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'webpod-not-found-'))
  let child: ReturnType<typeof Bun.spawn> | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let output = ''
  const pumps: Promise<void>[] = []
  let cleanupFailed: boolean
  try {
    const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot: resolve(import.meta.dirname, '../../..'), snapshotRoot: resolve(directory, 'source') })
    const env = { PATH: process.env['PATH'] ?? '', APPLE_TEAM_ID: '', APPLE_MUSICKIT_KEY_ID: '', APPLE_MUSICKIT_KEY_PATH: '', APPLE_TOKEN_TTL_SECONDS: '', WEBPOD_STICKER_DATABASE_PATH: resolve(directory, 'stickers.sqlite') }
    const installed = Bun.spawnSync(['bun', 'install', '--frozen-lockfile', '--ignore-scripts'], { cwd: snapshot.snapshotRoot, env, stdout: 'pipe', stderr: 'pipe' })
    expect(installed.exitCode).toBe(0)
    const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(null) })
    const port = probe.port; await probe.stop(true)
    const origin = `http://127.0.0.1:${String(port)}`
    child = Bun.spawn(['bun', 'run', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: snapshot.snapshotRoot, env, detached: true, stdout: 'pipe', stderr: 'pipe' })
    const collect = async (stream: ReadableStream<Uint8Array>) => { for await (const bytes of stream) output = (output + new TextDecoder().decode(bytes)).slice(-32_768) }
    if (child.stdout instanceof ReadableStream) pumps.push(collect(child.stdout))
    if (child.stderr instanceof ReadableStream) pumps.push(collect(child.stderr))
    const deadline = Date.now() + 45_000
    let ready = false
    while (Date.now() < deadline && child.exitCode === null) {
      ready = await fetch(origin + '/@vite/client', { signal: AbortSignal.timeout(1000) }).then((r) => r.ok).catch(() => false)
      if (ready) break
      await pause(100)
    }
    if (!ready) throw new Error(`Isolated credential-free dev server did not start: ${output.slice(-1500)}`)
    for (const path of missingPaths) {
      const response = await fetch(origin + path)
      expect(response.status).toBe(404)
      expect(await response.text()).toContain('Return to player')
    }
    browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
    const configurationWarnings: string[] = []
    const missingRequests = new Set<string>()
    page.on('console', (message) => { if (message.text().includes('notFoundComponent')) configurationWarnings.push(message.text()) })
    page.on('response', (response) => { if (response.status() === 404 && response.url().startsWith(origin)) missingRequests.add(new URL(response.url()).pathname) })
    expect((await page.goto(origin + '/missing-page'))?.status()).toBe(404)
    await browserExpect(page.getByRole('heading', { name: 'This page isn’t here.' })).toBeVisible()
    const link = page.getByRole('link', { name: 'Return to player' })
    await browserExpect(link).toHaveAttribute('href', '/')
    await link.focus()
    mkdirSync(evidence, { recursive: true })
    await page.screenshot({ path: resolve(evidence, 'not-found-mobile.png') })
    await page.keyboard.press('Enter')
    await browserExpect(page).toHaveURL(origin + '/')
    await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
    await browserExpect(page.locator('canvas')).toBeVisible()
    expect((await fetch(origin + '/')).status).toBe(200)
    expect(configurationWarnings).toEqual([])
    expect(output).not.toContain('notFoundComponent')
    writeFileSync(resolve(evidence, 'not-found-verification.json'), JSON.stringify({ sourceFingerprint: snapshot.source.digest, testedMissingPaths: missingPaths, actualBrowser404Paths: [...missingRequests], rootStatus: 200, missingStatus: 404, keyboardReturnedToT1Player: true, configurationWarnings: 0, syntheticIsolatedDev: true }, null, 2))
  } finally {
    const owned = child
    const cleanup = await Promise.allSettled([
      browser?.close() ?? Promise.resolve(),
      (async () => {
        if (owned === undefined) return
        try { process.kill(-owned.pid, 'SIGTERM') } catch { /* Only our owned group. */ }
        await Promise.race([owned.exited, pause(5000)])
        try { process.kill(-owned.pid, 'SIGKILL') } catch { /* Already exited. */ }
        await owned.exited
      })(),
    ])
    const logs = await Promise.allSettled(pumps)
    rmSync(directory, { recursive: true, force: true })
    cleanupFailed = [...cleanup, ...logs].some((result) => result.status === 'rejected')
  }
  if (cleanupFailed) throw new Error('Not-found test cleanup failed')
}, 120_000)
