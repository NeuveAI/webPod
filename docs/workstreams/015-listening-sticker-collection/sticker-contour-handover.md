# Contour controls handover

Status: implementation independently APPROVED at frozen source27f7eea4…7783b9b. Scoped commits and final ownership check close delivery; concurrent WebMCP changes are excluded.

The owner accepted the peel-and-return animation, but requested replacing the square transform HUD with four frosted rounded rotation grips following actual sticker contours, a top wear scrubber, and a peel/reset group. Every interactive element needs a tooltip and accessible operation. Added wear should vary naturally and fray the print's edges. The exact owner direction and dispatch contract are in [scope](sticker-contour-scope.md); earlier HUD design approval does not approve this revision.

Baseline: clean worktree at `1aeee5d`, following source commits `e1be189` (durable wear) and `72f1244` (earlier HUD). Previous goal turn produced committed source and independent validation; it was progress, not a stalled attempt. Existing persisted appearance/revision safeguards and peel choreography carry forward.

## Completion audit

| Explicit requirement | Required authoritative evidence | Current status |
| --- | --- | --- |
| Actual contour, no square framing | Irregular and nearrectangular artwork rendered at normal size and rotated; contour geometry tests | PASS — independent review and corrected native evidence below |
| Four rounded frosted corner grips, all rotate | Mouse/touch test on each,44px reachable targets, contour anchors and visual capture | PASS — independent review and corrected native evidence below |
| Semi-bounce on press; hold/drag direct rotation | Actual press/held/drag/release video and interruption/cancel assertions | PASS — independent review and corrected native evidence below |
| Top side-to-side wear control | Both directions, bounds, keyboard, cancel, save and normal-size wear captures | PASS — independent review and corrected native evidence below |
| Hovering peel/return and reset group | Native action tests, reset semantics, capture | PASS — independent review and corrected native evidence below |
| Tooltip each interactive part | Actual hover/focus/Escape and accessible naming/value assertions | PASS — independent review and corrected native evidence below |
| Existing peel animation preserved | Existing choreography source unchanged or narrowly integrated; actual return sequence and persistence regression | PASS — independent review and corrected native evidence below |
| Varied scratches and frayed edge damage | Wear0/mid/1, different seeds, edge alpha/hit/shadow agreement, stable redraw/reload/return | PASS — independent review and corrected native evidence below |
| Dynamic yet accessible UI | Reduced-motion, contrast/transparency fallback rendering, text/target layout, positive-control measured idle | PASS — independent review and corrected native evidence below |
| Safe persistence and lifecycle | Failed/delayed/409 writes, cancellation and session teardown, no stale resurrection | PASS — independent review and corrected native evidence below |
| Validation/workflow | Types/lint/tests, exact source identity, independent approval, commits and clean tree | PASS — independent review and corrected native evidence below |

Engineers record design and bounded defaults in sticker-contour-design-brief.md and diaries/sticker-contour-ui.md / sticker-contour-materials.md. Independent findings belong in reviews/sticker-contour-review.md. Evidence belongs in evidence/sticker-contour/. Lead updates this audit from actual artifacts at freeze; passing old HUD tests alone cannot close it.

## Early review

First actual-route captures in evidence/sticker-contour/early/ demonstrate actual cut-lines, but lead and independent reviewer rejected the remote grip layout: long diagonal tethers create an implied large rectangular frame. The top native range-in-pill also misses the requested edge-control relationship. Visible brackets are being brought to the contour while invisible touch regions retain reach; top wear is being redesigned as a tactile horizontal scrub edge. Mobile other-sticker overlap is also recorded for correction. First-render counts do not constitute visual approval.

Independent material/helper suite passed six tests /11,023 assertions and source review found no concrete blocker. Rendered normal/max-size fray and contour resolution remain unproven.

## Revised render and material checkpoints

Reviewer accepted the close-grips concept for broader native validation: evidence/sticker-contour/early/close-grips/. Visible brackets are close to the cutout, long stems removed, wear uses a slim scrub rail, and the mobile overlap is corrected. Painted-grip containment inside effective touch targets still needs actual point tests at minimum size.

Matched no-HUD wear0/.5/1 in evidence/sticker-contour/early/material/ passed material engineer and independent reviewer assessment at normal size: uneven abrasion and increasing missing rim fragments remain readable and stable. This depicts chipped printed vinyl; it is not a claim of cloth-like fibers. Held peel was too edge-on for adhesive inspection. Oblique underside, irregular Sound Check variation, and maximum-size contour resolution remain pending. No final approval inferred from these checkpoints.

## Owner rejects blocky material edges

The owner supplied enlarged Night Shift and rotated Pulse Code screenshots and called the edges blotchy. Earlier normal-size approval is superseded at the intended display scale. Material refinement is active; larger selected/unselected angled renders now gate acceptance. No goal completion or final source freeze.

