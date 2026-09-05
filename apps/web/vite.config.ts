import { syncStickerAssets } from '../../scripts/sticker-assets.ts'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import {
  BROWSER_SOURCE_METADATA_FILE,
  fingerprintBrowserSources,
} from '../../scripts/browser-source-fingerprint.ts'

const APPLE_SERVER_ENV_NAMES = [
  'APPLE_TEAM_ID',
  'APPLE_MUSICKIT_KEY_ID',
  'APPLE_MUSICKIT_KEY_PATH',
  'APPLE_TOKEN_TTL_SECONDS',
] as const

type AppleServerEnvName = (typeof APPLE_SERVER_ENV_NAMES)[number]

export function normalizeAppleServerEnv(
  workspaceRoot: string,
  fileEnv: Readonly<Record<string, string | undefined>>,
  runtimeEnv: Readonly<Record<string, string | undefined>>,
): Partial<Record<AppleServerEnvName, string>> {
  const normalized: Partial<Record<AppleServerEnvName, string>> = {}
  for (const name of APPLE_SERVER_ENV_NAMES) {
    const value = runtimeEnv[name] ?? fileEnv[name]
    if (value === undefined) continue
    if (name !== 'APPLE_MUSICKIT_KEY_PATH') {
      normalized[name] = value
      continue
    }
    const trimmed = value.trim()
    normalized[name] = trimmed === '' || isAbsolute(trimmed)
      ? trimmed
      : resolve(workspaceRoot, trimmed)
  }
  return normalized
}

function sourceIdentityHealth(): Plugin {
  return {
    name: 'webpod-source-identity-health',
    apply: 'serve',
    configureServer(server) {
      const snapshotMetadata = readSnapshotMetadata()
      const expected =
        snapshotMetadata?.expectedFingerprint ??
        process.env['W5B_EXPECTED_SOURCE_FINGERPRINT']
      const expectedFileCount =
        snapshotMetadata?.expectedFileCount ??
        Number(process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'])
      const reviewedCommit =
        snapshotMetadata === null
          ? process.env['W5B_REVIEWED_COMMIT'] || null
          : snapshotMetadata.reviewedCommit
      const reviewedTree =
        snapshotMetadata === null
          ? process.env['W5B_REVIEWED_TREE'] || null
          : snapshotMetadata.reviewedTree
      if (expected === undefined) return
      server.middlewares.use('/__webpod_health', (_request, response) => {
        const current = fingerprintBrowserSources()
        response.statusCode = 200
        response.setHeader('cache-control', 'no-store')
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({
          expected,
          current: current.digest,
          expectedFileCount,
          fileCount: current.fileCount,
          reviewedCommit,
          reviewedTree,
        }))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const workspaceRoot = resolve(import.meta.dirname, '..', '..')
  syncStickerAssets(workspaceRoot)
  const appleServerEnv = loadEnv(mode, workspaceRoot, 'APPLE_')
  const runtimeAppleEnv = normalizeAppleServerEnv(workspaceRoot, appleServerEnv, process.env)
  for (const name of APPLE_SERVER_ENV_NAMES) {
    const value = runtimeAppleEnv[name]
    if (value !== undefined) process.env[name] = value
  }

  return {
    envDir: workspaceRoot,
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [sourceIdentityHealth(), tailwindcss(), tanstackStart({ srcDirectory: 'src' }), viteReact()],
  }
})

function readSnapshotMetadata():
  | {
      readonly expectedFingerprint: string
      readonly expectedFileCount: number
      readonly reviewedCommit: string | null
      readonly reviewedTree: string | null
    }
  | null {
  const metadataPath = resolve(import.meta.dirname, '..', BROWSER_SOURCE_METADATA_FILE)
  if (!existsSync(metadataPath)) return null
  const value: unknown = JSON.parse(readFileSync(metadataPath, 'utf8'))
  if (typeof value !== 'object' || value === null) {
    throw new Error('Browser source metadata must be an object')
  }
  if (
    !('expectedFingerprint' in value) ||
    typeof value.expectedFingerprint !== 'string'
  ) {
    throw new Error('Browser source metadata must include expectedFingerprint')
  }
  if (
    !('expectedFileCount' in value) ||
    typeof value.expectedFileCount !== 'number' ||
    !Number.isInteger(value.expectedFileCount) ||
    value.expectedFileCount <= 0
  ) {
    throw new Error('Browser source metadata must include expectedFileCount')
  }
  const reviewedCommit =
    'reviewedCommit' in value && typeof value.reviewedCommit === 'string'
      ? value.reviewedCommit
      : null
  const reviewedTree =
    'reviewedTree' in value && typeof value.reviewedTree === 'string'
      ? value.reviewedTree
      : null
  if ((reviewedCommit === null) !== (reviewedTree === null)) {
    throw new Error(
      'Browser source metadata must provide both reviewedCommit and reviewedTree or neither',
    )
  }
  return {
    expectedFingerprint: value.expectedFingerprint,
    expectedFileCount: value.expectedFileCount,
    reviewedCommit,
    reviewedTree,
  }
}
