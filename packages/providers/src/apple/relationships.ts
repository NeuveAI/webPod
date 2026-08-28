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
 * the status.** {@link readSongRelationship} takes a single closed parameter
 * object with no member a status could arrive in, and no second parameter. That
 * is enforced by the compiler, not by this comment: `relationships.test.ts`
 * carries two type-level assertions — the parameter tuple is exactly length 1,
 * and {@link RelationshipRead}'s key set is exactly `resource | relationship` —
 * so adding a status, positionally or as a field, turns the build red.
 *
 * ⚑ An earlier version of this module asserted `Function.length === 2` instead.
 * **`Function.length` stops counting at the first defaulted parameter**, so
 * `(resource, name, status = 0)` satisfied it and the exact D-029 mistake was
 * reintroducible with every gate green (D-062). Runtime introspection of a
 * function's shape describes the implementation; it does not constrain it.
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
 * Refuses a relationship name that is not known to exist, and reports how well
 * the surviving name is evidenced.
 *
 * The cheap half of the defence, and it has to be the first half: because a bad
 * name returns `200`, the response cannot tell you the name was wrong. Catching
 * it before the request is built is the only place the mistake is still legible.
 *
 * **It returns the evidence class rather than discarding it.** A `docs-only`
 * name passes — refusing the five relationships Apple documents would break
 * ordinary use for no gain — but the caller is told the name is unmeasured, so
 * a later absence can be diagnosed honestly rather than being reported as a
 * request that was not honoured (D-045: name the evidence class; a registry
 * that distinguishes measured from unmeasured and then treats them alike has
 * not distinguished them).
 *
 * @returns the evidence class recorded for the name.
 * @throws {RelationshipUnknownError} for an unregistered name, or one measured
 * as not being a relationship.
 */
export function assertKnownSongRelationship(name: string): RelationshipEvidence {
  const evidence = SONG_RELATIONSHIPS[name]
  if (evidence === undefined || evidence === 'live-absent') throw new RelationshipUnknownError(name)
  return evidence
}

/** Whether a name's existence has been observed against the running API. */
export function isMeasuredRelationship(evidence: RelationshipEvidence): boolean {
  return evidence !== 'docs-only'
}

/** The shape of an Apple resource object, as far as this module cares. */
export interface AppleResource {
  readonly id?: string
  readonly relationships?: Readonly<Record<string, { readonly data?: readonly unknown[] } | null | undefined>>
}

/**
 * Everything {@link readSongRelationship} is allowed to know.
 *
 * **The key set is closed and is asserted closed by a type-level test.** There
 * is deliberately no `status`, and adding one — as a required field, an
 * optional field, or a second function parameter — turns the build red. That is
 * the D-029 containment: not a rule against trusting a `200`, but the absence
 * of anywhere a `200` could be put (D-054).
 */
export interface RelationshipRead {
  /** The parsed resource object the request returned. */
  readonly resource: AppleResource
  /** The relationship that was asked for. */
  readonly relationship: string
}

/**
 * Reads a relationship out of a resource, refusing to guess.
 *
 * **Cannot be told the HTTP status.** A `200` is not evidence that the
 * relationship was requested successfully, so there is nowhere to put one:
 * {@link RelationshipRead} has no such field and the function takes no second
 * parameter. Both are compiler-checked in `relationships.test.ts`.
 *
 * @param read the resource and the relationship name.
 * @returns the relationship's `data` array. An **empty array means the resource
 * genuinely has none** — a legitimate data condition the caller should render
 * as an empty state.
 * @throws {RelationshipUnknownError} if the name is not a known relationship.
 * @throws {RelationshipNotHonouredError} if the key is absent from the payload,
 * or is present with a `null` value. This is the failure the whole module
 * exists for: the caller must not treat it as "no data". Where the name is
 * documentation-only rather than measured, the error says so — absence then has
 * two candidate causes and the message names both.
 */
export function readSongRelationship(read: RelationshipRead): readonly unknown[] {
  const { resource, relationship: name } = read
  const measured = isMeasuredRelationship(assertKnownSongRelationship(name))

  const notHonoured = (): RelationshipNotHonouredError =>
    new RelationshipNotHonouredError(name, resource.id ?? null, measured)

  const relationships = resource.relationships
  if (relationships === undefined) throw notHonoured()
  if (!Object.hasOwn(relationships, name)) throw notHonoured()

  const relationship = relationships[name]
  // `null` is legal JSON and reaches here as a present key with no object. It
  // gets the same treatment as an absent one rather than being dereferenced:
  // this module's whole job is being the containment for a payload whose shape
  // cannot be trusted, and a bare `TypeError` carries no `_tag`, so it would
  // bypass every consumer's D-029 branch.
  if (relationship === undefined || relationship === null) throw notHonoured()

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
