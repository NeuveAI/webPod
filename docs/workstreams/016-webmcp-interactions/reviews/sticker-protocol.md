# Review: 016 — Sticker WebMCP protocol and lifecycle

## Verdict: APPROVE

### Correctness Check

- Source of truth: AGENTS, scope criterion 7/8, sticker-dispatch, decisions D1–D17, review-system-prompt, source packet, updated native-evals and final sticker diary/check evidence. Current native API authority remains local `webmcp/index.bs` revision `7b3f50f31848b529e69bedbbdf8da0edccba055f`, matching September 4 official draft. Relevant strict-review/Jotai/global instructions loaded in this reviewer task; existing core protocol approval retained.
- Kanban ticket: none; workstream directory is the tracker per repo law. Repo-wide decision files remain absent; no unrelated workstream reviewed.
- Correctness target: nine new native tool definitions, runtime validation, annotations/result serialization, live UI mount, shared core/sticker mutation ownership, cancellation and save/remount lifetime. Behavior lane separately owns physical carry, origin restoration, spring publication and domain integration.
- Dispatch scope: packages/tools sticker definitions/tests and shared mutation seam; sticker-webmcp adapter/tests, webmcp mounting, narrow collection registry; native fixture/helper/e2e changes. No protected concurrent edge-wrap implementation edited by reviewer.
- Dependency/HITL status: core lanes approved before stickers; D14–D17 now record concrete interface/ownership choices. No new HITL issue in this lane.
- Neuve HITL gate: not applicable; no board/shell per repo law.
- DoD checklist: protocol lane complete. Final workstream closure still needs the refreshed native run after latest lifecycle patches, behavior approval and broad-check attribution; this lane does not replace those gates.
- Review lanes: sticker protocol here; sticker behavior independent. Core protocol remains approved after shared mutation regression checks.
- Type/lint/doc gates: independently rerun after latest adapter lease patch; all scoped gates passed. Major boundary/lifecycle functions have useful comments; no unchecked domain casts or lint suppressions added. Test timeout injection changes only caller wait duration.
- Git history/staging: uncommitted D6; diary retains coherent sticker adapters/shared seam/tests, native fixtures and evidence groups.
- Verification evidence: `bun test packages/tools apps/web/src/sticker-webmcp.test.ts`: **31 pass, 0 fail, 208 assertions**. `bunx tsc --noEmit -p apps/web/tsconfig.json`: exit 0. `bunx tsc --noEmit -p packages/tools/tsconfig.json`: exit 0. `bunx eslint packages/tools/src apps/web/src/webmcp.ts apps/web/src/sticker-webmcp.ts apps/web/src/sticker-webmcp.test.ts apps/web/src/sticker-collection.tsx apps/web/tests/webmcp-native.e2e.ts apps/web/tests/webmcp-native-stickers.ts`: exit 0. An initial reviewer lint invocation used a nonexistent helper filename and was corrected; this was not a source failure.
- Decision-log status: D14 names/wrapping/no claim, D15 normalized coordinates and current domain constraints, D16 bounded caller wait versus accepted-save lifetime, D17 nested real sticker readiness all checked against implementation.

### Findings

- [INFO] No open Critical/Major protocol findings. The nine definitions reuse the reviewed current-draft registration helper; all sixteen production tools share one mutation lease. Only catalogue read is read-only among sticker tools. Runtime validation rejects extra/missing properties, invalid identifiers/enums, nonfinite numbers and stated ranges before adapter actions. Catalogue identity/authority and physical placement validity are checked at the live adapter.
- [INFO] Cancellation does not pretend to roll back accepted persistence. Before admission the adapter rechecks cancellation/generation after synchronous publication. After admission a bounded caller return can reject while actual save token/start clock remain until real settlement. Remount retains truthful pending state and blocks another sticker write. Final cleanup compares token ownership; disposed owners cannot publish a new operation result. Independently exercised pending abort, timeout/remount, old-completion isolation and cross-family lease tests.
- [INFO] Native test evidence uses the real production route/registry and existing network seam. All sixteen names are exercised across 11 core + 13 sticker authored smoke calls; every expected result is explicitly checked using upstream matcher, with negative controls. The external CLI's result-discarding limitation remains honestly documented. Current 11/11 recorded snapshot `aa604bd3...` precedes latest lifecycle patches and is not treated as final-source proof here; lead must refresh it before workstream completion.
- [INFO] Broader implementer check reports one protected concurrent legacy bounds expectation (`packages/state/src/stickers.test.ts:18`). This lane did not change that test or domain policy; it is separately attributed in sticker-checks and left to its owner/lead, not counted as a protocol failure.

### Suggestions (non-blocking)

- None.

### Neuve Dogfood Feedback

- Commands run: none; Neuve unavailable under repository instructions.
- Artifact refs: this review, sticker diary/checks, native-evals.
- Kanban updates and HITL gate: not applicable.
- Signal value, sticking points, format feedback, backlog signals, feedback artifact: not applicable without a Neuve runtime.

### Reviewed source identity

- packages/tools/src/stickers.ts: `0ce921981cc6c768014d13c2186ff5b743b8f2faf895bba82826f97eb8f69037`
- packages/tools/src/interactions.ts: `f6fcf97698c68d46e43ad070e379631fd656f31bd3b6f70a072143705a436e34`
- apps/web/src/sticker-webmcp.ts: `02d51a16adc5d6af967d003a25ed1a9f1e4c67ec260bfb9f6438b7b567f2d6fc`
- apps/web/src/webmcp.ts: `0955d8f676621e242c2d941fea3bcc28733622ddb4d43c54ef29e3f3689159af`
- apps/web/src/sticker-collection.tsx: `de20d76ceea8ca97e766881e91cbefcbe2f911072a676b41fffa33834f077829`
