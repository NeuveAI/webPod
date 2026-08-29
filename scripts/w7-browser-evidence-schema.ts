import type { BrowserSourceFingerprint } from './browser-source-fingerprint'

export interface W7SourceIdentity {
  readonly reviewedCommit: string
  readonly reviewedTree: string
}

export interface W7ValidatedSourceIdentity extends W7SourceIdentity {
  readonly expectedSource: BrowserSourceFingerprint
}

export interface W7BrowserEvidence extends W7SourceIdentity {
  readonly route: string
  readonly chromeVersion: string
  readonly flag: 'CanvasDrawElement'
  readonly requestPaint: boolean
  readonly tier: string | null
  readonly expectedSource: BrowserSourceFingerprint
  readonly healthBefore: W7SourceHealth
  readonly healthAfter: W7SourceHealth
  readonly sourceAfter: BrowserSourceFingerprint
  readonly canvas: W7CanvasBounds
  readonly selectedBeforeArc: string | null
  readonly selectedAfterArc: string | null
  readonly focusAfterArc: W7FocusIdentity
  readonly selectedAfterKeyboard: string | null
  readonly keyboardContinued: boolean
  readonly pageErrors: readonly string[]
}

export interface W7SourceHealth {
  readonly expected: string
  readonly current: string
  readonly expectedFileCount: number
  readonly fileCount: number
}

export interface W7CanvasBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface W7FocusIdentity {
  readonly role: string | null
  readonly label: string | null
}

const GIT_OBJECT_ID = /^[a-f0-9]{40}$/u
const SHA256 = /^[a-f0-9]{64}$/u

/**
 * Validates the durable identity fields at the JSON boundary and optionally
 * binds them to the commit/tree the caller intended to review.
 */
export function parseW7BrowserEvidence(
  value: unknown,
  expected?: W7SourceIdentity,
): W7ValidatedSourceIdentity {
  if (!isRecord(value)) throw new Error('W7 browser evidence must be an object')
  const reviewedCommit = requireObjectId(value, 'reviewedCommit')
  const reviewedTree = requireObjectId(value, 'reviewedTree')
  if (expected !== undefined && reviewedCommit !== expected.reviewedCommit) {
    throw new Error(`W7 reviewedCommit mismatch: expected ${expected.reviewedCommit}, received ${reviewedCommit}`)
  }
  if (expected !== undefined && reviewedTree !== expected.reviewedTree) {
    throw new Error(`W7 reviewedTree mismatch: expected ${expected.reviewedTree}, received ${reviewedTree}`)
  }
  const expectedSource = value['expectedSource']
  if (!isRecord(expectedSource)) throw new Error('W7 expectedSource must be an object')
  const digest = expectedSource['digest']
  const fileCount = expectedSource['fileCount']
  if (typeof digest !== 'string' || !SHA256.test(digest)) {
    throw new Error('W7 expectedSource.digest must be a lowercase SHA-256')
  }
  if (typeof fileCount !== 'number' || !Number.isInteger(fileCount) || fileCount <= 0) {
    throw new Error('W7 expectedSource.fileCount must be a positive integer')
  }
  return { reviewedCommit, reviewedTree, expectedSource: { digest, fileCount } }
}

function requireObjectId(value: Readonly<Record<string, unknown>>, field: string): string {
  const identity = value[field]
  if (typeof identity !== 'string' || !GIT_OBJECT_ID.test(identity)) {
    throw new Error(`W7 ${field} must be a lowercase 40-character Git object id`)
  }
  return identity
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
