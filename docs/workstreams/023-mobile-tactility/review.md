# Review: Mobile framing and tactile input

## Verdict: APPROVE

Both implementation diaries and final evidence audited. No unresolved blocking finding. Physical tactility remains owner validation.

## Correctness check

- Source of truth: owner's mobile request, assigned scope, existing orientation/camera and human/WebMCP ownership contracts, canonical and installed web-haptics 0.0.6 source.
- Scope: framing, projected touch perimeter, human touch feedback and cleanup. The externally introduced `.gitignore` change is excluded from this review/task. No platform-decision registry was found under docs.
- Independent gates: `bunx tsc --noEmit -p` passed for apps/web, packages/composite and packages/device; scoped eslint passed for every changed TypeScript implementation file.
- Independent existing regression suite: 167 passed, 0 failed, 1,854 assertions across 19 files. Command: `bun test packages/composite/src packages/device/src/camera-fit.test.ts packages/device/src/orientation-grab.test.ts packages/device/src/orientation.test.ts apps/web/src/sticker-interaction-lifecycle.test.ts apps/web/src/sticker-motion.test.ts apps/web/src/sticker-editor-carry.test.tsx apps/web/src/sticker-grab.test.ts apps/web/src/device-orientation-motion.test.ts`.
- Traced upstream feedback publication: only positive, non-silenced budgets publish. New wheel subscription filters human touch and detent origin, excluding agent and inertial coast. Pointer contact haptics respect Hold; audio setting behavior is unchanged.
- Traced sticker capture admission, release sampling, detached threshold, valid docking intent, asynchronous persistence, supersession and cancellation. Feedback indicates admitted physical intent; asynchronous saves do not produce background success pulses. Shared tool/animation state can cancel but cannot trigger sticker feedback.
- Adapter is lazy, has no queued replay, bounds continuous feedback and cancels on blur/hidden/unmount. Installed library confirms cancel stops native vibration/fallback frames; destroy removes fallback controls. No changed type escapes, lint disables or useState.
- Staging can separate framing and haptics; the camera prop forwarding in CompositeDevice belongs with framing. No commits or publication requested.

## Visual and interaction evidence audit

Viewed 320×568, 390×844 and 844×390 screenshots, including final settled 390 portrait. Full shell and bottom controls are visible. Measurements derive projected envelope-corner NDC spans converted through canvas CSS dimensions: 390 phone width is 349.47px (89.6%), versus 263.18px (67.5%) before, a 32.8% increase. The 320 phone is 246.15px (76.9%), limited by available height. Rotated 45° pitch/yaw extents are inside the canvas and camera distance is unchanged. Audited the additional numerical yaw/pitch sweep: projected corners remain inside fitted limits at all three mobile canvas sizes.

The native touch probe reports shell admission 35 CSS pixels inside the edge and no shell admission at LCD, wheel or Select. Existing capture arbitration gives painted sticker input priority; the new front-face exclusions protect LCD and wheel even when decorative meshes are not event targets. Mouse still uses its original band. Explicit distance disables compact fitting and capture opts out.

Final probes explicitly settle the pose, removing earlier reset-spring residues: the shell touch moves yaw 14.7°/pitch 2.8°, while control probes keep zero orientation. The baseline reproduces previous camera/layout settings by browser response override, retaining current touch handling; it is valid for framing comparison but not a historical input comparison. Diagnostics refresh on viewport resize was the only final implementation adjustment after initial gates; independently reran device typecheck and scoped lint successfully.

Independently reran retained `evidence/haptics/browser-smoke.ts` against the local server. Native vibration spy observed button `[17,3,3,1]`, detent `[4,4]`, and cancellation `0`; unsupported mode emitted no pulses, hidden switch controls or browser errors. This uses the existing capture spike's shared production CompositeInputBoundary. Production framing/routing is separately covered above. The browser probe does not execute sticker pickup/peel/drop: those call sites have static ownership review and existing lifecycle regression coverage, not end-to-end haptic dispatch proof. Neither native motor output nor Safari fallback feel is proven by a vibration spy.

## Findings

None blocking. Scope, recorded choices, type/lint/doc gates and available evidence support approval within the limitations below. `git diff --check` also passed.

## Non-blocking limitations

- Physical motor feel remains owner validation. On Safari, these short patterns each reduce to a single fallback switch click; distinct vibration durations/intensities should not be claimed verified there.
- The scope intentionally runs existing tests and browser probes without adding unit tests.
