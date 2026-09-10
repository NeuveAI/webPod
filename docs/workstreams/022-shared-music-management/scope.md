# Shared music management scope

Status: Complete — implementation and both independent review lanes approved; changes remain local on the workstream branch.
Base: main 36f0b9724954, deployed and working. Branch: codex/shared-music-management.

## Correctness target and source of truth
The user's request is primary: one common music-management library, Spotify and Apple adapters, a uniform experience, especially queue and playback ownership, with strict API-specific tests while preserving currently working behavior. This is a behavior-preserving refactor, not a new playback engine or feature expansion.

Current source and tests at the base commit are the behavioral regression baseline. Official API/SDK documentation and installed declarations are authoritative for transport capabilities and data shape; record exact sources in provider-contracts.md. Current hand-written provider interfaces are smaller application models, not claims of complete SDK definitions. Prior chat bugs define concrete regressions to guard. Unrelated workstreams and their process details are not assigned sources. Repo AGENTS.md overrides generic skill assumptions: no Neuve, no Kanban, bun only, no useState, no credentials in transcripts, no access to cert or design.pen.

## Required ownership boundary
- A shared workspace music-management library is the application-facing owner of playback command ordering, accepted playback intent, selected occurrence, known queue context/index/total, normalized playback observation reconciliation and lifecycle cleanup.
- Spotify/Apple adapters own SDK/HTTP calls, data validation and normalization, native event subscriptions, native readiness/confirmation semantics, provider pagination cursors, relinking identity translation and native capability limitations. They must not independently implement application presentation/queue policy that the common library also owns.
- Production UI, clickwheel/keyboard and tool commands must enter the same managed instance. A facade that merely adds another state machine while leaving production queue ownership split is not sufficient.
- React may retain presentation selectors, memoized counter leaves, navigation and scrub-preview state; common playback/queue truth and transport ordering must not depend on mounted React closures. Jotai store is the shared state mechanism.
- Shared browsing orchestration must use neutral naming and the same progressive library/relationship path for both adapters. No provider-specific UI playback branches.
- Capability differences remain honest. Uniform experience does not mean inventing Spotify queue removal/reorder, lyrics, stations, or full queue history. Unknown remote positions must remain unknown when unprovable; exact locally selected positions must appear immediately.

## Acceptance criteria
1. Selecting any known track list (album, artist album, playlist, Songs, genre, search) immediately exposes selected occurrence and known total plus available metadata/art, before asynchronous transport completion.
2. Confirmed playback updates title, artwork, progress and status on native events and supported recovery observations; late observations/commands from a prior selection or retired provider cannot replace current intent/state. Duplicate tracks must be distinguished by occurrence, not only ID.
3. Next/previous, natural advancement, pause/resume, paused seek-and-resume, shuffle/repeat, append and supported queue actions use one common command policy. Preserve normal progress updates, clamping and cleanup. Do not pretend a resolved play promise is necessarily audible playback.
4. Queue reads cannot reset the current counter to 1, erase a known submitted context, blink the counter shell, or replace fresher state when completing late. Current-position-only updates keep the total and 'of' DOM nodes stable while the context remains unchanged. A new queue may legitimately change the total.
5. Provider changes, logout and manager disposal stop listeners/timers and reject or ignore late work; no cross-account/provider state leaks. Failed commands are surfaced and do not poison the next valid command.
6. Artist→Albums→Tracks, progressive loading, invalid-playlist filtering, artwork metadata/prefetch and existing capability gates remain intact. No added work proportional to catalog size on progress ticks/highlight; no new per-render polling or SDK subscription multiplication.
7. Tests use actual adapters with controlled SDK/API fixtures plus common-manager contract cases, not only two mocks relabelled as providers. provider-contracts.md maps each protocol claim to source and test; account access/real playback uncertainty must be labelled honestly.

