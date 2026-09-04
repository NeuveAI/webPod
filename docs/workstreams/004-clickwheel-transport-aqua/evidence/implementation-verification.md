# Implementation verification

## Automated evidence

| Check | Result |
| --- | --- |
| Focused state/provider/composite/panel/web tests | PASS — 162 tests across nine files |
| Full repository tests | PASS — 1293 tests |
| TypeScript project sweep | PASS — 11/11 |
| ESLint | PASS |
| Client build | PASS |
| SSR build | PASS |
| Static gates | PASS — 16 automated, 0 failed |
| Diff whitespace check | PASS |

Deterministic coverage includes accepted provider transport versus list fallback, rejected-provider transport without false paging/feedback, deferred loading transport with exactly-once delegation and stale-context cancellation, provider-owned ad-hoc/playlist/shuffled queue traversal, Apple previous restart/step semantics, playing-intent preservation across skips, explicit paused-intent restoration after replacement-item autoplay, concurrent-pause cancellation, paused-position resume, live MusicKit queue order differing from the source order, truthful bounded queue projection, reconstructed Now Playing counts after root transport, bounded standard-volume and scrub writes, reference-backed center cycling, authoritative queue browsing, stale queue completion rejection, root-entry notification from physical Menu navigation, reserved sibling scrollbar geometry, overflow measurement, and reduced-motion styling.

## Reference evidence

All supplied real-device references were inspected. The resulting implementation uses standard metadata/progress, a subtle scrub marker, a full-artwork state, and a provider-owned queue state. It has no label-only mode, instructional slab, passive action strip, or direct LCD button. Standard Now Playing follows `IMG_2273` with a dedicated counter band, a 12px art/metadata gap, artwork around y56–144, progress beginning around 77% of the 272×204 screen, time labels ending around 95%, and 10px terminal whitespace. The browser invariant requires progress at 75–80%, times ending at 92–97%, and terminal whitespace under 6%; it records a canonical screenshot plus geometry JSON. Long inactive rows keep ellipsis, only the selected overflowing row is eligible for marquee, and scrollable lists reserve a narrow bordered white rail with a blue thumb beside row content.

## Authenticated browser evidence

PASS ON ROOT-OWNED FINAL FROZEN SESSION — playing Next advanced the queue and remained playing; previous after more than three seconds restarted the current item; physical Menu navigation to root paused playback; root Play/Pause returned to Now Playing and resumed from the preserved position with a hydrated count. Paused PageDown advanced exactly one queue position and finished paused at time zero with media `readyState` 4 and no playback diagnosis. The provider exposed a truthful bounded live queue of eight rows, queue-wheel selection advanced, and the rendered mode cycle contained zero rejected instruction slabs. Evidence is sanitized to mode/state transitions, queue positions/counts, durations, and pass/fail; it excludes credentials, tokens, titles, item identifiers, authorization URLs, and media/license URLs.
