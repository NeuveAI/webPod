# PLAYWORN app implementation handover

Prepared 2026-09-06 from the current repository by the independent collection reviewer. This delivery exports artwork and defines the next implementation boundary; it adds no app behavior. The user selected Heavy Rotation as PW-A05. Keep that approved record/chain illustration, the actual compact cassette Mixtape Kid, and the separated cassette/drum-machine Beat Tape. Rejected Back Again/Riff Ritual variants and comparison boards are not part of the sixty.

## Asset contract

The delivery location is `assets/stickers/playworn/<genre>/<catalogue-id>-<name>.png`; use the accompanying export manifest as the authority for the exact sixty filenames, source nodes, intrinsic dimensions and alpha limitations. The twelve collections are pop, rock, metal, hip-hop, R&B, electronic, indie, jazz, classical, country, reggae and Latin. Directory spelling comes from the manifest. Catalogue IDs are identity; names and Pencil node IDs are metadata, not runtime identity.

These PNGs are the immutable printed artwork layer. Their ivory cut border, colored ink, halftones and printed wear are intentional. Do not erase ivory by color keying: it is also interior lettering and stock. Transparent surroundings must exclude proof mats, adjacent sheet designs and board labels. Alpha is the silhouette contract for BOTH printed color and laminate. Native sheet exports can retain near-zero (1/255) alpha speckle in otherwise transparent margins; some viewers misleadingly show its white RGB. For interaction bounds and silhouette classification, use a documented sensible alpha threshold rather than treating every nonzero pixel as solid. Preserve genuine edge antialiasing in color rendering, and verify the finish cannot turn this near-invisible residue into a reflective rectangle. This residue is distinct from opaque proof-mask bars, which must be removed from the delivered image. RGBA alone does not prove a usable silhouette; inspect the exported result against dark and saturated backgrounds. Historical exports included opaque proof mattes and masked shared-sheet crops, so consult the final export audit before treating any file as material-ready. Demo Days and Room Tone received background-only image-generation extraction for final transparency; their provenance is a visually matched derivative, not a pixel-identical alpha edit of the prior source. Intrinsic dimensions intentionally vary; do not normalize by upscaling files. Use the manifest's `alpha.visibleBounds` (threshold 16/255; right/bottom exclusive) to normalize visible sticker size and placement padding while preserving each image's aspect ratio. Exclude near-zero residue when interpreting occupied bounds. Upsampling is not additional source detail.

The repo-root asset directory is not currently a browser public directory. `apps/web/public/hand/classic-glove.glb`, referenced by `/hand/classic-glove.glb` in `apps/web/src/hand-cursor/state.ts`, is an existing public-asset convention. The next agent must deliberately wire this collection into build-resolved asset URLs or a documented public-copy step. Do not assume `/assets/stickers/...` resolves merely because the files exist at repository root, and do not send local filesystem paths to the browser. Verify the production build URLs, not only the development server.

## Grounded integration map

| Current file | Responsibility and next integration point |
| --- | --- |
| `apps/web/src/production-device-view.tsx` | `ProductionDeviceView` supplies the production panel, device orientation and control handlers to `CompositeDevice`. Thread a documented placement contract through this boundary if app-level ownership is needed. Do not add a parallel demonstration-only renderer. |
| `packages/composite/src/CompositeDevice.tsx` | Mounts `DeviceCanvas` for the T1 path and coordinates the DOM LCD and input bridge. Preserve tier/context-loss behavior and the existing screen material bridge. |
| `packages/device/src/DeviceCanvas.tsx` | R3F Canvas uses `frameloop="demand"`; it mounts Device and sibling scene children. Asset completion, material changes and placement changes must invalidate appropriately. Do not add a permanent animation loop just for sheen. |
| `packages/device/src/Device.tsx` | Owns shell meshes, surface maps and their disposal. Attach a bounded sticker surface layer within its device model hierarchy so art rotates with the shell. A raw Canvas sibling will not automatically inherit the device transform. |
| `packages/device/src/ViewerLitDeviceFrame.tsx` | Rotates `device-model`/`device-model-content`; lights are world-fixed siblings. Keep stickers under the model and keep lights outside it so reflection moves correctly when the iPod rotates. |
| `packages/device/src/product-shell.ts`, `curved-shell.ts`, `form.ts`, `surface-layout.ts` | Existing physical form/surface geometry. Derive conforming sticker position and normal from the actual shell; a floating rectangular plane across curved edges is not equivalent. Resolve front/rear coordinates against this geometry, not the board's pixel positions. |
| `packages/device/src/materials.ts` | Central device material numbers and injected defaults. Put the shared laminate recipe in a named central table, following this ownership convention; avoid inline per-genre material literals. |
| `packages/device/src/textures.ts`, `material-map-ownership.ts`, `physical-materials.ts` | Existing distinction between albedo and roughness, generated maps, physical materials, shader specialization, and map ownership. Reuse the lifecycle pattern, not the steel's visual recipe. Keep color texture and non-color roughness/normal data separate. |
| `packages/device/src/StudioEnvironment.tsx`, `env-map.ts`, `light-rig.ts` | Existing scene environment and illumination. Let the laminate respond to this rig; avoid a second sticker-only light bolted to each decal. |
| `packages/state/src/contract.ts`, `store.ts`, `index.ts` | Shared Jotai device state and action atoms. There is one exported `deviceStore`; its factory is test-only. Expose selected/equipped sticker state and writes to external callers through the same public-state discipline. |
| `apps/web/src/music-runtime.ts`, `packages/providers/src/provider.ts`, `domain.ts`, `identity.ts` | Provider/runtime boundary and available playback/library identities. A queue history or genre browse facet is not an audited listening-duration ledger. Unlocking needs a separately specified event/counting contract. |

