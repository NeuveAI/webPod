# Persisted collection restoration

Status: Ready for bounded implementation after the engineer reports the dependency and exact file ownership. The owner explicitly requires earned stickers and saved placements on the next authenticated load without waiting for another Apple import. Existing direct manipulation approval did not prove this startup contract.

## Correctness and authority

A valid registered session reads its authoritative SQLite inventory immediately after session validation. Apple library/recent-history ingestion cannot be on that read's critical path. Existing earned/placed content remains available while background enrichment runs, times out or fails; successful enrichment may add access without resetting placement or interaction. Initial registration can start empty and later receive its first grant. Session validation and necessary image decoding remain real prerequisites; “immediate” means no avoidable upstream import wait, not zero network/render time.

The owner's latest request is primary; AGENTS.md, native session/database contracts and installed sources are supporting authority. Old synchronous bootstrap behavior and passing previous reload tests are anti-sources when they hide this dependency. No new identity scheme, authentication bypass, economics, schema redesign or visual redesign is authorized. No questions are pending: use the existing valid session and persisted device mapping.

## Dispatch and dependencies

Collection engineer owns the minimal app/runtime/server/test changes identified by investigation, then implementation and evidence. Lead owns this scope and final handover; independent tactile runtime reviewer owns review only. Investigator reports exact scope before source edits. Reviewer can inspect existing lifecycle and write adversarial acceptance checks in parallel, then independently validate the frozen candidate. One native browser/build owner at a time. No profiling or unrelated flick changes required.

Read direct-manipulation-handover.md, current sticker runtime/music startup, native Start session/inventory routes and their server services. Ground new behavior in /Users/vinicius/code/.better-coding-agents/resources plus installed Effect, TanStack Start, Jotai and Drizzle versions. Reuse global-patterns, team-orchestration and strict-critique; use effect-services/database-drizzle/tanstack-router for touched layers. Any UI work requires Modern Web Guidance first, interface-craft and interface-design-guardrails; animation changes require neuve-motion. Repo law overrides Neuve/Kanban instructions: neither exists here.

## Required proof and gates

- Seed a valid session with earned/opened inventory and saved placement. Reload the actual product route while Apple ingestion is deliberately stalled. Confirm owned inventory and actual painted placement before releasing upstream work.
- Repeat with failed ingestion: persisted content stays usable. Release a successful enrichment and verify added access without losing existing placement/revision or resetting interaction.
- Verify initial registration, valid cookie restoration, expired/revoked session, logout/provider replacement during pending hydration/import and late old-session responses. No old user content or token may leak across generations.
- Background work must be bounded, cancellable on teardown and deduplicated; use existing listening enrichment and a documented refresh policy, never overlapping unbounded imports or token storage/logging. Failed enrichment is retryable without clearing inventory.
- Deterministic runtime/service tests establish ordering and failures; native Start/cookie/temp-SQLite browser checks establish real reload and painted output. Synthetic trusted Apple/signing inputs are acceptable, browser interception of placement/session routes is not. The owner's live tab and credentials remain untouched.
- Run changed-package typechecks, scoped lint including new files, relevant runtime/server tests, native reload checks and git diff --check. Run canonical startup boundary regression if server glue changes. Document public lifecycle invariants and use validated canonical types; no useState or unexplained casts/ignores.

## Artifacts and completion

Engineer diary/decision log: diaries/session-restoration.md. Evidence: evidence/session-restoration/ with commands, results, native screenshots and source fingerprint. Independent review: reviews/session-restoration-review.md. Lead handover: session-restoration-handover.md. All paths are relative to this workstream.

No secrets, cert contents, environment contents or actual auth tokens enter any artifact. Do not change the owner's running server or authenticated browser session. No .pen edits needed. Routine ordering/cancellation choices can proceed with rationale in the diary; identity/security-policy changes require returning to the lead.

Done requires the stalled-import reload proof, regression gates, independent approval with no unresolved Major/Critical finding, accurate limits and evidence, granular commits and a clean worktree. Commit runtime/server restoration and coupled tests coherently; commit review/evidence/docs separately. User previously authorized commits; no push. Physical Safari and account-specific upstream correctness are not certified by synthetic tests.

## Investigation and approved direction

The engineer traced the wait to music-runtime startup (MusicKit configuration and progressive source setup) followed by sticker bootstrap POST/session, which normally awaits Apple verification/import before inventory publication. Existing GET/api/stickers validates the session and reads SQLite without Apple. Approved app-only first approach: use that read for early validated restoration, preserve it across same-runtime authorization handoff and run current session ingestion in the background. Keep new-session server authentication intact. Reviewer must independently check logout/revocation and late-generation isolation; this finding does not authorize trusting cached client identity.

## Session authority and background cadence decisions

A native server-validated session can restore owned collection during transient MusicKit configuration/network failure. Explicit logout, provider replacement and definitive denied/unauthorized transitions cancel pending restoration and clear prior content. Unknown/loading/null must be interpreted using the provider contract, not assumed to be a logout. The engineer and reviewer must test the actual mapping.

Chosen passive policy: one deduplicated initial/retry import, then every 15 visible minutes and on return to an overdue tab; existing measured listening updates remain active. Teardown owns interval/listener/fetch cancellation. This avoids re-ingesting on every render or listening heartbeat while allowing library changes to contribute within a long-lived session.

## Canonical startup gate follow-up

Independent restoration checks passed, but canonical startup initially produced two failures: navigation aborted around root config-helper restart, and app readiness timed out before Vite was ready. Those failures remain in reviewer/startup.log. An isolated app rerun subsequently passed without source or timeout changes; the original app timeout's cause is unproven and must not be labeled proven contention.

The startup engineer traced a root harness race to pinned Vite's independent location.reload after restart reconnection overlapping the test's page.goto. Authorized scope extension: narrowly synchronize restart navigation or bound recovery for that specific interrupted navigation while retaining actual route/readiness assertions. No global timeout inflation or suppression of application errors. Startup engineer owns only the identified harness/test files; independent reviewer must inspect and rerun the canonical checks. Record new source fingerprint and explain any proof reused because only harness files changed.

## Final disposition

Independent review approves the restoration and narrow restart-test correction. Native restoration85 assertions; source49 tests/219 assertions; final canonical startup3 tests/2,051 assertions; app types/lint and lead root12/12 typechecks passed. The automatic-reload-wait attempt was rejected by actual execution, replaced by a single bounded ERR_ABORTED-only retry. Intermittent initial-readiness timeouts remain unexplained and are documented, not claimed fixed.

Final source `c11bd0eee34d0f42feba78e3a37b558a7184f40168011100d4e7dfefe9b2fde4` /381 differs from native-tested57a57 only in the startup test, proven by reviewer per-file manifest. Source commits `e6b8383` and `fbfc14d`; evidence/docs commit follows. No remaining restoration blocker.
