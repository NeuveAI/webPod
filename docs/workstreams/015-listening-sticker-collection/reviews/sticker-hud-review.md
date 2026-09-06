# Independent sticker HUD review

## Verdict: APPROVE — independent final validation completed

No remaining Major or Critical finding. Final reviewed fingerprint: `ca951f4625156b5b7fcda2ca1b9e656aec1d95b66eed2bbd0e1b2cf896c7d059` /395 files. Lead commit/clean-worktree closure remains pending. Chronological findings below preserve rejected assumptions and do not supersede this verdict.

The owner's latest screenshot and explicit rejection supersede the prior contextual-panel concept, including this reviewer's earlier design acceptance. The screenshot shows an inspector nearly as visually dominant as the print: repeated Rotation labels, a tab row, a horizontal slider and separate Move/Return actions. Styling or shortening that panel would not satisfy the new request. The replacement must surround the actual selected artwork with meaningful direct manipulation controls, animated as one spatially attached system. Prior wear/backend validation remains relevant; prior panel screenshots and assertion counts do not approve the replacement UI.

Reused Interface Craft critique/storyboard and all four Guardrails resources; explicitly applied Neuve Motion principles/reduced-motion guidance. Loaded the newly requested `/Users/vinicius/code/neuve_effect/.claude/skills/ios-hig/SKILL.md`, visual-design, motion-animation, accessibility and its `agent-context/ios-hig.md` cross-reference. Modern Web Guidance was searched first for direct-manipulation handles and accessibility guidance retrieved through Bun. These references support brief, interruptible motion, restrained controls, accessible targets and real focus behavior; they do not mandate replacing webPod materials with another product's theme or adding glass everywhere.

## Before-code acceptance contract

| Requirement | Independent design and implementation gate |
| --- | --- |
| Actual image-processing HUD | Selection traces the projected artwork quad, with corner size handles and edge/exterior rotation interaction. The sticker body still moves directly. No default Apply/Revert panel, mobile dock, generic property tabs or Move button. Context actions remain small and secondary. |
| Projection authority | All handles, hit regions and gesture mapping use the same current device transform as the print. Verify real rotated quad geometry, perspective and shell pose; no screen-axis bounding rectangle masquerading as rotated edges. Resizing a window or returning from a carry cannot leave stale controls. |
| Touch geometry |44px effective targets must not overlap competing handles, the body drag region, other stickers or context actions. At the minimum allowed sticker size, demonstrate a deliberate outward extension or reduced exposed handle set; four oversized coincident targets are not usable. Desktop and375px proof required. |
| Rotation and resize | Rotation unwraps through ±180° without a jump; corner resizing preserves visible-art aspect ratio and the chosen anchor/center semantics. Rear safe bounds remain valid with predictable edge resistance, without silent translations or invalid server values. Touch and mouse preserve initial grab offset. |
| Autosave and undo | One captured-source guarded save at gesture completion; no write on selection or every pointer move. Escape/pointer cancellation restores the active gesture without saving. Define pending-save supersession and one-level Undo precisely, including selection switch, queued writes, failure and409. Undo cannot overwrite another client's later revision. |
| Quiet failure recovery | No routine success banners. A failed save keeps a recoverable, clearly unsaved result with compact Retry/Undo recovery near the object. Pending completion after dismissal cannot revive old controls or ownership. Existing wear remains durable through return/re-stick/reload. |
| Keyboard and access | Progressive disclosure exposes named rotation/size/wear operations and values without forcing pointer gestures. Focus is visible/restored, Escape has stage-specific behavior, and hidden controls are not invisible focus traps. No flick/wheel-key leakage. Contrast, reduced transparency when used, enlarged text and reduced motion need actual evidence. |
| Dynamic motion | Inspect selection enter, handle engagement, direct manipulation, save/undo and dismissal at multiple actual frames. Motion establishes the relation to the print and is interruptible; live dragging is not delayed behind a spring. Reduced motion keeps immediate operation and clear state. No permanent frame loop, per-value shader rebuild or texture generation. |

Designer brief and exact geometry/persistence contract are required before implementation review. The small-sticker target layout and autosave/undo concurrency are the principal design risks to settle now. Semantic HTML and stable Jotai state remain the repo authority; review does not introduce another UI state owner.

## Geometry contract review before source dispatch

Read `sticker-hud-scope.md` in full and the remaining required iOS components-patterns guidance. The proposed actual conformed-geometry quad and frozen inverse editing plane are accepted directionally. UV order must produce visible rear TL/TR/BR/BL despite model negative axes; clockwise rear-view rotation must remain consistent under yaw/roll. The unbounded plane through the sticker center supports grips outside the shell, where shell ray intersection would fail. It approximates the curved surface and must not be described as its exact inverse. Preserve the initial mapped pointer offset so first movement cannot jump.

