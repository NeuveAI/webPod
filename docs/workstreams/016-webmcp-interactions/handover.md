# WebMCP tools handover

Sixteen native tools are registered from the production device page. Both independent review lanes approved core and sticker behavior/protocol. Final verification outcomes are collected in `evidence/final-checks.md`; source-specific review evidence remains in the four review files.

## Public interaction surface

Every name below has the `webpod_` prefix. Tool schemas and runtime handlers reject malformed and out-of-range arguments.

| Name | Inputs | Behavior |
| --- | --- | --- |
| `list_status` | none | Full `items`, independent `selectedItem` with zero-based position, and count. Includes selected item in the full list. |
| `navigate_list` | direction `next`/`previous`, items | Audible, visible item traversal; acceleration for longer distances; at least 200 ms between moves and no catch-up bursts. Reports requested/actual movement. |
| `select_item` | none | Real center-button selection with physical feedback and navigation semantics. |
| `page_state` | none | Read-only loading/buffering/readiness, real operation clocks, traversal and nested sticker state. |
| `click_wheel` | button | `menu`, `previous`, `next`, `play-pause`, `center`; shared physical travel, accepted-action sound and transport semantics. |
| `rotate_ipod` | xDeg/yDeg | Relative pitch/yaw degree deltas; returns actual constrained orientation. |
| `flick_ipod` | face `front`/`back` | Existing physical spring, awaited settlement, reduced motion and interruption. |
| `open_sticker_pack` | none | Real pack reveal; does not claim a sealed pack. |
| `close_sticker_pack` | none | Real close; restores/discards transient carry without persistence. |
| `navigate_sticker_collection` | direction `next`/`previous` | Existing wrapped collection order and preparation state. |
| `sticker_list` | none | Full catalog, owned/available/locked/sealed/placed metadata, selected collection and held draft. |
| `get_sticker` | stickerId, source `collection`/`placed` | Grab available owned sticker using the shared visible carry state; preserves saved origin. |
| `release_sticker` | none | Restores exact saved origin or collection; discards draft edits. |
| `rotate_sticker` | degrees | Relative held-draft rotation, constrained by current editor contract. |
| `add_sticker_wear` | amount | Add normalized 0..1 wear to held draft, reporting actual applied change. |
| `place_sticker` | x/y | Normalized rear artwork-center coordinates, validated against current silhouette; awaits revision-aware persistence with held width/rotation/wear. |

Navigation counts are 1..1000. Degree deltas are -360..360. Sticker coordinates are 0..1, x left-to-right and y top-to-bottom while looking at the rear. Current domain constraints govern the physical silhouette and wrap eligibility.

## Readiness and cancellation

Music percentage is null where providers expose no reliable total. Sticker artwork preparation has real prepared/total counts and percentage. Known operation starts provide elapsed wall-clock duration, frozen on completion/error. An operation already loading before an observable start honestly reports a null start/elapsed value. Reads never reset the clock.

Mutations share one lease across tool families; status reads remain usable. Human input, abort, unmount and replacement state cancel owned transient work. A save already accepted by persistence may finish after its caller aborts; its pending guard and clock remain until the real write settles. Cancellation before admission cannot start a write. A timed-out wait does not permit a duplicate pending save. Failed saves preserve a recoverable draft when its authority remains valid.

Agent provenance remains agent. Sound uses the same audio path and respects mute/browser activation; tests prove scheduled cues and physical state, not external-speaker audibility. System reconciliation stays silent.

## Protocol and evaluation

Target: inspected September 4 WebMCP draft, `document.modelContext`, asynchronous registration, AbortSignal registration cleanup and callback cancellation, ordinary JSON-serializable results. Unsupported browsers retain normal human operation. The available external type package lags this draft; the small sourced boundary is contract-tested.

Chrome Canary 155's native consumer still serializes schemas/arguments differently from the draft. That compatibility adapter exists only in test code. Production registration follows the current draft. External `webmcp-tools` smoke compilation drops expected-result fields; the browser test wrapper explicitly checks them and includes negative controls. No credential-backed model-selection eval was needed or run.

Final native command: `W5B_PORT=4329 bunx --bun playwright test --config apps/web/tests/playwright.config.ts webmcp-native.e2e.ts`. It runs the existing `/` route from an immutable source snapshot, using deterministic test provider/inventory fixtures and the native registry. All sixteen tools and 24 explicit upstream smoke results are exercised across eleven browser scenarios.

## Shared work and staging

Changes are uncommitted; no push or worktree created. The concurrent sticker task owns experimental edge-wrap geometry/domain/editor work. Its geometry is outside these approvals. Shared seams were explicitly coordinated: sticker-collection import/ref/registry effects only; sticker-interaction animation-generation guards only. No private keys were read or moved.

Coherent staging groups: shared control feedback/readiness with tests; native core registration/tools and workspace edges; orientation controller/tests; sticker definitions/adapter/registry/lifecycle guards with tests; native fixtures/tests; workstream evidence. Preserve the other task's edits and inspect shared-file hunks before staging.
