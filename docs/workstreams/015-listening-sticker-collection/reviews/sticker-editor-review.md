# Independent sticker editor review

## Verdict: PENDING — contract review before implementation

Read `sticker-editor-scope.md` in full and inspected the owner's actual screenshot. This is a playful physical customization surface. The screenshot shows two separate pale success notices above an already visibly customized device: “Your stickers are ready.” and “Pulse Code stuck to your iPod.” They repeat physical state, compete with the prints and offer no useful next action. Earlier notice approval is superseded. Removing those notices must not remove local actionable failure recovery or accessible control semantics.

Review uses Modern Web Guidance first (Bun search and retrieved declarative popover/dialog guidance), Interface Craft critique/storyboard, all four Guardrails resources, Neuve Motion and previously loaded strict/runtime/Jotai/domain guidance. Newly available invoker/anchor APIs are not assumed universally supported; a small existing state-driven contextual panel is preferable to importing a dependency solely to satisfy a foreign example. Repo Jotai and physical material requirements override example useState, marketing spacing and Neuve flat-color rules. No owner browser, secrets or encrypted design source is accessed. Reviewer edits documentation only.

## Preimplementation acceptance contract

| Area | Independent proof required |
| --- | --- |
| Click versus drag | Native click/tap on painted alpha selects without peeling, shifting, writing or flicking. Deliberate movement crosses one documented threshold and preserves grab point. Blank transparent margins and overlap respect actual hit order. Keyboard selection remains possible. |
| Contextual controls | Rotation, bounded size, wear and return are disclosed only for the selected print. Desktop and375px layouts keep that print inspectable, targets at least44px and focus visible. Slider/keyboard events cannot leak into shell rotation or music-wheel actions. No permanent success copy replaces the rejected notices. |
| Preview and commit | Brief must define one understandable preview/save/cancel model. Draft is separate from authoritative inventory. Outside click, Escape, flip, selection switch and logout have explicit outcomes. Rapid input coalesces and no late save can modify another sticker or revive a dismissed editor. |
| Safety at rear edges | Rotation and size obey the actual rotated occupied rectangle. Controls must not advertise unreachable ranges without explanation or silently move the sticker to make a value fit. Native edge and overlapping-print cases supplement deterministic validation. |
| Failure and reconciliation |503 retains recoverable local draft/saved placement;409 presents/reconciles canonical state without replacing another sticker's edit. Pending save then Escape/selection switch/logout has generation-safe publication and no falsely announced success. |
| Stable wear | Legacy absent wear renders unchanged. Finite0..1 is validated at the shared boundary; null, NaN, infinity and out-of-range are rejected. Actual normal-scale native captures at0/mid/high show distinct persistent surface wear, not merely uniform values or enlarged artwork. |
| Persistence and materials | Reload, movement, removal/return and re-stick have explicit appearance semantics. Alpha silhouette, picking, UV and adhesive underside stay consistent. Wear-only input cannot rebuild rear geometry, generate textures each frame, recompile shaders per value or leave a demand-render loop. |
| Quiet feedback | Ready/stuck/partial routine notices absent after native flows. Save/return failures remain local and actionable; passive import failure cannot dominate an already valid collection. Accessible announcements may be hidden without duplicating visible success chrome. |

## Material contract checkpoint

The proposed optional placement `wear` field, default0, deterministic UV/sticker-ID seed and front-only ink/roughness/coat treatment is a compatible direction for placed stickers. Existing `StickerSurface.tsx` memoizes geometry by the placement object, so wear-only edits must narrow geometry dependencies rather than rebuild on every slider value. The material callback/cache key must compose with earned/locked/seat treatments and the existing shader-preparation clones. One compiled shader with mutable uniforms must serve all wear values, including initial prepared0; clones cannot accidentally retain a stale uniform owner. Backing, alpha and geometry are borrowed/owned exactly as before.

One blocking semantics ambiguity was sent to lead and material engineer before implementation: wear stored only in placements is deleted when return-to-pack removes the placement. Durable return→re-stick→reload wear retention cannot be claimed from that contract alone. The designer/lead must explicitly choose and document the required behavior and corresponding ownership record before code. Scope requires return to retain ownership; dispatch additionally mentions preserving wear. This is an authority/representation question, not a request to silently expand server scope.

