# Independent persisted-session restoration review

## Verdict: APPROVE — restoration and narrow restart-test correction; historical readiness limitation retained

Read `session-restoration-scope.md` in full, direct-manipulation handover, current music startup/sticker runtime, state publication, Start inventory route and server session/HTTP/live services. Existing direct-manipulation approval did not prove this startup dependency. Reviewer owns documentation/review only; implementation and native browser/build resources remain with the collection engineer until freeze and handoff.

Reuse the loaded strict-critique, runtime-review, global/Jotai, Effect/Drizzle/Start domain guidance and canonical local resources. Installed source remains authority where reference versions differ. No visual redesign is needed; any changed UI still receives Interface Craft/Guardrails review. No live owner browser, secrets, encrypted Pencil file or unrelated workstream is accessed.

## Authority and proposed ordering

Current `selectMusicRuntime` clears sticker runtime, waits for MusicKit configure and progressive navigation source, then starts sticker bootstrap. `startStickerRuntime` clears again and publishes only after POST/session returns. That POST verifies/imports Apple data before activation/publication. Thus a valid saved database inventory can remain invisible behind unnecessary upstream work.

Existing GET/api/stickers already reads `repository.inventory(owner)` through the session-authorized transaction. `sessions.resolve` checks expiration and device generation; `sessions.authorized` rechecks the lease synchronously with the read. Device recovery alone confers no inventory access. `sessions.begin` does not invalidate an existing valid session while importing; explicit revoke advances generation and deletes its sessions. An app-only DB-first hydration is therefore a sound minimal direction if its client lifecycle preserves these boundaries.

An early validated GET may start before MusicKit configuration, because native session authority is the server cookie, not a client identity assertion. Necessary session validation and image preparation remain real prerequisites. MusicKit sign-out/provider replacement cannot leave previously loaded ownership active. A same-operation authorized handoff must preserve hydrated inventory and interaction; a different operation must not accidentally inherit the preservation exemption.

## Blocking pitfalls to resolve before freeze

- **Out-of-order inventory publication:** current `publish` accepts every same-generation response. A delayed hydration GET or background POST may arrive after placement/open-pack writes and regress placement revision/coordinates or opened state. Use an explicit monotonic/reconciliation strategy with validated types, preserving newly earned content without resurrecting stale layout. Test delayed GET and background import snapshots against newer mutations.
- **Session-generation isolation:** logout/replacement during hydration, credential callback or import must cancel relevant work and reject late publications. Distinguish native401/403 authority loss, which must clear inaccessible collection state, from Apple/library failure under a still-valid session, which must retain it. Do not treat all failures as cached success or all failures as sign-out.
- **Background ownership:** one active restoration/enrichment per runtime operation; retries deduplicate rather than overlap. Cleanup must release subscriptions/abort controllers and invalidate continuations. Preserve existing bounded listening credit and ensure it can start from a valid restored session without waiting for stalled enrichment, once the music provider is authorized.
- **Refresh honesty:** document when import runs and how a failed import retries. It must not reset saved placement, pack opening, selection or carry merely to set a loading flag. Successful background additions can update access without replacing the current interaction or waiting for all collections' art.
- **Actual music startup:** prove the early GET is invoked before the configure/source wait in the real startup path, not only by calling a new helper directly in tests. Configure failure/null session and user-driven authorization failure need explicit outcomes and no dangling preserved runtime.

These were sent to implementer/lead before source edits/freeze. They are adversarial acceptance constraints, not final findings against unfinished code.

## Independent proof plan

| Case | Required evidence |
| --- | --- |
| Valid persisted session, stalled Apple ingestion | Native Start/cookie/tempSQLite reload with existing earned/opened sticker and placement. Inventory GET and actual painted saved print must complete before releasing upstream work. Assert placement identity/pose and usable interaction, not only inventory JSON. |
| Upstream failure and later success | Persisted print remains painted and movable while ingestion fails. Explicit retry succeeds/adds access without losing the current placement revision, open pack or held interaction. |
| First registration and invalid sessions | No fabricated inventory before authentication. Expired/revoked/absent session cannot restore old data; original registration and reconnect remain functional. |
| Cancellation/isolation | Delayed GET/import resolves after logout or provider-operation replacement: no stale state/credit/subscription revival. Same-operation authorization transition preserves already restored content. |
| Revision races | Delayed hydration/background result versus a successful move/remove/open-pack;409 reconciliation remains authoritative and newer placement revision cannot move backward. |
| Bounded background work | Concurrent retries share/cancel one import; old completion cannot clear the new operation's in-flight owner. No unbounded polling or new process/service. |