The inspected device package pins Three `0.185.1` and R3F `9.7.0`. Repo law requires library implementation to be grounded in `~/code/agentic-context/`; that directory was absent during this handover. Restore/locate that source before designing any new version-sensitive shader or loader API. These notes are repository integration guidance, not a substitute library API reference.

## One collection-wide laminate

Separate the visual layers conceptually even if the renderer uses one physical material: PNG RGB/alpha is printed vinyl; roughness/normal and clearcoat/specular response are the laminate. The laminate must be clipped by the exact same alpha UV transform as the print, including holes and feathered die-cut edges. It must never reflect across the image's transparent rectangle. Use one UV transform for all maps; no independently scaled mask that clips the ivory border.

Prefer a shared physical finish within the existing Three renderer. A separate overlaid shell is optional only if needed for the chosen technique and verified free of z-fighting, sorting halos and silhouette leaks. Do not bake a bright moving highlight into sixty alternate PNGs or use a screen-space CSS shine on the production 3D body. Keep print distress in the base; avoid animated grain or chunky normal-map damage that makes intact laminate look crumpled.

Starting art-direction values below are proposed tuning ranges, not measured manufacturing data or approved runtime settings. Calibrate one representative dark, bright and ivory-heavy sticker together under the production lighting, then apply the same recipe to all collections.

| Parameter | Initial direction |
| --- | --- |
| Base metalness | 0 for printed vinyl; do not make all black ink metallic. |
| Base roughness | Approximately 0.5–0.65; the overlying coat supplies restrained satin sheen. |
| Clearcoat strength / roughness | Start around 0.3 / 0.35; tune within roughly 0.2–0.5 / 0.25–0.45 for a broad soft reflection, not a wet resin dome. |
| Microtexture | Deterministic, seamless, low-amplitude roughness variation (roughly ±0.02–0.04), shared physical scale. Use no visible repeating tile at normal device size. |
| Surface normal | Flat initially. If micro-normal is needed, add only after roughness-only comparison; preserve lettering and do not introduce visible embossed ink. |
| Light/env intensity | Reuse the production rig and exposure first. Do not compensate bad artwork alpha or incorrect color-space handling with extra lights. |
| Die-cut edge | Existing printed ivory perimeter is the visual baseline. Any geometric lift should be minimal and use the shell's model-unit convention, not an assumed millimeter-to-unit conversion. |

Reflection should follow camera/light/surface geometry, becoming a soft passing highlight as the device turns. A stationary device should not have an autonomous endless shimmer. Any optional interaction animation must respect reduced-motion behavior and stop scheduling frames at rest. Tiny printed metallic accents remain printed colors unless separate authored masks are supplied later; do not infer foil solely from yellow pixels.

## State and product boundaries for the next agent

No `useState`, anywhere. New selection, inventory, placement and unlock state must remain readable/writable/subscribable outside React using module-level Jotai atoms and the agreed store; tool callbacks and UI must share those values. Follow existing action atoms and public exports. Store stable sticker IDs, surface, position, size and rotation rather than duplicating image blobs. Texture/GPU handles are runtime resources with explicit caching/disposal, not persisted user data.

The user requested listening-earned packs but has not approved exact duration thresholds, genre attribution rules, replay counting, provider reconciliation or persistence behavior. Captions on design boards are illustrative stories, not executable earning rules. Separate those decisions from base rendering so this artwork handover does not silently choose eligibility policy. Likewise, the current Pencil device board is a visual reference, not a complete collision/placement specification.

## Verification before implementation handoff

- Verify sixty manifest entries and sixty files, five per collection; confirm the chosen Heavy Rotation and latest cassette/equipment revisions by sight. Decode every PNG, record intrinsic dimensions, and test true transparent surroundings and complete cutlines against white, carbon and a saturated checker.
- Demonstrate flat/base-only and finished-material views side by side using the same artwork. Turning the finish off must not change print identity, crop, aspect or color palette.
- Inspect three representative palettes under front, oblique and rear device orientations, including 90-pixel-wide sticker previews. Shared laminate should relate the family without bleaching black metal lettering or hiding small type.
- Confirm alpha also gates specular, shadow/depth behavior and hit testing as appropriate. Transparent image corners must not cover controls, block orientation grabs, or leave a reflecting rectangle. Keep the LCD and click-wheel usable.
- Test production asset loading, SSR/client hydration, T1 context-loss recovery and the existing fallback path. Dispose owned maps/materials on removal; reuse shared maps safely without one sticker disposing another's texture. Show demand rendering settles at rest.
- Test external store actions and rendered equipped state agree; if persistence/unlocks are implemented, verify their explicit contract separately from screenshots.
- Run meaningful targeted tests plus repo typecheck/lint/build using `bun`/`bunx`. Existing relevant browser suites include `apps/web/tests/product-lighting.e2e.ts`, `apps/web/tests/production-view-parity.e2e.ts` and `apps/web/tests/device-orientation.e2e.ts`; use them according to the change, rather than rewriting unrelated device geometry tests.

No app implementation or unlock approval is implied by this document. The final export audit is the asset-readiness evidence; this document is the subsequent renderer/material brief.
