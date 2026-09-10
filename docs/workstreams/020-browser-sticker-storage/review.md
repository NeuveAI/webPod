# Review: browser sticker storage

## Verdict: APPROVE

No open Critical or Major findings in production changes. Approval covers the scoped migration and independently verified checks below; it does not claim the unrelated repo-wide baseline suite is clean.

### Correctness Check

- Source of truth: AGENTS.md, user-approved browser-local SQLite worker ownership, scope.md. No cloud identity, deployment, or anti-tampering requirement added.
- Kanban ticket: not applicable; AGENTS.md explicitly has no board.
- Correctness target: durable browser-local collection; same earning/placement rules; production sticker flow independent of server database; bounded semantic backup restore and worker lifecycle.
- Dispatch scope: separate reviewer covers storage, integration, signing boundary, backup UI, existing CSS asset fix. No implementation edits.
- Dependency/HITL status: user approved local trust/data model. No additional provider, account, or deployment requested.
- Neuve HITL gate: unavailable by repo law; no Neuve shell.
- DoD checklist: core source review, lifecycle regressions, actual-route backup UI, final build-served asset and worker persistence checks passed. Extended migrated HUD and tactile browser suites also passed; reviewer inspected final test-only changes and emitted evidence.
- Review lanes: combined independent reviewer per dispatch; no additional reviewers spawned. Signing boundary, database/backup, worker lifecycle, UI integration reviewed.
- Type/lint/doc gates: independently ran app and engine tsc plus changed-source lint successfully. Public adapter, worker, transport, restore and metadata endpoint comments explain lifecycle/boundaries. One opaque adapter cast matches pinned Drizzle's SQL.js prepare/statement surface; real WASM raw-row and typed-query tests cover it.
- Git history/staging: no commit requested; extraction, worker, integration and verification remain separately stageable. Pre-existing CSS fix retained.
- Verification evidence: independent native/shared rules 27 pass/13,602 assertions; final runtime/Apple/WASM unit suite 19 pass/67 assertions; final production CSS/artwork smoke plus actual /webpod backup UI/restoration script 2 pass/145 assertions. Final production worker browser script independently passed reopen, two-tab revision conflict, same-worker alternating-tab pause/unpause, backup rollback/restore, queued cancellation and unavailable OPFS. Screenshot inspected: backup controls and invalid-file feedback readable, collection pack retained. Final source app/engine tsc and scoped eslint passed. Lead independently reports aggregate typecheck 13/13 and production build passed.
- Decision-log status: scope.md, engine-diary.md and integration-diary.md loaded; repo-wide docs/decisions.md and docs/platform_decisions.md absent. Other workstreams intentionally not consumed. Installed Drizzle 0.45.2 sql-js/session.js and SQLite WASM 3.53.4-build1 dist/index.mjs corroborate transaction/row adapter and SAH pause/unpause APIs. User-provided sqlite-wasm source also consulted.

### Findings

- [RESOLVED] Apple permission denial and spontaneous session loss cleared local inventory; preserving the snapshot alone could leave a cold pending read stuck. Shared disconnectStickerMusic now cancels old operations and restarts local restoration. Three cold-read interruption regressions independently passed.
- [RESOLVED] Retry retained a disposed worker and could fail forever until reload. Runtime now disposes/clears transport before retry; factory-recreation regression test passes.
- [RESOLVED] Backup UI byte limit differed from engine; limits now agree at 8 MiB.
- [RESOLVED] Backup track validator accepted impossible catalog IDs/durations and row cap could reject its own valid exports. Canonical numeric IDs, positive <=24-hour durations and byte-budget-compatible row limit now enforced.
- [RESOLVED] SQL.js adapter raw all() object path returned undefined rows. Adapter now maps column names and raw-query test passes.
- [RESOLVED] Apple metadata failures were reported as browser storage failures. They now persist importStatus=failed and retain collection access.
- [RESOLVED] Changed runtime lost listening/stale-publication coverage during rewrite. Worker enrichment, seek baseline, stop cleanup, and delayed-read reconciliation tests restored.
- [INFO] Legacy HUD reduced-motion assertion expected a rendered device despite unchanged capabilities.ts:502 forcing T4/no device. Independently reproduced canvas count 1→0 on fresh /webpod without sticker fixtures, verified identical HEAD source; test now separates transparency/contrast from reduced-motion data-persistence assertion. Existing pointer coverage retained; final test waits actual landing completion before the next pointer selection.
- [INFO] Repo-wide lint reports 309 errors in unchanged historical evidence scripts under other workstreams; changed-source lint passed. Log inspected at /tmp/webpod-browser-storage-lint.log. Those unrelated artifacts were not edited.
- [INFO] Unrelated aggregate baseline: apps/web/tests/production-device-view.test.ts:17 expects '/_spike/device', while HEAD and unchanged working apps/web/src/routes/[_]probe.composite.tsx:8 target '/webpod'. This is not introduced by sticker migration.

