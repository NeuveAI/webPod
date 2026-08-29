import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const defaultRepositoryRoot = resolve(import.meta.dirname, '..')

export interface BrowserSourceFingerprint {
  readonly digest: string
  readonly fileCount: number
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
