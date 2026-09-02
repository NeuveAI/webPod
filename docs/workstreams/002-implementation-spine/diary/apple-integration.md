# Apple integration diary

## Delivered

- Server-only ES256 token minting with environment validation, injected signer tests, short expiry, origin binding, and response hygiene.
- Same-origin TanStack Start route at `/api/apple/developer-token`.
- Browser MusicKit v3 loader and provider factory with explicit configure/authorize/unauthorize lifecycle.
- Typed Apple authorization states: signed out, signing in, authorized, permission denied, and error.
- Validated Apple resource mapping for songs, albums, artists, playlists, stations and genres; stable in-memory `LocalKey` identity and opaque one-use library cursors.
- Catalog/library search, library playlists/artists/albums/songs, stations, track-seeded stations, queue reads/appends/insert-next, and documented playback controls.
- Fixture provider untouched and still independently selectable.

## Boundaries held

- No file under `cert/` was accessed.
- No Apple library mutation was attempted.
- No navigation, state, panel, production device, device geometry, lighting, audio, cursor-hand, or `design.pen` file was edited by this lane.
- No secret or token is logged. The test token is synthetic.

## Remaining HITL

The owner must perform interactive Apple Music authorization in a browser before real-library and real-playback evidence can exist. See the runbook. Navigation wiring remains intentionally deferred.
