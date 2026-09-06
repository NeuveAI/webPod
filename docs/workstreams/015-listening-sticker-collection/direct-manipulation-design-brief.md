# Direct manipulation design brief

2026-09-06. **Design proposal before this revision’s implementation.** The owner’s latest six requests are primary authority. The screenshots in `/Users/vinicius/.codex/attachments/99082042-553e-4ad0-a831-f593c1725147/image-1.png`, `image-2.png` and `image-3.png` were visibly inspected: premature “PULL TO COLLECT” lip, large “SLIDE OUT” button and oversized sample banner are anti-sources. Prior approval does not override these newly identified experience gaps.

Retain the [material and collection brief](tactile-design-brief.md), existing five-seat genre taxonomy, approved artwork, matte exterior packet laminate, raw paper rim, waxy liner and vinyl underside. This revision changes readiness and direct manipulation, not collection economics, authentication or manufacturing style. The previous [handover](tactile-collection-handover.md) establishes the baseline, not proof of these new interactions. The full [direct-manipulation scope](direct-manipulation-scope.md) was read before finalizing this brief and governs implementation dispatch and verification.

## Six requirements

1. **Only offer a usable collection.** No packet geometry, tease, collection navigation or empty collection explanation before same-session validated ownership and the active collection’s required artwork are usable. Readiness must not depend on unrelated fresh counters or completion of Apple import.
2. **Peel and adhere in both directions.** Lifting an already placed sticker visibly releases adhesive contact from the rear. Landing any carried sticker progressively adheres it. Moving and removing must not simply teleport a flat print.
3. **Pull the objects themselves.** Pull the exposed packet lip into view; grab the liner through its thumb notch and pull it from the sleeve. Eliminate the large click-only “slide” banner. Direct drag is primary; a small semantic action remains an accessible equivalent.
4. **Reposition and return.** Grab any already placed print on the device, move it to another valid rear position or return it to its own collection’s die-cut seat. Do not require removing it through a menu before moving it. Keep its identity, size and rotation unless an explicit existing control changes them.
5. **Use a compact, truthful sync note.** Improve copy tone and placement, not unsolicited spoken audio. Import status must not dominate or obstruct the device, sheet or held print.
6. **Measure and reduce reveal latency.** Distinguish inventory arrival, asset decode/GPU readiness, opening persistence and first visible response. Prove the ready gesture responds immediately and that background sync cannot block it; do not substitute faster easing for a stalled request or texture load.

## Readiness matrix

“Usable” means a validated inventory belonging to the current runtime/session generation with at least one owned catalogue print, and the chosen pack/liner’s required visual assets decoded and available to the renderer. Include its five displayed slots so locked seats do not paint late as blanks. Do not wait for all sixty artworks or every other genre. Ownership may include already placed prints: their collection remains useful for returning them.

| Inventory / assets | Collection presentation | Other behavior |
| --- | --- | --- |
| Signed out, unknown inventory, first load | No collection lip, wrapper, nav or empty placeholder | Music/device remain usable; account connection belongs to existing account UI |
| Valid empty inventory | No collection presentation | Do not promise a pack is on its way or simulate an empty owned pack |
| Owned inventory, active artwork pending | Prepare active assets off the visible gesture path; no premature lip | Previously ready other collection may stay available; no blank-sheet promise |
| Owned and active assets ready | Admit rear tease and immediate pull | Background import/counter refresh does not block the object |
| Same-session last validated ownership plus refresh pending/error | Retain usable collection and placed art | Keep old counters honestly until refreshed; compact retry note when relevant |
| No usable cached ownership plus load/error | No collection presentation | Compact actionable failure status may appear in status area, not a fake packet |
| One asset fails | Preserve already usable collections; withhold failed collection’s reveal | Explicit bounded image retry; no global disappearance caused by an unrelated genre |
| Sign-out/account-generation change | Cancel transient carry, clear user ownership and readiness | Never reuse cached previous-user collection or let late callbacks restore it |

