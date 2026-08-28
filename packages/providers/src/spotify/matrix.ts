/**
 * Spotify's §14.3 column.
 *
 * Spotify is not the launch provider — §14 requires only that it be
 * *plannable without redesign* — so this column is transcribed from §14.3
 * rather than probed. Provenance is `docs` throughout, and under D-022 that
 * means **not settled**: it may be built on provisionally and stays visible as
 * unconfirmed. Nothing here has been demonstrated against the running API.
 *
 * **The principle that divides the labels, since the file previously had none.**
 * D-045 (LAW): structural evidence — a mechanism that makes a thing impossible —
 * may carry `VERIFIED`; testimonial evidence, which is someone with authority
 * saying so, may not, because it goes stale silently while the statement does
 * not change.
 *
 * - Every **`false`** here is an absence claim resting on documentation prose:
 *   testimonial, therefore **`LIKELY · docs`**, without exception. The file
 *   used to stamp `VERIFIED · docs` on four of them (rows 17, 18, 21, 23) while
 *   hedging two structurally identical ones (rows 19, 20) to `LIKELY`, with no
 *   principle separating them and with this very header conceding nothing had
 *   been demonstrated. Row 19 is the tell: Spotify **withdrew** those endpoints
 *   in Nov 2024, which is precisely how a documented absence changes under a
 *   label that cannot.
 * - Every **`true`** is a positive claim that a documented endpoint exists,
 *   carrying §14.3's own label. A positive claim is falsifiable by one call the
 *   day someone holds a token; a negative one is not, which is the asymmetry
 *   D-029 has already cost this project once.
 *
 * No `supports()` value moves either way. The label is the point, for D-029's
 * stated reason: someone will reopen this and say "we verified it".
 *
 * The column matters now anyway, and that is the point of the slice: Spotify
 * is where the parity gaps live. Six capabilities Apple has, Spotify does not,
 * and each one is a control that must be **absent** on Spotify rather than
 * greyed (§14.4, U15).
 */

import type { Capability, CapabilityMatrix } from '../capability.ts'

