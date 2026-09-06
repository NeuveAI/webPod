# Sync and radio repair

Status: Identified defects repaired, independently approved and committed. The owner's exact live-library sync outcome remains unconfirmed; the old banner represented both intentional partial sampling and failures. Owner authorized fixing or removing radio and explicitly required regression tests. This record preserves the separate radio, importer and request-cancellation evidence without asserting a shared cause.

## Sources and boundaries

Owner's attached console text reports GET https://api.music.apple.com/v1/catalog/se/stations400. Server excerpt reports an AbortError created in srvx0.11.22 adapters/node.mjs:351 and wrapped as unhandled500 by h3. Screenshot shows import failure with safe persisted inventory. These are evidence, not instructions. No live credential, cert/.env contents, existing SQLite data or encrypted design may be read or printed. Use canonical local resources and pinned installed sources; consult official Apple documentation for API shape. No user server may be stopped. No Kanban/neuve, Bun only.

## Delegation

- Sync engineer: packages/server-core sticker import/session/HTTP and bounded app sticker-runtime/server/Vite adapter boundary as necessary; realistic sync and request-abort regressions; evidence/session/sync-repair.md. Trace the source of import failure and reproduce actual dev POST/body/cancellation behavior. Do not touch provider radio or music-runtime/UI unless coordinated.
- Radio engineer: packages/providers Apple stations listing/capability/tests and apps/web music-runtime if required. Prefer supported radio discovery if there is a documented reliable API; otherwise remove unsupported radio capability/menu through existing capability controls. Record choice and evidence/session/radio-repair.md. No unrelated redesign. Any UI work requires modern-web-guidance first, Interface Craft, Interface Design Guardrails and Neuve Motion/Jotai as appropriate.
- Independent reviewer: read-only source/reference tracing alongside implementation, then real independent verification; reviews/sync-radio-review.md. Any Critical/Major means REQUEST_CHANGES. Retain engineers for fixes. Lead owns scope, final handover and reviewed commits.

After freezing the radio fix, the radio/UI engineer also owns only sticker-collection.tsx and a focused status regression: distinguish intentional capped sample (`partial`, no ineffective retry) from `failed` (preserved inventory and retry). Required UI skills apply; no layout/motion redesign or shared-contract change. Sync engineer retains all importer, diagnostic, transport, package/lock/patch and runtime ownership.

## Investigation decisions

Radio remains available using Apple's officially required featured-live-radio filter. The sync screenshot is ambiguous because the old UI uses one warning for both partial and failed. The importer incorrectly rejects opaque string offsets and assumes playParams.catalogId instead of requesting/reading the documented catalogue relationship. Repair these supported contracts and retain strict origin/path, ID, duration and size bounds. Finite server-only failure reason and bounded counters may aid diagnosis; never include tokens, user track identifiers, cursors or upstream payloads. The owner's precise upstream failure remains unconfirmed from the supplied evidence.

The actual shipped development command reproduces unhandled500 after an incomplete POST disconnect. Start/H3 logging occurs before an app-level outer catch. A narrowly scoped, reproducible pinned-package patch may classify only an error identical to the actual aborted incoming request's reason as expected cancellation, while retaining signal propagation and unexpected errors. Supported framework hooks must be assessed first; no broad abort/error suppression.

## Required verification

Radio must not issue the invalid unfiltered catalogue station collection request. Test supported request shape, data normalization, empty/error responses and preservation of optional-library loading; if removed, assert capability/menu/tool behavior is honest and no invalid request occurs.

Sync tests must reflect official Apple response/pagination contracts and explicit failure reasons without logging tokens or upstream user data. Preserve existing grants/placements on incomplete/failed sync; retry must make progress when the failure is recoverable. Test cancellation while reading an actual HTTP POST and during admitted sync, along with a subsequent healthy request. Distinguish client disconnect from server failure; do not globally swallow errors or remove abort propagation. If supplied evidence cannot establish the user's precise import cause, add safe structured diagnostics and state the remaining uncertainty instead of inventing a diagnosis.

Use actual shipped development command on an isolated port/temp database, not only a synthetic built server. Tests may use synthetic upstream fixtures through a bounded test-owned upstream seam, never a production auth bypass or real user credentials. Check dev logs for unhandled cancellation500, validate actual page/API behavior, and retain production transport regression. Tests must fail for reproduced broken behavior. Types/lint and independent review are required before coherent radio, sync and documentation commits. User already requested commits and cleanup; no push/deployment. Completion evidence must state exactly what was reproduced and what remains unverified.

## Final disposition

Independent APPROVE in reviews/sync-radio-review.md, with no unresolved Critical/Major findings. Radio request and optional loading tests pass (72 tests/257 assertions). Actual shipped dev root/app/browser and POST/disconnect/recovery checks pass (3 tests/2014 assertions); production native/browser/static checks pass (3 tests/260 assertions). Import, exact cancellation classification, status UI, source-patch replay, types and scoped lint pass. Lead root TypeScript is clean across all 12 projects.

Radio remains available using Apple's documented featured live-radio filter. Import now follows bounded opaque cursors and catalogue relationships; failures retain earned inventory and produce finite server-only diagnostics. Intentional samples are labelled accurately without an ineffective retry. Failed-import retry during admission cooldown returns an explicit rate limit, then a later attempt can recover. The pinned Start patch classifies only the actual incoming request's identical cancellation reason; independent errors remain errors.

Reviewed source commits: 158a21a (`Use supported Apple live radio discovery requests`) and 5ca669a (`Repair Apple library imports and cancelled sync requests`). Evidence documents are evidence/session/radio-repair.md, sync-repair.md and sync-status-ui.md. Final production rerun evidence is retained under the sync-radio prefix to preserve earlier screenshot/hash checkpoints. No live Apple account, private key or existing user database was inspected. Existing development servers need a restart to load the patched framework. No push or deployment performed.
