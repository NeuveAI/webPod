# 003 — Deadline player repair

**Opened:** 2026-09-03
**Target:** owner demo on 2026-09-04
**Status:** Ready for implementation; owner visual and real-account validation remain explicit gates.

## Outcome

Make the virtual iPod honest and usable even when protected Apple Music audio cannot start in the current browser:

1. Selecting a song always opens Now Playing with the selected song's real metadata and artwork. Loading or playback failure is secondary status; it never replaces the song identity.
2. A row selected continuously for 700 ms begins safe, cancellable metadata/artwork prefetch. When Apple Music is idle it may also prepare that selection through the public MusicKit queue API. The UI must not claim that five or six seconds of protected audio are cached because MusicKit exposes neither that control nor that measurement.
3. Home and browser screens never present fixture artwork or invented counts as live Apple Music data.
4. The LCD list foundation is repaired toward the compact, period iPod/Aqua language: eight readable rows, restrained hierarchy, a classic highlight, and a subordinate overflowing-list rail.
5. The current certificate-path fix remains server-only and receives independent review.

## Source of truth

- Product behavior and constraints: `../002-implementation-spine/handover-current.md` and `../002-implementation-spine/evidence/musickit-diagnostic-contract.md`.
- Current-state defects: the four owner screenshots supplied 2026-09-03 and the supplied browser console capture.
- Visual supporting reference: Apple's iPod documentation. It is supporting period evidence, not permission to copy the later iPod classic split-pane UI where it conflicts with the stated fifth-generation goal.
- Repository law: `/AGENTS.md`.

## Non-goals and guardrails

- No private MusicKit methods, direct HLS/segment/license fetches, blob URLs, synthetic buffering claims, autoplay hacks, or volume forcing.
- Dwell preparation never replaces a queue while audio is playing or paused with a current item.
- No credential contents are read or logged. The private key remains server-side and its path remains runtime configuration.
- No `useState`; shared behavior remains reachable through the Jotai store.
- No direct access to `design.pen`.
- No renderer redesign, WebMCP expansion, or history rewrite in this workstream.
- The `THREE.Clock` warning is a bounded cleanup after the two demo-critical lanes unless it proves causal.

## Correctness contract

### Playback and data truth

- The selected rendered occurrence is copied into pending Now Playing state before asynchronous provider playback begins.
- Pending, rejected, timed-out, and provider-error states preserve title, artist, album, and available artwork.
- Confirmed MusicKit metadata replaces pending data only when an authoritative item event identifies it.
- Artwork fetching uses the same-origin proxy and a stable cache key; stale selection work is abortable or ignored.
- The 700 ms dwell timer resets on every selection change and route change. Only the last stable selection may prefetch.
- Metadata/artwork requests are low priority where the runtime supports fetch priority.
- Idle Apple preparation uses only public `setQueue`; duplicate intents coalesce and stale completion cannot be mistaken for the current selection.
- Pressing Select can reuse a compatible prepared queue and still calls the normal authoritative playback path.

### Presentation truth

- Root and nested lists retain one shared row geometry and fit eight rows in the 272×204 LCD viewport.
- Selected text remains legible in both colourways and preference modes.
- The selection treatment reads as period Aqua without a billboard-scale glossy block.
- Scroll UI appears only for overflow and reads as a narrow trough plus independent thumb.
- Preview art is derived from the selected live entity when available; otherwise an explicit neutral empty state appears, never the fixture forest image.
- Absent Apple counts are omitted rather than fabricated.

## Verification and definition of done

- Deterministic tests cover pending metadata preservation, failure metadata preservation, stale dwell cancellation, 700 ms threshold, idle-only preparation, and no queue disruption during playback.
- Existing panel/navigation/provider tests pass.
- Affected TypeScript projects, lint, production build, and credential-boundary scan pass.
- Browser captures cover Music root, Artists, a nested track list, pending Now Playing, and failed Now Playing in both colourways at the canonical LCD size.
- A separate reviewer returns zero Critical and zero Major findings for each implementation lane.
- Owner performs real-account Apple sign-in/play attempt and visual sign-off. Protected playback in the Codex in-app browser is not itself a completion requirement if metadata remains correct and diagnostics identify the host limitation.

## Commit plan

Shared-tree agents do not commit while parallel lanes are active. After reviews, the lead prepares path-scoped commits in this order:

1. certificate/runtime path portability;
2. playback truth and dwell preparation;
3. Aqua/list presentation;
4. bounded warning/gate cleanup;
5. workstream evidence and handover.
