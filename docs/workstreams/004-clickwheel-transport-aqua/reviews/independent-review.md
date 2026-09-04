# Review: 004 — Click-wheel transport and Aqua correction

## Verdict: APPROVE

### Correctness Check

- Source of truth: owner requests/screenshots, all workstream-004 scope/HITL/dispatch artifacts, the repository provider/input contracts, and the real-device references were loaded.
- Kanban/Neuve: not applicable. Repository law explicitly says this repository has no Neuve shell or board; the workstream bundle is the canonical tracker, so no Neuve command was invoked.
- Review separation: the implementation-owned path packet was audited independently from the pre-existing workstream-003 changes in the shared dirty tree. No commit is expected from this slice.
- Deterministic verification: independent final runs passed 1,293/1,293 repository tests, 11/11 TypeScript projects, ESLint, client and SSR production builds, all 16 automated repository gates, and `git diff --check`. The focused state/provider/composite/panel/web suite passed 162/162.
- Browser verification: the reviewer could not attach a second client to the locked authenticated Chrome profile without stopping or replacing it, which was prohibited. The root-owned existing session therefore supplied sanitized authenticated replay evidence from the final frozen lineage; the reviewer independently audited the exercised code/tests and reproduced the final visual geometry in a separate fixture browser.
- Authenticated Apple transport: playing Next advanced once and continued; Previous after more than three seconds restarted the current item, while near-start Previous moved to the prior item; physical Menu/root entry paused at the preserved position; Play/Pause at root returned to Now Playing with a hydrated bounded count and resumed from that position; paused Next advanced once and remained paused at time zero with ready state 4 and no error or diagnosis.
- Queue authority: the final queue view rendered an eight-row bounded window from live MusicKit order, with no source-order reconstruction. Wheel movement changed the queue selection within bounds. Deterministic coverage makes the source order differ from the live shuffled order and asserts that only the latter is projected.
- Visual evidence: standard → scrub → full artwork → queue rendered with no mode/instruction slab. Independent 272×204-equivalent geometry measurement placed progress at about 77%, the time row bottom at about 95%, and terminal whitespace at about 5%, with a dedicated count band and non-overlapping art/metadata. This is consistent with the accepted `IMG_2273` structure.
- Manual gates: U15 passed reviewer inspection. U14 remains the repository gate's explicit owner phone-in-hand check; it is not a workstream-004 correctness gap and is not represented as automated evidence.

### Findings

No confirmed Critical, Major, or Minor findings remain.

The correction loop closed the previously blocking cases: root-entry pause, playing-intent preservation across item replacement, paused-intent restoration after MusicKit implicit autoplay, loading-context transport serialization/cancellation, truthful success/failure routing, playlist/ad-hoc/shuffled provider order, previous restart semantics, reconstructed count/position preservation, and the rejected standard Now Playing proportions.

### Suggestions (non-blocking)

None.

### Neuve Dogfood Feedback

- Commands run: none; repository law explicitly forbids invoking a Neuve shell in this repository.
- Artifact refs: none.
- Kanban updates: not applicable; the workstream tracker is canonical.
- HITL gate: no routed unit and no unresolved blocking owner decision.
- Sticking point: the generic review workflow assumes Neuve availability, while this repository explicitly declares it absent.
- Backlog signal: orchestration guidance should treat an explicit repository-level Neuve prohibition as a first-class waiver.

## Independent acceptance checklist

### R1 — Playback and queue correctness

- [x] Next/previous delegate exactly once to the active provider when playback context exists, including loading.
- [x] No-playback next/previous preserve list paging.
- [x] Previous after more than 3 seconds restarts the current item; at or before 3 seconds it moves to the prior provider queue item.
- [x] Playlist, album, shuffled, and ad-hoc queue order stays provider-authoritative, with deterministic playlist/ad-hoc/shuffle coverage.
- [x] Successful global transport from root/browse returns to Now Playing; failure cannot look accepted.
- [x] Playing and paused intent survive replacement-item transport, including MusicKit's implicit autoplay behavior.
- [x] Provider switching and overlapping async operations cannot publish stale playback or queue state.

### R2 — Shared state and interaction architecture

- [x] Standard metadata/progress, scrub, artwork, and queue are substantive views; only truthful rating/lyrics may be added.
- [x] Standard Now Playing owns wheel volume without becoming a labeled `Volume` mode.
- [x] Center cycles only through truthfully implemented capabilities.
- [x] Wheel detents travel through the singleton Jotai store and are bounded.
- [x] Queue reads are provider-backed, identify the authoritative position, and reject stale completion.
- [x] Root entry pauses without discarding the provider item/queue, and later transport restores Now Playing context.
- [x] No React `useState`, closure-only authority, direct LCD controls, or duplicated raw-input paths.

### R3 — Visual, motion, and accessibility

- [x] Passive shuffle/repeat/love/rating/queue action strip is absent.
- [x] No mode chip or instructional slab appears; mode is expressed only through reference-backed content/control.
- [x] Standard Now Playing has a dedicated count band, non-overlapping art/metadata, reference-positioned progress/time rows, and no abandoned lower shelf.
- [x] Scrollbar is a structural sibling beside both full-width and split-pane list content, never an overlay.
- [x] Only active overflowing titles marquee; inactive/non-overflowing titles stay stable and clipped.
- [x] Marquee uses transform-only CSS, measured outside render, responds to content/resize, remains interruptible, and is disabled under `prefers-reduced-motion` with ellipsis retained.
- [x] Click-wheel pointer and keyboard paths retain accepted feedback and visible focus behavior.
- [x] Authenticated Apple verification records only state/position/count/timing; no titles, item IDs, tokens, authorization URLs, or media/license URLs.