/** What Spotify can do, per §14.3's Spotify column. */
export const SPOTIFY_SUPPORTS: CapabilityMatrix = {
  auth: true, //                    row 1  · VERIFIED · docs — OAuth 2.0 PKCE, server-side exchange
  search: true, //                  row 4  · VERIFIED · docs — GET /search
  libraryRead: true, //             row 5  · VERIFIED · docs — /me/tracks, /me/albums, /me/playlists
  libraryAdd: true, //              row 6  · VERIFIED · docs — PUT /me/tracks
  libraryRemove: true, //           row 7  · VERIFIED · docs — DELETE /me/tracks. ⚑ Apple cannot do this.
  //                                ⚑ Row 7's confidence cell reads `LIKELY (Apple: not supported)` — the
  //                                only cell in §14.3 that is not a clean per-provider split. Read as
  //                                scoping the hedge to Apple, which is what the parenthetical says and
  //                                what the endpoint's documentation supports.
  playlistCreate: true, //          row 8  · VERIFIED · docs — POST /users/{id}/playlists
  playlistAddTracks: true, //       row 9  · VERIFIED · docs — POST /playlists/{id}/tracks
  playlistRemoveTracks: true, //    row 10 · VERIFIED · docs — DELETE /playlists/{id}/tracks. ⚑ Apple cannot.
  playlistReorder: true, //         row 11 · VERIFIED · docs — PUT /playlists/{id}/tracks. ⚑ Apple cannot.
  transport: true, //               row 12 · VERIFIED · docs — /me/player/* plus SDK methods.
  //                                ⚑ Row 3: the Web Playback SDK hosts an EME player registered as a
  //                                Connect device, so playback can be *stolen* by another Spotify
  //                                client mid-session. That is a degrade posture in S27, not a
  //                                capability difference — transport still works through our wheel.
  seek: true, //                    row 13 · VERIFIED · docs — PUT /me/player/seek, SDK seek()
  volume: true, //                  row 14 · VERIFIED · docs — SDK setVolume(), app volume only
  queueRead: true, //               row 15 · LIKELY   · docs — GET /me/player/queue
  queueAppend: true, //             row 16 · VERIFIED · docs — POST /me/player/queue, one URI per call.
  //                                ⚑ (a) emulate: N sequential rate-limited calls, with the row-stagger
  //                                animation paced to actual completion rather than run optimistically.
  //                                Legitimate emulation — the *result* is genuinely equivalent.
  saveToggle: true, //              row 24 · VERIFIED · docs — PUT /me/tracks. Spotify's "like" IS save.

  /**
   * row 17 · LIKELY · docs — no insert-next API is documented.
   *
   * Testimonial: an absence read off published prose (D-045).
   *
   * (b) degrade: `Play Next` becomes `Add to Queue` in the action sheet with an
   * 11px sublabel. The label changes; the button never lies.
   */
  queueInsertNext: false,

  /** row 18 · LIKELY · docs — no documented remove. S17 loses its swipe-to-remove entirely. */
  queueRemove: false,

  /** row 18 · LIKELY · docs — no documented reorder. S17's drag handles do not render. */
  queueReorder: false,

  /**
   * row 19 · LIKELY · docs — public `/recommendations` and seeded-radio endpoints
   * were withdrawn for new apps in November 2024.
   *
   * (c) hide: **S18 Radio is removed from the main menu entirely** for this
   * provider, not greyed, and S17's empty state loses `Start a station`.
   */
  stations: false,

  /** row 20 · LIKELY · docs — no seeded radio, so no station from a song either. */
  stationSeedFromTrack: false,

  /**
   * row 21 · LIKELY · docs — no public API is documented. Spotify's lyrics are
   * a licensed third-party integration and are not exposed.
   *
   * ⚑ Testimonial, and Apple's row 21 is the cautionary case: there the
   * endpoint turned out to **exist and be gated**, which no amount of reading
   * revealed and three GETs settled. Nobody has made the equivalent call here.
   *
   * (d) refuse, **stated plainly rather than hidden silently**: S16 says so, and
   * the Now Playing centre-cycle drops from four stops to three.
   */
  lyrics: false,

  /** row 21 · LIKELY · docs — no documented lyrics at all, so no timing either. */
  lyricsSynced: false,

  /**
   * row 23 · LIKELY · docs — no documented Love/Dislike equivalent.
   *
   * ⚑ **Do not map Love to Save.** Love is a taste signal that shapes
   * recommendations; Save is library membership. Conflating them silently
   * changes what the button means. The heart control does not render here, and
   * `saveToggle` stays `true` and stays a different verb.
   */
  ratingLoveDislike: false,

  /**
   * row 25 · LIKELY · docs — `player_state_changed` is event-driven only, with
   * no continuous tick.
   *
   * ⚑ This `false` hides **no control**. It reports whether the provider emits
   * a tick, not whether position is knowable: (a) emulate, with an rAF
   * interpolator advancing position between events and hard-resyncing on every
   * state change. `onProgress` reports `interpolated: true`, which is the
   * honest channel, and S14 widens the scrubber's hit tolerance. The scrubber
   * must never fight the interpolator — suspend it during a human scrub and
   * resync on release.
   */
  progressTicks: false,

  /**
   * row 26 · LIKELY · docs — a fixed array of roughly three sizes, typically
   * 640 / 300 / 64.
   *
   * (b) degrade: `artworkUrl()` reports `actualPx`, S13 asks for 1400 and gets
   * 640, and the sharp art region clamps to what it got. The blurred off-raster
   * bloom may upscale — blur hides it — and D01 desktop at 1.5x is the named
   * risk case.
   */
  artworkArbitrarySize: false,
}

/**
 * Why each missing capability is missing, in the user's words.
 *
 * §14.4: rendered **verbatim** in B04 and S27. Two of these are §14.3's own
 * strings, taken exactly rather than paraphrased — the spec already wrote the
 * copy and rewriting it would only introduce drift.
 */
export const SPOTIFY_UNSUPPORTED_REASONS: Readonly<Record<Capability, string | null>> = {
  auth: null,
  search: null,
  libraryRead: null,
  libraryAdd: null,
  libraryRemove: null,
  playlistCreate: null,
  playlistAddTracks: null,
  playlistRemoveTracks: null,
  playlistReorder: null,
  transport: null,
  seek: null,
  volume: null,
  queueRead: null,
  queueAppend: null,
  // §14.3 row 17, verbatim: the action sheet's 11px sublabel.
  queueInsertNext: 'Spotify adds to the end of the queue.',
  queueRemove: 'Spotify doesn’t let other apps take songs out of the queue.',
  queueReorder: 'Spotify doesn’t let other apps reorder the queue.',
  stations: 'Spotify stopped offering radio to other apps.',
  stationSeedFromTrack: 'Spotify stopped offering radio to other apps.',
  // §14.3 row 21, verbatim.
  lyrics: 'Spotify doesn’t offer lyrics to other apps.',
  lyricsSynced: 'Spotify doesn’t offer lyrics to other apps.',
  ratingLoveDislike: 'Spotify has no love or dislike. Saving a song is the only signal it takes.',
  saveToggle: null,
  progressTicks: 'Spotify reports where a song is only when something changes. webPod fills in the rest.',
  artworkArbitrarySize: 'Spotify offers artwork in a few fixed sizes.',
}
