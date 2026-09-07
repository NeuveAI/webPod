# Review: 016 — Sticker interaction behavior

## Verdict: APPROVE

### Correctness Check

- Source of truth: repo AGENTS.md; scope.md criterion7/8; sticker-dispatch.md; decisions D1–D17; review-system-prompt.md; spec-research/interaction-research/native-evals; core approved behavior review; finalized diaries/stickers.md. Read the actual collection reveal/close/switch/lift handlers, interaction/return/spring owner, collection readiness model and serialized runtime place/expected-source contract. Current editor/domain helpers were read as canonical contracts; unrelated edge-wrap implementation was not reviewed or changed.
- Kanban ticket: none; repo has no board.
- Correctness target: nine sticker tools share real UI carry/origin/persistence, preserve ownership and saved state, reject unavailable/invalid actions, expose truthful readiness, and coordinate with the seven core mutations.
- Dispatch scope: new sticker definitions/adapter/tests, narrow mounted overlay callback registry, shared interaction animation lifecycle guard, global mount/shared lease. No protected editor/domain/mesh/server implementation changes attributed to this slice.
- Dependency/HITL status: core approved before sticker phase under D3. D14–D17 document names, wrapping/units, canonical validation, live UI/persistence ownership and truthful clock/percentage policy. No unresolved owner gate.
- Neuve HITL gate: not applicable; no Neuve shell or board per repo law.
- DoD checklist: independent sticker behavior lane complete. Final native rerun, full-repo check attribution and combined final handover remain lead-owned; this approval does not waive other concurrent work's failures.
- Review lanes: independent behavior/carry/persistence/readiness/lifecycle lane; separate sticker protocol/native lane is recorded elsewhere.
- Type/lint/doc gates: independent app tsc and scoped lint exit0. Public/lifecycle functions explain units, ownership and retained persistence lease. No new unjustified non-null assertions/type escapes remain in inspected files.
- Git history/staging: uncommitted by instruction; adapter/definitions/shared lease/mounted seam/guard and behavioral tests are a coherent group, with native fixtures and evidence separate.
- Verification evidence: exact independent checks below. Adapter tests use the actual Jotai state and canonical helpers with controlled mounted callbacks; UI callback wiring was inspected directly. No claim of a browser test personally executed in this lane. Native eval engineer separately exercises production route.
- Decision-log status: finalized sticker diary and D14–D17 consumed; all material implementation choices match dispatch and recorded decisions.

### Findings

- No open Critical or Major behavior findings.
- Resolved: synchronous cancellation during settling publication previously called persistence anyway. Recheck plus aborted-listener replay now rejects before save, discards transient draft and clears pending token; regression proves zero save calls.
- Resolved: late save completion after unmount could overwrite new operation state. Disposed-owner completion guard leaves new clocks untouched while the shared accepted-save lease survives until actual settlement.
- Resolved: ordinary inventory refresh cancelled unchanged carries. Relevant ownership/opened/source-pose/original-wear comparison now preserves valid holds and invalidates actual authority drift.
- Resolved: caller timeout/remount hid an outstanding save. Shared pending token and start time remain observable; retry is blocked until persistence settles, and caller abort never rolls back committed inventory.
- Resolved: passive detail selection appeared held and blocked grab; actual carry is distinguished. Front-face and human-gesture readiness are now explicit.
- Resolved: synchronous interruption could revive an old sticker animation. Animation and interaction generation checks protect intermediate, final animated and reduced-motion publication/completion.

### Verification evidence

Independently executed from `/Users/vinicius/code/webPod` after stable declaration:

1. `bun test packages/tools/src/stickers.test.ts packages/tools/src/interactions.test.ts apps/web/src/sticker-webmcp.test.ts apps/web/src/sticker-return.test.ts apps/web/src/sticker-motion.test.ts apps/web/src/sticker-collections-model.test.ts apps/web/src/sticker-runtime.test.ts` — exit0;55 pass,0 fail,345 assertions.
2. `bun test apps/web/src/sticker-interaction-lifecycle.test.ts` — exit0;3 pass,0 fail,5 assertions.
3. `bunx tsc --noEmit -p apps/web/tsconfig.json` — exit0.
4. `bunx eslint apps/web/src/sticker-webmcp.ts apps/web/src/sticker-webmcp.test.ts apps/web/src/sticker-collection.tsx apps/web/src/sticker-interaction.ts apps/web/src/sticker-return.test.ts apps/web/src/webmcp.ts packages/tools/src/stickers.ts packages/tools/src/stickers.test.ts packages/tools/src/interactions.ts packages/tools/src/index.ts` — exit0.
5. `bunx eslint apps/web/src/sticker-interaction-lifecycle.test.ts` — exit0.

Coverage: all nine definitions/input boundaries; common core/sticker lease and available reads; complete60-item catalogue with locked/sealed/earned/placed distinctions; opening without claiming; canonical draft rotation/wear/placement; exact placed origin and expectedSource preservation; release without writes; failure/retry; invalid silhouette; background refresh and source drift; passive selection; human/flip/unmount; pre- versus post-admission abort; real pending save across timeout/remount; nested spring publication cancellation. Existing runtime tests independently cover queued expected-source conflict, stale revisions, provider/session replacement and late reconciliation.

Reviewed git hash-object fingerprints:

- apps/web/src/sticker-webmcp.ts: `786a6f2648acf97f764ffbcc24739db44dcf44e2`
- apps/web/src/sticker-interaction.ts: `e51860b9ec1a6745f63bd874bbdff9de9a518023`
- apps/web/src/sticker-collection.tsx: `1fb1874ee0b8c3e60a57a48d74d9767c33a6f689`
- apps/web/src/webmcp.ts: `815820d076e36be529a717267ddae840662d199c`
- packages/tools/src/stickers.ts: `6b9abb59009735aca2f233db2d08284902722ab6`
- packages/tools/src/interactions.ts: `1bf323e45178dee638b9cf2a1173df13fde0a062`

### Suggestions (non-blocking)

- None. Earlier exact observations and reproductions retained in sticker-behavior-review-history.md.

### Neuve Dogfood Feedback

- Commands run: none; unavailable per AGENTS.md.
- Artifact refs: this review, prior review history, sticker diary and source/eval evidence.
- Kanban updates: not applicable.
- HITL gate: not applicable.
- Signal value: not applicable.
- Sticking points: none.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailability recorded here.
