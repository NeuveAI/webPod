# Review: W5b — browser correctness gate harness

## Verdict: REQUEST_CHANGES

**0 Critical · 8 Major · 2 Minor**

The harness is not approvable. The reviewed product baseline is 8/10, and several
checks do not prove the universal gate named in their title. More importantly,
the mutation runner can label a plant “RED AS REQUIRED” when the unmutated product
was already red, so its evidence does not establish that the mutation was applied
or detected.

## Review setup and sources

- Read `AGENTS.md`, the W5 dispatch, `scope.md`, `hitl-decisions.md`, W5b diary,
  decisions, baseline, summary, and mutation evidence.
- Read the strict-critique and team-orchestration review protocol, current
  modern-web accessibility guidance, current Web Interface Guidelines, and the
  in-app-browser skill.
- Grounded Playwright configuration and E2E patterns in
  `/Users/vinicius/code/agentic-context/tanstack/router/e2e` and
  `/Users/vinicius/code/agentic-context/tanstack/router/docs/router/how-to/setup-testing.md`.
- Applied 001 §15.0 U1–U15 as the source of truth, plus 002 `scope.md`'s W5b
  verification map and H-5/H-6 owner-only rulings.
- Neuve was not run: `AGENTS.md` says this repository has no Neuve shell or
  Kanban and that this workstream tracker is the initiative record.
- Read all four requested commits: `ece6377`, `3c1101e`, `858de80`, `ec7210e`.
  They contain no commit trailers.

## Independent verification

- `bunx tsc --noEmit -p apps/web/tsconfig.json` — pass.
- Scoped ESLint over both tests and both runners — pass.
- `bun run gates` — typecheck and lint pass; aggregate tests are currently red
  only in concurrently edited W4 device tests. This does not excuse W5b's own
  baseline.
- `bun scripts/browser-gates.ts` against the server W5b selected — **8 passed,
  2 failed**: U3 light reduced motion and U7 light contrast at 4.3851:1.
- Focused U6/U11/U12/U13 — 4/4 pass on the current selected server.
- The flag-off assertion itself is real: every test verifies that
  `requestPaint` is absent from `HTMLCanvasElement.prototype`.
- U6 measures `offsetWidth`/`offsetHeight`, so its 44px assertion is genuinely
  pre-transform rather than the visually doubled preview box.
- U15 reviewer inspection: no disabled capability affordance was found in the
  panel; `stations` and `lyrics` are render-gated through `provider.supports()`.
  U14 remains owner-only and uncleared, correctly.
- I reran the supplied ten mutation cases. They exited red, but that result is
  not accepted as proof for the reason in Major 2 below. The run was directed at
  temporary evidence and the committed evidence file was restored byte-for-byte.

## Findings

- **[MAJOR] The reviewed product baseline is not 10/10.**
  (`docs/workstreams/002-implementation-spine/evidence/w5b-summary.md`,
  `apps/web/tests/browser-gates.e2e.ts:158`,
  `apps/web/tests/browser-gates.e2e.ts:218`) — The independent baseline reproduced
  U3 and U7 red: light success motion remains authored under reduce, and light
  secondary text measures 4.3851:1 against a 4.5:1 floor. Uncommitted concurrent
  edits in `packages/panel` are not part of the four reviewed commits and cannot
  satisfy the requested “approve only at 10/10” condition.

- **[MAJOR] Mutation evidence confuses an already-red baseline with a caught
  mutation.** (`scripts/browser-gate-mutations.ts:21-35`) — `caught` means only
  “the process exited non-zero and stdout contains `1 failed`.” It never runs a
  clean control first, never asserts that the selected plant actually changed the
  page, and never checks that the failure was caused by the planted assertion.
  U3 and U7 were already red when their evidence was recorded, so those two
  “RED AS REQUIRED” entries prove nothing about mutation sensitivity. A plant
  must assert that it landed, and the runner must distinguish baseline outcome
  from mutated outcome.

