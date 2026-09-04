# D6 independent review — playback error presentation

**Date:** 2026-09-04
**Reviewer:** `/root/d6_error_review`
**Verdict:** approved
**Counts:** 0 Critical · 0 Major · 0 Minor

## Scope and evidence reviewed

Reviewed D6 against `dispatch/D6-playback-error-presentation.md`, repository law, and the owner trace whose terminal state is EME `neither-supported`, audio error code 4, `mediaPlaybackError`, then later paused/none notifications.

Independently inspected every D6 image:

- `evidence/d6-error-baseline.png`
- `evidence/d6-error-dark-272x204.png`
- `evidence/d6-error-light-272x204.png`
- `evidence/d6-error-dark-200-percent.png`
- `evidence/d6-error-light-200-percent.png`
- `evidence/d6-apple-error-retry.png`

The baseline has the reported absolute-position collision. Both after colourways and both 200% product Dynamic Type captures retain artwork, title, artist, album, source, progress, times, and a single readable status shelf. The shelf does not collide with another region and does not depend on colour alone. The established period-Aqua direction is treated as the explicit override to generic no-gradient guidance.

## Findings

No open findings.

### Resolved Major

`apps/web/tests/playback-error-presentation.e2e.ts:98-123` now installs an explicit `/api/apple/developer-token` interception before navigation, returns a bounded safe 503 response, asserts the first request, invokes `Retry Apple Music`, and asserts the second request. The re-review run produced two expected client-side 503 messages from the intercepted responses and passed without consulting local credentials or the signing key.

### Resolved Minor

`apps/web/src/routes/[_]spike.device.tsx:389-392,518-541` scopes a dedicated retry class to `min-block-size: 44px` at widths up to 520px. The base rule remains 36px, so desktop controls retain the approved compact geometry while the recovery action meets the mobile/touch guardrail.

## Required-behaviour audit

- **Mutual exclusion / collision:** pass. `Panel.tsx` renders either `.wp-actions` or `PlaybackStatus`; `.wp-status-shelf` is a grid row and has no absolute positioning. Independent Playwright geometry found zero intersections and zero shelf overflow.
- **Retained content:** pass. Unit, mounted integration, browser geometry, and screenshots retain song identity, artwork, source, queue position, progress, and duration through pending/failure.
- **Both colourways / 200% product setting:** pass. Dark and light captures remain legible at canonical 272×204 logical geometry and the repository's 200% Dynamic Type input (`airy`, 1.25 raster cap).
- **Accessible semantics:** pass. Pending/failure use a text label plus hidden decorative icon, one atomic polite status region, and forced-colour/reduced-transparency branches. Normal actions are absent during shelf states.
- **Permission/offline/agent/success geometry:** pass by deterministic render contract. Each uses the same shelf and excludes `.wp-actions`; no long label exceeds the reserved line in the covered states.
- **Causal diagnosis:** pass. The reducer consumes the full bounded sanitized history; the exact later-paused live sequence remains `protected-media-unsupported` with causal sequence 3 in the deterministic reproduction.
- **Diagnosis vocabulary and safety:** pass. Autoplay, network, decode/source, DRM/entitlement, protected-media unsupported, none, and unknown remain closed typed outcomes. Rendered diagnostics expose only closed event/state names and finite media-state numbers; hostile raw strings are classified but never retained.
- **Exact EME guidance:** pass. `neither-supported` plus audio code 4/media failure reports that protected Apple Music audio is unavailable, explicitly preserves library/art truth, and recommends a DRM-capable normal browser.
- **Progressive disclosure:** pass. One causal headline and next action stay visible; numeric tables and the event list remain under `details`, with causal and latest-follow-up events separately marked.
- **Retry copy:** pass. Runtime `error` shows `Retry Apple Music` and demo fallback without claiming the user must sign in. Its browser proof is isolated from local credentials and exercises both the initial attempt and retry.

## Independent verification

- `bun test apps/web/src/playback-diagnostics-view.test.tsx apps/web/src/apple-playback-diagnostics.test.ts packages/panel/src/Panel.test.tsx packages/panel/src/Panel.integration.test.tsx` — 49 pass, 0 fail.
- Fresh temp-directory Playwright run of `playback-error-presentation.e2e.ts` — 3 pass, 0 fail; the corrected Apple scenario uses an intercepted 503 and is independent of local credentials.
- `bun run typecheck` — 11/11 clean.
- `bun run lint` — clean.
- `bun run build` — client and SSR clean; existing >500kB chunk advisory only.
- `bun run gates` — 1,257 tests, 0 fail, 78,548 assertions; 16 automated gates pass, 2 repository-manual gates remain.
- `git diff --check -- <D6 paths>` — clean.

## Correction re-review

- Fresh temp-directory Playwright rerun after corrections — 3 pass, 0 fail.
- The intercepted retry scenario proves token request counts `1 → 2`, keeps `Retry Apple Music` visible after the second bounded failure, preserves the demo fallback, and excludes false sign-in copy.
- The small-screen browser assertion measures the retry control at least 44px. Source-cascade inspection confirms the override is restricted to `max-width: 520px`; desktop remains at the unchanged 36px base size.
- Focused unit/integration rerun — 49 pass, 0 fail.
- Final focused `git diff --check` — clean.

## Approval condition

D6 is **approved** with 0 Critical, 0 Major, and 0 Minor findings. The corrections close both original findings without changing authentication behavior or widening the implementation surface.
