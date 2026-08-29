# Scope: 002 — Implementation spine (stages 1–2 + device render spike)

**Status:** `Guarded` — dispatch-ready for every slice below, with three logged assumptions and one blocking HITL item (H-1, history rewrite).
**Lead:** supervising session `webpod-fa`
**Consumes:** workstream 001 (`docs/workstreams/001-interface-design-handover/`)
**Date:** 2026-08-28

---

## Correctness Target

At the end of 002 both of the following are true, independently demonstrable, and independently reviewed.

**A — The honesty checkpoint (stage 2 of the 001 build order).**
webPod is a bun monorepo in which a human can drive the whole thing as a plain DOM app with a keyboard: the 272×204 panel renders as real DOM, the click wheel works on all four input paths (pointer-arc, scroll, keyboard, touch), and S03 Main Menu, S08 Album→Tracks and S13 Now Playing render from a fixture provider in **both colourways**. There is no `useState` anywhere, no `<canvas>` or WebGL anywhere in the panel, and the mechanizable half of the 001 §15 gate set runs green from one command.

**B — The device layer.**
The modelled iPod body — black and white polycarbonate, recessed wheel, translucent Select, mirror steel back, cover glass — renders such that a vertical luminance sample through it matches the design-system §4.2–4.5 gradient stop tables within **±4 units**, using the §12.3 material parameters and an env map rather than painted gradients. Geometry matches §12.0's re-derived R5 table (`wheelR` 115, body 330×552, wheel/body 0.697). It exposes a screen mesh for the panel to composite onto.

**C — The composite seam, T1 only.**
The panel's DOM pixels are supplied to the device's screen mesh through `html-in-canvas`, via three.js `HTMLTexture`, behind a **strategy interface** that has exactly one implementation in this workstream. Tier detection is a capability probe writing a single value that the rest of the app reads. `InteractionManager` supplies interaction by writing a per-frame `matrix3d` onto the DOM element, so the browser hit-tests, focuses and exposes it natively.

**The direction ruling (owner, 2026-08-28).** T1 `html-in-canvas` is the **main path** and is built first. T2 polyfill, T3 CSS-3D overlay and T4 flat DOM are **deferred to a later workstream**, and the seam exists so they are additive rather than a rewrite.

**The law that survives the redirection — and is not a fallback concern:**
> **The panel is real DOM in T1 too.** `layoutsubtree` keeps canvas descendants in the accessibility tree with full semantics. Chrome 151 does not ship the explainer's `updateElementGeometry`; it ships `getElementTransform(element, screenSpaceTransform)`. The composite writes that returned matrix to the panel element's CSS transform, following three.js `InteractionManager`, so browser-native hit-testing, focus, selection and accessibility geometry follow the transformed DOM. `packages/panel` must remain independently mountable with no canvas, no three.js and no tier knowledge — verified by a test that mounts it bare — because that property *is* the WebMCP thesis, not a degradation path.

**A, B and C are built on disjoint file trees** and meet only at `packages/composite`. Neither the panel nor the device may import the other.

**Forward compatibility constraint (verified structurally, not by shipping it):** the state core must be a Jotai `createStore()` reachable from outside React via `store.get / set / sub`, because stage 3's WebMCP `execute` callbacks live outside React. This is checked by a test that mutates and reads device state through the bare store with no React tree mounted. No WebMCP tools are registered in 002.

---

## Source Of Truth

| Class | Source | Notes |
|---|---|---|
| **Primary** | `docs/workstreams/001-interface-design-handover/pm-spec.md` | Screens, wheel mapping, provider interface (§14.2), capability matrix (§14.3), DoD (§15) |
| **Primary** | `docs/workstreams/001-interface-design-handover/design-system.md` | Tokens (§12.1), material params (§12.3), geometry (§12.0, §7.3), component inventory (§13), motion contract (§14) |
| **Primary** | `docs/workstreams/001-interface-design-handover/readme.md` | Three layers, six hard rules, build order, review posture |
| **Primary** | `design.pen` (MCP-only) | Canvas wins over prose where §12.0 says so |
| **Primary** | `~/code/agentic-context/*` | API facts for effect, jotai, tanstack, three.js, r3f, bun, shadcn, webmcp |
| **Supporting** | `docs/workstreams/001-interface-design-handover/stack-research.md` | Verified version inventory and the html-in-canvas tiering; supporting because it is research *about* the primaries |
| **Supporting** | `~/code/agentic-context/ui/templates/start-monorepo` | Layout reference only — it is pnpm+turbo and we are bun |
| **Legacy / current behavior** | none | There is no prior implementation. Greenfield. |
| **Anti-source** | Model recall for Effect, TanStack Start, Jotai-outside-React, WebMCP, html-in-canvas | Named explicitly in 001 readme; all five are known-stale. Recall is not admissible evidence in this workstream. |
| **Anti-source** | Any MCP permission/consent model | WebMCP has none (pm-spec §7.0). Applies even though 002 ships no tools — it constrains naming and state shape. |
| **Unknown** | Apple Music playlist remove/reorder, offline audio, lyrics entitlement, station-from-track | §14.3 rows 10, 11, 18, 20, 21, 30 — resolved docs-only in this workstream (see H-2) |

