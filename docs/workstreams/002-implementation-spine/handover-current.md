# Current handover: webPod MVP

**Updated:** 2026-09-03  
**Read first:** repository `AGENTS.md`, then this file, then the linked decision and evidence files.  
**Branch posture:** all known work is committed; do not rewrite or force-push history.

## Product goal

webPod is a browser music player presented as a physically modelled fifth-generation iPod. It should feel and behave like the device rather than merely resemble an iPod skin. Humans operate it through the click wheel; later, agents will operate the same provider-neutral state through WebMCP.

The immediate MVP goal is a coherent, testable device that:

- renders one canonical iPod implementation in both `/_spike/device` and `/composite` rather than maintaining divergent view implementations;
- preserves the working scale of the device and gives its scroll/container surface the full available screen area with enough viewport breathing room for rotation;
- supports free pointer-driven rotation by grabbing the enclosure edges or corners, with a stable physical centre, velocity-based inertia, bidirectional flick completion, and no clipping;
- presents a real DOM LCD through the existing HTML-in-canvas seam;
- navigates Music, playlists, artists, albums, songs, genres, search, nested collections, and Now Playing through one consistent list foundation;
- signs into Apple Music, loads the user's library, starts real playback, and keeps the LCD synchronized with MusicKit's authoritative state.

## Interaction specification

### Click wheel

- Circular wheel movement drives list selection and scrolling with detents and inertia.
- Menu, previous, next, play/pause, and Select are physical buttons.
- Select is the central button; it confirms the highlighted row or current action. It is not a second wheel surface.
- Button audio has a press and release phase. Menu/previous/next/play-pause and Select combine the physical button sound with the click-wheel's digital feedback, matching the supplied real-device recording.
- Pointer handlers must not call `preventDefault()` from passive React Three Fiber events. Browser gesture suppression belongs at the static application boundary through CSS such as `touch-action`.
- Native cursors are the accepted MVP direction. The proposed animated 3D glove/hand feature was explicitly dropped because of the delivery deadline.

### Device orientation

- Default/reload pose is flat, straight-on front—not quarter view.
- The whole model rotates around its actual physical centre without apparent scale or perspective jumps.
- Dragging any physical edge or corner controls orientation; front-face controls retain click-wheel interaction.
- Rotation has velocity-derived inertia. A deliberate flick completes to the opposite side, in either direction.
- Keep breathing room between the model and viewport bounds so edge, quarter, and rear poses are not clipped.
- The old Front/Quarter/Edge/Rear buttons are diagnostic legacy controls, not the intended final interaction.

## LCD and list specification

- `/_spike/device` is the visual/behavioral source of truth for the device presentation. `/composite` should consume the same implementation rather than recreating layout, scale, or list behavior.
- List rows share one geometry, typography, separators, truncation policy, selection treatment, and navigation behavior across root and nested views.
- Eight rows fit the LCD list viewport at the current density. Longer Apple Music collections scroll inside the list pane only.
- Preview/detail panes never own a scrollbar.
- The selected row should use a period-appropriate Aqua highlight, with a considered dark-mode variant.
- The scrollbar should resemble classic Aqua construction, not merely use aqua coloring: a static striped trough/backdrop layer with a separate thumb moving above it. It appears only when content overflows.
- Playlist rows do not show a meaningless count when Apple does not provide a useful count.
- The LCD should render an honest loading state between selection and confirmed playback, a useful error state on failure, and confirmed metadata only after MusicKit identifies the item.

## Apple Music contract established during implementation

webPod currently loads Apple's public MusicKit JS v1 CDN artifact. The verified artifact used during diagnosis had SHA-256 `0ccb2ab37cedaef2eab9c7044c99afdb8c73a122a29ad8b7344af644a15bd14b`.

Verified integration facts:

- The SDK event is `mediaItemDidChange`; `nowPlayingItemDidChange` is absent.
- MusicKit's public `play()` can resolve after the underlying media playback fails. `mediaPlaybackError` is the authoritative failure event.
- The hidden audio element starts unmuted with volume `1`.
- `setQueue().then(play())` is MusicKit's own supported ordering.
- MusicKit has no supported public API for directly prefetching protected audio, manifests, segments, DRM licenses, or blob URLs.
- `setQueue()` starts internal item preparation but resolves before the media is necessarily playable.
- MusicKit manages protected-media preparation and automatically preloads a following queue item during established playback.

Do not reintroduce speculative volume forcing, direct HLS fetching, private SDK methods, or an autoplay workaround without evidence from the current diagnostics.

## Current playback blocker

Apple authorization, library browsing, queue creation, media selection, and protected chunk downloading work. Audible playback still fails in the Codex in-app browser.

The last captured trace established:

