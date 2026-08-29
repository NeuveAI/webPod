import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { parseW7BrowserEvidence } from './w7-browser-evidence-schema'

const evidencePath = resolve(
  import.meta.dirname,
  '../docs/workstreams/002-implementation-spine/evidence/w7-browser.json',
)
const expected = {
  reviewedCommit: 'd66c66bfdc8d1e284739dc3ecf73ac80b537e4fa',
  reviewedTree: '7d93de5f0b960adf1ecd3bba72114444bac63ad3',
} as const

describe('W7 immutable browser evidence identity', () => {
  test('the committed JSON parses and names the reviewed commit and tree', async () => {
    const value: unknown = await Bun.file(evidencePath).json()
    expect(parseW7BrowserEvidence(value, expected)).toMatchObject(expected)
  })

  for (const field of ['reviewedCommit', 'reviewedTree'] as const) {
    test(`deleting ${field} is a schema failure`, async () => {
      const value = await readEvidenceRecord()
      Reflect.deleteProperty(value, field)
      expect(() => parseW7BrowserEvidence(value, expected)).toThrow(
        `W7 ${field} must be a lowercase 40-character Git object id`,
      )
    })

    test(`a malformed ${field} is a schema failure`, async () => {
      const value = await readEvidenceRecord()
      value[field] = 'not-a-git-object-id'
      expect(() => parseW7BrowserEvidence(value, expected)).toThrow(
        `W7 ${field} must be a lowercase 40-character Git object id`,
      )
    })
  }

  test('a well-formed but different commit is an identity mismatch', async () => {
    const value = await readEvidenceRecord()
    value['reviewedCommit'] = '0000000000000000000000000000000000000000'
    expect(() => parseW7BrowserEvidence(value, expected)).toThrow('W7 reviewedCommit mismatch')
  })

  test('a well-formed but different tree is an identity mismatch', async () => {
    const value = await readEvidenceRecord()
    value['reviewedTree'] = '0000000000000000000000000000000000000000'
    expect(() => parseW7BrowserEvidence(value, expected)).toThrow('W7 reviewedTree mismatch')
  })
})

async function readEvidenceRecord(): Promise<Record<string, unknown>> {
  const value: unknown = await Bun.file(evidencePath).json()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Committed W7 browser evidence is not an object')
  }
  return { ...value }
}
