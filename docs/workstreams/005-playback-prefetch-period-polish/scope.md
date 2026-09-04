# Workstream 005 — playback, prefetch, and period UI polish

Status: Ready

## Objective

Ship a dependable Apple Music-first iPod player whose input response, playback
state, loading states, list density, and Now Playing geometry match the supplied
real iPod references closely enough for the deadline build.

## Authority order

1. The owner's latest explicit direction in this workstream.
2. The real iPod photographs in `/Users/vinicius/code/tmp/ipod-reference/`.
3. Apple's period iPod manuals and the material sources in
   `research/material-sources.md`.
4. Current Apple guidance only for accessibility and honest loading semantics.
5. Existing implementation and earlier workstreams, which are non-authoritative
   when they conflict with 1–4.

The latest direction removes the Now Playing `x of y` row even though one supplied
photo contains a queue counter. The explicit product decision wins. Existing 004
tests that require `.wp-now-count` are regressions and must be replaced.

## In scope

### P1 — authoritative playback state

- A song selection must transition to Now Playing immediately.
- Queue acceptance, `play()` resolution, selected-item identity, and MusicKit's
  coarse `playing` state do not dismiss loading. The selected track's playhead
  must advance before the Aqua indicator becomes determinate; explicit
  cancellation and terminal failure remain non-success exits.
- Position and duration must advance from provider events/ticks without reload.
- Race tests must cover: play promise before/after playback events, progress before
  play resolution, stale/rejected play attempts, rapid overlapping selections,
  a prepared queue replaced by selection, pause during pending play, and provider
  teardown.
- Eliminate the observed uncaught MusicKit sequence error: `play()` called without
  an intervening pause or stop.
- Remove the “Preparing playback” shelf and text. Pending state lives only inside
  the existing progress track as a restrained Aqua indeterminate stripe. Once
  duration/progress is authoritative, the same track becomes determinate.
- Failure and permission states may remain explicit, compact, and actionable; they
  must not squeeze a normal-playing layout.

### P2 — immediate navigation and bounded prefetch

- Center/Enter on an album, playlist, or artist pushes its destination shell in
  the same accepted input turn. It never waits for relationship data.
- An unresolved destination shows eight geometry-identical skeleton rows. Data
  replaces them in place, with stale-response and back-navigation protection.
- Each visible list prefetches items 0–3 plus the highlighted item and its immediate
  neighbors (index -1/+1), de-duplicated and clamped.
- Prefetch is low priority; accepted navigation/play work upgrades or supersedes it.
- Relationship/artwork/preparation caches are bounded LRU stores with explicit max
  entries and TTL. Failed promises are removed, eviction/teardown aborts cancellable
  work, and no source-owned Map or Set grows without a bound.
- A cache hit must reuse the in-flight/resolved request; a miss must still navigate
  immediately.
- Apple Music preparation may use only documented/public MusicKit surfaces and may
  never replace an active or paused queue merely because focus moved. No direct HLS,
  license, private playback URL, or preview-track fetches are allowed.
- The provider contract cannot honestly guarantee “the first six seconds are
  buffered” because MusicKit exposes no byte/second buffer control. Implement the
  strongest safe equivalent—bounded relationship/artwork fetch plus non-disruptive
  public queue preparation—and report selection-to-playing timings. Do not claim an
  unmeasured six-second buffer.

### P3 — Apple-only production entry

- Production/device entry always requests Apple Music.
- Remove the user-visible demo-library switch and silent fixture fallback.
- Signed-out, permission-denied, loading, and retry remain explicit Apple states.
- Fixture data may remain as test-only infrastructure; production runtime state and
  query parameters must not expose it.

### P4 — SFX readiness

- Preserve the interaction SFX character. The current SFX are procedurally generated,
  not network assets; therefore a fake audio preload link is not acceptable.
- If the production path is changed to static assets, use organized document-head
  `<link rel="preload" as="audio" type="…">` entries, verify MIME/URL/build output,
  keep their priority below render-critical resources, and prove no duplicate fetch.
- If procedural audio remains, precompute/cache the bounded sample data before its
  first eligible playback without creating/resuming `AudioContext` outside a user
  activation. Add a first-interaction latency test and document why HTTP audio
  preloads are inapplicable.

### P5 — period-authentic geometry and whitespace

- Remove `.wp-now-count` and every standard Now Playing `x of y` visual.
- Use the 272×204 authored LCD coordinate system for every geometry assertion.
- The latest failing screenshot is an anti-reference: 88px artwork, oversized type,
  compressed metadata, and a competing status slab are not acceptable.
- Re-measure the photographs rather than inheriting 004 values. Record target bounds
  for titlebar, content insets, artwork, metadata lines, progress track, time labels,
  list rows, divider, chevron, and scroll rail before final CSS is accepted.
- Preserve eight visible rows on list screens at the production 100% Dynamic Type
  setting, a dedicated thin rail outside row content, selected-row-only marquee,
  and single-line ellipsis elsewhere. Explicit accessibility Dynamic Type scaling
  may reduce the row count so text does not overlap; CSS/camera scaling of the
  physical device must not change the logical eight-row geometry.
- Dark mode may change palette only. Geometry, spacing rhythm, type scale, borders,
  loading treatment, and interaction remain recognizably iPod.
- Skeleton rows occupy the final row geometry. Reduced motion freezes shimmer and
  indeterminate stripe without hiding state.
- No modern glass, card, chip, status shelf, instruction slab, floating widget, or
  decorative animation may enter the LCD.

## Baseline evidence

- The initial DevTools baseline confirmed the old screen remained mounted until
  relationship resolution and exposed no interim loading shell. A previously
  recorded `7.46s` value was invalid because its clock began before a separate
  DevTools input call; it is deliberately not used as performance evidence.
- The same authenticated session contained repeated uncaught MusicKit errors:
  `The play() method was called without a previous stop() or pause() call.`
- Current logical Now Playing bounds: titlebar `0,0,272,21`; count row
  `8,21,256,22`; track cluster `8,46,256,108`; artwork `8,56,88,88`; metadata
  `108,68.5,156,63`; progress `8,157,256,5`; times `8,181,256,13`.

## Definition of done

1. Focused unit/integration/browser tests prove every P1–P5 behavior.
2. Full `bun test`, all workspace typechecks, lint, client build, SSR build, static
   gates, and `git diff --check` pass.
3. Authenticated Apple replay proves first input transition, skeleton miss, cache hit,
   playback start, progress advance, pause/resume, skip, and no uncaught transport
   sequencing error. Evidence is sanitized: no tokens, private URLs, ids, or titles.
4. DevTools timing evidence records input→shell, input→data, selection→Now Playing,
   selection→playing, and first advancing progress tick for cold and warm paths.
5. Screenshot evidence at canonical 272×204 and the production scaled device covers
   lists, loading list, pending Now Playing, playing Now Playing, light/dark, and
   reduced motion.
6. An independent playback/performance reviewer and an independent visual/material
   reviewer return zero Critical/Major findings. Minor findings are either fixed or
   explicitly dispositioned with evidence.

## Guardrails

- Do not read or expose `cert/` or credentials.
- `bun`/`bunx` only; no force push; no commit trailers; no `useState`.
- Do not run a Neuve shell: repo law states there is no Neuve shell. Record this as
  an intentional repo-law bypass of generic orchestration guidance.
- Preserve unrelated dirty-tree work and do not commit.
