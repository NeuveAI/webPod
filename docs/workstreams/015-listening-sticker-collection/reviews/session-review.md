# Device sessions and production routing review

## Verdict: APPROVE

2026-09-06. Final independent integrated session/backend/production-root review. **No unresolved Critical or Major findings.** Both early implementation findings below are fixed; the real-browser reload evidence gap was corrected and independently reverified. Review framing and canonical references: evidence/session/review-contract.md. No Neuve/Kanban under repository law. Approval covers current source and evidence, not a deployment or live Apple account verification.

## Correctness check

- Source of truth: AGENTS.md, session-dispatch.md, implementation-scope.md, implementation-decisions.md, backend-contract.md and final diary/session.md. Owner-selected device identity and genre starter/measured listening decisions preserved; no inferred Apple identity or hardware entropy.
- Backend: random first-party recovery and separate active credential hashes; TTL and generation revocation; tenant-derived writes; verification/import transaction; failure-preserving metadata; token-free catalogue enrichment; request/logout/runtime cancellation; bounded admission; additive migration/reopen and future-schema rejection. Initial active-cookie-only logout and private-path traversal/symlink defects independently tested after fixes.
- Stack: canonical generated Start file handlers and trusted in-process context; Bun handles static/HTTP transport; scoped Effect4 runtime owns Drizzle/Bun SQLite. Reviewed installed versions against user-supplied reference checkouts. No production test route, flag, or HTTP-controllable injection. Synthetic signer is supplied only through trusted context to the existing developer-token endpoint.
- Root extraction: full old/new component comparison proves physical hierarchy/styles/motion unchanged except relocation and DEV diagnostic guards. `/` now directly owns ssr:false DevicePage; old diagnostic route remains DEV-only. Structural proof is **4 tests/47 assertions**, separately from actual browser proof below.
- Static gates: independently ran app/server-core TypeScript and scoped lint. New scripts are included in app tsconfig; direct pinned Playwright dependency resolves typed browser harness/helper imports. Snapshot scripts now participate in provenance and private DB files are excluded; **6 tests/42 assertions** independently pass.
- Resource lifecycle: request abort regression independently passes along with explicit logout and disposal cancellation; module shutdown rejects fresh runtime creation, closes managed storage, and HMR disposes old ownership. No source-level credential leak or built client match for SQLite/server/key machinery.
- Documentation: architecture, backend contract and session diary explain identity limitations, configuration, limits, failure behavior and synthetic verification boundaries. Lead owns final commit/goal-accounting completion; no push or deployment inferred.

## Independently executed runtime evidence

- Latest built native transport + production static/SSR + Chrome real-browser suite: **3 passed, 260 Bun assertions**, 5.18s, plus two Playwright actual-artwork pixel readiness polls. Built server SHA256 `f4c5218a1abb57549e39816390d6fdb97b61ab2b11d601629b00b023e953aac4`.
- Browser uses actual production `/`, actual built Start API handlers, native automatic HttpOnly cookies, actual isolated SQLite, and normal product settings/sign-in/flip/pointer pull/peel/place/reload/signout/reconnect. Separate browser identity isolation passes. Only MusicKit SDK and trusted server Apple/signing dependencies are synthetic; **zero API interceptions**. Device/private credentials remain absent from document.cookie and evidence.
- Native integration separately verifies starter, open/place/reload, HEAD, 31 measured observations, duplicate grant protection, revocation and recovery. Static smoke independently verifies all **60 exact asset hashes** and SSR; SSR200 alone is not the product proof.
- Backend/client lifecycle suite independently passed **35 tests/164 assertions** before the added Request.signal regression; latest live session suite independently passed **11 tests/74 assertions**, including that regression. Detailed commands and chronological results are in evidence/session/independent-checks.md.

## Visual and interaction assessment

Inspected actual generated browser-01-real-starter.png, browser-02-real-placement.png and final browser-03-reloaded.png. Final reload capture visibly contains the real reflective rear device and same orange Sound Check sticker at the saved placement. Earlier empty capture was an asynchronous paint-readiness race; the corrected harness requires actual orange artwork pixels in the rear region and saves the exact passing frame. Blank Canvas, silver body and pack lip cannot satisfy it.

Observed facets (1–5, scoped to this integration): tactile4 (die-cut artwork aligned to physical rear), legible4 (recognizable art and short pack tease), cohesive4 (same lit device/material system), responsive4 (real pointer pull/peel/save plus successful reload), accessible4 (keyboard orientation and reduced-motion state equivalence with normal settings buttons). This is not a new full material calibration or a claim of owner subjective approval. The unchanged material/physics/mobile surfaces retain their earlier dedicated review and evidence; this pass proves their production route and server-owned collection integration.

## Resolved early findings (historical trigger evidence)

- **Major — Logout fails to revoke an active session when recovery cookie is absent** (`packages/server-core/src/stickers/live.ts:98`). Bootstrap a device, capture its active-session cookie, then send DELETE `/api/stickers/session` with only that active cookie. Logout returns 200, but GET `/api/stickers` replaying the captured active cookie still returns 200. Logout derives its revocation target exclusively from the device cookie, despite active credentials independently authorizing inventory. Missing recovery credentials can happen after cookie removal; signed-out active access must still be revoked. Resolve and revoke the active-session device when available, while retaining recovery-cookie generation revocation for pending bootstraps. Independently reproduced with in-memory SQLite and synthetic Apple responses; output `{"logout":200,"replayedActiveSession":200}`. No credential values emitted.

- **Major — Private database path guard accepts traversal into public assets** (`apps/web/src/server/sticker-runtime.server.ts:11-14`). Configured `/tmp/../Users/vinicius/code/webPod/apps/web/public/review-probe.sqlite` passes the raw string prefix checks although its resolved path is inside the public directory. Startup subsequently opens that actual location, violating the dispatch's private storage boundary and potentially exposing the database through static serving or asset copying. Canonicalize the path before containment checks and resolve existing ancestor symlinks as appropriate. Independently called only the pure configuration function; output `{"accepted":true,"resolvedInsidePublic":true}`. No database file created or existing database accessed.

## Disposition

Both historical Major findings above are resolved by revoking both supplied valid identity sources and canonicalizing paths through existing parent symlinks. Regression tests pass independently. Production root availability, script type coverage, request cancellation, real browser transport and visible reload gaps are closed. **APPROVE** for the integrated reviewed slice.
