# Routing and sticker backend architecture

TanStack Start is webPod's canonical routing and server glue layer. This formalizes the existing `tanstackStart` Vite plugin, `apps/web/src/router.tsx`, generated route tree and `createFileRoute(...).server.handlers` endpoints. The developer-token and artwork endpoints already use this boundary. New server functionality belongs behind thin Start handlers; it does not introduce another HTTP framework or a second Bun listener.

## Responsibilities

| Layer | Responsibility |
| --- | --- |
| TanStack Start in `apps/web` | File routing, SSR and HTTP request/response integration. Validate transport and resolve authenticated ownership before invoking domain work. |
| Bun | JavaScript server/tool runtime and native `bun:sqlite` driver. All package, test and build commands use Bun. |
| Effect in `packages/server-core` | Typed failures, service dependencies and lifecycle. `StickerStorage` is a `Context.Service`; one managed runtime owns one scoped SQLite handle and closes it on disposal. |
| Drizzle ORM | Typed SQLite schema and queries. Transactions use the native synchronous Bun driver; no awaited network request runs inside a transaction. |
| SQLite | Durable collection owners, metadata/provenance, listening observations, genre credits, pack grants, opening timestamps and placement revisions. Unique constraints and immediate transactions serialize earning/grant updates. |
| `@webpod/stickers` | Client-safe catalogue identities, metadata, inventory/observation contracts and shared placement validation. Contains no server or credential imports. |

The current pinned Effect is `4.0.0-rc.112`; the supplied reference checkout is Effect 3.19.14. Installed v4 sources are authoritative for `Context.Service`, `Layer.effect`, `ManagedRuntime` and resource cleanup. Drizzle uses `0.45.2` and `drizzle-orm/bun-sqlite`. Research references are `/Users/vinicius/code/.better-coding-agents/resources/{effect,bun,drizzle-orm,tanstack}`; never copy obsolete v3 APIs solely because they appear in a skill example.

## Reviewed neutral backend

`packages/server-core/src/stickers` implements a backend independent of the final identity provider:

- `database.ts` explicitly opens a supplied database path, enables foreign keys/WAL/busy timeout, and applies reviewed additive schema initialization/migrations. Schema v3 adds hashed device/session credentials, expiry and revocation generation; v2 separates library membership from catalogue resolution and records consumed starter evaluation. A newer unsupported schema version fails closed. Importing modules never opens a database.
- `repository.ts` scopes reads and writes to an internal opaque owner. Its caller must authenticate that owner; the repository alone is not an authentication system. Stable Apple catalogue IDs identify imported songs, not browser-local entity handles or Music User Tokens.
- `apple-import.ts` verifies Apple Music authorization, imports a bounded library snapshot and enriches active catalogue tracks. Requests use a fixed Apple HTTPS origin, reject redirects, constrain pagination, cap bytes/pages/time and return safe errors. Music User Tokens remain request-local. Authorization, malformed data and upstream failures reject the snapshot and preserve the previous taste. `partial` means a page/row ceiling or the importer's own sampling deadline after fully validated usable pages; external cancellation never becomes a successful sample.
- `policy.ts` classifies supported genres and defines provisional v1 thresholds. Library membership provides taste evidence and never listening duration. Listening credit comes from bounded sequential playhead observations, capped by server elapsed time across tabs. It is client-observed telemetry, not Apple historical attestation.
- `service.ts` composes the scoped Effect storage layer. `http.ts` provides a bounded same-origin transport handler with injected authentication/bootstrap/logout/enrichment services. Production `live.ts` implements this boundary with mandatory per-write session checks.

A starter pack contains up to three unowned first-tier stickers from the strongest supported genres. Supported taste consumes the one starter evaluation, including when all eligible first art is already owned; that case emits no empty pack or higher-tier replacement. Unknown taste remains pending. Subsequent per-genre first-to-fifth thresholds are 5, 15, 60, 180 and 600 observed minutes; starter-owned first art skips its listening grant. These are named provisional policy defaults, not durations inferred from artwork captions. Grants and openings are idempotent; placements require ownership, finite physical bounds and the current revision.

Library import explicitly requests the catalogue relationship and accepts bounded opaque pagination offsets. Uploaded/library-only tracks without a verified catalogue ID remain ineligible. The 25-page/2,500-row and 30-second limits bound a starter-taste sample, not a resumable full-library sync; the UI distinguishes sampling from failure and does not offer an ineffective sample retry. Own-budget expiry can retain fully validated usable pages as `partial` with diagnostic reason `sample_time_limit`; it remains a failure without a usable sample. A failed import preserves inventory and emits only a finite reason and bounded page/row counts through the `sticker_import` server diagnostic, never identifiers, tokens, cursors or upstream bodies. Active failed imports cannot replay unchanged inventory as a successful retry during the admission cooldown.

