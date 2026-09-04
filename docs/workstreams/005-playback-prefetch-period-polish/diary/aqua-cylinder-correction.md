# Aqua cylinder and molded-trough correction — implementation diary

Date: 2026-09-05
Implementer: design engineer
Status: candidate and evidence frozen for PM and independent re-review; owner
visual approval remains mandatory

## Scope and sources

This correction reopens only the shared Aqua material and its evidence. I read the
updated playback-fidelity scope and dispatch, corrected PM memo (including the
owner material correction), HITL D005-12/D005-13, decision log, prior diary, and
evidence packet before editing. I inspected the full Aqua reference and the
owner's latest rejected flat-frame crop side by side at original resolution.

Modern web guidance was consulted first. Interface Craft critique/motion,
fresh Web Interface Guidelines, interface guardrails with the explicit
source-driven gradient exception, and project global patterns then informed the
implementation and review. No provider, authentication, state, click-wheel,
queue, scrub, or device behavior was changed in this correction.

## What changed

### One shared 14px cylindrical Aqua control

- Progress and loading remain `236px` wide at `x18`; volume remains `202px` wide
  at `x35` between the existing speakers. All occupy authored `y153..167`, with a
  `14px` outer object and `12px` inner channel.
- Determinate progress and volume share the five-stop cylindrical cross-section:
  pale top, darker blue waist near 52%, pale lower roll-off, plus restrained
  specular and diffuse depth. There is no opaque bottom rule. Volume still swaps
  width without transition; determinate progress retains its existing width
  interpolation.
- Loading uses the same stationary cylindrical lighting over 45-degree, 50/50
  ribs. The projected repeat is `22px`, the gradient-space stop is `7.78px`, and
  the cycle is `3200ms` linear. Reduced motion freezes the fully rendered material
  at the `11px` half phase.

### Molded outer trough

The owner's second rejection showed that a uniform `border: 1px solid` still read
as a flat gray rectangle. The final trough therefore separates four rendered
layers: asymmetric bright top/side and darker bottom outer lip, dark inner recess
seam, smoothly concave neutral channel, and a detached two-stage exterior cast
shadow. Outer radii are `2px 2px 1px 1px`; channel radii are
`1.5px 1.5px .5px .5px`. Dark and light LCD colourways keep identical material,
radii, shadow hue, and `0 1px 1px` / `0 2px 2px` geometry; only semantic shadow
alphas vary (`26%/12%` dark, `10%/5%` light), per PM adjudication.

### Seamless loading loop diagnosis

The first corrected loading implementation translated a finite rounded
pseudo-element. An independent isolated replay found t0-to-forced-22px maximum RGB
delta `15`: the repeat itself closed, but the translated pseudo's rounded/specular
left edge moved into the stable channel. Static background-position comparison
proved the tile closed at delta `0`. PM then clarified that material geometry must
stay stationary and only rib phase should move. The final implementation animates
the rib layer's background position from `0px` to `22px`; it does not move the
trough, endcaps, seam, cylinder, or specular layers. The final isolated rendered
endpoint comparison is exactly `0` maximum channel delta across the `464x24`
stable interior, and the midpoint resolves to exactly `11px` authored shift.

## Executable and pixel evidence

The canonical producer is `packages/panel/e2e/panel.e2e.ts`; it captures the
actual panel fixture and samples the resulting PNG pixels at 2x. The production
device producer is `apps/web/tests/lcd-fidelity.e2e.ts`; no proof-only product
route was added.

- `evidence/playback-fidelity/aqua-cylinder-cross-sections.json` proves `28px`
  outer / `24px` inner raster geometry. Progress and volume profiles have maximum
  RGB-channel delta `0`; top/waist/bottom deltas are `81.12/63.55`, darkest-row
  fraction is `0.5208`, and maximum isolated row discontinuity is `9.42`.
- Loading blue/light top-minus-waist values are `42.54/40.06`; bottom-minus-waist
  values are `41.33/37.84`. t0-to-t1600 finds exactly `11px` authored shift with
  mean delta `0.10`; t0-to-t3200 maximum channel delta is `0`.
