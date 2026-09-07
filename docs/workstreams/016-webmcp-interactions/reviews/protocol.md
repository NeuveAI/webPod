# Review: 016 — WebMCP core protocol, schemas and lifecycle

## Verdict: APPROVE

### Correctness Check

- Source of truth: repo AGENTS; local WebMCP `index.bs` revision `7b3f50f31848b529e69bedbbdf8da0edccba055f`, ModelContext algorithms and tool/annotation/execute option dictionaries, directly inspected. Source research confirms identical September 4 official draft. External `webmcp-tools` smoke evaluator and matcher directly inspected.
- Kanban ticket: unavailable by repo law; this workstream is the tracker. Repo-wide `docs/decisions.md` and `docs/platform_decisions.md` are absent; no unrelated workstreams consumed.
- Correctness target: scope criteria 1–6 and 8, limited to protocol/schema/lifecycle and evidence validity. Physical behavior and readiness accuracy are independently assigned to behavior review; stickers are deferred by D3.
- Dispatch scope: packages/tools, production webmcp mount and device-page effect, native browser eval suite. Read scope, decisions D1–D8, review system prompt, source/native/interaction evidence and both available core/orientation diaries. Strict-critique and companion review protocol, scoping/orchestration framing and relevant Jotai/global guides loaded. Backend/Convex/browser-service-specific skill rules have no changed surface here.
- Dependency/HITL status: native boundary follows D5/D7; no stale webmcp-types imported. Production only uses document.modelContext. Canary's older serialized consumer API adapter is confined to tests.
- Neuve HITL gate: not applicable; no Neuve shell or board per repo law.
- DoD checklist: core protocol checked; full workstream approval requires separate behavior approval, sticker phase, final native rerun after source changes and broad gates.
- Review lanes: protocol here; behavior reviewer owns physical controls/SFX/readiness/orientation.
- Type/lint/doc gates: independently reran tools tests, both apps/web and packages/tools tsc and scoped lint after correction. All pass. Boundary source citation and lifecycle documentation present.
- Git history/staging: uncommitted per D6. Scope/core diary separate shared controls/readiness, native tools/wiring, orientation, evals and evidence into reviewable commit groups.
- Verification evidence: final independent `bun test packages/tools`: 16 pass, 0 fail, 125 assertions. `bunx tsc --noEmit -p apps/web/tsconfig.json` and `bunx tsc --noEmit -p packages/tools/tsconfig.json`: exit 0. `bunx eslint packages/tools/src apps/web/src/webmcp.ts apps/web/src/device-page.tsx apps/web/tests/webmcp-native.e2e.ts`: exit 0. These were independently rerun after the lint correction and reviewed input/progress changes landed.
- Decision-log status: D1 audible agent controls, D2 indices/deltas/clamping, D4 truthful unknown progress, D5 feature detection, D6 no commits, D7 current-draft boundary and D8 ownership respected in this lane.

### Findings

- [INFO, RESOLVED] New feature-detection test originally failed `no-this-alias` at `packages/tools/src/interactions.test.ts:166`. Native receiver identity is now asserted inside the method without aliasing; independent lint and tests pass. No open Critical/Major findings in this core protocol lane.
- [INFO] Protocol implementation matches inspected draft: awaited registration; registration-signal rollback/unregistration; caller+mount abort composition; canonical annotations and strict runtime inputs; plain serializable current results. Full-list status preserves the selected row and separate zero-based selection. No confirmed protocol correctness defect found.
- [INFO] Pending registered navigation disposal/remount test now verifies aborted old work cannot apply a later detent or clear the new operation's progress. Receiver binding/cache/unsupported document coverage closes the initial evidence gaps.
- [INFO] Native evidence is bounded correctly: upstream bare smoke ignores expected results. Browser wrapper checks each authored result with upstream matcher and a negative control. Its six native checks and CLI smoke are reviewed evidence, not independently rerun in this lane, and must be refreshed after remaining source edits. Browser implementation lag is not misrepresented as current-draft consumer conformance.

### Suggestions (non-blocking)

- None.

### Neuve Dogfood Feedback

- Commands run: none; explicitly unavailable and forbidden as an invented workflow by AGENTS.
- Artifact refs: this review and workstream evidence directory.
- Kanban updates: not applicable.
- HITL gate: not applicable.
- Signal value, sticking points, format feedback, backlog signals, feedback artifact: not applicable because no Neuve runtime exists here.
