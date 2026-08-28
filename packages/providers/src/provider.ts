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
import type { AlbumRef, PlaylistRef, ProviderId, StationRef, TrackRef } from './identity.ts'

/**
 * One music service, as the rest of webPod sees it.
 *
 * Implementations live in the browser (§14.1): both SDKs are client-side, and
 * neither can be driven from a server. Token minting is the server's, and is
 * not part of this interface.
 */
export interface MusicProvider {
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

  search(q: SearchQuery): Promise<SearchResults>
  libraryList(kind: LibraryKind, page?: Cursor): Promise<Page<Entity>>
  libraryAdd(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void>
  /**
   * Removes from the library.
   *
   * ⚑ Gated by `supports("libraryRemove")`, which is `false` on Apple. The
   * row's action-sheet item must not exist there — not exist, not be greyed.
   */
  libraryRemove(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void>

  // ── Playlists ─────────────────────────────────────────────────────────────

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

  play(target?: PlayTarget): Promise<void>
  pause(): Promise<void>
  skip(direction: 'next' | 'previous', count?: number): Promise<void>
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
  readonly playback: PlaybackState
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

  queueRead(): Promise<QueueSnapshot>
  queueAppend(tracks: TrackRef[]): Promise<void>
  /** ⚑ `supports("queueInsertNext")` is `false` on Spotify — it has no API. */
  queueInsertNext(tracks: TrackRef[]): Promise<void>
  /** ⚑ `supports("queueRemove")` is `false` on both providers. */
  queueRemove(positions: number[]): Promise<void>
  /** ⚑ `supports("queueReorder")` is `false` on both providers. */
  queueReorder(from: number, to: number): Promise<void>

  // ── Discovery ─────────────────────────────────────────────────────────────

  stationsList(): Promise<StationRef[]>
  stationStart(seed: StationSeed): Promise<StationRef>

  // ── Song-level ────────────────────────────────────────────────────────────

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
