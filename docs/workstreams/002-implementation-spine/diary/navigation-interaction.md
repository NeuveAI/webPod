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
- Re-review closed those five findings and identified provider account posture as the remaining acceptance gap. Added provider-session subscription and typed S27 transitions for signed-out and playback-unavailable states; authorized sessions return to the capability-filtered root.
- Final focused re-review approved the slice after the status transition and U8-safe `playback-unavailable` vocabulary landed.

## Verification

- Targeted state/panel/composite tests: 340 pass, 0 fail.
- Full `bun run gates` after final review correction: 11/11 TypeScript projects, lint clean, 1146 tests pass, 16 automated gates pass, 0 fail.
- Manual gates remain U14 and U15/owner visual sign-off.

## 2026-09-03 — owner visual rejection

- Owner comparison of Playlists, Albums and Artists overturned the earlier automated approval: sibling list screens had inconsistent row geometry and Playlists/Artists lacked visible Aqua current state.
- Root cause: three bespoke row/list renderers plus `screenId === 'S08'` dispatch, which sent the Albums collection through the nested-track layout.
- Replaced menu, browser and track list markup with exported `ListViewport` and `ListRow` primitives. Typed routes now distinguish album collections from nested track lists.
- Removed TanStack Virtual and all sibling list/row selectors; the state machine already provides an eight-row authoritative window, so a second browser scroll machine was redundant.
- Added structural, wheel-current, capacity/scrollbar, truncation/material and preview-tracking tests. Owner aesthetic approval remains explicitly open pending the new screenshot set.

## Reopened-slice verification

- Full `bun run gates`: 11/11 TypeScript projects, lint clean, 1152 tests pass, 16 automated gates pass, 0 fail.
- Full panel Playwright suite: 16 pass, 0 fail.
- Captured the five sibling `/_spike/device` list screens at 1280×633 plus an explicit 42-row overflow screen at 800×638; all retain the same rendered device scale and 272×204 authored panel raster.
- Manual gates U14 and U15/owner visual sign-off remain open; the screenshots are evidence for that review, not an aesthetic approval claim.
