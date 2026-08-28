/**
 * The `Capability` union — the contract every UI branch and every WebMCP
 * registration reads (pm-spec §14.2, §14.4).
 *
 * Two members of §14.2's 26-strong union are absent here, both by ruling and
 * both recorded so a future diff reads as intent rather than omission:
 *
 * - **`ratingStars` is dropped (D-026).** Stars are a local-only device rating,
 *   emulated identically on every provider, stored on the device and synced
 *   nowhere. A `supports()` key implies a provider question; there is none, and
 *   §14.2 gives no method that could implement one. Keeping it would force
 *   every implementation forever to answer a question whose answer can only be
 *   the same constant.
 * - **`offline` was never a member and will not become one (D-019).** No
 *   browser client on either provider can download audio, so the concept is cut
 *   repo-wide rather than carried as a permanently-`false` row. `DISCONNECTED`
 *   means browse-cached-metadata-only.
 *
 * Everything else is §14.2's union verbatim, in §14.2's order.
 */

/**
 * A thing a provider either does or does not do.
 *
 * Closed union by design: §14.4 forbids a string literal at a call site, so a
 * typo cannot become a silently-`false` capability check.
 */
export type Capability =
  | 'auth' | 'search' | 'libraryRead' | 'libraryAdd' | 'libraryRemove'
  | 'playlistCreate' | 'playlistAddTracks' | 'playlistRemoveTracks' | 'playlistReorder'
  | 'transport' | 'seek' | 'volume' | 'queueRead' | 'queueAppend' | 'queueInsertNext'
  | 'queueRemove' | 'queueReorder' | 'stations' | 'stationSeedFromTrack'
  | 'lyrics' | 'lyricsSynced' | 'ratingLoveDislike' | 'saveToggle'
  | 'progressTicks' | 'artworkArbitrarySize'

/**
 * Every capability, once, in §14.2's declaration order.
 *
 * ⚑ The `satisfies` clause is the load-bearing part, not decoration. It fails
 * the build if a member is missing **and** if one is invented, so this array
 * and the union above cannot drift. A table-driven test iterating this array
 * therefore covers the whole union by construction rather than by a count that
 * somebody has to remember to update.
 */
const CAPABILITY_SET = {
  auth: true,
  search: true,
  libraryRead: true,
  libraryAdd: true,
  libraryRemove: true,
  playlistCreate: true,
  playlistAddTracks: true,
  playlistRemoveTracks: true,
  playlistReorder: true,
  transport: true,
  seek: true,
  volume: true,
  queueRead: true,
  queueAppend: true,
  queueInsertNext: true,
  queueRemove: true,
  queueReorder: true,
  stations: true,
  stationSeedFromTrack: true,
  lyrics: true,
  lyricsSynced: true,
  ratingLoveDislike: true,
  saveToggle: true,
  progressTicks: true,
  artworkArbitrarySize: true,
} as const satisfies Record<Capability, true>

/** Every capability, once, in §14.2's declaration order. */
export const CAPABILITIES: readonly Capability[] = Object.keys(CAPABILITY_SET) as Capability[]

/**
 * A provider's answer for every capability.
 *
 * A plain `Record` rather than `Record<Exclude<Capability, "ratingStars">, …>`:
 * D-026 dropped the member from the union outright so that the awkwardness does
 * not propagate into every consumer's type.
 */
export type CapabilityMatrix = Readonly<Record<Capability, boolean>>

/**
 * The capabilities whose `false` hides **no control**.
 *
 * §14.4 sends `unsupportedReason()` to B04 and S27 as the explanation for
 * something the user cannot have. These two are not that:
 *
 * - **`progressTicks`** says whether the *provider* emits a continuous position
 *   tick, not whether position is knowable. Where it is `false` we interpolate
 *   and set `ProgressTick.interpolated`; the scrubber renders and works
 *   (§14.3 row 25, posture (a) emulate).
 * - **`artworkArbitrarySize`** says whether arbitrary sizes can be requested,
 *   not whether artwork exists. Where it is `false` we take the nearest size up
 *   and report `actualPx`; the art renders (§14.3 row 26, posture (b) degrade).
 *
 * On Spotify both are `false` and both features **work**. A roster built by
 * walking every `false` would therefore tell the user that live playback
 * position and album artwork are unavailable, which is wrong twice on the
 * screen whose entire job is telling them the truth about what this product
 * can do here.
 *
 * ⚑ This package is the one that knows the difference — it says so in four
 * places — so per D-049 it is the one that must enforce it, rather than
 * exporting the rule to a consumer that does not exist yet. Use
 * {@link unsupportedCapabilitiesToSurface} instead of iterating `CAPABILITIES`.
 */