```text
setQueue                         12382.7 ms
queueItemsDidChange              12736.7 ms
playCall                         12740.7 ms
mediaItemDidChange               13305.2 ms
playbackStateDidChange           14335.7 / 14352.6 ms
playResolve                      15331.7 ms
bufferedProgressDidChange        17196.8 / 17555.6 ms
```

Final sampled media state:

```text
MusicKit playback state: 0
audio.paused: false
audio.muted: false
audio.volume: 1
audio.readyState: 1       (HAVE_METADATA)
audio.networkState: 2     (NETWORK_LOADING)
audio.error: null
```

No `mediaCanPlay`, `playing`, or advancing `playbackTimeDidChange` event occurred. This proves the stall is after queue construction and item selection, inside media readiness/protected playback. It falsifies zero volume, mute, failure to invoke `play()`, and slow queue construction as the primary problem.

The leading bounded hypotheses are:

1. the embedded browser lacks a compatible EME/CDM implementation (for example Widevine);
2. EME exists but MusicKit's license/key session stalls;
3. MusicKit marks the item unavailable, restricted, or errored before media readiness.

The development-only diagnostics now report verified named/numeric MusicKit states, safe audio lifecycle events, and a non-sensitive EME capability classification. They intentionally never record tokens, URLs, media identifiers, initialization data, license messages, or keys.

### Next decisive validation

1. Hard-refresh `http://localhost:3000/_spike/device?provider=apple` in the in-app browser and capture the new diagnostic output, especially EME classification and item state.
2. Test the same origin, account, queue, and track in normal Google Chrome.
   - Chrome works and the in-app browser stalls: host-specific protected-media support is proven.
   - Both stall: inspect MusicKit item state and DRM/license lifecycle rather than blaming the host.
3. Do not optimize the six-second startup delay until playback reaches `mediaCanPlay`. Current evidence shows a readiness failure, not ordinary buffering latency.

## Startup-latency direction after playback works

Instrument and compare:

```text
selection.accepted
setQueue.started / resolved
queueItemsDidChange
mediaItemStateDidChange
mediaItemDidChange
mediaCanPlay
play.called / resolved
playbackStateDidChange
first playbackTimeDidChange advance
```

Safe optimizations are metadata relationship caching/deduplication, retaining already-rendered collection tracks, keeping one MusicKit instance and queue, and relying on MusicKit's own next-track preloader. Idle-only pre-queueing may be tested only while nothing is playing and only after a stable selection dwell; it replaces the authoritative queue and has no cancellation API, so it must never run on every wheel highlight.

## Important completed decisions

- One provider-neutral navigation path now drives fixture and Apple Music data.
- Collection playback preserves the exact rendered queue and selected occurrence, including duplicate tracks.
- Playback selection is serialized; identical requests coalesce and conflicting in-flight selections do not silently succeed.
- Pending selection, timeout, stale MusicKit events, sign-out, replay, and provider-level media errors have deterministic coverage.
- The click-wheel passive-listener warnings were fixed at both wheel and enclosure interaction surfaces.
- The device reload pose is front-facing.
- List geometry and Aqua styling have received an initial consistency pass, but owner visual approval remains authoritative.
- The branch is intentionally using native cursors; the 3D cursor-hand effort is abandoned.

## Useful entry points

- Apple provider: `packages/providers/src/apple/apple-provider.ts`
- Playback diagnostics core: `packages/providers/src/apple/playback-diagnostics.ts`
- Development diagnostic adapter: `apps/web/src/apple-playback-diagnostics.ts`
- Device route: `apps/web/src/routes/[_]spike.device.tsx`
- Production bridge: `apps/web/src/production-device-view.tsx`
- Panel/navigation: `packages/panel/src/Panel.tsx`, `packages/panel/src/navigation.ts`
- Device orientation/input: `packages/device/src/Device.tsx`, `packages/device/src/click-wheel-input.tsx`
- Composite seam: `packages/composite/src/CompositeDevice.tsx`
- Apple local runbook: `docs/workstreams/002-implementation-spine/apple-local-test-runbook.md`
- Decisions: `docs/workstreams/002-implementation-spine/decision-log.md`
- MusicKit diagnostic evidence: `docs/workstreams/002-implementation-spine/evidence/musickit-diagnostic-contract.md`

## Repository constraints that must survive

- Use `bun`/`bunx` only.
- Never read or expose `cert/` contents; signing remains server-side.
- Never introduce React `useState`; shared Jotai store state must remain externally reachable.
- Access `design.pen` only through Pencil MCP.
- Preserve the real-DOM panel and single orientation/store seams.
- Never force-push or add commit attribution trailers.
- Require deterministic tests, affected-package typechecks, lint, build where relevant, and an independent antagonistic review before claiming a behavioral fix.

