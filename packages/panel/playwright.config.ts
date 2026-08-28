import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
  reporter: [['line']],
})
