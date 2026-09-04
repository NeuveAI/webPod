/**
 * `MusicProvider` — the interface, transcribed from pm-spec §14.2.
 *
 * The member list, its order, its names and its return types are §14.2's. What
 * has been added is documentation and the supporting types §14.2 names without
 * defining (see `domain.ts`). What has been removed is nothing.
 *
 * **The four laws this interface exists to keep (§14.4), restated where an
 * implementer will actually read them:**
 *
 * 1. **Never invent parity.** No shim may make `supports()` return `true` for
 *    something the provider cannot do. Emulation is legitimate only where the
 *    *result* is genuinely equivalent — batching N appends into one call, or
 *    interpolating a position between events — and illegitimate where the
 *    user's mental model would end up wrong.
 * 2. **Never render a disabled control for a missing capability. Hide it.** A
 *    greyed button says "this exists and you can't have it"; an absent one says
 *    "this product doesn't do that here", and only the second is true.
 * 3. **A capability check is `supports()`, never a provider `if`.** No
 *    `provider.id === "spotify"` outside a provider module, or the third
 *    provider costs a full audit instead of one file.
 * 4. **`unsupportedReason()` is rendered verbatim to a human.** It is product
 *    copy, subject to §11.0's voice rules, not a developer message.
 */

import type { Capability } from './capability.ts'
import type {
  Cursor,
  Entity,
  LibraryKind,
  Lyrics,
  Page,
  PlaybackState,
  PlayTarget,
  ProgressTick,
  QueueSnapshot,
  Rating,
  RepeatMode,
  SearchQuery,
  SearchResults,
  Session,
  ShuffleMode,
  StationSeed,
  Unsubscribe,
} from './domain.ts'
import type { AlbumRef, ArtistRef, PlaylistRef, ProviderId, StationRef, TrackRef } from './identity.ts'

/**
 * One music service, as the rest of webPod sees it.
 *
 * Implementations live in the browser (§14.1): both SDKs are client-side, and
 * neither can be driven from a server. Token minting is the server's, and is
 * not part of this interface.
 */
export interface MusicProvider {
  /**
   * Which service this is.
   *
   * ⚑ For provenance and display only. **Never branch on it** outside a
   * provider module (§14.4): a capability check is `supports()`, or the third
   * provider costs a full audit instead of one file.
   */
  readonly id: ProviderId
  /** Shown to a human. Sentence case is wrong here — these are brand names. */
  readonly displayName: string

  /**
   * THE contract. Every UI branch, and every WebMCP registration, reads this.
   *
   * Must be synchronous, total and cheap: it is consulted during render and
   * during tool-roster construction, and an async or throwing implementation
   * would make "absent, never disabled" impossible to honour.
   *
   * A `true` for something the provider lacks is §15.3 failure mode 7 and is a
   * blocking review finding, not a bug to fix later.
   */
  supports(c: Capability): boolean

  /**
   * Why a capability is missing — rendered verbatim in B04 and S27.
   *
   * @returns `null` when `supports(c)` is `true`, and a non-empty sentence
   * otherwise. Never the empty string: an empty reason renders as a blank line
   * where an explanation was promised.
   */
  unsupportedReason(c: Capability): string | null

  // ── Authorisation / session ───────────────────────────────────────────────

  /** Prepares the SDK. Idempotent; safe to call before any user gesture. */
  configure(): Promise<void>
  /** Runs the provider's sign-in. Requires a user gesture on both providers. */
  authorize(): Promise<Session>
  /** Drops the session. §14.5 puts this behind B08's two-press confirm. */
  unauthorize(): Promise<void>
  /** Current session, or `null`. The source a Jotai atom mirrors (§14.1). */
  readonly session: Session | null
  /** Fires on sign-in, sign-out and expiry. Expiry is not an error path. */
  onSessionChange(cb: (s: Session | null) => void): Unsubscribe

  // ── Catalogue + library ───────────────────────────────────────────────────