Require deterministic projected/inverse round trips, clockwise and ±180 transitions in physical BODY_W/BODY_H units, outboard grip mapping, and rejection of nonfinite/near-parallel rays, degenerate or behind-camera quads and zero resize radius. App cancellation on viewport, pose or visibility changes is part of the frozen-plane contract. These constraints were sent to lead and geometry engineer. Replacement designer brief and actual handle-layout review remain pending.

## Replacement designer brief review — before implementation

Read `sticker-hud-design-brief.md` in full. Accepted for the first implementation/render checkpoint: this is structurally the requested on-art transform tool, not a smaller inspector. One outboard resize grip and one edge-linked rotation grip at small sizes, measured44px pairwise exclusions, direct body drag, compact contextual wear/Undo and no selection reframe resolve the primary conceptual risks. Gesture-end save, captured-source dispatch guards, authoritative failure recovery and one guarded Undo are specified coherently.

Two implementation invariants were sent to the designer and lead: “fixed layout during gesture” freezes the chosen side/corner and outboard layout policy, while the actual projected frame and active grip still follow the draft; and a same-sticker pending-save lock must survive dismissal/reselection, rather than living only in the currently mounted HUD. First native desktop/375px small/edge prints must prove actual hit-region non-overlap and dynamic enter/active/release/exit before broad test expansion. No remaining preimplementation design blocker identified; final visual and behavioral acceptance stays PENDING.

## Independent geometry checkpoint

Read the frozen `sticker-transform-projection.ts` helper, tests and optional device contract. Verified content-inverse × camera-world × projection-inverse ordering, frozen matrix/viewport copies, unbounded plane intersection, normalized negative rear axes, actual UV corner/edge/center sampling and fail-closed handling for invalid/degenerate/behind-camera projection. No concrete helper blocker found. The approximation and app cancellation responsibilities remain explicit.

Independent command `bun test packages/device/src/sticker-transform-projection.test.ts packages/device/src/sticker-projected-bounds.test.ts` passed **5 tests / 41 assertions in29ms**, and scoped ESLint for the new helper/tests passed. Logs: `evidence/sticker-hud/reviewer/geometry-tests.log` and `geometry-lint.log`. Cases include real rear artwork order, perspective/orthographic inverse round trips, outboard coordinates, frozen snapshots, edge-on/singular rejection and clockwise179→−179 producing+2° under yaw/roll. App start-offset, zero-radius, gesture cancellation, handle collisions and rendered continuity remain pending integration proof.

## Initial HUD source checkpoint — unfinished implementation

Read the replacement model, HUD and collision-layout source while the implementer prepares the first actual render. Two concrete issues were sent directly to UI engineer and lead before final freeze:

- Active grips add a frozen screen-space offset to the changing corner/edge, while rotation/resize is computed from the original outboard pointer. A90° rotation of a top grip offset42px leaves its rendered offset pointing upward instead of following the pointer around the center (roughly59px drift). Resize similarly diverges by(scale−1)×offset. Preserve pointer/grip contact with a meaningful connector to the actual changing edge; prove large-angle/scale native alignment, not merely initial continuity.
- Save success handles only a still-present saved placement. If concurrent reconciliation removes that sticker while awaiting save, the pending map clears but a same-ID current HUD can remain permanently in saving phase with the old draft. Require missing-source dismissal/recovery without reviving another selection, and a deterministic regression.

The layout's unchecked fallback also needs explicit small/edge viewport validation; passing the scored candidate path alone does not prove fallback reachability. These are in-progress findings, not a final verdict or approval of the initial UI.

## Browser-found geometry correction

The first native admission exposed a DOMRect compatibility bug: object spread and Object.values ignore inherited browser rectangle getters. The initial plain-object geometry fixtures did not prove compatibility with the actual canvas DOMRect. The engineer replaced both validation and snapshotting with explicit left/top/width/height access. Independently inspected that correction and its prototype-getter round-trip/frozen-value/nonfinite regression, then reran the helper/bounds suite: **6 tests / 46 assertions passed** (`evidence/sticker-hud/reviewer/geometry-domrect-tests.log`). This supersedes the initial geometry checkpoint; rebuilt actual browser manipulation is still required. The failed assumption is preserved rather than hidden by the earlier green unit count.

## First actual HUD visual checkpoint