- **[MAJOR] W5b can test an arbitrary stale process instead of the reviewed
  tree.** (`apps/web/tests/playwright.config.ts:17-22`) — `reuseExistingServer:
  true` unconditionally attached this review to PID 36912 on port 3000. While
  product fixes were present in the working tree, the first run still observed
  pre-fix CSS from that existing server. This makes green/red dependent on port
  ownership and HMR timing rather than commit content. The correctness gate needs
  an isolated port/process or an explicit fingerprint/health assertion proving
  the selected server serves the reviewed tree.

- **[MAJOR] U4 does not test the U4 contract it names.**
  (`apps/web/tests/browser-gates.e2e.ts:170-179`) — 001 requires every scrim to
  become opaque at equivalent luminance and every `backdrop-filter` to disappear.
  The test checks only one pseudo-element's `display` and artwork `box-shadow`;
  despite its title, it never inspects title translucency, scrim opacity, or any
  `backdrop-filter`. A retained translucent title/scrim or newly added backdrop
  blur passes. The preference should also be confirmed with `matchMedia`, not only
  inferred from two downstream declarations.

- **[MAJOR] U7's claimed resolution of axe incompletes uses the wrong visual
  background.** (`apps/web/tests/browser-gates.e2e.ts:47-77`,
  `apps/web/tests/browser-gates.e2e.ts:218-234`,
  `docs/workstreams/002-implementation-spine/decisions/w5b.md:13-19`) — The custom
  calculator composites only `backgroundColor`. It ignores `background-image`
  gradients, pseudo-elements, blend modes, and image pixels—the exact reasons axe
  returns contrast as incomplete on this panel. The code then records those
  incompletes under the key `axeIncompleteResolvedByMeasuredThresholds` and accepts
  them. A black text node over a black gradient with a white `background-color`
  is reported as 21:1 although its rendered contrast is 1:1. Either use a
  pixel-backed measurement at text locations or fail/manual-route unsupported
  visual backgrounds; retaining an incomplete record is not resolving it.

- **[MAJOR] U11 can miss clipping performed by an ancestor.**
  (`apps/web/tests/browser-gates.e2e.ts:237-255`,
  `docs/workstreams/002-implementation-spine/decisions/w5b.md:21-27`) — The test
  checks only each text leaf's own `scrollWidth/clientWidth`. If a parent clips a
  fully laid-out child, the leaf has no self-overflow and the test passes while
  visible text is lost. D4's blanket exclusion of viewport containers turns an
  intentional-list exception into a general blind spot. The check needs rendered
  rectangle intersection against clipping ancestors, with narrowly named
  exceptions for intentional list viewports.

- **[MAJOR] U12 is neither keyboard-complete nor an acceleration test.**
  (`apps/web/tests/browser-gates.e2e.ts:259-296`) — It exercises one ready-state
  path on the dark panel only. Twenty awaited `locator.press()` calls are discrete
  key presses; they never produce a held-key `keydown` with `repeat: true`, so
  repeat-only acceleration passes. The focus test presses Tab, ignores the actual
  tab destination, then programmatically calls `love.focus()` behind an optional
  `if (isVisible())`, allowing missing traversal or a missing control to skip the
  assertion. 001 requires every state reachable and operable without pointer,
  exact one-detent arrows with no acceleration, and unsuppressed `:focus-visible`.
  Test the actual tab sequence and held-repeat events in both colourways and the
  full state set.

- **[MAJOR] U13 counts distinct strings, not live-region announcements, and
  omits two-thirds of U13.** (`apps/web/tests/browser-gates.e2e.ts:299-318`) — The
  observer discards empty mutations and deduplicates consecutive identical text,
  so two announcements with identical copy count as one. It also drives 30
  keyboard presses while calling the operation a flick, and never checks U13's
  required assertive error region or loading `aria-busy`. Count qualifying live
  region update cycles without content deduplication, drive the real fast-scroll
  input boundary, and assert all three U13 clauses.

- **[MINOR] U2's automated result is metadata-based, not the required reviewer
  attribution judgment.** (`apps/web/tests/browser-gates.e2e.ts:142-155`) — The
  test proves `data-actor="human"`, ARIA selection, and movement, but 001 asks a
  reviewer to name the actor from the desaturated screenshot without source. A
  product could keep the data attribute and lose the visible attribution channel.
  Keep the automation, but report the screenshot judgment as manual/uncleared
  until a reviewer records it.

