import { defineConfig } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { resolve } from 'node:path'

import { fingerprintBrowserSources } from '../../../scripts/browser-source-fingerprint.ts'

const port = Number(process.env['W5B_PORT'] ?? '4317')
const baseURL = `http://127.0.0.1:${String(port)}`
const source = fingerprintBrowserSources()
process.env['W5B_EXPECTED_SOURCE_FINGERPRINT'] = source.digest
process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'] = String(source.fileCount)
console.log(`[W5B SOURCE ${source.digest} FILES ${String(source.fileCount)}]`)

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '**/*.e2e.ts',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `bun node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${String(port)} --strictPort`,
    cwd: resolve(import.meta.dirname, '..'),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      W5B_EXPECTED_SOURCE_FINGERPRINT: source.digest,
      W5B_EXPECTED_SOURCE_FILE_COUNT: String(source.fileCount),
    },
  },
  outputDir: resolve(import.meta.dirname, 'test-results'),
  reporter: [['line']],
})
