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

## Verification

- Targeted state/panel/composite tests: 340 pass, 0 fail.
- Full `bun run gates`: 11/11 TypeScript projects, lint clean, 1141 tests pass, 16 automated gates pass, 0 fail.
- Manual gates remain U14 and U15/owner visual sign-off.

