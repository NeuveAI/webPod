# Apple integration decisions

Date: 2026-09-02

## Sources read

- Apple, “Getting Started — MusicKit on the Web v3,” retrieved 2026-09-02: `https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=%2Fstory%2Fget-started--page`
- Apple, “MusicKit Instance,” retrieved 2026-09-02: `https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=%2Fstory%2Freference-javascript-musickit-instance--page`
- Apple, “Generating Developer Tokens,” retrieved 2026-09-02: `https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens`
- Apple, “User Authentication for MusicKit,” retrieved 2026-09-02: `https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit`
- Apple Music API endpoint pages, including Get All Library Playlists, catalog search, albums and playlists, retrieved 2026-09-02.
- Repository evidence `apple-capability-spike.md` and `apple-empirical-probe.md`.
- Canonical repository types in `packages/providers/src/{provider,domain,identity}.ts`; no parallel domain was introduced.
- Current TanStack Start route-handler shape in `~/code/agentic-context/tanstack/router`.

## Decisions

1. The shipped token TTL is 15 minutes by default and at most one hour. Apple permits a much longer maximum, but a local browser needs only a short-lived bootstrap token.
2. The JWT includes Apple’s recommended `origin` claim for the exact request origin. The endpoint also rejects cross-origin browser requests and returns `Cache-Control: no-store, private`.
3. The key path must be an absolute path supplied by `APPLE_MUSICKIT_KEY_PATH`. There is no default and no client import of the signer.
4. Music User Token lifecycle remains inside MusicKit JS. webPod stores only typed in-memory session state and does not read or persist the user token.
5. This lane implements reads and playback only. Existing write-capable matrix values remain evidence facts, but write methods deliberately reject as not implemented because the owner did not authorize library mutation.
6. `genres` and `composers` do not map to documented Apple library collection endpoints. Returning an empty page would fabricate an empty library, so these calls reject honestly pending a separately designed derivation.
7. The current `MusicProvider` contract has no entity-detail/relationship method. Album/playlist/artist drill-down therefore cannot be exposed without a contract extension owned by a later integration pass; the Apple adapter does not invent a side channel.

