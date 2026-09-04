# Aqua cylinder and molded-trough correction — independent review

Date: 2026-09-05
Reviewer: independent antagonistic visual/code reviewer
Verdict: **APPROVE**

## Findings

No unresolved Critical, Major, or Minor findings.

The owner-only visual/physical acceptance gate remains open by design. This
approval means the current candidate satisfies the binding implementation,
rendered-pixel, evidence, and accessibility contracts; it does not substitute for
the owner's final subjective judgment of period resemblance on the target display.

## Correctness target and scope

I reviewed only the reopened shared Aqua material lane in workstream 005: the
14px progress/loading/volume geometry, cylindrical fill, molded trough, loading
rib motion, reduced-motion state, tests, and regenerated evidence. The governing
requirements are D005-12/D005-13, DPF-10/DPF-11, and the corrected PM contract,
including its loop-closure clarification at
`research/playback-bars-quadrants-pm.md:174-183`.

The correction-owned implementation is confined to:

- `packages/panel/src/panel.css`
- `packages/panel/src/aqua-material.test.ts`
- `packages/panel/e2e/panel.e2e.ts`
- the corresponding workstream-005 diary, decision, manifest, board, JSON, and
  PNG evidence

`Panel.test.tsx` contains the previously authorized shared-height and
reduced-motion assertion update. I found no correction-specific provider, state,
queue, scrub, click-wheel, authentication, or production-route change. Existing
unrelated dirty-worktree changes were preserved. I did not inspect `cert/` or
`design.pen`, and I did not invoke a nonexistent Neuve shell.

## Code and contract audit

The current CSS implements the contract rather than merely resembling it in
tokens:

- `packages/panel/src/panel.css:48-78` defines a 3.2s cadence, 45-degree ribs,
  22px projected cycle, 50/50 7.78px stops, distinct molded-lip/channel layers,
  theme-resolved shadow alphas, and the shared five-stop cylinder.
- `packages/panel/src/panel.css:207-226` keeps progress and volume at one
  layered, borderless molded trough; the indeterminate pseudo-element stays
  inside the 1px inset and does not move its rounded ends, cylinder, or
  specular layer.
- `packages/panel/src/panel.css:250` advances only the rib layer's
  `background-position` by one exact 22px phase. This follows the PM's explicit
  rendered-closure adjudication. `packages/panel/src/panel.css:276` removes the
  animation and retains a visible 11px representative phase under reduced
  motion.
- Volume has no width transition while determinate playback retains its scoped
  120ms interpolation (`packages/panel/src/panel.css:212-214`). Loading remains
  pending-only and leaves the semantic indeterminate progressbar intact.

The assertions are not gradient-presence theater. The source-level mutation
tests reject the wrong diagonal, wrong period, wrong duty, fast cadence, excess
radius, cyan/low-contrast ribs, hidden reduced-motion material, uniform border,
missing concavity/cylinder, and a hard lower fill band
(`packages/panel/src/aqua-material.test.ts:128-204` and `:280-298`). The browser
producer then tests rendered pixels, including actual phase images, vertical fill
profiles, horizontal transitions, exterior shadow falloff, and corner occupancy
(`packages/panel/e2e/panel.e2e.ts:597-927`). Thus the acceptance result cannot be
obtained merely by retaining a CSS gradient string.

## Adversarial issue resolved during review

The first correction was not accepted. Two isolated replays found a maximum
t0-to-full-phase RGB delta of **15**. The maximum first appeared at the stable
interior's left boundary and moved to the right after the finite texture was
extended. A static 22px element offset reproduced the same pixels, while keeping
the pseudo-element fixed and shifting only the rib background by 22px produced
an exact zero delta. This falsified the claim that the mismatch was just the
gradient period or incidental compositor noise: the translated finite pseudo's
rounded/specular edge was entering the sampled channel.

After PM clarification, the implementation was changed to stationary material
geometry with rib-only background-position animation. The final current-source
replay closes with maximum RGB-channel delta **0** over the full **464x24** stable
interior and resolves the midpoint to exactly **11 authored pixels**. The
correction diary records this diagnosis and supersedes the transform-era entries
in the historical parent diary.

