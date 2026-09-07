# Review: 016 — Sticker interaction behavior

## Status: review in progress; implementation not yet declared stable

No final disposition is given for incomplete sticker files. Scope consumed: sticker-dispatch.md, scope.md, decisions.md through D13, core reviews, current UI collection/carry helpers, editor constraint/same-pose APIs, and serialized runtime persistence seam. Protected editor/domain geometry files are read-only reference contracts; their unrelated edge-wrap implementation is not under review.

### Current blocking observations

- [MAJOR] Cancellation after settling-state publication still admits persistence (`apps/web/src/sticker-webmcp.ts:132`, following state publication before abort-listener attachment). Independently reproduced with the real store and adapter: grab PW-C01 from an opened prepared collection; subscribe to stickerInteractionAtom and abort the execution signal when stage becomes settling; place(.5,.5). The callback still invokes persistence and the result is `{saveCalls:1,outcome:'AbortError',placements:1}`. This abort occurred before persistence admission, so the “already accepted writes may finish” exception does not apply. Recheck signal, controller lifetime and interaction generation immediately before calling place; ensure cleanup clears the pending token without initiating a write.
- [MAJOR] Old successful save completion updates a new operation (`apps/web/src/sticker-webmcp.ts:141`). After unmount/remount, isCurrent() prevents old carry animation but complete() still updates the global stickerOperationAtom. A new owner's active preparation/save can therefore be marked completed/saving:false by old work. Completion needs operation/owner identity protection; error paths should receive the same protection.
- Prior observed inventory-identity cancellation at requireHeld/stopInventory dropped unchanged carries on ordinary listening/import snapshots. Implementer has begun replacing this with held-sticker authority comparison; source patch seen, final tests pending.

### Required final proof

Actual shared reveal/close/navigation behavior (opening does not claim sealed packs), full catalog including unowned genres, sealed/locked/source constraints, current displayed/requested preparation distinction, exact origin and width/rotation/wear restoration, current canonical edit/placement validity, persistence failure/retry/conflicts, inventory/provider replacement, abort/timeout versus accepted write ownership, flip/human/unmount and nested publication cancellation, and common core/sticker mutation lease. Independent focused tests/app tsc/scoped lint follow stable declaration. Existing animation helper generation behavior is also being checked because synchronous cancellation must not revive an abandoned frame or completion callback.

### Neuve

Unavailable and inapplicable per repo AGENTS.md; no board or Neuve shell.

### Interim re-review observations

Initial new adapter/tool suite independently passes12 tests69 assertions; app tsc exit0. Scoped lint finds3 forbidden non-null assertions at packages/tools/src/stickers.test.ts:46 (implementer notified).

Pre-persistence cancellation now rechecks signal/generation/rear and its regression proves no save call. complete() now guards disposed, and a delayed-write/remount regression proves no overwritten new clock. Inventory authority comparison retains background refreshes and invalidates changed origin. Passive detail selection is distinguished from carry; read status now includes rear/human admission. These patches are not a final approval until stable full proof.

Further requested checks: replay an already-aborted signal into transient cleanup when abort occurred before listener installation; preserve visible pending-save status after remount while the shared editor pending token is still live; timeout should reject caller but retain real save lease and prevent retry until settlement. Animation helper now has animation/gesture guards after publications; intermediate/final and reduced-motion tests are being added. No geometry/editor implementation review requested.
