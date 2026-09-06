# Placed sticker editor and quiet feedback

Status: design/investigation ready; implementation waits for designer brief and agreed material contract. Latest owner screenshot rejects the routine ready/stuck notices and requests clicking placed stickers for rotation, wear marks and useful customization. No clarification is blocking: rotation, size, wear and return-to-pack are the bounded first set. Preserve playful physical customization and existing saved-session restoration.

## Correctness and authority

Click/tap a painted placed sticker to select it and reveal contextual controls. Crossing a deliberate small movement threshold still directly lifts/drags it; a click must not trigger peel, write, shift position or a shell flick. Controls preview the actual selected print, persist validated rotation/size/wear via existing revisioned placement writes and survive reload. Pointer/keyboard cancellation and failed writes cannot silently destroy the saved placement. Arbitrary rotation/size must respect the existing rear safe bounds. Wear means a stable visible surface treatment rather than new random damage every render. Existing artwork, identity, ownership, earned milestones and other stickers remain intact.

Remove visible routine success/ready/partial-import notices, including those in the screenshot. Physical state and the available collection communicate success. Keep concise actionable failure/retry at the relevant control; accessibility announcements may remain screen-reader-only when useful. Do not replace dismissed toast clutter with permanent explanatory copy. Passive ingestion failure must not dominate a valid existing collection.

Primary authority: owner request and screenshot /var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-544e3451-9c0f-4c78-93a2-a9359ebf0ed9.png. Supporting: AGENTS.md, existing direct-manipulation/session-restoration handovers, catalogue and placement contracts. Old notice approvals are superseded. No broad visual redesign, new identity, grant logic, analytics, uploads, irreversible artwork edits or unrelated startup changes.

## Ownership and dispatch

Lead owns scope/handover/commits. Collection engineer first authors sticker-editor-design-brief.md, comparing structurally distinct options and specifying chosen desktop/mobile/editor gesture and save model. No code until the brief and material contract are reviewed. Then owns apps/web UI/runtime/editor tests and app-specific state integration. Material engineer investigates and then owns agreed packages/stickers and packages/device wear contract/rendering plus server contract tests if required. Explicit handoff required for shared files; no overlapping edits. Independent tactile reviewer owns reviews/sticker-editor-review.md and reviews both lanes, running tests independently after freeze. Single browser/build owner at a time.

## Literature and skill requirements

All engineers/reviewer read this scope in full and the design brief before source changes. UI requires Modern Web Guidance FIRST using bunx (repo forbids npx), Interface Craft critique/storyboard, Interface Design Guardrails all four resources and Neuve Motion for purposeful reduced-motion-safe transitions. Lead has loaded these and searched contextual accessible editor guidance. Existing product materials override foreign Neuve flat-color/iOS-only/marketing-layout rules; no Neuve/Kanban exists. Use Jotai/global patterns, database-drizzle/Effect/Start only for touched layers, strict-critique/runtime review independently. Ground new behavior in /Users/vinicius/code/.better-coding-agents/resources and pinned installed Three/R3F/Jotai/Start sources. No new dependency without a concrete need; user controls must not expose internal developer tuning panels.

## Verification and definition of done

- Deterministic tests: click-versus-drag threshold, selection/dismiss/focus/cancel, range validity near edges, save coalescing and revision conflicts, late responses/session replacement, legacy placement compatibility, wear validation including NaN/out-of-range, material determinism and resource lifecycle.
- Native actual route with Start/cookies/temp SQLite: place, click without movement/write, rotate/resize/wear, actual visible before/after print, reload values and appearance, drag retaining all properties, return retaining ownership, mobile375/touch and keyboard control. Test failed/delayed/409 save and selection switch without applying old edits to another sticker.
- Normal/reduced motion, outside click/Escape/flip/logout cleanup, no controls stealing wheel/flick gestures, viewport edges and overlapping stickers. Controls cannot clip at375 or cover the print being adjusted unnecessarily; minimum44px interaction targets. Existing readiness/rehydration/pack pull behavior remains valid.
- Visible ready/stuck/partial notices absent after relevant native flows; actionable save failures remain accessible and local. Screen-reader semantics and meaningful error retry retained.
- Wear visibly evaluated at real sticker size in native captures at0/mid/high; source uniform values or zoomed fake artwork are insufficient. Stable material coordinates, laminate response and alpha silhouette; no permanent render loop, unbounded material recompilation or per-frame texture generation. Rendering/performance claims bounded to actual observation.
- Changed-package typechecks, scoped lint including new files, meaningful domain/runtime tests, native editor test and relevant existing restoration/interaction regressions; git diff --check. Canonical startup only if routing/build/launcher changes, not gratuitous repeated flaky runs for isolated editor changes.