## Final proof plan and limits

Await designer brief and agreed material contract before implementation acceptance. After frozen handoff, independently inspect source, types/lint, meaningful interaction/domain/material regressions and native Start/cookie/SQLite editor flow. Inspect actual desktop and375px controls, normal/reduced motion, wear0/mid/high, failure/conflict/pending-write cases and reload. Reuse prior restoration evidence only where unchanged-source provenance justifies it; rerun the relevant regression when shared state changes. No canonical startup rerun for this isolated feature unless routing/build/launcher inputs change. Single browser/build owner; no competing validation before handoff.

Final quality facets: directness, quietness, material credibility, control clarity and durable customization. Ratings remain pending actual final renders; a passing assertion count or shader string is not visual approval. Native synthetic fixtures do not certify physical Safari or live Apple authentication. Lead owns commits, final cleanup and final handover.


## Designer and durable material contract review — before source dispatch

Read the full `sticker-editor-design-brief.md`. Its three structurally distinct options lead to a compact contextual strip with one native range property at a time and explicit Apply/Revert. This supports reversible physical customization without a persistent inspector. The chosen dirty-state semantics are deliberate: direct dragging is blocked until Apply/Revert, while outside click, Escape and selection switch cancel the draft. After successful Apply the clean source baseline must become the canonical saved record. The mobile dock must reserve its measured height, even when44px controls exceed the168–192px estimate; no reframe beneath active input. These are implementation checks, not unresolved design blockers. Desktop/375px material and interaction quality remains unapproved until real renders.

Lead resolved wear as durable owned-sticker appearance through return/re-stick/reload. The accepted additive contract uses schema v4 with collections.appearances JSON default[], typed unique owned records {stickerId,wear}. Legacy omitted inventory appearances means empty/original; the server emits canonical values. Explicit placement wear in the existing PUT updates that record, omitted wear preserves it, explicit0 resets it. Stored geometry placements omit wear and outgoing placements hydrate from the one appearance authority. Removal retains the appearance record. No new endpoint or identity is introduced.

Before implementation, review required appearance and geometry writes to share the existing owner/revision transaction; a wear-only save must advance that revision. Unknown, duplicate, unowned and invalid values must fail; limits derive from catalogue cardinality. Populated v3→v4 migration and existing v1/v2 upgrade paths must preserve data. These invariants were sent to both engineers and lead. With them, the designer and durable material contracts are accepted for implementation dispatch; final implementation approval remains PENDING.


## Early implementation checkpoint — not frozen

Coherent material-owner checkpoint reviewed read-only: additive v4 migration, typed appearance column, repository CAS transaction, shared validation, wear shader/uniform owner, geometry memo dependencies and actual projected-bounds helper. Geometry placement storage strips wear; appearances update in the same immediate transaction and increment placement revision, while return omits a placement without deleting its appearance. Outgoing inventory hydrates placement wear from that canonical list. The front shader keeps alpha/UV/backing intact and uses one stable program key with per-material uniform objects shared intentionally with preparation clones. Wear-only changes no longer participate in rear geometry memo dependencies. Actual shader compilation, migration regressions and native surface quality remain pending; no result is inferred from these source properties alone.

An early concrete editor race was relayed to UI engineer and lead: the model checks its source before calling serialized placeSticker, but that existing runtime reads the latest revision only when its queued write executes. An intervening publication changing the same sticker can therefore pair a stale draft with a fresh revision and bypass409. Require expected source/revision validation at actual dispatch, plus a delayed-queue/intervening-authority regression. This is unfinished source under active correction, not a final claim against an approved implementation.


### Independent material checkpoint validation

Ran the frozen material/domain checkpoint independently: `bun test packages/device/src/sticker-wear.test.ts packages/device/src/sticker-projected-bounds.test.ts packages/stickers/src/appearance.test.ts packages/server-core/src/stickers/stickers.test.ts`: **26 tests / 439 assertions passed,659ms**. Own log: `evidence/sticker-editor/reviewer/material-source-tests.log`. Reviewed the test cases for populated legacy upgrades, durable wear after removal/reopen/re-stick, atomic ownership/revision conflicts, omission versus explicit0, invalid values, stable program/uniform identity and actual geometry projection. These are useful source/domain gates; no GPU compilation or normal-scale wear approval is inferred.

