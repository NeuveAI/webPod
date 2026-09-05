# Listening sticker implementation scope

Status: Ready for backend domain/data and 3D implementation; session identity guarded pending owner answer. Canonical research complete. Owner authorized implementation and commits. Lead coordinates implementation and independent review. Tracker is this workstream; no Kanban or neuve shell applies.

## Correctness and sources
Primary: current owner request; app-sticker-handover.md; assets/stickers/playworn/manifest.json; repo AGENTS.md. Owner confirmed genre-based starter pack plus measured listening unlocks. Supporting: backend-research.md and surface-research.md (canonical API references and integration findings). Library source root is /Users/vinicius/code/.better-coding-agents/resources, explicitly requested by owner and replacing absent ~/code/agentic-context. Installed sources win for pinned versions when reference checkout differs. Existing asset exports are immutable. Historical board captions are not earning policy. Neuve brand colors/iOS-only marketing rules do not replace webPod's established physical product language; simulated light reflection is required by owner, not a decorative UI gradient.

## Product contract and decisions
- D1: TanStack Start is already the routing/server glue. Formalize this in repository architecture docs and use its server routes, without introducing a parallel API framework.
- D2 (owner): import Apple metadata to choose one initial genre pack; earn subsequent packs through elapsed listening actually observed in webPod. No historical-duration claims from library/recent-history membership.
- D3: earning thresholds are named server policy configuration, deterministic and tested. Implementers propose concrete defaults in decisions, with provenance in rewards. Default may be tuned without schema rewrite. Unknown genre must not fabricate confident classification.
- D4: no MusicKit token in public state, logs, DB plaintext, evidence or errors. Apple Music authorization is not Sign in with Apple identity. Use verified server authorization plus opaque webPod session; document browser/account portability honestly. Never infer or merge identity from library similarity. Any stronger identity requirement must be surfaced before implementing it.
- D5: persisted server inventory, pack claims and placement writes are scoped to authenticated session identity. Requests validate shape/size/origin; duplicate import/listening/claim retries cannot duplicate credit or awards. Stop observing on pause, seek discontinuity, sign-out, provider replacement and teardown; enforce elapsed-time caps server-side. Client telemetry remains a bounded observation, not tamper-proof attestation.
- D6: rear flip reveals a small pack tease from bottom. Pulling brings it into view with velocity-aware spring settlement. Open exposes earned die-cut art, peel follows input and sticking settles against rear surface. Pointer cancellation restores coherent state; keyboard/touch alternatives perform equivalent actions. Reduced motion snaps or fades with same final state. No permanent animation loop at rest.
- D7: all 60 exact catalogue identities resolve in production assets; visibleBounds threshold16 normalizes sizing; physical laminate uses alpha-aligned UVs and existing lights. No color-keying ivory, no rectangular specular halo. Shared GPU resources have explicit disposal and context-loss recovery. Store placement IDs/coordinates, never texture handles.
- D8: preserve existing playback, input, orientation, tier fallback and SSR isolation. All UI/shared interaction state uses exported Jotai atoms through deviceStore, never useState.
- D9: previous staged work is checkpointed separately with generated local/scratch files excluded. New work commits are coherent backend, material/state, interaction/integration and verification/docs slices; no trailers, force push or broad staging.

## Ownership and dependency graph
1. Baseline cleanup engineer owns prior staged changes and .gitignore only; finishes before source implementation.
2. Backend engineer owns packages/server-core, packages/providers Apple credential boundary, new shared sticker domain package, new apps/web server routes, server runtime, migration/config/docs and dependency installation. No production-device-view or device/composite/state edits. Publishes browser API/domain contract before integration.
3. 3D engineer owns packages/device, packages/composite, packages/state sticker atoms/actions, manifest-to-browser assets and tests. No music-runtime/server routes/production-device-view edits. Publishes placement and state contract before UI integration.
4. UI engineer follows backend+3D contracts, owns apps/web sticker components/runtime, music-runtime integration, production-device-view, sticker styles, browser tests. Dependency/package edits coordinated with backend engineer; no concurrent lockfile writes.
5. Independent reviewer follows implementation, using strict-critique and vertical skills. Implementers retained for exact finding patch loops. Lead independently runs final checks.

