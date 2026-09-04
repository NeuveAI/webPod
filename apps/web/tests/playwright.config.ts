import { defineConfig } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import {
  fingerprintBrowserSources,
  prepareBrowserSourceSnapshot,
} from '../../../scripts/browser-source-fingerprint.ts'

const port = Number(process.env['W5B_PORT'] ?? '4317')
const baseURL = `http://127.0.0.1:${String(port)}`
const readinessURL = `${baseURL}/@vite/client`
const repositoryRoot = resolve(import.meta.dirname, '../../..')
const generated = resolve(tmpdir(), 'webpod-web-playwright')
const snapshotRoot = resolve(generated, 'served-snapshot')
const workerIndex = process.env['TEST_WORKER_INDEX']
const reviewedCommit = process.env['W5B_SOURCE_COMMIT']?.trim() || null

const snapshot =
  workerIndex === undefined || !existsSync(snapshotRoot)
    ? prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot, reviewedCommit })
    : {
      snapshotRoot,
      source: fingerprintBrowserSources(snapshotRoot),
      reviewedCommit: process.env['W5B_REVIEWED_COMMIT'] ?? null,
      reviewedTree: process.env['W5B_REVIEWED_TREE'] ?? null,
    }

process.env['W5B_EXPECTED_SOURCE_FINGERPRINT'] = snapshot.source.digest
process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'] = String(snapshot.source.fileCount)
if (snapshot.reviewedCommit !== null && snapshot.reviewedTree !== null) {
  process.env['W5B_REVIEWED_COMMIT'] = snapshot.reviewedCommit
  process.env['W5B_REVIEWED_TREE'] = snapshot.reviewedTree
  console.log(
    `[W5B SOURCE ${snapshot.source.digest} FILES ${String(snapshot.source.fileCount)} COMMIT ${snapshot.reviewedCommit} TREE ${snapshot.reviewedTree}]`,
  )
} else {
  delete process.env['W5B_REVIEWED_COMMIT']
  delete process.env['W5B_REVIEWED_TREE']
  console.log(`[W5B SOURCE ${snapshot.source.digest} FILES ${String(snapshot.source.fileCount)} WORKTREE-SNAPSHOT]`)
}

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
    command: `bun install --frozen-lockfile --ignore-scripts && bun node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${String(port)} --strictPort`,
    cwd: resolve(snapshot.snapshotRoot, 'apps/web'),
    url: readinessURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      W5B_EXPECTED_SOURCE_FINGERPRINT: snapshot.source.digest,
      W5B_EXPECTED_SOURCE_FILE_COUNT: String(snapshot.source.fileCount),
      W5B_REVIEWED_COMMIT: snapshot.reviewedCommit ?? '',
      W5B_REVIEWED_TREE: snapshot.reviewedTree ?? '',
    },
  },
  outputDir: resolve(import.meta.dirname, 'test-results'),
  reporter: [['line']],
})
