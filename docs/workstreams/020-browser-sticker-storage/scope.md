# Browser sticker storage

Status: Ready. User explicitly approved SQLite WASM worker + OPFS local ownership after discussing absence of automatic cross-browser recovery. No additional provider or account setup.

## Correctness and decisions
- One browser-local collection, not linked to Apple identity; reconnect/logout never deletes durable collection. Preserve starter grant, genre thresholds, deduplication, revision conflict, pack opening and wear rules.
- SQLite operations and complete transactions execute in worker, off main UI thread. Durable OPFS only; no silent transient fallback. Use opfs-sahpool if supported to avoid COOP/COEP breaking MusicKit; serialize multi-tab database access with Web Locks and release SQLite handles between command batches (or equivalent proven ownership protocol).
- Keep Jotai authoritative rendered snapshot shared with WebMCP callbacks; asynchronous command boundary, bounded pending work, cleanup/error handling, no credential sent to worker.
- Apple developer signing stays exclusively server-side. Existing bounded Apple import/enrichment code may remain behind stateless same-origin Start endpoints. Browser requests cannot supply owner or SQL to server. No cookie-dependent sticker API calls on production flow.
- Export/import validated versioned collection backup with user-accessible controls; restoration must preserve progress/packs/placements/wear and reject invalid backup without damage. No automatic server-database migration or existing local-data access. Existing local SQLite remains untouched.
- No cloud sync/accounts, offline Apple playback claims, deployment or new paid services. Source changes + build/browser verification constitute completion. Preserve pre-existing CSS fix.

## Sources and types
Primary: current user conversation and AGENTS.md. Supporting: /Users/vinicius/code/agentic-context/sqlite-wasm README and src types; installed Drizzle 0.45.2 types; existing packages/stickers shared inventory/placement validators. Prior server-storage deployment recommendations are superseded. Configured resources path is missing; use user-provided sqlite-wasm and installed dependencies. Do not read cert/ or design.pen.

## Dispatch and ownership
A storage engineer: packages/sticker-engine (new), browser-safe extraction from packages/server-core/src/stickers/{repository,policy,schema,database}.ts if needed, packages manifests/bun.lock for dependency installation, apps/web/src/sticker-worker* and apps/web/src/sticker-local* transport. Own engine tests and OPFS browser tests. Notify integration engineer immediately of concrete typed command interface. Preserve legacy server test support through reexports or compatible adapter; avoid two divergent rule implementations.
B integration engineer: apps/web/src/sticker-runtime.ts and callers/tests, stateless Apple server endpoints/handlers (not shared repository files), backup UI in existing collection surface, deployment docs. Coordinate protocol with A; no package manifests or lock edits. Export/import UI uses same worker transport. Own runtime integration tests.
Dependency: A and B agree protocol before app integration; final browser/build checks follow both; separate reviewer follows implementation. Lead coordinates only.

## Verification / DoD
A: existing sticker rules tests plus native/WASM parity where meaningful; persistent worker write then close/reopen; two-tab serialization; invalid backup rollback; unsupported OPFS explicit failure. B: new browser imports stickers without device/session endpoints; reconnect retains local collection; stale imports/writes after logout cannot publish or mutate; export/import buttons usable, bounded parsing. Verify actual /webpod route in browser using synthetic Apple responses without production credentials; capture screenshot if UI changes. No proof-only routes.
Gates: bun run typecheck, scoped bunx --bun eslint, bun run build, relevant bun tests and browser tests. Run production static asset smoke test. Independent review of data safety, worker lifecycle, import validation, server signing boundaries, runtime integration and UI. No invented QA claims.

## Artifacts and commit plan
Engineer A: engine-diary.md; B: integration-diary.md. Decisions appended in own diaries. Lead evidence/status: verification.md. Reviewer: review.md. All under this directory. Commit suggestions: extract reusable sticker rules; persist browser sticker engine with SQLite worker; connect app and backups to local collection; verify production assets and document local persistence. Do not commit unless requested.

## Follow-up: existing session retry and backup placement
User requested removal of persistent export/import banner while retaining feature; screenshots show backup plaque obscuring sync message. Move controls to collapsed Settings disclosure. Existing local session inspected via CUA: collection readable, rear pack metal1/5 and3packs; no local data reset needed. Fix separately reproduced no-op retry when saved import failed and Apple disconnected: explicit sign-in gesture, no storage authorization requirement and no background auth. Preserve inventory. Verify targeted runtime/status tests and Settings backup browser flow; independent focused review. No need repeat unrelated long geometry suites.
