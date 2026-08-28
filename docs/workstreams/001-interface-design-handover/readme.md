# 001 · Interface design → implementation handover

**Status:** design complete · implementation not started
**Date:** 2026-08-28
**Owns:** the design system, the interaction model, the agent architecture, the provider contract
**Produces:** everything an implementer needs to start building. No code was written in this workstream.

---

## What this workstream decided

webPod is a browser music player rendered as a physically-modelled iPod 5th generation. It plays Apple Music now and must accept Spotify later. It is driven by a real click wheel — and, through WebMCP, by AI agents acting on the same screen a human is looking at.

The design is finished and reviewed. There is no `package.json` yet; the first implementation task is scaffolding, not features.

---

## Read in this order

| # | File | Lines | What it is |
|---|---|---|---|
| 1 | **`handover.html`** | — | **Start here.** Open in a browser. Layers, build order, verified APIs, tokens, review gates. |
| 2 | `pm-spec.md` | 2,180 | Screens, navigation, click-wheel mapping, WebMCP tool surface, provider abstraction, journeys, Definition of Done |
| 3 | `design-system.md` | 2,985 | Tokens, material recipes, motion, FX geometry, accessibility math |
| 4 | `stack-research.md` | 1,521 | Ground-truth API research, read from the local clones rather than recalled |

`../../../design.pen` is the design file — 8 artboards, 8 components, 8 annotation notes, 148 tokens. It is **encrypted and MCP-only**.

The same handover is published as a shareable page: <https://claude.ai/code/artifact/5c43a8f9-d1cb-4704-bac5-8c5ee6b1b9db> — that copy is for people, not for agents. Work from the files.

---

## The three layers

Every element belongs to exactly one. If you cannot classify something in two seconds, that is a design bug — raise it rather than guessing.

| Layer | Renders with | Contains |
|---|---|---|
| **DEVICE** | react-three-fiber | Body, wheel, Select, steel back, cover glass |
| **PANEL** | **real DOM** | Everything inside the 272×204 screen |
| **GLASS** | DOM + Tailwind + shadcn | Sidecar, overlays, sheets, status bar |

> **The panel must remain genuine DOM, because it is the layer WebMCP actuates.** A texture cannot be focused, read by a screen reader, or driven by a tool call. If the panel becomes pixels, the product's thesis dies with it.

---

## Hard rules

Not style preferences. Each has a reason, and each was violated at least once during design before being caught.

1. **No `useState`. Anywhere. Zero exceptions.**
   WebMCP tool callbacks live outside React and must read and write the same state the UI renders. Use Jotai `createStore()` → `store.get / set / sub`. State in a component closure is unreachable from a tool handler — this is a capability problem, not a taste one.

2. **Never imply a permission that does not exist.**
   WebMCP has no permission model: no per-tool grants, no consent prompt, no `destructiveHint`. `registerTool()` makes a tool permanently callable. Banned in agent-flow copy — *allow, deny, permit, permission, grant, authorise, request, ask, waiting, pending, approved, blocked*.

3. **Never render a fact the platform does not supply.**
   The page cannot detect that an agent is present — no attach event, no idle signal. It learns one exists only when a tool executes. Ask of any indicator: **which API supplies this fact?**

4. **No transient feedback under the thumb.**
   A thumb on the wheel occludes the inner ring (±33°). Under the contact patch render *material* state only; anything carrying *information* renders where the finger is not.

5. **Agents never get springs, haptics, or sound.**
   Motion physics is attribution channel 4; haptics is channel 7 and the only channel that works with the phone in a pocket. Agent motion is `duration + linear`. Gate at one call site: `source !== 'agent' && source !== 'system'`.

6. **Human = sky blue. Agent = green. Apple Music crimson is brand only**, never an actor colour. Hue is the 6th of 7 attribution channels and never load-bearing — the design must survive greyscale.

---

## Stack

TanStack Start (+ Form, Virtual, Table) · Jotai · react-three-fiber · Bun + Effect · shadcn/ui + Tailwind v4 · Apple Music first, Spotify plannable.

### Known-stale knowledge — verify, do not recall

- **Effect is `4.0.0-rc.112`.** HTTP lives at `effect/unstable/http`, *not* `@effect/platform`. Services use `Context.Service`, not `Context.Tag`.
- **TanStack Start uses `.validator(…)`**, not `.inputValidator(…)`.
- **Jotai's outside-React docs are `published: false`** — the `store.get/set/sub` pattern our state architecture rests on is likely absent from training data. It is real, in `jotai/docs/core/store.mdx`.
- **`html-in-canvas` is Chrome-Canary-flag only** and its WebGL entry point is mid-rename. Progressive enhancement, never a dependency.

---

## Build order

Each stage is shippable and de-risks the next.

1. Provider layer + Effect services, headless — two implementations from day one
2. **Jotai store + panel DOM, no 3D at all** — the honesty checkpoint
3. WebMCP tool registration against that store
4. Glass layer — sidecar, overlays
5. R3F device body + expose flip
6. `html-in-canvas` composite, behind feature detection

> **If webPod is not good as a plain DOM app with a keyboard at stage 2, no amount of three.js will rescue it.**

---

## Open risks — resolve before or during stage 1

| Risk | Why it matters |
|---|---|
| **Can Apple Music remove or reorder playlist tracks?** Unverified. | If not, `pod-edit-playlist` is broken on the *launch* provider and the staged-diff screen loses half its purpose. **Spike this first.** |
| **Album artwork must be proxied same-origin through Bun.** | Cross-origin images will not paint into canvas. Affects Now Playing, Cover Flow, sidecar, every thumbnail. |
| Offline audio support on either provider — unverified. | Changes copy on five screens. |
| `three-html-render` polyfill is referenced by three.js's example but not vendored locally. | Stage 6 only. |

---

## Not drawn

Specified in prose and buildable, but no artboard exists: **first-run / empty**, **offline**, **auth-expired**, the **B08 armed-row confirm** (Sign out, Reset), and the **Agent Console**.

---

## Review posture

Reviewers on this project are expected to be strict, and the reason is empirical rather than cultural.

Three drafts of this design invented a permission model that does not exist. One invented an agent-presence signal the browser cannot supply. One put the human's own feedback underneath their thumb. One gave the agent a voice you could feel. **Each was internally coherent, and each was fiction.**

So treat *"this looks right"* as the beginning of the check, not the end.

The full failure-mode list is in `handover.html` §10. One gate cannot be met at a desk: **the occlusion check must be done on a phone, in hand.**

---

## Suggested first task for the implementation workstream

> Read `docs/workstreams/001-interface-design-handover/readme.md` and `handover.html`.
> Scaffold the repo — Bun + TanStack Start + Tailwind v4 + shadcn + Jotai — with no features.
> Then spike whether Apple Music's API supports playlist track removal and reorder, and report before building any UI.
