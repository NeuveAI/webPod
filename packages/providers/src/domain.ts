/**
 * The supporting types `MusicProvider` refers to.
 *
 * §14.2 names `Session`, `SearchQuery`, `SearchResults`, `LibraryKind`,
 * `Cursor`, `Page`, `PlayTarget`, `PlaybackState`, `Lyrics` and `Unsubscribe`
 * in its signatures and defines none of them. Everything in this file is
 * therefore invented to fill that gap, and every shape is listed in
 * `decisions/w1.md` so a reviewer can tell transcription from invention at a
 * glance. Each is kept as small as the screens in §10 and the copy in §11
 * actually require — a field nothing renders is a field nobody has checked.
 */

import type { AlbumRef, ArtistRef, Entity, PlaylistRef, ProviderId, StationRef, TrackRef } from './identity.ts'

/** Cancels a subscription. Idempotent: calling it twice is not an error. */
export type Unsubscribe = () => void

/**
 * An authorised connection to a provider.
 *
 * `canPlay` is separate from `status` on purpose. §14.3 rows 2 and 3 make the
 * paid tier a distinct axis from being signed in: a free Spotify account
 * authorises fine and cannot play a note, and §11.5 has its own copy for that
 * state. Collapsing the two would make "signed in but silent" unrepresentable.
 */
export interface Session {
  readonly provider: ProviderId
  readonly status: 'authorized' | 'unauthorized' | 'expired'
  /** Opaque, provider-scoped, for display only. Never used as a key. */
  readonly userIdentifier: string | null
  /** Apple `storefrontId` | Spotify `market`. Drives `TrackRef.playable`. */
  readonly storefront: string | null
  /** Whether this account's tier permits playback at all (§14.3 rows 2, 3). */
  readonly canPlay: boolean
  /** Epoch milliseconds, or `null` where the provider does not say. */
  readonly expiresAt: number | null
}

/** An opaque, provider-scoped pagination token. Never a key, never persisted. */
export type Cursor = string

/** One page of a listing. */
export interface Page<T> {
  readonly items: readonly T[]
  /** Token for the next page, or `null` at the end. */
  readonly next: Cursor | null
  /**
   * Total across all pages where the provider reports one.
   *
   * `null` rather than a guess: §11.6 renders empty slices as a count
   * (`Playlists 0`), and an invented total would put a wrong number on screen.
   */
  readonly total: number | null
}

/**
 * A slice of the user's library, matching the S04 Music menu (§4.2).
 *
 * ⚑ There is no `downloaded` slice. D-019 cut offline repo-wide: no browser
 * client on either provider can hold audio, so a "downloaded only" filter would
 * be a control that can never have contents.
 */
export type LibraryKind = 'playlists' | 'artists' | 'albums' | 'songs' | 'genres' | 'composers'

/** What a search is looking for. */
export type EntityKind = 'track' | 'album' | 'artist' | 'playlist' | 'station'

/**
 * A search request.
 *
 * `scope` is the S12 scope chip: the user's own library, or the whole
 * catalogue. §11.5's no-results copy differs between them, so it is a request
 * parameter rather than two call sites.
 */
export interface SearchQuery {
  readonly term: string
  readonly scope: 'library' | 'catalog'
  readonly kinds: readonly EntityKind[]
  readonly limit?: number
  readonly cursor?: Cursor
}

/**
 * Search results, split by kind.
 *
 * Split rather than one heterogeneous list because S12 renders them as sections
 * and a flat list would force every consumer to re-partition it.
 */
export interface SearchResults {
  readonly tracks: readonly TrackRef[]
  readonly albums: readonly AlbumRef[]
  readonly artists: readonly ArtistRef[]
  readonly playlists: readonly PlaylistRef[]
  readonly stations: readonly StationRef[]
  /** Token for more of the same query, or `null`. */
  readonly next: Cursor | null
}

/**
 * What `play()` should start.
 *
 * A closed union rather than a bag of optional ids, so "an album and a track
 * at once" is not expressible.
 */
export type PlayTarget =
  | { readonly kind: 'tracks'; readonly tracks: readonly TrackRef[]; readonly startIndex?: number }
  | { readonly kind: 'album'; readonly album: AlbumRef }
  | { readonly kind: 'playlist'; readonly playlist: PlaylistRef }
  | { readonly kind: 'station'; readonly station: StationRef }

/** Shuffle mode, per B02's `Shuffle: Off / Songs / Albums` (§11.1). */
export type ShuffleMode = 'off' | 'songs' | 'albums'

/** Repeat mode, per B02's `Repeat: Off / One / All` (§11.1). */
export type RepeatMode = 'off' | 'one' | 'all'

/**
 * The provider's playback state.
 *
 * A snapshot, not a stream. Continuous position comes from `onProgress`, which
 * is the only place the interpolation flag lives — §14.3 row 25 makes that flag
 * the honest channel for "this number was computed, not reported".
 */
export interface PlaybackState {
  readonly status: 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'
  readonly now: TrackRef | null
  /** Zero-based provider-authoritative position in the active queue, or null until known. */
  readonly queueIndex: number | null
  readonly positionMs: number
  readonly durationMs: number
  /** App volume, 0–100. Not system volume — §14.3 row 14 on both providers. */
  readonly volume0to100: number
  readonly shuffle: ShuffleMode
  readonly repeat: RepeatMode
}

/** A progress report from `onProgress`. */
export interface ProgressTick {
  readonly positionMs: number
  readonly durationMs: number
  /**
   * `true` when this number came from our own interpolator rather than the
   * provider (§14.3 row 25). S14's scrubber widens its hit tolerance when it is
   * set, and must suspend interpolation during a human scrub rather than fight
   * it. Reporting this is what keeps the emulation honest instead of invented.
   */
  readonly interpolated: boolean
}

/** One line of lyrics. */
export interface LyricLine {
  /** Milliseconds into the track, or `null` when the lyrics are unsynced. */
  readonly startMs: number | null
  readonly text: string
}

/**
 * A track's lyrics.
 *
 * `synced: false` is a real, renderable state, not a failure: §14.3 row 21
 * degrades to static text with no scroll-lock and no `Following you` chip.
 */
export interface Lyrics {
  readonly lines: readonly LyricLine[]
  readonly synced: boolean
  /** BCP 47, or `null` where the provider does not say. */
  readonly language: string | null
}

/** What `queueRead()` returns. */
export interface QueueSnapshot {
  readonly now: TrackRef | null
  readonly next: readonly TrackRef[]
  readonly history: readonly TrackRef[]
}

/** A seed for `stationStart()`, transcribed from §14.2. */
export interface StationSeed {
  readonly type: 'track' | 'artist' | 'genre' | 'station'
  /** The provider-side id of the seed. Not a `LocalKey` — it leaves our layer. */
  readonly ref: string
}

/** The rating `ratingSet()` accepts. §14.2 gives it `love` and nothing else. */
export interface Rating {
  /**
   * ⚑ Love is a **taste signal**, never library membership. §14.3 row 23
   * forbids mapping it to Save: conflating them silently changes what the
   * control means. `saveToggle()` is the other verb and they never alias.
   *
   * ⚑ Stars are not here and never will be. They are a device rating stored
   * locally, on every provider, and they reach no service (D-023, D-026).
   */
  readonly love?: 'love' | 'dislike' | 'none'
}

/** Re-exported so consumers of a listing do not have to reach into identity. */
export type { Entity }