Artifacts: designer brief sticker-editor-design-brief.md; diaries/sticker-editor-ui.md and diaries/sticker-editor-materials.md; evidence/sticker-editor/ with source fingerprints, commands, screenshots; reviewer reviews/sticker-editor-review.md; lead sticker-editor-handover.md. Independent reviewer must inspect actual rendered controls/wear and gate Major/Critical findings. Subjective polish limits are stated; no owner aesthetic approval inferred. Do not certify physical Safari or live Apple from synthetic tests.

## Guardrails and decisions

No cert/env contents, key/token logging, owner live-tab changes or .pen filesystem access. Existing JSON placements may support a backward-compatible optional wear field; material engineer proposes exact default and validation before implementation, no migration assumed. Adopt minimal explicit save/undo semantics from reviewed design rather than independently guessing. Ordinary layout/range/material decisions may proceed once documented and reviewed; broader interaction or persistence policy conflicts return to lead.

Commit plan: coherent shared wear contract/rendering plus tests; integrated editor/notices plus tests; documentation/evidence separately. User's prior commit authorization persists; no push. Done requires all requested behavior, meaningful independent tests and visual review, exact source evidence, granular commits, owned-resource cleanup and clean worktree.

## Durable wear decision

Wear belongs to the owned physical sticker, not just its current placement. It survives return-to-pack, re-stick and reload; rotation/size remain placement transforms. Optional placement wear alone would delete the only record on return, so that preliminary storage proposal is insufficient. Material engineer investigates a minimal additive owned-appearance JSON field under existing Drizzle/SQLite migration conventions plus validated inventory/write propagation. Exact migration/default/legacy/security contract requires reviewer agreement before source edits. New tables/frameworks or identity changes are not implied. Existing baked artwork distress remains at wear0; the control adds surface treatment rather than recovering nonexistent pristine source pixels.

## Reviewed design dispatch

Independent reviewer accepted sticker-editor-design-brief.md before app implementation. App owner may implement the chosen compact single-property editor with explicit Apply/Revert and click/drag arbitration. Apply success resets the edit baseline to canonical saved values. Dirty drag is blocked; dirty outside dismissal/selection switch cancels the unsaved draft as specified. Mobile dock reserves its actual measured height, even if larger than the sketch estimate, and never reframes under active input. App owner cannot edit the material/server lane files.

Proposed shared persistence contract awaiting final reviewer approval: StickerAppearance[]{stickerId,wear} in additive schema v4 appearances JSON default[]; canonical server inventory list, optional field for legacy client fixture compatibility; optional placement wear explicitly updates appearance through existing PUT, omission preserves stored appearance. Stored geometry has no wear duplication; returned placed/sheet/carry rendering uses canonical owned appearance. Remove leaves owned appearance. Material owner owns packages/stickers contracts, device shader/prop paths, existing database/schema/repository and associated tests. No new endpoint or new identity.

## Shared contract approval

Reviewer approved material/persistence implementation after design review. Required invariants: geometry and appearance writes are atomic in the existing owner/revision compare-and-swap; wear-only edits increment that same placement revision. Omitted wear preserves canonical appearance, explicit0 resets added wear, removal preserves appearance. Appearance IDs must be unique, known and owned, with count bounded by the actual catalogue. Native inventory hydrates placement wear from one canonical appearance source. Transactional v3→v4 and legacy v1/v2 migration paths receive real temporary-database tests. UI and material lanes now implement in parallel with disjoint ownership; reviewer source investigation continues independently.

## Integrated review checkpoints

The first browser fixture behavior pass was rejected because a reserved GLSL identifier prevented print rendering. Both material and independent reviewer inspected absent artwork. The engineer corrected the shader identifier and added actual colored-ink plus shader-console-error gates; new captures showed real art. Fresh original/mid/high wear was independently judged progressive and legible at normal size, with silhouette preserved. That does not yet certify carry/return continuity.

Review also required mobile editor framing to remain stable through pickup and active controls, and desktop panel anchoring to remain fixed during range adjustment. These input-continuity requirements are part of acceptance, not optional polish. Final source/native freeze and independent execution remain necessary; early partial passes are not delivery approval.
