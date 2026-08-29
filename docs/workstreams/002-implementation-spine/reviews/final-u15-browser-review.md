# Final U15 browser review

## Verdict: APPROVE — 0 Critical, 0 Major, 1 Minor

U15 passes on the current MVP. In both colourways, the Apple-shaped fixture omits unsupported controls rather than rendering disabled substitutes. The HTML-in-canvas `T1` path remains navigable by pointer click-wheel and keyboard, retains focus across input methods, and stays on the front device without an automatic flip, error route, canvas loss, or page error.

The review covered S03, S08, S13, the S13 centre-mode cycle, and the permission-denied playback state. Across those states there were zero disabled controls and no visible lyrics, playlist remove/reorder, queue remove/reorder, or downloaded-only affordance. Permission denial removes playback actions and supplies guidance instead of leaving inert controls.

The current T1 device/panel is usable: track identity and actions are legible, centre and Menu/Back navigation work, a physical annulus gesture changes selection, and keyboard navigation continues immediately afterward. Evidence and exact observations are in [runtime-observations.md](../evidence/final-u15-browser/runtime-observations.md).

### Minor

- Axe reported `aria-prohibited-attr` as incomplete—not a violation—on five passive S13 status labels implemented as labelled `div`/`span` nodes. This does not expose or disable an unsupported capability, and S13 remained keyboard-usable with zero Axe violations, but those labels should receive semantics Axe can resolve in a later accessibility pass.

### Explicit exclusions

- This review does not claim U14 or clear H-5.
- This review does not make the owner-only H-6 aesthetic judgment.
- The flag-off browser currently detects T3 and has no rendered device fallback. That remains the explicitly deferred RISK-01 boundary; this approval is for U15 on the MVP's T1 main path, not for T2–T4 fallback readiness.
