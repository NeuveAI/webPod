/**
 * Identity: `LocalKey`, the reference types, and the rule that keeps provider
 * ids out of our own structures.
 *
 * pm-spec §14.5 states the law: *"Nothing in our layer may hold a provider ID
 * as a primary key."* Apple catalog ids are storefront-scoped, Apple *library*
 * ids (`i.xxxx`) are a third id space again, and Spotify's are its own. A
 * structure keyed by any of them is a structure that dies at a provider switch.
 *
 * §14.2 writes `type LocalKey = string` with the comment *"UUIDv7 minted by us.
 * Our structures hold ONLY this."* A bare alias cannot enforce that comment: a
 * `catalogId` is a `string` too, so the compiler would accept it everywhere.
 * `LocalKey` is therefore a **branded** string here — assignable *to* `string`,
 * never *from* one. See `decisions/w1.md`; this is a logged deviation and it is
 * the only way "verify by type, not by convention" is achievable.
 */

import { InvalidLocalKeyError } from './errors.ts'

/**
 * Which service a reference came from.
 *
 * ⚠ Widened from §14.2's `"apple" | "spotify"` by one member. The fixture
 * provider is a real provider in this app — D-006 makes it what the product
 * actually renders from — so every `TrackRef` it mints has to say truthfully
 * where it came from. Letting it claim `"apple"` would put a lie in the one
 * field §14.5 exists to keep honest. Logged in `decisions/w1.md`.
 *
 * Adding a member costs nothing at call sites because §14.4 forbids branching
 * on this value: capability checks are `supports()`, never `provider.id ===`.
 */
export type ProviderId = 'apple' | 'spotify' | 'fixture'

declare const localKeyBrand: unique symbol

/**
 * Our own stable identity for a track, album, artist, playlist or station.
 *
 * A UUIDv7 minted the first time we see the thing. It is what the queue, the
 * Engraving, undo tokens, drafts, staged diffs and star ratings hold — never a
 * `catalogId`, never a `libraryId`, never a Spotify URI.
 *
 * It is a `string` at runtime and prints as one. The brand exists only so the
 * compiler rejects a provider id in a key position.
 */
export type LocalKey = string & { readonly [localKeyBrand]: true }

/** Matches a canonical lowercase UUIDv7: version nibble `7`, RFC 9562 variant. */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Millisecond of the last mint, for the same-millisecond monotonicity counter. */
let lastMs = -1
/** 12-bit `rand_a` counter, incremented while `lastMs` does not move. */
let counter = 0

function hex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/**
 * Mints a fresh `LocalKey`.
 *
 * RFC 9562 UUIDv7: a 48-bit big-endian Unix millisecond timestamp, version 7,
 * then randomness. Keys minted in the same millisecond stay ordered because
 * `rand_a` is used as a monotonic counter (RFC 9562 §6.2 method 1) rather than
 * being re-randomised — so sorting by key sorts by mint time, which is what the
 * Engraving's newest-first log and any dedupe pass depend on.
 *
 * ⚑ Not `crypto.randomUUID()`. That is a v4: no time ordering at all.
 * ⚑ Not `Bun.randomUUIDv7()`. This module runs in the browser.
 *
 * @returns a new key, never equal to any previously returned one.
 */
