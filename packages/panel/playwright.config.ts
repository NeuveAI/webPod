import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { fingerprintBrowserSources } from '../../scripts/browser-source-fingerprint.ts'

const port = Number(process.env['PANEL_E2E_PORT'] ?? '4318')
const baseURL = `http://127.0.0.1:${String(port)}`
const generated = resolve(tmpdir(), 'webpod-panel-playwright')
const source = fingerprintBrowserSources()
process.env['W5B_EXPECTED_SOURCE_FINGERPRINT'] = source.digest
process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'] = String(source.fileCount)
process.env['PANEL_EVIDENCE_DIR'] = resolve(generated, 'evidence')
console.log(`[PANEL SOURCE ${source.digest} FILES ${String(source.fileCount)}]`)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `bun node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${String(port)} --strictPort`,
    cwd: resolve(import.meta.dirname, '../../apps/web'),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      W5B_EXPECTED_SOURCE_FINGERPRINT: source.digest,
      W5B_EXPECTED_SOURCE_FILE_COUNT: String(source.fileCount),
      PANEL_EVIDENCE_DIR: resolve(generated, 'evidence'),
    },
  },
  outputDir: resolve(generated, 'results'),
  reporter: [['line']],
})
