# Current handover — deadline player repair

**Updated:** 2026-09-04
**State:** implementation, live MusicKit v3 validation, and automated gates complete; owner visual approval remains.

## What changed

- The Apple developer-token signer now reads the runtime-configured key path in both Node and Bun. Relative values are normalized from the repository root; no shipped key path default exists.
- Signer and env normalization have deterministic regression coverage. Synthetic signing material is generated at test runtime and does not place credential-shaped literals in source.
- Selecting a track preserves the exact rendered queue occurrence immediately. Now Playing retains the song's metadata/artwork through loading, promise rejection, timeout, and authoritative provider errors.
- Confirmed playback state cannot be borrowed from a duplicate occurrence of the same catalog song.
- A stable row selection begins metadata/artwork prefetch at 700 ms. Apple queue preparation uses only public MusicKit behavior, runs only while idle, and verifies/invalidate its queue identity before reuse.
- Apple-backed preview art/data no longer fall through to fixture imagery or invented counts; missing live art has a neutral state.
- List typography, Aqua selection, and scroll construction were compacted while retaining eight rows and accessibility preference behavior.
- Static quality gate U8 now distinguishes typed development diagnostics from forbidden product autoplay behavior through a narrow AST/path/symbol rule. The gate runner uses a tested 30-second per-test ceiling for the Git-fixture cases.
- The Now Playing failure state uses a reserved grid row instead of absolute copy over the action icons. Artwork, metadata, queue position, progress, and duration remain primary; pending and failure states are concise and accessible.
- Development diagnostics derive a safe causal summary from the full bounded trace. A later paused/none event no longer hides the original EME/media error, and environment guidance stays outside the LCD.
- Apple library collections traverse both structured MusicKit v3 responses and the legacy array facade with explicit bounded limit/offset cursors. Typed malformed resources are isolated instead of aborting authorization/library hydration.
- Authorization now waits for only the first page of playlists, artists, albums, and songs. The remaining pages stream into one subscribed navigation source without resetting the listener's current screen; incomplete menu counts are rendered as truthful lower bounds.
- The provider now loads Apple's current MusicKit v3 script, uses its generic API request surface, and listens to the documented `nowPlayingItemDidChange` event. The Vite browser `process` shim is hidden through SDK evaluation and configuration, then restored immediately afterward.
- The EME diagnostic now probes the temporary AAC/CENC playback configuration actually needed by browser playback instead of requiring persistent-license support and falsely reporting this Chrome session as unsupported.
- Apple runtime errors expose an explicit `Retry Apple Music` action plus the demo fallback; the retry test intercepts its synthetic token failure and does not depend on local credentials.
- Track playback bounds MusicKit queues to 100 items around the selected occurrence, retains full-library queue position, and normalizes singular v3 media types such as `song`.
- A provider progress clock keeps LCD elapsed time synchronized when MusicKit omits time-change events.
- Returning to the Music root pauses active or pending playback. A successful Play/Pause press returns to Now Playing, and switching to the demo provider pauses Apple before replacing its controls.
- Sanitized playback telemetry now records queue/play resolutions and failures, retains causal events ahead of repetitive samples, supports one-click copy, and exposes a stable development-only browser diagnostic hook.

## Verification snapshot

- Full suite: **1,273 passed / 0 failed** (78,592 assertions).
- TypeScript: **11/11 projects clean**.
- Lint and client/SSR builds: clean.
- Quality gates: **16 automated passed / 0 failed / 2 intentional manual gates**.
- D0 certificate review: 0 Critical / 0 Major / 0 Minor.
- D1 playback review after correction: 0 Critical / 0 Major / 0 Minor.
- D2 visual review: 0 Critical / 0 Major / 1 Minor test-harness portability gap.
- D5 static-gate review: 0 Critical / 0 Major / 0 Minor.
- D6 playback-error review after correction: 0 Critical / 0 Major / 0 Minor.
- D7 library-pagination review after correction: 0 Critical / 0 Major / 0 Minor.
- Flagged Chrome T1 integration: Music → Songs → Now Playing works with correct fixture title, artist, album, occurrence, duration, and controls.
- Live token endpoint on port 3000: sanitized HTTP 200 check with the expected response fields; no values printed.
- Fresh browser session: Sign in control is present and reaches Apple's account flow; no credentials were entered.
- Existing authorized session: full library hydration succeeds at 112 playlists, 271 artists, 461 albums, and 2,726 songs; no private item data was recorded in evidence.
- DevTools baseline: the shell LCP was 343 ms, but the previous all-or-nothing runtime took about 26.2 seconds to expose the authorized library while 38 collection pages completed.
- DevTools progressive replay: a final cache-bypassed run reached the usable authorized root in 1.84 seconds; later pages continued in the background.
- DevTools protected-playback replay: MusicKit entered playing state 2 with a 96-item playable queue; MusicKit and the LCD advanced from 0:00 to 0:11 with no failure diagnosis.
- DevTools transport replay: returning to root paused MusicKit; Play/Pause resumed and reopened Now Playing; switching to demo data left MusicKit paused.

## Owner validation now

1. Approve or annotate the black/white D6 captures and the existing Aqua captures in `evidence/`.
2. If demo presentation time permits, do one owner-operated smoke test of the physical wheel on the target display/browser.

## Known bounded remainder

- Exact “first 5–6 seconds cached” is not a supported or observable MusicKit contract. The implementation provides the safe equivalent: low-priority data/artwork prefetch and idle public-queue preparation after 700 ms.
- The repeated `THREE.Clock` warning is from stable `@react-three/fiber@9.7.0`. Fiber 10's replacement scheduler is alpha-only, while downgrading Three removes the required HTMLTexture path. The warning remains until a compatible stable Fiber release; it is not suppressed.
- The production-device scrollbar Playwright helper still has a CanvasDrawElement attachment portability gap. Direct installed-Chrome checks cover the actual D2 UI behavior.
- All work remains uncommitted in the shared working tree. `.neuve/` and `.neuve-artifact/` remain untouched and untracked.