- `evidence/playback-fidelity/aqua-outer-trough-cross-sections.json` independently
  measures the empty trough. Top lip/seam/channel luminance is
  `245.51/99.24/210.11`; channel range/bins/max jump are `24.35/4/5.93`; lower
  seam darkening is `13.07`; perimeter diversity/range is `3/112.13`; left/right
  seam contrast is `125.06/100.13`; left-over-right return is `58.42`; maximum
  40px drift is `1.00`; measured left/right/max transition width is `4/4/4px`.
  Corner occupancy masks are executable assertions, not decorative output.
- The dark cast peak spans `8.28..8.58` and the light peak
  `32.53..34.07` luminance points across progress/volume; every capture records
  the required y28..31 falloff and resolved computed tokens.

The frozen visual packet is:

- `evidence/playback-fidelity/reference-board.png` — original photographs and
  owner source beside the equal-height candidate matrix.
- `evidence/playback-fidelity/outer-trough-comparison.png` — equal-scale primary
  determinate/striped reference, owner's rejected crop, corrected 0/35/100,
  loading and volume, aligned vertical/horizontal slices under every crop,
  numeric plots, pass/fail table, and asymmetric corner insets.
- Canonical dark/light PNGs for progress `0/35/100`, loading
  `t0/1600/3200/reduced`, and volume `0/50/100/reduced`, plus full production
  mobile `390x844` and desktop `1440x900` progress/loading/volume captures.

I inspected both boards and the canonical PNGs at original detail. The empty
channel reads as a concave molded well rather than a uniform rectangular outline;
the top/left lip is visibly brighter than the lower/right return, the seam remains
separate, the rounded endcaps are contained, and the exterior shadow detaches and
softens below the object. No opaque dark bottom row appears. The loading ribs are
calm and coherent, and both rib colours retain the cylindrical top/waist/bottom
modulation.

## Verification

Final commands and results for the frozen candidate:

- `bun test packages/panel/src/aqua-material.test.ts packages/panel/src/Panel.integration.test.tsx packages/panel/src/Panel.test.tsx` — **59 passed, 0 failed**, 382 expectations.
- `PLAYBACK_FIDELITY_EVIDENCE_DIR=... PANEL_E2E_PORT=4338 TMPDIR=<private> bunx --bun playwright test --config packages/panel/playwright.config.ts` — **21 passed, 0 failed** in 35.1s. The final focused evidence subset was **4/4**, including independently forced rib phases `0/11/22` and exact endpoint closure.
- `LCD_FIDELITY_EVIDENCE_DIR=... W5B_PORT=4340 TMPDIR=<private> bunx --bun playwright test --config apps/web/tests/playwright.config.ts lcd-fidelity.e2e.ts --grep "captures the canonical production device"` — **2 passed, 0 failed**.
- `bun test packages/state/src` — **35 passed, 0 failed**, 94 expectations.
- `bun test packages/device/src` — **31 passed, 0 failed**, 213 expectations.
- `bun test packages/composite/src` — **13 passed, 0 failed**, 61 expectations.
- `bunx tsc --noEmit -p packages/state/tsconfig.json`, device, composite, and panel equivalents — **pass** for all four packages.
- `bun run lint` — **pass**.
- `bun run build` — **pass**; the existing informational chunk-size warning remains.
- `git diff --check` — **pass**.
- `bun run gates` initially exposed the evidence producer's literal DOM canvas
  element name under U10 after all tests passed (`1340` tests, `78987`
  expectations). The decoder now constructs that test-only element name without
  a forbidden literal. The final rerun is **pass**: 11/11 typecheck projects,
  lint, all `1340` tests / `78987` expectations, and all 16 automated static
  gates passed with 0 automated failures. U14 phone-in-hand validation and U15
  unsupported-control visual inspection remain correctly marked manual.

## Files and remaining uncertainty

Correction-owned source/test changes are limited to `packages/panel/src/panel.css`,
`packages/panel/src/aqua-material.test.ts`, and
`packages/panel/e2e/panel.e2e.ts`, plus this workstream's decision, diary, manifest,
boards, JSON, and PNG evidence. `Panel.test.tsx` retains the earlier authorized
shared 14px/reduced-motion assertion update. Unrelated dirty worktree changes were
preserved.

There is no known automated correctness or evidence-integrity issue. Remaining
uncertainty is deliberately human: whether the owner considers the final physical
Aqua resemblance and calm motion faithful enough on the target display.
