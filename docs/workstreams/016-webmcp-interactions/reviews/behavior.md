# Review: 016 — WebMCP interaction behavior

## Verdict: APPROVE (non-sticker slice A)

### Correctness Check

- Source of truth: repo AGENTS.md; scope.md criteria 1–6/8; decisions D1–D13; review-system-prompt.md; evidence/spec-research.md, interaction-research.md and native-evals.md; diaries/orientation.md and core.md. Local physical-motion, state reducer, audio and panel call chains inspected. Current Web Interface Guidelines retrieved for reduced-motion/interruption requirements. Strict-critique, team review protocol, global-patterns, Jotai, interface-craft/design-critique and web-design-guidelines loaded. No repo-wide docs/decisions.md or docs/platform_decisions.md exists.
- Kanban ticket: none; repo explicitly has no board.
- Correctness target: seven native core tools must operate the production state, physical control and audio owners; navigation must traverse complete lists at <=5 items/sec; status must report truthful readiness/timing; cancellation/teardown must preserve human interaction.
- Dispatch scope: packages/tools, shared state feedback, composite physical input, panel readiness, production mount and orientation controller/tests. No sticker implementation reviewed or modified. Public exports/package edges inspected. No unrelated rescope.
- Dependency/HITL status: D1 sound supersedes legacy silence; D2/D13 units/ranges honored; D3 sticker work was withheld during A; D6 leaves work uncommitted; D7 current draft types grounded in source; D9–D11 physical ownership, sound and unknown-progress decisions observed. No unresolved owner input for this slice.
- Neuve HITL gate: unavailable per repo law; no gate applies.
- DoD checklist: A behavior review gate satisfied. This is not final sticker/workstream approval. Final native-eval rerun after subsequent changes and final workstream checks remain lead-owned.
- Review lanes: independent behavior/SFX/timing/runtime lane complete for A; independent protocol lane remains separately recorded.
- Type/lint/doc gates: independent app tsc exit 0; scoped ESLint across all changed non-sticker implementation/tests exit 0. New public/lifecycle seams document units, physical effects and cancellation. No new unsafe type escapes or workstream-name leakage in inspected implementation. Feedback type assertion correctly excludes system while permitting audible agent provenance.
- Git history/staging: uncommitted per D6; diary staging groups separate shared feedback/physical/readiness, native tools/mount, orientation, evals and evidence.
- Verification evidence: final independent commands and results below. Core's broader 575-pass/1-fail report attributes unchanged state/stickers.test.ts to concurrent edge-wrap work; that separate work was not altered or silently waived by this review. Native evidence records 6 browser tests and upstream5/5 global calls on an earlier source snapshot; it distinguishes actual audio scheduling from speaker audibility and Canary consumer lag from current-draft registration.
- Decision-log status: reviewed current D1–D13 and stable implementation declaration from lead/core implementer. Diary was still being finalized when read; no approval depends on its unverified test claims.

### Findings

- No open Critical or Major findings in slice A.
- Resolved: nested external orientation writes were overwritten by a flick; intended-value matching plus generation checks now preserve overrides and reject both intermediate/final-frame cancellation.
- Resolved: human takeover could release or strand shared physical channels. Separate center/wheel generations and exact-once cleanup now preserve all four same/cross-channel arrival combinations using actual physical center translation and wheel quaternion assertions.
- Resolved: existing-track provider loading was misclassified as ready; readiness now observes provider loading independently of presentation state.
- Resolved: subsequent loading episodes inherited old selection timestamps, and provider replacement briefly fabricated known start times. Busy-transition clocks and replacement ordering now pass mounted episode/completion/error/replacement assertions.
- Resolved: rejected selection returned unexplained accepted:false. select_item now rejects with an actionable reason; global press reports its acceptance reason, with a focused contract regression.

### Verification evidence

All commands independently executed from `/Users/vinicius/code/webPod` after core declared stable:

1. `bun test packages/tools/src/interactions.test.ts packages/composite/src/CompositeDevice.integration.test.tsx packages/composite/src/interaction-audio.test.ts packages/state/src/detent.test.ts packages/state/src/feedback.test.ts packages/state/src/store.test.ts apps/web/src/device-preview-orientation.test.ts apps/web/src/device-orientation-motion.test.ts apps/web/src/device-flick-regression.test.ts apps/web/src/device-preview-orientation-source.test.ts` — exit0; 202 pass,0 fail,1098 assertions.
2. `bun test packages/panel/src/Panel.integration.test.tsx packages/panel/src/page-readiness.test.ts` — exit0;19 pass,0 fail,145 assertions. Separate process avoids DOM test-global lifecycle ambiguity.
3. `bunx tsc --noEmit -p apps/web/tsconfig.json` — exit0.
4. `bunx eslint apps/web/src/webmcp.ts apps/web/src/device-page.tsx apps/web/src/device-preview-orientation.ts apps/web/src/device-preview-orientation.test.ts packages/tools/src packages/panel/src/Panel.tsx packages/panel/src/Panel.integration.test.tsx packages/panel/src/page-readiness.ts packages/panel/src/page-readiness.test.ts packages/composite/src/CompositeDevice.tsx packages/composite/src/CompositeDevice.integration.test.tsx packages/composite/src/agent-controls.ts packages/composite/src/interaction-audio.ts packages/state/src/contract.ts packages/state/src/store.ts packages/state/src/silence.ts packages/state/src/detent.test.ts packages/state/src/feedback.test.ts packages/state/src/store.test.ts` — exit0.

Coverage includes complete list/selection separation, boundaries, accelerated paced detents, delayed wakes/no catch-up, consecutive calls, pre-abort and changed Hold/readiness/list/selection, simultaneous calls, disposal/remount progress ownership, real mounted five-button semantic/audio edges, provider accept/decline/failure, mute/activation constraints, physical human takeover, unmount, repeated flick/reduced motion and nested external interruption, mounted buffering/operation clocks and provider replacement.

Reviewed git hash-object fingerprints:

- packages/tools/src/interactions.ts: `8cbd5880cb69afdefc5be6c5745d08b917472a8a`
- packages/composite/src/CompositeDevice.tsx: `1dba82ad8639e10f6ab7aed15184b9078233c939`
- packages/panel/src/Panel.tsx: `ca02697f4476c82a901880accac4c973aca499df`
- packages/panel/src/page-readiness.ts: `55448a22ef986ac54bc0863d196cc68bad6b5d3d`
- apps/web/src/device-preview-orientation.ts: `730730a4f2ef1a2d1d57c315de9b432b19ccd46d`

### Suggestions (non-blocking)

- None. Prior adversarial findings and successive patch observations are preserved in behavior-review-history.md.

### Neuve Dogfood Feedback

- Commands run: none; repo AGENTS.md explicitly states no Neuve shell or board.
- Artifact refs: this review, behavior-review-history.md, core/orientation diaries and source/mapping/native evidence.
- Kanban updates: not applicable.
- HITL gate: no applicable tool-generated gate.
- Signal value: not applicable.
- Sticking points: none.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailability recorded here.

Final lifecycle follow-up: independently reviewed the Panel readiness-owner refcount added after the first stable declaration. Removing one of two identical mounted panels preserves readiness; removing the last reports unavailable. Updated Panel/clock suite19pass145 assertions, app tsc and scoped Panel lint all pass. APPROVE unchanged.
