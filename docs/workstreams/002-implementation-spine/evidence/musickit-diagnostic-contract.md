# MusicKit diagnostic contract evidence

This is retained as historical evidence for the MusicKit v1 diagnostic enum mapping used when the diagnostic surface was introduced. Run `bun run scripts/verify-musickit-diagnostic-contract.ts` to fetch and verify that exact archived artifact. The production provider migrated to MusicKit v3 in workstream 003/D8; current playback event naming is grounded in Apple's v3 instance documentation. The verifier never configures MusicKit, accesses a user library, or emits media identifiers.

Verified extraction:

- `PlaybackStates`: `0 none`, `1 loading`, `2 playing`, `3 paused`, `4 stopped`, `5 ended`, `6 seeking`, `8 waiting`, `9 stalled`, `10 completed`.
- Internal media-item state: `0 none`, `1 loading`, `2 ready`, `3 playing`, `4 ended`, `5 unavailable`, `6 restricted`, `7 error`.
- Direct playback and media-item setters dispatch `{ oldState, state }` internally.
- The player forwards media-item state changes using the media item itself as the higher-level event argument. Only that object's numeric `state` is captured. Diagnostics do not read the internal setter's `oldState`, an `event.item` wrapper, or `nowPlayingItem.state`, because those shapes were not established at the application callback boundary.

The committed verifier is the reproducible source for these claims; unit tests verify application mapping and privacy behavior but are not treated as independent SDK evidence.
