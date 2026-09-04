# Aqua iPod interface parity

Status: Complete; implemented and independently approved. Owner requests drastic visual changes and delegates implementation plus review. No merge or deployment is part of this task.

## Correctness and sources
Primary: current user request, the nine HEIC photographs under `/Users/vinicius/code/tmp/ipod-reference/`, and attached Aqua controls and Now Playing images at `/Users/vinicius/.codex/attachments/a3eebdc3-8c73-41f7-9b73-0b2b814bc2d3/image-1.png` and `image-2.png`. The reattached clipboard images show the same targets. Photos establish real iPod layout; controls establish Aqua materials; Now Playing establishes hierarchy and dark palette direction. Inspect all before coding. Supporting: public primary historical references when useful, and `~/code/agentic-context/` for current library APIs. Current source code is the behavior baseline, not visual authority. Other workstreams are not assigned and must not override this target.

Match the iPod LCD interface as closely as feasible: compact header and battery/play status, period typography and row density, blue gloss selection bars, precise borders and recessed tracks, album art and metadata proportions, progress indicator and elapsed/remaining placement. Light theme is the primary fidelity target. Dark may vary color while retaining the same structure and material language. Cover navigation lists, Now Playing, loading/empty/error, search/settings/auth controls present in the existing UI. Preserve playback, wheel, keyboard, touch, accessibility and shared Jotai/WebMCP semantics. No unrelated provider/server rewrite.

## Ownership and decomposition
1. Sol PM: inspect references and current product; write `criteria.md` with concrete differences and measured targets. Read-only implementation ownership; write criteria and reviews only. Verification: image inspection, product browser observation; report specific discrepancies.
2. Astra implementer: sole code owner for `packages/panel`, `packages/tokens`, `packages/ui`, `packages/composite`, and presentation integration in `apps/web`. Device screen integration may change if necessary for LCD fidelity; avoid unrelated 3D shell/physics work. Inspect canonical existing component props and store types before changes; reuse them. First capture before screenshots, then implement and capture after images on the actual product route `/_spike/device` (root redirects there). No new proof-only routes or synthetic product screens.
3. Sol independent review: visual comparison against all primary references and code/behavior inspection; independently run type/lint checks, check device/composite siblings and accessible interactions. Critical or major findings require REQUEST_CHANGES and return to Astra. Review output `reviews/aqua-review.md`.
4. Lead: supervise iterations, inspect final visual artifacts, run sanity checks, update this tracker and deliver.

## Verification and definition of done
- [x] All references inspected and criteria recorded by PM.
- [x] Before and after product screenshots: light/dark lists and Now Playing, desktop 1440x900 and mobile 390x844; inspect native LCD detail and full device readability. Record real data/auth limitations honestly. Existing routes only; do not manufacture evidence.
- [x] Aqua materials, typography, density, header, progress and state layouts assessed explicitly by PM.
- [x] Wheel/keyboard list navigation, select/back, theme, focus visibility, and available playback controls verified; loading/error controls retain behavior.
- [x] `bun run typecheck`, `bun run lint`, `bun run build`, and scoped existing tests for changed packages pass. Behavior changes require meaningful deterministic happy/unhappy coverage; CSS changes do not need mirrored tests.
- [x] No new type escapes, lint disables, component-local useState, or inaccessible controls. Non-obvious lifecycle/exported behavior gets useful TSDoc.
- [x] Independent review has no unresolved critical/major findings; limitations and remaining subjective differences disclosed.
- [x] Implementation diary, decisions, verification output, screenshots and final handover exist.

Visual parity is proxy-verifiable with images and reviewer judgment. Static checks and interactions are objectively verifiable. Final aesthetic acceptance belongs to owner; delivering a reviewed reversible patch does not require a preimplementation approval.

## Dependency graph and decision register
Reference assessment -> implementation -> independent review -> fixes -> final verification. PM reconnaissance runs alongside Astra reference/code reconnaissance; PM sends criteria early. Astra owns all source edits; PM does not patch. No current blocking owner decision: user authorized broad design change, specified source and model pair. Agents may decide precise CSS/font/material/layout choices and log significant deviations in `decisions.md`. Escalate only absent necessary access or incompatible product behavior changes. Do not change auth/security/data boundaries.

## Artifacts, review lanes and dispatch
All paths below are relative to this workstream: `criteria.md` (PM), `decisions.md`, `diary/implementation.md`, `evidence/` (Astra), `reviews/aqua-review.md` (PM), `handover.md` (Astra), `dispatch/implementer.md` (lead). Review lanes: reference fidelity/material/typography; interaction and accessibility; types/lint and regression. Read `review-system-prompt.md` before review. Load modern-web-guidance first for frontend work, global-patterns, interface-craft, web-design-guidelines; additional applicable skills only. Browser work follows agent-browser skill. Dependency research must use local agentic-context sources; official web docs are fallback.

## Guardrails and git plan
Read repo AGENTS.md. Never read cert contents or expose credentials; encrypted design.pen only through Pencil MCP. bun/bunx only. No useState. No force pushes. Repo explicitly has no Kanban or neuve shell: skip those generic skill steps. No added dependencies unless justified and logged. Preserve initial untracked `.neuve-artifact/`, `.neuve/`, `test-results/`. No worktree needed. Leave changes uncommitted for user review; staging plan: (1) coherent UI/token change, (2) behavior tests if required, (3) workstream evidence/documentation. No trailers. No push/deploy.

## Supervision record
- Baseline HEAD: `2b2a484`.
- Lead visually inspected all nine HEIC photographs after lossless-source-preserving JPEG conversion in `/tmp/webpod-reference-lead/`, plus both attached images.
- Reference details forwarded to Astra: nine single-line rows, white LCD field, compact metallic header, edge-to-edge blue selection excluding narrow scroll trough, queue count above square art, metadata stack, long recessed Aqua track and negative remaining time.
- The instructed `~/code/agentic-context/` directory is absent; available `~/code/agent-context/` is the documented library-reference fallback, verified by filesystem inspection. No API knowledge should be invented to compensate.
- Authorized narrow implementation expansion: `packages/state/src/contract.ts` compact visible-row constant changes from eight to nine, with affected navigation expectations kept consistent. Photos govern density; old eight-row contract does not override them.
- Evidence can use the existing deterministic MusicKit boundary on the real product route, with explicit fixture provenance; it must not be presented as authenticated account playback proof.
- Explicit no-history model dispatch now uses Astra `aqua_implementer` and Sol `sol_pm_review`; initial reconnaissance PM was stopped after preserving criteria to ensure model routing follows the owner's request.

## Closeout
Sol final review APPROVE with no critical/major findings. Independent gates: 11/11 typecheck projects, lint, build, 423 scoped tests, 7 product browser checks and 4 panel browser checks. Lead repeated typecheck and lint, checked diff whitespace and inspected final light/dark native and mobile captures. Evidence uses explicit deterministic MusicKit fixture; live authenticated Apple playback is not claimed. Remaining limitation: existing experimental CanvasDrawElement requirement and existing bundle-size advisory. All changes remain uncommitted for owner review.
