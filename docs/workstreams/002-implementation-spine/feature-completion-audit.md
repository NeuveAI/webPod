# Feature completion audit

Updated: 2026-09-03

This is the current last-mile ledger for the owner-requested device experience.
Historical review rounds remain useful provenance, but completion is determined
from current source plus the evidence named here.

| Requirement | Current state | Authoritative proof |
| --- | --- | --- |
| One production device view; legacy composite resolves to it without changing scale | Implemented and browser-verified | `apps/web/tests/production-view-parity.e2e.ts`; 3/3 scenarios pass in flagged Chrome. The rejected `rasterScaleMultiplier` path is absent. |
| Canonical list viewport and row for root and all collection/nested views | Implemented and independently approved | `packages/panel/src/list-view.tsx`; `reviews/canonical-list-foundation-review.md`; canonical list unit matrix. |
| Eight rows fill the LCD; overflow only from row nine onward | Implemented and browser-verified | `apps/web/tests/list-scroll-indicator.e2e.ts`; 8/8 has no rail, 42-row Songs has one list-owned rail. |
| Period Aqua selection and fixed striped Aqua scrollbar well with moving thumb | Implemented and browser-verified in both colourways | `packages/panel/src/aqua-material.test.ts`; `apps/web/tests/list-scroll-indicator.e2e.ts`. |
| Scrolling stops silently at the first and last available row | Implemented and reviewed | commit `92e9b00`; `docs/workstreams/002-implementation-spine/evidence/w9a-boundary-clamp.md`. |
| Flush rigid plastic click wheel; subtle contact-following Z tilt without shape warping | Implemented and independently approved | `packages/device/src/control-physics.ts`; `packages/device/src/control-physics.test.ts`; `reviews/w9a-physics-review.md`. |
| Flush plastic Select button; subtle Z travel and no material/colour mutation | Implemented and browser-verified | `CONTROL_TRAVEL.selectMm = 0.12`; `apps/web/tests/screen-select-evidence.e2e.ts`; close crops return exactly to rest after release. |
| Flat LCD opening with black bezel/reveal rather than a chamfer highlight | Implemented and covered by production visual evidence | `packages/device/src/screen-aperture.ts`; `apps/web/tests/screen-select-evidence.e2e.ts`. |
| Wheel detent audio stops at exhausted list boundaries | Implemented and reviewed | commit `92e9b00`; wheel boundary evidence. |
| Select and cardinal buttons produce physical down/up phases plus digital click feedback | Implemented, reference-balanced, independently approved, browser-verified | commits `009fdd2`, `7ed43e2`, `b532d56`; `apps/web/tests/cardinal-audio.e2e.ts`; `reviews/w9b-audio-review.md`. |
| Free device rotation from visible edges/corners; controls and LCD do not steal orientation gestures | Implemented and browser-verified | `apps/web/tests/device-orientation.e2e.ts`. |
| Rotation stays centred and leaves viewport breathing room | Implemented and reviewed | camera-fit/orientation production tests and volumetric device evidence. |
| Velocity-based orientation inertia; fast flick lands on the opposite face | Implemented and browser-verified | commit `4b7e08c`; motion unit suite plus `apps/web/tests/device-orientation.e2e.ts`. |
| Native intent-matching cursors; no custom animated hand | Implemented and independently approved | commits `0f56d9a` through `8371ead`; `apps/web/tests/native-cursor.e2e.ts`. Abandoned glove package and draft evidence removed from the workspace. |
| Provider-driven navigation through playlists, artists, albums, songs, genres, radio, search and nested tracks | Implemented and independently approved | `packages/panel/src/navigation.test.ts`; navigation review chain. |
| Apple Music sign-in states, paginated library/relationships, catalogue search, radio and playback wired to production navigation | Deterministic implementation complete and independently approved | commits `eb7454b` through `6c6bb88`; `reviews/apple-final-wiring-review.md`. |

## Current verification snapshot

- Flagged Chrome interaction suites: orientation/native cursor 11/11; audio,
  list-scroll, route parity and Select visual lifecycle 6/6.
- Repository: 11/11 TypeScript projects, lint, 1,162 tests and all 16 automated
  gates pass.
- Client and SSR production builds pass.
- Fixture and Apple device routes return HTTP 200 from the running dev server.

## Required owner validations

1. **H-10 Apple Music live account run.** Start the server in a private shell
   with the three Apple environment variables described in
   `apple-local-test-runbook.md`, sign in from the production device route, browse
   real collections, start playback, exercise transport, then sign out. The
   current public dev process intentionally returns 503 from the token endpoint
   because it has no private Apple environment.
2. **H-5/U14 phone-in-hand check.** Confirm the wheel remains usable without the
   thumb obscuring critical state.
3. **H-6/U15 visual sign-off.** Inspect black and white devices at the intended
   presentation size and confirm object/material fidelity and unsupported-control
   absence.

## Accepted release constraint

The current volumetric screen path still depends on Chrome's
`CanvasDrawElement` feature flag. `RISK-01` remains accepted in the initiative
tracker: a general unflagged public release requires the separate T3 CSS-3D
overlay work. This does not invalidate the flagged demo build, but it must not be
described as a general-browser release.
