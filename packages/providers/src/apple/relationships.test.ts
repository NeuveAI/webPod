import { describe, expect, test } from 'bun:test'

import { RelationshipNotHonouredError, RelationshipUnknownError } from '../errors.ts'
import {
  assertKnownSongRelationship,
  classifyRelationshipResponse,
  readSongRelationship,
  SONG_RELATIONSHIPS,
} from './relationships.ts'
import type { AppleResource, RelationshipExistence } from './relationships.ts'

describe('D-029 — a 200 is not proof the relationship was requested', () => {
  test('requested-but-absent is a distinct failure from absent-because-empty', () => {
    // The hazard, exactly: Apple silently ignores an invalid include/views/
    // extend and answers 200. A typo'd `include=station` therefore returns a
    // success whose payload merely lacks the relationship, which reads as
    // "this song has no station" — a plausible data condition that is a lie.
    const typo: AppleResource = { id: '651880159' }
    const empty: AppleResource = { id: '651880159', relationships: { station: { data: [] } } }

    expect(() => readSongRelationship(typo, 'station')).toThrow(RelationshipNotHonouredError)
    expect(readSongRelationship(empty, 'station')).toEqual([])
  })

  test('the two conditions carry different tags, so a caller can branch on them', () => {
    let tag: string | null = null
    try {
      readSongRelationship({ id: 'x' }, 'station')
    } catch (error) {
      tag = (error as RelationshipNotHonouredError)._tag
    }
    expect(tag).toBe('RelationshipNotHonoured')
  })

  test('the error names the relationship and the resource, and says not to read it as "no data"', () => {
    try {
      readSongRelationship({ id: '651880159' }, 'station')
      throw new Error('expected a throw')
    } catch (error) {
      const typed = error as RelationshipNotHonouredError
      expect(typed.relationship).toBe('station')
      expect(typed.resourceId).toBe('651880159')
      expect(typed.message).toContain('no data')
    }
  })

  test('a relationships object that lacks the key entirely still throws', () => {
    const other: AppleResource = { id: 'x', relationships: { artists: { data: [{ id: 'a' }] } } }
    expect(() => readSongRelationship(other, 'station')).toThrow(RelationshipNotHonouredError)
  })

  test('an explicitly undefined key throws rather than reading as empty', () => {
    const undef: AppleResource = { id: 'x', relationships: { station: undefined } }
    expect(() => readSongRelationship(undef, 'station')).toThrow(RelationshipNotHonouredError)
  })

  test('a present key with no data array is honoured-and-empty', () => {
    // The key's presence is what proves the request was honoured; a missing
    // `data` on a present key is an empty relationship, not a failed request.
    expect(readSongRelationship({ id: 'x', relationships: { station: {} } }, 'station')).toEqual([])
  })

  test('data is returned when it is there', () => {
    const withData: AppleResource = {
      id: '651880159',
      relationships: { station: { data: [{ id: 'ra.651880159' }] } },
    }
    expect(readSongRelationship(withData, 'station')).toEqual([{ id: 'ra.651880159' }])
  })

  test('the function takes no HTTP status — there is no slot to misuse', () => {
    // Structural, not a comment: a status code cannot be passed, so it cannot
    // be relied on. Arity is the enforcement.
    expect(readSongRelationship).toHaveLength(2)
  })
})

describe('a typo is caught before the request is built', () => {
  test('an unregistered name is refused', () => {
    expect(() => assertKnownSongRelationship('statoin')).toThrow(RelationshipUnknownError)
    expect(() => readSongRelationship({ id: 'x' }, 'statoin')).toThrow(RelationshipUnknownError)
  })

  test.each(['similar-songs', 'radio', 'videos'])('%s was measured live as not a relationship', (name) => {
    expect(SONG_RELATIONSHIPS[name]).toBe('live-absent')
    expect(() => assertKnownSongRelationship(name)).toThrow(RelationshipUnknownError)
  })

  test.each(['artists', 'station', 'credits'])('%s was measured live and is accepted', (name) => {
    expect(SONG_RELATIONSHIPS[name]).toBe('live-exists')
    expect(() => {
      assertKnownSongRelationship(name)
    }).not.toThrow()
  })

  test.each(['lyrics', 'syllable-lyrics'])('%s exists and is gated — the registry says so', (name) => {
    // The distinction that settled §14.3 row 21: gated is not absent.
    expect(SONG_RELATIONSHIPS[name]).toBe('live-gated')
  })
})

describe("S2's four-state existence oracle", () => {
  const ORACLE: readonly (readonly [number, string | null, RelationshipExistence])[] = [
    [200, null, 'exists-with-data'],
    [404, '40403', 'exists-no-data'],
    [400, '40012', 'exists-gated'],
    [400, '40008', 'not-a-relationship'],
  ]

  test.each(ORACLE)('status %p code %p classifies as %p', (status, code, expected) => {
    expect(classifyRelationshipResponse(status, code)).toBe(expected)
  })

  test('40012 and 40008 are never collapsed — that distinction is the whole finding', () => {
    // A bare status code was worthless here: both are 400. Only the paired
    // codes separate "exists, you lack permission" from "not a relationship",
    // and reading them as one is what put a wrong correction on a right spec.
    expect(classifyRelationshipResponse(400, '40012')).not.toBe(classifyRelationshipResponse(400, '40008'))
  })

  test('an unrecognised response is inconclusive, never an absence', () => {
    expect(classifyRelationshipResponse(401, null)).toBe('inconclusive')
    expect(classifyRelationshipResponse(429, null)).toBe('inconclusive')
    expect(classifyRelationshipResponse(500, null)).toBe('inconclusive')
    // 401 is what an unauthenticated caller sees for all three paths, which is
    // why the oracle cannot be reproduced without a signed developer token.
  })
})
