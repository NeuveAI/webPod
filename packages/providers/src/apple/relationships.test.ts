import { describe, expect, test } from 'bun:test'

import { RelationshipNotHonouredError, RelationshipUnknownError } from '../errors.ts'
import {
  assertKnownSongRelationship,
  classifyRelationshipResponse,
  isMeasuredRelationship,
  readSongRelationship,
  SONG_RELATIONSHIPS,
} from './relationships.ts'
import type { AppleResource, RelationshipEvidence, RelationshipExistence, RelationshipRead } from './relationships.ts'

// ── The D-062 guards ────────────────────────────────────────────────────────
//
// These are checked by `tsc`, not at runtime. The assertion they replace was
// `expect(readSongRelationship).toHaveLength(2)`, which is worthless:
// `Function.length` stops counting at the first defaulted parameter, so
// `(resource, name, status = 0)` satisfied it and the reviewer reintroduced the
// exact D-029 mistake — `if (status === 200) return …data ?? []` — with tsc at
// 0 and 230 tests green. A structural guarantee has to be enforced by something
// the compiler checks.
//
// Two ways a status could get in, two assertions:

/** `true` only when `T` has exactly length `N` — a union such as `1 | 2` fails both directions. */
type HasExactLength<T extends readonly unknown[], N extends number> = T['length'] extends N
  ? N extends T['length']
    ? true
    : false
  : false

/** `true` only when `T`'s keys are exactly `K` — an added field fails the first test. */
type HasExactKeys<T, K extends PropertyKey> = Exclude<keyof T, K> extends never
  ? Exclude<K, keyof T> extends never
    ? true
    : false
  : false

/**
 * A second parameter — defaulted, optional or required — turns the tuple length
 * into a union and this red.
 */
const TAKES_EXACTLY_ONE_PARAMETER: HasExactLength<Parameters<typeof readSongRelationship>, 1> = true

/**
 * A `status` field on the parameter object — however it is spelled — turns this
 * red. Together with the assertion above there is nowhere left to put one.
 */
const PARAMETER_CARRIES_NO_STATUS: HasExactKeys<RelationshipRead, 'resource' | 'relationship'> = true

