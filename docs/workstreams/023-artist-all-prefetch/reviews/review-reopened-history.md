# Review: 023 — Reopened artist paging and background loading regression

## Verdict: REQUEST_CHANGES

The previous approval is superseded by the user's real AC/DC failure and clarified loading behavior. Investigation and revised implementation review are active; the earlier disposition is retained in review-before-reopen.md and is not current approval.

### Correctness Check

- Source of truth: User reports artist All plus album-loading error and root collections remaining at 15; clarifies 15 is an initial render prefix, with continuing background loading of current/root pages.
- Scope: Lead revising the same workstream and branch. Read-only review diagnoses real provider paging and then reviews fixes. No broad-root test rerun, commits, credential access or unsupported memory-budget assumptions.
- Prior evidence limitation: Synthetic paging tests asserted the incorrectly scoped demand-only root policy. Live spot-check used an artist with three albums, so it never exercised a real artist continuation. The first-page relationship implementation validates next before publishing items; a real next path/origin mismatch can discard an otherwise valid first page.

### Findings

- [MAJOR] Root background loading was intentionally stopped after its first 15 entries under an incorrect interpretation of the requested prefetch budget. Revised correctness requires an immediate prefix plus continuing background synchronization, with accepted navigation retaining priority.
- [MAJOR] User-observed AC/DC artist screen cannot retrieve its albums. Exact provider error/path is under investigation; no speculative root cause is claimed yet. Current hypotheses prioritize next URL validation before first-page publication, then raw resource validation/typed SDK behavior.

### Verification pending

Require a sanitized real failing continuation/error capture, regression fixtures reproducing its real shape, complete background-drain behavior with priority/cancellation, revised cache-budget evidence, and independent affected tests/type/lint plus live large-artist paging verification.

### Proven provider cause

Independent read of the safe captured response `/tmp/webpod-acdc.network-response` found 8 ordered library albums, meta.total=8 and no next page. Back In Black alone has a name and trackCount=0 but lacks artistName/artwork. Replaying that exact response through the real Apple provider with the existing fake MusicKit boundary reproduced `Error: Apple album is missing metadata`. Normalization throws before any first-page item is returned. The next-URL hypothesis is falsified for this report; guards must not be relaxed to fix it. Regression evidence must retain all 8 using only known parent context for the missing artist label and preserve valid empty-album semantics.

D8–D10 consumed: restore continuing root/current-page background loading; require actual failing-flow provider/live evidence; configure estimated retained relationship bytes (64MiB split48/16,512-entry ceilings), with active-operation correctness and documented unaccounted root/rendered/playback ownership. This is not a total heap or disk limit.

### Reopened cache integration finding

- [MAJOR] Byte eviction makes artist flattening lose the completion status of a returned album (library.ts tracksForArtist's `trackPages.complete` after awaited child load). D10 allows an oversized accepted result to return successfully and leave retention on final release. The flatten caller then sees cache miss as incomplete, repeatedly reloads that album and eventually fails on a non-advancing cursor. Independent real Relationships probe with maxBytes700 returned three complete tracks while `complete('album')` was false and retained entries zero. Carry request-local completion state independently of retention; test oversized child full All and prefix continuation under a small configured budget. Sent to both owners.