- **[MINOR] U6's role selector escapes the colourway scope.**
  (`apps/web/tests/browser-gates.e2e.ts:203`) — Only the first six comma-separated
  selectors are prefixed with the panel selector; bare `[role="button"]` selects
  role buttons anywhere on the page. It can attribute a foreign target to both
  colourways or fail one theme because of an unrelated surface. Scope every
  selector to the current panel.

## Checks that are truthful today

- U1 captures 48 light/dark files across the declared states and three screens;
  aesthetic comparison remains H-6 owner-only rather than automated.
- U3/U4/U5 use real CDP media-feature emulation calls, though U4 needs the direct
  `matchMedia` assertion and broader behavior coverage above.
- U6 uses native pre-transform dimensions and runs axe in both colourways.
- U14 and U15 are printed explicitly after the browser run; neither is silently
  counted as automated success.

Approval requires: a fingerprinted isolated flag-off server, a genuine clean→red
mutation protocol, closure of the U4/U7/U11/U12/U13 verifier gaps, committed
product fixes, and an independent 10/10 baseline.

# Final re-review — `557828d` hardening

## Verdict: REQUEST_CHANGES — 6 Major, 0 Minor

This re-review is bounded to W5b, product fixes `1693761`/`e1f5dd2`, and
hardening commit `557828d`. I did not modify implementation, stage, or commit.
Framework claims below were checked against the TanStack Router Playwright
fixtures and testing guidance in `/Users/vinicius/code/agentic-context`, rather
than recalled from training data.

## Independent results

- **Mechanical baseline: 10/10 green.** A fresh strict-port run on port 4510,
  with `W5B_PLANT=''` and CanvasDrawElement off, completed **10 passed in
  22.5s**. TypeScript and scoped ESLint also exited 0. The root gate runner
  exited 0 with **11/11** packages typechecked, repo lint green, **862 tests
  passed / 0 failed**, and **16 automated gates passed**.
- **Mutation protocol: clean → landed → selected red for all 10 plants.** Each
  plant used its own fresh port and produced exactly one selected test failure:
  U1 hidden-panel screenshot timeout; U2 actor-attribute mismatch; U3 retained
  `0.24s` transition; U4 retained backdrop blur; U5 wrong foundation colour;
  U6 8.8px transformed target; U7 1:1 title contrast; U11 clipped title; U12
  two-row repeated-key movement; U13 four announcement mutations. The runner's
  clean-control prerequisite and `[W5B PLANT … LANDED]` check close the former
  already-red/plant-did-not-land causality defect.
- **Server isolation and flag posture: proven.** Playwright uses one worker,
  `--strictPort`, `reuseExistingServer: false`, a dedicated port, and every test
  asserts that `requestPaint` is absent. This is consistent with the local
  TanStack fixtures' use of a per-suite base URL and explicit web-server
  lifecycle. **Content fingerprinting is not present**, as detailed in Major 1.
- **U2 manual/bounded: pass only for the question actually posed.** In the
  greyscale human fixture, the highlighted `Songs` row remains identifiable by
  position, solid selection, and type weight. This does not establish a general
  human-versus-agent classifier, and the evidence does not claim that it does.
- **U6 selector scope: closed.** Every native-control selector is prefixed with
  the current panel/colourway selector before joining, and the transformed-target
  plant is caught.
- **U15 structural inspection: pass.** `stations` and `lyrics` are omitted through
  `provider.supports()`; no unsupported provider feature is rendered disabled.
  `data-unavailable` is confined to temporary offline/permission data states.
- **U14 and H-6 remain owner-only and uncleared.** No automated result or reviewer
  judgment here clears phone-in-hand thumb occlusion or the both-colourway
  aesthetic acceptance call.

## Findings

