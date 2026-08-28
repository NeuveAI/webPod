import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'bun dev',
    cwd: resolve(import.meta.dirname, '../..'),
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  reporter: [['line']],
})
