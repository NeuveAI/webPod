# Shared sticker pack assembly implementation

Source implementation is ready for independent review. Full native scene adoption, visual/interaction fidelity and6x responsiveness remain host acceptance gates; no browser actions, traces, deployment or commits were performed here.

Read the complete gpu-worker scope dispatch G and renderer-host plan. Host released Scene only after the reviewed sticker transaction caller patch was committed. Baseline commit is789c8f096741c530b8e17307c8f120f8e302afbd. The complete handed-off uncommitted Scene is archived in evidence/gpu-worker/pack/StickerPackScene.before.txt; SHA2567dd6b7f5b2c817990e65e0e8f0a8745d64930993ea7419ff61f7d980ecd21c70 is recorded in baseline.json. It includes the host's local carry orientation/epoch changes. Reference scripts do not use moving HEAD.

## Implementation and ownership

`sticker-pack-recipe.ts` contains the exact group hierarchy, visibility, neighbor fan transforms, liner travel/curl, sleeve placement/folds, print slot placement/bow/width/appearance/wear and stock material values. `StickerPackScene.tsx` renders that recipe through its existing GL paper/print components. Its main reframe, query/projection, asynchronous release fit/save, carry deformation and callback paths remain intact. Carry remains the original sibling outside the workspace wrapper. The original segments remain24 for parked prints and96 for paper; sleeve extrusion retains its original curves/bevel groups. No FX, clearcoat, material or resolution reduction.

`sticker-pack-graph.ts` lets the renderer supply already-prepared leaf objects and construct the same hierarchy. It preserves names owned by supplied print factories when the recipe does not override them. `stickerPackLeafSlots` exposes exact local/world matrices and inherited visibility alongside typed leaf descriptors. Prints include artId,width,bow,appearance,wear, geometry input/key and original renderOrder4. Paper leaves include size,ink,liner,curl and epoch. Sleeve part descriptors include exact geometry/material slot and fold transforms.

The **existing paper pool/worker** is the only paper/pack producer. It now handles immutable sleeve, fold-plane, parked-print and GPU-paper rest geometry in addition to its original dynamic CPU paper jobs. GL uses lightweight resource wrappers through `usePackGeometry`; identical recipes share the same computation and buffers. GPU-paper geometry leaves preparation once; curl remains a uniform using the unchanged accepted shader implementation. Its exact return-clearance bounding sampler is installed on the owned wrapper and restored on cleanup. The transaction broker remains untouched and continues to own damage/contour/surface preparation.

Geometry results use the existing lossless ShellGeometryTransfer, preserving all attributes (including GPU paper adjacency), index type, groups, drawRange, names and computed bounds. Main cache buffers are borrowed, never transferred. Wrapper disposal and cache lease release happen after replacement/unmount; skipped publications are retained and released. Preparation errors are surfaced to the existing error boundary rather than silently rendering an incomplete pack.

## Host API and integration handoff

- `createStickerPackRecipe(sceneAssetsAndAppearances, pack, {width,height,pixel,x,y,workspaceLowering}, visible)` returns the shared tree. Host uses the same canonical viewport metrics already captured by its scene input.
- `stickerPackPaperMaterials(size,ink,liner)` returns exact back/edge/front stock values; the host supplies its existing roughness/bump and studio textures. GPU curl installation stays with accepted paper node material factories.
- `stickerPackSleeveParts(size)` plus `stickerPackSleeveMaterials(pixel,ink)` provides pocket and three exact fold meshes and material-array order.
- `acquirePrivatePaperPackGeometry(input, port, signal)` (exported from sticker-pack-resources.ts) returns `{resourceId,release}`. Supplied port is consumed and receives `{version:1,id:resourceId,value:{parts:Record<string,ShellGeometryTransfer>}}`. GPU-paper input returns front/back/edge; sleeve, plane and parked-print return geometry. Input discriminant and key types live in sticker-pack-recipe.ts.
- Native receivers dispose their geometry/GPU wrappers before calling release. The private copy comes directly from the same paper worker via MessagePort; it neither detaches main arrays nor re-runs a lost canonical recipe. Lost canonical producer rejects private acquisition so host can select its explicit complete GL recovery.