## Owner-scale refinement and keyboard finding

Refined1024 mask, smooth seeded edge depth and interpolated abrasion independently passed seven tests /10,939 assertions. Both material engineer and reviewer accept enlarged Night Shift (~385CSSpx) as resolving broad square bites/stamps; see early/owner-scale/pass-3/. Angled Pulse and broad adhesive underside remain pending.

The owner-scale Pulse rotation capture exposed a real focus lifecycle bug: disabling a grip during its save loses keyboard focus, so later arrow presses miss it even after editing phase returns. Earlier ‘fixture-only race’ interpretation is superseded. UI is preserving focus with aria-disabled and explicit pending guards, with native focus-continuity and no-extra-write proof required (including native range default behavior). A grayscale paint detector replaces the inappropriate saturation detector for Night Shift; blank-backplate negative control is required to support the detector beyond independently viewed painted captures.

## Owner-scale material acceptance

Both material engineer and independent reviewer accept pass-5 (source9d0a55bd…eff0 /398 files) actual Night Shift385px and rotated Pulse475px0/.5/1, selected/unselected. Broad55px lift exposes unprinted adhesive and matching nicked silhouette. Square rim bites and rectangular abrasion stamps are resolved at these tested sizes. Grayscale negative control used actual peel/return at the same crop and measured0edges versus>70 on painted Night Shift. Thirty-five consecutive keyboard saves preserved focus. This closes the bounded material finding; full control/gesture/accessibility and final source validation remain active.

## Final implementer checkpoint

Final amended native passed219 assertions /29.87s after latest pointer tracking, unmount cleanup and keyboard-edit tooltip dismissal corrections. Root read the actual completed log. Independent final source/route execution is next; no completion claim yet.

Reviewer inspected the minimum375px layout (~20px print): four44px targets necessarily extend outward while the true contour stays on the print; no square frame or spokes return. Reviewer accepts this explicit minimum-size reach tradeoff, not a claim that markers remain equally close at every size. Normal and owner-scale controls stay close. Actual reduced-transparency fallback is opaque and legible.

## Independent final execution and concurrent checkout changes

Independent corrected native passed219 assertions /30.11s overall at27f7eea4bdb525c292ea0b3b502cdc802d9f9864b56fdf9d9aefb21777783b9b /398. Positive draws539→1,097 then1,841→1,841 over3,001.7ms. Reviewer-owned process exited and cleanup assertions passed. Root full workspace typecheck passed12/12 projects, recorded in evidence/sticker-contour/root-typecheck.log.

After those checks, an external concurrent effort changed device-preview-orientation.ts, tools/index.ts and added tools/native.ts plus another workstream directory. Those files are outside this task's ownership and must not be staged, discarded or included in a whole-tree-clean claim. Root requested final per-file manifest comparison and narrow integration-risk assessment; contour commits remain scoped. Aggregate source fingerprint changes from unrelated files must not silently relabel the earlier test identity.

## Final audit and approval

[Independent review](reviews/sticker-contour-review.md) is APPROVE with no Major/Critical finding. Its requirement table explicitly closes contour/fourgrips, frosted material/topwear, semi-bounce/directtracking, allinteractiontooltips, peel/reset/durableappearance, and variedfrayedwear at tested owner scales. Corrected native219, model/runtime24tests1,494assertions, refinedmaterial7tests10,939assertions, affectedtypes/lint and root12-projecttypecheck passed. Final source27f7eea4bdb525c292ea0b3b502cdc802d9f9864b56fdf9d9aefb21777783b9b /398, verified independently by reviewer and lead. Final animation and accessibility evidence: evidence/sticker-contour/reviewer/corrected/. Owner-scale material: early/owner-scale/pass-5/.

The passing scope is precise: Chromium real product route with synthetic trusted Apple upstream and real Start/SQLite session/persistence, no physical Safari certification or owner aesthetic approval. Minimum20px print targets expand outward; reset preserves size/center and safely straightens, removing addedwear.1024 mask has bounded finite resolution, not unlimited geometric detail. Idle proves no additional WebGL draws over3s, not all compositor/CPU activity.

Concurrent external work continued after final validation, including composite/state/device exports in addition to orientation/tools. Root compared all398 recorded hashes; contour-owned source remained unchanged. Those later aggregate changes have not been certified by this review and are not part of the sticker commits. The final cleanup target is no uncommitted sticker-owned work; preserving active external edits takes precedence over deleting or committing them to manufacture an empty status.

## Delivery commits

- `ed4e81c` — Trace sticker contours and refine frayed vinyl wear.
- `a9355f4` — Add frosted contour grips and accessible sticker controls.

Before each source commit, lead hashed the exact staged contents against the approved per-file manifest: nine device files and eight app files, zero mismatches. Documentation/evidence are committed separately. No push was performed. All task-owned browser/build resources are closed; owner live session/server and unrelated active work are preserved.
