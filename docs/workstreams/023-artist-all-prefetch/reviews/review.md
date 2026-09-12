# Review: 023 — Artist All, continuous loading and metadata retention

## Verdict: APPROVE

This renewed disposition follows the real AC/DC failure, corrected root-loading requirement, byte-budget integration and frozen-code live verification. The earlier approval was insufficient and is superseded. Prior findings remain in review-history.md and review-reopened-history.md.

### Correctness Check

- Source of truth: User request and followups; scope.md D1–D10; dispatch.md; decisions.md, decisions-playback.md and cache-budget.md; implementation diaries and evidence. D8 explicitly supersedes the incorrect interpretation that root collections should stop at 15.
- Kanban ticket: Not applicable. Repository law uses workstream documents and has no board.
- Correctness target: All leads each artist album view and preserves album/track ordering. Neighbor preparation retains five-by-five and contiguous first-15 budgets; current/root pages keep loading. Conditional first-30 artist endpoint remains unadvertised on Apple/Spotify because neither exposes equivalent complete artist-song scope. Playlist occurrences survive. Playback starts synchronously with guarded continuation and reconciles authoritative progress snapshots.
- Dispatch scope: Provider, music-management, panel and state surfaces/tests plus workstream documents and a sanitized real-response fixture. No new database, external dependency, credentials, deployment or commits. Existing app route supplies live proof.
- Dependency/HITL status: Real provider failure was captured before fixing normalization. Lead scoped configurable 64MiB estimated relationship retention, split48MiB tracks/16MiB albums with512-entry ceilings; no unjustified1GiB heap allocation. No unresolved scoped owner decision remains.
- Neuve HITL gate: Not applicable; repository law states no Neuve shell or Kanban exists.
- DoD checklist: Revised deterministic, real-response boundary, cache, type/lint and real-browser checks complete. Broad-repository limits below remain explicit; no globally green claim is made.
- Review lanes: Provider data/cursors; continuous source loading and priority; LFU/byte ownership; navigation and WebMCP siblings; playback and lifecycle. All APPROVE after reviewed fixes.
- Type/lint/doc gates: Independently ran final affected suite:907 passed,0 failed,4,334 assertions across45 files. Independently ran root typecheck:14/14 passed; apps/web tsc passed; ESLint across music-management/providers/panel/state source passed; git diff --check passed. No new unsafe type escape, lint suppression or workstream-name leakage found. Installed Jotai contracts and existing provider/Page/Cursor types ground new state and paging use; missing legacy reference paths remain documented.
- Git history/staging: No commits. Intended changes remain separable into provider paging/normalization, shared loading/cache, navigation/state and playback slices with tests. Final inspected status contains intended packages and workstream artifacts.
- Verification evidence: Independently replayed the exact captured AC/DC response through the real Apple provider before and after the fix. Before: Error 'Apple album is missing metadata'. After:all8albums in original order, including Back In Black with parent artist AC/DC and trackCount0, no fabricated artwork, nextnull. Independently checked final tests for continuous first15→complete root loading, foreground/page coalescing, source retirement, transient real Apple cursor retry,513-album LFU ownership, incremental byte accounting, oversized child full/prefix continuation, synchronous playback and navigation lifecycle.
- Decision-log status: Revised behavior and budget rationale recorded. Root/rendered/playback/adapter/media ownership is explicitly outside evictable relationship retention;64MiB is an estimated reusable-metadata budget, not a total heap measurement, allocation or disk quota.

### Findings

- No unresolved Critical or Major findings.
- [INFO] The actual AC/DC response was HTTP200 with8albums and no continuation. One valid empty library album omitted artistName; whole-page normalization threw before publication. Known parent artist context now supplies only the missing label. URL/cursor origin protections remain intact. Previous mocked albums all had artistName, and the earlier three-album spot-check did not exercise this real missing-field shape.
- [INFO] Root hydration now publishes initial15 promptly, then round-robin background pages continue at provider-supported page sizes. Accepted navigation shares in-flight work and can progress another collection without waiting for unrelated background I/O. Failed collection retries keep the last committed cursor; Apple consumes that cursor only after successful validation.
- [INFO] Byte-budget review caught completion being inferred from retained cache presence after oversized child eviction. Request-local loadResult captures completion before release; one active album result survives its flattened slices. Tests use a1-byte retention budget to prove full45-track completion with exactly offsets0/15/30, and a prior evicted prefix needs only one legitimate restart. Pins and accounting restore retention bounds after active owners finish.
- [INFO] Frozen-code live evidence consumed from evidence/live-correction.md: AC/DC All+8albums and completed80songs; automatic root completion112playlists/271artists/461albums/2726songs without category visits; Various Artists40albums via actual successful initial/offset15/offset30 requests, then155songs with loadingfalse. Reviewer inspected acdc-after.png and multi-page-artist-all-after.png. Lead performed the live CUA/DevTools interactions; no live Spotify or audible-playback success is claimed.
- [INFO] Broad root lint still has329 unrelated legacy evidence-script errors. Earlier broad package run had17failures; isolated unchanged failing files reduced to2confirmed failures (missing Node executable and stale legacy route assertion), with other cross-suite interactions unclassified. Whole-root browser/artifact discovery was stopped and its exact generated outputs restored. No broad-root rerun was performed during this reopened correction.
- [INFO] One provider-accepted append cannot be undone; subsequent suffix requests are fenced by account/selection/queue revision and yield between calls for foreground controls. Prior playback recovery proves a concrete missed-observation path rather than a unique diagnosis of every live0:00 symptom.

### Suggestions (non-blocking)

- Keep large real-response and missing-field fixtures in the regression set; do not replace them with all-fields-present synthetic records.
- Profile supported-device memory before raising estimated heap-metadata retention substantially; disk storage quotas do not establish a safe JavaScript heap budget.

### Neuve Dogfood Feedback

- Commands run: None; unavailable by explicit repository law.
- Artifact refs: This review; review-history.md; review-reopened-history.md; scope/dispatch/decisions/diaries; evidence/{verification,live-correction,cache-budget-verification,playback-verification}.md and real-route screenshots.
- Kanban updates: Not applicable.
- HITL gate: No Neuve-routed gate; scoped owner decisions are authorized.
- Signal value: Actual provider response replay falsified the pagination hypothesis; independent integration tests caught oversized-result eviction semantics missed by cache-only tests.
- Sticking points: Initial scope misread the15-entry goal, and earlier live coverage was too narrow. Both are explicitly corrected and covered by real continuation/root-progression evidence.
- Format feedback: Preserve superseded dispositions and failed probes separately from the final verdict.
- Backlog signals: Broad-suite isolation and stale legacy assertions belong in a separate task.
- Feedback artifact: This section records explicit Neuve unavailability under the strict review protocol.
