# Sticker merge implementation

Resolved against HEAD 3288542 and incoming origin/main 8f7e1d8, following merge-mobile-scope.md. No staging or commits by this engineer.

The two conflicted files retain both contracts. In sticker-interaction.ts, superseding and cancelling an interaction clear the artist-prefetch branch's sticker collection transition marker while preserving incoming haptic cancellation and computation-epoch advancement. Reset, animation admission, rear departure, and idempotent artwork-ready publication retain the incoming implementation. In sticker-collection.tsx, combined imports preserve revealStickerLiner/openEarnedStickerPacks and stickerComputationEpochAtom. The guarded run callback keeps its incoming AbortSignal and epoch subscription, with transition clearing retained on admission.

Physical drops still capture the final pointer sample and await placeCurrentStickerDrop's worker-backed resolveDrop inside the guarded transaction before persistence. Human touch pickup/peel/detach/place haptics remain at human event boundaries; tool opening, grabbing, and editing do not trigger pulses. The tool's coordinate-based placement retains its existing persistence/expected-source lease and does not substitute a synchronous geometry computation.

Reviewed adjacent auto-merged production-device-view.tsx, sticker-editor.tsx, sticker-editor-model.ts, sticker-contour-query-model.ts, sticker-drop-transaction.ts, and orientation visibility handling. Production commands retain asynchronous projection/drop resolution with cancellation, the contour query adapter retains current-owner microtask publication and clear-on-teardown, and editor queries retain separate human/tool sessions. Incoming motion authority subscription and guarded reentrant synchronization remain intact. No heavy renderer/worker implementation, resource budget, pixel density, graphics quality, or hidden-document owner was replaced.

Prior branch behavior remains: tool opening pins the active genre, reveals pack then liner in sequence, awaits earned-pack persistence, and reports pending claims and failures. Available and claimable stay distinct; locked stickers are never granted. Navigation pending/active collection readiness, closed-liner guards, actionable native errors, and zero remaining earning time for owned stickers remain intact.

Added one cross-contract regression in sticker-interaction-lifecycle.test.ts: an exact captured release sample starts an asynchronous drop; opening the earned liner supersedes that owner, advances the computation epoch, aborts its signal, and clears the pending collection marker. Its late fitted result cannot save, while the new pack and liner reach their final open positions. Existing non-reduced animation, sealed-pack persistence/retry, stale-save, and source-identity tests remain passing.

Verification on the resolved source:

- `bun test apps/web/src/sticker-webmcp.test.ts apps/web/src/sticker-interaction-lifecycle.test.ts apps/web/src/sticker-runtime.test.ts apps/web/src/sticker-collections-model.test.ts apps/web/src/sticker-editor-model.test.ts apps/web/src/sticker-editor-carry.test.tsx packages/tools/src/stickers.test.ts`: 75 passed, 0 failed, 525 assertions.
- `bunx tsc --noEmit -p apps/web/tsconfig.json`: passed.
- Scoped ESLint on both resolved files, lifecycle test, sticker-webmcp, editor/model, contour query model and drop transaction: passed.
- No root test discovery. No browser interaction or performance claim by this engineer; lead owns production build and runtime verification, reviewer owns final approval.

Read current AGENTS.md and assigned incoming GPU/worker, final acceptance and panel measurement contracts. Applied modern-web-guidance with bunx per repo law (search and efficient-background-processing guide); existing explicit visibility cancellation remains canonical, without adding CSS containment or another lifecycle owner. The global-patterns and jotai-state skill files were read; their referenced legacy agent-context markdown files remain absent at both documented and relocated candidate paths. Repo instructions and installed Jotai usage remain the implementation reference.

Source frozen after conflict resolution; subsequent changes only added the regression and this record. Lead may stage once independent review passes.
