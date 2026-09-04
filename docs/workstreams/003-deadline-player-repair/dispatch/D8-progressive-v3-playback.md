# D8 — Progressive Apple hydration and MusicKit v3 playback

## Objective

Remove the full-library pagination chain from the sign-in critical path and restore protected playback using Apple's current supported MusicKit on the Web surface.

## Correctness conditions

- An authorized listener can use the first page of every primary collection without waiting for the full songs library.
- Later pages update the current root or top-level collection without resetting the navigation stack or moving the highlight.
- Counts are exact only when pagination completes; otherwise they are visibly lower bounds.
- Stale mode/session operations cannot mutate the visible live source.
- MusicKit v3 loads despite Vite's browser `process` shim, while the shim is restored after SDK evaluation.
- Personalized API requests use v3's generic `api.music` surface, with the legacy facade retained only as a tested fallback.
- Playback completion is driven by v3's documented now-playing event.
- Browser EME diagnostics test temporary AAC/CENC playback, not persistent-license storage.
- No token, credential, private library item, or request URL is recorded in evidence.

## Verification

- DevTools before/after navigation traces and safe request counts.
- Live authorized library replay.
- Live v3 queue/play replay with advancing playback time.
- Focused runtime, navigation, provider, and diagnostic tests.
- Full typecheck, lint, build, test, and repository gates.