- **[MAJOR] The server is isolated and flag-off, but the required content
  fingerprint is still absent.**
  (`apps/web/tests/playwright.config.ts:4-25`,
  `apps/web/tests/browser-gates.e2e.ts:55`) — A fresh process prevents stale-port
  reuse, but the health check is only the base URL. Nothing returned by the app
  or asserted by the suite identifies the expected HEAD or dirty-content digest.
  During this review the fresh Vite process accepted unrelated HMR updates from
  the shared working tree, demonstrating that process identity is not source
  identity. The prior approval condition explicitly required a fingerprinted,
  isolated, flag-off server; `557828d` closes isolation and flag posture only.

- **[MAJOR] U4 is green while the exact reduced-transparency contract is false.**
  (`apps/web/tests/browser-gates.e2e.ts:254-297`,
  `packages/panel/src/panel.css:102-105`,
  `packages/panel/src/panel.css:160`) — U4 requires every scrim to become solid
  at equivalent luminance and all backdrop filters to disappear. The independent
  output shows the light title still has two different stops (`#fdfeff` and
  `#dde5ee`), while `.wp-now-meta` remains alpha-composited at 86% dark / 68%
  light. The test records `title0` and `title1` but never compares them, and its
  scrim inventory queries only `[data-agent="true"]`; on the tested state that
  inventory is empty, so `every(alpha === 1)` passes vacuously. It also never
  verifies equivalent luminance. The blur plant proves one narrow branch, not the
  named universal.

- **[MAJOR] U7 deliberately accepts four measured contrast failures.**
  (`apps/web/tests/browser-gates.e2e.ts:340-363`) — Independent browser evidence
  reports `The Fray` and the battery glyph below the 4.5:1 floor in both
  colourways: **3.87996:1** dark and **3.97107:1** light. Axe places the gradient
  cases in `incomplete`; the custom measurement then moves every low ratio into
  `advisoryMeasurements` and fails only when the text is literally
  `Now Playing` over a gradient. U7 requires zero violations for all body text,
  not one protected string. The baseline's 10/10 is therefore not a truthful U7
  pass.

- **[MAJOR] U11 does not lock the required 1.25 raster scaling.**
  (`apps/web/tests/browser-gates.e2e.ts:366-407`,
  `packages/panel/src/Panel.tsx:70-90`) — The test correctly covers clipping
  ancestors and asserts `airy` at 200%, closing the prior clipping hole. The
  exact U11 contract also says Dynamic Type ≥130% scales the pod raster
  1.0→1.25. The test never inspects `--wp-raster-scale`, stage dimensions, or the
  rendered transform. Replacing the current clamp with a constant 1 would leave
  this gate green. This is an untested half of a universal acceptance criterion,
  not an aesthetic judgment.

- **[MAJOR] U12 still omits native-action keyboard traversal and activation.**
  (`apps/web/tests/browser-gates.e2e.ts:410-474`) — The hardened test now proves
  application traversal, both directions, genuine repeated-key events, full
  state/colourway loops, and visible focus on the panel roots. Its Tab assertion
  then visits only the two S03 application roots. It never reaches, focuses, or
  activates the native S13 action button. A live check found the current product
  does expose that button in the tab order, but removing it would not turn U12
  red. “Every state reachable and operable without touch or mouse” remains
  under-enforced.

- **[MAJOR] U13's single announcement is the stale first detent, not the required
  settled summary.**
  (`apps/web/tests/browser-gates.e2e.ts:477-503`,
  `packages/panel/src/Panel.tsx:113-162`,
  `packages/state/src/store.ts:541-578`) — After 30 ArrowDown inputs, the
  independent live probe selected row **31** while the polite region still read
  **“Row 2 of 120. Absolute, 3:48.”** `startAnnouncer()` owns the 350ms flush but
  has no production caller; only its definition, exports, and tests exist. The
  browser gate checks mutation count after a fixed 450ms wait, but never checks
  that the sole sentence describes the final settled row or that a real
  fast-scroll boundary was driven. Errors and loading are now checked correctly,
  yet the central debounce requirement is green for the wrong reason.

## Required closure

