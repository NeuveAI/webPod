# Listening stickers implementation handover

Development startup correction: the owner reported fatal Bun module resolution after the earlier completion claim. Prior production checks and approval missed the shipped launch path. Reviewed fix bb1eb21 now selects Bun directly in package scripts, excludes server-core from raw client optimization, and makes browser gates use the same script. Independent exact root/app startup checks and rebuilt production checks pass; dev-runtime-incident.md preserves the failure and verification boundaries. Historical delivered features/evidence below remain scoped to their tested paths. Restart an existing development process with `bun run dev` to use the corrected runtime.

## Delivered

Bun + Effect v4 + Drizzle + SQLite storage, migrations, bounded Apple metadata import/enrichment, observed-time ledger, deterministic starter and listening packs, ownership/revision validation and injected HTTP handlers. Token removed from public provider session; private credential callback retained. TanStack Start made explicit routing/server glue in AGENTS.md and docs/architecture/sticker-backend.md.

All sixty immutable PLAYWORN assets are manifest/hash-validated and copied for production URLs. Shared Jotai inventory, placement and interaction state drives the same deviceStore for UI and external callers. Stickers conform to rear geometry with alpha-clipped shared satin laminate. Existing lit Canvas renders the pack, cylindrical peel and camera-projected landing. UI supports bottom tease/pull, pointer inertia, keyboard placement/removal, cancellation, reduced motion, server-first persistence and errors/retry. Context loss shows a bounded accessible restoration notice, disables sticker controls and recovers without ongoing rendering at rest.

## Review and evidence

Independent backend APPROVE in reviews/backend-review.md after provenance, duplicate starter and enrichment corrections. Surface and UI scoped APPROVE in reviews/surface-review.md and reviews/final-implementation-review.md after cache/lifecycle and stale async intent fixes. Required skills/references recorded in lane diaries. Lead typecheck 12/12, scoped lint, targeted 50 tests and client/SSR build pass. Backend/provider 81 tests pass. Combined production-route browser suite 3/3 passes; reviewer independently verified interaction 2/2 and final material 1/1. Fingerprinted sources, screenshots, draw counters and exact checks are under evidence/.

The earlier physical checkpoint used deterministic Apple/provider and HTTP mocks on the product route under development hosting. Final evidence/session/ additionally proves the actual production build with native cookies, real Start APIs and isolated SQLite, with zero browser API interception. Only MusicKit and trusted server Apple/signing dependencies are synthetic; live Apple credentials were not used. Root lint has 55 baseline historical evidence-script errors; source lint passes.

## Live device sessions

Owner chose device identity for now. A cryptographically random first-party cookie identifies the browser collection; separate upstream-verified sessions authorize access. New browser/cleared site data starts another collection; multiple Apple accounts on one browser share this interim collection. No hardware fingerprint or token hashing identifies an Apple account.

`session-dispatch.md` defines this slice. Implementation adds additive SQLite schema v3, final transactional lease checks, pending-work cancellation, native secure cookies, six thin Start file routes and a Bun production entry. Exact configuration and limits are in `docs/architecture/sticker-backend.md`. Development uses ignored `.data/stickers.sqlite`; production requires an absolute private `WEBPOD_STICKER_DATABASE_PATH`, then `bun run --cwd apps/web build` and `bun run --cwd apps/web start` with existing server-only Apple configuration.

New tests traverse the actual built Start router via native Bun HTTP and synthetic upstream injection. They prove import/open/place/reload, observed unlock/deduplication, logout/replay rejection/recovery. Production smoke serves `/` and verifies all sixty asset hashes. Session repository/live tests cover isolation, expiry, failed auth/import, interrupted import/enrichment, restart, preparation/admission limits and runtime disposal. Final independent browser/native/static suite passes3tests260assertions, including actual pointer pull/peel/place and artwork-visible reload. Canonical `/` now mounts the shared device page; diagnostic routes remain DEV-only. Lead final TypeScript12/12 and service/runtime/provenance42tests211assertions pass. Final review APPROVE has no unresolved Critical/Major findings; no deployment or push performed.

## Policy and product limits

Owner selected genre-based starter plus measured listening. Provisional named thresholds 5/15/60/180/600 minutes are tunable; starter has up to 3 strongest-genre first stickers, no invented history minutes. Client telemetry is bounded observation, not tamper-proof listening attestation. Placements are back-only, one instance per owned art, maximum 12 within shared safe bounds. Full cross-device auth and a redesigned T4 renderer are not delivered in this checkpoint. Wrapper is deliberately simple; owner subjective craft feedback remains welcome without being represented as prior approval.

## Commits

Prior-work cleanup: 4a05c37, 6aaef16, 14b4d0b, 8507a63. Neutral backend/domain/provider/architecture: ea38128. Surface/UI refs appended after exact staging. No push performed, no trailers. Generated local tooling/test scratch retained on disk and ignored.

Final reviewed surface commit: af2bb77. Final reviewed UI/runtime commit: 218ae06. Final verified device session backend:4abb81f. Final production root/Start/browser integration:b62df0a. This handover and final evidence are committed together after independent approval. Local generated assets/scratch remain ignored; no user work was discarded.

## Archive and existing-device regression checkpoint

Follow-up commit intent: include the sticker build pipeline and canonical artwork in committed browser source archives and fingerprint provenance. This narrowly fixes clean-archive Vite startup inputs; generated public artwork remains excluded from source identity. Independent reviewer approved the fix after5 archive tests/37assertions, lint, and13/13 existing orientation/parity/lighting browser regressions (1.4minutes,342-file fingerprint b02745a4073b8135718bc3c3c2665482e90af1f69c81020ddcf5b23df6e757f0). Lead scripts TypeScript check also passed. Bounded final/setup logs and summaries live in evidence/regression/verification.md; final-implementation-review.md records the scoped approval. Historical extraction is supported, but historical browser replay uses matching archived config/helper rather than mixing fingerprint algorithms. No feature implementation changed in this follow-up.

The archive checkpoint predates live session integration. Its regressions support the physical feature, while the new session slice has separate evidence and independent review.

## Radio, import and cancellation correction

Owner-reported radio400 is repaired with the supported featured live-radio query (158a21a). Import contracts now accept opaque cursors and catalogue relationships, intentional sampling has accurate UI, and failed retries preserve inventory without a misleading cooldown success. A pinned, regression-tested Start patch handles exact incoming-request cancellation before H3 logs it as an unhandled500 (5ca669a). Real shipped dev POST/disconnect/recovery and rebuilt production tests independently pass; see sync-radio-repair.md and reviews/sync-radio-review.md. The owner's exact prior live-library sync cause remains unconfirmed. Safe `sticker_import` diagnostic reasons/counts are available for a subsequent failure. Restart the existing development server to load the framework patch.

## Confirmed sampling deadline and missing-route correction

Subsequent owner diagnostics identified a 30-second own-budget timeout after 24 pages, followed by a successful 25-page capped sample on reload. Commit bc59853 treats this narrow budget stop as partial sampling when fully validated usable pages exist, so a first-session starter can be produced without discarding the prefix or requiring reload. All external cancellation and real upstream/validation failures remain failures. Commit 41a40f0 supplies canonical root404 recovery and a return-to-player link, retaining actual404 status and eliminating the missing-component configuration warning. Both corrections are independently approved with deterministic pre-fix/fixed regressions plus real dev and production checks; see import-budget-repair.md and reviews/import-budget-review.md. The user's exact missing URL was not present in the warning and is not inferred.
