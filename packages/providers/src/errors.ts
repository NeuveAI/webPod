/**
 * The provider layer's error taxonomy.
 *
 * Every error here is tagged. Consumers narrow on `_tag` rather than on
 * `instanceof`, because these values cross a package boundary and a duplicated
 * class identity — two copies of this module in one bundle — makes `instanceof`
 * silently false while the tag stays true.
 *
 * ⚑ None of these is a user-facing string. The only text a human ever sees from
 * this layer is `MusicProvider.unsupportedReason()`, which is product copy and
 * is rendered verbatim (pm-spec §14.4). An error message here is for a log.
 */

/** Discriminant carried by every error this package raises. */
export type ProviderErrorTag =
  | 'NotImplemented'
  | 'CapabilityUnsupported'
  | 'NotAuthorized'
  | 'PlaybackNotPermitted'
  | 'InvalidArtwork'
  | 'InvalidLocalKey'
  | 'RelationshipNotHonoured'
  | 'RelationshipUnknown'

/** Base class for everything this package throws. Never thrown directly. */
export abstract class ProviderError extends Error {
  abstract readonly _tag: ProviderErrorTag

  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
  }
}

/**
 * A method exists on the interface but this implementation does not perform it.
 *
 * Thrown by the Apple and Spotify adapters, which ship as compiling stubs: the
 * capability matrices are real and load-bearing from day one, the method bodies
 * are not written yet. Throwing a *typed* error rather than returning a rejected
 * `undefined` is what makes "we have not built this" distinguishable from "the
 * provider refused", which are different bugs with different fixes.
 */
export class NotImplementedError extends ProviderError {
  override readonly _tag = 'NotImplemented' as const

  constructor(
    /** Which adapter was called. */
    readonly providerId: string,
    /** The `MusicProvider` member that has no body yet. */
    readonly method: string,
  ) {
    super(`${providerId}: ${method}() is not implemented`)
  }
}

/**
 * A capability was invoked on a provider whose `supports()` says it lacks it.
 *
 * This should be unreachable from the UI: pm-spec §14.4 requires that an
 * unsupported capability produces **no control at all**, so nothing should be
 * able to call the method. It exists for the agent-facing and programmatic
 * paths, and as a tripwire — if it is ever thrown, a `supports()` check is
 * missing upstream, not here.
 *
 * `reason` is the same string `unsupportedReason()` returns, so a caller that
 * does surface this to a human has the correct copy already in hand.
 */
export class CapabilityUnsupportedError extends ProviderError {
  override readonly _tag = 'CapabilityUnsupported' as const

  constructor(
    readonly providerId: string,
    readonly capability: string,
    /** Product copy, rendered verbatim if it reaches a human. */
    readonly reason: string,
  ) {
    super(`${providerId}: capability "${capability}" is not supported`)
  }
}

/**
 * Something needing a signed-in session was called without one.
 *
 * A **reachable state, not a defect**: §11.5 has its own copy for it
 * (`Apple Music needs you to sign in again.`) and J6c is a designed journey.
 * It is distinct from {@link CapabilityUnsupportedError} because the remedy is
 * opposite — sign in, versus the feature does not exist here — and from
 * {@link PlaybackNotPermittedError} because being signed in and being able to
 * play are different axes (§14.3 rows 2 and 3).
 */
export class NotAuthorizedError extends ProviderError {
  override readonly _tag = 'NotAuthorized' as const

  constructor(
    readonly providerId: string,
    /** The `MusicProvider` member that was called. */
    readonly method: string,
  ) {
    super(`${providerId}: ${method}() needs a signed-in session`)
  }
}

/**
 * Playback was started on an account whose tier does not permit it.
 *
 * §14.3 row 3: free-tier Spotify is **(d) refuse** — browse-only, with
 * `Playback needs Spotify Premium.` on S13 — and §11.5 carries the Apple
 * equivalent. Browsing, search and the library all keep working, which is why
 * this is raised from `play()` alone rather than from every transport method.
 *
 * ⚑ Not a capability. `supports("transport")` is `true` on both providers; the
 * subscription tier is a property of the *session*, not of the service, so it
 * cannot be answered by a matrix that is the same for every user.
 */
