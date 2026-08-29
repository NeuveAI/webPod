import { appendFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

import { fingerprintBrowserSources, type BrowserSourceFingerprint } from './browser-source-fingerprint'
import { parseW7BrowserEvidence } from './w7-browser-evidence-schema'

const port = 3017
const debugPort = 9337

interface SourceHealth {
  readonly expected: string
  readonly current: string
  readonly expectedFileCount: number
  readonly fileCount: number
}

const reviewedCommit = process.env['W7_SOURCE_COMMIT']
if (reviewedCommit === undefined || reviewedCommit.length === 0) {
  throw new Error('W7_SOURCE_COMMIT must name the immutable commit under review')
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-w7-evidence-'))
const snapshotRoot = join(temporaryRoot, 'served-snapshot')
const archivePath = join(temporaryRoot, 'source.tar')
const profile = join(temporaryRoot, 'chrome-profile')
let server: ReturnType<typeof Bun.spawn> | null = null
let chrome: ReturnType<typeof Bun.spawn> | null = null

try {
  await assertPortUnused(port)
  await assertPortUnused(debugPort)
  const resolvedCommit = git(['rev-parse', '--verify', `${reviewedCommit}^{commit}`])
  const reviewedTree = git(['rev-parse', `${resolvedCommit}^{tree}`])
  run('git', [
    'archive', '--format=tar', `--output=${archivePath}`, resolvedCommit, '--',
    'package.json', 'bun.lock', 'tsconfig.base.json', 'apps', 'packages',
    'scripts/browser-source-fingerprint.ts',
  ])
  run('mkdir', ['-p', snapshotRoot])
  run('tar', ['-xf', archivePath, '-C', snapshotRoot])
  assertExcluded(snapshotRoot)
  run('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], snapshotRoot)

  const expectedSource = fingerprintBrowserSources(snapshotRoot)
  server = Bun.spawn([
    'bun', 'node_modules/vite/bin/vite.js', 'dev',
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], {
    cwd: join(snapshotRoot, 'apps/web'),
    env: {
      ...process.env,
      W5B_EXPECTED_SOURCE_FINGERPRINT: expectedSource.digest,
      W5B_EXPECTED_SOURCE_FILE_COUNT: String(expectedSource.fileCount),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await waitFor(`http://127.0.0.1:${String(port)}/`)
  const healthBefore = await readSourceHealth()
  assertSourceIdentity(healthBefore, expectedSource)

  chrome = Bun.spawn([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${String(debugPort)}`,
    '--enable-blink-features=CanvasDrawElement', 'about:blank',
  ], { stdout: 'pipe', stderr: 'pipe' })
  await waitFor(`http://127.0.0.1:${String(debugPort)}/json/version`)

  const layout = await import(join(snapshotRoot, 'packages/device/src/layout.ts'))
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${String(debugPort)}`)
  const context = browser.contexts()[0]
  if (context === undefined) throw new Error('Fresh Chrome context was not created')
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(
    `http://127.0.0.1:${String(port)}/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=composited`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.locator('[data-composite-tier="T1"]').waitFor()

  const application = page.locator('[role="application"]')
  await application.focus()
  await page.keyboard.press('ArrowDown')
  const selectedBeforeArc = await application.getAttribute('aria-activedescendant')
  const canvas = page.locator('[data-composite-tier="T1"] canvas')
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('Composite canvas has no box')
  const device = layout.DEVICE_LAYOUT
  const scale = Math.min(box.width / device.body.width, box.height / device.body.height)
  const centerX = box.x + box.width / 2
  const centerY = box.y + (device.body.height / 2 - device.wheel.centerY) * scale
  const radius = 86 * scale
  await page.mouse.move(centerX + radius, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX, centerY + radius, { steps: 8 })
  await page.mouse.up()
  const focusAfterArc = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute('role') ?? null,
    label: document.activeElement?.getAttribute('aria-label') ?? null,
  }))
  const selectedAfterArc = await application.getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowUp')
  const selectedAfterKeyboard = await application.getAttribute('aria-activedescendant')

  if (process.env['W7_PROVENANCE_PLANT'] === 'MIDRUN') {
    appendFileSync(join(snapshotRoot, 'packages/composite/src/CompositeDevice.tsx'), '\n// provenance mutation plant\n')
    process.stderr.write('[W7 PROVENANCE PLANT LANDED]\n')
  }
  const healthAfter = await readSourceHealth()
  assertSourceIdentity(healthAfter, expectedSource)
  const sourceAfter = fingerprintBrowserSources(snapshotRoot)
  assertFingerprint(sourceAfter, expectedSource, 'snapshot fingerprint after browser run')

  const result = {
    reviewedCommit: resolvedCommit,
    reviewedTree,
    route: page.url(),
    chromeVersion: await browser.version(),
    flag: 'CanvasDrawElement',
    requestPaint: await page.evaluate(() => 'requestPaint' in HTMLCanvasElement.prototype),
    tier: await page.locator('[data-composite-tier]').getAttribute('data-composite-tier'),
    expectedSource,
    healthBefore,
    healthAfter,
    sourceAfter,
    canvas: box,
    selectedBeforeArc,
    selectedAfterArc,
    focusAfterArc,
    selectedAfterKeyboard,
    keyboardContinued: selectedAfterKeyboard !== selectedAfterArc,
    pageErrors: errors,
  }
  parseW7BrowserEvidence(result, { reviewedCommit: resolvedCommit, reviewedTree })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  await browser.close()
} finally {
  server?.kill()
  chrome?.kill()
  await Promise.allSettled([server?.exited, chrome?.exited])
  rmSync(temporaryRoot, { recursive: true, force: true })
}

function assertExcluded(root: string): void {
  for (const path of ['cert', '.claude', 'design.pen', 'docs', '.env', '.env.local']) {
    if (existsSync(join(root, path))) throw new Error(`Forbidden snapshot input exists: ${path}`)
  }
}

function assertFingerprint(actual: BrowserSourceFingerprint, expected: BrowserSourceFingerprint, label: string): void {
  if (actual.digest !== expected.digest || actual.fileCount !== expected.fileCount) {
    throw new Error(`${label} changed: expected ${expected.digest}/${String(expected.fileCount)}, received ${actual.digest}/${String(actual.fileCount)}`)
  }
}

function assertSourceIdentity(health: SourceHealth, expected: BrowserSourceFingerprint): void {
  if (health.expected !== expected.digest || health.expectedFileCount !== expected.fileCount) {
    throw new Error('Snapshot server expected identity differs from runner identity')
  }
  assertFingerprint({ digest: health.current, fileCount: health.fileCount }, expected, 'immutable served snapshot')
}

async function readSourceHealth(): Promise<SourceHealth> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/__webpod_health`)
  if (!response.ok) throw new Error(`Source health returned ${String(response.status)}`)
  return response.json() as Promise<SourceHealth>
}

async function assertPortUnused(targetPort: number): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${String(targetPort)}/`)
  } catch {
    return
  }
  throw new Error(`Dedicated evidence port ${String(targetPort)} is already in use`)
}

function git(args: readonly string[]): string {
  return run('git', args).trim()
}

function run(command: string, args: readonly string[], cwd = process.cwd()): string {
  const result = Bun.spawnSync([command, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.toString()}`)
  return result.stdout.toString()
}

async function waitFor(url: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The fresh process has not bound its dedicated port yet.
    }
    await Bun.sleep(50)
  }
  throw new Error(`Timed out waiting for ${url}`)
}