### Suggestions (non-blocking)

- No additional scope requested.

### Supplemental browser closeout

- Reviewed final evidence/hud-verification.json: passed=true; real OPFS-backed editor controls, injected 503/409 recovery, mobile touch and wear/reload checks; unchanged idle draw counter. Lead reports 4 tests/542 assertions, 33 seconds. Logged old placement HTTP paths are test-only worker fault/completion telemetry, not production persistence requests.
- Reviewed evidence/tactile-browser/browser-verification.json: passed=true; native mobile touch, pixel/reveal coverage, ownership isolation, local reload/reconnect, two injected save failures, workerFaultSeam=true; runtime route log uses stateless Apple requests. Lead reports 1 test/56 direct assertions plus Playwright checks, approximately 74 seconds.
- Final test-only fixes wait actual landing/reveal/orientation state, assert existing reduced-motion T4 policy, and respect existing logout landing redirect before returning to /webpod. No production behavior was weakened for testing, and pointer coverage remains.
- Source fingerprints differ between suites because the fingerprint includes apps/web/scripts and the test-only scripts changed between runs; production source remained unchanged after the independently verified final build. Lead reports final 13-project typecheck and changed-fixture lint passed. No new findings; APPROVE remains.

### Neuve Dogfood Feedback

- Commands run: none; repo explicitly lacks Neuve shell and board.
- Artifact refs: this file, scope.md, engine-diary.md, evidence/restoration.json and evidence/browser-local-backup.png.
- Kanban updates: not applicable.
- HITL gate: not applicable.
- Signal value: direct source/test evidence instead.
- Sticking points: database-drizzle, jotai-state, global-patterns reference ~/code/agent-context files absent locally. Review uses actual repository and installed pinned package source, plus user-provided sqlite-wasm reference.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: this section.

### Follow-up review: backup placement and signed-out retry

- Scope: move persistent backup banner into Settings disclosure and make failed sync actionable without an Apple session. Prior migration approval remains; follow-up verdict: APPROVE.
- Settings now renders a default-collapsed Sticker backups disclosure; backup controls removed from collection overlay. Existing storage/import/export rules unchanged.
- Failed sync uses the live provider session: signed-out action calls existing Apple authorization directly from the gesture, while authorized action retries import. Connecting disables duplicate authorization gesture.
- Runtime retry no longer reports successful sync after merely rereading failed/partial local state; it emits music_authorization_required while keeping loaded inventory usable.
- Resolved reviewer catch-path finding: generic collection run now recognizes music_authorization_required and preserves the successful local read without a save-failure message or return-to-sheet animation.
- Independent follow-up tests: runtime/import-status 23 pass, 65 assertions; final app typecheck and all follow-up scoped lint pass. Independently reran rebuilt Settings backup browser test: 1 pass, 4 direct assertions plus Playwright assertions, 4.3 seconds. Proves export/import inside Settings, hidden controls on main scene, invalid backup preservation, signed-out failed-import backup → explicit Sign in gesture → stateless metadata sync → warning cleared and pack retained. Inspected screenshots: Settings controls fit and main scene has no persistent backup banner. No open findings; no deployment or live user-session change performed by reviewer.
