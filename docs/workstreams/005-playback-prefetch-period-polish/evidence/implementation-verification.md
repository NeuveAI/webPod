# Implementation verification

Date: 2026-09-04

## Result

The implementation candidate covers W005 P1–P5 with deterministic unit,
integration, browser, build, static, and authenticated Apple evidence. The exact
sanitized procedure remains recorded in `authenticated-replay-packet.md`.

The lead's first valid warm authenticated replay measured: boot→usable S03
2,192.8 ms; root→albums 33.6 ms; album input→loading shell 23.4 ms and →data
45.1 ms; track input→S13 31.8 ms; →audio playing 837.1 ms; →determinate progress
1,396.4 ms; and →first one-second progress 1,953.7 ms. Six relationship
prefetches ran concurrently (342–717 ms), while the selected warm item did not
wait. Cold-path and remaining transport-race replay rows are still required by
the packet; the earlier 7.46 s observation is excluded because its timer began
before a separate input call.

Cold contention replay then started exactly three relationship requests at
127.8–128.0 ms (peak concurrency 3; durations 551.9, 556.5, and 602.1 ms).
Enter at 337.5 ms produced the loading shell 28.8 ms later and selected data
363.8 ms after input—before the longest background request completed about
392.6 ms after input. Total relationship calls remained three. This proves the
accepted selection reused its in-flight request without duplication and did not
wait for the whole speculative batch.

Final live transport replay measured track input→S13 at 35.7 ms, audio reset at
+507.7 ms, playing at +987.6 ms, determinate progress at +1,352.1 ms, and the
first one-second progress tick at +1,973.3 ms. Now Playing pause was observed
within 22 ms; resume advanced within 98.2 ms; Next changed item/reset position
within 26.9 ms and returned ready/playing in about 444 ms. Root entry paused
while retaining 29.613 s. Root Play/Pause returned S13 in 18.3 ms and audio
resumed in 352.7 ms near 30 s; the second press paused in 23.2 ms. Final audio
was paused at `readyState=4` with no media error. Across a 40-event timeline the
console contained zero repeated-play or uncaught transport errors. Three generic
resource errors remained (two 404 and one 400, without JavaScript stacks or
messages); the known optional-station 400 may account for one, but that attribution
is not asserted without request evidence.

## Measured geometry

| Surface | Logical target | Browser result |
| --- | --- | --- |
| LCD | 272×204 | 272×204 |
| Title bar | x0, y0, 272×21 | x0, y0, 272×21 |
| Artwork | x18, y58, 86×86 | x18, y58, 86×86 |
| Metadata | container x116/y58; title ink y69 | x116/y58; h1 y69 |
| Artwork→metadata gap | 12 px | 12 px |
| Progress | x18, y157, 236×5 | x18, y157, 236×5 |
| Times | y183–196 | y183–196 |
| List | 183 px body; eight rows | 8 × 23 px (fractional authored division rounds over the body) |
| List content/rail | content ends x263; dedicated rail follows | viewport 263 px; 9 px rail allocation with 5 px Aqua trough |

Canonical DOM artifact:
`$TMPDIR/webpod-panel-playwright/evidence/panel-s13-reference-geometry.json`.

## Behavioral proof

- Playback tests cover playResolve-before-playing, playing-before-playResolve,
  progress-before-resolution, stale/rejected attempts, selected identity,
  duplicate queue occurrences, A→B and A→B→C supersession, track↔station races,
  prepared-queue replacement, pending resume→pause, root pause→out-of-band
  selection→physical pause, pause during the replacement boundary, skip overlap,
  station confirmation, media error, timeout, and teardown.
- Navigation tests cover same-turn shells, eight skeletons, request reuse,
  high-priority promotion, cancellable supersession, first-four-plus-neighbor
  selection, LRU/TTL eviction, rejected-load retry, cache clear, and late response
  after Menu/back.
- Runtime tests cover first-page publication before background completion,
  sequential continuation draining, bounded known-track retention, and teardown.
- Interaction-audio tests prove three bounded final buffers are created at the
  activation boundary and first contact stays within the synchronous latency
  budget without allocation or network assets.
- Production-boundary tests prove Apple is the only runtime, `/` redirects to
  the Apple device, no demo control/query/fallback remains, and the shipped
  panel entry does not import fixture data.

## Commands and results

| Command | Result |
| --- | --- |
| Focused cache/panel/provider/production tests | 107 passed, 0 failed, 465 assertions |
| `bunx --bun playwright test --config packages/panel/playwright.config.ts` | 17 passed, 0 failed; immutable source fingerprint `7e5d4d6b…` |
| `bunx --bun playwright test --config apps/web/tests/playwright.config.ts lcd-fidelity.e2e.ts` | 4 passed, 0 failed; immutable source fingerprint `8f19bb6e…` |
| `bun run build` | client and SSR builds passed |
| production `dist` scan for fixture/demo markers | zero matches |
| `bun run typecheck` | 11/11 projects clean |
| `bun run lint` | passed, zero findings |
| `bun run gates` | 1,313/1,313 tests; 16 automated gates passed, 0 failed; manual U14/U15 remain owner/reviewer checks |

The browser proof produced:

- Canonical panel geometry and full light/dark/state/preference matrix under
  `$TMPDIR/webpod-panel-playwright/evidence/`.
- Production list at
  `apps/web/tests/test-results/lcd-fidelity/production-device-list-mobile-390x844.png`
  and `production-device-list-desktop-1440x900.png`.
- Production indeterminate Now Playing at
  `apps/web/tests/test-results/lcd-fidelity/production-device-now-playing-pending-mobile-390x844.png`
  and `production-device-now-playing-pending-desktop-1440x900.png`.

## Security and scope checks

- No certificate or private-key contents were read.
- Developer-token minting remains server-side; browser code calls the same-origin
  token endpoint and never receives key material.
- No token, private provider URL, provider identifier, or library title is present
  in this evidence.
- No private HLS, license, preview-media, or undocumented MusicKit surface was
  added. Queue preparation uses the public MusicKit facade and makes no claim
  about seconds buffered.
- No `useState`, alternate package manager, commit, or destructive Git action was
  used.

## Playback-start boundary follow-up

The post-review loading regression is fixed at both provider and presentation
boundaries. `setQueue`, `play()` resolution, `nowPlayingItemDidChange`, and a raw
`playing` state all leave the selected attempt loading while its playhead remains
stationary. The first forward playback-clock sample confirms start, publishes the
provider's playing state, settles the panel attempt, and replaces the indeterminate
Aqua stripe with determinate progress.

- Focused provider/presentation/mounted-panel suite: 78 passed, 0 failed.
- Repository typecheck: 11/11 projects clean.
- Repository lint and production client/SSR build: passed.
- Static gate sweep: 1,329 passed, 0 failed; 16 automated gates passed.
- The dedicated browser test for the pending Aqua playback state passed. The full
  browser run finished 16/18: the broad state-matrix capture exceeded its 30 s
  timeout and the pre-existing throttled frame-budget check measured 69.5 ms
  against a 20 ms ceiling on this host. Neither failure exercises playback-start
  state, and both reproduced when rerun alone.
- Authenticated Apple-account replay of this follow-up remains an owner-run check;
  no credential or protected media data was accessed.