## Visual and pixel evidence

I inspected the primary Aqua source and owner-rejected anti-reference directly,
then inspected `outer-trough-comparison.png`, its candidate closeups/corner crops,
the full reference board, canonical dark/light captures, and the full production
mobile/desktop progress/loading/volume frames at original detail.

The current candidate does not reproduce the rejected flat frame:

- the top/left lip is visibly brighter than the lower/right return;
- a dark recess seam remains distinguishable from the concave empty channel;
- the cast shadow is detached and softens below the object rather than becoming
  a hard last row;
- determinate and volume fills have a pale top, darker midpoint waist, and pale
  lower roll-off, with crisp value endpoints rather than squared flat slabs;
- loading's blue and light ribs retain the same cylinder modulation, remain
  clipped within the molded ends, and show no glow, bloom, paint escape, or fake
  grain;
- progress, loading, and volume are equal-height objects in both canonical and
  production-device contexts.

The final screenshot-derived evidence confirms:

- 28px outer / 24px inner geometry at 2x (14px / 12px authored);
- identical progress/volume sampled profiles, with top-minus-waist `81.12`,
  bottom-minus-waist `63.55`, darkest-row fraction `0.5208`, and maximum isolated
  discontinuity `9.42`;
- curved loading ribs, with top-minus-waist `42.54/40.06` and
  bottom-minus-waist `41.33/37.84` for blue/light;
- empty-channel range `24.35`, four 8-point bins, maximum adjacent jump `5.93`,
  lower-seam darkening `13.07`, and measured left/right transitions `4/4px`;
- distinct perimeter values and asymmetric corners, with seam contrasts
  `125.06/100.13` and left-highlight-over-right-return `58.42`;
- two-stage dark/light exterior shadow peaks within the binding 8-35 range and
  monotonically fading sampled rows.

The refreshed board postdates the final HTML/closeup assembly, and the README,
manifest, JSON, board table, and correction diary now agree. The manifest names
the animation field `ribBackgroundPositionDisplacementPx`, avoiding the earlier
false implication that the whole pseudo-element translates.

## Independent verification

Commands run against the final working tree:

- `bun test packages/panel/src/aqua-material.test.ts packages/panel/src/Panel.integration.test.tsx packages/panel/src/Panel.test.tsx` — **59 passed, 0 failed**, 382 expectations.
- `bunx --bun tsc --noEmit -p packages/panel/tsconfig.json` — **pass**.
- `bun run lint` — **pass**.
- `git diff --check` — **pass**.
- Private isolated Playwright replay with a unique `TMPDIR`, port, and evidence
  directory, grepping standard geometry, starting playback, determinate playback,
  volume feedback, and captured Aqua cross-sections — **5 passed in 13.2s** at
  served-source fingerprint
  `60397bef90e4e87c6a408164c2888f00941b517c29cfe8586407e44ba19ffdfe`.
- `bun run gates` — **11/11** typecheck projects, lint pass, **1340/1340** tests
  with 78,987 expectations, and **16/16** automated gates; U14/U15 remain
  correctly manual.

The frozen packet additionally records a full panel Playwright result of **21/21**
and production-device capture result of **2/2**. My current-source focused replay
independently covers every corrected material and motion path rather than relying
only on those reported totals.

## Dependency and HITL disposition

The implementation and evidence satisfy the objective parts of D005-12,
D005-13, DPF-10, and DPF-11. Reduced motion is functional, not blank; no new
interactive control or accessibility regression was introduced. The current
stationary-pseudo mechanism is intentionally permitted by the PM clarification
because exact rendered closure outranks a generic transform-only preference for
this tiny textured surface.

U14 phone-in-hand occlusion/feel, U15 unsupported-control inspection, and final
owner approval of Aqua resemblance and perceived 3.2s calmness remain manual.
Those open human decisions do not conceal an automated or reviewer finding.
