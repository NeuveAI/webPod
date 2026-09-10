# Deploying webPod to Vercel

webPod stores stickers in the browser using SQLite WASM in a dedicated worker and
OPFS. Production does not need a sticker database provider, device cookies, or
collection sessions. Apple Music signing and bounded library/catalog metadata
requests remain server-side TanStack Start handlers.

## Persistence and ownership

A collection belongs to this browser and origin. Normal reloads, Apple logout,
reconnection and server redeployment preserve it. Another browser, device, preview
domain or cleared site data starts with a separate collection. Apple authorization
does not synchronize stickers. Use **Export stickers** and **Import stickers** under
**Settings → Sticker backups** to transfer a versioned backup. Import requires
confirmation and replaces the local collection only after validation.

Browser storage can be cleared or evicted. Export valuable collections regularly.
Unavailable OPFS/Web Locks is an explicit storage error; webPod does not silently
substitute an unsaved in-memory collection. SQLite uses the SAH pool VFS so the app
does not require COOP/COEP headers that could interfere with MusicKit authorization.
Workers serialize access across tabs with Web Locks.

Legacy server SQLite implementation and its tests remain available for reference.
The production browser does not request `/api/stickers` or its cookie endpoints.
Existing server databases are untouched; this release does not migrate their data.
`WEBPOD_STICKER_DATABASE_PATH` is unnecessary for the production browser flow.

## Container and server configuration

Build from the repository root with Bun and the frozen lockfile:

```sh
docker build -f Dockerfile.vercel -t webpod:vercel-prep .
docker run --rm -p 127.0.0.1:3000:3000 webpod:vercel-prep
```

The root `vercel.json` selects the container service. Use Root Directory `.`;
leave framework/build/output overrides unset and set `PORT=3000`. The Dockerfile
owns the build and TanStack Start owns dynamic routes.

Provision Apple credentials using the [owner provisioning instructions](workstreams/019-vercel-deployment/apple-provisioning.md).
The runtime adapter materializes the sensitive key in a private temporary directory.
Do not put keys in build arguments, client environment variables, logs or source.

| Variable | Purpose |
| --- | --- |
| `APPLE_TEAM_ID` | Apple team identifier |
| `APPLE_MUSICKIT_KEY_ID` | Apple Music signing key identifier |
| `APPLE_MUSICKIT_KEY_PATH` | Explicit absolute runtime signing-key path |
| `APPLE_MUSICKIT_PRIVATE_KEY` | Sensitive runtime PEM provisioned by the owner |
| `APPLE_TOKEN_TTL_SECONDS` | Optional; defaults to 3600, range 60–3600 |
| `PORT` | Set to `3000` for this image |

No live Apple credentials are needed to build. `.dockerignore` and `.vercelignore`
exclude secrets and private local state. The stateless `/api/apple/stickers` POST
validates same-origin requests, bounds input/upstream response sizes and concurrent
requests, and returns no-store metadata. It receives a user token only for library
import; tokens are never forwarded to the storage worker or stored in backups.

## Verification before promotion

- Verify `/`, `/webpod`, emitted CSS/worker/WASM assets and all sticker artwork.
- Test MusicKit authorization on the actual HTTPS origin without logging tokens.
- In a new browser, import library, open/place stickers, reload, logout/reconnect.
- Export/import a backup and confirm invalid backups preserve existing data.
- Exercise two tabs and unavailable browser storage; verify explicit failure.
- Confirm requests contain no old sticker device/session API calls.

Keep the previous deployment available for rollback. Browser database and backup
format compatibility matters across releases. Source changes here do not deploy;
use `bunx --bun vercel` when deployment is explicitly requested.
