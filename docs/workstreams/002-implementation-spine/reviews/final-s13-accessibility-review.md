# Review: c9b0ec8 — S13 passive playback status semantics

## Verdict: APPROVE

### Correctness Check

- Source of truth: `AGENTS.md`; workstream 002 `scope.md`, `hitl-decisions.md`, `review-lanes.md`, and `review-system-prompt.md`; the final U15 browser review and runtime observations; 001 `pm-spec.md` S13/capability rules; current React 19 sources in `/Users/vinicius/code/agentic-context/react.dev`; [WAI-ARIA 1.2 `group` and `img`](https://www.w3.org/TR/wai-aria-1.2/); [ARIA in HTML](https://www.w3.org/TR/html-aria/); and the current [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
- Kanban ticket: not applicable. This repository explicitly tracks initiatives under `docs/workstreams/` and has no Neuve shell or board.
- Correctness target: resolve U15's `aria-prohibited-attr` incomplete result without turning passive status graphics into controls, duplicating their names, restoring unsupported Apple capabilities, or changing Love's native interaction.
- Dispatch scope: commit `c9b0ec8` changes exactly `packages/panel/src/Panel.tsx`, its SSR test, and its Playwright test. No sibling package, provider contract, capability matrix, or styling surface changed.
- Dependency/HITL status: U15 is approved on T1. U14 and owner-only H-6 remain outside this commit and are not claimed.
- Neuve HITL gate: not applicable; the scoped workstream records that Neuve is unavailable and intentionally not used for this repository.
- DoD checklist: focused SSR and browser tests pass; independent both-colourway semantic/Axe probe passes; typecheck, lint, 941 repository tests, 16 automated gates, client build, and SSR build pass. U14 remains manual.
- Review lanes: accessibility semantics, React/SSR/hydration, interaction/focus, capability honesty, and regression-evidence strength were reviewed antagonistically.
- Type/lint/doc gates: 11/11 TypeScript projects clean; ESLint clean; no type escape, lint suppression, state change, client-only branch, or new lifecycle exists in the diff. `PassiveStatusIcon` is private and self-evident at its call sites, so additional TSDoc is unnecessary.
- Git history/staging: `c9b0ec8` is one coherent three-file accessibility commit with no trailer. The implementation files were returned byte-identical after mutation testing; unrelated token and evidence artifacts were untouched.
- Verification evidence: the committed focused tests pass. An independent temporary Playwright expansion verified each dark/light `.wp-actions` subtree has one named `group`, four uniquely named `img` nodes, one native Love button, no `tabindex`, and Axe `aria-prohibited-attr` with zero violations and zero incomplete results. The temporary test edit was reverted. Mutations deleting `role="img"`, adding `tabIndex={0}`, and removing the inner `aria-hidden="true"` each failed the focused SSR/browser gates. Full repository verification ended at 941 tests, 0 failures.
- Decision-log status: the change follows D-019/D-026 and the final U15 ruling: unsupported capabilities remain absent, lyrics stays out of the S13 centre cycle, and this review does not clear U14 or H-6.

### Findings

- [MINOR] The committed Axe regression covers only the dark action strip (`packages/panel/e2e/panel.e2e.ts:160`). The implementation is shared and an independent light-colourway run passes with zero violations and zero incomplete results, so this is not a current product defect. Still, the permanent test does not encode the workstream's explicit both-colourway acceptance axis and could miss a future colourway-conditional semantic branch.

### Suggestions (non-blocking)

- Parameterize the committed `aria-prohibited-attr` assertion over `dark` and `light`, preserving the independent probe used in this review.

### Neuve Dogfood Feedback

- Commands run: none; the workstream expressly records no Neuve shell or board.
- Artifact refs: not applicable.
- Kanban updates: not applicable.
- HITL gate: no Neuve-routed unit exists. U14 and H-6 remain separately owner-routed.
- Signal value: not applicable.
- Sticking points: the mandatory modern-web helper prescribes `npx`, while repo law forbids `npx`; current W3C and Vercel primary sources were consulted directly instead.
- Format feedback: not applicable.
- Backlog signals: none for Neuve.
- Feedback artifact: this review records unavailability as required.

## Re-review — `c9e9baa`

### Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

The follow-up is limited to `packages/panel/e2e/panel.e2e.ts` and closes the prior Minor. The committed regression now evaluates `aria-prohibited-attr` independently for the dark and light action strips, requiring zero violations and zero incomplete results for each. Both branches retain the named `Playback status` group, four distinctly named non-focusable graphics, the sole native Love button, and the capability-absence assertion.

Focused verification passed: 14/14 panel SSR tests, the targeted Playwright case, panel TypeScript, and scoped ESLint. A temporary light-only removal of the action-strip `role` made the targeted test fail at the light panel while leaving the dark branch unchanged; the file was then restored byte-for-byte and the focused browser test passed again. The test also carries its own light-only Axe plant. Current WAI-ARIA semantics and the Vercel Web Interface Guidelines were rechecked; no new finding applies. No implementation file was changed by this review.
