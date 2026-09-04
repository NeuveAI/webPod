# D8 performance and playback evidence

No token values, authorization URLs, request payloads, private item metadata, or account identifiers are included here.

## Baseline

- Chrome DevTools, authorized route, cache-bypassed reload.
- LCP: 343 ms; CLS: 0.
- Time until the app exposed the authorized library: about 26.2 seconds.
- Fetch/XHR requests observed: 41 total, including 38 collection pages (2 playlists, 3 artists, 5 albums, 28 songs).
- Conclusion: document rendering was not the delay. The runtime awaited complete pagination before publishing the authorized source.

## Progressive replay

- Same route/session and DevTools browser, cache-bypassed reload after the progressive-source change.
- Navigation call completed in 0.9 seconds with `Apple Music: authorized` already present.
- LCP: 477 ms; CLS: 0.
- Remaining cross-origin Apple requests continued for roughly 11 seconds without gating the authorized UI.
- Unit coverage proves later pages append to the same source, update completion posture, and notify subscribers.
- A final cache-bypassed authenticated reload reached the usable authorized root in **1.84 seconds**. Later collection pages continued updating lower-bound counts in place.

## MusicKit v3 compatibility

- Loaded the official v3 SDK in the same Chrome runtime and observed version `3.2526.0-prerelease.x` on 2026-09-04.
- MusicKit v3 classifies any browser `globalThis.process` object as Node. The Vite shim therefore has to be hidden through both SDK evaluation and `MusicKit.configure()`; the app restores the exact original descriptor afterward.
- A safe public-catalog probe through `api.music` returned the expected nested response structure.
- The app now loads v3, routes API requests through `api.music`, and binds `nowPlayingItemDidChange`.
- Large library selections now queue a bounded 100-item window around the selected occurrence rather than passing thousands of songs to one `setQueue` call. The public queue index is translated back to the complete rendered list.
- MusicKit v3's singular media item types are normalized to the provider contract, and a 250 ms provider clock keeps progress moving when the SDK omits time-change events.
- Live authenticated playback succeeded in the DevTools Chrome session. The protected audio element reached ready state 4, MusicKit entered playing state 2, and the LCD advanced from 0:00 to 0:11 while its progress value reached 52%.
- The successful transaction queued 100 requested items; MusicKit retained 96 playable items and confirmed a current item. No playback-failure diagnosis was raised.

## Transport ownership replay

- Navigating from Now Playing back to the Music root paused the underlying MusicKit instance: `isPlaying` changed to false and playback state changed to paused.
- A pause during an unresolved `play()` transaction cancels that provider transaction and applies a final pause after the SDK promise settles, preventing delayed hidden playback.
- Pressing the physical Play/Pause keyboard equivalent from the root resumed MusicKit and returned the LCD to Now Playing.
- Switching from Apple Music to the demo library paused MusicKit before replacing the visible provider. A failed pause now prevents the switch, so live Apple audio cannot be left without visible controls.
- Development telemetry remains identifier-free and is available through the disclosure UI, its copy action, and `window.__webpodApplePlaybackDiagnostics`.

## Automated result

- Tests: 1,273 passed, 0 failed, 78,592 assertions.
- TypeScript: 11/11 projects clean.
- Lint: clean.
- Client and SSR builds: clean (existing chunk-size advisory only).
- Gates: 16 automated passed, 0 failed; 2 intentional manual gates remain.

## Primary references

- Apple MusicKit on the Web v3 getting started: <https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=/story/get-started--page>
- Apple MusicKit v3 instance reference: <https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=/story/reference-javascript-musickit-instance--page>
