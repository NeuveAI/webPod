# Decisions

Binding owner decisions/defaults D1-D6 are in `scope.md`. Implementers append concrete decisions and evidence here before relying on them; do not alter owner's criteria.

## D7 — current draft type boundary

The local spec `7b3f50f31848b529e69bedbbdf8da0edccba055f` is byte-identical to the current official draft at remote `50c4b7fd6c4402731271649bc544b662b061ed44`. External eval dependency `webmcp-types@0.1.3` is stale: its callback lacks execution signal, annotations omit consequentialHint, and registered inputSchema differs. A narrow explicitly sourced current-draft boundary interface with contract tests is permitted; do not use stale installed types as authority. See evidence/spec-research.md.

## D8 — ownership split and baseline

Core implementer owns slice A except orientation controller. Orientation implementer owns `apps/web/src/device-preview-orientation.ts` and targeted tests only; core owns device-page wiring. They agree on typed seam before edits. Production-device-view and all sticker files remain protected. Baseline `bun run typecheck` passed all 12 projects on the initial shared working tree (including existing sticker changes).

## Core implementation decisions

- D13: Tool names use `webpod_` prefix: list_status, navigate_list, select_item, page_state, click_wheel, rotate_ipod, flick_ipod. Navigation count is 1..1000; x/y rotations are relative degrees in [-360,360]. Positive next moves down; previous up; no wrapping. Non-mutation reads remain callable during movement.
- D9: Use a mounted controller registry keyed by the existing device store, rejecting ambiguous multi-device owners. This preserves concurrent `production-device-view.tsx` work. Export the existing device physics hook to bind the real per-canvas owner; do not synthesize trusted DOM events.
- D10: Agent SFX is audible subject to existing browser activation and mute. Provenance remains agent; haptics remain actual human touch only; system reconciliation stays silent. Physical press duration80ms and transport waiting bound30s. Cancellation prevents future actions and publication; it cannot undo provider side effects already accepted before cancellation.
- D11: Page progressPercent stays null because inspected library and playback contracts expose no trustworthy total denominator. A page already loading before an observable operation start reports null elapsed/start; subsequent known transitions have wall-clock timestamps, frozen on completion/error. Provider replacement cannot inherit prior selection time.
- D12: Only workspace dependency edges were introduced. Aligning bun.lock workspace metadata allowed frozen installation despite unrelated existing dependency minimum-release-age resolution failures; no third-party dependency versions changed.

## Sticker implementation decisions

- D14: Nine additional names: `webpod_open_sticker_pack`, `webpod_close_sticker_pack`, `webpod_navigate_sticker_collection`, `webpod_sticker_list`, `webpod_get_sticker`, `webpod_release_sticker`, `webpod_rotate_sticker`, `webpod_add_sticker_wear`, `webpod_place_sticker`. Collection navigation uses existing wrapping order; requested selection is reported separately from preparation/display readiness. Open invokes the existing reveal command and intentionally never invokes pack-claim persistence.
- D15: Production collection mounts a narrow live callback registry. Tools reuse its reveal/close/switch/lift/place callbacks, shared Jotai interaction preview/source fields, and current `constrainedStickerEdit`/`isStickerPlacement`. No parallel sticker inventory or draft model. Collection grab requires the current earned slot and open UI; placed grab keeps exact source pose. Full catalogue includes every locked genre. Wear delta uses normalized 0..1; rotate delta uses -360..360 and actual existing -180..180 clamp. Position is normalized artwork center on the physical rear silhouette; canonical edge-wrap validation remains the authority.
- D16: One shared mutation lease covers all sixteen tools; reads remain available. A real accepted sticker save retains a shared pending token/start clock until persistence actually settles even after caller abort, a 30-second tool wait limit, or component remount. Runtime persistence receives exact expected source for placed moves. Abort cannot undo committed inventory; pre-persistence abort is rechecked after synchronous state publication. Background inventory updates retain the draft only if ownership/opened state and exact original pose or original collection wear remain authoritative. New human intent supersedes presentation through existing generation ownership.
- D17: Sticker page state is nested under the global page state's `stickers` attribute and returned in sticker snapshots. It reports rear admission, human gesture, real prepared count/total and percent, actual pending saves and elapsed operation/save time. Unknown starts remain null. Passive detail selection is not reported as a held sticker. The shared sticker spring now checks animation and gesture generations between store publications and before completion/requeue, preventing synchronous cancellation from resurrecting motion.
