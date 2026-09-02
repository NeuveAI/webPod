# Diary: navigation and interaction

## 2026-09-02

- Read repo law, active workstream contracts, PM screen/navigation map and provider abstraction.
- Loaded the required interface, motion, accessibility, global-pattern, Jotai, router and modern-web guidance. Used `bunx` where the guidance named `npx`, because repo law is bun-only.
- Preserved concurrent device, token, provider and app edits. The pre-existing `Panel.tsx` raster multiplier edit was not reverted.
- Added typed route identity and exact-once semantic navigation intents to the external Jotai store.
- Added the provider-neutral relationship data seam and fixture adapter, then implemented the required browse graph and provider-backed track/station selection.
- Added the generic full-height list surface using the existing Aqua indicator.
- Added pointer and keyboard 600 ms Menu-hold handling while retaining tap-to-pop.
- Browser testing exposed duplicate Enter activation inside the composite; fixed it by separating composite-captured input from the bare-panel fallback.
- Verified the canonical flagged T1 route in Chrome. Visual completion remains owner-only.
- Independent review requested changes for fixture coupling, empty hard-coded search, unbranded relationship keys, label-driven routing, and a widened test literal.
- Corrected the slice in `e3492ef`: `Panel` now accepts the provider and navigation source at its rendered boundary; Now Playing subscribes and writes through that provider; search holds its query in the shared Jotai store, queries both library and catalogue, and re-resolves catalogue-only results; rows carry typed destinations; routes retain `LocalKey` identity.
- Added adversarial tests proving presentation-copy changes cannot change routing and a catalogue-only search result can play.
- Re-review closed those five findings and identified provider account posture as the remaining acceptance gap. Added provider-session subscription and typed S27 transitions for signed-out and playback-permission states; authorized sessions return to the capability-filtered root.

## Verification

- Targeted state/panel/composite tests: 340 pass, 0 fail.
- Full `bun run gates` after review correction: 11/11 TypeScript projects, lint clean, 1145 tests pass, 16 automated gates pass, 0 fail.
- Manual gates remain U14 and U15/owner visual sign-off.
