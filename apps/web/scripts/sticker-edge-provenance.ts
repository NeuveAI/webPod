import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

export type Manifest = Readonly<Record<string, string>>
export interface FileDelta { readonly path: string; readonly before: string | null; readonly after: string | null }
export interface BuildProvenance {
  readonly version: 1; readonly buildCommand: readonly string[];
  readonly sourceBefore: Manifest; readonly sourceAfter: Manifest;
  readonly artifacts: Manifest; readonly buildDeltas: readonly FileDelta[];
  readonly exitCode: number;
}
const root = resolve(import.meta.dirname, '../../..')
/** Owner-approved external edits permitted only AFTER a stable build. No glob patterns. */
export const EXTERNAL_POST_BUILD = new Set([
  'apps/web/src/device-page.tsx', 'apps/web/src/device-preview-orientation.ts',
  'apps/web/src/device-preview-orientation.test.ts', 'apps/web/src/sticker-webmcp.ts',
  'apps/web/src/sticker-webmcp.test.ts', 'apps/web/src/webmcp.ts',
  'packages/composite/src/CompositeDevice.tsx', 'packages/composite/src/CompositeDevice.integration.test.tsx',
  'packages/composite/src/index.ts', 'packages/composite/src/interaction-audio.ts',
  'packages/composite/src/interaction-audio.test.ts', 'packages/composite/src/agent-controls.ts',
  'packages/panel/src/Panel.tsx', 'packages/panel/src/Panel.integration.test.tsx',
  'packages/panel/src/index.ts', 'packages/panel/src/page-readiness.ts', 'packages/panel/src/page-readiness.test.ts',
  'packages/state/src/contract.ts', 'packages/state/src/detent.ts', 'packages/state/src/detent.test.ts',
  'packages/state/src/feedback.test.ts', 'packages/state/src/silence.ts', 'packages/state/src/store.ts',
  'packages/state/src/store.test.ts', 'packages/tools/src/index.ts', 'packages/tools/src/interactions.ts',
  'packages/tools/src/interactions.test.ts', 'packages/tools/src/native.ts', 'packages/tools/src/stickers.ts',
  'packages/tools/src/stickers.test.ts',
])
function files(directory: string, source: boolean): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (source && (['node_modules', 'dist', 'cert', '.git', '.data', 'test-results', 'playwright-report'].includes(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('.pen'))) return []
    const path = resolve(directory, entry.name)
    // Never follow symlinked dependency trees or local configuration.
    return entry.isDirectory() ? files(path, source) : entry.isFile() ? [path] : []
  })
}
function hashFiles(paths: readonly string[], repositoryRoot: string): Manifest {
  return Object.fromEntries([...new Set(paths)].sort().map(path => [relative(repositoryRoot, path), createHash('sha256').update(readFileSync(path)).digest('hex')]))
}
export function sourceManifest(repositoryRoot = root): Manifest {
  const trees = ['apps', 'packages', 'scripts', 'patches', 'assets/stickers/playworn']
  const standalone = readdirSync(repositoryRoot, { withFileTypes: true }).filter(entry => entry.isFile() && (entry.name === 'bun.lock' || /(?:package|tsconfig[^/]*|eslint[^/]*)\.(?:json|js|ts|mjs)$/.test(entry.name))).map(entry => resolve(repositoryRoot, entry.name))
  return hashFiles([...standalone, ...trees.flatMap(path => files(resolve(repositoryRoot, path), true))], repositoryRoot)
}
export function artifactManifest(repositoryRoot = root): Manifest {
  const paths = ['apps/web/dist/client', 'apps/web/dist/server'].flatMap(path => files(resolve(repositoryRoot, path), false))
  if (paths.length === 0 || !existsSync(resolve(repositoryRoot, 'apps/web/dist/server/server.js'))) throw new Error('Missing built Start artifacts')
  return hashFiles(paths, repositoryRoot)
}
export function manifestDiff(before: Manifest, after: Manifest): FileDelta[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter(path => before[path] !== after[path]).map(path => ({ path, before: before[path] ?? null, after: after[path] ?? null }))
}
export function protectedDeltas(deltas: readonly FileDelta[]): readonly FileDelta[] { return deltas.filter(delta => !EXTERNAL_POST_BUILD.has(delta.path) || delta.before === null || delta.after === null) }
function save(path: string, value: unknown): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n') }
export function verifyBuild(record: BuildProvenance): void {
  if (record.version !== 1 || record.exitCode !== 0 || record.buildDeltas.length !== 0 || manifestDiff(record.sourceBefore, record.sourceAfter).length !== 0) throw new Error('Build provenance is not a successful stable full-source build')
}
export function beginEdgeProvenance(buildPath: string, evidence: string, repositoryRoot = root) {
  const build = JSON.parse(readFileSync(buildPath, 'utf8')) as BuildProvenance
  verifyBuild(build)
  const sourceStart = sourceManifest(repositoryRoot), artifactsStart = artifactManifest(repositoryRoot)
  const buildToTest = manifestDiff(build.sourceAfter, sourceStart), artifactStartDeltas = manifestDiff(build.artifacts, artifactsStart)
  const started = { build, sourceStart, artifactsStart, buildToTest, artifactStartDeltas, allowlist: [...EXTERNAL_POST_BUILD].sort(), policy: 'Approved external post-build changes are disclosed and are NOT part of the tested compiled artifact.' }
  save(resolve(evidence, 'provenance-start.json'), started)
  if (protectedDeltas(buildToTest).length !== 0 || artifactStartDeltas.length !== 0) throw new Error('Protected source or built artifact changed before native test; see provenance-start.json')
  return { finish() {
    const sourceEnd = sourceManifest(repositoryRoot), artifactsEnd = artifactManifest(repositoryRoot)
    const testDeltas = manifestDiff(sourceStart, sourceEnd), buildToEnd = manifestDiff(build.sourceAfter, sourceEnd), artifactDeltas = manifestDiff(artifactsStart, artifactsEnd)
    const invalid = protectedDeltas(testDeltas).length !== 0 || protectedDeltas(buildToEnd).length !== 0 || artifactDeltas.length !== 0
    save(resolve(evidence, 'provenance-final.json'), { ...started, sourceEnd, artifactsEnd, testDeltas, buildToEnd, artifactDeltas, passed: !invalid })
    if (invalid) throw new Error('Protected source or compiled artifact changed during native test; see provenance-final.json')
  } }
}

if (import.meta.main) {
  const output = process.argv[2]
  if (output === undefined) throw new Error('Usage: bun apps/web/scripts/sticker-edge-provenance.ts <build-provenance.json>')
  const sourceBefore = sourceManifest()
  const buildCommand = ['bun', 'run', '--cwd', 'apps/web', 'build']
  const result = Bun.spawnSync(buildCommand, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  const sourceAfter = sourceManifest()
  const record: BuildProvenance = { version: 1, buildCommand, sourceBefore, sourceAfter, artifacts: result.exitCode === 0 ? artifactManifest() : {}, buildDeltas: manifestDiff(sourceBefore, sourceAfter), exitCode: result.exitCode }
  save(resolve(output), record)
  verifyBuild(record)
}
