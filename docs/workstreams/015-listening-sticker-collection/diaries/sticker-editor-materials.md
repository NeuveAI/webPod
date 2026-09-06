# Sticker editor materials

## Read-only investigation

Read the full sticker-editor scope, direct-manipulation handover and owner screenshot. The current printed art already contains deliberate distress; wear zero must preserve that existing image rather than promise a pristine reconstruction. Modern Web Guidance was searched through bunx before investigation. Existing Interface Craft, Guardrails and Neuve Motion guidance remains applicable to actual visual validation, with the current physical product materials taking precedence over unrelated flat interface styling.

Placements are already stored as Drizzle JSON text in `sticker_collections.placements`. Both HTTP and repository writes call shared `isStickerPlacement`; inventory validation also calls it. Proposed `wear?: number` accepts legacy omission as zero and rejects present nonfinite/out-of-range values. No SQLite column migration or new service is required. Tests should cover legacy rows, valid persisted wear, rejected malformed wear and restart/session roundtrip.

Existing width limits are .08–.35 of the rear width and rotation is -180–180 degrees. Validation also checks the rotated occupied artwork rectangle against the rear safe zone. Changing size/rotation near a boundary can be invalid even when the scalar is in range. Preserve that validator as authority.

The key propagation hazard is `sticker-collection.tsx` pointer move: it reconstructs the placement from coordinates, width and rotation, dropping any new wear field unless explicitly retained. Preview/source placement and conflict/cancel reconciliation must keep wear. Returning removes the placement record, so placement-only wear resets on return; retaining customization while unplaced would require a broader data model and is not silently added.

Current `StickerPrint` owns two MeshPhysicalMaterials, borrows geometry/maps, and assigns earned/locked/vacant/backing shader variants. Proposed wear affects only earned front ink and laminate response. It retains source alpha and UV so hit testing and silhouette remain coherent. Stable UV/sticker-ID seeded abrasion, edge scuffs and sparse hairlines should vary roughness/clearcoat as well as ink. No animated noise, artwork modification, extra renderer or light is needed.

Pinned Three 0.185.1 shader source is authoritative: map_fragment controls source color/alpha, roughnessmap_fragment computes roughnessFactor, and lights_physical_fragment assigns material.clearcoat/clearcoatRoughness. A versioned uniform-enabled earned shader should prepare at wear zero; slider values update its uniform and invalidate demand rendering, without recompilation or material allocation per value. Existing preparation clones copy onBeforeCompile/customProgramCacheKey; uniform ownership must remain valid for original and retained preparation clones. A fixed program key must still distinguish the earned wear shader from locked/vacant/backing programs.

`EquippedSticker` currently recreates geometry whenever the placement object identity changes. A wear-only draft must not trigger that; geometry dependencies should be limited to art/rear and geometric scalar fields. The carried print must receive preview wear or source wear so it does not become fresh while lifted. A same-ID draft must visibly update the actual selected print before persistence, without changing other materials.

Proposed ownership was sent to lead and collection engineer: shared placement contract/tests, device contract/StickerSurface/narrow StickerPackScene forwarding, a bounded new wear shader helper/tests, and server persistence tests. No implementation has started; awaiting the reviewed designer brief and explicit contract agreement. Actual normal-size wear0/mid/high captures remain a required acceptance gate, not inferred from shader parameters.

## Approved durable contract and implementation

Lead and reviewer required wear to follow the owned sticker after return. This supersedes the placement-only investigation above. Additive schema v4 adds `sticker_collections.appearances` as typed JSON `StickerAppearance[]`, default `[]`. Existing transactional migrations preserve v1/v2/v3 paths and reject future versions before mutation. Only temporary fixture databases were opened/migrated; owner storage and credentials were untouched.

`StickerInventory.appearances` is optional for legacy response compatibility, and the server emits the canonical list. Shared validation rejects duplicate, unknown or unowned IDs, malformed wear and more than the current catalogue cap of60 entries. Missing appearance renders zero. Placement PUT remains the write API: explicit wear changes canonical appearance, omission preserves it, explicit0 resets to original, and removal retains appearance. Geometry and appearance update atomically with the same owner/revision CAS. Persisted placements exclude wear; GET strips any legacy/contradictory placement wear and hydrates from the canonical list only. Rotation/size remain placement properties.

