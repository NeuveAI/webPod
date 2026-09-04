# D3 integration evidence

**Date:** 2026-09-03
**Working tree:** post-D0/D1/D2 implementation and review corrections, uncommitted shared tree

## Browser provenance

- Installed browser driven through the repository browser workflow with `CanvasDrawElement` enabled.
- Route: `http://localhost:3003/_spike/device?provider=fixture` from a fresh Vite process using `.env.local`.
- Composite reached the live T1 DOM-in-canvas path: the browser accessibility tree exposed the embedded `webPod music player` application and its list/options.

## Fixture navigation and presentation

- Music root exposed exactly eight visible categories.
- Keyboard focus plus ArrowDown and Enter navigated from Albums into Songs.
- Songs exposed exactly eight visible rows in the viewport; the selected row had correct accessible title/artist data.
- Enter opened Now Playing for the selected occurrence. The UI exposed `1 of 42`, title `Syndicate`, artist `The Fray`, album `The Fray`, duration `3:45`, progress, and playback controls.
- Captures:
  - `d3-fixture-flagged.png`
  - `d3-fixture-now-playing.png`

## Apple authentication boundary

- Switching to Apple Music produced an honest signed-out screen and a `Sign in to Apple Music` button instead of a token-service failure.
- A sanitized direct request to `/api/apple/developer-token` returned HTTP 200 with only the expected `token` and `expiresAt` fields. The check reported field presence/types only and did not print either value.
- Capture: `d3-apple-sign-in.png`.
- A dedicated visible Google Chrome session named `webpod-auth` was launched with the required CanvasDrawElement flag. Invoking sign-in reached Apple's authentic account-login page and left it ready for owner input; no account field was read or populated by an agent.
- Capture: `d3-apple-login-ready.png`. The capture contains only the empty Apple login form and no account data or authorization values.

## Remaining owner validation

- Complete the interactive Apple sign-in in the visible `webpod-auth` Chrome window.
- Open a real library track and confirm that metadata/artwork remain visible during pending playback and any protected-media failure.
- Compare the same track in normal Chrome and the embedded browser to classify any remaining DRM/EME host limitation.
- Approve the black/white visual direction.

No credential contents, token values, media URLs, or media identifiers were captured in this evidence.
