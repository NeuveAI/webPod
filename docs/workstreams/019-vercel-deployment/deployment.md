# Actual Vercel deployment — 2026-09-09

## Production domain fixed

The user was opening `https://webpod.vercel.app/`, which returned
`DEPLOYMENT_NOT_FOUND`. Prior successful builds targeted preview only; the
production domain had no ready deployment. This was missed by CLI-only checks.

Configured `PORT=3000` for Production and ran `vercel deploy --prod --yes`.
Deployment `dpl_9uBjEtMNgXBaK11vkL47t1f9Zsov` is READY and explicitly aliased
to `https://webpod.vercel.app/`. Reloaded the user's exact Chrome tab and visually
verified the hydrated landing page and rendered iPod, replacing the 404.

Apple sign-in still visibly reports failure because credentials are unconfigured;
durable sticker storage is also outstanding. The verified fix is the production
domain and rendered page, not functioning Apple playback or sticker persistence.

## Startup fix — latest deployment

- Preview: https://webpod-b0hjelesf-perf-lab.vercel.app
- Deployment: `dpl_GNSXsZeMes25ygcCMme4TkbAoyUy`, READY.
- Removed eager storage validation from the HTTP launcher. The existing API
  boundary still validates storage and returns a controlled 503. No ephemeral
  database fallback was added. Removed the now-unused source runtime copy from
  the Dockerfile; the built Start server retains its storage implementation.
- Verified after READY using authenticated CLI requests: `/` and `/webpod`
  return HTTP 200, title `webPod`, and the generated application asset references.
  An earlier 200 during build was Vercel's build page and was not counted.
- Client entry `/assets/index-Yge-uJuB.js` returns HTTP 200.
- `/api/stickers` returns 503 with the expected `unavailable` JSON message.
- New isolated-process regression test uses `NODE_ENV=production`, `VERCEL=1`
  and no database configuration: public SSR succeeds and storage fails safely.
  Four focused tests pass (135 assertions), targeted lint passes, and all
  12 TypeScript projects pass. Production build passes.
- Browser verification was blocked by Vercel login in the in-app browser;
  HTTP verification used the CLI's authenticated protection bypass. No claim
  of browser hydration, Apple playback or durable storage verification is made.

The startup outage is fixed. This is still not full integration readiness:
Apple signing configuration and remote sticker storage remain outstanding.

## Earlier attempts

User authorized creating a new project named webPod and attempting deployment.
Vercel rejected mixed-case names; created `perf-lab/webpod` instead. Local CLI
authentication was completed by the owner. Project linking wrote ignored local
Vercel metadata and updated `.env.local` through the CLI; no secret contents
were inspected. Preview configuration has `PORT=3000`.

## Result

- Project: https://vercel.com/perf-lab/webpod
- Preview: https://webpod-cn7woj6iy-perf-lab.vercel.app
- Deployment: `dpl_8agsEMDHuEApUNFVGujGjvhtVJ5z`
- Inspector: https://vercel.com/perf-lab/webpod/8agsEMDHuEApUNFVGujGjvhtVJ5z
- Platform state: READY, preview (`target: null`).
- HTTP verification: **500**, checked with authenticated `vercel curl` and
  redirects followed. Deployment protection remains enabled.
- Runtime log: Bun 1.4.0, Linux x64; process exits with code 1 at startup because
  `stickerDatabasePath` rejects Vercel's ephemeral local SQLite storage.

This is a successfully built and uploaded container, not a working application.
No SQLite bypass, fake storage configuration, or Apple key was introduced.

## Configuration corrected during deployment

The dry-run file inventory excluded all credential and private-state inputs.
Vercel also excluded `.dockerignore` by default; `.vercelignore` now explicitly
includes it so the remote image build retains its allowlisted context.

The initial deployment used generic project detection, Bun 1.3.14 and a static
`public` output expectation. It could not parse the v2 lockfile and eventually
failed for missing output. That first attempt was labeled Production by Vercel
despite the preview target argument; it never became ready.

Adding `vercel.json` with `services.web.runtime = "container"`, an explicit
Dockerfile entrypoint and a catch-all service rewrite fixed deployment selection.
The retry used Vercel's Linux/amd64 container builder, Bun 1.4.0 and frozen
installs. The image built in 36.3 seconds and was pushed to:

`vcr.vercel.com/perf-lab/webpod/web@sha256:146d41f8221d442a325bc63fa44ed4c204c4429ae25b980f21b33f852b9e7c65`

## Next step

Implement the durable database migration in `research.md`, then provision the
MusicKit key through a server-only runtime mechanism. Redeploy to this existing
project and repeat HTTP, authentication, persistence and concurrency checks.
No production promotion or Git integration was performed.
