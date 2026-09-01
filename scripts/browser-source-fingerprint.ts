import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const defaultRepositoryRoot = resolve(import.meta.dirname, '..')
export const BROWSER_SOURCE_METADATA_FILE = '.webpod-browser-source.json'
const ARCHIVE_INPUTS = [
  'package.json',
  'bun.lock',
  'tsconfig.base.json',
  'apps',
  'packages',
  'scripts/browser-source-fingerprint.ts',
] as const
const SNAPSHOT_FORBIDDEN_ROOTS = ['cert', '.claude', 'design.pen', 'docs', '.env', '.env.local'] as const

export interface BrowserSourceFingerprint {
  readonly digest: string
  readonly fileCount: number
}

export interface BrowserSourceSnapshot {
  readonly snapshotRoot: string
  readonly source: BrowserSourceFingerprint
  readonly reviewedCommit: string | null
  readonly reviewedTree: string | null
}

export interface BrowserSourceSnapshotOptions {
  readonly snapshotRoot: string
  readonly repositoryRoot?: string
  readonly reviewedCommit?: string | null
}

/**
 * Hashes every runtime source file that Vite can serve for the browser MVP.
 *
 * The digest includes dirty working-tree bytes, not only `HEAD`. That is
 * deliberate: an isolated process can still consume an unrelated HMR write
 * from the shared checkout. The health endpoint recomputes this digest per
 * request, so a mid-run source change is observable instead of silently
 * changing what a green gate means.
 */
export function fingerprintBrowserSources(repositoryRoot = defaultRepositoryRoot): BrowserSourceFingerprint {
  const sourceRoots = [
    resolve(repositoryRoot, 'apps/web/src'),
    resolve(repositoryRoot, 'packages'),
  ] as const
  const standaloneInputs = [
    resolve(repositoryRoot, 'package.json'),
    resolve(repositoryRoot, 'bun.lock'),
    resolve(repositoryRoot, 'apps/web/package.json'),
    resolve(repositoryRoot, 'apps/web/vite.config.ts'),
    resolve(repositoryRoot, 'scripts/browser-source-fingerprint.ts'),
  ] as const
  const files = [...standaloneInputs, ...sourceRoots.flatMap((root) => walkFiles(root, repositoryRoot))]
    .sort((left, right) => left.localeCompare(right))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(repositoryRoot, file))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return { digest: hash.digest('hex'), fileCount: files.length }
}

export function prepareBrowserSourceSnapshot({
  snapshotRoot,
  repositoryRoot = defaultRepositoryRoot,
  reviewedCommit = null,
}: BrowserSourceSnapshotOptions): BrowserSourceSnapshot {
  const root = resolve(repositoryRoot)
  const target = resolve(snapshotRoot)
  const archivePath = resolve(target, '..', 'browser-source.tar')
  rmSync(target, { recursive: true, force: true })

  if (reviewedCommit === null) {
    mkdirSync(target, { recursive: true })
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const sourcePath = resolve(root, entry.name)
      if (!includeSnapshotPath(root, sourcePath)) continue
      cpSync(sourcePath, resolve(target, entry.name), {
        recursive: true,
        dereference: false,
        filter: (nestedSourcePath) => includeSnapshotPath(root, nestedSourcePath),
      })
    }
    assertExcludedSnapshot(target)
    const snapshot = {
      snapshotRoot: target,
      source: fingerprintBrowserSources(target),
      reviewedCommit: null,
      reviewedTree: null,
    }
    writeSnapshotMetadata(snapshot)
    return snapshot
  }

  const resolvedCommit = git(root, ['rev-parse', '--verify', `${reviewedCommit}^{commit}`]).trim()
  const reviewedTree = git(root, ['rev-parse', `${resolvedCommit}^{tree}`]).trim()
  mkdirSync(target, { recursive: true })
  git(root, [
    'archive',
    '--format=tar',
    `--output=${archivePath}`,
    resolvedCommit,
    '--',
    ...ARCHIVE_INPUTS,
  ])
  run('tar', ['-xf', archivePath, '-C', target], root)
  rmSync(archivePath, { force: true })
  assertExcludedSnapshot(target)
  const snapshot = {
    snapshotRoot: target,
    source: fingerprintBrowserSources(target),
    reviewedCommit: resolvedCommit,
    reviewedTree,
  }
  writeSnapshotMetadata(snapshot)
  return snapshot
}

function walkFiles(root: string, repositoryRoot: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) {
      if (root === resolve(repositoryRoot, 'packages') && entry.name.startsWith('.')) return []
      return walkFiles(path, repositoryRoot)
    }
    return entry.isFile() && !path.includes('/node_modules/') ? [path] : []
  })
}

function includeSnapshotPath(repositoryRoot: string, sourcePath: string): boolean {
  const path = relative(repositoryRoot, sourcePath)
  if (path === '') return true
  const parts = path.split('/')
  return !parts.some((part) =>
    part === '.git' ||
    part === 'node_modules' ||
    part === 'dist' ||
    part === 'test-results' ||
    part === 'playwright-report' ||
    part === 'cert' ||
    part === '.claude',
  )
    && !parts.some((part) => part === '.env' || part.startsWith('.env.'))
    && path !== 'design.pen'
    && path !== 'docs'
    && !path.startsWith('docs/')
}

function assertExcludedSnapshot(root: string): void {
  for (const path of SNAPSHOT_FORBIDDEN_ROOTS) {
    if (existsSync(resolve(root, path))) {
      throw new Error(`Forbidden snapshot input exists: ${path}`)
    }
  }
}

function git(repositoryRoot: string, args: readonly string[]): string {
  return run('git', args, repositoryRoot)
}

function run(command: string, args: readonly string[], cwd: string): string {
  const result = Bun.spawnSync([command, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

function writeSnapshotMetadata(snapshot: BrowserSourceSnapshot): void {
  writeFileSync(
    resolve(snapshot.snapshotRoot, BROWSER_SOURCE_METADATA_FILE),
    JSON.stringify(
      {
        expectedFingerprint: snapshot.source.digest,
        expectedFileCount: snapshot.source.fileCount,
        reviewedCommit: snapshot.reviewedCommit,
        reviewedTree: snapshot.reviewedTree,
      },
      null,
      2,
    ),
  )
}
