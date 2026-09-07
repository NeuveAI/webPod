# Sticker implementation diary

Status: Implementation stable for independent final reviews; all nine tools mounted in production. No commit, push, worktree, protected editor/domain/mesh/server writes. `sticker-collection.tsx` only adds the live handler registry. `sticker-interaction.ts` receives the explicitly approved narrow animation lifecycle guard.

## Source and ownership

Read full scope, sticker-dispatch, decisions, spec-research and native-evals before code. Loaded global-patterns and Jotai guidance, queried modern-web-guidance via Bun (`agentic-javascript-tools`), and read interface-craft/web-design-guidelines skill instructions. No new UI component or visual design introduced; existing physical handlers retained. Current draft and spec packet override the guide's stale legacy fallback snippet. Read canonical current domain, editor constraints, collection model, carry/spring commands and queued runtime persistence. Concurrent edge-wrap changed `isStickerPlacement` to physical rear center acceptance; reused that helper without editing it.

## Architecture and tools

Definitions: `packages/tools/src/stickers.ts` supplies the nine tools listed in D14 plus shared mutation lease. `interactions.ts` optionally accepts that lease; `apps/web/src/webmcp.ts` installs one lease across core and sticker tools and adds real sticker page state. Native registration remains unchanged current-draft behavior.

`apps/web/src/sticker-webmcp.ts` reads the full catalogue/real inventory and mounted action seam. Real `stickerInteractionAtom.previewPlacement`/`sourcePlacement` are the only draft/origin state. Collection pickup creates the existing physical carry pose; placed pickup invokes the actual keyboard lift. Editor constraints govern rotation/wear; place preserves width and uses real awaited commands.place(placement, exactOriginal). Release discards transient draft only. No opening, earning or deleting a pack/placement as an incidental effect.

Schemas: direction `next|previous` wraps; source `collection|placed`; stickerId must be a real owned available catalogue entry. degrees -360..360 delta clamps through existing editor helper. amount 0..1 normalized nonnegative wear delta. x/y 0..1 normalized rear artwork center, with current silhouette validator rejecting corners outside the physical rear while permitting edge-wrap. Unknown fields, missing fields, NaN/infinity and out-of-range values reject before actions.

Page state distinguishes real pending persistence, preparation, animation, errors, rear admission and human gesture. Actual prepared denominator supports percent; elapsed clocks come from observed command/save starts and freeze on completion. Reads do not change time origin. A shared pending save survives timeout/remount until the actual command settles; the test seam injects only the bounded wait duration.

## Strict reviewer fixes

- Synchronous abort during settling publication: recheck signal/mount/generation/rear immediately before persistence, replay already-aborted listener, discard draft and pending token without admitting write. Regression proves zero save calls.
- Late save completion after unmount: presentation and operation completion obey owner disposal; shared pending token alone survives and clears on real settlement. New mount clock remains untouched.
- Background inventory reference changes no longer invalidate unchanged authority. Source drift or ownership/opened/appearance changes invalidate carry.
- Passive human detail selection is not carry; explicit grab may supersede it. Real human gesture remains blocked.
- Real pending token and clock survive caller timeout and remount; repeat save/grab rejected until actual settlement.
- Shared animation now guards intermediate, reduced final and animated final synchronous supersede, including between multi-atom publications. No stale callbacks/requeued frames.

## Verification

See evidence/sticker-checks.txt for exact commands/results and source hashes. New deterministic suites: 17 passed, 86 assertions. Broader sticker/tool suite: 61 passed and one protected concurrent test failed because it retains pre-edge-wrap bounds (`packages/state/src/stickers.test.ts:18` expects width .35, x .9 invalid). Lead notified; implementer did not change protected expectations.

Root typecheck: 12/12 projects clean. App typecheck and scoped lint: exit 0. Production build: exit 0. Native eval lane separately reports all16 tool discovery and 11 browser cases; final rerun needed after latest lifecycle fixes and recorded separately. No native shim, debug route or credentials used.

## Handoff and limits

Reviewers must approve both lanes before completion. Lead handles final full-repo tests/lint and attribution of other task's legacy bounds expectation. Stage group: sticker definitions+shared lease, app adapter+mounted seam+lifecycle guard and their tests; native fixtures separate; workstream evidence separate. No commits made.