**Clarity: clear.** 001 is unusually complete: it carries its own DoD, its own failure-mode list, and its own greppable gates. The gaps are the six `UNVERIFIED` capability rows and the absence of a scaffold, both handled below.

---

## Verifiability Map

| Class | Slices |
|---|---|
| **Easy to verify** | Monorepo builds and typechecks per package · greps U8/U9/U10 and the §15.2 greps return 0 · detent reducer unit tests · provider `supports()` matrix matches §14.3 · store-outside-React test · axe target-size and contrast runs |
| **Proxy-verifiable** | Panel screens against `design.pen` artboards (`A76Ib` M1 Now Playing, `H4QpB` M2 Music Menu, `DLqSo` M1L light) via pencil MCP screenshot diff · device spike against §4.2–4.5 stop tables by luminance sampling |
| **Human judgment** | Whether the device "reads as the object" · whether the panel type is legible at 272×204 · both-colourway aesthetic sign-off · **U14 thumb-occlusion, which requires a phone in a hand and cannot be checked at a desk** |
| **Unknown** | The six `UNVERIFIED` §14.3 rows until H-2 lands; the `three-html-render` polyfill's fidelity (out of scope here, stage 6) |

---

## Verification Methods

| Method | Applied to | Artifact |
|---|---|---|
| **TDD/unit (`bun test`)** | detent reducer (all four input paths, no acceleration on keyboard), screen state machine, provider `supports()`/`unsupportedReason()`, `artworkUrl()` `actualPx` clamping, `TrackRef`/`LocalKey` identity | test output in `evidence/` |
| **Store contract test** | Jotai store read/write/subscribe with **no React tree mounted** | `evidence/store-outside-react.txt` |
| **Typecheck** | `bunx tsc --noEmit -p <pkg>/tsconfig.json` **per package**, never repo-wide | command output per package |
| **Static gates** | `bun run gates` → U8, U9, U10 + the §15.2 greps | `evidence/gates-<slice>.txt` |
| **Browser/E2E (Playwright)** | keyboard-only traversal of S03→S08→S13; axe target-size (U6) and contrast (U7) in both colourways; greyscale attribution (U2); reduced-motion (U3), reduced-transparency (U4), contrast-more (U5) emulation | traces + screenshot pairs in `evidence/` |
| **Proxy comparison** | pencil MCP `browser` → `return-screenshot` of the running route, compared against the named `design.pen` artboards | screenshot pairs in `evidence/` |
| **Luminance sampling** | device spike vs §4.2–4.5 stop tables, ±4 units | `evidence/device-luminance.md` with the sampled column |
| **Manual QA (HITL, unwaivable)** | **U14** occlusion on a real phone, in hand | owner checklist result |
| **Reviewer inspection** | everything below, antagonistically, per `review-system-prompt.md` | `reviews/task-NN-review.md` |

Deterministic tests are the primary behavior proof. Visual Proof is limited to screenshots of the real routes (`/`, `/_spike/device`) — **no proof-only routes, harnesses or APIs may be created to manufacture evidence.**

---

## Definition Of Done

**Re-review triggered by the redirection.** 001 §15.0 U10 states: *"If `html-in-canvas` is adopted for the panel, U10 becomes a blocking re-review of U6, U7, U11 and U12 — rasterised text breaks screen readers, Dynamic Type and focus."* We have adopted it, so **that re-review is in scope now, not later.** Because the panel stays DOM under T1 it *should* pass — and "should pass" is precisely the class of assumption 001 tells us to distrust. axe must run against the **composited** page, not against the panel mounted bare, and both results recorded.

