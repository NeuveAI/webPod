import { describe, expect, test } from 'bun:test'
import { appendFileSync, mkdirSync, writeFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  BROWSER_SOURCE_METADATA_FILE,
  fingerprintBrowserSources,
  prepareBrowserSourceSnapshot,
} from './browser-source-fingerprint'

const repositoryRoot = resolve(import.meta.dirname, '..')

describe('browser source snapshots', () => {

  test('dependency patch bytes participate in isolated runtime provenance', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-patch-fingerprint-'))
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot: join(temporaryRoot, 'snapshot') })
      const patch = resolve(snapshot.snapshotRoot, 'patches/@tanstack%2Fstart-server-core@1.169.31.patch')
      expect(existsSync(patch)).toBe(true)
      appendFileSync(patch, '\n')
      expect(fingerprintBrowserSources(snapshot.snapshotRoot).digest).not.toBe(snapshot.source.digest)
    } finally { rmSync(temporaryRoot, { recursive: true, force: true }) }
  }, 60_000)
  test('a worktree snapshot excludes forbidden roots and yields a stable fingerprint', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-browser-source-worktree-'))
    const snapshotRoot = join(temporaryRoot, 'snapshot')
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot })
      expect(snapshot.reviewedCommit).toBeNull()
      expect(snapshot.reviewedTree).toBeNull()
      expect(snapshot.source).toEqual(fingerprintBrowserSources(snapshot.snapshotRoot))
      expect(readSnapshotMetadata(snapshot.snapshotRoot)).toEqual({
        expectedFingerprint: snapshot.source.digest,
        expectedFileCount: snapshot.source.fileCount,
        reviewedCommit: null,
        reviewedTree: null,
      })
      for (const excluded of ['cert', '.claude', 'design.pen', 'docs', '.env', '.env.local']) {
        expect(existsSync(resolve(snapshot.snapshotRoot, excluded))).toBe(false)
      }
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  }, 60_000)

  test('production entry changes provenance while private database state stays out of worktree snapshots', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-production-provenance-'))
    try {
      const source = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot: join(temporaryRoot, 'source') })
      const entry = resolve(source.snapshotRoot, 'apps/web/scripts/start.ts')
      expect(existsSync(entry)).toBe(true)
      appendFileSync(entry, '\n// isolated production entry mutation\n')
      expect(fingerprintBrowserSources(source.snapshotRoot).digest).not.toBe(source.source.digest)
      mkdirSync(resolve(source.snapshotRoot, 'apps/web/.data'), { recursive: true })
      writeFileSync(resolve(source.snapshotRoot, 'apps/web/.data/stickers.sqlite'), 'synthetic fixture only')
      writeFileSync(resolve(source.snapshotRoot, 'apps/web/private.sqlite-wal'), 'synthetic fixture only')
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot: source.snapshotRoot, snapshotRoot: join(temporaryRoot, 'snapshot') })
      expect(existsSync(resolve(snapshot.snapshotRoot, 'apps/web/.data'))).toBe(false)
      expect(existsSync(resolve(snapshot.snapshotRoot, 'apps/web/private.sqlite-wal'))).toBe(false)
      expect(existsSync(resolve(snapshot.snapshotRoot, 'apps/web/scripts/start.ts'))).toBe(true)
    } finally { rmSync(temporaryRoot, { recursive: true, force: true }) }
  }, 60_000)

  test('a reviewed commit snapshot records exact commit and tree identity', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-browser-source-commit-'))
    const snapshotRoot = join(temporaryRoot, 'snapshot')
    const reviewedCommit = git(['rev-parse', '--verify', 'HEAD^{commit}'])
    const reviewedTree = git(['rev-parse', `${reviewedCommit}^{tree}`])
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot, reviewedCommit })
      expect(snapshot.reviewedCommit).toBe(reviewedCommit)
      expect(snapshot.reviewedTree).toBe(reviewedTree)
      // Vite imports this hook at config evaluation, before it can start serving.
      expect(existsSync(resolve(snapshotRoot, 'scripts/sticker-assets.ts'))).toBe(true)
      expect(existsSync(resolve(snapshotRoot, 'assets/stickers/playworn/manifest.json'))).toBe(true)
      const copied = Bun.spawnSync([process.execPath, '-e', 'import { syncStickerAssets } from "./scripts/sticker-assets.ts"; console.log(syncStickerAssets(process.cwd()))'], { cwd: snapshotRoot, stdout: 'pipe', stderr: 'pipe' })
      expect(copied.exitCode).toBe(0)
      expect(copied.stdout.toString().trim()).toBe('60')
      const sourcePng = resolve(snapshotRoot, 'assets/stickers/playworn/metal/pw-a01-night-shift.png')
      const publicPng = resolve(snapshotRoot, 'apps/web/public/stickers/playworn/metal/pw-a01-night-shift.png')
      expect(readFileSync(publicPng).equals(readFileSync(sourcePng))).toBe(true)
      // Generated public copies are outputs, and do not alter reviewed provenance.
      expect(fingerprintBrowserSources(snapshotRoot)).toEqual(snapshot.source)
      for (const excluded of ['cert', '.claude', 'design.pen', 'docs', '.env', '.env.local']) {
        expect(existsSync(resolve(snapshotRoot, excluded))).toBe(false)
      }
      expect(snapshot.source).toEqual(fingerprintBrowserSources(snapshot.snapshotRoot))
      expect(readSnapshotMetadata(snapshot.snapshotRoot)).toEqual({
        expectedFingerprint: snapshot.source.digest,
        expectedFileCount: snapshot.source.fileCount,
        reviewedCommit,
        reviewedTree,
      })
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  }, 60_000)

  test('mutating the served snapshot changes the fingerprint', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-browser-source-mutation-'))
    const snapshotRoot = join(temporaryRoot, 'snapshot')
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot, reviewedCommit: git(['rev-parse', '--verify', 'HEAD^{commit}']) })
      appendFileSync(
        resolve(snapshot.snapshotRoot, 'packages/composite/src/CompositeDevice.tsx'),
        '\n// browser source mutation plant\n',
      )
      const mutated = fingerprintBrowserSources(snapshot.snapshotRoot)
      expect(mutated.digest).not.toBe(snapshot.source.digest)
      expect(mutated.fileCount).toBe(snapshot.source.fileCount)
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  }, 60_000)

  test('historical pre-pipeline source extraction tolerates absent sticker build inputs', () => {
    // Extraction only: execute historical browser checks with their matching archived
    // config/helper, not this newer fingerprint algorithm against an older health endpoint.
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-browser-source-historical-'))
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot: join(temporaryRoot, 'snapshot'), reviewedCommit: '8507a63' })
      expect(existsSync(resolve(snapshot.snapshotRoot, 'apps/web/vite.config.ts'))).toBe(true)
      expect(existsSync(resolve(snapshot.snapshotRoot, 'scripts/sticker-assets.ts'))).toBe(false)
      expect(snapshot.source).toEqual(fingerprintBrowserSources(snapshot.snapshotRoot))
    } finally { rmSync(temporaryRoot, { recursive: true, force: true }) }
  }, 60_000)

  test('asset pipeline, manifest and source PNG bytes each affect reviewed provenance', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-browser-source-sticker-mutation-'))
    const snapshotRoot = join(temporaryRoot, 'snapshot')
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot, reviewedCommit: git(['rev-parse', '--verify', 'HEAD^{commit}']) })
      let previous = snapshot.source
      for (const path of ['scripts/sticker-assets.ts', 'assets/stickers/playworn/manifest.json', 'assets/stickers/playworn/metal/pw-a01-night-shift.png']) {
        appendFileSync(resolve(snapshotRoot, path), '\n')
        const mutated = fingerprintBrowserSources(snapshotRoot)
        expect(mutated.digest).not.toBe(previous.digest)
        expect(mutated.fileCount).toBe(previous.fileCount)
        previous = mutated
      }
    } finally { rmSync(temporaryRoot, { recursive: true, force: true }) }
  }, 60_000)
})

function git(args: readonly string[]): string {
  const result = Bun.spawnSync(['git', ...args], {
    cwd: repositoryRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`)
  }
  return result.stdout.toString().trim()
}

function readSnapshotMetadata(snapshotRoot: string): unknown {
  return JSON.parse(readFileSync(resolve(snapshotRoot, BROWSER_SOURCE_METADATA_FILE), 'utf8'))
}
