# Independent review: scheduling and progressive publication

Verdict: APPROVE. No unresolved critical/major finding in the reviewed scheduling lane.

Read responsiveness-scope.md, responsiveness-scheduling.md and team-orchestration/resources/review-protocol.md. Reviewed changed ListViewport/Panel call sites, HTML pixel-source attach/detach/observer/paint chain, Apple relationship pagination and library album acceptance. Worker/picking source changes are outside this verdict. Provider/library additions were explicitly authorized by supervisor and recorded in diary.

Correctness checks:

- Prepared windows retain absolute row indices, current-row IDs, selected flags, global count and scroll rail. All four updated production callers pass rowsStart equal to the sliced window origin; unchanged callers use full-list defaults. Queue cursor/window semantics are preserved; glyph numbering uses absolute index.
- The pixel source synchronously fits/requests initial content, keeps one pending observer frame, and uploads/invalidates on delivered paint. Removing pre-paint texture invalidation does not remove the delivered paint's immediate invalidation. CSS marquee animation remains unchanged. Resize, mutation and DPR observations all feed fit requests; resize-to-new-width behavior is exercised.
- Hidden state cancels a queued frame while retaining dirty work; foreground reschedules. Detach cancels scheduling and disconnects document/observer/resolution/transform listeners. Captured generation guards reject detached paint/flush work. No new continuously running rAF loop or delayed provider command path.
- Final relationship completion returns the last cumulative published snapshot only when onPage was called; standalone requests still return all results. Abort checks remain before/after network and before accepting snapshots. library dedup checks current lifetime first; intermediate pages still publish. It deduplicates identity, not array length, so arbitrary provider replacements remain accepted. Existing API readonly snapshot contract is preserved.
- The changes do not attempt unsafe caching of mutable SDK queue arrays, alter transport activation order, suppress semantic playback progress events, or move browser SDK/DOM work to workers.

Independent commands executed: panel, providers, music-management and composite package typechecks all pass; scoped eslint for all five changed files passes. Re-ran retained lcd-batching.ts experiment successfully: synchronous attach,1 frame/1 paint request/2 dimension reads per observer burst,0 reads and immediate invalidation on received paint, raster400 after resize, hidden/disposal cancellation. Reviewed existing380-test evidence rather than claiming a second full execution. No new unit tests added.

Limits: no measured browser frame-time improvement asserted. Infinite marquee can still cause full scene renders via native paint; removing that visual behavior is outside this lane. First paint/context restoration and real-device feel remain integrated browser validation responsibilities. The current proposal is stageable as bounded list/LCD work and separate duplicate-final-publication change.
