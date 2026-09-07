# Core implementation diary

Owner: core_implementer. Scope and decisions read before writes. Applied global-patterns/Jotai/modern-web-guidance, existing physical-motion and React patterns. Canonical WebMCP source read directly at local index.bs revision7b3f50f; source packet types analysis adopted. No sticker implementation or production-device-view edits.

## Implemented surfaces

- `packages/tools`: current draft document registration, native registration AbortSignal rollback/disposal, execution signal composition, strict runtime validation, seven core tools, full-list status, paced acceleration (350ms down to200ms, no catch-up), global mutation ownership and observable progress.
- `packages/composite`: mounted controller registry; shared physical press semantics and provider transport; agent provenance; actual physics press/release and contact audio; separate center/wheel ownership generations protect same- and cross-channel human interruption; mount/input/caller cancellation and30s transport bound.
- `packages/state`: agent clicker feedback enabled per D1, system silence and human-only vibration preserved. Legacy tests updated to explicit owner requirement.
- `packages/panel`: shared read-only readiness snapshot observes navigation intent/loading shell, playback loading independently of presentation, queue/scrub activity and errors. Clock stores real observed operation transitions, selection start and completed time; unknown initial/provider-replacement start stays null, no fabricated percent.
- `apps/web/src/webmcp.ts` and device-page: native feature-detected production mount against singleton device store; live orientation controls supplied by separate orientation implementer.
- Workspace package edges and matching bun.lock entries. Plain `bun install` hit existing minimum release age constraints for unrelated locked dependencies; workspace-only lock metadata was aligned, then `bun install --frozen-lockfile` succeeded without third-party version changes.

## Verification in progress

First focused tools/clock suite:15 passed,103 assertions. Broader original suite caught superseded silent-agent expectations; updated those and retained system/provenance protections. Added mounted physical contact and readiness episode regressions following reviewer feedback. Final checks and exact commands are recorded in `evidence/core-checks.txt` once complete. Full lint currently reports historical evidence scripts in unrelated workstreams; no source-file lint errors shown so far.

Review fixes are ongoing; this diary is an interim checkpoint, not a claim of approval. Protocol modules stable for review; physical/readiness integration tests now finishing.

## Commit grouping (uncommitted)

1. Shared feedback, physical input and panel readiness with behavioral tests.
2. Native tool registration, tools, production mount, workspace edges and contract tests.
3. Orientation seam and regressions (separate implementer).
4. Native eval fixtures and evidence (separate eval agent), then workstream documentation.

## Final core checkpoint

Core focused verification:51 tests pass,366 assertions. All12 projects typecheck, explicit app tsc, production build and changed-source lint pass. Exact fingerprint and logs are in `evidence/core-checks.txt`. Native6/6 and upstream smoke evidence was produced by the evaluator and is being refreshed against this final source. Broad test run has one concurrent sticker edge-wrap expectation failure, which this slice does not edit; precise final run appended to evidence. Full repository lint fails in historical evidence scripts belonging to other workstreams; affected paths captured.

Resolved independent reviewer findings with mounted tests: channel-specific ownership preserves a replacement human contact and releases a different abandoned channel; both channels return to rest. Page clocks begin fresh on subsequent buffering episodes, and replacement providers do not inherit earlier starts. Readiness subscriptions are refcounted for multiple mounted panels. Pending registration disposal/remount cannot overwrite a newer navigation progress owner. A blocked select returns an actionable error.

Core source is stable for final non-sticker approval. No commits or pushes made. Remaining work is the deferred sticker slice and final full-surface review/eval, owned by the lead.
