import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { fingerprintBrowserSources } from './browser-source-fingerprint'
import { parseW7BrowserEvidence } from './w7-browser-evidence-schema'

const evidencePath = resolve(
  import.meta.dirname,
  '../docs/workstreams/002-implementation-spine/evidence/w7-browser.json',
)
describe('W7 immutable browser evidence identity', () => {
  test('the committed source fingerprint is reconstructed from its reviewed Git tree', async () => {
    const value: unknown = await Bun.file(evidencePath).json()
    const declared = parseW7BrowserEvidence(value)
    const reconstructed = reconstructReviewedSource(declared.reviewedCommit, declared.reviewedTree)

    expect(parseW7BrowserEvidence(value, reconstructed)).toEqual(reconstructed)
  })

  for (const field of ['reviewedCommit', 'reviewedTree'] as const) {
    test(`deleting ${field} is a schema failure`, async () => {
      const value = await readEvidenceRecord()
      Reflect.deleteProperty(value, field)
      expect(() => parseW7BrowserEvidence(value)).toThrow(
        `W7 ${field} must be a lowercase 40-character Git object id`,
      )
    })

    test(`a malformed ${field} is a schema failure`, async () => {
      const value = await readEvidenceRecord()
      value[field] = 'not-a-git-object-id'
      expect(() => parseW7BrowserEvidence(value)).toThrow(
        `W7 ${field} must be a lowercase 40-character Git object id`,
      )
    })
  }

  test('a well-formed but different commit is an identity mismatch', async () => {
    const value = await readEvidenceRecord()
    value['reviewedCommit'] = '0000000000000000000000000000000000000000'
    const expected = await reconstructCommittedEvidence()
    expect(() => parseW7BrowserEvidence(value, expected)).toThrow('W7 reviewedCommit mismatch')
  })

  test('a well-formed but different tree is an identity mismatch', async () => {
    const value = await readEvidenceRecord()
    value['reviewedTree'] = '0000000000000000000000000000000000000000'
    const expected = await reconstructCommittedEvidence()
    expect(() => parseW7BrowserEvidence(value, expected)).toThrow('W7 reviewedTree mismatch')
  })

  test('a syntactically valid wrong source fingerprint is an identity mismatch', async () => {
    const value = await readEvidenceRecord()
    const expected = await reconstructCommittedEvidence()
    const source = requireEvidenceSource(value)
    source['digest'] = '0000000000000000000000000000000000000000000000000000000000000000'

    expect(() => parseW7BrowserEvidence(value, expected)).toThrow('W7 source fingerprint mismatch')
  })

  test('a syntactically valid wrong source file count is an identity mismatch', async () => {
    const value = await readEvidenceRecord()
    const expected = await reconstructCommittedEvidence()
    const source = requireEvidenceSource(value)
    source['fileCount'] = expected.expectedSource.fileCount + 1

    expect(() => parseW7BrowserEvidence(value, expected)).toThrow('W7 source file count mismatch')
  })
})

async function reconstructCommittedEvidence() {
  const value: unknown = await Bun.file(evidencePath).json()
  const declared = parseW7BrowserEvidence(value)
  return reconstructReviewedSource(declared.reviewedCommit, declared.reviewedTree)
}

function reconstructReviewedSource(reviewedCommit: string, reviewedTree: string) {
  const resolvedCommit = run('git', ['rev-parse', '--verify', `${reviewedCommit}^{commit}`]).trim()
  const resolvedTree = run('git', ['rev-parse', `${resolvedCommit}^{tree}`]).trim()
  if (resolvedCommit !== reviewedCommit) {
    throw new Error(`W7 reviewed commit did not resolve exactly: ${resolvedCommit}`)
  }
  if (resolvedTree !== reviewedTree) {
    throw new Error(`W7 reviewed tree mismatch: expected ${reviewedTree}, reconstructed ${resolvedTree}`)
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'webpod-w7-source-test-'))
  const snapshotRoot = join(temporaryRoot, 'snapshot')
  const archivePath = join(temporaryRoot, 'source.tar')
  try {
    run('git', [
      'archive', '--format=tar', `--output=${archivePath}`, resolvedCommit, '--',
      'package.json', 'bun.lock', 'tsconfig.base.json', 'apps', 'packages',
      'scripts/browser-source-fingerprint.ts',
    ])
    run('mkdir', ['-p', snapshotRoot])
    run('tar', ['-xf', archivePath, '-C', snapshotRoot])
    return {
      reviewedCommit: resolvedCommit,
      reviewedTree: resolvedTree,
      expectedSource: fingerprintBrowserSources(snapshotRoot),
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

function requireEvidenceSource(value: Record<string, unknown>): Record<string, unknown> {
  const source = value['expectedSource']
  if (!isRecord(source)) {
    throw new Error('Committed W7 expectedSource is not an object')
  }
  return source
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function run(command: string, args: readonly string[]): string {
  const result = Bun.spawnSync([command, ...args], { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.toString()}`)
  }
  return result.stdout.toString()
}

async function readEvidenceRecord(): Promise<Record<string, unknown>> {
  const value: unknown = await Bun.file(evidencePath).json()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Committed W7 browser evidence is not an object')
  }
  return { ...value }
}