  /**
   * Searches the library or the catalogue, per `q.scope`.
   *
   * Results are split by kind rather than returned as one ranked list, because
   * S12 renders them as sections; a flat list would force every consumer to
   * re-partition it and to invent its own section order.
   *
   * Zero results is a normal outcome with its own copy (§11.5), not an error.
   */
  search(q: SearchQuery): Promise<SearchResults>
  /**
   * Lists one slice of the user's library, a page at a time.
   *
   * @param page a cursor from a previous `Page.next`, or omitted for the first
   * page. Cursors are **opaque and provider-scoped**: the only legal values are
   * `null` and what this provider last returned. Passing anything else —
   * hand-written, stale, or from a different listing — is a caller defect and
   * implementations reject it rather than answering with the first page, which
   * would be indistinguishable from a real one and would duplicate rows.
   *
   * `Page.total` is `null` where the provider does not report one. §11.6 renders
   * an empty slice as a count, so a guessed total puts a wrong number on screen.
   */
  libraryList(kind: LibraryKind, page?: Cursor): Promise<Page<Entity>>
  /** Fetches the tracks belonging to an album or playlist for provider-neutral drill-down. */
  relatedTracks(ref: AlbumRef | PlaylistRef): Promise<readonly TrackRef[]>
  /** Fetches the albums belonging to an artist for provider-neutral drill-down. */
  relatedAlbums(ref: ArtistRef): Promise<readonly AlbumRef[]>
  /**
   * Adds to the library. Apple's `Add to Library`, Spotify's `Save`.
   *
   * ⚑ The same operation as `saveToggle(ref, true)` — §14.3 row 24 makes them
   * one write with two labels, not two stores. An implementation where they
   * disagree is a `Save` control that changes nothing readable.
   */
  libraryAdd(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void>
  /**
   * Removes from the library.
   *
   * ⚑ Gated by `supports("libraryRemove")`, which is `false` on Apple. The
   * row's action-sheet item must not exist there — not exist, not be greyed.
   */
  libraryRemove(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void>

  // ── Playlists ─────────────────────────────────────────────────────────────

  /**
   * Creates a playlist in the user's library.
   *
   * @returns the ref the caller should hold from now on. Its `key` is a fresh
   * `LocalKey`; the provider's own id is on the ref and is never the handle.
   */
  playlistCreate(p: { name: string; description?: string; tracks?: TrackRef[] }): Promise<PlaylistRef>
  /**
   * Adds tracks to a playlist.
   *
   * ⚑ Positional semantics differ and `supports()` cannot express it: Apple
   * appends to the end, always. Any UI or tool that implies an insertion point
   * will be wrong there.
   */
  playlistAddTracks(id: PlaylistRef, tracks: TrackRef[]): Promise<void>
  /** ⚑ `supports("playlistRemoveTracks")` is `false` on Apple. */
  playlistRemoveTracks(id: PlaylistRef, positions: number[]): Promise<void>
  /** ⚑ `supports("playlistReorder")` is `false` on Apple. */
  playlistReorder(id: PlaylistRef, from: number, to: number, count?: number): Promise<void>

  // ── Transport ─────────────────────────────────────────────────────────────

  /**
   * Gives a provider an opportunity to prepare a likely playback target.
   *
   * This is deliberately weaker than `play()`: it never promises buffered
   * media, a duration of readiness, or audible playback. Implementations may
   * no-op. A provider with a public queue-preparation primitive may use it only
   * while genuinely idle, and must leave an active or paused item untouched.
   * The signal cancels the caller's intent; it cannot imply that a provider SDK
   * can cancel work it has already accepted.
   */
  prepare(target: PlayTarget, signal?: AbortSignal): Promise<void>

  /**
   * Starts playback.
   *
   * @param target what to play. **Omitted means resume what is already
   * loaded** — it does not mean "play something", and it is not an error when
   * nothing is loaded; the player simply stays idle.
   *
   * ⚑ May fail for a reason that is not a capability: an account whose tier
   * does not permit playback authorises normally and cannot play (§14.3 rows 2
   * and 3), so `supports("transport")` is `true` and this still refuses. The
   * tier is a property of the session, not of the service.
   */
  play(target?: PlayTarget): Promise<void>
  /** Pauses. Position is retained, so a later `play()` does not restart the track. */
  pause(): Promise<void>
  /**
   * Moves through the queue.
   *
   * `previous` follows the 2005 device: past a few seconds into a track it
   * restarts that track rather than stepping back, and only steps back from
   * near the start. Running off either end is not an error.
   */
  skip(direction: 'next' | 'previous', count?: number): Promise<void>
  /** Seeks within the current track. Clamped; seeking past the end does not skip. */
  seek(positionMs: number): Promise<void>
  /** App volume, 0–100. Neither provider can touch system volume. */
  setVolume(level0to100: number): Promise<void>
  /**
   * Sets shuffle mode.
   *
   * ⚠ **Not in §14.2's method list. Added by ruling D-052**, which found the
   * omission rather than the design: §14.3 row 27 rates shuffle at full parity
   * and names the endpoints on both providers, §11.1's B02 lists it as a
   * user-changeable setting, and §7.2's `pod-set-setting` carries it in its
   * `key` enum. Three sections require what a fourth forgot to provide.
   *
   * **It goes through the provider, never through device state.** Playback is
   * provider-hosted — MusicKit owns the queue, Spotify's SDK owns an EME
   * player — so a device-local shuffle flag would not change what plays next.
   * That is a control which appears to work and does not, which is worse than
   * the gap it would paper over.
   *
   * Gated on `transport` rather than on a capability of its own: row 27 is full
   * parity, so there is nothing to gate, and §14.2's union has no member for it.
   */
  setShuffle(mode: ShuffleMode): Promise<void>
  /**
   * Sets repeat mode. See {@link MusicProvider.setShuffle} — same ruling, same
   * reasoning, same `transport` gate.
   */
  setRepeat(mode: RepeatMode): Promise<void>
  /**
   * A snapshot of what the player is doing.
   *
   * A snapshot, not a stream: continuous position comes from `onProgress`,
   * which is the only place the interpolation flag lives.
   */
  readonly playback: PlaybackState
  /**
   * Fires when the player's *state* changes — track, status, volume, mode.
   *
   * Not on every position update; that is `onProgress`. A provider that fired
   * this per tick would re-render the whole surface four times a second.
   */
  onPlaybackChange(cb: (s: PlaybackState) => void): Unsubscribe
  /**
   * Ticks ~4/s where the provider supplies them; otherwise our interpolator.
   *
   * Always subscribable, on every provider, whatever `supports("progressTicks")
   * ` says — that capability reports whether the *provider* emits a continuous
   * tick, not whether position is available. Where it is `false` the ticks
   * carry `interpolated: true` and the scrubber widens its hit tolerance
   * (§14.3 row 25). This is the one capability whose `false` hides no control.
   */
  onProgress(cb: (p: ProgressTick) => void): Unsubscribe

  // ── Queue ─────────────────────────────────────────────────────────────────

  /**
   * Reads Up Next.
   *
   * `next` is in play order and `history` is oldest-first. The queue is
   * **provider-side state** and does not survive a provider switch (§14.5) —
   * nothing here should be persisted as though it did.
   */
  queueRead(): Promise<QueueSnapshot>
  /**
   * Appends to the end of Up Next.
   *
   * ⚑ Spotify's API takes one URI per call, so the batch is emulated as N
   * sequential rate-limited calls. That is legitimate emulation — the *result*
   * is genuinely equivalent — but it is not instantaneous, and §14.3 row 16
   * requires the row-stagger animation be paced to actual completion rather
   * than run optimistically.
   */
  queueAppend(tracks: TrackRef[]): Promise<void>
  /** ⚑ `supports("queueInsertNext")` is `false` on Spotify — it has no API. */
  queueInsertNext(tracks: TrackRef[]): Promise<void>
  /** ⚑ `supports("queueRemove")` is `false` on both providers. */
  queueRemove(positions: number[]): Promise<void>
  /** ⚑ `supports("queueReorder")` is `false` on both providers. */
  queueReorder(from: number, to: number): Promise<void>

  // ── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Lists the stations on offer.
   *
   * ⚑ Gated by `supports("stations")`, which is `false` on Spotify: S18 Radio
   * is removed from the main menu entirely there, not greyed, and S17's empty
   * state loses `Start a station`.
   */
  stationsList(): Promise<StationRef[]>
  /**
   * Starts a station from a seed.
   *
   * A `track` seed additionally needs `supports("stationSeedFromTrack")`. They
   * are separate capabilities because Apple has the second — verified live, the
   * station id is `ra.` plus the song's own catalog id — and Spotify has
   * neither. It is the only §14.3 row that moved from `false` to `true`.
   *
   * @returns the station now playing. Where the seed names a station that
   * already exists, that station is returned rather than a duplicate.
   */
  stationStart(seed: StationSeed): Promise<StationRef>

  // ── Song-level ────────────────────────────────────────────────────────────

  /**
   * Fetches a track's lyrics.
   *
   * ⚑ Gated by `supports("lyrics")`, which is `false` on **both** providers —
   * for different reasons, and the reasons matter. Spotify exposes no public
   * API at all. Apple's endpoint **exists and is permission-gated**: it answers
   * `400` with code `40012`, distinguishable from `40008` "no such
   * relationship" by the paired controls that settled it. Do not route around
   * `40012`; the entitlement is a licensing matter, not an API problem.
   *
   * `Lyrics.synced` is `false` for a real, renderable state — static text, no
   * scroll-lock, no `Following you` chip (§14.3 row 21) — not a failure.
   */
  lyrics(ref: TrackRef): Promise<Lyrics>
  /**
   * Sets Love / Dislike.
   *
   * ⚑ Never implement this by calling `saveToggle`. §14.3 row 23: Love is a
   * taste signal that shapes recommendations, Save is library membership. On
   * Spotify there is no Love at all and the heart control does not render.
   */
  ratingSet(ref: TrackRef, r: Rating): Promise<void>
  /** Library membership. On Spotify this is "like", and it is not Love. */
  saveToggle(ref: TrackRef, saved: boolean): Promise<void>
}
