# Diary — Aqua pending-playback material remake

## Outcome

Implementation and evidence are ready for PM acceptance and independent review.
This is not self-approved; final visual acceptance remains with the owner.

The rejected white/cyan capsule was replaced by a compact recessed Aqua well:

- authored geometry remains `x18, y157, 236×5`;
- `1px` square-soft radius and continuous neutral rim;
- contained cobalt/cornflower ribs, CSS `45deg` right-falling (`\\`), `52/48` duty;
- `7.75px` projected repeat (`1.55×` bar height);
- one-repeat `7.75px` transform over `3.2s linear infinite`;
- upper glint and lower blue edge without blur, glow, or bloom;
- reduced motion keeps the rendered material and freezes it at half-phase with
  computed animation `none`.

No provider logic, playback state, React state, dependency, or Now Playing
geometry was changed.

## Visual rationale

At equal bar height the primary reference is a thin neutral well containing
alternating medium-blue and light-blue diagonal ribs. The rejected render is a
broad cyan/white glass tube with capsule ends. The remake therefore puts the
neutral perimeter on the real progress element and confines a square-cornered
stripe sheet to its three-pixel interior. Blue occupies slightly more than half
the repeat. Top and bottom inset edges describe shallow gel depth without
lifting the whole bar into a glowing object.

An independent review caught that the first candidate encoded the diagonal as
CSS `135deg`, which mirrored the reference. The corrected `45deg` sheet makes
blue-band starts move right as y increases (`\\`), visibly matching the primary
raster in the regenerated equal-height board. No other material token changed.

The motion storyboard is encoded beside the CSS: `0ms` rest, `1600ms`
half-repeat, `3200ms` exact-repeat loop. This is deliberately slower than the
rejected `1.8s` treatment.

## Measured evidence

Canonical dark centerline, excluding the rim:

| Measure | Result | Contract |
| --- | ---: | ---: |
| Autocorrelation repeat | `8` logical px | `6.75–9px` |
| Luminance minimum / maximum | `117.99 / 208.62` | — |
| Luminance swing | `90.63` | `≥80` |
| Peak `B-R` | `122` | `≥95` |
| Computed radius | `1px` | `0.5–1px` target; `≤1.25px` hard limit |
| Computed interior height | `3px` inside `1px` rim | contained |
| Duration / timing | `3.2s / linear` | `2.8–3.6s / linear` |
| Reduced motion | `animation-name: none`; half-phase retained | frozen and visible |

Machine-readable results are in `evidence/aqua-loading/aqua-loading-computed.json`
and `evidence/aqua-loading/aqua-loading-pixel-metrics.json`.

## Screenshot matrix

- `evidence/aqua-loading/aqua-loading-dark-t0.png`
- `evidence/aqua-loading/aqua-loading-dark-half.png`
- `evidence/aqua-loading/aqua-loading-light-t0.png`
- `evidence/aqua-loading/aqua-loading-light-half.png`
- `evidence/aqua-loading/aqua-loading-dark-reduced.png`
- `evidence/aqua-loading/aqua-loading-light-reduced.png`
- `evidence/aqua-loading/aqua-loading-device-mobile.png` (`390×844` viewport;
  complete production `CompositeDevice` on the real `/_spike/device` route)
- `evidence/aqua-loading/aqua-loading-device-desktop.png` (`1440×900` viewport;
  complete production `CompositeDevice` on the real `/_spike/device` route)
- `evidence/aqua-loading/aqua-loading-comparison-board.png` — primary,
  anti-reference, dark remake, and light remake at equal `48px` bar height.
- `evidence/aqua-loading/aqua-loading-comparison-board.html` — reproducible board
  source.
- `evidence/aqua-loading/aqua-loading-evidence-manifest.json` — capture producer,
  source fingerprints, route, viewport, and content metadata.

## Files changed in this lane

- `packages/panel/src/panel.css`
- `packages/panel/src/aqua-material.test.ts`
- `packages/panel/e2e/panel.e2e.ts`
- `docs/workstreams/005-playback-prefetch-period-polish/decisions-aqua-loading.md`
- `docs/workstreams/005-playback-prefetch-period-polish/diary/aqua-loading-remake.md`
- generated evidence under `docs/workstreams/005-playback-prefetch-period-polish/evidence/aqua-loading/`

The pre-existing dirty worktree was preserved and no commit was created.

## Verification log

- `bunx modern-web-guidance@latest search "CSS indeterminate progress bar transform animation reduced motion background stripes accessibility" --skill-version 2026_05_16-c5e78707` — completed; CSS and transform guidance selected.
- `bunx modern-web-guidance@latest retrieve "css,individual-transform-properties"` — completed; CSS transform/reduced-motion guidance applied.
- Latest Vercel Web Interface Guidelines fetched before review — production CSS passes the applicable animation and reduced-motion rules.
- `bun test packages/panel/src/aqua-material.test.ts` — **10 passed, 0 failed, 63 assertions**.
- `AQUA_EVIDENCE_DIR=… bunx --bun playwright test --config packages/panel/playwright.config.ts --grep "starting playback"` — **1 passed**; normal/reduced computed state, semantics, material, exact geometry, and screenshot matrix passed.
- Initial `AQUA_EVIDENCE_DIR=… bunx --bun playwright test --config packages/panel/playwright.config.ts` run under host saturation — **16 passed, 2 timing-sensitive failures**. The Aqua case passed. The unrelated all-state screenshot matrix exceeded its pre-existing `30s` cap, and the unrelated CPU-throttled list sampler measured `74.31ms`; isolated saturated rerun measured `77.68ms`. Process-level inspection showed a GPU-heavy application consuming more than one CPU core. Neither failure exercised the pending progress material.
- Final post-direction-correction idle-host `AQUA_EVIDENCE_DIR=… bunx --bun playwright test --config packages/panel/playwright.config.ts` — **18 passed in 24.8s** using source fingerprint `79a3a96cdd8ceb374380b6513c8daaeb7b5f88dc10f660b8c1eb018f34a48e6f`. This closes the full-panel gate without a waiver and includes the direction assertion.
- Post-direction-correction `LCD_FIDELITY_EVIDENCE_DIR=… bunx --bun playwright test --config apps/web/tests/playwright.config.ts --grep "captures the canonical production device"` — **2 passed in 6.8s**, source fingerprint `55a59aa5bdfcafc0493958b55ea77975f5818df609a2a422074d432e9da60298`. The existing test-only Apple facade drove pending Now Playing through the real production `Panel` + `CompositeDevice` route and emitted complete mobile/desktop device frames. These replace the rejected raw/clipped fixture captures.
- `bun run typecheck` — **11/11 projects clean**.
- `bun run lint` — **passed**.
- `bun run build` — **passed** client and SSR; retained the existing `>500kB` chunk warning.
- `bun run gates` — **16 automated passed, 0 failed; 2 existing manual gates outstanding**. Embedded repo run: **1329 tests passed, 0 failed, 78820 assertions**.
- `git diff --check` — **passed**.

## Remaining uncertainty

- Human resemblance is intentionally not claimed by the implementer. The PM,
  independent reviewer, and owner must judge the equal-height board and complete
  Now Playing captures.
- The primary raster is a scaled document screenshot, so its soft antialiasing
  is not a literal CSS color or blur instruction. Geometry and color thresholds
  from the binding contract were used instead.
