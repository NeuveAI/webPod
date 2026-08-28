import { describe, expect, test } from 'bun:test'

import { CAPABILITIES } from './capability.ts'
import type { Capability } from './capability.ts'
import { createAppleProvider } from './apple/apple-provider.ts'
import { createSpotifyProvider } from './spotify/spotify-provider.ts'

/**
 * §14.3, one entry per row, transcribed **from the spec table and the rulings
 * that amended it** — not from the matrices under test.
 *
 * Importing the matrices to check the matrices would prove only that a file
 * equals itself. This is a second, independent reading, so a value edited in
 * `apple/matrix.ts` without the corresponding evidence fails here.
 *
 * `capabilities: []` marks a row §14.2's union does not model. Those rows are
 * not skipped — an unmodelled row is a decision, and each one is asserted
 * below with the reason it carries no key.
 */
interface MatrixRow {
  readonly row: number
  readonly title: string
  readonly capabilities: readonly Capability[]
  readonly apple: boolean
  readonly spotify: boolean
  /** Why the row reads the way it does. */
  readonly why: string
}

const MATRIX_14_3: readonly MatrixRow[] = [
  { row: 1, title: 'Authorise / session', capabilities: ['auth'], apple: true, spotify: true, why: 'parity' },
  { row: 2, title: 'Paid tier required to play', capabilities: [], apple: true, spotify: true, why: 'not a capability — Session.canPlay carries it, because a free account authorises fine and cannot play' },
  { row: 3, title: 'Playback host', capabilities: [], apple: true, spotify: true, why: 'not a capability — a degrade posture in S27; transport still works through our wheel' },
  { row: 4, title: 'Catalogue search', capabilities: ['search'], apple: true, spotify: true, why: 'parity' },
  { row: 5, title: 'Library read', capabilities: ['libraryRead'], apple: true, spotify: true, why: 'parity' },
  { row: 6, title: 'Library add', capabilities: ['libraryAdd'], apple: true, spotify: true, why: 'parity' },
  { row: 7, title: 'Library remove', capabilities: ['libraryRemove'], apple: false, spotify: true, why: 'LIKELY·docs on Apple after D-029 downgrade; DELETE /me/tracks on Spotify' },
  { row: 8, title: 'Playlist create', capabilities: ['playlistCreate'], apple: true, spotify: true, why: 'parity' },
  { row: 9, title: 'Playlist add tracks', capabilities: ['playlistAddTracks'], apple: true, spotify: true, why: 'parity — but Apple appends to the end, always' },
  { row: 10, title: 'Playlist remove tracks', capabilities: ['playlistRemoveTracks'], apple: false, spotify: true, why: 'LIKELY·docs, NOT VERIFIED — D-029 falsified the enumeration leg; the staff-statement leg stands' },
  { row: 11, title: 'Playlist reorder', capabilities: ['playlistReorder'], apple: false, spotify: true, why: 'LIKELY·docs — no positional write at any level' },
  { row: 12, title: 'Transport', capabilities: ['transport'], apple: true, spotify: true, why: 'parity' },
  { row: 13, title: 'Seek', capabilities: ['seek'], apple: true, spotify: true, why: 'parity' },
  { row: 14, title: 'Volume', capabilities: ['volume'], apple: true, spotify: true, why: 'parity — app volume on both, never system volume' },
  { row: 15, title: 'Queue read', capabilities: ['queueRead'], apple: true, spotify: true, why: 'parity' },
  { row: 16, title: 'Queue append', capabilities: ['queueAppend'], apple: true, spotify: true, why: 'Spotify emulates the batch — legitimate, the result is equivalent' },
  { row: 17, title: 'Queue insert-next', capabilities: ['queueInsertNext'], apple: true, spotify: false, why: 'playNext() on Apple; no API on Spotify, where the label changes to Add to Queue' },
  { row: 18, title: 'Queue remove / reorder', capabilities: ['queueRemove', 'queueReorder'], apple: false, spotify: false, why: 'LIKELY·docs on Apple; not supported on Spotify. S17 is read-only-with-append on BOTH' },
  { row: 19, title: 'Stations / radio', capabilities: ['stations'], apple: true, spotify: false, why: 'Spotify withdrew seeded radio for new apps in Nov 2024; S18 is removed there, not greyed' },
  { row: 20, title: 'Station seeded from a track', capabilities: ['stationSeedFromTrack'], apple: true, spotify: false, why: 'VERIFIED·live on Apple — station id is ra.<songId>; the only row in the matrix that moved' },
  { row: 21, title: 'Lyrics', capabilities: ['lyrics', 'lyricsSynced'], apple: false, spotify: false, why: 'Apple: the endpoint EXISTS and returns 400/40012, gated not absent. Spotify: no public API at all' },
  { row: 22, title: '5-star ratings', capabilities: [], apple: true, spotify: true, why: 'dropped from the union — a local-only device rating emulated identically on both, synced nowhere' },
  { row: 23, title: 'Love / Dislike', capabilities: ['ratingLoveDislike'], apple: true, spotify: false, why: 'Spotify has no equivalent. Never map Love to Save' },
  { row: 24, title: 'Save / add-to-library', capabilities: ['saveToggle'], apple: true, spotify: true, why: 'parity in capability, different label; on Spotify it is the only affection signal' },
  { row: 25, title: 'Progress ticks', capabilities: ['progressTicks'], apple: true, spotify: false, why: 'Spotify is event-driven only; we interpolate and report interpolated: true. Hides no control' },
  { row: 26, title: 'Artwork sizing', capabilities: ['artworkArbitrarySize'], apple: true, spotify: false, why: 'Spotify has ~3 fixed sizes; artworkUrl reports actualPx and the sharp region clamps to it' },
  { row: 27, title: 'Shuffle / repeat', capabilities: [], apple: true, spotify: true, why: 'not a capability — full parity on both, so there is nothing to gate; setShuffle/setRepeat exist on the interface per D-052 and are gated on transport' },
  { row: 28, title: 'Storefront / market', capabilities: [], apple: true, spotify: true, why: 'not a capability — it sets TrackRef.playable and Session.storefront' },
  { row: 29, title: 'ISRC', capabilities: [], apple: true, spotify: true, why: 'not a capability — it is the basis of §14.5 re-resolution' },
  { row: 30, title: 'Offline / downloads', capabilities: [], apple: false, spotify: false, why: 'CUT repo-wide — no browser client can hold audio, so no union member exists to be permanently false' },
]