Host owns renderer/native input, equipped/carry integration, texture/material adoption and final readiness. It must not declare a complete native pack from this recipe alone. Scene and all pack-owned files are released to the host only after this coherent handoff; coordinate reviewer fixes before concurrent edits.

## Bounds and lifecycle

One worker executes a single FIFO operation: dynamic paper, immutable pack preparation or private copy. Dynamic clients retain one pending latest job each. Combined clients/resources are capped32, private owners32, and retained/queued/active/private storage is conservatively admitted under96MiB. A4MiB fixed-work reservation covers each unprepared fixed-topology pack resource and each dynamic client; geometry proof verifies native+main outputs fit that reservation. This is explicit buffer/work reservation accounting, not measured JavaScript/GPU heap. Private copies reserve two payloads until acknowledgement and one until release.

The execution deadline now belongs to the shared producer and begins when a job is dispatched, never while a paper owner waits in the queue. This removes the prior per-hook queue-time timeout that could start duplicate fallback while the existing worker still computed. Producer failure terminates it before exact cooperative recovery; no second geometry producer/cache exists. Cooperative preparation uses the original constructors and yields between their native stages. Individual fixed-topology Three constructor/typed-array/bounds operations remain indivisible browser/native work; no phone timing claim or unmeasured guarantee is made for a failed-worker path.

Ordinary last-owner cancellation keeps one charged native job until bounded completion and discards its result; it does not destroy other canonical renderer leases. Pending copy cancellation closes/removes a queued copy; cancellation during an active copy retires the producer before releasing its reservation. Idle resources expire after30s; explicit releaseUnusedPaperPackGeometry removes unused results and shuts down the worker when no clients/leases/jobs remain. Capacity is an explicit failure, not an unbounded queue or hidden approximation.

## Verification

All retained scripts are under evidence/gpu-worker/pack and run with `bun <path>/<name>.ts`:

- `geometry.ts`:36 cases against pinned original constructors; exact attributes/index/groups/drawRange/bounds and exact cooperative results. Both data copies fit the fixed resource reservation.
- `recipe.ts`: executes archived original JSX render tail and CoverPrint rather than a rewritten expected recipe.108 mobile/desktop/progress/reveal/turn cases match every group and leaf value;1,296 leaf world matrices match the shared imperative graph. Archive hash is checked.
- `materials.ts`:54 actual archived stock material constructors compare exactly with shared recipes, including all serialized material fields; original GPU shader factories remain unchanged.
- `lifecycle.ts`: actual Worker/MessagePort proves one dynamic+immutable producer, shared job identity, exact native/cooperative output, ordinary cancelled-owner canonical preservation, private exact transfer, mounted-buffer isolation, already-aborted private-owner cleanup, byte accounting, idempotent release, zero final ownership and explicit canonical-loss rejection.

Existing command: `bun test packages/device/src/sticker-paper.test.ts packages/device/src/sticker-sleeve.test.ts packages/device/src/sticker-sheet-metric.test.ts packages/device/src/sticker-free-carry.test.ts packages/device/src/sticker-return-path.test.ts packages/device/src/sticker-insert-bridge.test.ts packages/device/src/sticker-program-preparation.test.ts apps/web/src/sticker-pack-presence.test.ts apps/web/src/sticker-pack-tuck.test.ts apps/web/src/sticker-return.test.ts` —33pass,0fail,941,136 assertions (`/tmp/cpu020-final-tests.log`). Device typecheck and scoped source/proof lint pass. Web typecheck currently reports only the host's in-progress equipped-frame-adopted response forwarding at composite/device-render-host.ts116; host was notified. Do not attribute that failure to this source or claim the combined web gate passed.

