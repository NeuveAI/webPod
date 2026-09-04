# D2 independent review — compact period iPod/Aqua presentation

**Reviewer:** `/root/d2_visual_review`
**Date:** 2026-09-03
**Verdict:** **APPROVE**

The D2 slice has zero Critical and zero Major findings. The implementation satisfies the presentation contract at the canonical LCD geometry and does not introduce an interaction or accessibility regression. Owner visual sign-off remains the final subjective gate for fifth-generation period authenticity.

## Findings

### Critical

None.

### Major

None.

### Minor

1. **The production-device scrollbar E2E is still not a portable green proof.** `apps/web/tests/list-scroll-indicator.e2e.ts:255` blocks all list assertions on the experimental CanvasDrawElement composite source, and `docs/workstreams/003-deadline-player-repair/evidence/d2-visual-evidence.md:49` correctly records that the implementer run timed out at that seam. My configured Playwright rerun also could not execute because its pinned Chromium binary is absent on this machine. Direct Google Chrome checks against the live DOM independently passed the D2 assertions, so this is a bounded test-infrastructure gap rather than evidence of a presentation defect. Keep it tracked until the renderer harness can launch and attach reliably.

## Contract verification

### Visual comparison

- The owner-provided Artists and nested-track captures showed oversized, uniformly heavy rows and a cyan rail that competed with the selected row. The D2 captures replace that with compact 11px hierarchy, equal selected/plain font metrics, a restrained steel-blue Aqua material, and a subordinate 5px rail.
- All eight canonical screenshots under `evidence/d2-visuals/` were inspected at original 272×204 resolution. Music root, Artists, and nested tracks are covered in dark and light colourways; `prefers-contrast: more` Artists is covered in both colourways.
- Root and Artists views with four or eight rows have no rail. The overflowing nested-track view has a narrow trough and an independently visible thumb. The preview art and copy no longer dominate the list pane.
- The result is materially closer to a compact period media-player hierarchy than the owner screenshots: one clear title, eight scannable rows, one restrained selected state, and secondary metadata that remains subordinate.

### Geometry and implementation

- `packages/panel/src/list-view.tsx:70` retains one canonical row-window calculation and marks overflow only when `rows.length > capacity`.
- `packages/panel/src/panel.css:112` keeps the 183px viewport divided by the declared visible-row count. Browser measurement produced eight equal rows; at the preview's 2× scale each measured 45.75px, equivalent to the authored 22.875px.
- `packages/panel/src/panel.css:114` keeps selected and unselected rows at weight 500, preventing selection-induced layout shift.
- `packages/panel/src/panel.css:130` reduces the structural rail to 5px. `packages/panel/src/list-scroll-indicator.tsx:21` continues to omit it when the list cannot move and clamps thumb travel for overflow.
- `packages/panel/src/panel.css:113` reserves end padding only for overflowing lists, so the narrower rail does not cover row content.

### Colourways and preference modes

- Dark selected text resolves to white over the dark steel-blue Aqua layers; light selected text resolves to dark navy over the pale Aqua layers. The focused material tests verify at least 4.5:1 against each authored selection stop.
- `packages/panel/src/panel.css:197` disables authored animation and transitions under reduced motion. Independent Chrome emulation resolved both to `none` in both colourways.
- `packages/panel/src/panel.css:216` removes title gradients and artwork shadows under reduced transparency. Independent Chrome emulation resolved both title backgrounds and art shadows to `none` in both colourways.
- `packages/panel/src/panel.css:224` provides explicit high-contrast text, selection, trough, and thumb tokens. Independent Chrome emulation resolved selected text to white in dark mode and black in light mode, with inverted thumb/trough materials.
- `packages/panel/src/panel.css:264` uses system forced-colour tokens for selection and the scroll indicator. Independent Chrome emulation kept Highlight/HighlightText selection and a black/white thumb-trough boundary.

### Interaction and accessibility

- Live Chrome keyboard traversal retained focus on the `role="application"` panel, changed `aria-activedescendant` on ArrowDown, and exposed exactly one `aria-selected="true"` option after movement.
- Pointer/list semantics are unchanged by D2; the only JSX behavior addition is a non-interactive overflow data attribute.
- A scoped axe pass found no D2-specific violation. Its only violation was the pre-existing duplicate landmark label created by the development page's side-by-side dark/light comparison. Gradient contrast remained an axe `incomplete`; the deterministic material tests and computed-colour checks cover the selected-row contrast directly.
- The changed surfaces retain ellipsis, `min-inline-size: 0`, decorative-icon hiding, visible panel focus, and no `transition: all`.

## Independent checks

- `bun test packages/panel/src/list-view.test.tsx packages/panel/src/list-scroll-indicator.test.tsx packages/panel/src/aqua-material.test.ts` — 22 pass, 0 fail.
- `bun test packages/panel/src` — 85 pass, 0 fail.
- `bun run typecheck` — 11/11 projects clean.
- `bun run lint` — clean.
- `bun run build` — client and SSR production builds clean.
- `git diff --check --` on all D2-owned source and test paths — clean.
- Direct installed-Chrome verification against the live panel route — keyboard focus/selection, eight-row geometry, overflow-only 5px rail, reduced motion, reduced transparency, high contrast, and forced colours all passed.

## Decision

**APPROVE.** D2 clears the review gate with zero Critical and zero Major findings. The remaining production-device E2E limitation is Minor and already isolated from the canonical DOM proof. Final completion still requires the owner's visual approval of the period-Aqua direction.
