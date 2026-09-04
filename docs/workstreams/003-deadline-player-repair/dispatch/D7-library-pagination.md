# D7 dispatch — complete Apple library pagination

## Objective

Remove the live 25-item ceiling from Apple library loading. The MusicKit v1 facade may return a bare array for `library.albums()`, `artists()`, `playlists()`, and `songs()`; the current adapter treats every bare array as a terminal page, so the runtime's `all()` helper cannot advance beyond the SDK default page.

## Source evidence

- Authorized 2026-09-04 browser replay showed exactly 25 items for every Apple library category.
- `packages/providers/src/apple/apple-provider.ts` currently maps an array response to `next: null` and `total: response.length`.
- `apps/web/src/music-runtime.ts` already follows provider cursors to exhaustion, so the provider must produce a bounded opaque continuation for array-returning facade pages.

The repeated value is strong evidence of an SDK page boundary, not proof of each real collection's total. Do not claim completeness until the implementation and live replay demonstrate traversal past the first page or a terminal short page.

## Required reading and skills

- `/AGENTS.md`
- `../scope.md`, `../review-lanes.md`, and `../completion-audit.md`
- `../../002-implementation-spine/handover-current.md`
- Load `global-patterns` before editing.
- Ground MusicKit behavior in the checked-in/runtime dependency material under `~/code/agentic-context/` and the exact v1 facade already used by this repository. Do not rely on remembered MusicKit v3 behavior and do not switch SDK generations.

## Owned surfaces

- `packages/providers/src/apple/apple-provider.ts`
- `packages/providers/src/apple/apple-provider.test.ts`
- directly associated provider test fixtures
- `apps/web/src/music-runtime.ts` and its tests only if provider-only pagination cannot satisfy the existing contract
- `docs/workstreams/003-deadline-player-repair/diary/d7.md`
- `docs/workstreams/003-deadline-player-repair/evidence/d7-*`

Do not modify playback/queue behavior, diagnostics presentation, panel UI/CSS, certificate/token code, list primitives, gate logic, dependencies, `cert/`, `.neuve/`, or `.neuve-artifact/`.

## Correctness requirements

- Pass an explicit bounded `limit` and `offset` (or exact v1-equivalent parameters supported by the facade) for each library collection request.
- For bare-array responses, issue an opaque provider-owned continuation only when another page might exist; terminate on a short or empty page. An exact-multiple collection may require one empty terminal request.
- Never expose or accept arbitrary URLs/paths as cursors. Each continuation must be issued by this provider instance, single-use under the current cursor contract, and scoped to the collection and offset that created it.
- Preserve structured Music API response pagination when `next` metadata is available; do not regress the current path-based facade translation.
- Preserve stable local identity and order across pages. Do not deduplicate legitimate duplicate library occurrences unless the provider contract already requires it.
- Keep an explicit finite page size and the runtime's existing 1,000-page termination guard.
- If the v1 facade demonstrably ignores offset or repeats a page, detect the non-advancing page and fail safely rather than looping or silently claiming completeness.
- No private MusicKit APIs, token inspection/logging, catalog scraping, or direct media requests.

## Verification

- Deterministic tests cover 25+ items across at least three pages, short-page termination, exact-multiple empty terminal page, cursor single-use/invention rejection, cursor collection scoping, stable identity/order, structured `next` compatibility, and a repeated-page guard.
- Re-run affected tests, provider/app typechecks, lint, full client/SSR builds, and `bun run gates`.
- If the authenticated `webpod-auth` browser session remains available, capture only sanitized item counts proving a collection can exceed 25 or reaches a terminal short page. Do not record titles, identifiers, authorization URLs, tokens, or license/media data.
- Do not commit in the shared tree. Report changed paths, evidence, residual risk, and a proposed path-scoped commit message. Remain available through independent review.
