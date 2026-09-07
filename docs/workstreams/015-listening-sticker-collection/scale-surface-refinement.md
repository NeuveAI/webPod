# Scale and allowed-surface refinement

Source of truth: owner request in the sticker refinement conversation. Larger stickers may span two edges; no artwork may continue onto the front faceplate. Drops outside the shell should choose the nearest allowed destination. Preserve direct pointer ownership, persistence, return-to-sheet, and reduced motion.

Status: implemented and verified. No blocking product questions. Default: the steel/front material seam is the stopping boundary; scale may reach 120% of device width, with actual footprint fit controlling placement. PNG catalogue art stays unchanged; SVG contours are controls, not replacement artwork.

Dependency order: rear-only surface mapping and footprint fit → nearest drop projection and shared editor constraint → browser and geometry verification.

Scope: sticker domain size bounds, device surface/projection/carry, app sticker editor and placement integration. Existing unrelated worktree edits remain user-owned. No key access or deployment. Owner requested a commit after verification.

Verification: domain size validation, finite noncollapsed mesh and seam exclusion for large rotated and two-edge footprints, pointer drops at rear/side/off-device positions, scale persistence and all four grips, desktop/mobile browser captures, TypeScript and changed-file lint. Geometry tests are authoritative for the no-front rule; screenshots assess visual contact.

Evidence: focused test files beside implementation and browser test-results outside the repo. Review lanes: geometry/normal/depth correctness, gesture ownership/persistence, visual readability. No independent-agent dispatch planned. Commit scope: geometry and shared bounds, interaction and editor wiring, and regression evidence together.

## Implementation and evidence

- Replaced the front-support atlas with a steel-only unfolded chart based on the actual rear-shell section. Footprints project into the allowed rounded region; oversized footprints shrink only when they cannot fit at any center.
- Size ceiling raised from 0.35 to 1.2 body widths. All human/tool saves through the mounted UI normalize to the same fitted placement. Legacy edge placements render fitted behind the seam without modifying stored inventory on read.
- Drop projection uses real steel triangles, with projected nearest-point fallback for misses and back-facing triangle exclusion. Detached carry clears the camera-nearest body corner rather than assuming a fixed world Z.
- Library grounding: requested resources directory is absent on this machine. Checked installed Three Triangle implementation in packages/device/node_modules/three/src/math/Triangle.js; no dependency changes.
- Geometry/domain/editor regression suite: 84 tests passed across 24 files. New geometry tests cover 48 large/rotated/edge configurations, finite normals, repeatable fitting and seam exclusion. Projection tests cover rear, oblique and side cameras plus off-viewport drops.
- Browser evidence: /tmp/webpod-sticker-large-results/ (large rear, settled two-edge view, side carry, off-device carry and nearest drop). Scale controls also pass desktop/mobile coverage. TypeScript and changed-file lint passed.

### Edge-aware wear and bend clearance

- Inspected the user's prepared Chrome scene. On Repeat reported wear `0`; renderer and UI orientation telemetry matched, confirming its jagged steel-side edge was independent of wear.
- Measured triangle centers against the continuous rear chart: at widths 1.0 / 1.2, 357 / 397 centers were inside steel (minimum clearance -0.384 / -0.411 model units). Added local chord compensation to both rendered film and material pickup sampling. Same probes now report zero inside centers, minimum clearance +0.152 / +0.150.
- Seated local normals drive additional fine fraying at exposed rims. New placement geometry recalculates exposure; camera rotation does not. GPU alpha, contour extraction and picking share that contextual damage resource. Carrying retains source exposure until landing switches to the target surface.
- Maximum wear uses sparse elongated grooves with dark troughs and paper-colored lips; reduced broad abrasion patches and varied narrow edge fibers.

### Tilted peel and carry contact

- Partial grab displacement and carry-frame interpolation could cross the shell after the seated geometry was prepared. Wired the existing bounded first-contact sweep into the final PeelingPrint geometry pass, after peel, transport and landing transforms.
- Sweeps use the actual visible assembly collider in content coordinates and the immutable seated source (or destination while landing). Untouched adhesive vertices remain exact; moving contacts slide at the exterior rather than entering the body.
- Canvas `data-wp-sticker-peel-contacts` reports moved nodes, contact count, unresolved sweeps, queries and elapsed milliseconds for inspection.
- Regression covers 36 combinations of yaw, pitch, drag direction and hand/scripted peel. Verifies source-to-output segments and complete output triangles against the steel; no crossings, and attached nodes remain unchanged. Focused tests, TypeScript and lint pass.

### Drag latency and unintended pack opening

- Replaced the per-frame assembly BVH sweeps with a linear outward-support-plane constraint for the convex rear steel. It performs zero collision queries and needs no additional resource lifecycle hook. The 36-case independent triangle/contact checks still pass.
- Solver-only benchmark across those cases: median 0.086 ms, maximum 0.684 ms. This does not measure full browser input-to-paint latency. Canvas telemetry also exposes the geometry update duration via `data-wp-sticker-peel-frame-ms`.
- Destination geometry is created only during landing; paper geometry is skipped during rear carries. The initial pickup projection is retained in the Jotai pointer atom instead of recomputed on every move.
- Removed the bottom-30%-of-viewport trigger that automatically revealed and latched the pack open during a rear drag. Explicit return actions and existing sheet drop targets remain.
- Added browser assertions for dragging through the lower viewport without changing pack/sheet reveal and for zero collision queries. These new browser assertions have not been run in this follow-up. Focused geometry/editor tests (22), app/device TypeScript and changed-file lint pass.

### Detached edge tether regression

- Applying the source support planes after the free-carry blend constrained detached side/bottom vertices to their previous shell edges and stretched artwork into strips.
- Moved the constraint before transport interpolation and pointer-plane clearance. It now constrains the source peel; fully detached transport retains the free-sheet geometry exactly.
- Added a large wrapped On Repeat regression that reproduces deformation with the previous ordering and verifies exact free-sheet coordinates with the corrected ordering. Five carry tests, device TypeScript and changed-file lint pass.
