# 002 — Literature packet

A map for correctness, not a bibliography. Read what your lane's rows say to read; skipping a row and then getting its API wrong is a blocking finding, because every stale-API risk here is already named.

## Primary — authoritative

| Ref | Why | Question it answers |
|---|---|---|
| `docs/workstreams/001-interface-design-handover/readme.md` | Entry point: three layers, six hard rules, build order, risks | What layer does this thing belong to, and what am I forbidden from doing? |
| `.../pm-spec.md` §3, §4 | Screen inventory, wheel mapping, four input paths, keyboard map, occlusion rule | What does the wheel do, and where may feedback render? |
| `.../pm-spec.md` §14 | Provider interface verbatim, capability matrix, `TrackRef` identity | What exactly do I implement, and what does Apple actually lack? |
| `.../pm-spec.md` §15 | Universal gates U1–U15, per-screen and per-system DoD, the 14 failure modes | Am I done? Almost certainly not. |
| `.../design-system.md` §12.1 | `globals.css` token export, Tailwind v4 `@theme` | What are the tokens, literally? |
| `.../design-system.md` §12.3 | CSS-consumable vs three.js boundary; the nine recipes that cannot be CSS | Do I write this as CSS or hand it to a material? |
| `.../design-system.md` §12.0, §7.3 | Re-derived R5 geometry at `wheelR` 115 | What are the numbers? |
| `.../design-system.md` §13, §14 | Component inventory keyed to the canvas; motion/FX contract; frame-budget rule | Which component is this, and may it run per-frame? |
| `design.pen` (**MCP tools only**) | 8 artboards; canvas wins over prose where §12.0 says so | What does it actually look like? |

## Primary — API ground truth. Read the clone; do not recall.

| Clone | Read for | The trap |
|---|---|---|
| `~/code/agentic-context/jotai/docs/core/store.mdx` | `createStore()` → `store.get/set/sub` | **`published: false`** — the pattern the whole state architecture rests on is likely absent from training data |
| `~/code/agentic-context/effect` | `Context.Service`, `effect/unstable/http` | **4.0.0-rc.112, not v3.** Almost every Effect API written from recall is wrong here. Not `Context.Tag`, not `@effect/platform`. |
| `~/code/agentic-context/tanstack/router` | Start server functions, file routes | **`.validator(…)`, not `.inputValidator(…)`** |
| `~/code/agentic-context/ui/apps/v4/{app/globals.css,components.json}` | Tailwind v4 `@theme`, shadcn config | v3 muscle memory produces a `tailwind.config.js` that does nothing |
| `~/code/agentic-context/ui/templates/start-monorepo` | Monorepo **layout only** | It is pnpm + turbo; we are bun with neither (H-4) |
| `~/code/agentic-context/bun` (+ `bun/AGENTS.md`) | workspaces, `Bun.serve()`, test runner | — |
| `~/code/agentic-context/three.js` | materials, `HTMLTexture`, `InteractionManager` | clone is `0.185.0` on branch **`dev`** — those two files exist *because* of that. Do not assume npm resolves the same. |
| `~/code/agentic-context/react-three-fiber` | `<Canvas>` props, `useFrame`, on-demand rendering | `frameloop="demand"` is mandatory here (design-system §14.1) |
| `~/code/agentic-context/webmcp` | `document.modelContext`, `registerTool` | Not used in 002. Read only to understand what the state core must eventually support. |
| `~/code/agentic-context/html-in-canvas` | the five primitives, content restrictions | Stage 6. Read §1.5 for the cross-origin artwork constraint, which bites **now**. |

## Supporting

- `.../stack-research.md` — the version inventory and the html-in-canvas tiering, traceable to the clones. Supporting rather than primary because it is research *about* the primaries; if it and a clone disagree, **the clone wins**.
- `preview-validation.md` (this folder) — the four tiers and the flag-off baseline law.

## Anti-sources — must not override this scope

| Anti-source | Why |
|---|---|
| Model recall for Effect, TanStack Start, Jotai-outside-React, WebMCP, html-in-canvas | All five named stale in the 001 readme. Recall is inadmissible; cite the clone. |
| MCP's permission/consent model, `destructiveHint` | **WebMCP has none of it.** No grants, no prompts, no destructive hint, no user-gesture requirement. Constrains naming even in 002, which ships no tools. |
| The pnpm/turbo shape of the shadcn template | Layout reference only (H-4). |
| Any v3 Tailwind convention (`tailwind.config.js`, `@apply`-heavy patterns) | v4 `@theme` is the convention here. |
| Deleted 001 surfaces: **S26 Confirm Card**, **B10 Away Mandate**, the co-pilot braid, agent idle-presence | Deleted for cause. Re-introducing any of them is a blocking finding, not a feature. |
