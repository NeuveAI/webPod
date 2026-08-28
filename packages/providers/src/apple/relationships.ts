/**
 * Apple relationship handling — the D-029 hazard, contained.
 *
 * **The hazard, measured live rather than reasoned about:** Apple *silently
 * ignores* an invalid `include` / `views` / `extend` query parameter and answers
 * `200`. A typo'd `include=station` therefore succeeds, and the response simply
 * lacks the relationship — which reads as *"this song has no station"*, a
 * perfectly plausible data condition. The request failed and the status code
 * says it worked.
 *
 * So: **assert the relationship is present in the payload. Never infer it from
 * the status.** These functions take no status code at all, which is the point.
 * There is no argument slot in which a `200` can be mistaken for evidence.
 *
 * The two conditions are kept apart because they mean opposite things:
 *
 * | Condition | Meaning | Here |
 * |---|---|---|
 * | key absent from `relationships` | the request was not honoured | throws {@link RelationshipNotHonouredError} |
 * | key present, `data: []` | honoured; the resource genuinely has none | returns `[]` |
 *
 * ⚑ Nothing in this file makes a network call. It is pure, so the hazard is
 * testable without Apple, which is the only reason a stub can be defended
 * against it at all.
 */

import { RelationshipNotHonouredError, RelationshipUnknownError } from '../errors.ts'

/**
 * What a relationship name is, as far as we have evidence.
 *
 * Deliberately not a claim of completeness. S1 built four capability findings
 * on "the docs list exactly seven relationships, therefore there are seven",
 * and S2 falsified it by finding three more live (D-029, D-035). This registry
 * exists to catch a **typo before a request is built**, which is a job it can
 * do while being incomplete; it is not an existence oracle and must never be
 * cited as one.
 */
export type RelationshipEvidence =
  /** Measured live: the relationship exists. */
  | 'live-exists'
  /** Measured live: the relationship exists and is permission-gated. */
  | 'live-gated'
  /** Measured live: not a relationship at all. */
  | 'live-absent'
  /** Listed in Apple's `Songs.Relationships` reference. Not measured here. */
  | 'docs-only'

/**
 * `Songs` relationship names and what is known about each.
 *
 * The `live-*` rows are S2's oracle output, reproduced exactly. The `docs-only`
 * rows are the reference's own list and carry no live provenance, so under
 * D-022 they are provisional.
 */
export const SONG_RELATIONSHIPS: Readonly<Record<string, RelationshipEvidence>> = {
  // Measured, 2026-08-28, developer token, read-only.
  artists: 'live-exists',
  station: 'live-exists',
  lyrics: 'live-gated',
  'syllable-lyrics': 'live-gated',
  credits: 'live-exists',
  'similar-songs': 'live-absent',
  radio: 'live-absent',
  videos: 'live-absent',
  // Listed by the reference; not probed.
  albums: 'docs-only',
  composers: 'docs-only',
  genres: 'docs-only',
  library: 'docs-only',
  'music-videos': 'docs-only',
}

/**
 * Refuses a relationship name that is not known to exist.
 *
 * The cheap half of the defence, and it has to be the first half: because a bad
 * name returns `200`, the response cannot tell you the name was wrong. Catching
 * it before the request is built is the only place the mistake is still legible.
 *
 * @throws {RelationshipUnknownError} for an unregistered name, or one measured
 * as not being a relationship.
 */
export function assertKnownSongRelationship(name: string): void {
  const evidence = SONG_RELATIONSHIPS[name]
  if (evidence === undefined || evidence === 'live-absent') throw new RelationshipUnknownError(name)
}

/** The shape of an Apple resource object, as far as this module cares. */
export interface AppleResource {
  readonly id?: string
  readonly relationships?: Readonly<Record<string, { readonly data?: readonly unknown[] } | undefined>>
}

/**
 * Reads a relationship out of a resource, refusing to guess.
 *
 * **Takes no HTTP status, on purpose.** A `200` is not evidence that the
 * relationship was requested successfully, so there is no parameter through
 * which one could be supplied and quietly relied upon.
 *
 * @param resource the parsed resource object the request returned.
 * @param name the relationship that was asked for.
 * @returns the relationship's `data` array. An **empty array means the resource
 * genuinely has none** — a legitimate data condition the caller should render
 * as an empty state.
 * @throws {RelationshipUnknownError} if `name` is not a known relationship.
 * @throws {RelationshipNotHonouredError} if the key is absent from the payload.
 * This is the failure the whole module exists for: the request was not honoured
 * and the caller must not treat it as "no data".
 */
export function readSongRelationship(resource: AppleResource, name: string): readonly unknown[] {
  assertKnownSongRelationship(name)

  const relationships = resource.relationships
  if (relationships === undefined) {
    throw new RelationshipNotHonouredError(name, resource.id ?? null)
  }
  if (!Object.hasOwn(relationships, name)) {
    throw new RelationshipNotHonouredError(name, resource.id ?? null)
  }

  const relationship = relationships[name]
  if (relationship === undefined) {
    throw new RelationshipNotHonouredError(name, resource.id ?? null)
  }

  // The key being present is what proves the request was honoured. A missing
  // `data` array on a present key is an empty relationship, not a failure.
  return relationship.data ?? []
}

/** The four states S2's live oracle distinguishes. */
export type RelationshipExistence =
  | 'exists-with-data'
  | 'exists-no-data'
  | 'exists-gated'
  | 'not-a-relationship'
  | 'inconclusive'

/**
 * Classifies a relationship-path response into S2's four-state existence oracle.
 *
 * The *path* form is strict where the query form is lax, and it answers the
 * existence question honestly — which is the whole reason the lyrics row was
 * settled correctly on the second attempt. A bare status code was worthless;
 * only the paired error codes separated the hypotheses.
 *
 * | Status | Code | Meaning |
 * |---|---|---|
 * | `200` | — | exists, has data |
 * | `404` | `40403` | exists, no data for this resource |
 * | `400` | `40012` | exists, permission-gated |
 * | `400` | `40008` | not a relationship at all |
 *
 * @param status the HTTP status of a `GET …/{id}/{relationship}` request.
 * @param code Apple's own error code from the response body, or `null`.
 * @returns the classification, or `inconclusive` for anything not in the table.
 * `inconclusive` exists so an unrecognised pair is never silently read as an
 * absence, which is the mistake this oracle was built to stop making.
 */
export function classifyRelationshipResponse(status: number, code: string | null): RelationshipExistence {
  if (status === 200) return 'exists-with-data'
  if (code === '40403') return 'exists-no-data'
  if (code === '40012') return 'exists-gated'
  if (code === '40008') return 'not-a-relationship'
  return 'inconclusive'
}