## Device identity and active access

The owner selected device identity for the first release. It is a random 256-bit first-party browser credential, not a hardware/UA hash and not an Apple account identifier. SQLite stores only its SHA-256 hash mapped to an opaque collection owner. Clearing site data or using another browser starts a new collection. Different Apple accounts in one browser share the interim device collection. A future stable account can link this owner without changing grants or placements.

`POST /api/stickers/device` establishes the restricted recovery cookie before MusicKit credentials are exchanged. Recovery alone cannot access inventory. `POST /api/stickers/session` verifies `/v1/me/storefront`, imports bounded library metadata, and activates a separate random session cookie. HttpOnly, SameSite=Lax, Path=/ cookies use Secure on HTTPS. Device TTL is 365 days; active access is 24 hours. SQLite retains only hashes; Music User Tokens exist only inside the upstream request workflow and never enter public Session/Jotai, persisted rows or logs. Catalogue enrichment uses developer authorization plus the verified stored storefront, without a Music User Token.

Logout revokes the generation and all sessions for both supplied recovery and active credentials, aborting admitted work while retaining device identity. Transactions recheck generation/expiry immediately before imports, enrichments, observations, pack opens and placement writes. A delayed HTTP response can carry only a revoked credential after logout. The client waits for pending revocation before preparing a new connection and captures the original generation/abort signal through credential callbacks.

Limits: four upstream workflows globally, one per device, five seconds between fresh bootstraps, and thirty preparation requests per minute per process. A rapid reload with valid matching active access reuses its inventory during that five-second cooldown, without creating access or re-importing. Signed-out recovery always requires upstream verification. There is no unbounded request queue. Upstream requests combine caller, runtime and explicit logout cancellation with 10-second verification/enrichment and 30-second import deadlines. Import failure preserves prior inventory and returns `importStatus: failed`; an authorization failure never activates a new session.

## Run and verification

Development: `bun run --cwd apps/web dev` runs Vite/Start. The lazy runtime uses ignored `.data/stickers.sqlite` relative to the server working directory unless `WEBPOD_STICKER_DATABASE_PATH` supplies an absolute path. Production requires that variable; it is canonicalized through existing parent symlinks and rejected inside public/build assets. Use a private persistent directory with restricted host permissions. Existing environment-only Apple signer configuration remains unchanged, with no default private key path.

Build with `bun run --cwd apps/web build`, then set `WEBPOD_STICKER_DATABASE_PATH` to a private absolute SQLite path and run `bun run --cwd apps/web start`. Optional `HOST` defaults to `127.0.0.1`, `PORT` to 3000. Bun serves built static bytes and delegates every dynamic request to the built Start handler. SSR/public pages do not require a credential-dependent runtime startup. SIGINT/SIGTERM dispose the Effect runtime and stop transport; Vite module replacement disposes its former runtime. SQLite and signing imports are excluded from client output; only the SSR build externalizes Bun builtins.

Real transport tests use trusted in-process Start request context to inject an explicit service factory with synthetic Apple responses. No HTTP flag, environment test switch or test route exists in production. Run after building:

```sh
bun test packages/server-core/src packages/providers/src apps/web/src/sticker-runtime.test.ts apps/web/src/server/sticker-runtime.test.ts
bun test apps/web/scripts/sticker-start.integration.test.ts apps/web/scripts/sticker-production.test.ts
```

Session implementation/review evidence lives in workstream 015 `diary/session.md`, `evidence/session/`, and `reviews/session-review.md`. The physical UI and materials retain their earlier independent review; live session changes require their own review sign-off.

## Development request cancellation

The pinned Bun patch for `@tanstack/start-server-core@1.169.31` prevents expected incoming-request cancellation from being logged by H3 as an unhandled 500. It produces an empty 499 only when the incoming request is aborted and the rejected value is exactly that signal's reason. Signals and unrelated errors remain unchanged. The patch is declared in package.json/bun.lock and included in source snapshots/fingerprints. On framework upgrades, reassess it against the exact-reason and real development POST cancellation regressions before removing or changing it; do not silently carry the patch to a different version. Evidence is in workstream 015 `reviews/sync-radio-review.md`.