**Required checks (every slice):**
- `bunx tsc --noEmit -p <pkg>/tsconfig.json` clean for every package the slice touched
- `bun run lint` clean for every package the slice touched
- `bun test` green for the slice's own tests
- `bun run gates` returns 0 findings
- diary, decision-log and evidence artifacts written to the exact paths below

**Required artifacts:** `diary/<slice>.md`, `evidence/<slice>-*`, `decisions/<slice>.md` (may say "no autonomous decisions taken"), `reviews/<slice>-review.md`

**Required approvals:** antagonistic reviewer APPROVE, then lead sanity check, then owner validation. **U14 and the both-colourway aesthetic call are owner-only and cannot be waived by a reviewer.**

**Explicit non-goals for 002 — building any of these is scope drift and a blocking review finding:**
- Any WebMCP tool registration, any `document.modelContext` call
- Any agent FX: halo, ghost trail, sigils, provenance borders, commit flash
- The expose flip and every B-surface
- The desktop shell, the sidecar, and every D-surface
- Cover Flow, Brick, Sleep Timer, share cards, the art bloom
- Real MusicKit or Spotify network calls
- **T2 polyfill (`three-html-render`), T3 CSS-3D overlay, T4 flat-DOM tier** — the strategy interface must accommodate them; **implementing them is out of scope** (owner ruling)
- Any `tier === "t1"` branch outside `packages/composite`. The tier is read in one place.
- Haptics and clicker audio (stage-2 has no sound; §4.9 lands with the wheel in a later slice)
- Any `useState`, anywhere, for any reason

---

## Type, Lint And Documentation Gates

**Canonical type research is mandatory before writing a typed boundary.** For each boundary below, the owning slice must record in its decision log which canonical source it read and what it reused:

| Boundary | Canonical source (read it, do not recall) |
|---|---|
| Jotai store outside React | `~/code/agentic-context/jotai/docs/core/store.mdx` — **`published: false`, so absent from training data** |
| Effect services, HTTP | `~/code/agentic-context/effect` — **4.0.0-rc.112**: `Context.Service` not `Context.Tag`; HTTP at `effect/unstable/http` not `@effect/platform` |
| TanStack Start server functions | `~/code/agentic-context/tanstack/router` — **`.validator(…)`, not `.inputValidator(…)`** |
| Tailwind v4 `@theme` | `~/code/agentic-context/ui/apps/v4/app/globals.css` |
| shadcn `components.json` | `~/code/agentic-context/ui/apps/v4/components.json` |
| Bun server / workspaces | `~/code/agentic-context/bun/docs` (+ `bun/AGENTS.md`) |
| R3F `<Canvas>` props, `useFrame` | `~/code/agentic-context/react-three-fiber/docs` |
| three.js materials | `~/code/agentic-context/three.js` (clone is `0.185.0` on branch `dev` — **do not assume npm resolves the same**) |
| `MusicProvider`, `TrackRef`, `Capability` | pm-spec §14.2 — transcribe it, do not redesign it |

**Type-system expectations:** no `any`; no broad `unknown` past the edge; no non-null assertions without a comment naming the guard; no unchecked casts; no `@ts-expect-error` or lint disable without an invariant recorded in the slice's decision log. External/untrusted data is parsed at the edge and narrowed before it reaches domain code. `Capability` is a closed union — no string literals at call sites.

**Documentation:** TSDoc-style comments on every exported function, the detent reducer, the screen state machine, every `MusicProvider` method on every implementation, the store bridge, and anything lifecycle-sensitive or surprising. Document behavior, invariants, side effects, return semantics and footguns — not the signature. Bar: `/Users/vinicius/code/devtools/devtools-frontend`.

**Naming hygiene:** the strings `002`, `implementation-spine`, `workstream` must not appear in fixture paths, fixture payload values, test names, implementation comments, generated artifacts, or suggested commit messages. They belong only in the bookkeeping paths under `docs/workstreams/002-implementation-spine/`.

---

## Guardrails

**In scope:** everything under `apps/`, `packages/`, `scripts/`, root config, `.gitignore`, `AGENTS.md`/`CLAUDE.md`, and this workstream's own `docs/workstreams/002-implementation-spine/` tree.

**Out of bounds — touching these is a blocking finding:**
- `docs/workstreams/001-interface-design-handover/**` is **read-only**. If it is wrong, raise it; do not edit it.
- `design.pen` — MCP tools only, never `Read`/`Grep`/edit, and **no writes in 002**.
- `~/code/agentic-context/**` — reference clones, read-only, never modified as part of unrelated work.
- Another lane's package directory (see `dependency-graph.md` for ownership).

