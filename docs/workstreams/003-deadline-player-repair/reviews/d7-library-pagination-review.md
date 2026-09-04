# D7 independent review — Apple library pagination

**Reviewer:** `/root/d7_library_review`
**Date:** 2026-09-04
**Verdict:** **APPROVED**
**Final findings:** **0 Critical / 0 Major / 0 Minor**

## Review scope

Reviewed D7 against `dispatch/D7-library-pagination.md`, repository law, the
`MusicProvider.libraryList()` cursor contract, the unchanged runtime exhaustion
loop, the implementation and tests in the Apple provider, and the sanitized
authenticated-browser result. I did not modify implementation source.

The repository-required `~/code/agentic-context/` checkout is absent on this
machine. I did not substitute remembered or v3 behavior. I independently fetched
the exact public v1 artifact pinned by the repository, verified SHA-256
`0ccb2ab37cedaef2eab9c7044c99afdb8c73a122a29ad8b7344af644a15bd14b`, and
bounded the inspection to its public `Library` facade. The artifact confirms that
`albums`, `artists`, `playlists`, and `songs` all delegate to the same collection
path; a plain object in the first argument position is transformed into `limit`
and `offset`; and the collection limit is capped at 100.

## Initial blocking finding and correction

The first implementation was **not approved**. Live pagination reached a later
album record without the metadata required by webPod's entity contract.
All-or-nothing page normalization threw `Apple album is missing metadata`, which
discarded the real Apple source and exposed the demo fallback. This was a Major
because the new traversal made a valid authorized library unusable.

The correction closes it:

- `InvalidAppleDataError` distinguishes source-data validation failures from
  unrelated runtime faults (`apple-provider.ts:85-137`).
- normalization isolates one invalid record, creates no replacement metadata,
  emits no log, and rethrows non-data failures (`apple-provider.ts:399-410`);
- continuation is decided from the raw page length, not the number of accepted
  entities, so a 100-record page with one omitted record still advances to
  offset 100 (`apple-provider.ts:420-430`);
- the repeat-page fingerprint also uses the raw records' bounded type/id shape,
  preserving the non-advancing guard after item isolation
  (`apple-provider.ts:412-425`).

The deterministic correction test plants 99 valid albums plus one incomplete
record on a full raw page, proves the next request uses offset 100, terminates on
the short page, retains authorization, and observes zero console calls
(`apple-provider.test.ts:111-147`).

## Correctness matrix

| Requirement | Review result |
|---|---|
| Explicit bounded v1 parameters | PASS — all four supported collections receive `limit=100` and `offset=0`; later bare-array requests advance by 100. |
| Bare-array traversal and termination | PASS — 205-item/three-page, short-page, exact-multiple empty-terminal, and malformed-full-page cases are deterministic. |
| Opaque provider cursors | PASS — callers see random provider tokens, never Apple paths; unissued cursors fail. |
| Single use and collection scope | PASS — continuations are deleted on consumption, reject replay and cross-collection use, and are cleared after successful sign-out. |
| Structured `next` compatibility | PASS — Apple `next` remains internal, query parameters are translated through the existing v1 facade, and reported totals survive. |
| Stable identity, order, duplicates | PASS — pages append in response order through the existing identity cache; legitimate duplicate occurrences are not removed. |
| Non-advancing service | PASS — an exact repeated full page at a later offset throws before another continuation is issued; the runtime's existing 1,000-page bound remains the outer guard. |
| Privacy and API boundary | PASS — no private API, direct media request, token inspection, arbitrary caller URL, rejected payload log, or credential path change. |
| Playback isolation | PASS — D7 changes only library normalization/pagination and sign-out cursor cleanup; queue and transport behavior are not part of the slice. |

## Independent verification

Final-tree commands:

```text
bun test packages/providers/src/apple/apple-provider.test.ts
  41 pass / 0 fail / 144 assertions

bun run --cwd packages/providers typecheck
bun run --cwd apps/web typecheck
bunx --bun eslint packages/providers/src/apple/apple-provider.ts packages/providers/src/apple/apple-provider.test.ts
git diff --check -- <D7 paths>
bun run build
  all pass; client and SSR builds complete

bun run gates
  11/11 TypeScript projects
  1,257 tests / 78,548 assertions
  16 automated gates pass / 0 fail
  2 intentional manual gates remain
```

I also repeated the authorized browser check after the correction. A page-side
reduction returned only phase/failure booleans and counts: authorized was true,
library-load failure was false, and the four collection counts were
112 / 271 / 461 / 2,726. No title, provider identifier, authorization URL,
token, license, or media datum was captured. This independently proves that all
four real collections traverse beyond the former 25-item boundary where needed.

## Residual risk

The exact-repeat guard intentionally does not attempt fuzzy overlap detection.
A pathological service returning different but overlapping full pages therefore
runs until the existing 1,000-page bound. This is documented, bounded, and not a
release blocker for the demonstrated v1 behavior.
