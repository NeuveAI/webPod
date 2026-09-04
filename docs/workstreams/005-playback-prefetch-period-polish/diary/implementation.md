# Implementation diary

## 2026-09-04 — baseline and constraints

- Read the complete W005 scope, dependency graph, decisions, material sources,
  implementation dispatch, review lanes, and repository law before editing.
- Applied the project conventions, Modern Web Guidance, Interface Craft, Neuve
  Motion, and Web Interface Guidelines. The physical iPod photographs remained
  authoritative for visual style. No Neuve command was run because repository
  law explicitly says there is no Neuve shell.
- Preserved the shared dirty tree, used only `bun`/`bunx`, did not inspect
  `cert/`, did not introduce `useState`, and did not commit.
- The initial observation confirmed that the old album screen stayed mounted
  until relationship data arrived, but its reported 7.46 s was not a valid
  input-to-result duration because the clock began before a separate input tool
  call. Retained valid diagnosis signals were sustained background pagination,
  a swallowed first track Enter, and repeated historical MusicKit
  play-without-pause sequence errors.

## 2026-09-04 — playback authority and transport serialization

- Reproduced the false-success path where `play()` resolution with MusicKit
  still at state `none` removed pending UI. Now only selected-item identity plus
  authoritative playing/progress, explicit user pause, or terminal failure ends
  an attempt.
- Serialized every production transport write. Distinct track and station
  selections are latest-wins across A→B, A→B→C, and track↔station races. A
  replacement queue crosses a mandatory pause boundary before `setQueue`.
- Made pause invalidate both transaction and play-request generations, including
  the narrow interval while a superseding selection awaits its replacement
  pause. Root navigation now pauses the provider; physical Play/Pause returns to
  Now Playing immediately and reconciles against provider state rather than a
  stale closure or lasting intent map.
- Kept station attempts able to adopt MusicKit's authoritative now-playing item
  even though the initial station frame has no selected track.

## 2026-09-04 — immediate navigation and bounded work

- Added immediate typed album, playlist, artist, genre, and search loading
  frames. Each unresolved list has eight final-geometry skeleton rows.
- A cloned store frame made reference-equality replacement impossible and caused
  indefinite skeletons. Loading frames now carry monotonic request identity;
  late responses replace only the still-visible matching request. Mounted tests
  cover Menu/back before a late relationship response.
- Added a reusable bounded async cache with explicit LRU, TTL, priority,
  cancellation, failure eviction, and teardown. Relationship caches are 32
  entries/5 minutes per data source; artwork is 48 entries/10 minutes; the
  source-owned known-track index is capped at 256; abandoned Apple continuation
  cursors are capped at 32. The authoritative Apple identity registry is not an
  expendable cache and deliberately remains stable until provider teardown.
- Visible lists prefetch the first four rows plus highlighted ±1, de-duplicated
  and clamped. Accepted work upgrades/reuses non-abortable MusicKit work and can
  supersede cancellable low-priority artwork/relationship work. Stable selection
  preparation starts at 700 ms and does not replace active or paused queues.
- Progressive Apple loading publishes the first page of each collection, then
  drains speculative pagination sequentially with an event-loop yield between
  pages so relationship work is no longer contending with four unbounded drains.

## 2026-09-04 — production boundary and interaction audio

- Removed the demo switch, fixture runtime branch, fixture fallback, and query
  mode. `/` redirects to the Apple-backed device route. `Panel` requires an
  injected provider/source; fixture data moved to an explicit test-only module
  and the panel browser route is copied only into an immutable test snapshot.
- Kept interaction sounds procedural. Three deterministic sample blueprints are
  generated at module initialization; the final three `AudioBuffer`s are warmed
  only after a user activation creates/resumes `AudioContext`. The first audible
  contact performs no synthesis or allocation and has an explicit synchronous
  latency-budget test. HTTP audio preload is therefore inapplicable.

## 2026-09-04 — period geometry and browser proof

- Re-measured the normalized physical reference. The standard 272×204 target is:
  title bar 0/0/272/21; artwork 18/58/86/86; metadata container x116/y58 with
  title ink y69 and a 12 px art gap; progress 18/157/236/5; times y183–196.
- Removed all standard Now Playing counts and the loading/status shelf. Pending
  playback is only the existing five-pixel Aqua striped track; determinate
  playback uses the same blue material. Reduced motion freezes the stripe.
- Restored eight 23 px rows in the 183 px list body, 8 px text inset, x263
  content edge, and a dedicated 9 px allocation containing the five-pixel Aqua
  trough. Removed split previews from normal lists and retained selected-row-only
  marquee behavior.
- Corrected browser proof to use logical offsets or normalize transformed boxes
  by the panel scale. Full panel evidence passes 17/17. Production composite
  evidence uses a Playwright-only mocked Apple facade—not a public fixture route—
  to capture list and indeterminate Now Playing inside the real device at mobile
  and desktop sizes.

## 2026-09-04 — playback-start loading boundary follow-up

- Reproduced the premature transition where a matching now-playing item and a
  coarse MusicKit `playing` state made the Aqua bar disappear while the playback
  clock remained stationary.
- Kept selected playback in provider `loading` state until that selected item's
  public playback clock moves forward. Queue mutation, item identity, and a
  resolved transport promise now seed the pending clock but never confirm start.
- Applied the same boundary in the panel presentation reducer so an optimistic or
  non-Apple provider observation at position zero cannot bypass the indicator.
- Existing provider and mounted-panel regressions now cover individual tracks,
  albums/playlists/stations, same-collection replay, stale items, rapid replacement,
  and play resolution before clock advancement.