const apple = createAppleProvider()
const spotify = createSpotifyProvider()

describe('§14.3 capability matrix — one case per row', () => {
  for (const entry of MATRIX_14_3) {
    if (entry.capabilities.length === 0) continue
    test(`row ${String(entry.row)} · ${entry.title} — ${entry.why}`, () => {
      for (const capability of entry.capabilities) {
        expect({ row: entry.row, capability, apple: apple.supports(capability) }).toEqual({
          row: entry.row,
          capability,
          apple: entry.apple,
        })
        expect({ row: entry.row, capability, spotify: spotify.supports(capability) }).toEqual({
          row: entry.row,
          capability,
          spotify: entry.spotify,
        })
      }
    })
  }
})

describe('§14.3 rows the Capability union deliberately does not model', () => {
  test('row 22 · stars are not a provider question (D-023, D-026)', () => {
    // §14.2's union had `ratingStars` as its 22nd of 26 members, §14.2's
    // interface gave no method that could implement it, and §14.3 row 22 says
    // stars are emulated locally on both providers. Three parts of one
    // document, three answers. The union is where it was resolved.
    expect(CAPABILITIES).not.toContain('ratingStars' as Capability)
    expect(CAPABILITIES).toHaveLength(25)
  })

  test('row 30 · offline is cut, not modelled as a permanent false (D-019)', () => {
    expect(CAPABILITIES).not.toContain('offline' as Capability)
  })

  test.each([
    ['row 2 · paid tier', 'paidTier'],
    ['row 3 · playback host', 'playbackHost'],
    ['row 27 · shuffle and repeat', 'shuffle'],
    ['row 28 · storefront', 'storefront'],
    ['row 29 · ISRC', 'isrc'],
  ])('%s has no union member', (_label, name) => {
    expect(CAPABILITIES).not.toContain(name as Capability)
  })

  test('row 27 · the methods D-052 added exist on every implementation', () => {
    // The row has no capability key and never will — it is full parity — but
    // it does have an interface obligation, and the absence of a key is not a
    // reason to leave that untested. Before D-052 landed, this file asserted
    // the opposite justification ("§14.2 supplies no method that sets either"),
    // which is how a settled ruling can end up contradicted by a green suite.
    for (const provider of [apple, spotify]) {
      expect(typeof provider.setShuffle).toBe('function')
      expect(typeof provider.setRepeat).toBe('function')
    }
  })
})