After freeze, independently inspect source/tests and fingerprint; run relevant runtime/service regressions, changed-package types, scoped lint and native restored-session flow. Canonical startup/client-boundary gate is required if routing/server glue changes and remains available when startup wiring changes warrant it. Evidence belongs under `evidence/session-restoration/reviewer*`. No competing browser/build before the owner's handoff. Final approval requires no unresolved Major/Critical finding, truthful native painted-output evidence, and recorded limitations; lead owns commits and clean-worktree verification.

## Early source checkpoint — tests in progress

Read current app-only changes without running browser/builds. GET restoration now starts before `provider.configure`; authorized attachment precedes progressive navigation source work and preserves the same provider's hydrated inventory. Background connection awaits the inexpensive restoration rather than blocking it. The local connecting promise deduplicates explicit/periodic attempts, with a documented fifteen-minute visible refresh and overdue visibility-return check; teardown removes timer/listener/subscriptions and aborts its generation.

Publication now tracks a counter in addition to placement revision and rereads the database at most three times when other publications intervene. This addresses same-revision pack-opening races that revision-only comparison would miss. Sustained writes retain the newer visible snapshot instead of forcing stale data; final tests must prove the success callback and later refresh behavior when that bound is reached.

One authority question was sent to implementer/lead before freeze: early restoration currently has no provider-session listener until authorized attachment. `music-runtime.ts:175` confirmed-null session and`:203–205` permission-denied paths return without cancelling the pending GET, so native valid inventory can publish after music UI says signed out. A temporary configure/upstream failure should not silently destroy valid persisted inventory; confirmed explicit logout must. The engineer must document the distinction between MusicKit availability and native session authority and test chosen outcomes, rather than accidentally inheriting them from missing teardown. Explicit `signOutAppleRuntime` already revokes/cancels and is not alleged broken. Final verdict remains pending.


## Independent frozen-source verification

Reviewed source fingerprint `57a57f92119dae7590598c619cd550c35cb81cfc0d32083da0b8623060046743` (381 files), independently recomputed after validation. The preceding contract/checkpoint records the actual chronology; it is not the final implementation description.

The authority question is resolved in the frozen code. `music-runtime.ts:170` and`:197` start validated restoration before SDK configuration. Successful configuration followed by confirmed null session (`:175`), explicit permission denial (`:203–205`), explicit logout, and observed authorization loss cancel/revoke. A transient configuration/network exception retains the still-valid native collection. The early provider listener at `sticker-runtime.ts:65` distinguishes initial uncertainty from an observed authorization loss; the authorized listener at`:106` and generation/abort teardown at`:136–145` prevent old identity publication. This matches the provider's concrete SDK events and the lead's recorded authority decision.

Publication reconciliation at `sticker-runtime.ts:41–49` checks both placement revision and intervening publications, including same-revision pack opening. At most three additional authoritative reads are attempted; under sustained interleaving, the newer visible snapshot is retained. Background connection at`:111–132` waits for restoration, attaches listening once valid inventory exists, deduplicates import, and owns one fifteen-minute visible refresh timer plus overdue visibility-return check. Cleanup releases all those owners. No server authority, schema, identity or routing framework was changed. No remaining Major/Critical restoration-source defect was found.

| Requirement | Independent result |
| --- | --- |
| Persisted earned/opened/placed data before upstream work | PASS. Native Start, real cookies and temporary SQLite; saved Soundcheck is actually painted before the held SDK configuration gate releases and while Apple import remains held. |
| Background enrichment preserves customization | PASS. Real listening requests add access; releasing import preserves saved placement, revision and the opened pack, showing 2 OF 5. Failure/retry retains the saved print. |
| Transient failure versus authority loss | PASS. Native transient SDK failure retains the validated rear; successful SDK configuration reporting unauthorized revokes the native session and clears collection controls. Runtime/service tests also cover generation isolation, missing/revoked sessions and late responses. |
| Publication races and bounded lifetime | PASS. Deterministic delayed GET/import versus newer placement and same-revision pack opening, retry deduplication, teardown and existing409 reconciliation cases passed. |
| Canonical shipped development startup | NOT PASSED. Root reaches final navigation after config-helper restart but aborts; app stalls before initial readiness. Diagnosis remains required before full approval. |

Own evidence is under `evidence/session-restoration/reviewer/`: `native.log` records 1 test / 85 assertions, 26.92s; `source-tests.log` records 49 tests / 219 assertions, 2.09s across runtime/music/live service/session suites. App TypeScript and scoped ESLint passed (`types.log`, `lint.log`), as did whitespace validation. The native metadata matches the frozen fingerprint. The integration harness uses synthetic SDK/upstream services with native application endpoints and a temporary real database, not browser inventory/placement interception or an owner's live account.

