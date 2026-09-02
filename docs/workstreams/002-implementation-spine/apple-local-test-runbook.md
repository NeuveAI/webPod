# Apple Music local test runbook

Do not paste secret values into a terminal command that will be shared or captured. Keep the existing key file private.

1. In a private local shell, export `APPLE_TEAM_ID`, `APPLE_MUSICKIT_KEY_ID`, and `APPLE_MUSICKIT_KEY_PATH`. The key path must be absolute. Optionally set `APPLE_TOKEN_TTL_SECONDS` from 60 through 3600; the default is 900.
2. Run `bun run dev` from the repository root and use the exact registered MusicKit web origin (normally `http://localhost:3000`).
3. After the navigation lane lands its wiring, create the provider with `createAppleProvider()`, call `configure()` during app bootstrap, and call `authorize()` only from the user’s sign-in gesture.
4. Confirm `appleSessionState.status === "authorized"`, inspect only sanitized entity names/counts, then exercise playlists, artists, albums and songs. Start playback from a catalog-backed track and confirm playback state becomes `playing`.
5. Call `unauthorize()` to invalidate the Music User Token. Do not inspect browser storage or print SDK/token objects.

## Minimal later wiring seam

Add `@webpod/providers` as an app dependency, instantiate `createAppleProvider()` beside the existing provider-selection bootstrap, and place that instance into the navigation lane’s provider atom/store. Keep the fixture provider as the fallback when configuration or authorization is unavailable. No change to `production-device-view.tsx` is required by the provider itself.

## Expected limitations

- Writes intentionally reject; this run is read/playback only.
- The provider contract currently lacks entity-detail relationship methods, so album/artist/playlist drill-down needs a shared contract extension after navigation ownership is released.
- Apple exposes no direct library genres/composers collection matching the current `LibraryKind` members; those calls reject rather than presenting fabricated empty lists.
