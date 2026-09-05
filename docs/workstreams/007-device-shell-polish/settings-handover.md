# Settings activation handover

Implemented a closed-by-default Settings dialog on the existing production route, with only Reset view and Settings in the footer. Device finish, room lighting, interaction sound, Apple account actions, and existing diagnostic tools now require activation. No fake shuffle/repeat/backlight/assistant controls were introduced. The geometry engineer independently removed the baked rear composition.

## Decisions
- Native `dialog.showModal()` provides top-layer presentation and inert background. Escape and visible Close both synchronize to the Jotai store and restore trigger focus. Boundary Tab handling retains focus within the currently visible controls; collapsed diagnostic details are excluded. Unmount resets visibility.
- `deviceSettingsStore`, `settingsOpenAtom`, and `interactionAudioEnabledAtom` are exported for imperative callers. The real CompositeDevice audio-enabled prop receives the Jotai audio preference. Existing orientation/provider stores remain untouched.
- Kept the modal dark in both rooms, so finish/room changes preview behind it without altering control contrast. Existing light toolbar CSS now targets direct-child toolbar buttons to prevent modal contrast regressions. Controls inside the dialog have 44px targets, visible focus, pressed state, and mobile scrolling.
- Existing PlaybackDiagnostics and account actions retain their behavior through the menu. The user's dirty route/panel changes are preserved. No changes to the dirty deterministic fixture or player-direct-manipulation test.
- Followed modern-web-guidance modal guidance, consulted shadcn dialog docs and the empty packages/ui exports, chose native platform primitive without adding a UI framework. Used Tailwind for the new dialog structure and scoped route CSS to integrate existing controls.
- Added direct app dependency on the already-installed Jotai 2.20.3. `bun add` tried resolving unrelated newer ranges and was blocked by minimum-release-age. Updated only the app manifest and matching lock workspace edge to the existing resolution; frozen install passes with no package changes.

## Verification
- `bunx tsc --noEmit -p apps/web/tsconfig.json`: PASS.
- `bunx --bun eslint` on device-settings.tsx, route, new settings browser test, and both adapted tests: PASS.
- `bun test apps/web/src/playback-diagnostics-view.test.tsx`: 2 PASS / 15 assertions.
- `bun install --frozen-lockfile --ignore-scripts`: PASS, 277 installs checked, no changes.
- `bun packages/panel/node_modules/@playwright/test/cli.js test --config apps/web/tests/playwright.config.ts apps/web/tests/settings-menu.e2e.ts apps/web/tests/device-orientation.e2e.ts apps/web/tests/playback-error-presentation.e2e.ts --grep 'settings|pointer cancellation|Apple runtime failure'`: 5 PASS (14.1s), source fingerprint `475427b2cf43001c11a426a8f025f9408a74327c5f96436e7ded5e215aa17077`, 239 files.
- New browser cases cover initial closed state, pointer/Enter/Space activation, Close/Escape, focus return, Tab containment, persisted preferences, light-room contrast, 390px viewport, keyboard isolation while open, resumed keyboard rotation, reset, and real provider transport callback after dismissal. Existing adapted cases prove pointer capture cancellation/appearance preservation and Apple token-failure retry through Settings.
- Earlier Tab test exposed controls inside closed details still having client rectangles; excluded those controls. Earlier transport test expected playback from a fixture whose play intentionally never resolves; new case overrides transport methods locally to emit deterministic real provider state. These are fixed and the final five cases pass.
- Visual inspection of evidence confirms readable contrast in both rooms and mobile fit. Evidence: `evidence/settings/settings-closed.png`, `settings-open-dark.png`, `settings-open.png` (light room), `settings-mobile.png`.

## Files
Stage settings independently using apps/web/src/device-settings.tsx, route hunks for Settings only, apps/web/package.json, bun.lock, apps/web/tests/settings-menu.e2e.ts, the two small existing browser-test activation changes, and this handover/evidence. The route also contains user-owned dirty changes; do not stage the entire route without reviewing its hunks. No commits made.
