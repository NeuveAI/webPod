import { describe, expect, test } from 'bun:test'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  BROWSER_SOURCE_METADATA_FILE,
  fingerprintBrowserSources,
  prepareBrowserSourceSnapshot,
} from './browser-source-fingerprint'

const repositoryRoot = resolve(import.meta.dirname, '..')

describe('browser source snapshots', () => {
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

  test('a reviewed commit snapshot records exact commit and tree identity', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-browser-source-commit-'))
    const snapshotRoot = join(temporaryRoot, 'snapshot')
    const reviewedCommit = git(['rev-parse', '--verify', 'HEAD^{commit}'])
    const reviewedTree = git(['rev-parse', `${reviewedCommit}^{tree}`])
    try {
      const snapshot = prepareBrowserSourceSnapshot({ repositoryRoot, snapshotRoot, reviewedCommit })
      expect(snapshot.reviewedCommit).toBe(reviewedCommit)
      expect(snapshot.reviewedTree).toBe(reviewedTree)
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