export const CAPABILITIES_WITHOUT_A_CONTROL: readonly Capability[] = ['progressTicks', 'artworkArbitrarySize']

/**
 * The human-facing name of the feature a capability gates.
 *
 * Used to compose `unsupportedReason()` copy where a provider has no
 * provider-specific sentence to offer. Sentence case, per §11.0 rule 5.
 */
export const CAPABILITY_FEATURE_NAMES: Readonly<Record<Capability, string>> = {
  auth: 'Signing in',
  search: 'Search',
  libraryRead: 'Your library',
  libraryAdd: 'Adding to your library',
  libraryRemove: 'Removing from your library',
  playlistCreate: 'Making a playlist',
  playlistAddTracks: 'Adding songs to a playlist',
  playlistRemoveTracks: 'Taking songs out of a playlist',
  playlistReorder: 'Reordering a playlist',
  transport: 'Playback',
  seek: 'Scrubbing',
  volume: 'Volume',
  queueRead: 'Up Next',
  queueAppend: 'Adding to Up Next',
  queueInsertNext: 'Playing a song next',
  queueRemove: 'Taking songs out of Up Next',
  queueReorder: 'Reordering Up Next',
  stations: 'Radio',
  stationSeedFromTrack: 'Starting a station from a song',
  lyrics: 'Lyrics',
  lyricsSynced: 'Lyrics that follow the song',
  ratingLoveDislike: 'Love and dislike',
  saveToggle: 'Saving a song',
  progressTicks: 'Live playback position',
  artworkArbitrarySize: 'Artwork at any size',
}

/** One row of B04's tools-and-features list. */
export interface UnsupportedFeature {
  readonly capability: Capability
  /** The name to show. Sentence case, from {@link CAPABILITY_FEATURE_NAMES}. */
  readonly feature: string
  /** `unsupportedReason()` verbatim — §14.4 renders it unchanged. */
  readonly reason: string
}

/** The subset of `MusicProvider` this helper needs, so it can be called with either. */
export interface CapabilityReporter {
  supports(c: Capability): boolean
  unsupportedReason(c: Capability): string | null
}

/**
 * Builds the list of missing features to show a human, in B04 and S27.
 *
 * **This is the surfacing boundary, and it is here rather than in the panel on
 * purpose (D-049).** It excludes {@link CAPABILITIES_WITHOUT_A_CONTROL},
 * because a `false` there hides nothing and listing it would name a working
 * feature as unavailable. A consumer that walked `CAPABILITIES` itself would
 * have to remember that, and the rule would be a comment in a package the
 * consumer does not read.
 *
 * @param provider the provider whose roster to build.
 * @returns one row per genuinely missing feature, in §14.2's capability order.
 * Empty when nothing is missing — which is a state B04 must render, not a
 * reason to hide the section.
 * @throws never. A provider that reports a capability missing with no reason is
 * a defect this helper cannot fix, so the row is emitted with the feature name
 * alone rather than silently dropped; a missing explanation should look wrong.
 */
export function unsupportedCapabilitiesToSurface(provider: CapabilityReporter): readonly UnsupportedFeature[] {
  const hidden = new Set<Capability>(CAPABILITIES_WITHOUT_A_CONTROL)
  const rows: UnsupportedFeature[] = []

  for (const capability of CAPABILITIES) {
    if (hidden.has(capability)) continue
    if (provider.supports(capability)) continue
    rows.push({
      capability,
      feature: CAPABILITY_FEATURE_NAMES[capability],
      reason: provider.unsupportedReason(capability) ?? '',
    })
  }

  return rows
}
