# MusicKit diagnostic contract evidence

Run `bun run scripts/verify-musickit-diagnostic-contract.ts` to fetch and verify the exact MusicKit v1 artifact used by webPod. The verifier rejects any artifact whose SHA-256 differs from `0ccb2ab37cedaef2eab9c7044c99afdb8c73a122a29ad8b7344af644a15bd14b` and prints only enum declarations and state-payload expressions. It never configures MusicKit, accesses a user library, or emits media identifiers.

Verified extraction:

- `PlaybackStates`: `0 none`, `1 loading`, `2 playing`, `3 paused`, `4 stopped`, `5 ended`, `6 seeking`, `8 waiting`, `9 stalled`, `10 completed`.
- Internal media-item state: `0 none`, `1 loading`, `2 ready`, `3 playing`, `4 ended`, `5 unavailable`, `6 restricted`, `7 error`.
- Direct playback and media-item setters dispatch `{ oldState, state }`.
- The player forwards media-item state changes using the media item itself as the event argument. Its numeric `state` is therefore the supported higher-level field. No `event.item` wrapper was established by this extraction; diagnostics may safely show a primitive value if a runtime supplies it, but a missing value remains explicitly unknown.

The committed verifier is the reproducible source for these claims; unit tests verify application mapping and privacy behavior but are not treated as independent SDK evidence.
