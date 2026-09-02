# W9a exhausted-boundary evidence

Implementation commit: `92e9b00` (`fix(state): silence exhausted wheel boundaries`)

## Authoritative path

- Candidate input: `packages/state/src/detent.ts`
- Acceptance and momentum stop: `packages/state/src/store.ts`
- Published audio seam: `interactionFeedbackAtom`
- Audio consumer: `packages/composite/src/interaction-audio.ts`
- Boundary matrix: `packages/state/src/boundary.test.ts`
- Raw-attempt audio gate: `packages/composite/src/interaction-audio.test.ts`

The store applies candidate rows to the screen machine, measures the actual
highlight delta, and returns/publishes only the accepted prefix. A zero-row
result cannot publish a bump, interaction feedback or announcement. A clamp
returns an armed but directionless, residual-free and non-coasting accumulator.

## Focused green results

- `bun test packages/state/src/boundary.test.ts`: 13 pass, 0 fail, 335 expects.
- State focused set (`boundary`, `detent`, `feedback`): 66 pass, 0 fail,
  683 expects.
- `bun test packages/composite/src/interaction-audio.test.ts`: 26 pass,
  0 fail, 124 expects.
- `bun run --cwd packages/state typecheck`: pass.
- `bun run --cwd packages/composite typecheck`: pass.
- Scoped ESLint: pass.

## Adversarial plants

Each plant was applied alone, observed red, and removed before the committed
green run.

1. Return raw `outcome.clickerTicks` instead of clamping to accepted detents.
   Composite audio: 25 pass, 1 fail. Four outward attempts scheduled 12 voices
   instead of zero.
2. Preserve the raw accumulator after a clamp instead of neutralizing rejected
   momentum. Boundary suite: 6 pass, 7 fail. Direction/history survived,
   coasts remained active and the first reversal lost its immediate result.
3. Ignore the coast's per-detent row trace and infer acceptance from its final
   multiplier. Mixed-tier focused case: 0 pass, 1 fail. The accepted trace
   became `[12, -7]` instead of `[5]`.
4. Publish the screen-machine bump even when accepted rows are zero. Focused
   clock/bump gate: 0 pass, 1 fail; an exhausted wheel attempt published an
   `up` bump.

The exact raw-audio mutation requested by the dispatch is therefore
load-bearing rather than documentary.

## Full repository verification

- `bun run typecheck`: 11/11 projects clean.
- `bun run lint`: pass.
- `bun test`: 1,104 pass, 0 fail, 67,437 expects across 67 files.
- `bun run build`: client and SSR builds pass. Vite retains the existing
  advisory chunk-size warning.
- `bun run gates`: 16 automated pass, 0 automated fail; standing manual U14
  and U15 remain outstanding.

No browser capture was required: this correction changes state acceptance and
feedback, not geometry or rendering. Existing route, wheel physics, Select,
button navigation and audio synthesis remain unchanged.