export class PlaybackNotPermittedError extends ProviderError {
  override readonly _tag = 'PlaybackNotPermitted' as const

  constructor(readonly providerId: string) {
    super(`${providerId}: this account's tier does not permit playback`)
  }
}

/**
 * An `Artwork` value carries no usable source.
 *
 * `TrackRef.artwork` is optional precisely so that "there is no art" is
 * expressible without a malformed value. An `Artwork` that exists but has
 * neither a template nor any sizes came from a parse that should have rejected
 * it, so this is a defect in the adapter's edge, not a data condition.
 */
export class InvalidArtworkError extends ProviderError {
  override readonly _tag = 'InvalidArtwork' as const

  constructor(message: string) {
    super(message)
  }
}

/**
 * A string was asserted to be a `LocalKey` and is not a UUIDv7.
 *
 * The usual cause is a provider id leaking into a slot that pm-spec §14.5
 * reserves for our own key. The type system catches that at every call site
 * inside this repo; this is the runtime guard for values crossing an untyped
 * boundary — persisted state, a tool call, a URL.
 */
export class InvalidLocalKeyError extends ProviderError {
  override readonly _tag = 'InvalidLocalKey' as const

  constructor(readonly value: string) {
    super(`not a UUIDv7 local key: ${JSON.stringify(value)}`)
  }
}

/**
 * A relationship was requested from Apple and the response does not contain it.
 *
 * **This is the D-029 hazard and it is why the error exists as its own tag.**
 * Apple silently ignores an invalid `include` / `views` / `extend` parameter
 * and answers `200` with a payload that merely lacks the relationship. Read
 * naively that is indistinguishable from "this song genuinely has no station",
 * which is a plausible data condition — so a typo would present as an honest
 * empty result and would be believed.
 *
 * A requested-but-absent relationship therefore gets this error, and an
 * empty-but-present relationship gets an empty array. Never collapse the two.
 *
 * ⚑ `nameIsMeasured` is not decoration. For a relationship name we have
 * *measured* live, absence means exactly one thing: the request was not
 * honoured. For a name we have only from Apple's documentation — the surface
 * D-029 proved is not a reliable index of what exists — absence has two
 * candidate causes, and a message that names only the first would send a
 * reader hunting a request bug when the name itself may be wrong.
 */
export class RelationshipNotHonouredError extends ProviderError {
  override readonly _tag = 'RelationshipNotHonoured' as const

  constructor(
    /** The relationship name that was asked for. */
    readonly relationship: string,
    /** The resource id the request was made against, where known. */
    readonly resourceId: string | null,
    /**
     * Whether this name has been observed to exist against the live API.
     *
     * `false` for a documentation-only name, which widens the diagnosis.
     */
    readonly nameIsMeasured: boolean,
  ) {
    super(
      `relationship "${relationship}" was requested but is absent from the response` +
        (resourceId === null ? '' : ` for ${resourceId}`) +
        (nameIsMeasured
          ? ' — the request was not honoured; do not read this as "no data"'
          : ' — either the request was not honoured, or "' +
            relationship +
            '" is not a real relationship: this name comes from Apple\'s documentation and has ' +
            'never been measured. Do not read this as "no data". Settle it with a relationship-path ' +
            'GET and classifyRelationshipResponse — 40008 means the name is wrong'),
    )
  }
}

/**
 * A relationship name was used that this codebase does not recognise.
 *
 * Guards the same hazard from the other side: because a bad name returns `200`,
 * the only cheap defence against a typo is to refuse names that are not on a
 * known list before the request is built.
 */
export class RelationshipUnknownError extends ProviderError {
  override readonly _tag = 'RelationshipUnknown' as const

  constructor(readonly relationship: string) {
    super(`unknown relationship name: ${JSON.stringify(relationship)}`)
  }
}