**Commands allowed:** `bun`, `bunx`, `git` (local, non-destructive), Playwright, pencil MCP. **Forbidden:** `npm`, `npx`, `pnpm`, `yarn`, git worktrees, any network call to Apple or Spotify, and:

> ### LAW — no agent ever force-pushes
> `git push --force`, `--force-with-lease`, `git filter-repo`/`filter-branch` against a pushed branch, and any other history-rewriting push are **owner-only, always**. An agent may *prepare* a rewrite and print the exact commands; the owner runs them. This is not a per-task permission that can be granted in-line — it is standing repo law, recorded in `AGENTS.md`.

---

## Decision Log Rules

**Workstream-level decisions live in `decision-log.md`** — numbered, dated, attributed, with rationale, consequences and reversal cost. It is append-only and it is the provenance record: if it and any other file in this bundle disagree, `decision-log.md` wins. Deviations from 001 are flagged `⚠ DEVIATES` there, because 001 is read-only and cannot be annotated in place.

Per-slice choices made by an implementer under uncertainty go in `decisions/<slice>.md`, not in `decision-log.md`. If a slice-level choice turns out to bind the whole workstream, the lead promotes it into `decision-log.md` with a number.


- **Agent may decide, no log needed:** file names inside its own package, test-case names, internal helper shape, ordering of its own commits.
- **Agent may proceed but MUST log** in `decisions/<slice>.md`: any deviation from a 001 number, any type escape, any place a canonical source disagreed with 001, any fixture value invented to fill a gap.
- **Agent must STOP and ask the lead:** anything that would add a permission concept, anything that renders a fact the platform does not supply, any `useState`, any canvas in the panel, any change to the three-layer split, any change to the actor-attribution channels, any capability claimed `true` that the provider lacks.

---

## Git History Plan

Small commits, each typechecking on its own. Conventional prefixes. **No `Co-Authored-By` trailer, no `Claude-Session` trailer, no generated-with footer — see H-1; this becomes repo law in `AGENTS.md`.**

| # | Commit | Contents |
|---|---|---|
| 1 | `chore: bun workspace scaffold` | root `package.json` workspaces, tsconfig base, `.gitignore`, package skeletons |
| 2 | `chore: repo hygiene and agent instruction law` | `AGENTS.md`, `CLAUDE.md` symlink, gitignore entries |
| 3 | `feat(tokens): design system tokens` | `packages/tokens` — globals.css from design-system §12.1 + typed exports |
| 4 | `chore: static correctness gates` | `scripts/gates.sh`, `bun run gates` |
| 5 | `feat(providers): music provider contract` | interface, `TrackRef`, `Capability`, `artworkUrl` |
| 6 | `feat(providers): fixture provider` | day-one implementation + fixtures |
| 7 | `feat(providers): apple and spotify capability stubs` | compiling stubs with the §14.3 matrices |
| 8 | `feat(state): device store and detent reducer` | Jotai store, all four input paths |
| 9 | `feat(state): screen state machine` | menu hierarchy, push/pop, highlight |
| 10 | `feat(panel): panel shell and list primitives` | `PanelTitleBar`, `PanelListRow`, raster |
| 11 | `feat(panel): main menu, album tracks, now playing` | S03, S08, S13, both colourways |
| 12 | `feat(device): device body render spike` | R3F spike route, materials, env map |
| 13 | `test: gate harness and browser checks` | Playwright, axe, greyscale, colourway pairs |

Mechanical formatting is isolated into its own commit and never mixed with behavior.

---

## Review Posture

**High Impact / Guarded.** Antagonistic review is mandatory on every slice, by a separate session that did not write the code. Rationale is empirical and comes from 001's own record: three drafts of the design invented a permission model, one invented an agent-presence signal, one put the human's feedback under their own thumb, one gave the agent a voice you could feel. Each was internally coherent and each was fiction. Reviewers treat "this looks right" as the beginning of the check.

Review lanes, per-lane skills and the antagonistic directive are in `review-lanes.md`; the binding reviewer prompt is `review-system-prompt.md`.

---

## Process tracking

The Neuve Kanban contract in `team-orchestration` **does not apply to this repo** — owner ruling, 2026-08-28: there is no `neuve` shell and no board, and initiatives are tracked in `docs/workstreams/` instead. `tracker.md` in this folder is the operational queue for 002. This is a deliberate convention, not a bypass; do not ask for Kanban tickets and do not invent ticket ids.
