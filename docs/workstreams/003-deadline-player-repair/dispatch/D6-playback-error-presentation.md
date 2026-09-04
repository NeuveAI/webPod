# D6 dispatch — playback error presentation

## Objective

Turn the live Apple playback failure into a legible, accurate two-level experience:

1. the 272×204 LCD keeps real artwork and song metadata primary and uses a compact reserved status shelf instead of overlapping the transport icons;
2. the development diagnostics identify the causal failure in plain language while retaining the technical timeline for investigation.

## Source evidence

- Owner capture supplied 2026-09-04 and `evidence/d6-error-baseline.png`.
- Live authorized replay: `Natural Born Killer` by Avenged Sevenfold, queue occurrence 4 of 20, correct `Nightmare` artwork; playback ends with EME `neither-supported`, audio error code 4, `mediaPlaybackError`, and paused/none state.
- Existing behavioral contract and approved D1 implementation remain authoritative: playback failure must never erase or replace selected song identity.

## Design critique translated to requirements

- The current `.wp-state-note` is absolutely positioned at the bottom of `.wp-now-body`, directly on top of five action icons. The result has no readable hierarchy and creates apparent controls that cannot resolve the failure.
- The generic instruction “try again” is false guidance for a browser lacking compatible protected-media support.
- The developer panel displays the final state-change event as “Latest,” leaving `Error class —` even though an earlier error event and the audio element contain the causal signal.
- Correct hierarchy is: song identity → concise playback status → optional recovery guidance → technical trace on disclosure.

## Required reading and skills

- `/AGENTS.md`
- `../scope.md`, `../review-lanes.md`, `../completion-audit.md`
- `../../002-implementation-spine/handover-current.md`
- Load `global-patterns`, `modern-web-guidance`, `interface-craft` design critique, `interface-design-guardrails`, and `web-design-guidelines` before editing.
- The product's period-Aqua direction overrides generic “no gradients” guidance. Do not redesign the approved D2 list material.

## Owned surfaces

- `packages/panel/src/Panel.tsx`
- `packages/panel/src/panel.css`
- directly associated panel tests
- `apps/web/src/apple-playback-diagnostics.ts`
- `apps/web/src/apple-playback-diagnostics.test.ts`
- `apps/web/src/routes/[_]spike.device.tsx`
- directly associated route/browser tests
- `docs/workstreams/003-deadline-player-repair/diary/d6.md`
- `docs/workstreams/003-deadline-player-repair/evidence/d6-*`

Do not modify provider queue/playback behavior, certificate/token code, list primitives, gate logic, dependencies, `cert/`, `.neuve/`, or `.neuve-artifact/`.

## Mandatory LCD behavior

- Preserve artwork, title, artist, album, source, queue position, progress, and duration during failure.
- Remove the absolute long-copy collision. The final grid row must contain either the normal `.wp-actions` group or one reserved status shelf, never both.
- Pending uses a non-alarming compact status (`Preparing playback…`) with `role="status"` / polite semantics.
- Failure uses an icon/shape plus a short headline such as `Playback unavailable`; it must not rely on colour alone. A subordinate recovery hint may use a second line only if it fits without collision.
- Do not tell the user to retry when the known diagnosis says this browser cannot provide protected-media playback. Keep the LCD copy generic enough for provider failures; put environment-specific guidance in the diagnostic panel.
- Permission, offline, and agent states must use the same reserved geometry or remain provably non-overlapping.
- Retain usable contrast in both colourways, forced colours, reduced transparency, and 200% text zoom. Do not introduce a modal or toast over the LCD.

## Mandatory diagnostic behavior

- Derive a typed safe diagnosis from the full bounded event snapshot rather than only `events.at(-1)`.
- When EME is `neither-supported` or unavailable and the failure chain contains `mediaPlaybackError` or audio error code 4, summarize: protected Apple Music audio is unavailable in this browser; library data and artwork are still functioning; recommend a DRM-capable normal browser.
- Preserve distinct safe summaries for autoplay, network, decode/source, DRM/entitlement, and unknown failures.
- Never expose raw errors, tokens, URLs, item identifiers, license data, or media keys. Use only the existing closed vocabularies and numeric media-element state.
- The top of the developer panel should show one causal headline and one next action. Keep raw state tables/timeline behind progressive disclosure and visually distinguish the causal event from merely latest follow-up state.
- Announce the summary once without making every diagnostic event a live-region interruption.

## Verification

- Deterministic tests cover mutual exclusion of status shelf/actions; retained metadata/art; short pending/failure copy; safe accessible semantics; permission/offline variants; and no absolute overlay rule.
- Diagnostic tests cover the exact live sequence (EME neither-supported, audio code 4, later paused event), plus autoplay, network, and unknown controls. The later state event must not erase the causal diagnosis.
- Browser evidence at the canonical 272×204 LCD proves no intersection between status shelf, progress/times, metadata, and artwork in both colourways and at 200% text zoom.
- Re-run affected tests, all 11 typechecks, lint, client/SSR builds, and `bun run gates`.
- Do not commit in the shared tree. Report changed paths, evidence, residual risk, and a proposed path-scoped commit message. Remain available through independent review.
