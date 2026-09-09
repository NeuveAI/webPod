# Verification — 2026-09-09

## Passed

- `bun run build`: client and server production bundles generated on Bun 1.4.0.
  Existing Vite warning about chunks over 500 kB remains; no bundle optimization
  was attempted in this deployment task.
- `bun run typecheck`: 12/12 projects clean.
- `bunx --bun eslint apps/web/src/server/sticker-runtime.server.ts apps/web/src/server/sticker-runtime.test.ts`: passed.
- `bun test apps/web/src/server/sticker-runtime.test.ts`: 2 tests, 7 assertions.
- `bun test apps/web/scripts/sticker-production.test.ts apps/web/scripts/sticker-start.integration.test.ts`:
  2 tests, 218 assertions. Built Start routing covers import, opening, placement,
  reload, idempotent earning, revocation and recovery with synthetic upstream data.
- `docker build -f Dockerfile.vercel -t webpod:vercel-prep .`: passed. Frozen
  install applied repository patches. Clean production stage installed 214
  packages, versus 334 in the build stage. No lockfile change.
- Actual image HTTP smoke: `/` and `/webpod` returned 200 with SSR HTML; all
  60 sticker PNG responses matched the manifest SHA-256 values; unauthenticated
  `/api/stickers` returned 401 with `Cache-Control: no-store`.
- Actual image ran as uid 1000. Existence-only checks found no `/app/cert`,
  `.env.local`, `.data`, direct ESLint install, or app Vite install in the runtime.
- Image startup with `VERCEL=1` and `/tmp` SQLite was rejected before listening.
- SIGTERM via `docker stop` completed and the smoke container was removed.
- `git diff --check`: passed.

## Review and limitations

Docker was installed but initially stopped; Docker Desktop was started for the
image test. Tested image: Linux arm64, 195,325,773 bytes, manifest
`sha256:1b4d107b917240b51c1da25eecd62de1801d5a7719ec965436ece798b8672595`.
Other image architectures were not exercised. Local image testing is not a Vercel preview verification. No remote
deployment, provider provisioning, real Apple authentication, or durable remote
storage test occurred. No credential contents were read or copied.

Review covered the allowlisted Docker context, independent Vercel upload
exclusions, workspace symlink layout, production dependency installation,
non-root transport, port configuration and the stateless storage rejection.
The first image used `bun install --production` after a development install;
its output showed this did not prune dependencies. The final Dockerfile fixes
that with a separate clean production-dependencies stage, and the final image
was rebuilt and tested.

The private path checks and local SQLite behavior remain unchanged outside
Vercel. No UI code or library dependency versions changed. The image still
needs storage migration and runtime key provisioning before production use.
The guard relies on Vercel's `VERCEL=1` environment marker; keep automatic
system environment variables enabled in project settings.

A concurrently created `018-apple-music-genres` directory was left untouched;
this workstream moved to 019 to avoid numbering collision.