Approval requires a source fingerprint/health assertion for the isolated
flag-off server; exact U4 scrim/luminance enforcement; zero accepted U7 threshold
failures; a U11 raster-scale assertion; native-action keyboard coverage in U12;
and a production-wired, final-state U13 announcement whose 30-detent test proves
the settled content as well as the count. U14 and H-6 remain owner-only after
those changes.

# Final re-review — corrections `e35dcf8` and `4b9e453`

## Verdict: REQUEST_CHANGES — 1 Major, 0 Minor

### Correctness Check

- **Source of truth:** 001 §15.0 U4/U7/U11/U12/U13, the W5 dispatch packet,
  the previous Final re-review's exact six Majors, D-038/D-058/D-064/D-066,
  and H-5/H-6.
- **Kanban / Neuve:** not applicable. `AGENTS.md` explicitly states that this
  repository has no Kanban board and no `neuve` shell.
- **Dispatch scope:** the correction implementation is contained in the browser
  harness, panel CSS/runtime, and the source-fingerprint seam. `4b9e453` updates
  bookkeeping evidence only. I made no implementation change.
- **Dependency/HITL:** U14 thumb occlusion and H-6 both-colourway aesthetic
  acceptance remain owner-only and uncleared.
- **Git history/staging:** both reviewed commits are trailer-free. I staged and
  committed nothing.
- **Framework grounding:** browser lifecycle and keyboard/focus claims were
  checked against the TanStack Router Playwright fixtures and testing guidance
  under `/Users/vinicius/code/agentic-context`, plus the modern-web accessibility
  guidance's requirements for real keyboard traversal, visible focus, debounced
  live regions, 200% scaling, and contrast floors.

### Independent verification

- **Baseline:** fresh strict-port, non-reused, flag-off Chromium run on port 4610:
  **10/10 passed in 27.6s**. Configuration and runtime both reported the same
  137-file SHA-256 source digest.
- **All 16 plants:** independently run on separate ports with evidence and test
  output redirected to `/tmp`. Every plant exited 1, printed its own `LANDED`
  marker, and produced exactly one selected-gate failure:
  `U1`, `SOURCE`, `U2`, `U3`, `U4`, `U4_SOLID`, `U5`, `U6`, `U7`,
  `U7_ALL_TEXT`, `U11`, `U11_RASTER`, `U12`, `U12_ACTION`, `U13`, and
  `U13_SETTLED`.
- **Source fingerprint — CLOSED.** The harness hashes dirty runtime bytes before
  launch, passes the digest into a fresh strict-port server, recomputes it at the
  no-store health endpoint, and checks identity before each gate. The SOURCE
  mismatch plant is independently selected-red.
- **U4 — CLOSED.** The gate now inventories every visible element and pseudo in
  3 screens × 8 states × 2 colourways: 48 reports, no reduced-mode translucent
  paint, no backdrop filter, and solid title/metadata scrims. I independently
  checked the solid title colors against the interpolated gradient luminance:
  dark differs by 0.00071 and light by 0.00370, both inside the asserted 0.005
  equivalence bound. `U4_SOLID` is selected-red.
- **U7 current product baseline — CLEAN, but universal remains open.** Current
  evidence has zero sub-4.5 entries; `The Fray` and the battery glyph are measured
  in both colourways; all unresolved paint arrays are empty. The remaining false
  pass is the Major below.
- **U11 — CLOSED.** At 200%, all three screens and both colourways are airy,
  expose `--wp-raster-scale: 1.25`, render at least 340×255 CSS pixels, and have
  no own/ancestor clipping. The 130% boundary is also checked in both colourways.
  `U11_RASTER` is selected-red.
- **U12 — CLOSED.** Both native S13 Love buttons occur in the real Tab sequence,
  retain visible focus, and activate once from Enter and once from Space. The
  application traversal/state matrix and held-repeat one-detent check remain.
  `U12_ACTION` is selected-red.
- **U13 — CLOSED.** `PanelSurface` leases the production `startAnnouncer()`
  driver with reference-counted teardown across both colourways. Thirty real
  wheel detents settle on row 31 and produce exactly one sequence-stamped polite
  announcement naming row 31; errors remain assertive and loading remains busy.
  `U13_SETTLED` is selected-red.

