# Apple Music local test runbook

Do not paste secret values into a terminal command that will be shared or captured. Keep the existing key file private.

1. In a private local shell, export `APPLE_TEAM_ID`, `APPLE_MUSICKIT_KEY_ID`, and `APPLE_MUSICKIT_KEY_PATH`. The key path must be absolute. Optionally set `APPLE_TOKEN_TTL_SECONDS` from 60 through 3600; the default is 900.
2. Run `bun run dev` from the repository root and use the exact registered MusicKit web origin (normally `http://localhost:3000`).
3. Open `http://localhost:3000/_spike/device?provider=apple`. The query override wins over the build default and shows the signed-out Apple state.
4. Select **Sign in to Apple Music**. Authorization is invoked only by this user gesture. Confirm the UI reaches the authorized state, then exercise playlists, artists, albums and songs through the normal click-wheel navigation. Start playback and confirm the production transport controls drive MusicKit.
5. Select **Sign out of Apple Music** to invalidate the Music User Token. Do not inspect browser storage or print SDK/token objects.

## Provider selection

The safe default is the deterministic fixture library. For a local Apple-default build, set `VITE_WEBPOD_PROVIDER=apple`; `?provider=fixture` and `?provider=apple` remain explicit development overrides. A MusicKit configuration failure automatically restores the fixture provider and exposes a non-secret status message.

## Expected limitations

- Writes intentionally reject; this run is read/playback only.
- Apple library genres remain absent because Apple exposes no direct library genre collection matching the shared contract.
- Apple exposes no direct library genres/composers collection matching the current `LibraryKind` members; those calls reject rather than presenting fabricated empty lists.