export function mintLocalKey(): LocalKey {
  const now = Date.now()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  if (now === lastMs) {
    counter = (counter + 1) & 0x0fff
  } else {
    lastMs = now
    // Leave headroom so a burst inside one millisecond cannot wrap into the
    // next millisecond's space; 0x0800 counters is far more than we can mint.
    counter = ((bytes[6] ?? 0) << 8 | (bytes[7] ?? 0)) & 0x07ff
  }

  // 48-bit timestamp, big-endian, into bytes 0..5.
  const ms = BigInt(now)
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn)
  }
  // Version 7 in the high nibble of byte 6; the counter fills rand_a.
  bytes[6] = 0x70 | ((counter >> 8) & 0x0f)
  bytes[7] = counter & 0xff
  // RFC 9562 variant `10` in the top two bits of byte 8.
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f)

  const h = hex(bytes)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` as LocalKey
}

/**
 * Narrows an unbranded string to a `LocalKey`.
 *
 * Use at the edges only — persisted state, a URL, a tool argument. Inside the
 * repo a `LocalKey` should arrive already typed; reaching for this function in
 * domain code is the smell that a provider id is being laundered into a key
 * position, which is exactly what §14.5 forbids.
 */
export function isLocalKey(value: string): value is LocalKey {
  return UUID_V7.test(value)
}

/**
 * Asserts an unbranded string is a `LocalKey` and returns it branded.
 *
 * @throws {InvalidLocalKeyError} if the string is not a canonical UUIDv7. It
 * throws rather than returning `null` because every caller is a trust boundary
 * and a silently-dropped key would orphan whatever it addressed.
 */
export function asLocalKey(value: string): LocalKey {
  if (!isLocalKey(value)) throw new InvalidLocalKeyError(value)
  return value
}

/**
 * A map our own structures may use: keyed by `LocalKey` and nothing else.
 *
 * Exported as a named type so that the intent is greppable — a queue,
 * provenance log or undo store declared with this cannot be handed a map keyed
 * by `catalogId` without the declaration itself changing.
 */
export type LocalKeyed<V> = ReadonlyMap<LocalKey, V>

/**
 * How a resolution record was arrived at, per §14.5's re-resolution ladder.
 *
 * - `exact` — the provider answered for the id we asked for.
 * - `isrc` — matched on ISRC. A *recording* match, not a master match: the same
 *   recording can carry different ISRCs across releases and remasters.
 * - `metadata` — normalised title + artist, with duration within ±2000ms.
 * - `low` — normalised title + artist only. §14.5 requires this be **flagged**,
 *   and the UI must show it as such rather than presenting it as a match.
 */
export type MatchConfidence = 'exact' | 'isrc' | 'metadata' | 'low'

/**
 * Album, template or fixed-size artwork.
 *
 * Transcribed from §14.2. Apple serves a URL template with `{w}`/`{h}`
 * placeholders; Spotify serves a fixed array of roughly three sizes.
 */
export interface Artwork {
  readonly kind: 'template' | 'fixed'
  /** Apple: a url containing `{w}` and `{h}`. */
  readonly template?: string
  /** Spotify: the fixed sizes on offer. Also usable as a native ceiling. */
  readonly sizes?: readonly { readonly url: string; readonly w: number; readonly h: number }[]
}

/**
 * The resolution record a `LocalKey` points at.
 *
 * Transcribed from §14.2, with one addition: `kind`. §14.2's own
 * `libraryAdd(ref: TrackRef | AlbumRef | PlaylistRef)` cannot be narrowed
 * without a discriminant, and §14.2 defines none of the sibling types, so the
 * discriminant is added to all four. Logged in `decisions/w1.md`.
 *
 * `title`, `artistName` and `durationMs` are denormalised **deliberately**:
 * §14.5 requires that a track be re-resolvable later without a provider round
 * trip, which is the whole mechanism by which a queue or a draft survives.
 */
export interface TrackRef {
  readonly kind: 'track'
  /** Ours, stable, never a provider id. */
  readonly key: LocalKey
  readonly provider: ProviderId
  /** Apple catalog id | Spotify track id. */
  readonly catalogId: string
  /** Apple ONLY: `"i.xxxx"` — a distinct id space from `catalogId`. */
  readonly libraryId?: string
  /** The only cross-provider handle, and imperfect (§14.5). */
  readonly isrc?: string
  /** Denormalised for display AND for re-resolution. */
  readonly title: string
  readonly artistName: string
  readonly albumName?: string
  readonly durationMs: number
  readonly artwork?: Artwork
  /** Storefront/market availability at the time of resolution (§14.3 row 28). */
  readonly playable: boolean
}

/** An album in a provider's catalogue or the user's library. */
export interface AlbumRef {
  readonly kind: 'album'
  readonly key: LocalKey
  readonly provider: ProviderId
  readonly catalogId: string
  readonly libraryId?: string
  readonly title: string
  readonly artistName: string
  readonly trackCount: number
  readonly releaseYear?: number
  readonly artwork?: Artwork
}

/** An artist. */
export interface ArtistRef {
  readonly kind: 'artist'
  readonly key: LocalKey
  readonly provider: ProviderId
  readonly catalogId: string
  readonly libraryId?: string
  readonly name: string
  readonly artwork?: Artwork
}

/**
 * A playlist.
 *
 * `editable` says whether *this provider* will accept writes to it at all; it
 * is not a capability check. A caller still asks `supports("playlistAddTracks")`
 * — a playlist can be editable in principle on a provider that offers no write
 * endpoint, and an endpoint can exist for a playlist the user cannot edit.
 */
export interface PlaylistRef {
  readonly kind: 'playlist'
  readonly key: LocalKey
  readonly provider: ProviderId
  readonly catalogId: string
  readonly libraryId?: string
  readonly name: string
  readonly description?: string
  readonly trackCount: number
  readonly editable: boolean
  readonly artwork?: Artwork
}

/** A radio station (§14.3 row 19). */
export interface StationRef {
  readonly kind: 'station'
  readonly key: LocalKey
  readonly provider: ProviderId
  readonly catalogId: string
  readonly name: string
  /** `true` for a live broadcast such as Apple Music 1, `false` for a stream. */
  readonly live: boolean
  readonly artwork?: Artwork
}

/**
 * A genre, as S10 lists them.
 *
 * A browse facet rather than a thing you can play, which is why it carries no
 * artwork and no duration. It is a `LocalKey` holder all the same: §14.5's rule
 * is about *our* structures, and a genre a user has drilled into is one.
 */
export interface GenreRef {
  readonly kind: 'genre'
  readonly key: LocalKey
  readonly provider: ProviderId
  readonly catalogId: string
  readonly name: string
}

/** A composer, as S11 lists them. §5 keeps this slice despite low traffic. */
export interface ComposerRef {
  readonly kind: 'composer'
  readonly key: LocalKey
  readonly provider: ProviderId
  readonly catalogId: string
  readonly name: string
}

/** Anything a browse surface can list. */
export type Entity = TrackRef | AlbumRef | ArtistRef | PlaylistRef | StationRef | GenreRef | ComposerRef

/**
 * Reads the `LocalKey` off any reference.
 *
 * Exists so call sites never reach for `.catalogId` when they meant identity.
 */
export function localKeyOf(entity: Entity): LocalKey {
  return entity.key
}
