# Review: canonical panel list foundation

## Verdict: APPROVE

### Correctness Check

- Source of truth: repo law, `scope.md`, `dispatch/navigation-interaction.md`, `decisions/navigation-interaction.md`, `decisions/navigation-list-foundation.md`, `dependency-graph.md`, and the owner-rejection entry in `diary/navigation-interaction.md` were loaded. Repo-level `docs/decisions.md` and `docs/platform_decisions.md` do not exist; workstream decisions D-002, D-009, N-1 through N-3, and the canonical-list decision apply.
- Kanban ticket: not applicable by owner decision D-002; `docs/workstreams/002-implementation-spine/tracker.md` is the queue.
- Correctness target: one real reusable list viewport/row implementation across root, Playlists, Artists, Albums, Songs, Genres, Radio, Search, and nested tracks; fixed eight-row default geometry, rail from row nine, exact-once typed navigation, selection-related preview content, shared state geometry, and no aesthetic-approval claim.
- Dispatch scope: committed range `703bca2^..ea95800` stays inside panel implementation/tests and the navigation workstream docs/evidence. No Apple, server, device, camera, or cursor implementation is changed.
- Dependency/HITL status: U14 and H-6/U15 owner visual validation remain open and are not waived by this review.
- Neuve HITL gate: not applicable; repo law and D-002 say no Neuve shell or board exists.
- DoD checklist: automated list-foundation checks are green, named deterministic sibling coverage is complete, and owner visual approval remains open.
- Review lanes: fresh independent frontend/list-foundation review completed with strict critique, interface critique, current Web Interface Guidelines, Jotai, router/form, shadcn, and React performance guidance loaded. The five committed `/_spike/device` screenshots were inspected at original resolution.
- Type/lint/doc gates: focused 49-test panel set passed; panel TypeScript and scoped ESLint passed. Public list exports have useful contract comments. No `useState`, unsafe `any`, lint disable, or surviving bespoke row/list selector was found in the changed implementation.
- Git history/staging: three coherent commits with intent-only subjects and no trailers; `git show --check` is clean.
- Verification evidence: the initial review independently passed the full panel Playwright suite 16/16. After `ea95800`, the focused panel suite passed 49/49, panel TypeScript passed, and scoped ESLint passed. The five screenshots show consistent default row height, separators, and selected Aqua material for Playlists, Artists, Albums, Songs, and nested tracks.
- Decision-log status: the route-identity and canonical-list decisions are recorded and the corrected named test matrix now substantiates the collection-family coverage claim.

### Findings

- [INFO] `ea95800` resolves the three blocking findings. Every optional row cell now owns an explicit grid column (`packages/panel/src/panel.css:133`), loading consumes the viewport's canonical visible-row property (`packages/panel/src/panel.css:224`), and the deterministic table explicitly constructs root, every root collection, Search entry/results, artist and genre descendants, album tracks, and playlist tracks (`packages/panel/src/list-view.test.tsx:42`).
- [INFO] No Critical, Major, or Minor findings remain in the reviewed range through `ea95800`.

### Suggestions (non-blocking)

- Preserve the named route-family matrix as new browse routes are introduced so generic-renderer claims remain inspectable rather than implicit.

### Neuve Dogfood Feedback

- Commands run: none; Neuve is explicitly unavailable and prohibited as this repo's tracker by repo law and D-002.
- Artifact refs: `docs/workstreams/002-implementation-spine/tracker.md`, `decision-log.md` D-002.
- Value add: not applicable.
- Sticking points: none; the documented workstream tracker supplied the required process context.
- Format feedback: not applicable.
- Backlog signals: none.

### Owner Gates

- U14 phone-in-hand occlusion validation remains open.
- U15/H-6 owner visual/aesthetic approval remains open. This review does not claim or substitute for aesthetic approval.
