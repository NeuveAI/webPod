/**
 * §14.5's cross-provider re-resolution ladder.
 *
 * A provider switch is *a new device, not a migration*. What belongs to webPod
 * comes with you; what belongs to the service stays behind. The thing that
 * makes the first half possible is that a `TrackRef` carries denormalised
 * `title` / `artistName` / `durationMs`, so a track we saw on one service can
 * be looked for on another without a round trip to the service that is gone.
 *
 * **The `LocalKey` is preserved across the switch and the provider fields are
 * replaced.** That is the whole mechanism: a star rating, a draft row or an
 * Engraving entry keyed by `LocalKey` re-attaches to the new resolution
 * automatically, and an unmatched one stays orphaned rather than being
 * silently repointed at a different recording.
 *
 * The ladder is best effort and §14.5 says so plainly. ISRC is the only real
 * handle and it is imperfect — the same recording carries different ISRCs
 * across releases and remasters, and a match is a *recording* match, not a
 * *master* match.
 */

import type { MatchConfidence, TrackRef } from './identity.ts'

/** Tolerance for the duration leg of the metadata rung, per §14.5. */
export const DURATION_TOLERANCE_MS = 2000

/** Suffixes §14.5 calls out as noise: `feat.`, remaster and edition markers. */
const NOISE_SUFFIX =
  /\s*[([]?\s*(feat\.?|featuring|with)\s.+$|\s*[([][^)\]]*\b(remaster(ed)?|deluxe|edition|version|mono|stereo|mix|anniversary)\b[^)\]]*[)\]]\s*$/gi

/**
 * Normalises a title or artist name for comparison.
 *
 * Case-folds, strips the `feat.` / remaster / edition suffixes §14.5 names,
 * folds diacritics, drops punctuation and collapses whitespace.
 *
 * Three details that are wrong in the obvious implementation:
 *
 * - **Diacritics are folded, not deleted into whitespace.** `NFKD` splits `ö`
 *   into `o` plus a combining mark; a naive "remove everything that is not a
 *   letter" then leaves `bjo rk`, which matches nothing. The marks are removed
 *   as marks, so `Björk` and `Bjork` compare equal — which is the point, since
 *   the two services do not agree on how to spell a catalogue.
 * - **Apostrophes are removed rather than replaced by a space**, so
 *   `Don't Stop Believin'` does not become `don t stop believin`.
 * - Unicode classes rather than `\w`, which is ASCII-only.
 *
 * Deliberately lossy. It exists to make two spellings of one recording compare
 * equal, and being lossy is how it does that — which is also why a match on
 * normalised text alone is the ladder's *lowest* rung, not its first.
 */
export function normaliseForMatch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(NOISE_SUFFIX, '')
    .toLowerCase()
    .replace(/\p{M}+/gu, '')
    .replace(/['\u2018\u2019\u02bc\u0060\u00b4]/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** A re-resolution outcome. */
export interface Reresolution {
  /** The new `TrackRef`, carrying the **original** `LocalKey`. */
  readonly ref: TrackRef
  /** How it was matched. `low` must be surfaced as low-confidence in the UI. */
  readonly confidence: MatchConfidence
}

/**
 * Re-resolves one track against a candidate list from another provider.
 *
 * The ladder, in §14.5's order, stopping at the first rung that hits:
 *
 * 1. **`isrc` exact** → `isrc`.
 * 2. **normalised title + artist, duration within ±2000ms** → `metadata`.
 * 3. **normalised title + artist only** → `low`, and §14.5 requires the UI to
 *    flag it. Anything below this rung is not a match; we return `null` and the
 *    row renders struck-through with `Not on <service>`, because §14.5's
 *    migration UX has the user choose rather than us silently rebuilding
 *    something that is 78% of what it was.
 *
 * @param original the ref we already hold. Its `key` is what survives.
 * @param candidates results from the new provider, in its own ranking order.
 * Ties are broken by that order, so the provider's own relevance ranking wins
 * rather than an ordering we invented.
 * @returns the re-resolution, or `null` when no rung matched.
 */
export function reresolve(original: TrackRef, candidates: readonly TrackRef[]): Reresolution | null {
  const withKey = (candidate: TrackRef): TrackRef => ({ ...candidate, key: original.key })

  if (original.isrc !== undefined) {
    for (const candidate of candidates) {
      if (candidate.isrc !== undefined && candidate.isrc === original.isrc) {
        return { ref: withKey(candidate), confidence: 'isrc' }
      }
    }
  }

  const title = normaliseForMatch(original.title)
  const artist = normaliseForMatch(original.artistName)
  let textOnly: TrackRef | null = null

  for (const candidate of candidates) {
    if (normaliseForMatch(candidate.title) !== title) continue
    if (normaliseForMatch(candidate.artistName) !== artist) continue
    if (Math.abs(candidate.durationMs - original.durationMs) <= DURATION_TOLERANCE_MS) {
      return { ref: withKey(candidate), confidence: 'metadata' }
    }
    // Remember the first text match and keep looking: a duration match further
    // down the list still outranks it, because duration is the rung that
    // separates a recording from a different recording of the same song.
    if (textOnly === null) textOnly = candidate
  }

  if (textOnly !== null) return { ref: withKey(textOnly), confidence: 'low' }
  return null
}

/** The tally §14.5's migration card reports: `11 songs · 9 matched · 2 not found`. */
export interface ReresolutionReport {
  readonly matched: readonly Reresolution[]
  readonly unmatched: readonly TrackRef[]
}

/**
 * Re-resolves a whole list, keeping order and reporting the misses by name.
 *
 * §14.5's queue-migration card names the tracks that did not come across; it
 * does not merely count them, so the unmatched refs are returned whole.
 *
 * @param originals the refs to carry over, in their existing order.
 * @param lookup returns the new provider's candidates for one original. It is a
 * function rather than a flat candidate list so the caller controls batching
 * and rate limiting, which on Spotify is one call per track.
 */
export function reresolveAll(
  originals: readonly TrackRef[],
  lookup: (ref: TrackRef) => readonly TrackRef[],
): ReresolutionReport {
  const matched: Reresolution[] = []
  const unmatched: TrackRef[] = []

  for (const original of originals) {
    const result = reresolve(original, lookup(original))
    if (result === null) unmatched.push(original)
    else matched.push(result)
  }

  return { matched, unmatched }
}
