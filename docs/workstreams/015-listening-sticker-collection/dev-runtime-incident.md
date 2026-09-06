# Development startup regression

Status: RESOLVED by reviewed commit bb1eb21. The owner's normal development server failed rendering /_spike/device with `Cannot find module 'bun'` from server-core/stickers/live.ts. The prior completion claim was withdrawn because production tests did not validate the documented development launch path. This record preserves that validation failure.

## Confirmed cause and validation failure

Independent reviewer reproduction of the shipped app script found a Bun parent spawning Node to run Vite. `/`, `/_spike/device` and `/api/stickers` all returned 500 while resolving the server-side Bun module. The inspected browser-transformed sticker route removed server handlers/imports. This establishes a development SSR runtime mismatch; the screenshot alone was not evidence of an executable Bun dependency in the browser bundle. Both boundaries still require final verification.

The existing app/panel Playwright launchers explicitly ran `bun node_modules/vite/bin/vite.js dev`, bypassing the runtime choice in the shipped `vite dev` package script. Production tests also ran the built server under Bun. These tests therefore could not detect the owner's failing startup path. Completion was declared without a required user-command-level check, and the lead owns that incorrect conclusion. The repair must close this test-path divergence, not merely add another forced-Bun test.

The stronger follow-up check exposed a second boundary failure: Vite's raw client dependency scanner traversed the server-only package and emitted unresolved-Bun warnings even after the runtime correction restored pages. The repair excludes only `@webpod/server-core` from client dependency optimization, consistent with Start stripping server handlers from delivered route modules. It does not alias Bun, suppress the overlay or replace server persistence. An independently observed startup timeout also requires bounded diagnostic output and successful final startup verification before closure.

## Correctness and ownership

Continue the existing session-dispatch.md contract and repository law. Engineer owns the smallest correct runtime/configuration/import-boundary repair and a meaningful automated startup regression. Independent reviewer owns read-only import/runtime tracing and independently executed checks. Lead owns this incident record, prior completion-record corrections and commits. No UI changes are expected; any UI change requires the previously mandated UI skills. No credentials, cert or .env contents may be read, printed or copied. No running user server may be killed. No Kanban/neuve, no force push, Bun only.

## Required investigation and acceptance

- Reproduce the shipped development launch path on an isolated port, without alternate injected Start entry or a forced runtime that bypasses package scripts. Capture only bounded non-secret error evidence.
- Distinguish Vite server-runtime resolution from actual client graph leakage by tracing installed Vite/Start/Bun source and the app dependency graph. Use /Users/vinicius/code/.better-coding-agents/resources plus pinned installed sources. Do not assume the screenshot alone proves which boundary failed.
- Fix normal root `bun run dev` and app development startup, including relevant sibling launchers. Do not hide the overlay, alias Bun away, replace persistence with a fallback, or rely on manual environment/runtime instructions that shipped scripts fail to enforce.
- A subprocess regression must launch the real package script, load both / and /_spike/device, assert actual renderer readiness and absence of Vite overlay/browser module errors, and exercise an anonymous sticker endpoint sufficiently to load the real server path. Use a temporary private SQLite path and no live Apple credentials; always clean owned processes/files.
- Validate dev client module responses/import graph and rebuilt production client graph contain no executable Bun/SQLite/server implementation. Run existing production native/browser integration after any runtime/config/import change. Public pages and unauthenticated API behavior must work without credential access.
- Independent reviewer runs relevant types/lint and the actual startup/browser regression; root lead sanity check follows. Any Critical/Major means REQUEST_CHANGES. Record exact commands, failed-before/passed-after results and runtime provenance. Correct prior completion/evidence records to acknowledge missing dev validation rather than preserving an unqualified completion claim.

## Artifacts and completion

Engineer records evidence/session/dev-runtime-checks.md and relevant tests; reviewer writes reviews/dev-runtime-review.md. Keep one coherent fix/test commit and a separate incident/verification documentation commit after independent approval. User already requested commits and cleanup. Completion requires the real shipped startup command and renderer passing, server-only boundary evidence, no unresolved Critical/Major findings, and a clean reviewed working tree.

## Verified repair

Final scripts invoke the installed Vite CLI directly with Bun for dev/build/preview. Root scripts and all three browser-evidence launchers delegate to this canonical app script. The narrow optimizer exclusion keeps server-core out of raw browser prebundling; delivered client modules remain stripped by Start. No storage fallback, overlay suppression or Bun alias was introduced.

Independent final review APPROVE: both shipped root/app startup cases pass (2 tests, 2004 assertions), with actual rendered / and /_spike/device, no overlay/module/scan errors, real anonymous SQLite transport and loaded-client graph checks. Rebuilt production browser/native/static checks pass (3 tests, 260 assertions). Reviewer types/lint and lead root TypeScript (12/12) and diff checks pass. The intermediate nested executable dispatcher had intermittent pre-Vite stalls; direct CLI scripts passed repeated engineer runs and the independent run. No unsupported claim about Bun's internal cause is made.

Evidence and exact boundaries are in evidence/session/dev-runtime-checks.md and reviews/dev-runtime-review.md. Source fix/test commit: bb1eb21, `Run Vite under Bun and verify shipped development startup`. Existing user servers were not stopped; a server started with the previous script must be restarted using `bun run dev` to select the corrected runtime. No push or deployment performed.
