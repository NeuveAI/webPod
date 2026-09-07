import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { artifactManifest, beginEdgeProvenance, manifestDiff, protectedDeltas, sourceManifest, verifyBuild, type BuildProvenance } from './sticker-edge-provenance'

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'edge-provenance-'))
  const put = (path: string, text: string) => { const full = resolve(root, path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, text) }
  put('apps/web/src/sticker-editor.tsx', 'owned')
  put('apps/web/src/device-page.tsx', 'external')
  put('apps/web/tests/deterministic-apple-music.ts', 'fixture')
  put('package.json', '{}'); put('bun.lock', 'lock')
  put('apps/web/dist/server/server.js', 'built server'); put('apps/web/dist/client/index.js', 'built client')
  const source = sourceManifest(root)
  const record: BuildProvenance = { version: 1, buildCommand: ['bun', 'run', '--cwd', 'apps/web', 'build'], sourceBefore: source, sourceAfter: source, artifacts: artifactManifest(root), buildDeltas: [], exitCode: 0 }
  put('evidence/build.json', JSON.stringify(record))
  return { root, put, record, begin: () => beginEdgeProvenance(resolve(root, 'evidence/build.json'), resolve(root, 'evidence/test'), root), close: () => rmSync(root, { recursive: true, force: true }) }
}
test('stable build is mandatory, including changes to an externally allowed source', () => {
  const f = fixture()
  try {
    f.put('apps/web/src/device-page.tsx', 'changed')
    const after = sourceManifest(f.root)
    expect(() => verifyBuild({ ...f.record, sourceAfter: after, buildDeltas: manifestDiff(f.record.sourceBefore, after) })).toThrow('stable')
  } finally { f.close() }
})
test('exact external modification is disclosed while protected source and artifact remain immutable', () => {
  const f = fixture()
  try { const run = f.begin(); f.put('apps/web/src/device-page.tsx', 'changed'); expect(() => run.finish()).not.toThrow() } finally { f.close() }
})
test('owned source, fixture input, dependency and artifact mutation each fail', () => {
  for (const path of ['apps/web/src/sticker-editor.tsx', 'apps/web/tests/deterministic-apple-music.ts', 'package.json', 'bun.lock', 'apps/web/dist/client/index.js']) {
    const f = fixture()
    try { const run = f.begin(); f.put(path, 'mutated'); expect(() => run.finish()).toThrow('changed') } finally { f.close() }
  }
})
test('pretest source drift and new/deleted paths do not gain allowlist immunity', () => {
  const f = fixture()
  try {
    f.put('apps/web/src/sticker-editor.tsx', 'drift')
    expect(() => f.begin()).toThrow('changed')
    expect(protectedDeltas([{ path: 'apps/web/src/device-page.tsx', before: null, after: 'new' }])).toHaveLength(1)
    expect(protectedDeltas([{ path: 'apps/web/src/device-page.tsx', before: 'old', after: null }])).toHaveLength(1)
    expect(protectedDeltas([{ path: 'apps/web/src/unknown-external.ts', before: 'a', after: 'b' }])).toHaveLength(1)
  } finally { f.close() }
})
