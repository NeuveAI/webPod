# Placed sticker editor handover

Status: UI concept rejected by owner before delivery. Superseded by sticker-hud-scope.md and sticker-hud-design-brief.md. Durable wear/material and guarded-write work carries forward; panel approval does not.

The owner requested rotation and wear controls when clicking an attached sticker, and rejected routine ready/stuck notices. The reviewed design adds a compact contextual editor with Rotation, Size and Wear, live draft preview, explicit Apply/Revert and Move/Return actions. Tap selects without lifting; deliberate drag retains physical pickup. Mobile space is measured so the edited print stays visible. Routine success and partial-sync notices are removed visually; actionable errors remain local.

Wear stays with the owned physical sticker through return, re-stick and reload. The material/persistence lane adds validated canonical appearance state under the existing SQLite migration and revisioned placement-write contracts. Original artwork and baked distress remain unchanged at wear0; the effect adds deterministic scuffs to the front material. The editor draft does not mutate saved inventory before acknowledgement.

Read [scope](sticker-editor-scope.md) and [designer brief](sticker-editor-design-brief.md) for the authoritative interaction, compatibility, cancellation and ownership decisions. Independent review lives in [review](reviews/sticker-editor-review.md); engineer diaries are diaries/sticker-editor-ui.md and diaries/sticker-editor-materials.md. Evidence belongs in evidence/sticker-editor/.

Delivery still requires actual normal-size wear and desktop/mobile editor captures, native click/edit/save/reload/return and failure/revision/session tests, affected-package types/lint, relevant restoration/direct-manipulation regressions, independent approval, granular commits and clean-state verification. No physical Safari, universal rendering performance or owner aesthetic approval is inferred.