Readiness includes the material/scene path, not merely a successful PNG HTTP response. Mounting no visual packet must not prevent asset loading: use a bounded preparation subscription independent of packet visibility, with explicit cleanup. Front/rear transitions should reuse ready assets without repeatedly disposing and decoding the active collection. Existing renderer tier/context-loss fallback remains authoritative; readiness must not advertise a gesture the current tier cannot render.

## Object and movement storyboard

| Phase | What moves and what stays anchored | End / interruption |
| --- | --- | --- |
| Ready tease | A real coated-paper lip is exposed at the bottom; the small notch and printed edge indicate a graspable object | No autonomous empty-pack tease while data is unknown |
| Packet pull | The packet follows vertical displacement from its current rendered pose; hand release settles toward the nearer stable position using current intent/momentum | Re-grab starts at the visible pose; short reverse drag cannot borrow stale velocity |
| Liner pull | Grasp the liner visible in the thumb notch. Pulling translates the same-size liner relative to the fixed sleeve | No shrinking sleeve, click-only gate or startup pause; liner corner remains flat until clear of pocket |
| Liner partial release | A partly pulled liner remains continuously controlled; release resolves to an accessible open or closed pose | Cancel/reverse returns from the current pose, never resets to an unseen start frame |
| New print lift | Leading edge curls off its own seat while the remaining adhesive tail stays attached | No free translation until separation; exact approved mask/UV preserved |
| Placed print lift | Grab point resolves on the actual rear print; bend and lift originate at its saved pose and rear plane | Hide only its static duplicate during carry; persisted original remains rollback authority |
| Detached carry | Held print follows the grabbed material point in screen/world space, with no permanent offset lag | Packet may make room on phones without moving device or held print under the pointer |
| Rear landing | Valid target receives a visible partially adhered preview, then remaining curl/contact settles on release | Sample final pointer coordinates; invalid rear/occluded placement cannot silently save |
| Own-sheet landing | Bring the print back to its matching seat; a modest vacant-seat emphasis indicates a valid return | Adhesion onto the liner completes the return; do not drop into an arbitrary genre or unlocked slot |
| Miss / cancel | From either starting surface, reverse toward the current authoritative origin | A newly peeled print returns to its sheet; an existing print returns to its original rear position |
| Put away | Liner retracts through the mouth, then complete packet lowers | No exposed liner after close/front-back; in-flight return can be safely interrupted |

The lift/drop language is symmetrical but the surfaces differ: metal remains rigid, release liner bows, coated vinyl flexes. Do not add wobble to the entire device to stand in for sticker physics. Existing finish and raw-edge distinction survive all deformation.

## Gesture ownership, accessible paths and mobile space

The packet lip and liner notch have separate semantic grab regions aligned with their actual projected geometry, each at least 44 px in its touch hit extent. A small printed directional cue is sufficient; no large opaque CTA covers cover art. Pointer capture belongs to the active object only. Lost capture, Escape, blur, sign-out and collection switch must share explicit cancellation; idle cancellation cannot steal the device’s gesture.

Placed-print hit testing must choose the visibly topmost owned print, excluding alpha-transparent corners, and convert its current saved pose into the same carry model used for sheet prints. A blank rear remains the device flip lane. During a held print, suppress accidental device flicks without disabling normal flicks afterward. Existing projection/placement bounds remain canonical.

At 375 px, reserve a visible landing region and keep the lifted print unobscured. Once detached, lower backing as needed while the rear stays fixed. For **return to sheet**, restore/expose the originating collection and its seat within reach; do not force users to drop blindly below the viewport or browse away from a held print. If another collection was being browsed, the lifted print’s own collection becomes the explicit return destination. This changes presentation only, never grant identity. Verify upper and lower rear placement plus own-seat return with real touch.