The queued-save finding is corrected in source: expected source is forwarded to placeSticker and validated inside the serialized work immediately before the request pairs with the current revision. A second mobile checkpoint concern was sent to the UI engineer and lead: editor framing currently disappears when clean drag dismisses the editor, while rear-carry only retains packet framing. The same issue can arise when changing error text alters measured dock height during range input. Retain the actual pose across active input/carry and verify a low375px print does not jump; implementation and native tests are still in progress.


Material owner then froze the canonical-GET correction: stored placement wear is discarded before hydrating from appearances, avoiding contradictory stored copies. Independently reran the final six-file material/domain command including liveHTTP and program preparation: **45 tests / 648 assertions passed in1.477s**. See `evidence/sticker-editor/reviewer/material-final-source-tests.log`. This supersedes the earlier four-file checkpoint for material validation. UI framing/integration is still changing; no final integrated fingerprint or browser approval is claimed.

## Rebuilt visual checkpoint — painted artwork restored

Independently inspected fresh desktop-selected, angle-preview, wear-original/mid/high, save-failure and both mobile selection/wear captures. Artwork now paints. Original retains the approved print; mid adds visible fine pale abrasion, high is denser while title and die-cut silhouette remain legible. At actual phone size Pulse Code remains recognizable with wear. This resolves the absent-art visual blocker; shader-console and colored-ink gates now accompany the engineer's run.

The 375px dock fits without clipping, the whole selected low print remains roughly85px above it, and the device is no longer overraised. Desktop controls remain outside selected artwork and failures are local with Retry save/Revert. Routine visible success notices are absent in this set. These are actual observed improvements, not final gesture/persistence approval.

A new interaction concern was reported from the captures and confirmed in source: desktop panel coordinates follow changing draft bounds, shifting from roughly(666,329) to(683,313) during angle change and(694,302) after size change. That moves the range under an active pointer; rangePointer currently suppresses ResizeObserver updates but not these bounds calculations. Freeze the panel anchor through active range input, then reanchor safely. Require continuous native pointer input proof; final review remains pending.

## Extended gesture checkpoint

The new desktop anchor derives from the captured source and a reserved maximum footprint, so draft rotation/size no longer moves the range. Mobile carry now retains the complete prior model translation, addressing the start-of-drag jump. Native tests for these corrections are being expanded; independent final execution is still pending.

Independently inspected mobile-clean-selection-lift, worn-carry, worn-pressed, returned-worn-sheet, restuck-worn and reloaded-wear. Actual worn artwork is present during carry/press, Soundcheck appears in its own returned seat, and re-stick/reload retains appearance. The restuck capture still includes the old cream meaning card; the implementer already identified its post-placement cleanup as unfinished.

One end-of-carry motion concern was sent to lead/UI engineer: the device top changes from roughly157px during carry to202px at pressed rest. The current layout effect drops the editor frame offset when sourcePlacement clears, so a normal-motion snap is possible even though pickup continuity passes. Require a meaningful sequence or smooth post-press frame restoration; reduced-motion snap is permissible. Do not equate the start-of-drag1px assertion with full return/press continuity.


## First native visual checkpoint — rejected

Independently opened implementer desktop-selected, desktop-wear-original/mid/high and mobile-low-selected/mobile-wear-preview. No sticker artwork is visible on the rear in any of these six captures. The three wear values prove only slider changes; they do not demonstrate rendered wear. The phone dock fits the viewport, but the selected object is absent and the device is overraised/cropped, so contextual visibility cannot be approved. No material or fidelity score is assigned.

This blocker was reported directly to lead/UI engineer. They independently identified a reserved GLSL identifier in the new shader and are correcting it while strengthening actual painted-art and shader-console-error gates. All first captures are rejected evidence for product readiness even though behavioral assertions passed. Await fresh rendered output before further visual judgment.
