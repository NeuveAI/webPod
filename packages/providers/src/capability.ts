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