Keyboard equivalents: focus lip and use Enter/Space to reveal; focus liner notch and use Enter/Space to open, with arrow-key incremental pull if offered. A placed sticker is focusable and announces “Move [name]”; Enter/Space lifts, arrows move the preview, Enter places, Escape restores the original. A semantic “Return to [collection]” action performs the same animated return and persisted removal. Focused locked seats remain informational. Details and navigation must not trap focus or require hover. Reduced motion keeps immediate direct following and static lift/target cues, snapping autonomous bend/settle rather than removing the carry feedback or persistence state.

## Persistence, origin and failure semantics

Reuse `StickerPlacement` and `isStickerPlacement` from `packages/stickers/src/index.ts`; the existing `placeSticker` replaces a same-ID position and `removeSticker` removes that placement through revisioned `PUT /placements`. No new grant, auth or storage schema is needed for a move or return. Keep the original `{stickerId, x, y, width, rotationDeg, surface}` as the carry origin. Do not delete it on pointer-down. Rendering may temporarily mask that static print while a transient preview owns its visible representation.

`sticker-runtime.ts` already serializes writes and refreshes on revision conflict. Use those APIs; do not invoke optimistic action atoms without explicit reconciliation. A successful move publishes the new position; a successful return removes the placement and exposes the owned sheet print. A failed save restores the last authoritative origin with a continuous visual return and a concise retry note. A 409 uses the refreshed authoritative inventory, not an unconditional stale snapshot rollback. Generation checks protect a later gesture or sign-out from an older request completion. A newer intent may supersede presentation while an already-issued write still completes: reconcile inventory without reviving its old carry.

Opening persistence and physical reveal must be separated. The liner should follow the hand immediately after readiness; an unopened owned grant can be claimed concurrently. Until the existing server open succeeds, its print remains owned/sealed and cannot be peeled. Failure leaves the object inspectable with a compact retry action, rather than freezing the hand or claiming an opened state. Already opened grants never need another opening network round trip.

## Sync note placement and voice

Use the existing scene’s quiet status area adjacent to account/session controls, outside device and pack hit regions. Desktop: a compact width-to-content note rather than a centered banner. Phone: a short wrap beneath the top controls, with safe insets and a readable maximum width; it must not overlap the rear, meaning slip, packet notch or held-print landing region. Background work should not hold a persistent alert-like panel. No toast animation competes with the physical gesture.

Suggested truthful copy, conditional on actual state:

- Partial import with usable owned content and ready artwork: “Your stickers are ready.” Otherwise: “Part of your library is synced.” A short detail states “We checked part of your library. Keep listening in webPod to earn more.” Do not put technical “sample” jargon in the headline, imply the entire library completed, or frame bounded successful sampling as a failed full-library import.
- Failed import with existing ownership: “Library sync paused. Your stickers are still here.” Action: “Try again.”
- Failed import without known ownership: “Couldn’t sync your library yet.” Action: “Try again.” Do not assure the user that unknown earned content is safe.
- Artwork failure: “This pack’s artwork couldn’t load.” Action: “Retry artwork.” Distinguish asset failure from Apple sync.
- Placement failure: “That move didn’t save. Try again.” Match “return” or “sticker” if the failed operation differs.

Use polite live status announcements once per meaningful state change. Avoid repeatedly announcing counter refreshes. “Voiced” is treated as copy tone; speech playback is not requested.

## Current source gaps and ownership proposal

Observed before implementation: `StickerCollection` gates on rear/T1 but renders a null-collection placeholder and lip; `openCollection` waits for every `openPack` before starting sheet motion; the liner is a large click button; placed seats offer only immediate semantic removal; the active carry assumes a sheet origin; status is a broad top-centered block. `sticker-texture-cache.ts` disposes on last unsubscribe, which can contribute to remount work and must be profiled rather than presumed. Existing `reportStickerArtworkReady/Failure` is insufficient by itself to assert a whole active collection is prepared.

