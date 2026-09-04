# Review lanes

## Lane A — playback, navigation, and runtime performance

Independently inspect P1–P4. Reproduce and falsify race-order behavior, cache bounds,
priority/cancellation, duplicate requests, first-input navigation, progress advance,
pause/resume/skip, Apple-only entry, and SFX readiness. Treat any false buffering
claim, active-queue mutation during focus prefetch, uncaught MusicKit sequencing
error, or unbounded cache as Major or Critical according to blast radius.

Required artifact: `reviews/playback-performance.md` with severity-ranked findings,
commands, sanitized timing table, and explicit zero-findings statement if clean.

## Lane B — visual/material fidelity

Independently compare canonical 272×204 screenshots and DOM bounds to every supplied
physical-device photo. Audit whitespace—not only presence of parts. Measure titlebar,
left/right insets, artwork size/top, metadata line spacing, progress/times gaps,
bottom breathing room, eight-row density, dividers, chevrons, and scrollbar rail.
Verify count and loading shelf absence, progress-only Aqua pending state, skeleton
geometry, light/dark parity, truncation/marquee, and reduced motion.

Required artifact: `reviews/visual-material.md` with a measured reference-vs-build
table, screenshots, severity-ranked findings, and explicit zero-findings statement if
clean. “Looks close” is not an approval criterion.

## Merge posture

No lane may approve with unresolved Critical/Major findings. Minor findings require a
recorded disposition and evidence. Reviewers do not edit implementation code.

## Corrective lane C — Aqua loading remake

Review `aqua-loading-criteria.md`, the entire implementation diff, the normal and
reduced-motion computed styles, and every capture in `evidence/aqua-loading/`.
The equal-bar-height comparison board is the first visual artifact. Treat a
capsule silhouette, cyan/white dominance, broad wavelength, hidden rim, loop snap,
sub-2.8-second cadence, reduced-motion disappearance, or non-progress geometry
change as Major. Generic design preferences cannot override the supplied Aqua
reference. Required artifacts: `reviews/aqua-loading-pm.md` and
`reviews/aqua-loading-remake.md`.

## Lane D — playback controls and full click-wheel quadrants

Review `playback-fidelity-scope.md`, `research/playback-bars-quadrants-pm.md`,
`decisions-playback-fidelity.md`, the complete current diff, the implementation
diary, and every artifact in `evidence/playback-fidelity/`. The latest owner
direction is binding over the historical 5px Aqua approval.

Treat any 5px shared bar, non-Aqua determinate/volume fill, invisible human volume
change, stale overlay expiry, label-sized cardinal target, diagonal dead gap,
tap/rotation double action, shifted upper layout, `useState`, or weakened pending
semantics as Major or Critical according to blast radius. Independently run package
typechecks, scoped tests/lint, the full panel suite, and inspect the canonical and
full-device screenshots against `IMG_2280.HEIC` and `IMG_2281.HEIC`.

Required artifacts: `reviews/playback-fidelity-pm.md` and
`reviews/playback-fidelity-review.md`. Owner visual/timing approval remains open
after both written reviews pass.
