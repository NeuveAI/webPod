/**
 * The fixture provider — webPod's day-one runtime.
 *
 * Not a mock bolted on for tests. D-006 makes this the implementation the
 * product actually renders from while Apple and Spotify are stubs, so every
 * screen has something honest to draw, and it is the deterministic double every
 * later test runs against.
 *
 * Three properties it is built for, in order of importance:
 *
 * 1. **Its capability matrix is configurable per instance.** §14.4's "absent,
 *    never disabled" law is only testable if a capability can be turned off,
 *    and this is the one provider that can do that without a network. Pass
 *    `supports: APPLE_SUPPORTS` and the fixture behaves like the launch
 *    provider's parity gaps without contacting Apple.
 * 2. **A method whose capability is `false` throws.** That should be
 *    unreachable — §14.4 says the control must not exist — so the throw is a
 *    tripwire for a missing `supports()` check upstream, not an error path any
 *    UI is expected to handle.
 * 3. **No timers, anywhere.** Playback position advances only when the host
 *    calls `tick()`. A fixture that ran its own interval would make every test
 *    that touches progress time-dependent, and would make a paused assertion
 *    race the clock.
 */

import { CAPABILITIES, CAPABILITY_FEATURE_NAMES } from '../capability.ts'
import type { Capability, CapabilityMatrix } from '../capability.ts'
import {
  CapabilityUnsupportedError,
  InvalidCursorError,
  NotAuthorizedError,
  PlaybackNotPermittedError,
} from '../errors.ts'
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
} from '../domain.ts'
import { mintLocalKey } from '../identity.ts'
import type { AlbumRef, LocalKey, PlaylistRef, StationRef, TrackRef } from '../identity.ts'
import type { MusicProvider } from '../provider.ts'
import { normaliseForMatch } from '../reresolve.ts'
import { createFixtureCatalog } from './catalog.ts'
import type { FixtureCatalog } from './catalog.ts'

/** Every capability on. The fixture holds its own data, so this is honest. */
export const FIXTURE_FULL_SUPPORT: CapabilityMatrix = Object.fromEntries(
  CAPABILITIES.map((c) => [c, true]),
) as CapabilityMatrix

/** How many items a library page holds. Small enough that paging is exercised. */
const PAGE_SIZE = 25

/** Options for {@link createFixtureProvider}. */
export interface FixtureProviderOptions {
  /**
   * Capability overrides, merged over {@link FIXTURE_FULL_SUPPORT}.
   *
   * This is the seam W3 needs: turn `libraryRemove` off and the row's
   * action-sheet item must vanish rather than grey out.
   */
  readonly supports?: Partial<CapabilityMatrix>
  /** Overrides the reason copy for a capability that is off. */
  readonly unsupportedReasons?: Partial<Record<Capability, string>>
  /** Shown to a human. */
  readonly displayName?: string
  /**
   * Start already signed in. Defaults to `true` so screens render on load.
   *
   * `false` produces a genuinely signed-out device: everything but `configure`,
   * `authorize`, `supports` and `unsupportedReason` raises
   * {@link NotAuthorizedError} until `authorize()` is called. That is the state
   * §11.5's re-auth copy and J6c are written against, and this is the only
   * provider in which it can be reached.
   */
  readonly authorized?: boolean
  /**
   * Whether this account's tier permits playback (§14.3 rows 2, 3).
   *
   * `false` is a **signed-in but silent** device: browse, search, library and
   * queue all work, and `play()` raises {@link PlaybackNotPermittedError}. That
   * is §14.3 row 3's browse-only refuse posture for free-tier Spotify.
   */
  readonly canPlay?: boolean
  /** Supply a prebuilt catalogue, e.g. an empty one for §11.6's empty states. */
  readonly catalog?: FixtureCatalog
}

/**
 * The fixture's own controls, on top of the `MusicProvider` contract.
 *
 * Deliberately not part of `MusicProvider`: nothing that consumes a provider
 * may reach for these, or it would stop working the moment a real provider is
 * substituted, which is exactly the coupling this package exists to prevent.
 */