Independently opened all six `evidence/sticker-hud/first-render/` images: desktop enter, selected, rotate-active, release and exit, plus mobile-selected. The concept is accepted for continued implementation: the actual print and its surrounding quad visibly rotate together; a distinct edge-linked rotation grip and corner resize grip surround the artwork; contextual icons replace the rejected inspector. The375px capture retains the device pose and shows accessible-size controls within the viewport. This is an initial concept judgment, not final interaction or motion approval.

Two visible issues remain before final readiness. The mobile toolbar covers part of the other Soundcheck sticker despite available space below the selected Pulse Code; prefer an available placement avoiding other prints. The rotation grip moves about45px between the active and release frames, so its return to rest needs the bounded settling already planned by the implementer. Enter and exit show changed handle opacity, but the exit still retains an almost opaque toolbar and outline; final actual frames must demonstrate coordinated complete dismissal and idle settlement. Stills alone do not prove smooth frame timing or continuous pointer attachment. These findings were sent to lead and UI engineer; broad native coverage may proceed, with final review still PENDING.

## Updated motion checkpoint — still before source freeze

The refreshed mobile-selected image avoids Soundcheck while keeping the selected print and two grips accessible. Inspected representative frames from the actual4.52s `first-render/video/page@069aca7378cb5f0ad058e887a981511a.webm` recording, including cropped100ms samples of the rotation/release interval. Artwork and quad rotate together; the active grip remains linked to the changing edge and returns toward rest. The recording changes viewport shortly afterward, so it is not isolated proof of complete desktop exit timing or final idle behavior.

Source now applies presence opacity to the entire HUD. Presence and release use bounded, cleaned-up RAF owners, with immediate reduced-motion handling. One concrete new lifecycle issue was reported: the release atom stores a screen origin and gesture kind without sticker identity, and selection change does not clear it. Selecting another sticker during release can apply the old pointer origin to the new sticker's grip. Scope or cancel that release on actual identity change while retaining same-ID save settling. Final review remains pending source correction and native coverage; no browser or heavy build was run during the implementer's active slot.

## Escape cancellation source checkpoint

The broader native probe exposed a real outside-HUD Escape bug: reverting only the draft left the active pointer owner alive and allowed pointerup to save again. Independently read the correction. The shared cancellation atom synchronously reaches the mounted store subscription; cancellation nulls `drag.current` before draft reset and capture release. Lost-capture sees no owner and does not recurse; later transform-handle pointerup exits without submission. Selection changes now clear the release atom, resolving cross-sticker release retargeting. These source corrections are sound for transform handles, with focused native zero-write proof still required.

Requested equivalent cancellation coverage for the progressive native range: its change and pointerup handlers do not use the transform drag owner, so Escape while held followed by further native range movement must not restart the canceled edit. This is an integration check, not a claim that handle cancellation proof covers every input path.

## Broader candidate review —105 assertions reported, not final freeze

Read the current actual-route test and metadata (`aa3ab910…0834c`,396 files), without launching a competing browser. The native range Escape case counts placement PUTs before and after continued movement/release and verifies unchanged wear. The handle cancellation case verifies canonical angle; requested the same zero-additional-PUT invariant so a redundant reverted-value write cannot pass unnoticed. Fresh `implementer/mobile-small-sticker.png` shows separated outboard grips and an unobstructed tiny print; `desktop-save-failure.png` shows compact local Retry recovery without a large panel.

One remaining range lifecycle defect was confirmed by the implementer: pointercancel terminates a pointer sequence without pointerup, but the cancellation latch remains set and rejects later keyboard changes. Reset after real pointercancel and admit a fresh keyboard gesture; preserve the Escape latch only through the still-held pointer sequence. Correction is queued after the isolated legacy diagnostic to preserve its source provenance. Body movement, return/re-stick and rapid retarget proof remain pending; this candidate is not frozen or independently approved.

## Independent frozen validation —2026-09-06

Source independently recomputed as `7df5a50a263b8913ca76e5edf2ed58ba9a7f9e9324fe71289166145c38d1b591` /395 files, matching the final build/native fixture. Fingerprint algorithm includes working-tree app/package/test bytes and excludes docs/secrets; no credential material was read. Reviewer evidence is isolated under `evidence/sticker-hud/reviewer/`.

- Actual Start/SQLite HUD native: **123 assertions,15.62s, PASS**, own `native.log` and `native/` screenshots/video/metadata.
- Actual restoration native: **85 assertions,5.71s, PASS**, own `restoration.log` and `restoration/` captures. Independently viewed cold valid-cookie saved artwork before MusicKit setup.
- Model/runtime/music/projection/bounds/wear/program-preparation/appearance/repository/live tests: **79 tests,1,983 assertions, PASS** in `targeted-tests.log`.
- Web/device/server-core/stickers typechecks, scoped changed-source ESLint and `git diff --check`: **PASS**, `types.log` and `lint.log`.

