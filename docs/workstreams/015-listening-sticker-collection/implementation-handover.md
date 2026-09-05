# Listening stickers implementation checkpoint

2026-09-06. Implemented and independently reviewed checkpoint; full feature remains incomplete pending identity decision and production session/routes.

## Delivered

Bun + Effect v4 + Drizzle + SQLite storage, migrations, bounded Apple metadata import/enrichment, observed-time ledger, deterministic starter and listening packs, ownership/revision validation and injected HTTP handlers. Token removed from public provider session; private credential callback retained. TanStack Start made explicit routing/server glue in AGENTS.md and docs/architecture/sticker-backend.md.

All sixty immutable PLAYWORN assets are manifest/hash-validated and copied for production URLs. Shared Jotai inventory, placement and interaction state drives the same deviceStore for UI and external callers. Stickers conform to rear geometry with alpha-clipped shared satin laminate. Existing lit Canvas renders the pack, cylindrical peel and camera-projected landing. UI supports bottom tease/pull, pointer inertia, keyboard placement/removal, cancellation, reduced motion, server-first persistence and errors/retry. Context loss shows a bounded accessible restoration notice, disables sticker controls and recovers without ongoing rendering at rest.

## Review and evidence

Independent backend APPROVE in reviews/backend-review.md after provenance, duplicate starter and enrichment corrections. Surface and UI scoped APPROVE in reviews/surface-review.md and reviews/final-implementation-review.md after cache/lifecycle and stale async intent fixes. Required skills/references recorded in lane diaries. Lead typecheck 12/12, scoped lint, targeted 50 tests and client/SSR build pass. Backend/provider 81 tests pass. Combined production-route browser suite 3/3 passes; reviewer independently verified interaction 2/2 and final material 1/1. Fingerprinted sources, screenshots, draw counters and exact checks are under evidence/.

Evidence uses deterministic Apple/provider and HTTP mocks on actual production /. It does NOT prove live session authorization or production ingestion wiring. Root lint has 55 baseline historical evidence-script errors; source lint passes.

## Remaining dependency and next implementation

Owner was asked whether first release collections are browser-bound or follow a separate account login across devices; no answer received in this checkpoint. MusicKit authorization does not supply a stable Apple account identity. Do not hash its token as an account ID or merge accounts from library similarity.

After answer:
1. Implement concrete authenticated session service behind neutral HTTP handlers, with verified Apple credential handoff, server-only opaque session storage, expiry/revocation, same-origin protections and correct sign-out/account-switch ownership. Browser-bound recovery versus separate cross-device login determines this implementation.
2. Add thin TanStack Start production routes for session/bootstrap, inventory, listening observations, opening packs and placement writes. Wire scoped Effect runtime with explicit SQLite production path/lifetime. Never touch signing key contents or persist/log raw music tokens.
3. Verify real route boundary with deterministic upstream mocks: failed/expired/forged sessions, cross-owner access, sign-out during import/enrichment, abort/retry, HTTP body/origin guards, persistence across restart and client/server bundle separation. Then review this new boundary independently and run integrated feature checks.
4. Only after this work can goal be marked complete. Current production UI has no live sticker service behind requested endpoints and must not be presented as shipped functionality.

## Policy and product limits

Owner selected genre-based starter plus measured listening. Provisional named thresholds 5/15/60/180/600 minutes are tunable; starter has up to 3 strongest-genre first stickers, no invented history minutes. Client telemetry is bounded observation, not tamper-proof listening attestation. Placements are back-only, one instance per owned art, maximum 12 within shared safe bounds. Full cross-device auth and a redesigned T4 renderer are not delivered in this checkpoint. Wrapper is deliberately simple; owner subjective craft feedback remains welcome without being represented as prior approval.

## Commits

Prior-work cleanup: 4a05c37, 6aaef16, 14b4d0b, 8507a63. Neutral backend/domain/provider/architecture: ea38128. Surface/UI refs appended after exact staging. No push performed, no trailers. Generated local tooling/test scratch retained on disk and ignored.

Final reviewed surface commit: af2bb77. Final reviewed UI/runtime commit: 218ae06. All implemented source changes are committed; lead scope, decisions, evidence and this handover are committed separately. The owning goal remains active and incomplete pending identity and live-route implementation.