## Scope and write ownership
Single implementer owns new packages/music-management/**, packages/providers/src/** and package manifest, apps/web/src/music-runtime*, production-device-view*, necessary provider-consumer composition wiring (device-page, sticker runtime, panel, tools, state), packages/panel/src playback and navigation integration/tests, workspace dependency/tsconfig/lock updates. Touch adjacent callers only to migrate the common seam and maintain parity; log exact changes in diary.
Lead owns scope.md, decisions.md and closeout status. Researcher owns provider-contracts.md. Implementer owns architecture.md, diary.md, evidence.md, handover.md. Reviewers own reviews/*.md and may create temporary independent probes outside tracked source.
Forbidden: cert/**, .env* contents, design.pen, auth/server credential refactors, deployment configuration, production account mutations, new product UI/routes, database changes, unrelated cleanup or formatting sweeps. No commits/push/merge/deploy unless user subsequently requests. Existing fixture provider can remain for tests/demos; exactly two production adapters remain.

## Decomposition and dependency graph
A. Inspect installed/canonical contracts and current ownership → provider-contracts.md and architecture.md. Objective gate: explicit seam, protocols/types and known regression matrix. Lead accepts scope readiness; research is independent and read-only to source.
B. Establish failing characterization/contract tests and implement shared manager + adapters migration. Depends on A Ready. Correctness: criteria 1–7, old duplicate policy callers removed or reduced to presentation. Implementer loops tests; reviewer must approve.
C. Independent strict reviews: shared manager/lifecycle/consumer architecture and provider API-contract/regression lane. Depends on B evidence; lanes write separate review files. Any Critical/Major issue blocks completion and returns to implementer; repeat focused review after fixes.
D. Final checks and evidence handover. Depends on both APPROVE. Lead verifies artifacts, scope and check outcomes. User receives work for validation without automatic deployment.

## Verification and evidence
Baseline and final targeted command: `bun test packages/providers/src apps/web/src/music-runtime.test.ts apps/web/src/production-device-view.test.ts packages/panel/src/Panel.integration.test.tsx packages/panel/src/playback-presentation.test.ts` (update replaced paths explicitly rather than silently dropping coverage).
New package suite: `bun test packages/music-management/src`.
Run broader impacted panel/state/tools suites when migration touches those surfaces. Static checks: `bun run typecheck` (every project), `bunx eslint` with explicit changed TS/TSX paths, `git diff --check`; production build: `bun run build`. Preserve bounded output summaries in evidence.md, including any pre-existing failures and source fingerprints. Do not claim a whole-repo green lint result from changed-file lint.
Behavior proof: deterministic delayed promises, event order, clock control and spec-shaped fixtures covering success plus failure/cancellation/null/duplicate paths; existing mounted UI tests prove stable DOM and immediate state. Visual proof: existing local /webpod route only, using active account when available without reauthorization or account mutation. No new QA routes/harness product surfaces. If Apple live session unavailable, record limitation; deterministic MusicKit tests remain mandatory.
Reviewers independently run typechecks/scoped lint and targeted tests, trace caller removal and lifecycle, audit casts/schema boundaries, and enforce useful TSDoc for exported/lifecycle-sensitive functions.

## Git history plan
Keep patch stageable as coherent units: shared queue/playback domain and tests; provider adapter integration/contract tests; common consumer wiring/regression tests and documentation. Do not commit automatically or include workstream labels in implementation identifiers or eventual commit titles.

## Decision register and human gates
See decisions.md. No product decisions are unresolved: preserve behavior and capabilities. Routine seam names/file placement may be chosen and logged; new capabilities, altered auth/security, unprovable behavioral changes or inability to preserve working semantics must be escalated before dependent edits. Elapsed time is not approval. Missing live account access is an explicit verification limit, not a reason to fake evidence.

## Definition of done
- [x] Shared library owns queue/playback policy and all production control paths use it.
- [x] Two adapters retain only provider-specific mechanics and contracts.
- [x] Required behavior/contract cases pass for both providers.
- [x] Existing mounted counter/navigation/prefetch regressions pass.
- [x] All project typechecks, changed-file lint, build and diff checks pass.
- [x] Both independent review lanes APPROVE with no Critical/Major findings.
- [x] Evidence, decisions, diary and handover are complete; live limitations explicit.

## Dispatch packet: implementation
Read this entire scope, decisions.md, architecture.md and provider-contracts.md before coding. Architecture is accepted with these binding clarifications: submitted-context application counter/queue policy moves out of Spotify into the manager; native occurrence evidence/relinking/offset handling stays adapter-specific. Common library must not import panel/state/app packages. A single command coordinator must allow superseding pause/new-target intent during pending native play confirmation, preserving gesture activation, rather than blindly FIFO-blocking every operation. Preserve explicit unknown queue evidence and avoid combining an absolute Apple occurrence with its native short-window total. Every facade and adapter observation boundary must be typed and documented.

Implementation owner: implementer. Dependency A complete; no unresolved human blocker. Skills: global-patterns, jotai-state, vercel-react-best-practices for migrated React, modern-web-guidance as applicable. Research packet supplies canonical SDK/API sources and gaps. Baseline command passed 469 tests, 2179 assertions at base36f0b97; raw bounded provenance /tmp/webpod-music-baseline.log.

Review lanes: shared-management reviewer owns reviews/shared-management.md (single owner, ordering, lifecycle, consumer migration and mounted regressions); adapter-contract reviewer owns reviews/adapter-contracts.md (protocol/native behavior, sources and real-adapter fixture parity). Use strict-critique and team-orchestration/resources/review-protocol.md as review system prompt. Both must independently inspect scope, decisions, architecture, provider contracts, diary and evidence, run checks and explicitly approve after patches. No source edits by reviewers. Lead relays exact findings without softening.

## Lead closeout
Both reviews formally APPROVE against stable manager SHA256 80304d9d9db9e0e9b95ab9da16e8a0e7f016fc4571d6d4bffe6f0206f8f2ad97. Lead verified the fingerprint, 847 passing tests/4134 assertions, all 14 project typechecks, changed-file lint, build and diff evidence. Live Apple managed selection/progress/skip/paused seek-resume passed; Spotify session was signed out so live Spotify playback was not exercised. Apple mode restored authorized and paused after smoke. No commits, push, merge or deployment performed for this refactor. Neuve workflow is inapplicable by repository law.

## Auth namespace follow-up — Ready

The owner's latest request explicitly expands the earlier auth exclusion. Implement the architecture addendum: separate public `/auth` and `/playback` namespaces, with Apple Music and Spotify specific auth flows and session lifecycle beneath a common controller. Preserve one adapter session truth and one playback/queue manager. App composition retains routes, storage, HMR and optional stickers; common auth owns attempts/readiness and cancellation, and connector auth owns native restore/authorize/logout/recovery. Redirect initiation is not successful authentication. Session changes retire playback through its existing lifecycle seam.

Implementer owns source and tests; two independent lanes review auth lifecycle/consumer boundaries and native protocol/recovery respectively. Existing login/navigation and playback regressions remain required. Add real-shaped Apple consumed-Response errors, distinct Spotify redirect/restore tests, concurrent invalidation and stale-account fencing. A personalized core-library 403 with native ACCESS_DENIED may be classified using the documented endpoint contract; do not claim the SDK exposes discarded code40300. Catalog/licensing errors, developer-token401 and generic500 must not trigger cached user-session reset. No automatic authorize loops or server credential/header changes. A fresh user gesture initiates reconnection.

Completion requires focused tests, workspace typecheck, changed-file lint/build and both independent approvals. Update existing PR after review; do not merge or deploy.

### Auth follow-up lead closeout

Implemented separate auth and playback namespaces with provider-specific auth/session flows. Native cached Apple authorization recovery and stale attempt/logout races have deterministic regression coverage. Final implementation verification:889tests/4294assertions across45files,14project typechecks,changed-filelint,productionbuild anddiffclean. Independent native and common ownership reviews approve; final source fingerprints verified by lead. Live localApple session reached authorizedplayer with populated corelibrary; exact freshpopup sequence was not witnessed. Updating existing PR2 only; no merge/deployment.
