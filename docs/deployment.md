# Deploying webPod to Vercel

**Status: the public page can run without configured integrations. Apple Music
and sticker collection readiness still require runtime key provisioning and
durable storage.** Sticker routes refuse local SQLite when `VERCEL=1`; setting
a `/tmp` database path is not a workaround. Unavailable storage returns 503 from
the API without crashing the HTTP server or public SSR.

The initial container deployment returned HTTP 500 because the launcher eagerly
validated storage. The launcher now leaves storage validation at the API boundary.
See [deployment evidence](workstreams/019-vercel-deployment/deployment.md).

The [research and migration contract](workstreams/019-vercel-deployment/research.md)
compares native Bun, Nitro, and OCI deployment using current primary sources.

## Prepared image

`Dockerfile.vercel` builds the workspace using Bun 1.4.0 and its frozen lockfile,
including the patched Start dependency and manifest-verified sticker assets.
The runtime contains production dependencies, built client/server output and
the existing Bun launcher. It runs as the `bun` user and binds to `0.0.0.0`.
TanStack Start continues to own all dynamic routes.

Build from the **repository root**, not `apps/web`:

```sh
docker build -f Dockerfile.vercel -t webpod:vercel-prep .
```

For a local packaging smoke test only, use disposable SQLite with no credentials:

```sh
docker run --rm -p 127.0.0.1:3000:3000 \
  -e WEBPOD_STICKER_DATABASE_PATH=/tmp/webpod/stickers.sqlite \
  webpod:vercel-prep
```

The page and assets should load; authenticated Apple Music requires separate
configuration. This disposable local database is deliberately not a Vercel
deployment configuration. Check unauthenticated `/api/stickers` returns 401
with `Cache-Control: no-store`.

`.dockerignore` allows only build inputs and then excludes secrets/local state.
`.vercelignore` separately protects source uploads. Neither the local signing
key, environment files, private SQLite data nor encrypted design source belongs
in an image. Do not add key contents to Docker `ARG`, `ENV`, or build commands.

## Required before Vercel deployment

1. Implement and verify remote sticker/session storage using the migration
   contract. Choose a provider and provision separate preview/production data.
2. Run the [owner-only Apple provisioning command](workstreams/019-vercel-deployment/apple-provisioning.md).
   The runtime adapter is implemented: it materializes a sensitive environment
   value into an isolated private temporary directory at startup and sets the
   effective `APPLE_MUSICKIT_KEY_PATH`. Never paste secrets in chat.
3. Review shared rate limits and verify request origin/secure cookies under
   Vercel's proxy. Preserve the repo's server-only signing boundary.

Vercel supports [sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
for Preview and Production. They are an input mechanism, not automatic key-file
mounts. The existing signer requires:

| Variable | Purpose |
| --- | --- |
| `APPLE_TEAM_ID` | Apple team identifier |
| `APPLE_MUSICKIT_KEY_ID` | Explicit Apple Music signing key identifier |
| `APPLE_MUSICKIT_KEY_PATH` | Absolute path under the runtime temporary root; startup isolates the file in a private subdirectory |
| `APPLE_MUSICKIT_PRIVATE_KEY` | Sensitive runtime PEM; provision through the owner-run script |
| `APPLE_TOKEN_TTL_SECONDS` | Optional; defaults to 3600, accepted range 60–3600 |
| `PORT` | Set to `3000` in Vercel project settings to match this image |
| Provider-specific database variables | Determined by the storage migration; no remote variables exist yet |

Do not use `VITE_` prefixes for server secrets. No live Apple credentials are
needed to build the app.

## Deployment after blockers are resolved

Import the repository with project Root Directory `.`. The root `vercel.json`
explicitly selects a container service and routes requests to it. Automatic
Dockerfile detection did not select containers in the first actual deployment.
Leave framework/build/output overrides unset; the Dockerfile owns them.
Set `PORT=3000` explicitly because Vercel's
container routing otherwise defaults to 80. `EXPOSE` alone does not configure
the platform. Native `bunVersion` is unnecessary for an image with a pinned Bun.
[Vercel container contract](https://vercel.com/docs/functions/container-images).

For CLI deployment, use `bunx --bun vercel` from the root to create a preview
only after provisioning and migration are complete. No CLI deployment has been
run by the initial preparation. A subsequent user-authorized deployment created
`perf-lab/webpod`; see the workstream's deployment evidence for its result.

Before promoting a preview:

- Verify SSR at `/`, `/webpod`, asset responses and all 60 sticker PNGs.
- Verify MusicKit authorization and origin-bound token flow on the actual HTTPS
  domain without logging tokens; confirm the intended Apple account/domain setup.
- Import a library, open a pack, place a sticker, reload, revoke/reconnect, then
  repeat after redeployment and concurrent requests to prove persistence.
- Check cold starts, upstream timeouts, no-store API responses, secure cookies,
  and shutdown. No key or database file may be reachable through static paths.

Keep the prior deployment available for rollback. Database migrations must
remain compatible with it; rolling back a deployment does not roll back data.