Inspected own actual enter, quarter-turn, uninterrupted release-mid, exit/dismissed, tiny375px controls, selected-body carry, returned worn sheet and reloaded worn rear captures. Colored ink remains visible and normal-scale wear survives return/re-stick; native shader-error gate passes. Expected503/409 fixture responses, favicon404 and existing Three.Clock deprecation appear in the retained console log; there are no shader compilation errors. Full dismissal removes the toolbar/handles; the small remaining native focus indicator is not a stale HUD. The reduced-motion capture also exercises increased contrast and retains legible outlines/actions.

All earlier concrete source findings are corrected: DOMRect getter handling, active grip tracking, missing-source save completion, cross-sticker release cancellation, outside-focus Escape ownership, native range cancel-until-release and pointercancel-to-keyboard recovery. Native handle and range cancellations now assert zero extra writes. Pending lock, guarded Undo/retry/conflict handling, actual selected-body movement and durable owned wear are exercised. Independent final idle-evidence coverage is being clarified before the verdict; no blanket FPS claim follows from the green tests.

Legacy regression evidence was read:188 assertions passed in35.97s at its recorded earlier HUD snapshot, with keyboard placement→return control→successful PUT→close→sign-in checkpoints. This does not explain the historical120s timeout. Later bounded HUD cancellation changes are directly exercised by the final independent native; no evidence currently warrants another broad legacy run. Preserve the failed historical run and describe its cause as unknown, not fixed by a timeout adjustment.

## Final measured-idle gate and verdict

Independently compared pre/post per-file manifests: **only `apps/web/scripts/sticker-hud.integration.test.ts` changed** after the previously independently validated product. Its test-owned WebGL instrumentation wraps standard draw entry points before context creation, preserves receivers/arguments through Reflect.apply, and proves a positive active-render control. No product testing API or build change was introduced. Prior restoration/types/material/domain results remain applicable without redundant reruns.

Ran the amended actual-route native independently: **130 assertions,18.75s,PASS** (`reviewer/final-idle.log`). Own `final-idle/settled-hud-idle.json` records active transformation draws **539→1097**, then settled open HUD **1717→1717 over3002.4ms**, with one HUD and presence1.000. This proves no repeated WebGL draw activity during that measured idle interval; it is not a claim that every browser RAF callback stops or a compositor latency benchmark. Source review separately confirms bounded HUD spring owners and cleanup. Independently recomputed final fingerprint matches `ca951f…d059` /395. Native resource-disposal assertions passed and the reviewer runner exited; browser/build slot is released.

The replacement meets the owner's on-object editing direction: actual projected frame and distinct connected grips, direct body movement, bounded release/enter/exit, compact progressive wear controls, guarded gesture saves/Undo and durable appearance. Desktop/375px captures show actual ink and wear rather than an empty shader rectangle. Reduced motion plus increased contrast was exercised; near-opaque95% controls with no backdrop blur supply a permanent legible background. No dedicated reduced-transparency media variant or physical Safari validation is claimed. Small-print icon semantics depend on conventional symbols and accessible names/tooltips; they are intentionally concise. Tiny carried prints and native focus outlines are visually utilitarian limits, not missing mechanics.

Product fidelity **4/5**; direct manipulation/spatial coherence **4/5**; material fidelity **4/5**; motion **4/5**; accessible control clarity **4/5** within tested Chromium mouse/touch/keyboard contexts. These judgments do not claim perfect polish or universal performance. **APPROVE for lead integration**, with commit/clean-worktree confirmation pending. Historical panel rejection, GLSL failure, DOMRect assumption and unexplained earlier legacy timeout remain documented.

## Evidence plan and honest limits

Read final scope and replacement brief when delivered. Independently inspect coherent source checkpoints without editing them or competing for the active browser/build slot. At freeze, run relevant model/runtime/material and native editor/restoration gates on a recorded fingerprint. Inspect actual normal-size desktop/375px artwork, edge/corner controls, wear and motion frames, plus transparent margins, near-edge/overlap cases, cancellation, failed/delayed/409 saves and Undo.

Preserve the prior panel's rejected concept, first shader-failure captures and unresolved legacy direct-regression timeout as history. Do not erase or equate them with resolved new acceptance. Reuse only unchanged domain evidence with explicit provenance. No unrelated canonical startup rerun; no physical Safari or live Apple certification from Chromium synthetic fixtures. Lead owns final implementation commits and cleanup. Final quality scores remain pending actual replacement renders.
