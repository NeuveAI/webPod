import { defineConfig } from '../../../packages/panel/node_modules/@playwright/test/index.js'
import { resolve } from 'node:path'

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '**/*.e2e.ts',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun dev',
    cwd: resolve(import.meta.dirname, '../../..'),
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  outputDir: resolve(import.meta.dirname, 'test-results'),
  reporter: [['line']],
})
