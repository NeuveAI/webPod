# Vercel research — 2026-09-09

## Deployment decision

Prepare the existing Bun HTTP server as a container. This preserves the pinned
runtime and Start build without introducing an adapter. This is a packaging
decision, not a claim that the current SQLite application is production-ready.

| Option | Current support | Fit for webPod |
| --- | --- | --- |
| Native Bun | `bunVersion: "1.4.x"`; Bun framework preset detects `server.ts` or `src/server.ts` with a text lockfile and a startup `Bun.serve()` call | Viable after storage migration, but current root lacks this entrypoint and built asset tracing must be verified |
| Start + Nitro | Official integration uses `nitro/vite` after Start | Would introduce a new deployment adapter; current Vite 8/patched Start combination needs compatibility testing |
| OCI image | Root `Dockerfile.vercel` auto-detected | Selected: keeps existing transport and exact Bun 1.4.0 |

[Vercel Bun runtime](https://vercel.com/docs/functions/runtimes/bun) is the source
for native support. `1.x` currently selects 1.3.14, while `1.4.x` selects the new
1.4 line. Installing with Bun alone does not configure the function runtime.
Search snippets returned old restrictions; the directly opened page supersedes
them. Native runtime support is beta.

[Vercel's Start guide](https://vercel.com/docs/frameworks/full-stack/tanstack-start)
documents the Nitro integration. It does not prove compatibility of any arbitrary
Nitro version with our installed dependencies; no speculative upgrade was made.

[Container Images](https://vercel.com/docs/functions/container-images) specifies
the root Dockerfile convention, HTTP port 80 by default (overridable with the
project's `PORT` variable), SIGTERM grace period of 30 seconds, and the lack of
Secure Compute/static outbound IP support for custom images. The image uses
port 3000 and therefore requires `PORT=3000` in project settings.

The [June 30, 2026 announcement](https://vercel.com/changelog/bring-your-dockerfile-to-vercel-functions)
confirms that OCI images are a production function deployment feature, distinct
from running Docker inside a Vercel Sandbox.

## Production blockers found in source

1. `database.ts` uses `bun:sqlite`, WAL, and a local path. Collections, device
   identities, sessions, grant deduplication and placement revisions live there.
   [Vercel's Docker deployment guide](https://vercel.com/kb/guide/does-vercel-support-docker-deployments)
   explicitly describes containers as stateless and requires a backing service
   for persistent state. `/tmp` or a Docker `VOLUME` cannot solve this on Vercel.
2. `repository.ts` and `sessions.ts` make synchronous queries inside immediate
   transactions, including authorization and mutation in one transaction. A
   remote connection requires async repository/service contracts, not just a
   connection-string replacement. Preserve transaction-scoped handles and
   race protection; never split authorization and mutation across transactions.
3. `apple-developer-token.ts` expects an absolute runtime key-file path. The
   ignored local key is deliberately absent from uploads and images. Vercel
   environment variables do not automatically create this file. A server-only
   provisioning adapter remains necessary; no undocumented secret mount is assumed.
4. `live.ts` keeps import concurrency and preparation limits in process memory.
   After scaling they are per instance. Decide which limits require a shared
   database-backed policy or platform WAF rule before promotion.

## Storage recommendation and migration contract

Recommend **Turso/libSQL for the smallest SQL/schema migration**, subject to owner
provider preference. Drizzle supports its SQLite dialect and asynchronous driver.
Use the remote primary as the authoritative store, not an embedded replica on
ephemeral disk. [Drizzle's Turso integration](https://orm.drizzle.team/docs/sqlite/connect-turso).

Neon Postgres is also suitable, but requires a dialect/schema migration as well
as async access. Interactive transactions need a compatible driver (for example
Neon WebSockets or a Postgres connection), rather than the single-query HTTP
path. [Drizzle's Neon integration](https://orm.drizzle.team/docs/connect-neon).

The current Drizzle docs show newer RC installation examples; this repo pins
0.45.2. Before implementation, inspect its installed `libsql`, `neon-serverless`,
and transaction types and pin the chosen client. Do not blindly copy RC installs.

Migration acceptance criteria:

- Migrate schema versions 1–4 and preserve collections, packs, placements and
  appearances. Decide whether existing local data must be imported.
- Preserve atomic grants, event deduplication, revision compare-and-swap, session
  generation/revocation and rollback. Test concurrent requests across two runtimes.
- Prove data survives cold starts and redeployments; isolate preview databases
  from production. Include connection disposal and request cancellation.
- Preserve existing HTTP contracts, secure cookies, origin validation and
  synthetic-upstream integration tests. Recheck public-origin handling behind
  Vercel's HTTPS proxy using an actual preview.
- Only replace the Vercel SQLite rejection after the remote implementation passes.

## Handover

Update: the owner subsequently authorized an actual deployment. See
[deployment.md](deployment.md) for the created project, successful container
build, and observed HTTP 500 from the storage guard. The notes below describe
the initial preparation state.

No database or Vercel project was provisioned and no credentials were accessed.
Owner database preference is pending. Packaging can be reviewed independently;
production remains blocked on storage and key provisioning. See
[deployment.md](../../deployment.md) for the
operator checklist and `verification.md` for measured results.
