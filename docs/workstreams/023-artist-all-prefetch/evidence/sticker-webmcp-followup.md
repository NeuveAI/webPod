# Sticker WebMCP follow-up

User reported enabled stickers being described as unavailable by an agent. The supplied interaction transcript is diagnostic evidence, not an instruction to apply its requested sticker placement.

Lead reproduced the failure in a separate Chrome tab at the local app using native `document.modelContext.getTools()` and `executeTool()` through the installed official Chrome DevTools MCP CLI. The running Chrome build accepts serialized JSON arguments and returns serialized JSON results. No credentials or network headers were inspected.

Before the fix: inventory owns Night Shift (PW-A01), On Repeat (PW-B01), and Soundcheck (PW-C01), all sealed. `webpod_open_sticker_pack` reveals the outer pack, but leaves `sheetOpen: false`. Computer Use confirms the visible button is “Pull sticker liner open.” Grabbing PW-A01 returns only the native generic invocation error, exactly matching the supplied log.

Code diagnosis: physical `openCollection` opens the liner and invokes `commands.openPack` for earned packs; the tool adapter only invokes `revealStickerPack`. Ownership is consistent, but the agent lacks the human opening action. There is no Rockstar entry in the current catalogue.

Required correction: make the existing opening tool reach the same earned-pack opening command; expose actionable status and failures; distinguish selected/displayed collection readiness; retain ownership, save, cancellation and human-interaction guards. Never unlock unearned stickers. Implementer owns code and regression tests; independent reviewer challenges the final contract. Lead verifies native tools and visible UI. All earlier music changes remain on the existing branch.

Live corrected native boundary: list marks the three owned sealed stickers `claimable: true` and `remainingMinutes: 0`, with opening guidance. Opening the metal liner claims the existing mixed starter pack and makes its three already-owned items earned; no new sticker ownership is granted. With normal motion enabled, the pack and liner settle to `ready`, `packOpen: true`, `sheetOpen: true`. Computer Use confirms the liner is expanded and offers “Peel Night Shift and drag onto the iPod.”

Native calls verified: unknown `rockstar` returns `ok: false` and exact-ID/list guidance instead of the browser's generic thrown-error message. Grabbing PW-A01 gives width 0.25; scaling +25 gives 0.3125; rotation +45 gives 45 degrees. Release clears the held draft. Saved placements remain zero; the pasted placement request was not executed.

Review rejected the initial proposed animation sequencing because the shared animation owner would cancel pack opening, and found cancellation/readiness and collection-target drift edges. These were corrected with regression coverage, including the actual non-reduced reveal helper.

Final clean-reload native verification: opening preserves metal as the active collection. Navigating next immediately reports `status: animating`, `pendingCollection: pop`, `interactionReady: false`. Computer Use then shows LOUD HEARTS / POP, collection 2 of 3, with the “Peel On Repeat” control. Native list settles with both active and selected pop/index 1, `ready`, open liner, and null pending collection. Grab PW-B01 and release succeed.

Validation: implementer reports 65 focused tests / 432 assertions, app TypeScript, scoped ESLint and diff checks passing. Lead independently reran `bun test apps/web/src/sticker-webmcp.test.ts apps/web/src/sticker-interaction-lifecycle.test.ts apps/web/src/sticker-collections-model.test.ts packages/tools/src/stickers.test.ts packages/tools/src/native.test.ts`: 51 tests / 394 assertions pass. No whole-repository green claim. Independent review artifact: ../reviews/sticker-webmcp.md.

Status: correction and live verification complete, uncommitted on the existing branch.