describe('D-029 — a 200 is not proof the relationship was requested', () => {
  test('there is no parameter a status could arrive in (D-062)', () => {
    // The two constants above are the real assertion and they are enforced by
    // `tsc`. These expectations exist so the guard appears in the test roster
    // rather than being invisible in a type position.
    expect(TAKES_EXACTLY_ONE_PARAMETER).toBe(true)
    expect(PARAMETER_CARRIES_NO_STATUS).toBe(true)
  })

  test('requested-but-absent is a distinct failure from absent-because-empty', () => {
    // The hazard, exactly: Apple silently ignores an invalid include/views/
    // extend and answers 200. A typo'd `include=station` therefore returns a
    // success whose payload merely lacks the relationship, which reads as
    // "this song has no station" — a plausible data condition that is a lie.
    const typo: AppleResource = { id: '651880159' }
    const empty: AppleResource = { id: '651880159', relationships: { station: { data: [] } } }

    expect(() => readSongRelationship({ resource: typo, relationship: 'station' })).toThrow(
      RelationshipNotHonouredError,
    )
    expect(readSongRelationship({ resource: empty, relationship: 'station' })).toEqual([])
  })

  test('the two conditions carry different tags, so a caller can branch on them', () => {
    let tag: string | null = null
    try {
      readSongRelationship({ resource: { id: 'x' }, relationship: 'station' })
    } catch (error) {
      tag = (error as RelationshipNotHonouredError)._tag
    }
    expect(tag).toBe('RelationshipNotHonoured')
  })

  test('the error names the relationship and the resource, and says not to read it as "no data"', () => {
    try {
      readSongRelationship({ resource: { id: '651880159' }, relationship: 'station' })
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
    expect(() => readSongRelationship({ resource: other, relationship: 'station' })).toThrow(
      RelationshipNotHonouredError,
    )
  })

  test('an explicitly undefined key throws rather than reading as empty', () => {
    const undef: AppleResource = { id: 'x', relationships: { station: undefined } }
    expect(() => readSongRelationship({ resource: undef, relationship: 'station' })).toThrow(
      RelationshipNotHonouredError,
    )
  })

  test('a JSON null value throws with a tag, not a bare TypeError', () => {
    // `null` is legal JSON and arrives as a present key with no object. Reading
    // `.data` off it produces a `TypeError`, which carries no `_tag` — so the
    // caller's D-029 branch is bypassed by the one module written to contain it.
    const parsed = JSON.parse('{"id":"x","relationships":{"station":null}}') as AppleResource
    let thrown: unknown = null
    try {
      readSongRelationship({ resource: parsed, relationship: 'station' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RelationshipNotHonouredError)
    expect(thrown).not.toBeInstanceOf(TypeError)
    expect((thrown as RelationshipNotHonouredError)._tag).toBe('RelationshipNotHonoured')
  })

  test('a present key with no data array is honoured-and-empty', () => {
    // The key's presence is what proves the request was honoured; a missing
    // `data` on a present key is an empty relationship, not a failed request.
    expect(readSongRelationship({ resource: { id: 'x', relationships: { station: {} } }, relationship: 'station' })).toEqual(
      [],
    )
  })

  test('data is returned when it is there', () => {
    const withData: AppleResource = {
      id: '651880159',
      relationships: { station: { data: [{ id: 'ra.651880159' }] } },
    }
    expect(readSongRelationship({ resource: withData, relationship: 'station' })).toEqual([{ id: 'ra.651880159' }])
  })
})

describe('a typo is caught before the request is built', () => {
  test('an unregistered name is refused', () => {
    expect(() => assertKnownSongRelationship('statoin')).toThrow(RelationshipUnknownError)
    expect(() => readSongRelationship({ resource: { id: 'x' }, relationship: 'statoin' })).toThrow(
      RelationshipUnknownError,
    )
  })

  test.each(['similar-songs', 'radio', 'videos'])('%s was measured live as not a relationship', (name) => {
    expect(SONG_RELATIONSHIPS[name]).toBe('live-absent')
    expect(() => assertKnownSongRelationship(name)).toThrow(RelationshipUnknownError)
  })

  test.each(['artists', 'station', 'credits'])('%s was measured live and is accepted', (name) => {
    expect(SONG_RELATIONSHIPS[name]).toBe('live-exists')
    expect(assertKnownSongRelationship(name)).toBe('live-exists')
  })

  test.each(['lyrics', 'syllable-lyrics'])('%s exists and is gated — the registry says so', (name) => {
    // The distinction that settled §14.3 row 21: gated is not absent.
    expect(SONG_RELATIONSHIPS[name]).toBe('live-gated')
  })
})

describe('D-045 — the gate acts on the evidence class instead of discarding it', () => {
  test.each(['albums', 'composers', 'genres', 'library', 'music-videos'])(
    '%s is documentation-only and is reported as unmeasured',
    (name) => {
      expect(assertKnownSongRelationship(name)).toBe('docs-only')
      expect(isMeasuredRelationship('docs-only')).toBe(false)
    },
  )

  test.each<readonly [RelationshipEvidence]>([['live-exists'], ['live-gated']])(
    '%s is measured',
    (evidence) => {
      expect(isMeasuredRelationship(evidence)).toBe(true)
    },
  )

  test('an absent measured relationship is reported as a request that was not honoured', () => {
    try {
      readSongRelationship({ resource: { id: 'x' }, relationship: 'station' })
      throw new Error('expected a throw')
    } catch (error) {
      const typed = error as RelationshipNotHonouredError
      expect(typed.nameIsMeasured).toBe(true)
      expect(typed.message).toContain('the request was not honoured')
      expect(typed.message).not.toContain('40008')
    }
  })

  test('an absent documentation-only relationship names both candidate causes', () => {
    // Apple's documentation is the surface D-029 proved unreliable in the
    // other direction — it under-lists. A name taken from it that turns out
    // not to exist returns 200 and lands here, and a message saying only "the
    // request was not honoured" would send the reader after a request bug.
    try {
      readSongRelationship({ resource: { id: 'x' }, relationship: 'composers' })
      throw new Error('expected a throw')
    } catch (error) {
      const typed = error as RelationshipNotHonouredError
      expect(typed.nameIsMeasured).toBe(false)
      expect(typed.message).toContain('is not a real relationship')
      expect(typed.message).toContain('40008')
    }
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
