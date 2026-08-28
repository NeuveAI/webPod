/**
 * Apple Music's §14.3 column.
 *
 * **A capability is absent until proven present.** Every value below carries
 * its evidence and its provenance in a comment, on the two axes D-022 defines:
 * evidential strength (`VERIFIED` / `LIKELY` / `UNVERIFIED`) and provenance
 * (`docs` / `live`). **`docs` provenance is never settled** — Apple's real
 * surface is known to be strictly larger than its documented one (D-029), so a
 * `docs` value may be built on provisionally and stays visible as unconfirmed.
 *
 * Exactly one row in this whole matrix is closed at `live`: `stationSeedFromTrack`.
 *
 * ⚑ Do not "correct" a `false` here from a search result. Three of them have a
 * documented-looking counterargument that is about a different API surface, and
 * each is answered in the comment beside it. Read the comment before editing
 * the value.
 */

import type { Capability, CapabilityMatrix } from '../capability.ts'

/**
 * What Apple Music can do, as far as anyone here has been able to establish.
 *
 * Derived from the Apple Music API reference, the MusicKit on the Web v3
 * reference, six years of Apple staff statements, and one read-only live probe
 * run with a developer token.
 */
export const APPLE_SUPPORTS: CapabilityMatrix = {
  // ── Parity rows: §14.3 marks these VERIFIED on both providers ─────────────
  auth: true, //                    row 1  · VERIFIED · docs — MusicKit.configure() + authorize()
  search: true, //                  row 4  · VERIFIED · docs — /v1/catalog/{sf}/search
  libraryRead: true, //             row 5  · VERIFIED · docs — /v1/me/library/*
  libraryAdd: true, //              row 6  · VERIFIED · docs — POST /v1/me/library
  transport: true, //               row 12 · VERIFIED · docs — MusicKit instance methods
  seek: true, //                    row 13 · VERIFIED · docs — seekToTime(seconds)
  volume: true, //                  row 14 · VERIFIED · docs — music.volume, 0–1, app volume only
  ratingLoveDislike: true, //       row 23 · VERIFIED · docs — PUT /v1/me/ratings/songs/{id}, 1 | -1
  saveToggle: true, //              row 24 · VERIFIED · docs — POST /v1/me/library. NOT Love.
  progressTicks: true, //           row 25 · VERIFIED · docs — playbackTimeDidChange fires on a timer
  artworkArbitrarySize: true, //    row 26 · VERIFIED · docs — {w}/{h} template, arbitrary sizes to ~3000px

  // ── Supported, established rather than assumed ────────────────────────────
  playlistCreate: true, //          row 8  · VERIFIED · docs — POST /v1/me/library/playlists
  playlistAddTracks: true, //       row 9  · VERIFIED · docs — POST …/{id}/tracks.
  //                                ⚑ Appends to the END, always. `supports()` cannot express a
  //                                positional constraint, so any UI or tool implying an insertion
  //                                point is wrong here even though the capability is true.
  queueRead: true, //               row 15 · VERIFIED · docs — MusicKit v3 Queue.items / .position / .length
  queueAppend: true, //             row 16 · VERIFIED · docs — playLater()
  queueInsertNext: true, //         row 17 · VERIFIED · docs — playNext()
  stations: true, //                row 19 · LIKELY   · docs — /v1/catalog/{sf}/stations, setQueue({station})

  /**
   * row 20 · VERIFIED · live · **the only value in the whole matrix that moved.**
   *
   * A song's `station` relationship is genuinely seeded from that song: the id
   * is `ra.` + the song's own catalog id, every time, across nine calls. That
   * is structural rather than correlational. Within-artist ids were distinct
   * for all three artists tested, which kills the "it is really the artist's
   * station" hypothesis — and the artist's own station is a separate resource
   * under a visibly different name. `playParams.kind` is `"radioStation"` with
   * the `ra.*` id `setQueue({station})` accepts, so the two-call path is
   * demonstrated end to end (D-028).
   */
  stationSeedFromTrack: true,

  // ── Unsupported ───────────────────────────────────────────────────────────

  /**
   * row 7 · LIKELY · docs — no documented endpoint removes from the library.
   *
   * Downgraded from `VERIFIED · docs` by D-029: it rested partly on "Apple
   * documents no endpoint for X, therefore none exists", and that inference is
   * falsified — three `Songs` relationships exist live that the docs do not
   * list. It stays `LIKELY` because the second leg is untouched: Apple staff on
   * record in 2019, 2020, 2022 and 2025.
   */
  libraryRemove: false,

  /**
   * row 10 · LIKELY · docs — §14.3's own highest-risk row, and it resolves against us.
   *
   * "Creating and Modifying User Playlists" holds five entries — three
   * endpoints (`POST` playlist, `POST` tracks, `POST` library) and two request
   * objects — and every endpoint is additive; the only `DELETE` verbs in the
   * entire API are the **nine** ratings deletions; the sole track-write
   * endpoint is documented as *"Add new tracks to the end of a library
   * playlist."*
   *
   * ⚑ Those counts are `apple-capability-spike.md`'s, verbatim. An earlier
   * version of this comment said "three entries" and "ten deletions" — both
   * wrong, both against the source named two lines below. A comment whose whole
   * job is stopping a future reader re-deriving a wrong conclusion cannot
   * misquote the evidence it points them at.
   *
   * ⚑ **The trap, so nobody "corrects" this later.** Apple staff stated in
   * June 2022 that removal *is* supported. That reply is about **Swift
   * MusicKit's `MusicLibrary.edit(_:…items:)`** — iOS/iPadOS/tvOS/visionOS/
   * watchOS, **no web** — and the same reply adds that you cannot edit
   * playlists created via the Apple Music API. Two independent blocks. Anyone
   * who finds that thread will believe this row was answered wrong (D-015).
   *
   * ⚑ Still `LIKELY`, not `VERIFIED`: unprobed. Settling it needs a Music User
   * Token and a real mutation. That is the highest-value experiment still
   * unrun on this codebase (D-036), and it is not this module's to run.
   */
  playlistRemoveTracks: false,

  /** row 11 · LIKELY · docs — no positional write exists at any level. Same evidence as row 10. */
  playlistReorder: false,

  /**
   * row 18 · LIKELY · docs — MusicKit v3's documented `Queue` is seven properties and zero methods.
   *
   * ⚑ Undocumented `splice` / `updateItems` / `removeQueueItems` do exist in
   * the shipped `musickit.js`, and they are deliberately kept out of this
   * matrix: §14.4 forbids inventing parity on a self-deprecated private method.
   * That same discovery is what falsified the enumeration inference (D-035).
   */
  queueRemove: false,

  /** row 18 · LIKELY · docs — no reorder primitive exists at any level, documented or not. */
  queueReorder: false,

  /**
   * row 21 · VERIFIED · live — **the endpoint EXISTS; it is gated, not absent.**
   *
   * `GET /v1/catalog/{sf}/songs/{id}/lyrics` returns `400` with code **`40012`
   * Insufficient Permissions**, *"'lyrics' entities require permissions that
   * are not in the request"*. The paired controls are what make that decisive:
   * a known-good relationship returns `200`, and a nonsense one returns `400`
   * with a **different** code, `40008` *"No relationship found matching…"*.
   * Apple distinguishes *not a relationship* from *exists, you lack permission*.
   *
   * ⚑ The reason matters as much as the value. An earlier revision recorded
   * this as "no such endpoint" and stamped a correction on a primary spec that
   * was right all along. A `false` with a wrong reason is a trap with a delay
   * on it.
   *
   * ⚑ **Do not route around 40012.** The entitlement is a licensing matter that
   * needs Apple in writing; no API call can answer it, and no client-side
   * workaround would be legitimate if one existed.
   */
  lyrics: false,

  /** row 21 · VERIFIED · live — `syllable-lyrics` exists and returns the same `40012`. Body never seen. */
  lyricsSynced: false,
}

