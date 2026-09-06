# Contour UI diary

## Design checkpoint

Read full sticker-contour-scope.md before source. Replacement brief reviewed before implementation; reviewer accepted direction for an early actual render, not final visual approval. Parent approved fixed-center/fixed-size Reset wear and straighten, safely constrained near edges.

Interface Craft, Guardrails all four, Neuve Motion, requested iOS HIG references reused as listed precisely in sticker-contour-design-brief.md. Liquid Glass read in full this phase. Modern guidance accessibility retrieved; `interest-tooltips` was invalid, then search resolved and full retrieval used `interest-triggered-tooltips`. Its stale blanket anchor-positioning support claim is not authority. Repo/Jotai/Bun rules override foreign examples.

Contract agreed directly with material engineer: actual projected alpha-boundary paths (holes retained), four art-local contour-sector anchors and center. Scene only consumes helper; quad remains math/occupied-art reference, never painted. Material engineer exclusively owns alpha/erosion/shader and StickerSurface. App owns StickerPackScene contour glue. Existing immutable art and canonical owned wear API preserved.

## First source checkpoint — not frozen

App component/layout now use four rounded crop grips, all rotate; actual contour path, top horizontal wear and compact peel/reset pair replace square/two-handle layout and dark toolbar. First layout tests cover minimum28px and normal100px print at desktop/375 and edge positions,1368 assertions passing. App typecheck passes. Early native capture build running; do not treat these source checks as visual acceptance.

Next: inspect actual Soundcheck/Pulse Code desktop/mobile, then fix real layout/material issues before broad native expansion. Tooltip behavior/fallback and final deterministic reset/cancellation tests remain in progress. Existing old HUD native assumptions still need migration after early visual checkpoint; no final test suite claim.

## Early visual critique and correction

Initial `early/` captures were rejected for remote crop grips and a generic range-in-pill; they remain preserved. Root cause was excluding the entire artwork rectangle from invisible44px targets, forcing needless expansion. Revised `early/close-grips/` keeps a central body-drag region, allows perimeter target overlap, removes spokes and places visible marks near the alpha sectors. Wear became a slim white translucent scrub rail, retaining an invisible native range. Reviewer accepted this visual direction for broader validation, not final approval.

`early/material/` contains actual native noHUD Pulse0/.5/1 comparisons and closeups,23 assertions, exact source in early-console.json. At100px material reviewer accepted nicked vinyl/readable print but required a broader adhesive underside and maximum-size evidence. Owner subsequently rejected enlarged blotchy edges; material engineer is refining this. Earlier100px approval does not override the owner's larger-scale rejection. Final build/freeze deferred until combined material handoff.

First full native attempt log `/tmp/webpod-contour-native-1.log`:133 assertions passed before a fixture timeout while issuing34 consecutive size key edits. The initial attribution to response/reconciliation timing was incomplete. A later exact diagnostic proved native disabled controls lost focus after the first saved key edit. Waiting for editing phase alone did not fix it. See the correction below; no timeout increase or automatic retry masked the failure. Preserve the failed run under final/pass-1. This is not a final pass.

Tooltip review found hover-only Escape with canvas focus bypassed the HUD handler. Collection's synchronous document handler now consumes tooltip dismissal after active-gesture cancellation and before deselecting. Retry recovery receives actual hover/focus tooltip in both shown/dismissed failure states. Feature-detected manual Popover renders tooltip in the top layer; unsupported browsers use the same explicit role/description and fixed coordinates. Native interest invokers are not claimed to be used; controlled lifecycle is chosen to integrate gesture-first Escape and canvas focus. Add actual native coverage before freeze.


## Focus and tooltip lifecycle corrections

Owner-scale pass-4 response-timeout.json showed canonical Pulse rotation1 and an editing HUD after the first key save, but focus had left the disabled native grip. Product correction uses aria-disabled with explicit pending pointer/key/click guards; native range prevents default during pending input and restores its controlled value. Focus remains where the user left it; no deferred focus restoration can steal another selection. pass-5 owner-scale completed35 sequential focused key saves. Return/reset remain blocked while pending, and the broad native checks pending key/range input produces no extra requests.

Tooltip all-control trace proved a different bug: Escape removed corner1's tooltip, exposing Wear beneath a stationary pointer, whose pointerenter opened a different tooltip. Return similarly exposed a rotation grip. Corner0 was negative evidence, so the correction was not based on that first nonreproduction. Shared local/global dismissal records the current pointer position, blocks same-position pointer reentry across trigger IDs, and resumes on deliberate movement (including inside the underlying control) or new focus. Pointer positions update on every control move; unmount clears the latch and listeners. Key manipulation hides stale positional tooltips. Bounded final-tracking diagnostic passed all7 controls and within-trigger movement.

## Accepted owner-scale material evidence

Material source refinement belongs to material engineer: smooth deterministic field/abrasion removed rectangular stamps and coarse256-cell rim bites. `early/owner-scale/pass-5/` contains actual2000×2400 viewport captures, maximum .35 placements; rotated Pulse contour474.65×466.98 CSS pixels. Both selected and noHUD NightShift/Pulse0/.5/1,600px native crops and broad actual55px adhesive lift were visibly inspected and independently accepted. No screenshot enlargement or test-only peel pose. Grayscale NightShift paint gate has matching-position negative control through actual peel/return: blankrear0 high-frequency edges against >70 when painted. Relevant material bytes remain unchanged through later UI tooltip corrections.

## Verification checkpoint

Full native `final/pass-5/` passed219 Bun assertions (plus Playwright assertions),29.73s, nativeStart/cookies/SQLite. Includes four corner rotations desktop/touch, angle branch cut, guarded saves/retry/409, unknown-write lock, range/handle cancellation, tiny375px targets and SVG containment, reduced-transparency+contrast, worn carry/return/re-stick/reload. Source3e8e7435…5898b34/398. Positive draw control539→1097, then1903→1903 over3001.5ms with settled HUD. Reviewer then requested final pointer tracking/unmount cleanup; these source fixes supersede that UI fingerprint, while material evidence remains byte-identical.

Final scoped lint passed. App typecheck passed.24 model/layout/runtime/return tests1494 assertions passed. Fresh final build completed. Final amended native under `final/verified/` passed219 assertions in29.678s (29.87s overall), exit0; all owned processes/disposers closed. Source0daa35f597a418b2ed59c0b77adaaba284594f5036a81cee39050d9e50eac776/398. Actual final small-print, corner press/held, release midpoint and complete dismissal captures visibly inspected: no stale tooltip covers the other sticker; the minimum20px print necessarily expands four44px targets, while normal-size grips remain close to contour. Full actual-route video is retained. Positive draws539→1097; settled1841→1841 over3001.6ms. Lead requested removal of one extra blank EOF line in StickerSurface.tsx after this run; corrected frozen digest27f7eea4bdb525c292ea0b3b502cdc802d9f9864b56fdf9d9aefb21777783b9b/398, no executable change. git diff --check clean. Exact per-file manifest and final logs saved in final/verified. Independent reviewer receives corrected source and free browser slot; no overall approval claimed. Diagnostic raw logs copied into `evidence/sticker-contour/diagnostics/`; superseded captures remain labeled by directory rather than overwritten.