Independently inspected all five fresh reviewer captures: `cold-valid-cookie-before-musickit.png`, `restored-while-apple-import-held.png`, `background-access-added-with-placement-intact.png`, `reload-with-failed-ingestion.png`, and `transient-musickit-failure-keeps-validated-rear.png`. The central Soundcheck artwork is visibly painted in the blocked and failed states; the access addition preserves its pose. These are desktop Chromium captures, not a physical Safari claim. No visual redesign or unrelated material acceptance is inferred from this bounded bugfix.

## Blocking validation result

`startup.log` preserves the failing independent canonical run: 1 pass, 2 failures, 1,025 assertions, 99.27s. The root case rendered both product routes and passed client/server boundary, CSS HMR and config/helper-header checks, then `page.goto` at `apps/web/scripts/dev-startup.integration.test.ts:113` failed with `net::ERR_ABORTED` after the imported-helper restart (42.23s). The app case failed initial readiness at`:54`; after the 45-second readiness bound its child was still alive with only the shipped Bun/Vite runner command in the captured output (56.54s including cleanup). Neither failure proves that restoration code caused it; neither is waived by the passing production flow. No cleanup failure was reported, the runner ended, and the exclusive browser/build slot was released for bounded diagnosis.

“Immediately” here means after native lease validation and necessary artwork/render readiness, without waiting for MusicKit or Apple ingestion. Expired/new sessions still require normal authorization. Background work is browser-lifecycle owned, not a server daemon; uninterrupted writes can defer new access until a later refresh after bounded reconciliation. Commits and final clean-worktree verification remain the lead's responsibility. Full verdict stays REQUEST_CHANGES until the canonical failure is explained and the required gate is satisfied on matching source.


### Startup diagnosis checkpoint

Pinned Vite client source confirms a reconnect-triggered reload can race explicit navigation, but it does not guarantee every config change produces that reload. A first harness-only correction waiting for an automatic main-frame response was source-reviewed as a plausible synchronization, then falsified by the engineer’s combined run: the app automatic-reload wait failed, and root initial readiness also failed. This candidate is not accepted evidence. An isolated unchanged app pass and an active Tailwind/Rolldown sample from that passing run do not establish the cause of the original readiness failure. The gate remains unresolved; bounded diagnosis and a narrower navigation correction are in progress.


## Final independent gate and resolution

Final reviewed fingerprint: `c11bd0eee34d0f42feba78e3a37b558a7184f40168011100d4e7dfefe9b2fde4` / 381 files, independently recomputed after the final run. The prior REQUEST_CHANGES checkpoints and failed logs above remain historical evidence, not the final verdict.

The final harness correction at `apps/web/scripts/dev-startup.integration.test.ts:113–123` restores explicit navigation after the helper header changes, permits exactly one retry only for an Error containing `net::ERR_ABORTED`, and propagates every other error and any second abort. It adds a 200-document assertion and preserves the original T1 rendering, application-error, client-boundary and server-error checks. No readiness timeout, config timeout or application behavior changed. This is bounded synchronization with the observed pinned-Vite reconnect race; it does not conceal an initial startup failure or assume an automatic reload always occurs. Independent scoped ESLint passed for the changed harness.

The single independent full run on this final candidate passed **3 tests / 2,051 assertions in 92.27s**: canonical root 43.58s and app 48.09s. See `evidence/session-restoration/reviewer/startup-final.log`. Both launchers exercised the actual shipped commands, both product routes, SQLite transport, browser/server isolation, CSS HMR, main-config refresh, imported-helper refresh and final rendered T1 device. The process exited 0 with no cleanup error; the exclusive resource slot was released to the lead.

`pre-startup-correction-files.json` and `harness-only-provenance.json` record the independent 381-file comparison from native-tested 57a57 to final c11bd0: **only the development startup integration test changed**. All product, asset, dependency, build-configuration and native-restoration-test bytes are identical. Therefore the independently inspected 85-assertion restoration flow and 49-test/219-assertion runtime/service results remain applicable without a redundant product rebuild/native rerun. App types and relevant lint previously passed on those unchanged inputs.

No remaining Major/Critical restoration-source or bounded restart-harness finding was identified. The persisted-session requirement is approved with the lease/readiness, browser-lifecycle and bounded-reconciliation limits above. **The historical intermittent initial 45-second readiness failures remain unexplained and are not claimed fixed.** An isolated passing process sample showed active Tailwind/Rolldown work and another diagnostic found Vite already serving; neither samples the original failed process or proves contention. The final successful canonical run satisfies this review gate but is not proof that startup intermittency can never recur. Failed original and automatic-reload-candidate runs remain preserved for future diagnosis.

Lead commit hashes, final root sanity and final clean-worktree confirmation are pending; this reviewer has made no implementation edits or commits.