/**
 * Why each missing capability is missing, in the user's words.
 *
 * §14.4: this text is rendered **verbatim** in B04 and S27. It is product copy,
 * subject to §11.0 — sentence case, no exclamation marks, state the consequence
 * plainly, never apologise, never name a colour. It says what the product does
 * here, not what an API lacks: "this product doesn't do that here" is the true
 * sentence, and "Apple's API is append-only" is not one a listener asked for.
 *
 * `null` for every capability Apple has, so the map is total and a new
 * capability cannot be added without someone deciding what it would say.
 */
export const APPLE_UNSUPPORTED_REASONS: Readonly<Record<Capability, string | null>> = {
  auth: null,
  search: null,
  libraryRead: null,
  libraryAdd: null,
  libraryRemove: 'Apple Music doesn’t let other apps take songs out of your library.',
  playlistCreate: null,
  playlistAddTracks: null,
  // Reads as "webPod is the only place these can be added to", which is false.
  // The spike's own suggested copy says the true thing (§11.0 rule 1: name the
  // concrete thing).
  playlistRemoveTracks: 'Apple Music only lets other apps add to a playlist.',
  playlistReorder: 'Apple Music doesn’t let other apps reorder a playlist.',
  transport: null,
  seek: null,
  volume: null,
  queueRead: null,
  queueAppend: null,
  queueInsertNext: null,
  queueRemove: 'Apple Music doesn’t let other apps take songs out of Up Next.',
  queueReorder: 'Apple Music doesn’t let other apps reorder Up Next.',
  stations: null,
  stationSeedFromTrack: null,
  // §11.0's opening line is "Never cutesy", and rule 1 is "name the concrete
  // thing": the feature is called Lyrics on B04, on S16 and in the centre-cycle,
  // so "the words" substitutes a euphemism for the name the user is looking at.
  // This is the spike's suggested copy, and it matches the sibling string on the
  // same §14.3 row (`Spotify doesn't offer lyrics to other apps.`).
  lyrics: 'Apple Music doesn’t make lyrics available to other apps.',
  // A different sentence, because it is a different fact: the lyrics
  // relationship and the syllable-lyrics relationship are separately gated, and
  // B04 lists them as two rows. Identical copy on both would read as a
  // duplicated row rather than as two answers.
  lyricsSynced: 'Apple Music doesn’t make lyrics available to other apps, timed or otherwise.',
  ratingLoveDislike: null,
  saveToggle: null,
  progressTicks: null,
  artworkArbitrarySize: null,
}