### Findings

- **[MAJOR] U7's claimed fail-closed gradient analysis checks stops, not the
  colors between them.** (`apps/web/tests/browser-gates.e2e.ts:181-192`,
  `apps/web/tests/browser-gates.e2e.ts:234-245`,
  `apps/web/tests/browser-gates.e2e.ts:490-518`) — For a recognized gradient,
  `applyPaint()` extracts each declared stop and treats only those stops as the
  candidate backgrounds. CSS paints all interpolated colors too. A concrete
  counterexample is `#767676` text over `linear-gradient(#000,#fff)`: the two
  endpoint ratios are **4.623:1** and **4.542:1**, so this analyzer reports a
  pass with no unresolved paint, while the gradient necessarily crosses
  `#767676` and reaches **1:1** contrast. The U7 plant catches a failing endpoint
  and `U7_ALL_TEXT` catches a solid side-text regression; neither exercises this
  interior-gradient false pass. Because the requested correction explicitly
  requires gradients to fail closed, this remaining verifier hole is Major even
  though today's authored palette happens to pass.

### Required closure

For each gradient paint source, either prove a conservative lower bound over the
entire interpolation or classify the paint unresolved and fail/manual-route it.
Add a landed plant whose endpoints pass while an interpolated color fails, then
show U7 selected-red. The other five prior Majors are closed. U14 and H-6 remain
owner-only after this correction.

# Final U7 re-review — `a637d26` and `2421444`

## Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

### Correctness Check

- **Source of truth:** the sole remaining U7 Major in the preceding review,
  001 §15.0 U7, and D-038/D-058/D-064. The required closure was a conservative
  bound over the entire gradient interpolation or a fail/manual route, plus a
  landed counterexample plant.
- **Kanban / Neuve:** not applicable; `AGENTS.md` states that this repository has
  neither a Kanban board nor a `neuve` shell.
- **Dispatch scope:** `a637d26` changes only the browser contrast verifier and
  mutation roster. `2421444` records the resulting bookkeeping evidence. No
  product implementation was changed for this verifier correction.
- **Dependency/HITL:** U14 and H-6 remain owner-only and are not cleared by this
  approval.
- **Type/lint:** `bunx tsc --noEmit -p apps/web/tsconfig.json` and scoped ESLint
  over the changed test/runner files both exit 0.
- **Git history/staging:** both commits are trailer-free. I made no implementation
  change and staged or committed nothing.

### Independent verification

- **Clean baseline:** fresh strict-port, non-reused, flag-off Chromium on port
  4710 completed **10/10 passed in 28.1s**. Configuration and runtime reported
  the same 141-file source digest.
- **Unplanted U7:** the independently generated report contains **0 accepted
  failures**, **0 independently derived sub-threshold entries**, and **0
  unresolved paints**.
- **Reviewer counterexample:** I independently swept every 8-bit grayscale point
  across `linear-gradient(#000,#fff)` with foreground `#767676`. The black and
  white endpoints are **4.6232849:1** and **4.5422250:1**, while interpolation
  reaches value 118 (`#767676`) at exactly **1:1**.
- **Entire interpolation:** each adjacent stop pair is now represented by a
  component-wise hull. Every default sRGB/RGBA interpolation point lies inside
  that hull; relative luminance is monotone in each RGB component. The verifier
  therefore returns 1:1 whenever foreground and background luminance intervals
  overlap, and otherwise uses the nearest conservative interval endpoints. It
  no longer treats stop samples as the painted continuum.
- **17th plant:** `U7_INTERPOLATION` independently lands on the visible S13 mode
  chip, prints the two passing endpoint ratios, and makes the selected U7 test
  fail with a **1:1** lower bound in both colourways. The run exits 1 with exactly
  one failed selected test.

### Findings

None. The sole remaining U7 Major is closed. The mechanical W5b browser lane is
approved; U14 thumb occlusion and the H-6 both-colourway aesthetic decision remain
owner-only gates outside this approval.