export interface FixtureProvider extends MusicProvider {
  /** The data this instance browses. */
  readonly catalog: FixtureCatalog
  /**
   * Advances playback by `deltaMs` and notifies `onProgress` subscribers.
   *
   * The host drives the clock — a rAF loop in the app, an explicit call in a
   * test. Advancing past the end of the current track skips to the next one,
   * exactly as playback does, so a test can drive a whole queue with a loop.
   */
  tick(deltaMs: number): void
}

/** Synthesises lyrics for a track, so S16 has something to lay out. */
function lyricsFor(track: TrackRef): Lyrics {
  const lines = [
    `${track.title}`,
    `and the room goes quiet`,
    `you said it would`,
    `you said it would`,
    `so here is the part where it turns`,
    `and here is the part where it holds`,
    `${track.artistName}, one more time`,
  ]
  const step = Math.max(1, Math.floor(track.durationMs / (lines.length + 1)))
  return {
    lines: lines.map((text, index) => ({ startMs: step * (index + 1), text })),
    synced: true,
    language: 'en',
  }
}

function defaultReason(capability: Capability, displayName: string): string {
  // Product copy, per §14.4 — rendered verbatim to a human.
  //
  // The `Feature — not available on Service` form is §14.6's own, given there
  // as `Lyrics — not available on Spotify`. Taking it verbatim avoids a
  // grammar trap that a template invents: "Lyrics isn't available" and "Love
  // and dislike isn't available" are both wrong, and a generated sentence
  // cannot know which of twenty-five feature names is plural.
  //
  // A provider with something specific to say overrides this. Apple and
  // Spotify both do, for every capability they lack.
  return `${CAPABILITY_FEATURE_NAMES[capability]} — not available on ${displayName}`
}

/**
 * Creates a fixture provider.
 *
 * @param options capability overrides, session shape and catalogue. Everything
 * is optional; the defaults give a signed-in, fully-capable device with a
 * populated library, which is what a screen needs to render on load.
 */