Backend and 3D slices may run in parallel after cleanup with disjoint ownership. UI integration follows contracts; review may begin on complete slices while UI work proceeds with no edit overlap. No worktrees.

## Required skills and literature
Backend: global-patterns, effect-services, database-drizzle, tanstack-router. Inspect user resources/effect, bun, drizzle-orm, drizzle, tanstack; record exact paths/version differences and canonical framework/schema types in backend-research.md.
3D/UI: modern-web-guidance first for frontend tasks; global-patterns, interface-craft/storyboard-animation.md, interface-design-guardrails and all four resources, neuve-motion tokens/principles/reduced-motion, web-design-guidelines, jotai-state, vercel-react-best-practices where React applies. Inspect installed Three/R3F versions and local Jotai source; record exact references in surface-research.md. Design facets: tactile, legible, cohesive, responsive, accessible; rate each 1–5 with evidence and reasons.
Reviewer: strict-critique plus same vertical/domain skills and references. Be extra critical. Question every line. Assume code is wrong until proven right. ANY Critical/Major finding requires REQUEST_CHANGES. Review against these decisions without importing unrelated workstreams or new product requirements.

## Verification and definition of done
- Backend unit/integration: isolated SQLite migration/reopen; tenant isolation; unauthorized/invalid/oversized/cross-origin requests; bounded import pagination and enrichment failures; duplicate/replayed/concurrent credit and claim; server restart persistence; policy genre attribution/threshold; placement validation; token never in public session. Pure policy deterministic tests and real SQLite transactions are primary proof.
- State/material: all 60 files decode and production URLs resolve; exact IDs/bounds; geometry conformity/normals/UVs; invalid placement; alpha-gated finish; resource lifecycle and demand settling. Test external store writes render same equipped state.
- Browser existing production / route: signed-out/importing/failed/earned states; flip tease/pull/open/peel/stick/reload; pointer cancel and keyboard; mobile 375px; reduced motion; context loss and fallback. Deterministic provider/server mocks in existing testing conventions, no proof-only routes.
- Visual evidence on actual production route: dark, bright and ivory-heavy representative stickers, flat-vs-finished comparison, rear and oblique orientations, readable 90px previews. Capture screenshots/trace and assess material sheen and gesture continuity. No claims based on screenshots alone for functional correctness.
- Run bun run typecheck; per-app/package bunx --bun tsc --noEmit -p path/tsconfig.json; bun run lint; bun run build; meaningful scoped bun test suites; relevant production-view-parity/device-orientation/product-lighting browser suites according to changed boundaries. Record exact commands/results; pre-existing failures distinguished by baseline.
- Strong canonical types, validated external boundaries, no unexplained any/casts/ignores. TSDoc explains public, lifecycle, security and non-obvious function invariants.
- Independent APPROVE after all Critical/Major fixes, final lead sanity checks, durable evidence and implementation handover. Human experience judgment presented with screenshots; no deployment or push inferred.

## Artifact paths
All paths relative to docs/workstreams/015-listening-sticker-collection/:
- implementation-scope.md: dispatch contract, tracker, DoD and decisions.
- backend-research.md; surface-research.md: canonical literature findings.
- implementation-decisions.md: coordinated decision log (lead writes; agents report changes).
- diary/backend.md; diary/surface.md; diary/interaction.md: engineer records with exact changed paths and checks.
- evidence/backend/; evidence/surface/; evidence/interaction/: bounded check outputs and visual captures.
- reviews/backend-review.md; reviews/surface-review.md; reviews/final-implementation-review.md: independent findings and dispositions.
- implementation-handover.md: outcome, runtime setup, limitations, commits, remaining owner judgment.

## Escalation and review posture
High impact authentication/data and human judgment motion/material. Engineers may choose reversible algorithms and named tuning constants with reasons and tests. Must ask lead before ownership changes, unverified identity merging, sending user data to a new service, asset edits, changing earning model, or destructive migration. Owner already authorized local implementation and commits. No further permission needed for routine implementation, tests, fixes or local review. Earning threshold tuning is a documented provisional default, not owner-approved product copy.
