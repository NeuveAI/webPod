import { describe, expect, test } from 'bun:test'

import { mintLocalKey } from './identity.ts'
import type { TrackRef } from './identity.ts'
import { DURATION_TOLERANCE_MS, normaliseForMatch, reresolve, reresolveAll } from './reresolve.ts'

function track(over: Partial<TrackRef> = {}): TrackRef {
  return {
    kind: 'track',
    key: mintLocalKey(),
    provider: 'apple',
    catalogId: '1440857781',
    title: 'Vienna',
    artistName: 'The Fray',
    albumName: 'The Fray',
    durationMs: 224_000,
    playable: true,
    ...over,
  }
}

describe('normaliseForMatch', () => {
  test.each([
    ['Vienna (feat. Someone Else)', 'vienna'],
    ['Vienna [feat. Someone Else]', 'vienna'],
    ['Vienna - 2019 Remaster', 'vienna 2019 remaster'],
    ['Vienna (2019 Remaster)', 'vienna'],
    ['Vienna (Deluxe Edition)', 'vienna'],
    ["Don't Stop Believin'", 'dont stop believin'],
    ['  Vienna   ', 'vienna'],
    ['VIENNA', 'vienna'],
  ])('%p normalises to %p', (input, expected) => {
    expect(normaliseForMatch(input)).toBe(expected)
  })

  test('keeps accented letters — stripping them loses a real catalogue', () => {
    expect(normaliseForMatch('Björk')).toBe('bjork')
    expect(normaliseForMatch('Sigur Rós')).toBe('sigur ros')
  })
})

describe('§14.5 constants', () => {
  test('the duration tolerance is ±2000ms, which §14.5 states as a literal', () => {
    // D-050: a constant is gated only if falsifying it turns a test red. The
    // rung-2 case below used to write `224_000 + DURATION_TOLERANCE_MS`, so
    // both sides moved with the symbol and 500 / 3000 / 30000 all stayed green.
    // At 30s a live cut and a studio cut of the same song are silently promoted
    // from `low` to `metadata` — a queue rebuilt out of the wrong recordings,
    // reported as matched, which is the harm §14.5 exists to prevent.
    expect(DURATION_TOLERANCE_MS).toBe(2000)
  })
})

describe('§14.5 ladder', () => {
  test('rung 1: an ISRC match wins, and outranks a better-looking text match', () => {
    const original = track({ isrc: 'USSM10305161' })
    const decoy = track({ provider: 'spotify', catalogId: 'decoy', durationMs: 224_000 })
    const real = track({
      provider: 'spotify',
      catalogId: 'real',
      isrc: 'USSM10305161',
      title: 'Vienna (2019 Remaster)',
      durationMs: 231_000,
    })

    const result = reresolve(original, [decoy, real])
    expect(result?.confidence).toBe('isrc')
    expect(result?.ref.catalogId).toBe('real')
  })

  test('rung 2: title + artist + duration exactly at the ±2000ms edge', () => {
    // Literals on both sides, drawn from §14.5's stated ±2000ms rather than
    // from the symbol under test.
    const original = track({ durationMs: 224_000 })
    const later = track({ provider: 'spotify', catalogId: 'sp-late', durationMs: 226_000 })
    const earlier = track({ provider: 'spotify', catalogId: 'sp-early', durationMs: 222_000 })

    expect(reresolve(original, [later])?.confidence).toBe('metadata')
    expect(reresolve(original, [earlier])?.confidence).toBe('metadata')
  })

  test('one millisecond past the tolerance drops to the low rung', () => {
    // The pair above and this one bracket the boundary from both sides, so a
    // tolerance that is too wide fails here and one that is too narrow fails
    // above. Either direction is red.
    const original = track({ durationMs: 224_000 })
    const later = track({ provider: 'spotify', catalogId: 'sp-late', durationMs: 226_001 })
    const earlier = track({ provider: 'spotify', catalogId: 'sp-early', durationMs: 221_999 })

    expect(reresolve(original, [later])?.confidence).toBe('low')
    expect(reresolve(original, [earlier])?.confidence).toBe('low')
  })

  test('a live cut is never promoted above the low rung', () => {
    // The concrete harm: §14.5's migration card must not report a different
    // recording of the same song as a match.
    const studio = track({ durationMs: 224_000 })
    const live = track({ provider: 'spotify', catalogId: 'sp-live', durationMs: 254_000 })
    expect(reresolve(studio, [live])?.confidence).toBe('low')
  })

  test('rung 3: text alone is a match, and is flagged low', () => {
    const original = track()
    const candidate = track({ provider: 'spotify', catalogId: 'sp1', durationMs: 190_000 })

    const result = reresolve(original, [candidate])
    expect(result?.confidence).toBe('low')
  })

  test('a duration match further down the list outranks an earlier text-only one', () => {
    // Duration is what separates a recording from a different recording of the
    // same song, so it must not lose to list position.
    const original = track()
    const live = track({ provider: 'spotify', catalogId: 'live', durationMs: 400_000 })
    const studio = track({ provider: 'spotify', catalogId: 'studio', durationMs: 224_500 })

    const result = reresolve(original, [live, studio])
    expect(result?.confidence).toBe('metadata')
    expect(result?.ref.catalogId).toBe('studio')
  })

  test('a different artist is not a match at any rung', () => {
    const original = track()
    const candidate = track({ provider: 'spotify', catalogId: 'sp1', artistName: 'Billy Joel' })
    expect(reresolve(original, [candidate])).toBeNull()
  })

  test('no candidates is a miss, not a throw', () => {
    expect(reresolve(track(), [])).toBeNull()
  })
})

