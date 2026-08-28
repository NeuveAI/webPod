import { describe, expect, test } from 'bun:test'

import { createAppleProvider } from './apple/apple-provider.ts'
import {
  CAPABILITIES,
  CAPABILITIES_WITHOUT_A_CONTROL,
  CAPABILITY_FEATURE_NAMES,
  unsupportedCapabilitiesToSurface,
} from './capability.ts'
import type { Capability } from './capability.ts'
import { createFixtureProvider } from './fixture/fixture-provider.ts'
import { createSpotifyProvider } from './spotify/spotify-provider.ts'

/**
 * §14.2's union, retyped here by hand from the spec text rather than imported.
 *
 * Importing it would make this test tautological — it would compare the source
 * with itself. Written out, it is an independent transcription, so a member
 * quietly added to or dropped from `capability.ts` fails here.
 */
const SPEC_14_2_UNION_MINUS_RULINGS: readonly string[] = [
  'auth', 'search', 'libraryRead', 'libraryAdd', 'libraryRemove',
  'playlistCreate', 'playlistAddTracks', 'playlistRemoveTracks', 'playlistReorder',
  'transport', 'seek', 'volume', 'queueRead', 'queueAppend', 'queueInsertNext',
  'queueRemove', 'queueReorder', 'stations', 'stationSeedFromTrack',
  'lyrics', 'lyricsSynced', 'ratingLoveDislike', 'saveToggle',
  'progressTicks', 'artworkArbitrarySize',
]

describe('the Capability union', () => {
  test('is §14.2 verbatim, in §14.2 order', () => {
    expect(CAPABILITIES.map((c) => String(c))).toEqual([...SPEC_14_2_UNION_MINUS_RULINGS])
  })

  test('has 25 members — §14.2 has 26 and one was dropped by ruling', () => {
    expect(CAPABILITIES).toHaveLength(25)
  })

  test('lists every member exactly once', () => {
    expect(new Set(CAPABILITIES).size).toBe(CAPABILITIES.length)
  })

  test('does not contain ratingStars (D-026)', () => {
    // Stars are a local-only device rating, emulated identically on every
    // provider and synced nowhere. A `supports()` key implies a provider
    // question; there is none, and §14.2 gives no method that could answer one.
    expect(CAPABILITIES).not.toContain('ratingStars' as Capability)
  })

  test('does not contain offline (D-019)', () => {
    // It was never a member of §14.2's union and will not become one: no
    // browser client on either provider can hold audio, so the row would be
    // permanently false and would invite a control that can never have contents.
    expect(CAPABILITIES).not.toContain('offline' as Capability)
  })
})

describe('capability feature names', () => {
  test('every capability has one', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_FEATURE_NAMES[capability]).toBeTruthy()
    }
  })

  test('they carry no exclamation mark — §11.0 rule 2 admits none in the product', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_FEATURE_NAMES[capability]).not.toContain('!')
    }
  })
})

describe('the B04 / S27 surfacing boundary (D-049)', () => {
  test.each(CAPABILITIES_WITHOUT_A_CONTROL.map((c) => [c]))(
    '%s is never surfaced as a missing feature, because it hides no control',
    (capability) => {
      // On Spotify both of these are `false` and both features work —
      // interpolated position and 640px artwork. A roster built by walking
      // every `false` would tell the user two working things are unavailable,
      // on the screen whose job is telling them the truth about this product.
      const rows = unsupportedCapabilitiesToSurface(createSpotifyProvider())
      expect(rows.map((r) => r.capability)).not.toContain(capability)
    },
  )

  test('everything else Spotify lacks is surfaced, with its verbatim copy', () => {
    const spotify = createSpotifyProvider()
    const rows = unsupportedCapabilitiesToSurface(spotify)
    const expected = CAPABILITIES.filter(
      (c) => !spotify.supports(c) && !CAPABILITIES_WITHOUT_A_CONTROL.includes(c),
    )

    expect(rows.map((r) => r.capability)).toEqual(expected)
    for (const row of rows) {
      expect(row.reason).toBe(spotify.unsupportedReason(row.capability) ?? '')
      expect(row.reason.length).toBeGreaterThan(0)
      expect(row.feature).toBe(CAPABILITY_FEATURE_NAMES[row.capability])
    }
  })

  test('the roster keeps §14.2 capability order, so B04 is stable between providers', () => {
    for (const provider of [createAppleProvider(), createSpotifyProvider()]) {
      const rows = unsupportedCapabilitiesToSurface(provider)
      const positions = rows.map((r) => CAPABILITIES.indexOf(r.capability))
      expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    }
  })

  test('a fully capable provider surfaces nothing — an empty roster is a state, not a bug', () => {
    expect(unsupportedCapabilitiesToSurface(createFixtureProvider())).toEqual([])
  })

  test('Apple surfaces exactly the seven §14.3 rows it lacks', () => {
    const rows = unsupportedCapabilitiesToSurface(createAppleProvider())
    expect(rows.map((r) => r.capability)).toEqual([
      'libraryRemove',
      'playlistRemoveTracks',
      'playlistReorder',
      'queueRemove',
      'queueReorder',
      'lyrics',
      'lyricsSynced',
    ])
  })
})