export function createFixtureProvider(options: FixtureProviderOptions = {}): FixtureProvider {
  const displayName = options.displayName ?? 'Demo library'
  const catalog = options.catalog ?? createFixtureCatalog()
  const matrix: CapabilityMatrix = { ...FIXTURE_FULL_SUPPORT, ...options.supports }
  const reasons = options.unsupportedReasons ?? {}

  const sessionListeners = new Set<(s: Session | null) => void>()
  const playbackListeners = new Set<(s: PlaybackState) => void>()
  const progressListeners = new Set<(p: ProgressTick) => void>()

  const loveByKey = new Map<LocalKey, 'love' | 'dislike' | 'none'>()
  /**
   * Library membership — and therefore also what `saveToggle` writes.
   *
   * ⚑ There is deliberately **no separate `savedKeys` set.** §14.3 row 24 makes
   * Save and add-to-library *one operation with two labels*: `POST
   * /v1/me/library` on Apple, `PUT /me/tracks` on Spotify — the same endpoint
   * `libraryAdd` calls. A second store would have made `Save` a control that
   * changes nothing anything can read back, which is the opposite of what a
   * fixture is for.
   *
   * ⚑ It is still not `loveByKey`. Love is a taste signal and Save is
   * membership (§14.3 row 23); the two share no store and no code path.
   */
  const libraryTrackKeys = new Set<LocalKey>(catalog.tracks.map((t) => t.key))
  const playlists: PlaylistRef[] = [...catalog.playlists]
  // No cast: `tracksByPlaylist` is `LocalKeyed`, so its keys arrive branded.
  // The `as LocalKey` that used to sit here was the package laundering a raw
  // string past its own type in the one place the type mattered.
  const playlistTracks = new Map<LocalKey, TrackRef[]>(
    [...catalog.tracksByPlaylist].map(([key, tracks]) => [key, [...tracks]]),
  )

  let session: Session | null =
    (options.authorized ?? true)
      ? {
          provider: 'fixture',
          status: 'authorized',
          userIdentifier: 'demo',
          storefront: 'us',
          canPlay: options.canPlay ?? true,
          expiresAt: null,
        }
      : null

  let queueNow: TrackRef | null = null
  let queueNext: TrackRef[] = []
  let queueHistory: TrackRef[] = []
  let status: PlaybackState['status'] = 'idle'
  let positionMs = 0
  let volume0to100 = 60
  // §14.2 supplies no setter for either; D-052 ruled that an omission rather
  // than a design and added `setShuffle` / `setRepeat` to the interface. These
  // start at their B02 defaults (§11.1) and move only through those methods.
  let shuffle: ShuffleMode = 'off'
  let repeat: RepeatMode = 'off'

  function snapshot(): PlaybackState {
    return {
      status,
      now: queueNow,
      positionMs,
      durationMs: queueNow?.durationMs ?? 0,
      volume0to100,
      shuffle,
      repeat,
    }
  }

  function emitPlayback(): void {
    const state = snapshot()
    for (const listener of playbackListeners) listener(state)
  }

  function emitProgress(): void {
    const tickValue: ProgressTick = {
      positionMs,
      durationMs: queueNow?.durationMs ?? 0,
      // The fixture reports position from its own authoritative counter, so it
      // is never interpolated. A provider that lacks `progressTicks` sets this
      // `true` and S14 widens the scrubber's hit tolerance (§14.3 row 25).
      interpolated: !matrix.progressTicks,
    }
    for (const listener of progressListeners) listener(tickValue)
  }

  function requireCapability(capability: Capability): void {
    if (matrix[capability]) return
    throw new CapabilityUnsupportedError('fixture', capability, reasonFor(capability))
  }

  /**
   * Refuses anything that needs the user's account when there is no session.
   *
   * Signed-out is a **reachable state here**, and it has to be: the fixture is
   * the only provider W3 can drive — Apple and Spotify throw on every method —
   * so a fixture that served 42 songs while signed out would make §11.5's
   * signed-out copy and J6c's re-auth journey unbuildable against anything.
   *
   * `configure`, `authorize`, `supports` and `unsupportedReason` are outside
   * this gate: they are what a signed-out screen is allowed to call.
   */
  function requireSession(method: string): void {
    if (session !== null && session.status === 'authorized') return
    throw new NotAuthorizedError('fixture', method)
  }

  /**
   * Refuses playback on an account whose tier does not permit it.
   *
   * §14.3 row 3's **(d) refuse** posture: browse-only. Raised from `play()`
   * alone, because that is the only entry point that starts audio — `pause`,
   * `seek` and `setVolume` against a stopped player are harmless, and refusing
   * them would produce errors on a screen that is behaving correctly.
   */
  function requireTier(): void {
    if (session !== null && session.canPlay) return
    throw new PlaybackNotPermittedError('fixture')
  }

  function reasonFor(capability: Capability): string {
    return reasons[capability] ?? defaultReason(capability, displayName)
  }

  function advanceToNext(): void {
    if (queueNow !== null) queueHistory = [...queueHistory, queueNow]
    const [head, ...rest] = queueNext
    queueNow = head ?? null
    queueNext = rest
    positionMs = 0
    if (queueNow === null) status = 'stopped'
  }

  /**
   * Slices one page, refusing a cursor this provider did not issue.
   *
   * The cursor is the offset of the next page, as a decimal string — the only
   * values `Page.next` ever returns. Anything else throws rather than
   * collapsing to `0`: a malformed or negative cursor silently answering with
   * page 0 *and a non-null `next`* is byte-identical to a legitimate first
   * page, so the caller appends the same rows again and sees no error.
   */
  function pageOf<T>(items: readonly T[], cursor: Cursor | undefined): Page<T> {
    let from = 0
    if (cursor !== undefined) {
      // `Number.parseInt` would accept `'25abc'` and `' 25'`; the cursor is
      // ours and its shape is exact, so it is matched rather than parsed.
      if (!/^\d+$/.test(cursor)) throw new InvalidCursorError('fixture', cursor)
      from = Number(cursor)
      if (from > items.length) throw new InvalidCursorError('fixture', cursor)
    }
    const slice = items.slice(from, from + PAGE_SIZE)
    const end = from + slice.length
    return { items: slice, next: end < items.length ? String(end) : null, total: items.length }
  }

  function matches(haystack: string, needle: string): boolean {
    return normaliseForMatch(haystack).includes(normaliseForMatch(needle))
  }

  const provider: FixtureProvider = {
    id: 'fixture',
    displayName,
    catalog,

    /** Reads this instance's matrix. Synchronous, total, allocation-free. */
    supports(c: Capability): boolean {
      return matrix[c]
    },

    /** `null` when supported; product copy otherwise. Never the empty string. */
    unsupportedReason(c: Capability): string | null {
      return matrix[c] ? null : reasonFor(c)
    },

    /** No SDK to prepare. Present so the call site is identical everywhere. */
    async configure(): Promise<void> {},

    /** Signs in immediately. No gesture needed; there is nothing to consent to. */
    async authorize(): Promise<Session> {
      requireCapability('auth')
      session = {
        provider: 'fixture',
        status: 'authorized',
        userIdentifier: 'demo',
        storefront: 'us',
        canPlay: options.canPlay ?? true,
        expiresAt: null,
      }
      for (const listener of sessionListeners) listener(session)
      return session
    },

    /**
     * Drops the session and stops playback, as a real sign-out does.
     *
     * Idempotent and callable while signed out — it is the one member outside
     * the session gate besides `configure` and `authorize`, because "sign me
     * out" must not fail on a device that is already signed out.
     */
    async unauthorize(): Promise<void> {
      session = null
      status = 'stopped'
      for (const listener of sessionListeners) listener(null)
      emitPlayback()
    },

    get session(): Session | null {
      return session
    },

    /** @returns an unsubscribe that is safe to call more than once. */
    onSessionChange(cb: (s: Session | null) => void): Unsubscribe {
      sessionListeners.add(cb)
      return () => {
        sessionListeners.delete(cb)
      }
    },

    /** Substring match over the catalogue, normalised the way §14.5 normalises. */
    async search(q: SearchQuery): Promise<SearchResults> {
      requireCapability('search')
      requireSession('search')
      const limit = q.limit ?? 10
      const wants = (kind: SearchQuery['kinds'][number]): boolean => q.kinds.includes(kind)
      return {
        tracks: wants('track')
          ? catalog.tracks.filter((t) => matches(t.title, q.term) || matches(t.artistName, q.term)).slice(0, limit)
          : [],
        albums: wants('album')
          ? catalog.albums.filter((a) => matches(a.title, q.term) || matches(a.artistName, q.term)).slice(0, limit)
          : [],
        artists: wants('artist') ? catalog.artists.filter((a) => matches(a.name, q.term)).slice(0, limit) : [],
        playlists: wants('playlist') ? playlists.filter((p) => matches(p.name, q.term)).slice(0, limit) : [],
        stations: wants('station') ? catalog.stations.filter((s) => matches(s.name, q.term)).slice(0, limit) : [],
        next: null,
      }
    },

    /** Pages the requested library slice. `total` is exact — it is our data. */
    async libraryList(kind: LibraryKind, page?: Cursor): Promise<Page<Entity>> {
      requireCapability('libraryRead')
      requireSession('libraryList')
      const source: readonly Entity[] =
        kind === 'playlists'
          ? playlists
          : kind === 'artists'
            ? catalog.artists
            : kind === 'albums'
              ? catalog.albums
              : kind === 'songs'
                ? catalog.tracks.filter((t) => libraryTrackKeys.has(t.key))
                : kind === 'genres'
                  ? catalog.genres
                  : catalog.composers
      return pageOf(source, page)
    },

    /** Adds to the library. Distinct from Love — §14.3 rows 23 and 24. */
    async libraryAdd(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void> {
      requireCapability('libraryAdd')
      requireSession('libraryAdd')
      if (ref.kind === 'track') libraryTrackKeys.add(ref.key)
      if (ref.kind === 'album') for (const t of catalog.tracksByAlbum.get(ref.key) ?? []) libraryTrackKeys.add(t.key)
    },

    /** ⚑ Gated: `libraryRemove` is `false` on Apple, so this path is Spotify-only there. */
    async libraryRemove(ref: TrackRef | AlbumRef | PlaylistRef): Promise<void> {
      requireCapability('libraryRemove')
      requireSession('libraryRemove')
      if (ref.kind === 'track') libraryTrackKeys.delete(ref.key)
      if (ref.kind === 'album') for (const t of catalog.tracksByAlbum.get(ref.key) ?? []) libraryTrackKeys.delete(t.key)
      if (ref.kind === 'playlist') {
        const index = playlists.findIndex((p) => p.key === ref.key)
        if (index >= 0) playlists.splice(index, 1)
      }
    },

    /** Creates a playlist and returns the ref the caller should hold. */
    async playlistCreate(p: { name: string; description?: string; tracks?: TrackRef[] }): Promise<PlaylistRef> {
      requireCapability('playlistCreate')
      requireSession('playlistCreate')
      const key = mintLocalKey()
      const tracks = p.tracks ?? []
      const ref: PlaylistRef = {
        kind: 'playlist',
        key,
        provider: 'fixture',
        catalogId: `pl.${key}`,
        name: p.name,
        ...(p.description === undefined ? {} : { description: p.description }),
        trackCount: tracks.length,
        editable: true,
      }
      playlists.push(ref)
      playlistTracks.set(key, [...tracks])
      return ref
    },

    /** Appends. Apple can only append, so nothing here may imply a position. */
    async playlistAddTracks(id: PlaylistRef, tracks: TrackRef[]): Promise<void> {
      requireCapability('playlistAddTracks')
      requireSession('playlistAddTracks')
      const existing = playlistTracks.get(id.key) ?? []
      playlistTracks.set(id.key, [...existing, ...tracks])
    },

    /** ⚑ `false` on Apple (D-015, D-029) — the highest-risk row in §14.3. */
    async playlistRemoveTracks(id: PlaylistRef, positions: number[]): Promise<void> {
      requireCapability('playlistRemoveTracks')
      requireSession('playlistRemoveTracks')
      const drop = new Set(positions)
      const existing = playlistTracks.get(id.key) ?? []
      playlistTracks.set(
        id.key,
        existing.filter((_track, index) => !drop.has(index)),
      )
    },

    /** ⚑ `false` on Apple — no positional write exists at any level. */
    async playlistReorder(id: PlaylistRef, from: number, to: number, count = 1): Promise<void> {
      requireCapability('playlistReorder')
      requireSession('playlistReorder')
      const existing = [...(playlistTracks.get(id.key) ?? [])]
      const moved = existing.splice(from, count)
      existing.splice(to, 0, ...moved)
      playlistTracks.set(id.key, existing)
    },

    /** Starts playback. With no target, resumes whatever is loaded. */
    async play(target?: PlayTarget): Promise<void> {
      requireCapability('transport')
      requireSession('play')
      requireTier()
      if (target !== undefined) {
        const tracks =
          target.kind === 'tracks'
            ? target.tracks.slice(target.startIndex ?? 0)
            : target.kind === 'album'
              ? (catalog.tracksByAlbum.get(target.album.key) ?? [])
              : target.kind === 'playlist'
                ? (playlistTracks.get(target.playlist.key) ?? [])
                : catalog.tracks
        const [head, ...rest] = tracks
        queueNow = head ?? null
        queueNext = rest
        positionMs = 0
      }
      status = queueNow === null ? 'idle' : 'playing'
      emitPlayback()
      emitProgress()
    },

    /** Pauses. Position is retained; a resume does not restart the track. */
    async pause(): Promise<void> {
      requireCapability('transport')
      requireSession('pause')
      if (status === 'playing') status = 'paused'
      emitPlayback()
    },

    /** Skips. `previous` restarts the track first if past three seconds. */
    async skip(direction: 'next' | 'previous', count = 1): Promise<void> {
      requireCapability('transport')
      requireSession('skip')
      for (let i = 0; i < count; i++) {
        if (direction === 'next') {
          advanceToNext()
        } else if (positionMs > 3000 && i === 0) {
          positionMs = 0
        } else {
          const previous = queueHistory.at(-1)
          if (previous === undefined) {
            positionMs = 0
            break
          }
          queueHistory = queueHistory.slice(0, -1)
          if (queueNow !== null) queueNext = [queueNow, ...queueNext]
          queueNow = previous
          positionMs = 0
        }
      }
      emitPlayback()
      emitProgress()
    },

    /** Seeks. Clamped to the track; a seek past the end does not skip. */
    async seek(ms: number): Promise<void> {
      requireCapability('seek')
      requireSession('seek')
      positionMs = Math.max(0, Math.min(ms, queueNow?.durationMs ?? 0))
      emitPlayback()
      emitProgress()
    },

    /** App volume, 0–100, clamped. Neither real provider can touch the system. */
    async setVolume(level0to100: number): Promise<void> {
      requireCapability('volume')
      requireSession('setVolume')
      volume0to100 = Math.max(0, Math.min(100, Math.round(level0to100)))
      emitPlayback()
    },

    /**
     * Sets shuffle mode (D-052).
     *
     * Provider state, not device state: the mode is read back through
     * `playback`, which is what a real provider does, so a screen built here
     * cannot come to depend on a local flag that would do nothing against
     * MusicKit or the Spotify SDK.
     *
     * The fixture does not reorder its queue on shuffle. That is deliberate —
     * §14.2 exposes no way to observe a provider's shuffled order either, so
     * inventing one would be a behaviour W3 could build on and Apple could not
     * reproduce.
     */
    async setShuffle(mode: ShuffleMode): Promise<void> {
      requireCapability('transport')
      requireSession('setShuffle')
      shuffle = mode
      emitPlayback()
    },

    /** Sets repeat mode (D-052). Provider state, read back through `playback`. */
    async setRepeat(mode: RepeatMode): Promise<void> {
      requireCapability('transport')
      requireSession('setRepeat')
      repeat = mode
      emitPlayback()
    },

    get playback(): PlaybackState {
      return snapshot()
    },

    /** @returns an unsubscribe that is safe to call more than once. */
    onPlaybackChange(cb: (s: PlaybackState) => void): Unsubscribe {
      playbackListeners.add(cb)
      return () => {
        playbackListeners.delete(cb)
      }
    },

    /**
     * Subscribes to progress.
     *
     * Always subscribable, whatever `supports("progressTicks")` says — that
     * capability reports whether the *provider* emits a continuous tick, not
     * whether position is knowable. Where it is off, ticks carry
     * `interpolated: true` and no control is hidden.
     */
    onProgress(cb: (p: ProgressTick) => void): Unsubscribe {
      progressListeners.add(cb)
      return () => {
        progressListeners.delete(cb)
      }
    },

    /** Reads the queue. `history` is oldest-first; `next` is play order. */
    async queueRead(): Promise<QueueSnapshot> {
      requireCapability('queueRead')
      requireSession('queueRead')
      return { now: queueNow, next: [...queueNext], history: [...queueHistory] }
    },

    /** Appends to the end of Up Next. */
    async queueAppend(tracks: TrackRef[]): Promise<void> {
      requireCapability('queueAppend')
      requireSession('queueAppend')
      queueNext = [...queueNext, ...tracks]
    },

    /** ⚑ `false` on Spotify — there is no API, and the label changes there. */
    async queueInsertNext(tracks: TrackRef[]): Promise<void> {
      requireCapability('queueInsertNext')
      requireSession('queueInsertNext')
      queueNext = [...tracks, ...queueNext]
    },

    /** ⚑ `false` on both providers. S17 is read-only-with-append everywhere. */
    async queueRemove(positions: number[]): Promise<void> {
      requireCapability('queueRemove')
      requireSession('queueRemove')
      const drop = new Set(positions)
      queueNext = queueNext.filter((_track, index) => !drop.has(index))
    },

    /** ⚑ `false` on both providers. No drag handles render on either. */
    async queueReorder(from: number, to: number): Promise<void> {
      requireCapability('queueReorder')
      requireSession('queueReorder')
      const next = [...queueNext]
      const moved = next.splice(from, 1)
      next.splice(to, 0, ...moved)
      queueNext = next
    },

    /** Lists stations. ⚑ `stations` is `false` on Spotify: S18 is removed there. */
    async stationsList(): Promise<StationRef[]> {
      requireCapability('stations')
      requireSession('stationsList')
      return [...catalog.stations]
    },

    /**
     * Starts a station.
     *
     * A `track` seed needs `stationSeedFromTrack` as well as `stations` — they
     * are separate capabilities because Apple has the second and Spotify has
     * neither, and §14.3 row 20 was the only row in the whole matrix that moved.
     */
    async stationStart(seed: StationSeed): Promise<StationRef> {
      requireCapability('stations')
      requireSession('stationStart')
      if (seed.type === 'track') requireCapability('stationSeedFromTrack')
      const existing = catalog.stations.find((s) => s.catalogId === seed.ref)
      if (existing !== undefined) return existing
      return {
        kind: 'station',
        key: mintLocalKey(),
        provider: 'fixture',
        catalogId: `ra.${seed.ref}`,
        name: 'Station',
        live: false,
      }
    },

    /** ⚑ `lyrics` is `false` on both real providers. See the adapter comments. */
    async lyrics(ref: TrackRef): Promise<Lyrics> {
      requireCapability('lyrics')
      requireSession('lyrics')
      const full = lyricsFor(ref)
      if (matrix.lyricsSynced) return full
      // Unsynced is a real, renderable state, not a failure: §14.3 row 21
      // degrades to static text with no scroll-lock and no `Following you` chip.
      return { ...full, synced: false, lines: full.lines.map((l) => ({ startMs: null, text: l.text })) }
    },

    /**
     * Sets Love / Dislike.
     *
     * ⚑ Writes its own map and never touches `savedKeys`. §14.3 row 23: Love is
     * a taste signal, Save is library membership, and mapping one to the other
     * silently changes what the control means.
     */
    async ratingSet(ref: TrackRef, r: Rating): Promise<void> {
      requireCapability('ratingLoveDislike')
      requireSession('ratingSet')
      if (r.love !== undefined) loveByKey.set(ref.key, r.love)
    },

    /**
     * Library membership — Apple's `Add to Library`, Spotify's `Save`.
     *
     * Writes the same store `libraryAdd` writes, because §14.3 row 24 says they
     * are one operation: the result is observable through `libraryList('songs')`
     * and survives a read-back, which is what makes a `Save` control built
     * against this fixture a real control.
     *
     * ⚑ **Un-saving needs `libraryRemove`, and that is `false` on Apple.**
     * Removing from the library is a different endpoint from adding to it, and
     * Apple exposes no removal at all (§14.3 row 7), so `saveToggle(ref, false)`
     * is genuinely unavailable there. Gating it on the capability that actually
     * governs it is what keeps that parity gap visible instead of letting the
     * fixture do something the launch provider cannot.
     *
     * ⚑ **Never aliased to `ratingSet`.** Love is a taste signal, Save is
     * membership (§14.3 row 23).
     */
    async saveToggle(ref: TrackRef, saved: boolean): Promise<void> {
      requireCapability('saveToggle')
      if (!saved) requireCapability('libraryRemove')
      requireSession('saveToggle')
      if (saved) libraryTrackKeys.add(ref.key)
      else libraryTrackKeys.delete(ref.key)
    },

    tick(deltaMs: number): void {
      if (status !== 'playing' || queueNow === null) return
      let remaining = deltaMs
      while (remaining > 0 && queueNow !== null) {
        const left = queueNow.durationMs - positionMs
        if (remaining < left) {
          positionMs += remaining
          remaining = 0
        } else {
          remaining -= left
          advanceToNext()
        }
      }
      emitProgress()
      if (status !== 'playing') emitPlayback()
    },
  }

  return provider
}