`StickerPrint` owns a stable mutable amount/identity uniform. The versioned earned program exists at wear0 during existing prewarm; changing a range value changes neither material.version nor shader key. Preparation clones retain the same callback/uniform owner, and borrowed artwork maps remain untouched. Front-only UV/id-seeded edge scuffs, abrasion patches and sparse hairlines modify ink/roughness/coat; alpha, visible geometry, raw backing and immutable PNGs are unchanged. The existing art's baked distress remains at0. Wear-only draft changes no longer recreate equipped geometry. Sheet prints read canonical owned appearances, while carried prints prefer preview/source wear so return and press retain the same finish.

Added actual transformed-geometry projected bounds for editor positioning. Device scene/contract wear forwarding and bounds were handed off frozen to the UI owner, who exclusively owns the subsequent composed mobile editor framing effect. No competing pose writer was introduced by this material lane.

Own source verification:45 tests/648 assertions passed across appearance validation, repository/migrations/live server, wear uniform/callback identity, projected bounds and preparation lifecycle. Device and server typechecks plus scoped lint passed; shared types and final integrated validation follow. Evidence is under `evidence/sticker-editor/materials/`. Normal-size original/mid/high rendered material acceptance is still pending the UI owner's browser build; no visual-quality claim follows from these source tests.

## First rendered rejection

The first native editor captures showed a blank rear where equipped art should be, including Original and high wear. These captures failed material acceptance despite passing state assertions. The shader used GLSL's reserved identifier `patch` for an abrasion mask; renamed it to `abrasionPatch`. The source-only uniform tests never compiled GLSL and therefore could not detect this. Actual shader-console and visible-print checks were requested in the native runner before any subsequent acceptance. No valid material comparison is inferred from those blank captures.

## Rebuilt material visual review

Inspected the fresh painted `implementer/desktop-wear-original.png`, `desktop-wear-mid.png`, `desktop-wear-high.png`, `mobile-low-selected.png` and `mobile-wear-preview.png` at their normal capture scale. Original/mid/high show an increasing density of substrate flecks and coat scuffs on Soundcheck while retaining its orange lettering, recognizable amplifier and die-cut silhouette. Pulse Code remains unchanged when Soundcheck is edited. The smaller mobile Pulse Code treatment is subtler but legible, with the selected print above the editor dock. No further shader calibration is needed from these views. Actual native shader-error and colored-art gates now pass. Worn carry/press/returned-sheet and reload continuity still require the forthcoming native sequence; this inspection does not claim those states have been viewed yet.

## Carry and return visual review

Viewed mobile worn-carry, worn-pressed and returned-worn-sheet captures. Pulse Code retains its treated front while the exposed adhesive underside remains unprinted. The returned Soundcheck sheet slot visibly keeps its added wear, while the large wrapper artwork remains unchanged. No shader correction is indicated.

The first re-stick/reload captures are insufficient for visual persistence acceptance: the re-stuck Soundcheck is partly hidden by the liner/old meaning panel, and the reloaded print sits mostly behind Pulse Code. API assertions prove the value persisted but cannot establish the obscured appearance. Requested an actual placement at an unoccupied valid rear location and unobscured after-close/reload captures. That visual requirement remains pending.

## Final material visual acceptance

Inspected the replacement unobscured `mobile-restuck-worn.png` and `mobile-reloaded-wear.png`. The entire worn Soundcheck is now visible above Pulse Code. Its flecks/scuffs, recognizable lettering and die-cut silhouette match before and after reload; Pulse Code remains separate and unchanged. Combined with original/mid/high, carried/pressed and returned-sheet inspections, the material visual gate is satisfied without further shader edits. This is acceptance of the actual Chrome375 capture sequence and corresponding native/API persistence checks, not physical Safari certification or a claim of photographic aging simulation. Final integrated review/source provenance remains owned by lead and independent reviewer.
