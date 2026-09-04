# Authenticated Apple replay packet

Run this against the already authenticated Chrome DevTools session. Record only
durations, screen ids, event names, request counts/statuses, and redacted error
classes. Do not copy tokens, request authorization headers, private playback URLs,
catalog/library ids, account details, or track/album/artist titles.

## Setup

1. Open `http://localhost:3000/_spike/device?provider=apple` in the authenticated
   session and wait for the first usable S03 frame.
2. Open Console, Network, and Performance. Enable Preserve log, then clear all
   three. Filter Network to Fetch/XHR for navigation measurements and exclude the
   developer-token response body/headers from exports.
3. Expand the in-app technical timeline. Confirm encrypted media reports the
   browser's supported key system rather than `neither-supported`.

## Cold album navigation

1. Highlight an album that has not been opened in this page lifetime.
2. Start a Performance recording and press Center once.
3. Record accepted input→S08 shell mutation and accepted input→resolved track rows.
4. The shell must appear in the same accepted turn with exactly eight skeleton
   rows; it must not remain on S03 while the relationship request runs.
5. Record relationship request count for that album and concurrent background
   library request count. A single relationship request is expected; speculative
   continuation draining must be sequential rather than a full-library burst.

## Warm album navigation

1. Press Menu back to the album list, then reopen the same album.
2. Record input→S08 and input→rows again. The in-flight/resolved relationship must
   be reused; no duplicate album relationship request is expected.
3. Immediately press Menu during a different cold album load. After its response
   arrives, verify the album list remains visible and the late result does not
   replace it.

## Playback and progress

1. Select a track once. Record selection→S13, selection→first MusicKit `playing`
   event, and selection→first advancing position tick.
2. S13 must appear immediately. Until selected-track playing/progress arrives,
   only the existing Aqua progress track is indeterminate: no count row, loading
   shelf, instruction slab, or numeric progress value.
3. A resolved `play()` at MusicKit state `none` must not clear the stripe. Selected
   identity plus playing/progress must convert it to determinate and advance time.
4. Confirm the technical timeline has one coherent pause→setQueue→play sequence
   and no uncaught play-without-pause exception.

## Transport race replay

1. Rapidly choose three distinct tracks A→B→C. Only C may become audible and the
   S13 metadata must describe C.
2. During a pending resume, press Play/Pause again. The second intent must pause or
   cancel; it must not issue a second `play()`.
3. Press Menu until the Music root is visible while audio is playing. Audio must
   pause. Press physical Play/Pause: S13 must return immediately and resume. Press
   again: audio must pause.
4. Exercise Next and Previous once while active and once while an item is pending.
   Every transport write must remain serialized and metadata/audio must agree.
5. Start a station from a track, then quickly select a song; repeat in reverse.
   The latest choice wins, and a station attempt must leave the skeleton when
   MusicKit publishes its authoritative now-playing item.

## Sanitized result table

| Path | input→shell | input→data | selection→S13 | selection→playing | selection→first progress | relationship calls | background concurrency | result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Cold contention selection | 28.8 ms | 363.8 ms | n/a | n/a | n/a | 3 total / no duplicate | peak 3 | pass |
| Warm album | 23.4 ms | 45.1 ms | n/a | n/a | n/a | reused | peak 6 prefetch | pass |
| Track | n/a | n/a | 35.7 ms | 987.6 ms | 1,973.3 ms | n/a | n/a | pass |
| Root resume | n/a | n/a | 18.3 ms | 352.7 ms | ≤98.2 ms advancing | n/a | n/a | pass |

Finish by recording the final technical event sequence and whether Console contains
any uncaught error. Attach screenshots for resolved list, loading list, pending Now
Playing, playing Now Playing, and the returned-to-root paused state. Sanitize every
artifact before it enters this workstream.