describe('§14.5 identity — what survives a provider switch', () => {
  test('the LocalKey survives and every provider field is replaced', () => {
    const original = track({
      key: mintLocalKey(),
      provider: 'apple',
      catalogId: '1440857781',
      libraryId: 'i.gLrJKQEsl5eL2q',
      isrc: 'USSM10305161',
    })
    const onSpotify = track({
      provider: 'spotify',
      catalogId: '4uLU6hMCjMI75M1A2tKUQC',
      isrc: 'USSM10305161',
    })

    const result = reresolve(original, [onSpotify])

    // The key is ours. It is the thing a star rating, a draft row and an
    // Engraving entry are filed under, so it must not move.
    expect(result?.ref.key).toBe(original.key)
    // Everything the service owns is now the new service's.
    expect(result?.ref.provider).toBe('spotify')
    expect(result?.ref.catalogId).toBe('4uLU6hMCjMI75M1A2tKUQC')
    expect(result?.ref.catalogId).not.toBe(original.catalogId)
    // Apple's library id space does not exist on Spotify and must not be carried.
    expect(result?.ref.libraryId).toBeUndefined()
  })

  test('a key never leaks between two different tracks', () => {
    const a = track({ title: 'Vienna', isrc: 'AAA' })
    const b = track({ title: 'Aims', artistName: 'Vienna Teng', isrc: 'BBB' })
    expect(a.key).not.toBe(b.key)

    const candidates = [
      track({ provider: 'spotify', catalogId: 'sp-a', title: 'Vienna', isrc: 'AAA' }),
      track({ provider: 'spotify', catalogId: 'sp-b', title: 'Aims', artistName: 'Vienna Teng', isrc: 'BBB' }),
    ]

    expect(reresolve(a, candidates)?.ref.key).toBe(a.key)
    expect(reresolve(b, candidates)?.ref.key).toBe(b.key)
  })

  test('reresolveAll reports the misses by name, as the migration card needs', () => {
    const kept = track({ title: 'Vienna', isrc: 'AAA' })
    const lost = track({ title: 'Unreleased Thing', isrc: 'ZZZ' })
    const onSpotify = track({ provider: 'spotify', catalogId: 'sp-a', title: 'Vienna', isrc: 'AAA' })

    const report = reresolveAll([kept, lost], (ref) => (ref.isrc === 'AAA' ? [onSpotify] : []))

    expect(report.matched).toHaveLength(1)
    expect(report.matched[0]?.ref.key).toBe(kept.key)
    expect(report.unmatched).toHaveLength(1)
    // Named, not counted: §14.5's card lists the songs that did not come across.
    expect(report.unmatched[0]?.title).toBe('Unreleased Thing')
  })

  test('order is preserved, so a rebuilt queue is in the order it was', () => {
    const originals = [track({ isrc: 'A' }), track({ isrc: 'B' }), track({ isrc: 'C' })]
    const report = reresolveAll(originals, (ref) => [track({ provider: 'spotify', isrc: ref.isrc })])
    expect(report.matched.map((m) => m.ref.key)).toEqual(originals.map((o) => o.key))
  })
})
