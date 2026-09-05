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

- `database.ts` explicitly opens a supplied database path, enables foreign keys/WAL/busy timeout, and applies reviewed additive schema initialization/migrations. Schema v2 separates library membership from catalogue resolution and records consumed starter evaluation. A newer unsupported schema version fails closed. Importing modules never opens a database.
- `repository.ts` scopes reads and writes to an internal opaque owner. Its caller must authenticate that owner; the repository alone is not an authentication system. Stable Apple catalogue IDs identify imported songs, not browser-local entity handles or Music User Tokens.
- `apple-import.ts` verifies Apple Music authorization, imports a bounded library snapshot and enriches active catalogue tracks. Requests use a fixed Apple HTTPS origin, reject redirects, constrain pagination, cap bytes/pages/time and return safe errors. Music User Tokens remain request-local. Later-page failures reject the snapshot and preserve the previously persisted taste; `partial` specifically means the page/row ceiling.
- `policy.ts` classifies supported genres and defines provisional v1 thresholds. Library membership provides taste evidence and never listening duration. Listening credit comes from bounded sequential playhead observations, capped by server elapsed time across tabs. It is client-observed telemetry, not Apple historical attestation.
- `service.ts` composes the scoped Effect storage layer. `http.ts` provides a bounded same-origin transport handler with injected authentication/bootstrap/logout/enrichment services. Injection is an explicit unfinished production boundary.

A starter pack contains up to three unowned first-tier stickers from the strongest supported genres. Supported taste consumes the one starter evaluation, including when all eligible first art is already owned; that case emits no empty pack or higher-tier replacement. Unknown taste remains pending. Subsequent per-genre first-to-fifth thresholds are 5, 15, 60, 180 and 600 observed minutes; starter-owned first art skips its listening grant. These are named provisional policy defaults, not durations inferred from artwork captions. Grants and openings are idempotent; placements require ownership, finite physical bounds and the current revision.

## Current run/configuration boundary

The neutral backend has no production sticker routes, active session resolver, environment-selected database path, startup singleton or deployment entry point yet. `createStickerRuntime(path)` and `openStickerDatabase(path)` accept an explicit caller-supplied path; tests use in-memory databases or newly created temporary files. Starting the existing app does not activate a persistent sticker service.

Use the existing app commands `bun run dev` and `bun run build`. Exercise the reviewed backend with:

```sh
bun test packages/server-core/src/stickers/stickers.test.ts packages/providers/src/apple/apple-provider.test.ts
bunx --bun tsc --noEmit -p packages/server-core/tsconfig.json
bunx --bun eslint packages/stickers/src packages/server-core/src/stickers packages/providers/src/apple/apple-provider.ts packages/providers/src/apple/apple-provider.test.ts
```

Production integration must supply an authenticated owner/session model, database location outside public assets, managed runtime shutdown, request cancellation/revocation handling and bounded upstream request concurrency before wiring the proposed `/api/stickers` routes. The owner is deciding whether collections are browser-bound or use a real portable account. MusicKit authorization is not Sign in with Apple identity; token hashing or library similarity must not invent account identity. The provider's private `withMusicAuthorization(consume)` callback permits a direct server exchange while public Session.userIdentifier remains null.

Do not add a default credential path or expose signing material to the client. Existing developer-token minting stays in server-core and receives its signing-key location from runtime configuration. Neither this checkpoint nor its tests opens an existing user database or reads credentials. Production authentication, real Start request boundaries and client-bundle isolation need independent review when implemented.

Review and handoff evidence live in [workstream 015 backend handover](../workstreams/015-listening-sticker-collection/backend-handover.md).
