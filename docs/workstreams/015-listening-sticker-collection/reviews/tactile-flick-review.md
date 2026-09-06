# Review: device flick — tactile collection repair

## Verdict: APPROVE

### Correctness Check

- Source of truth: owner's tactile pack and responsive flick request; AGENTS.md; tactile-collection-scope.md; implementation-decisions.md. Baseline 1b7b763. No global decisions/platform decision registries exist.
- Kanban ticket: none; repository explicitly has no board.
- Correctness target: predictable short flick and held drag, responsive reversal, interrupted capture, no stranded edge, bounded frame-independent release and reduced motion.
- Dispatch scope: orientation motion/controller and regression tests. Collection lane remains under implementation; integrated pack gesture isolation is pending.
- Dependency/HITL status: no owner decision required; subjective enjoyment remains owner judgment.
- Neuve HITL gate: unavailable by repository law; no Neuve shell or board.
- DoD checklist: flick source and actual canonical development-route gesture gates complete. Final collection production integration is owned by the separate collection review; this approval is specific to the flick lane.
- Review lanes: flick review here; collection review separate; later independent GPU/lifecycle peer required once capacity frees.
- Type/lint/doc gates: independent `bunx --bun tsc --noEmit -p apps/web/tsconfig.json` and scoped eslint of all five changed flick source/test files passed; lifecycle comments inspected.
- Git history/staging: implementation not committed; source and tests remain stageable independently from collection changes.
- Verification evidence: final independent re-run of all six orientation suites: 44 passed, 229 assertions. `bunx --bun tsc --noEmit -p apps/web/tsconfig.json` and scoped flick ESLint independently passed. Full real Chrome canonical `bun run dev` suite: 12 passed in 2.0 minutes, including native lost capture, in-flight re-grab, repeated flips/reversal, touch, reduced motion, wheel isolation and reset. Bounded log: `evidence/tactile-flick/reviewer-browser.log`; source fingerprint `87ca93c9d7002c123d533a3e17e0b5a2c4871d8f2d186c17556a3cb73e129cb7` (372 files). This snapshot intentionally has no Apple credentials: token-service503 and existing Three.Clock deprecation remain visible in the log and are not orientation failures. Visibly inspected actual rear-after-short-flick.png and front-after-repeated-flicks.png: complete rendered faces, readable engraving/display, no stranded edge or error overlay. A still image cannot establish subjective fluidity; the timed gesture assertions provide behavioral evidence, and enjoyment remains owner judgment.
- Decision-log status: final diaries/tactile-flick.md read and source claims independently checked. Loaded strict-critique, team-orchestration/review protocol, global-patterns, modern-web-guidance (search plus tooltip guide), Interface Craft critique/storyboard, all four Interface Design Guardrails resources, Neuve Motion principles/tokens/storyboard/reduced-motion, Jotai guidance, React performance and fresh Web Interface Guidelines. Installed R3F events source confirms captured-object handling and demand rendering; local Jotai `src/react/useAtomValue.ts:118-173` confirms subscription identity behavior. Existing surface-research.md/backend-contract.md consumed for cross-lane ownership.

### Findings

- Final independent evidence checkpoint: no unresolved Critical/Major flick issue. Previously recorded reversal and idle-blur findings below are historical and resolved; full12-case runtime gate now passes. Original reviewer source scrutiny and this independent takeover are recorded separately because the earlier reviewer could not be resumed under the agent tool limit.

- Historical second re-review checkpoint: signed impulse distance gates semantic admission and caps ordinary look-ahead to twice that distance. Independent 38 tests/182 assertions passed, including final destinations for one-through-four-pixel reversals and intentional twenty/forty-pixel reverse impulses. The source Major was resolved at this checkpoint; the then-pending runtime/type/lint gates subsequently passed as recorded above.
- Re-review checkpoint: independent 38 tests/178 assertions across the three motion/controller suites plus shared sticker-motion pass after the first patch. The exact one-pixel reversal and idle-blur cases now pass. The Major remains open through another branch: with the same 0→100px trace, use final x=97 at 41ms. Current impulse is only −3px (−1.26°), but ordinary `yawSpeed * .12` projection selects −180° from 40.74°, a 220.74° flip. The semantic eight-degree admission no longer misfires, but unrestricted ordinary projection bypasses it. Bound/suppress projection for insignificant fresh impulses; cover multiple tiny high-speed reversals, not only the reported one-pixel fixture.
- [MAJOR, RESOLVED] Tiny reverse movement borrows the old gesture's travel and triggers a full flip (`apps/web/src/device-orientation-motion.ts:183`). Velocity now resets at each directional reversal, but the eight-degree minimum still measures the entire grab. Reproduction: x=0 at 0ms, x=100 at 40ms, x=99 at 41ms; gains yield current yaw 41.58° and release velocity −420°/s. `beginDeviceOrientationRelease` returns `opposite-face` targeting +180°, despite only one pixel of reverse movement. The old 42° displacement qualifies this tiny corrective impulse, and the nearest opposite-face copy then flips against its direction. Track meaningful distance/duration of the current impulse (or an equivalent intent guard), and assert final destinations for tiny corrective and substantial deliberate reversals. Existing reversal regression verifies velocity sign alone.
- [MINOR, RESOLVED] Idle window blur changed an intentionally selected pose (`apps/web/src/device-preview-orientation.ts:397`). The handler now gates snapping on interrupted motion. Independent idle-blur regression passed.

### Suggestions (non-blocking)

- Retain pointer traces with real input intervals in runtime evidence, so an assertion of motion kind cannot stand in for visible responsiveness.

### Neuve Dogfood Feedback

- Commands run: none; no Neuve shell exists in this repository by standing law.
- Artifact refs: this review and tactile-collection-scope.md.
- Kanban updates: not applicable.
- HITL gate: none emitted.
- Signal value: not applicable.
- Sticking points: no tooling invented to satisfy a foreign repository workflow.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailability recorded here.