Proposed single interaction owner: `apps/web/src/sticker-collection.tsx`, `sticker-interaction.ts`, `sticker-motion.ts`, `sticker-collections-model.ts`, `production-device-view.tsx`, narrowly necessary `sticker-runtime.ts`, and their behavior tests. Shared transient origin/readiness types may extend `packages/state/src/stickers.ts` and `packages/device/src/sticker-contract.ts` after explicit cross-lane agreement.

Scene/geometry lane, coordinated with that owner: `packages/device/src/StickerPackScene.tsx`, `StickerSurface.tsx`, rear projection/hit handles and bounded texture preparation/cache helpers. Preserve reviewed packet laminate/paper geometry. Profile engineer owns baseline DevTools evidence first and proposes measured latency changes; no parallel edits to these shared files without handoff. Reviewer remains independent. No source or Pencil modification accompanies this brief.

## Acceptance and latency evidence

Use actual `/` with native Start/SQLite and synthetic upstream fixtures, not a proof route. Test readiness independently for unknown, empty, pending assets, failed assets, ready ownership, cached ownership during slow refresh, sign-out and late completion. Assert both DOM **and** actual packet rendering absent before readiness. Once ready, delay import/counter endpoints deliberately and prove pull/liner feedback and existing-sticker movement still work.

Record baseline and revised traces for cold ownership-to-usable presentation, warm rear-to-tease, pointer-down-to-first-visible packet motion, liner motion, and rear sticker lift. Split network, decode/upload, JS/layout and frame costs; include source/build fingerprints, viewport, cache condition and the tested machine. Repeat identical warm gestures and report distribution plus worst observed cases. The ready pointer must change the rendered pose on the next available frame, without request waits, long tasks or deliberate timer gates. If a frame is missed, identify why in the trace. Set any numeric budget from the measured baseline/target environment with the lead; do not invent arbitrary spring values as acceptance.

Required visible sequences: partial packet pull, partial liner pull, sheet peel, rear lift, detached carry, progressive rear adhesion, own-seat return, invalid drop, failed save rollback, mobile lower-rear placement and keyboard/reduced-motion equivalents. Verify no static/carried duplicate, no wrong-ID save, no hidden target, no orphan capture, and no packet disappearing while background sync updates. Preserve existing material, close/reopen, revision-conflict and cross-gesture regression coverage. Final independent designer/engineer review must inspect normal-scale captures and actual gesture traces; passing a stage assertion is insufficient.

## References applied before implementation

Modern Web Guidance executed first through `bunx --bun modern-web-guidance@latest search "responsive direct pointer drag image readiness low latency interaction" --skill-version 2026_05_16-c5e78707`, then retrieved `interactions-in-complex-layouts`. It supports investigating layout/reflow boundaries; no blanket content-visibility change is prescribed for this 3D scene. Existing `interest-triggered-tooltips` and `interactive-content-in-3d-scenes` guidance remains applicable.

Reused `/Users/vinicius/.agents/skills/interface-craft/SKILL.md` with `storyboard-animation.md` and `design-critique.md`; Interface Design Guardrails `SKILL.md` plus all four resources (`craft-principles`, `quality-framework`, `industry-standards`, `anti-patterns`); Neuve Motion `SKILL.md`, principles, tokens, storyboard and reduced-motion references; Jotai/global skills and `/Users/vinicius/code/agent-context/jotai-react-query.md`, `global.md`. Repository/user authority overrides foreign no-gradient/platform rules and approval pauses. Existing shared state, catalogue, server write APIs and texture lifecycle were read directly. Canonical library grounding remains `/Users/vinicius/code/.better-coding-agents/resources/`, with pinned Three/R3F sources for implementation as recorded in the prior brief. This is a focused interaction revision within the existing material construction, so the staged movement table supplies the new design reference without duplicating or changing saved Pencil boards.
