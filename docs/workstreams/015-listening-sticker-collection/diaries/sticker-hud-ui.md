# Sticker HUD diary

## 2026-09-06 — replacement designer phase

The owner rejected the uncommitted contextual editor panel and requested an animated image-editor HUD directly around the print. This changes the chosen interaction, not merely the old panel's styling. Old editor evidence and diary remain intact, including the rejected blank-art shader capture and subsequently validated durable wear.

Owned combined native runner session 69344 completed exit 1 and cleanup before this phase. Its editor and restoration suites passed; the older collection regression timed out at 120 seconds. Last completed capture was mobile-keyboard-stuck; the exact blocking await has not been established. No global timeout increase or transient-failure claim. No owned browser/build process remains from that run.

Read the new sticker-hud-scope.md, owner rejection screenshot c4fb6b49, mandatory iOS HIG skill plus visual/motion/components/accessibility and agent-context, and Neuve tokens/storyboard integration. Reused fully loaded Interface Craft/Guardrails/Jotai/global references. Executed Modern Web Guidance via bunx search before this replacement design and retrieved forms. Exact sources/adaptations are recorded in sticker-hud-design-brief.md.

Submitted the replacement brief before source changes. Projected quad with explicit resize/rotate handles, collision-aware outboard44px targets, direct body drag, compact wear/return/Undo; no panel, dock, selection reframe or Apply form. Gesture-end guarded mutation and guarded inverse Undo retain server authority. Geometry engineer owns quad/frozen unbounded plane helper; app scene integration waits for handoff. First actual render review is required before long test expansion.

## Implementation and first actual render

The replacement brief passed independent review before implementation. Replaced the old UI with actual UV-ordered projected outline, outboard corner/edge controls and four small icon actions. Direct transforms use the captured unbounded plane; body movement retains existing peel/press. The shared draft overlays one saved placement; a per-sticker pending map survives dismissal/re-selection. Gesture-end writes and Undo pass captured source to the existing serialized runtime guard. Routine success/partial notices remain visually absent.

First real native rotation exposed a geometry defect: spreading a native DOMRect lost its prototype getter fields, so the inverse-plane handle existed but returned null points. Geometry engineer fixed explicit field copying/validation and added a getter-backed regression. The first working native probe passed19 assertions and its desktop/375 renders passed concept review before broader fixture work.

Review then corrected active outboard-grip drift (grip now stays at actual pointer with a connector to the changing quad), missing-authoritative-source success cleanup, release state leaking across selected IDs, and overlap with another placed print. During manipulation only the active grip remains exposed; inactive grips return after release. Resting target layout tests cover minimum/normal print sizes and viewport-edge placements. HUD presence and grip release have bounded interruptible springs; direct manipulated coordinates never use a spring. Removed selection-induced device framing and unused dock API; retained only the physical post-carry framing settle.

Native large-angle tests exposed a separate Escape ordering defect: when focus was outside the HUD, the document handler reverted the draft but retained captured pointer state, allowing pointerup to reapply it. A synchronous Jotai cancellation subscription now clears the gesture owner before restoring and releasing capture. Native wear input additionally ignores further input until the escaped pointer releases; actual pointercancel ends that lane immediately and fresh keyboard input can start again. Tests assert no additional PUT on both cancellation paths.

## Final implementer verification — source frozen

Runtime source fingerprint: `7df5a50a263b8913ca76e5edf2ed58ba9a7f9e9324fe71289166145c38d1b591`,395 files. Built server entry SHA256: `2c299ef943e44d9412c95ccf5e090f8cf78094c2dbf38e414ac650727e68ecb9`.

