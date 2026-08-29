import { defineConfig } from '@playwright/test'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { relative, resolve } from 'node:path'

import { fingerprintBrowserSources } from '../../scripts/browser-source-fingerprint.ts'

const port = Number(process.env['PANEL_E2E_PORT'] ?? '4318')
const baseURL = `http://127.0.0.1:${String(port)}`
const generated = resolve(tmpdir(), 'webpod-panel-playwright')
const repositoryRoot = resolve(import.meta.dirname, '../..')
const snapshotRoot = resolve(generated, 'served-snapshot')
const workerIndex = process.env['TEST_WORKER_INDEX']
if (workerIndex === undefined || !existsSync(snapshotRoot)) {
  rmSync(snapshotRoot, { recursive: true, force: true })
  cpSync(repositoryRoot, snapshotRoot, {
    recursive: true,
    dereference: false,
    filter: (sourcePath) => {
      const path = relative(repositoryRoot, sourcePath)
      if (path === '') return true
      const parts = path.split('/')
      return !parts.some((part) => part === '.git' || part === 'node_modules' || part === 'dist' || part === 'test-results' || part === 'playwright-report' || part === 'cert' || part === '.claude')
        && !parts.some((part) => part === '.env' || part.startsWith('.env.'))
        && path !== 'design.pen'
        && !path.startsWith('docs/')
    },
  })
}
const source = fingerprintBrowserSources(snapshotRoot)
process.env['W5B_EXPECTED_SOURCE_FINGERPRINT'] = source.digest
process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'] = String(source.fileCount)
process.env['PANEL_EVIDENCE_DIR'] = resolve(generated, 'evidence')
process.env['PANEL_SNAPSHOT_ROOT'] = snapshotRoot
console.log(`[PANEL SOURCE ${source.digest} FILES ${String(source.fileCount)}]`)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `bun install --frozen-lockfile --ignore-scripts && bun node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${String(port)} --strictPort`,
    cwd: resolve(snapshotRoot, 'apps/web'),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      W5B_EXPECTED_SOURCE_FINGERPRINT: source.digest,
      W5B_EXPECTED_SOURCE_FILE_COUNT: String(source.fileCount),
      PANEL_EVIDENCE_DIR: resolve(generated, 'evidence'),
      PANEL_SNAPSHOT_ROOT: snapshotRoot,
    },
  },
  outputDir: resolve(generated, 'results'),
  reporter: [['line']],
})
