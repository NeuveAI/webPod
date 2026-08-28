# Dispatch packet — W2 · Jotai store, detent reducer, screen state machine

**Status:** `Ready on W0` · **Lane:** L-C · **Blocks:** W3 · **Blocked by:** W0

## Read first
`scope.md` in full · `literature.md` rows: Jotai, WebMCP · 001 `pm-spec.md` §4.1–4.7 (geometry, menu hierarchy, wheel mapping, the four input paths, the keyboard map) · 001 `readme.md` hard rules 1 and 4 · **`~/code/agentic-context/jotai/docs/core/store.mdx`, which is `published: false` and therefore almost certainly absent from your training data.**

## Correctness target
Device state lives in a Jotai `createStore()` that is fully readable, writable and subscribable **from outside React** via `store.get / set / sub`. A `detent()` reducer turns all four input paths into countable, deterministic movement. A screen state machine models the 001 §4.2 menu hierarchy with push/pop and a highlight index.

## Why the store must be outside React — this is a capability requirement, not taste
Stage 3 registers WebMCP tools whose `execute` callbacks live outside the React tree and must read and write **the same state the UI renders**. State in a component closure is unreachable from a tool handler. That is why `useState` is banned repo-wide with no exception for "local" or "trivial" state — collapsed sections, drafts and transient toggles all become atoms.

**Verification of this specific property:** a test that mutates and reads device state through the bare store **with no React tree mounted**, written to `evidence/w2-store-outside-react.txt`. No tools are registered in 002; you are proving the store can support them.

## Slices
### W2.1 — Store contract, published FIRST
Your **first commit** is `packages/state/src/contract.ts`: the typed atom and selector surface, with TSDoc, and nothing else. W3 is unblocked by this file existing, not by your implementation landing. Publish it before you build anything. This is the only reason W2 and W3 can overlap; if you build first and publish the contract later, W3 sits idle.

### W2.2 — `detent()` reducer, all four input paths
Pointer-arc, scroll, keyboard, touch (001 §4.4). One rule dominates: **arrow keys are exactly one detent, always, with no acceleration ever.** P5 counts detents; an acceleration curve makes counted navigation impossible. Fast-scroll acceleration applies to the *arc and scroll* paths only.

Gate a `source` discriminant (`"human" | "agent" | "system"`) into the reducer signature now, even though nothing emits `"agent"` in 002. 001 §15.2 requires the eventual silence rule to be enforced at **one call site inside `detent()`**, not scattered at call sites — build the seam, leave it unused.

### W2.3 — Screen state machine
001 §4.2 hierarchy; push/pop; highlight index; `Menu` at root produces an elastic bump rather than a no-op. Screen id, highlight index and visible rows must be **enumerable** — a later `pod-read-screen` reports exactly this, so the shape is not yours to improvise.

### W2.4 — Announcement debounce
Detent settles debounced to a **single** `aria-live="polite"` summary 350ms after motion stops. Test: 30-detent flick produces exactly **one** announcement (U13).

## Guardrails
Own `packages/state/**`. Read `packages/providers` types and `packages/tokens`. **Never** write `packages/panel`, `packages/providers/src`, or `apps/web`. No React components in this package beyond the store bridge hook — the reducer and machine are plain TS and must be unit-testable with no DOM.

## Verification
`bun test` covering: one keypress = one detent on every path; no acceleration on keyboard; 30-detent flick = 1 announcement; push/pop restores the exact prior highlight index; store read/write/subscribe with no React mounted. Plus `bunx tsc --noEmit -p packages/state/tsconfig.json`, `bun run lint`, `bun run gates`.

## Decision rules
**Stop and ask the lead** if you find yourself wanting: a `useState`, a timer-based flag, a state name like `CONFIRMING` or `CO_PILOT` or `AGENT_DENIED` (none of these exist — there are exactly five states plus one app mode), or any field that records agent presence. **`grep -rniE 'agentPresent|agentAttached|agentIdle|isAgentConnected'` must return 0** — the browser supplies no such fact and rendering it is this project's worst and prettiest bug class.

## Artifacts
`diary/w2.md` · `decisions/w2.md` · `evidence/w2-*` · review to `reviews/w2-review.md` (lane L-C)

## Commits
`feat(state): store contract` → `feat(state): detent reducer` → `feat(state): screen state machine` → `feat(state): announcement debounce`