Exact source manifest: StickerPackScene.tsx; sticker-paper-pool.ts; sticker-paper-preparation.ts; sticker-paper-worker.ts; new sticker-pack-recipe.ts, sticker-pack-graph.ts, sticker-pack-resource-data.ts, sticker-pack-resources.ts. Original sleeve/paper/surface/GPU shader factories and transaction broker are unchanged. Artifacts: this diary and evidence/gpu-worker/pack. No new unit tests, route, dependency or alternate renderer were introduced.

## Frozen source archive

The exact eight-source CPU020 handoff is preserved at `/tmp/webpod-cpu020-frozen-20260911/`, with relative source paths, `manifest.json`, and `cpu020-eight-source.patch`. The patch base is `6aeb023a4aeca9409fa72c6a583d4c8f24cf8ed0`; the pinned original parity reference remains `789c8f096741c530b8e17307c8f120f8e302afbd`. The patch was built through a temporary Git index, without changing real staging or the live host files. Its SHA256 is `d2046456c6e949f62a19177cbef7fcc010b183afee467135089e9f0e0a482411`.

Host archived `/tmp/webpod-pack-scene-frozen.tsx` immediately before its subsequent Scene extraction and confirmed the other seven modules were untouched. That pre-host Scene, not the currently evolving Scene, is the independent CPU020 review/staging source. The earlier `StickerPackScene.before.txt` remains the pre-implementation parity reference.

| Frozen file (packages/device/src) | SHA256 |
| --- | --- |
| StickerPackScene.tsx | `07b4c69c76ab3db8ef287ffb52b7feecade4349f22e68b8af7e2c2ae62fcd76c` |
| sticker-paper-pool.ts | `2643682840c46911437345dcc4aeb9ebfb90d104ef1becb22fd22041ec1f87a4` |
| sticker-paper-preparation.ts | `cdd44c90c5693d91d12db2bc0a509aaede24a367639e65fb2ec642c8a1bceb71` |
| sticker-paper-worker.ts | `6e8fd5288fc24ecbbda669693e97bfd5d305827885d74bff8a4b7ca5fa040f59` |
| sticker-pack-recipe.ts | `f52c6fc7b8ad1c1eddda44e0c96436848b101bb8158f28dedd2c92b8a37e73b2` |
| sticker-pack-graph.ts | `31ba31823f3bbe6f84adec8d15c5565971ffc6a560485bce1eac1fb85b57a775` |
| sticker-pack-resource-data.ts | `1f96ddfb77e74834a44219534bb3f5338c3b0fd86b50684cc477565bb194ea3c` |
| sticker-pack-resources.ts | `2cd7149d040337cc258dc327adbd8081a63e500cdcd2345bf8d902196b02ddce` |

## CPU024 lifecycle corrections and superseding freeze

Independent review reproduced three defects: final cancelled work did not re-run idle eviction; detached active dynamic work dropped its4MiB reservation; private owner admission happened after the cold resource await. Fixed only sticker-paper-pool.ts: empty dispatch now runs eviction, detached active work remains counted/charged until completion or retirement, and private callers claim one of32 owner slots before waiting, with idempotent failure/abort release. Actual worker reproductions are retained in evidence/gpu-worker/pack/cancellation-admission.ts/json; existing lifecycle.ts also passes. Scoped pool/proof lint passes. Independent reviewer must rerun before acceptance.

The corrected eight-source freeze is `/tmp/webpod-cpu020-reviewed-fix-20260911/`; `manifest.json` records every file hash. It supersedes the earlier snapshot only for this pool correction and preserves the exact original frozen Scene. Patch SHA256 `a7a963ac3dd18f93f4a1c61c35296dcedb75707635456737cb3d2304d494cc31`; pool SHA256 `d016698bd8fde9a5617f84c423674e0c7ea0b736002d8070df7703d1958e79ab`. Patch base remains `6aeb023a4aeca9409fa72c6a583d4c8f24cf8ed0`. Real staging and live host Scene were untouched.