describe('§14.3 coverage — nothing is untested', () => {
  test('every capability appears in exactly one row of the table', () => {
    const listed = MATRIX_14_3.flatMap((entry) => entry.capabilities)
    expect(new Set(listed).size).toBe(listed.length)
    expect([...listed].sort()).toEqual([...CAPABILITIES].sort())
  })

  test('the table has all thirty §14.3 rows, numbered 1..30', () => {
    expect(MATRIX_14_3.map((entry) => entry.row)).toEqual(Array.from({ length: 30 }, (_v, i) => i + 1))
  })
})

describe('§14.4 — unsupportedReason is total, and is product copy', () => {
  for (const [name, provider] of [
    ['apple', apple],
    ['spotify', spotify],
  ] as const) {
    test(`${name}: null for every supported capability`, () => {
      for (const capability of CAPABILITIES) {
        if (provider.supports(capability)) expect(provider.unsupportedReason(capability)).toBeNull()
      }
    })

    test(`${name}: a non-empty sentence for every unsupported capability`, () => {
      for (const capability of CAPABILITIES) {
        if (provider.supports(capability)) continue
        const reason = provider.unsupportedReason(capability)
        expect(reason).not.toBeNull()
        expect((reason ?? '').trim().length).toBeGreaterThan(0)
      }
    })

    test(`${name}: the copy obeys §11.0's voice rules`, () => {
      for (const capability of CAPABILITIES) {
        const reason = provider.unsupportedReason(capability)
        if (reason === null) continue
        // Rule 2: no exclamation marks anywhere in the entire product.
        expect(reason).not.toContain('!')
        // Rule 4: never apologise.
        expect(reason.toLowerCase()).not.toContain('sorry')
        // Rule 6: no marketing filler.
        for (const banned of ['seamlessly', 'effortlessly', 'magic', ' just ']) {
          expect(reason.toLowerCase()).not.toContain(banned)
        }
        // Rule 8: never name a colour — colour is the last identity channel.
        for (const colour of ['blue', 'green', 'crimson', 'sky ']) {
          expect(reason.toLowerCase()).not.toContain(colour)
        }
        // It is a sentence shown to a human, not a developer message.
        expect(reason).not.toContain('supports(')
        expect(reason).not.toMatch(/\b40\d{3}\b/)
        expect(reason).not.toMatch(/\bhttps?:\/\//)
      }
    })
  }

  test('Apple names Apple and Spotify names Spotify — the user is told which service', () => {
    for (const capability of CAPABILITIES) {
      const appleReason = apple.unsupportedReason(capability)
      if (appleReason !== null) expect(appleReason).toContain('Apple Music')
      const spotifyReason = spotify.unsupportedReason(capability)
      if (spotifyReason !== null) expect(spotifyReason).toContain('Spotify')
    }
  })
})

describe('§14.3 rows 23 and 24 — Love is never Save', () => {
  test('Spotify has Save and has no Love', () => {
    expect(spotify.supports('saveToggle')).toBe(true)
    expect(spotify.supports('ratingLoveDislike')).toBe(false)
  })

  test('the two are independent on Apple, which has both', () => {
    expect(apple.supports('saveToggle')).toBe(true)
    expect(apple.supports('ratingLoveDislike')).toBe(true)
  })

  test("Spotify's Love reason does not offer Save as an equivalent", () => {
    // The failure this guards is copy that says "use Save instead", which is
    // the same conflation §14.3 row 23 forbids, moved from code into words.
    const reason = spotify.unsupportedReason('ratingLoveDislike') ?? ''
    expect(reason.toLowerCase()).not.toContain('instead')
  })
})
