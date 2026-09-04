# Review: Aqua pending-playback material remake — independent visual/code lane

## Verdict: APPROVE

### Correctness Check

- Source of truth: checked the owner-supplied primary raster and explicit
  anti-reference at original detail, with `aqua-loading-criteria.md` and D005-07
  as the binding interpretation. The regenerated equal-height board was inspected
  first. The candidate now reads as a thin recessed blue Aqua well rather than the
  rejected cyan capsule.
- Kanban ticket: none. Repository law and D005-05 explicitly replace Neuve/Kanban
  with the workstream artifacts; no Neuve command was run.
- Correctness target: met. The pending material is contained inside the existing
  `x18, y157, 236×5` progress track, retains a continuous `1px` rim and `1px`
  corner radius, uses a `52/48` cobalt/light split with a `7.75px` projected
  repeat, and moves exactly one repeat in `3.2s linear`.
- Dispatch scope: met. The Aqua-specific production/test delta is confined to
  `packages/panel/src/panel.css`, `packages/panel/src/aqua-material.test.ts`, and
  `packages/panel/e2e/panel.e2e.ts`, plus the authorized workstream decisions,
  diary, review, and evidence artifacts. The existing production-device browser
  test was reused to make the two device captures. No provider, playback-state,
  React-state, dependency, or non-progress layout change was introduced by this
  lane. The broader dirty worktree predates this corrective dispatch and remains
  uncommitted.
- Dependency/HITL status: D005-07 is respected. Automation and this review do not
  waive final owner visual approval. The existing PM review records an earlier
  rejection against raw/clipped device evidence and a red full-suite run; both
  cited conditions are now corrected, so that PM artifact must be refreshed
  before owner handoff.
- Neuve HITL gate: intentionally not applicable under D005-05. Owner visual
  acceptance remains the required human gate.
- DoD checklist: items 1–6 are supported by the current implementation, tests,
  complete screenshot matrix, production-device captures, and this zero-blocker
  review. Item 7 remains pending owner approval by design.
- Review lanes: independent visual/code lane approves. PM re-review remains a
  process dependency because its current file predates the corrected evidence.
- Type/lint/doc gates: `bun run typecheck` passed all 11 projects; `bun run lint`
  passed. No `any`, unchecked cast, lint disable, `useState`, new dependency, or
  public API/doc-comment issue was introduced in the reviewed files.
- Git history/staging: no commit was created. The Aqua CSS, strengthened tests,
  and evidence/docs remain separable from the unrelated pre-existing worktree.
- Verification evidence:
  - `bun test packages/panel/src/aqua-material.test.ts` — 10 passed, 0 failed,
    63 assertions.
  - `AQUA_EVIDENCE_DIR=/tmp/webpod-aqua-review-angle-fixed bunx --bun playwright test --config packages/panel/playwright.config.ts --grep "starting playback"`
    — 1 passed against the corrected `45deg` source.
  - `bun run typecheck` — 11/11 projects clean.
  - `bun run lint` — passed.
  - `git diff --check` — passed.
  - The current-source full panel result is 18/18 at fingerprint
    `79a3a96cdd8ceb374380b6513c8daaeb7b5f88dc10f660b8c1eb018f34a48e6f`,
    recorded in the diary and evidence manifest. The two production-device tests
    passed at mobile and desktop viewports.
  - I independently sampled the current dark capture: centerline luminance is
    `117.986–208.62` (swing `90.634`), peak `B-R` is `122`, and the first useful
    raster repeat is `16` device pixels / `8` logical pixels.
  - Direction was independently falsified and corrected. In the primary raster,
    corresponding blue runs start at x=`543` on y=`124` and x=`553` on y=`136`;
    in the corrected candidate they start at x=`50` on y=`318` and x=`51` on
    y=`319`. Both therefore fall right (`\\`) as y increases. The former
    `135deg` candidate rose right (`/`) and is now an explicit rejected mutation
    in the material test.
  - Every required canonical t0/half/reduced capture, both full production-device
    captures, the computed-style JSON, pixel metrics, manifest, and equal-height
    comparison board were inspected at original detail after regeneration.
- Flake disposition: the diary's initial screenshot-timeout and CPU-throttled list
  pacing failures did not exercise pending playback and disappeared in the final
  idle-host 18/18 run. My own overlapping full-suite attempt collided with the
  shared fixed temporary snapshot while another process regenerated it, producing
  a missing `bun.lock` and server shutdown; this was a runner-concurrency failure,
  not an Aqua assertion. No Aqua-related failure was waived.
- Decision-log status: DAQ-01 through DAQ-04 are complete and consistent with the
  current CSS. DAQ-01 now correctly records why CSS `45deg` matches the primary
  raster and why `135deg` was rejected. D005-03, D005-05, and D005-07 are obeyed.

### Findings

- [INFO] No Critical, Major, or Minor implementation finding remains. The initially
  mirrored stripe direction was caught during this review, corrected in CSS, made
  adversarially testable, and followed by complete evidence regeneration
  (`packages/panel/src/panel.css:49`,
  `packages/panel/src/aqua-material.test.ts:248`,
  `packages/panel/e2e/panel.e2e.ts:288`).
- [INFO] The `1px` top glint and `1px` lower edge consume two rows of the `3px`
  interior, so the material is intentionally sharper and more horizontally
  stratified than the scaled documentation raster. It remains within the binding
  cross-section, color, containment, and human-judgment contract; final preference
  belongs to the owner, not this reviewer (`packages/panel/src/panel.css:201`).

### Suggestions (non-blocking)

- Refresh `reviews/aqua-loading-pm.md` against the regenerated production-device
  captures and current-source 18/18 result before presenting the board to the
  owner. Its two recorded blockers describe superseded evidence.
- If the owner asks for one last material tune, adjust only the glint/lower-edge
  alpha after viewing at production device scale. Do not reopen geometry, stripe
  direction, repeat, cadence, or loading semantics without a new decision.

### Neuve Dogfood Feedback

- Commands run: none; repo law and D005-05 explicitly forbid a Neuve/Kanban shell
  workflow for this repository.
- Artifact refs: `dispatch/aqua-loading-remake.md`, `aqua-loading-criteria.md`,
  `hitl-decisions.md`, `review-lanes.md`, `decisions-aqua-loading.md`,
  `diary/aqua-loading-remake.md`, and `evidence/aqua-loading/`.
- Kanban updates: none; workstream artifacts are the initiative tracker.
- HITL gate: owner comparison-board approval remains open under D005-07.
- Signal value: not applicable because Neuve was intentionally unavailable.
- Sticking points: the fixed shared Playwright snapshot path is not concurrency-safe;
  overlapping reviewers can delete another run's served snapshot.
- Format feedback: the evidence manifest's source fingerprints made it possible to
  distinguish a current-source green run from an earlier stale one.
- Backlog signals: give panel Playwright runs process-unique snapshot directories so
  legitimate parallel review does not create false server/test failures.
- Feedback artifact: this review records the intentional Neuve bypass; no separate
  Neuve feedback artifact is appropriate.
