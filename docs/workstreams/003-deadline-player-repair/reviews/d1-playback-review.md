# D1 independent review — playback/data truth

**Reviewed:** 2026-09-03; corrections re-reviewed 2026-09-03
**Reviewer:** `/root/d1_playback_review`
**Verdict:** **APPROVE**
**Open counts:** 0 Critical, 0 Major, 0 Minor
**Initial verdict:** REQUEST_CHANGES — 0 Critical, 2 Major, 0 Minor

## Correction re-review

Both initial Major findings are resolved.

- The panel now retains the selected occurrence until the play request has resolved and provider state reports the requested queue position. An independent mounted replay of `[A, B, A]` held `3 of 3`, `aria-busy="true"`, and `Preparing playback…` both before resolution and after stale first-occurrence state was republished. Only publishing queue index `2` cleared busy state. The relevant guard and retained-position rendering are at `packages/panel/src/Panel.tsx:428-456` and `packages/panel/src/Panel.tsx:507-512`.
- Prepared reuse now validates the observable queue/container and start position. Invalidation clears both completed and in-flight identities; provider-owned queue/order mutations serialize behind accepted preparation. Independently replaying `prepare(A) -> stationStart(station-x) -> play(A)` produced track, station, then a fresh track descriptor. Holding the first preparation unresolved also kept station mutation behind it and still forced the final track descriptor. The relevant validation/invalidation and mutation boundaries are at `packages/providers/src/apple/apple-provider.ts:217-242`, `packages/providers/src/apple/apple-provider.ts:293-298`, and `packages/providers/src/apple/apple-provider.ts:409-517`.

The correction pass introduced no new Critical, Major, or Minor finding. Exact duplicate confirmation intentionally remains pending when a provider withholds queue position instead of guessing an occurrence. Public MusicKit work already accepted by the SDK remains physically uncancellable; generation invalidation and serialization prevent its result from being reused as a current prepared identity.

## Initial findings — resolved

### Resolved Major — a pre-existing copy of the selected catalog song falsely confirms a new occurrence

`packages/panel/src/Panel.tsx:422-438` treats provider/catalog identity as sufficient confirmation of the newly selected attempt. It then clears the attempt as soon as the provider is not `loading`. `packages/panel/src/Panel.tsx:534-540` also accepts the provider's old queue index whenever the item at that index has the same provider/catalog identity. Neither check establishes that an authoritative transition belongs to the new selection transaction.

This breaks the exact-occurrence and honest-pending contracts when the same song occurs more than once or the user reselects the currently reported song. A focused mounted-panel falsification used a queue `[A, B, A]`, an existing provider snapshot at the first `A`, a new center-button selection of the third `A`, and a deliberately unresolved `play()` promise. The rendered result was `1 of 3`, `aria-busy="false"`, and no pending status; the requested occurrence was `3 of 3` and its transport had not settled.

The current tests prove duplicate handling only after the fixture provider has already synchronously replaced its queue/index. They do not cover an old same-catalog snapshot or a same-catalog stale MusicKit event during a new selection. Keep the retained occurrence authoritative until a post-request provider transition can be associated with the new transaction; catalog equality alone cannot do that.

### Resolved Major — prepared-queue reuse survives unrelated queue mutation and can play the wrong queue

`packages/providers/src/apple/apple-provider.ts:407` records only the target intent key after `setQueue()`. The key is not invalidated by `queueItemsDidChange` (`packages/providers/src/apple/apple-provider.ts:265-278`) or by the provider's other queue-changing commands (`packages/providers/src/apple/apple-provider.ts:481-483`). Consequently, `packages/providers/src/apple/apple-provider.ts:459-463` skips `setQueue()` whenever the old intent key matches, without proving the actual MusicKit queue is still compatible.

A focused provider falsification ran `prepare(A)`, then `stationStart(station-x)`, then `play(A)`. Recorded queue descriptors were only `[{ songs: ['a'], startPosition: 0 }, { station: 'station-x' }]`; the final `play(A)` issued no track descriptor and therefore played the station queue. The same stale-reuse class applies to append/insert or external queue changes.

Invalidate prepared state on every non-preparation queue mutation and validate the actual queue/container/start position before reuse. Add a deterministic regression covering preparation followed by a different queue mutation and then selection of the originally prepared target.

## Falsification coverage

- Exactly 699/700 ms: helper tests pass and source schedules exactly `700` ms.
- Selection/route cleanup and duplicate colourway leases: helper tests pass; cleanup aborts the active signal.
- Active and paused item protection: provider checks both derived status and current item; existing focused tests pass.
- Pending, rejected, timed-out, and provider-error metadata: focused tests pass for distinct tracks and errors; the corrected same-catalog occurrence replay also passes.
- Artwork boundary: dwell artwork uses the same-origin `/artwork` URL and low fetch priority; no raw provider artwork or protected media is fetched by the new panel path.
- MusicKit boundary: preparation uses only public `setQueue`; no private method, manifest, segment, license, blob URL, or exact buffered-seconds claim was introduced.
- Jotai/cleanup boundary: no `useState` was introduced; panel attempt state is in the shared store and subscriptions/timers return cleanup functions.
- Credential boundary: the built client contains no signing configuration names, private-key markers, filesystem APIs, or Bun file APIs.

## Verification rerun

- D1 correction-focused tests: 162 pass, 0 fail, 483 assertions.
- Independent duplicate-occurrence counterexample: retained `3 of 3` and pending through stale resolution; cleared only at exact queue index.
- Independent completed and in-flight queue-mutation counterexamples: both emitted a fresh target descriptor after the unrelated station descriptor.
- The implementer's recorded full suite after corrections: 1,242 pass, 0 fail, 78,437 assertions.
- Workspace TypeScript: 11/11 projects clean.
- ESLint: clean.
- Production client and server builds: clean.
- Built-client credential-boundary scan: clean.
- `git diff --check`: clean.

The D1 lane clears independent review with zero open Critical and zero open Major findings. Real-account playback and artwork behavior remain owner-run validation gates under the workstream scope.
