# Sticker WebMCP follow-up review

## Verdict

APPROVE — bounded sticker WebMCP correction. No remaining Critical or Major findings. Earlier music approval remains separate.

## Correctness Check

The supplied transcript and lead's native-browser reproduction establish consistent owned inventory but a missing command: tool open revealed only the outer pack, while the human liner action opened already-earned packs. The correction shares the persisted earned-pack opening helper, preserves ownership and locked slots, exposes claimable items and displayed/requested collection state, and returns actionable domain failures through the native tool boundary.

Production `revealStickerLiner` pins the displayed genre before the outer pack can change its default pack selection, then sequences pack and liner animations. Pending claims and collection turns report unavailable interaction readiness. Cancellation/front-face changes clear the transition marker. Grabs require the active prepared open liner and settled turn; placed-source guards remain intact.

Independent verification: 50 tests / 390 assertions across sticker adapter, interaction lifecycle, collection model, native registration and sticker tools passed before the final target-selection patch. After that patch, the affected 40 tests / 326 assertions passed. App TypeScript, scoped ESLint and `git diff --check` passed; final changed helper/component lint also passed. No broad root suite was run for this bounded follow-up.

Lead's live native verification is recorded in `../evidence/sticker-webmcp-followup.md`: ordinary-motion pack and liner settle; the existing mixed starter becomes opened without granting ownership; unknown ID returns recovery guidance; grab, +25% scale (0.25 → 0.3125), +45° rotation and release work. Final navigation reports pending pop and interactionReady false, then displayed/selected pop and an open ready sheet; native grab/release succeeds there. Saved placements remain zero. Browser observations are lead evidence, not claimed as my independent browser execution.

## Findings

Resolved initial review blockers:

- Major: immediately starting the liner animation cancelled the shared pack-opening animation. Fixed with completion chaining; ordinary-motion regression exercises the production helper.
- Major: transition marker survived global cancellation/front-face changes after its callbacks were invalidated. Cleared by those lifecycle paths; regression verifies front cancellation.
- Major: pack persistence was privately busy while page state could report ready. Shared claim pending/error state and direct-operation saving now expose progress and failure; delayed/failed claim regression verifies sealed inventory and retry.
- Major: capturing the old displayed collection before reveal could open that target while reveal selected another unopened pack. Production helper pins the target genre; null-selection/separate-pack regression verifies consistency.

The original missing claim path and opaque domain errors are fixed. Locked stickers remain locked; exact catalogue IDs are required. Type/schema errors and cancellation retain rejection semantics.

## Suggestions

None blocking. Live placement was deliberately not performed because the pasted interaction log is diagnostic evidence, not authorization to apply its placement request; persisted placement behavior is covered by tests.

## Neuve Dogfood Feedback

Not applicable: repository law excludes Neuve. Native browser and visible UI evidence were used instead.
