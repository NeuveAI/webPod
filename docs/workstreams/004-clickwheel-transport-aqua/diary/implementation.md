# Implementation diary

## Orientation and constraints

- Read the repository law, the complete workstream packet, and the current implementation-spine handover before editing.
- The requested `~/code/agentic-context/` dependency checkout is absent on this host. MusicKit transport work was therefore grounded in the repository's exact typed facade and existing adapter contract tests, without guessing undocumented APIs.
- Did not invoke a Neuve shell, inspect credentials, read `cert/`, access `design.pen`, introduce `useState`, or modify auth/library/workstream-003 implementation surfaces.

## Guidance applied

- `global-patterns`: kept physical input and panel state in the document-wide Jotai store so callbacks and rendered UI share one source of truth; used provider capability checks and deterministic tests.
- `modern-web-guidance`: kept the scrollbar in layout as a reserved grid sibling; measured title overflow with `ResizeObserver` instead of inferring it from text length.
- `interface-craft`: treated center presses as substantive state changes, not changing labels; kept the marquee transform-only and limited motion to the active overflowing title.
- `neuve-motion`: used a transform-only marquee, bounded timing, and a complete reduced-motion fallback that preserves static ellipsis.
- `web-design-guidelines`: preserved clipping for long text, semantic progress/list states, and polite status announcements only for genuine playback states.
- Real-device reference correction: inspected every supplied HEIC (`IMG_2270`, `2271`, `2272`, `2273`, `2274`, `2275`, and `2277`). The selected row alone scrolls; other rows ellipsize; the rail is a narrow bordered white trough with a blue thumb; standard Now Playing owns volume; scrub is a marker on the existing progress geometry; full artwork and queue are content views. The rejected mode/instruction slab was removed completely.

## Implementation

- Added typed shared Now Playing wheel control and intent state, with bounded movement and accepted-feedback publication.
- Routed physical next/previous through one async composite transport callback. Accepted provider transport produces click feedback; declined transport retains list paging.
- Delegated web transport to the active provider queue and returns successful next/previous/play-pause actions to Now Playing. Loading skips are consumed, serialized, deferred until provider readiness, executed exactly once, and cancelled if the provider context is replaced. Loading Play/Pause uses the provider's pause/cancel path.
- Root entry observes the primitive screen stack, so both human Menu navigation and agent root intent pause active playback without discarding the provider item or queue.
- Implemented Apple previous semantics: restart the current item after three seconds, otherwise delegate to the provider queue. A queue transition preserves playing versus paused intent; a paused transition explicitly re-pauses after MusicKit's implicit replacement-item autoplay, while a concurrent pause invalidates a stale playing transition. A playing restart publishes position zero and reasserts playback through the public MusicKit facade.
- Kept `queueRead()` grounded exclusively in MusicKit's live `queue.items` order and position. Reconstructed Now Playing frames therefore recover a truthful bounded count and queue view after root transport without synthesizing missing history from the original source order, including when shuffle makes those orders differ.
- Split async transport outcomes into three truthful paths: no playback context resolves `false` for list paging; successful provider work resolves `true` for feedback; admitted failures or context cancellation reject so Composite consumes silently without paging or a false success pulse.
- Reasserted the last provider-owned paused position through public `seekToTime()` immediately before a targetless resume, covering MusicKit media-element replacement at root navigation.
- Implemented a frame-scoped center cycle: standard, scrub, full artwork, queue. Standard owns wheel volume without presenting a labeled volume screen; scrub seeks through the progress bar; queue is read from `queueRead()` and scrolls within its authoritative bounds.
- Serialized volume/seek writes per provider and rejected late queue reads using sequence and live-provider guards.
- Removed passive shuffle/repeat/heart/star/queue actions, their backing panel state, direct LCD controls, mode chips, and instruction slabs.
- Reflowed standard Now Playing from `IMG_2273`: the title bar contains only the title/battery, the queue counter owns a separate 22px band, artwork and metadata have a 12px gap, artwork sits around y56–144, progress remains around y157, and a flexible timing gap places time labels near the bottom with 10px terminal whitespace rather than an abandoned lower shelf.
- Moved the Aqua scrollbar beside the row viewport in a reserved sibling column for both full and split lists.
- Added a reusable measured overflow marquee. Only the selected/active overflowing title moves, via `transform`; resize/content changes recompute distance; reduced motion restores static ellipsis.

## Changed paths

- `packages/state/src/internal.ts`
- `packages/state/src/contract.ts`
- `packages/state/src/store.ts`
- `packages/state/src/index.ts`
- `packages/state/src/store.test.ts`
- `packages/composite/src/CompositeDevice.tsx`
- `packages/composite/src/CompositeDevice.integration.test.tsx`
- `packages/providers/src/apple/apple-provider.ts`
- `packages/providers/src/apple/apple-provider.test.ts`
- `packages/panel/src/Panel.tsx`
- `packages/panel/src/Panel.test.tsx`
- `packages/panel/src/Panel.integration.test.tsx`
- `packages/panel/src/model.ts`
- `packages/panel/src/model.test.ts`
- `packages/panel/src/list-view.tsx`
- `packages/panel/src/list-view.test.tsx`
- `packages/panel/src/panel.css`
- `packages/panel/src/index.ts`
- `packages/panel/src/overflow-marquee.tsx`
- `packages/panel/src/overflow-marquee.test.tsx`
- `packages/panel/e2e/panel.e2e.ts`
- `apps/web/src/production-device-view.tsx`
- `apps/web/src/production-device-view.test.ts`
- `apps/web/tests/lcd-fidelity.e2e.ts`
- `apps/web/tests/list-scroll-indicator.e2e.ts`
- `docs/workstreams/004-clickwheel-transport-aqua/diary/implementation.md`
- `docs/workstreams/004-clickwheel-transport-aqua/evidence/implementation-verification.md`

## Verification

- Focused transport/state/panel/web suite (nine files): 162 pass, 0 fail.
- Full `bun test`: 1293 pass, 0 fail.
- `bun run typecheck`: 11/11 projects clean.
- `bun run lint`: pass.
- `bun run build`: client and SSR builds pass. The pre-existing large-client-chunk advisory remains non-blocking.
- `bun run gates`: 16 automated pass, 0 fail; U14 and U15 remain explicitly manual.
- `git diff --check`: pass.
- Authenticated browser HMR verification was completed by the root agent on the existing authorized page. The final frozen replay confirmed playing Next, previous-after-three-seconds restart, physical Menu-to-root pause, root Play/Pause resume at the preserved position with a hydrated count, and paused PageDown advancing exactly one position while remaining paused at time zero with media ready and no diagnosis. The live provider queue exposed eight truthful bounded rows, queue-wheel selection advanced, and the rendered modes contained zero rejected instruction slabs. This implementation agent did not open, close, or replace that session.

## Residual risk and handoff

- Authenticated transport and bounded-queue verification is complete. The remaining manual U14 thumb-occlusion validation is explicitly owner phone-in-hand work; the browser test encodes the `IMG_2273` geometry ratios and writes a canonical screenshot plus sanitized measurement JSON when the Playwright evidence environment is available.
- Proposed path-scoped commit message: `Implement provider-owned clickwheel transport and reference-backed Now Playing modes`
