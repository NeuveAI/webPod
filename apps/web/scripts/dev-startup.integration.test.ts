import { expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { chromium, expect as browserExpect } from '@playwright/test'
import { prepareBrowserSourceSnapshot } from '../../../scripts/browser-source-fingerprint'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The package scripts themselves choose Vite's runtime. No --bun, alternate Vite entry,
 * injected handler, API mock, credentials or user server is supplied by this harness. */
for (const launcher of ['root', 'app'] as const) test(`${launcher} shipped dev script renders both product routes and loads anonymous SQLite transport`, async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'webpod-shipped-dev-'))
  const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot: resolve(directory, 'source') })
  const env = { PATH: process.env['PATH'] ?? '', APPLE_TEAM_ID: '', APPLE_MUSICKIT_KEY_ID: '', APPLE_MUSICKIT_KEY_PATH: '', APPLE_TOKEN_TTL_SECONDS: '', WEBPOD_STICKER_DATABASE_PATH: resolve(directory, 'private/stickers.sqlite') }
  let child: ReturnType<typeof Bun.spawn> | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let output = ''
  let cleanupFailed: boolean
  const pumps: Promise<void>[] = []
  async function collect(stream: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder()
    for await (const bytes of stream) { output = (output + decoder.decode(bytes)).slice(-32_768) }
  }
  try {
    const installed = Bun.spawnSync(['bun', 'install', '--frozen-lockfile', '--ignore-scripts'], { cwd: snapshot.snapshotRoot, env, stdout: 'pipe', stderr: 'pipe' })
    expect(installed.exitCode).toBe(0)
    // Reserve an ephemeral port and release it immediately before strictPort startup.
    const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(null) })
    const port = probe.port; await probe.stop(true)
    child = Bun.spawn(['bun', 'run', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: launcher === 'root' ? snapshot.snapshotRoot : resolve(snapshot.snapshotRoot, 'apps/web'),
      env, detached: true, stdout: 'pipe', stderr: 'pipe',
    })
    if (child.stdout instanceof ReadableStream) pumps.push(collect(child.stdout))
    if (child.stderr instanceof ReadableStream) pumps.push(collect(child.stderr))
    const origin = `http://127.0.0.1:${String(port)}`
    const deadline = Date.now() + 45_000
    let ready = false
    while (Date.now() < deadline && child.exitCode === null) {
      ready = await fetch(origin + '/@vite/client', { signal: AbortSignal.timeout(1000) }).then((response) => response.ok).catch(() => false)
      if (ready) break
      await pause(100)
    }
    if (!ready) throw new Error(`Shipped ${launcher} dev readiness failed; exit=${String(child.exitCode)}; isolated credential-free startup tail: ${output.slice(-2000)}`)
    browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const browserErrors: string[] = []
    const executableModules: Promise<string>[] = []
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script' && response.url().startsWith(origin)) executableModules.push(response.text().catch(() => ''))
    })
    page.on('pageerror', (error) => { browserErrors.push(error.message) })
    page.on('console', (message) => {
      if (message.type() === 'error' && /Failed to fetch dynamically imported module|Cannot find module|does not provide an export|Failed to resolve module/.test(message.text())) browserErrors.push(message.text())
    })
    page.on('requestfailed', (request) => {
      if (request.resourceType() === 'script' && request.url().startsWith(origin) && request.failure()?.errorText !== 'net::ERR_ABORTED') browserErrors.push(`Failed client module: ${new URL(request.url()).pathname}`)
    })
    for (const path of ['/', '/_spike/device']) {
      const response = await page.goto(origin + path)
      if (response?.status() !== 200) {
        const moduleFailure = output.match(/Cannot find module ['"]bun(?::sqlite)?['"]/)
        throw new Error(`Shipped ${launcher} dev ${path} returned ${String(response?.status())}; ${moduleFailure?.[0] ?? 'see runtime startup'}`)
      }
      await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30_000 })
      await browserExpect(page.locator('canvas')).toBeVisible()
      await browserExpect(page.locator('vite-error-overlay')).toHaveCount(0)
    }
    const anonymous = await fetch(origin + '/api/stickers')
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('cache-control')).toBe('no-store')
    expect(existsSync(env.WEBPOD_STICKER_DATABASE_PATH)).toBe(true)
    const route = await fetch(origin + '/src/routes/api.stickers.ts')
    expect(route.status).toBe(200)
    const clientModule = await route.text()
    expect(clientModule).not.toMatch(/from\s*["'][^"']*(?:server-core|sticker-handler|bun:sqlite|bun["'])/)
    expect(clientModule).not.toContain('getStickerServer')
    const modules = await Promise.all(executableModules)
    expect(modules.length).toBeGreaterThan(10)
    for (const code of modules) {
      expect(code).not.toMatch(/(?:from|import\s*\()\s*["']bun(?::sqlite)?["']/)
      expect(code).not.toMatch(/createLiveStickerServer|sticker_devices|webCryptoAppleTokenSigner|APPLE_MUSICKIT_KEY_PATH/)
    }
    expect(browserErrors).toEqual([])
    expect(output).not.toMatch(/Cannot find module ["']bun|Failed to resolve dependency: bun|Failed to run dependency scan|could not be resolved|Internal server error/)
  } finally {
    const owned = child
    const results = await Promise.allSettled([
      browser?.close() ?? Promise.resolve(),
      (async () => {
        if (owned === undefined) return
        try { process.kill(-owned.pid, 'SIGTERM') } catch { /* Our process group already exited. */ }
        await Promise.race([owned.exited, pause(5000)])
        try { process.kill(-owned.pid, 'SIGKILL') } catch { /* Ensure only our owned group is gone. */ }
        await owned.exited
      })(),
    ])
    const logs = await Promise.allSettled(pumps)
    rmSync(directory, { recursive: true, force: true })
    cleanupFailed = [...results, ...logs].some((result) => result.status === 'rejected')
  }
  if (cleanupFailed) throw new Error('Development test resource cleanup failed')
}, 120_000)
