import { expect, type Page } from '../../../packages/panel/node_modules/@playwright/test/index.mjs'

export interface BrowserSourceHealth {
  readonly expected: string
  readonly current: string
  readonly expectedFileCount: number
  readonly fileCount: number
  readonly reviewedCommit: string | null
  readonly reviewedTree: string | null
}

export interface ReviewedBrowserSource {
  readonly expectedFingerprint: string
  readonly expectedFileCount: number
  readonly reviewedCommit: string | null
  readonly reviewedTree: string | null
}

const GIT_OBJECT_ID = /^[a-f0-9]{40}$/u

export function readReviewedBrowserSource(): ReviewedBrowserSource {
  const expectedFingerprint = process.env['W5B_EXPECTED_SOURCE_FINGERPRINT']
  const expectedFileCount = Number(process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'])
  const reviewedCommit = readOptionalIdentity('W5B_REVIEWED_COMMIT')
  const reviewedTree = readOptionalIdentity('W5B_REVIEWED_TREE')
  if (expectedFingerprint === undefined || !Number.isInteger(expectedFileCount) || expectedFileCount <= 0) {
    throw new Error('Playwright source fingerprint was not initialized')
  }
  if ((reviewedCommit === null) !== (reviewedTree === null)) {
    throw new Error('Reviewed browser source identity must provide both commit and tree or neither')
  }
  return { expectedFingerprint, expectedFileCount, reviewedCommit, reviewedTree }
}

export function parseBrowserSourceHealth(serialized: string): BrowserSourceHealth {
  const value: unknown = JSON.parse(serialized)
  if (typeof value !== 'object' || value === null) throw new Error('Source health did not return an object')
  if (!('expected' in value) || typeof value.expected !== 'string') throw new Error('Source health omitted expected digest')
  if (!('current' in value) || typeof value.current !== 'string') throw new Error('Source health omitted current digest')
  if (!('expectedFileCount' in value) || typeof value.expectedFileCount !== 'number') throw new Error('Source health omitted expected file count')
  if (!('fileCount' in value) || typeof value.fileCount !== 'number') throw new Error('Source health omitted file count')
  const reviewedCommit = parseOptionalIdentity(value, 'reviewedCommit')
  const reviewedTree = parseOptionalIdentity(value, 'reviewedTree')
  if ((reviewedCommit === null) !== (reviewedTree === null)) {
    throw new Error('Source health must provide both reviewed commit and tree or neither')
  }
  return {
    expected: value.expected,
    current: value.current,
    expectedFileCount: value.expectedFileCount,
    fileCount: value.fileCount,
    reviewedCommit,
    reviewedTree,
  }
}

export async function assertBrowserSourceIdentity(page: Page): Promise<BrowserSourceHealth> {
  const expected = readReviewedBrowserSource()
  const response = await page.evaluate(async () => {
    const result = await fetch('/__webpod_health', { cache: 'no-store' })
    return { ok: result.ok, status: result.status, body: await result.text() }
  })
  expect(response.ok, `source health returned ${String(response.status)}`).toBe(true)
  const health = parseBrowserSourceHealth(response.body)
  expect(health.expected).toBe(expected.expectedFingerprint)
  expect(health.expectedFileCount).toBe(expected.expectedFileCount)
  expect(health.fileCount).toBe(expected.expectedFileCount)
  expect(health.reviewedCommit).toBe(expected.reviewedCommit)
  expect(health.reviewedTree).toBe(expected.reviewedTree)
  expect(health.current, 'the immutable served snapshot changed during the browser proof').toBe(expected.expectedFingerprint)
  return health
}

function readOptionalIdentity(name: 'W5B_REVIEWED_COMMIT' | 'W5B_REVIEWED_TREE'): string | null {
  const value = process.env[name]
  if (value === undefined || value.length === 0) return null
  if (!GIT_OBJECT_ID.test(value)) {
    throw new Error(`${name} must be a lowercase 40-character Git object id`)
  }
  return value
}

function parseOptionalIdentity(value: object, key: 'reviewedCommit' | 'reviewedTree'): string | null {
  if (!(key in value) || value[key] === null) return null
  if (typeof value[key] !== 'string' || !GIT_OBJECT_ID.test(value[key])) {
    throw new Error(`Source health ${key} must be null or a lowercase 40-character Git object id`)
  }
  return value[key]
}