- HUD native actual route/cookie/SQLite:123 assertions,15.93s. Covers actual90° grip following, one gesture write, Undo, Escape no-write,503 retry,409 reconciliation, pending dismissal/reselection lock, wear, native touch resize/minimum hit targets, pointercancel then keyboard, selected body lift/move, return to own worn sheet, re-stick/reload, and rapid retarget.
- Registered-session restoration native:85 assertions,5.44s. Existing DB hydration remains independent of held/failing Apple ingestion.
- App model/runtime/status/layout suite:27 tests,1279 assertions. App/device typechecks, scoped ESLint and git diff whitespace check pass.
- Geometry helper independent lane:6 tests,46 assertions. Durable wear/material lane retained and previously independently validated.
- Legacy collection regression diagnostic:188 assertions,35.97s at the preceding HUD snapshot. The old120s timeout was not reproduced; no causal product fix is claimed. Checkpoints, original failed log and exact snapshot are in the separate legacy diary/evidence.

Evidence: `../evidence/sticker-hud/final/` and `../evidence/sticker-hud/restoration/`. Final stills include uninterrupted release→release-mid before the distinct rapid-retarget case,90° active rotation, fully dismissed HUD,375 minimum targets, actual carry and unobscured worn re-stick/reload. Inspected those images at their normal sizes. Latest actual-route motion recording: `../evidence/sticker-hud/final/video/page@c952d8981b34aed77eed54ca17e90d23.webm`. Earlier captures remain chronology, not alternate final proof. Reduced-motion HUD was tested by changing media during the T1 session; before the reload proof the fixture restores normal media because the existing composite bootstrap deliberately chooses T4 when reduced motion is initially requested. No bootstrap policy change is claimed.

Removed the superseded uncommitted `apps/web/scripts/sticker-editor.integration.test.ts`; its old panel selectors are not a runnable test gate. Kept reusable state tests with gesture-save/cancel expectations and removed unused analytical panel bounds/dock contracts. Historical rejected panel brief, diary and screenshots remain intact. Source and all owned build/browser processes were released to the independent reviewer. Only this diary was edited after source freeze; no commits or live owner browser/session changes.

Independent commands: `WEBPOD_STICKER_HUD_EVIDENCE_DIR=<absolute-output-directory> bun test apps/web/scripts/sticker-hud.integration.test.ts` and `WEBPOD_STICKER_RESTORATION_EVIDENCE_DIR=<absolute-output-directory> bun test apps/web/scripts/sticker-restoration.integration.test.ts`. Independent approval is still required; implementer test success is not final acceptance.

## Final coverage amendment — measured idle, no product changes

After independent native/source checks passed, review requested measured idle evidence in addition to bounded source lifetimes. Recorded a395-file pre-amendment SHA256 manifest, then changed only `apps/web/scripts/sticker-hud.integration.test.ts`. The amended browser fixture installs wrappers for standard WebGL1/2 draw methods before context creation; it first proves active native rotation increases the counter, then observes the settled/open HUD for three seconds. It adds no product API or runtime branch.

Result: rotation539→1097 draw calls; settled HUD1841→1841 over3002.5ms, with exactly one HUD and presence1.000. The amended full native suite passes130 assertions in18.93s; app types and scoped fixture lint pass. The source aggregate changes to `ca951f4625156b5b7fcda2ca1b9e656aec1d95b66eed2bbd0e1b2cf896c7d059`/395 because its hashing includes native fixtures. `evidence/sticker-hud/idle-proof/manifest-after-idle.json` confirms the fixture is the sole changed file. Product and built server bytes are unchanged, so their previous verification remains applicable. Reviewer receives the free browser slot for one amended native rerun; no repeated server/restoration suite is required by this test-only delta.

Increased contrast is exercised together with reduced motion in the native mobile capture. Controls already use a95%-opaque neutral surface without backdrop-filter; this remains the same near-opaque readable treatment when reduced transparency is requested. There is no separate reduced-transparency visual mode or unimplemented glass effect being claimed. The idle measurement establishes no WebGL draws in the sampled settled window; source review separately establishes finite HUD RAF lifetimes. It does not claim that all unrelated browser callbacks cease.
