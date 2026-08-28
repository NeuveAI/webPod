# 002 — Dependency graph and write ownership

**No git worktrees.** Every lane runs on the same working tree, so parallelism is bought entirely with disjoint write ownership. A lane that needs to write outside its column must stop and ask the lead.

## Package layout

```
apps/web/                  TanStack Start app: routes, entry, server routes
packages/tokens/           globals.css (design-system §12.1) + typed token exports
packages/ui/               shadcn primitives — GLASS layer only
packages/state/            Jotai store, detent reducer, screen state machine
packages/providers/        MusicProvider contract, fixture / apple / spotify
packages/panel/            PANEL layer — real DOM at 272×204
packages/device/           R3F device body + the screen mesh
packages/composite/        THE SEAM: tier detection + panel-pixel-source strategy
packages/tools/            WebMCP registration — SKELETON ONLY in 002, no tools
packages/server-core/      Effect services: artwork proxy, token minting (later)
scripts/                   gates.sh and browser-check runners
```

Wave 0 creates **every** package skeleton — `package.json`, `tsconfig.json`, `src/index.ts` stub — so that no later lane ever edits shared config and lanes never collide on `bun install`. **10 packages** after the composite amendment.

## The seam, in one picture

```
packages/panel/      real DOM, 272×204        knows nothing of canvas/three/tiers
      │                                        (mountable bare — this is a tested property)
      ▼
packages/composite/  tier probe + strategy    the ONLY place a tier is read
      │              PanelPixelSource
      │                └─ HtmlInCanvasStrategy   ← the one implementation in 002
      │                └─ (T2/T3/T4 later)
      ▼
packages/device/     R3F body + screen mesh   knows nothing of the panel
```

Neither `panel` nor `device` may import the other, or `composite`. Dependencies point one way: `composite → {panel, device}`. A `tier ===` comparison anywhere outside `packages/composite` is a blocking finding.

## Write ownership

| Lane | Owns (write) | Reads only | Must never touch |
|---|---|---|---|
| **W0 Scaffold** | root config, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, all package skeletons, `packages/tokens/**`, `scripts/gates.sh` | 001 docs | any lane's `src/` beyond the stub |
| **W1 Providers** | `packages/providers/**` | `packages/tokens`, 001 §14 | `packages/state`, `packages/panel`, `apps/web` |
| **W2 State** | `packages/state/**` | `packages/providers` types, 001 §4 | `packages/panel`, `packages/providers/src` |
| **W3 Panel** | `packages/panel/**`, `apps/web/src/routes/index.tsx` | `packages/state`, `packages/tokens`, `packages/providers` types | `packages/state/src`, `packages/device` |
| **W4 Device layer** | `packages/device/**`, `apps/web/src/routes/_spike.device.tsx` | `packages/tokens`, design-system §12.3 | `packages/panel`, `packages/composite` |
| **W6 Composite** | `packages/composite/**`, `apps/web/src/routes/_probe.capabilities.tsx` | `packages/panel`, `packages/device`, `~/code/agentic-context/{html-in-canvas,three.js}` | `packages/panel/src`, `packages/device/src` |
| **W5 Gate harness** | `scripts/**` (after W0 hands over), `apps/web/tests/**` | all | all `src/` |
| **S1 Apple spike** | `docs/workstreams/002-implementation-spine/evidence/apple-capability-spike.md` | web docs, 001 §14.3 | all code |

`apps/web/src/routes/` is shared. Conflict avoidance, and it holds because the route tree is file-based so nobody edits a shared manifest: **W3 owns `index.tsx` and the root layout · W4 owns files prefixed `_spike.` · W6 owns files prefixed `_probe.`**. No lane appends to another's file.

## Edges

```
S1 (Apple docs spike) ──────────── no code dependency; unblocks W1's capability matrix confidence
                                   and gates the S17/S08 designs in a LATER workstream

W0 Scaffold
 ├── W1 Providers ──┐
 ├── W2 State ──────┼── W3 Panel ──┐
 ├── W4 Device layer ──────────────┼── W6 Composite (T1) ── W5b Browser checks
 └── W5a Static gates              ┘                        (must run on the COMPOSITED page)
```

**W6 is the new critical path.** Its capability probe (`W6.0`) is dispatched the moment W0 lands, ahead of its own dependencies, because it answers a question everything else now rests on: does the owner's browser actually expose the API, and under which method name.

| Slice | Status | Blocked by | Unblocked when |
|---|---|---|---|
| **S1** Apple capability docs spike | **can start now** | — | — |
| **W0** Scaffold + tokens + hygiene | **can start now** | — | — |
| **W5a** Static gates (`gates.sh`) | blocked | W0 | package skeletons + `bun run` wiring exist |
| **W1** Providers | blocked | W0 | skeletons exist |
| **W2** State | blocked | W0 | skeletons exist |
| **W4** Device layer | blocked | W0 | skeletons + `packages/tokens` exist |
| **W6.0** Capability probe | blocked | W0 | skeletons exist — **jump the queue, this de-risks everything** |
| **W6** Composite seam (T1) | blocked | W3, W4 | panel mounts bare **and** device exposes a screen mesh |
| **W3** Panel | blocked | W0, **W2 store contract** | W2 has published `packages/state/src/contract.ts` — the typed atom/selector surface — even before its implementation lands |
| **W5b** Browser checks (Playwright/axe/greyscale) | blocked | W3, **W6** | `/` renders S03 composited — U10's re-review requires axe on the **composited** page, so this can no longer be satisfied by the bare panel alone |

**The W2→W3 unblock is deliberately early.** W2 publishes the typed contract as its *first* commit, so W3 can build against types while W2 is still implementing the reducer. This is the only reason W2 and W3 can overlap at all; if W2 does not publish the contract first, W3 waits.

## Parallelization constraints

- Max 4 implementing lanes concurrent, plus W6 once its dependencies land. Above that, `bun install` contention and review latency cost more than the parallelism buys.
- Two reviewers standing, so no lane queues for a review slot.
- A reviewer never reviews a lane it implemented. Reviewer↔implementer pairing is recorded in `tracker.md`.
- Any lane that finishes early does **not** pick up another lane's files. It reports to the lead and waits for a dispatch packet.
