# Direct sticker manipulation handover

The latest six owner requests are implemented on the existing product route. The [designer brief](direct-manipulation-design-brief.md) preceded source changes; [scope](direct-manipulation-scope.md) records ownership, invariants, rejected intermediate states and required gates. This handover is a delivery record, not a waiver of independent performance/runtime review.

## User behavior

The pack appears only after validated ownership and the active collection's five artwork/material variants are prepared. Unknown or empty inventory does not produce a packet or tease. A previously usable collection survives background refresh; the current sheet remains while another prepares. Existing painted rear stickers remain movable and cancellable even if a locked artwork in their pack is delayed. Artwork failure exposes a compact retry without advertising an unready packet.

Pull the packet lip, then pull the liner through its notch. Direct pointer/touch input moves the objects; the large click-only slide instruction is removed. Keyboard actions remain available. Close hands off when the liner visibly reaches zero instead of waiting through an invisible spring tail.

Grab a sticker on the actual rear to peel it, move it or return it to its own sheet seat. Pickup uses rendered geometry and artwork alpha, preserving transparent-space device flicks. Its saved size, rotation and grab offset carry through the move. Rear release visibly advances contact until the sticker lies flat. Return blends into the smaller sheet seat and uncurls above the liner; static copies remain hidden while a transient print owns the image. Reduced motion retains direct carry and usable target feedback.

Move/remove use existing serialized, revisioned Start placement writes. The source placement remains authoritative until success. Invalid drop and cancellation restore it; failed save preserves it; a409 refresh adopts the server's current placement. An older write can reconcile inventory without reviving a dismissed carry. No grant economics, authentication, schema, private credential boundary or immutable sticker artwork changed.

Partial/failed sync is now a compact contextual status with truthful, quieter copy. It distinguishes known ownership from failed empty inventory and offers retry where useful. “Voiced” was interpreted as product tone, not unsolicited spoken audio. Actual desktop/375px status captures are in the browser evidence.

## Preparation and measured performance

The [performance diary](diaries/direct-manipulation-performance.md) records actual Chrome DevTools MCP profiling. Baseline first reveal had a 146 ms animation frame and approximately 130 ms render task, while three warm cycles were near 60 Hz. The old close had about 417 ms between the liner appearing closed and packet movement. INP alone missed the first-use mid-animation stall. Those observations supported preparation and phase-handoff corrections; they did not justify reducing geometry.

Active/pending asset subscriptions are bounded. Textures, alpha data and material variants prepare before admission. The narrow pinned-Three preparation adapter captures validated program handles and retains cloned program owners for the active subscription. Unmount, context loss, timeout and failure cancel bounded polling and release owners. It avoids the pinned compileAsync timer's unsafe re-read after disposal; this version-specific dependency is documented and independently reviewed. No-extension readiness is not presented as a universal guarantee of completed GPU work.

The MCP server rejected requested raw-trace exports under its workspace policy. Its after-change trace summary also selected the wrong origin despite explicit page targeting; those INP/insight results are excluded. Actual DevTools MCP input/evaluation on verified owned pages supplied the accepted observer and renderer measurements. See [after report](evidence/direct-manipulation/performance/after-report.md) for provenance, rejected attempts and exact limits; a matched trace/INP comparison or saved raw trace is not claimed.

Ready packet/liner geometry reached draw submission about 16.8/16.9 ms after movement; clean first-ready RAF gaps peaked at 17.6/17.5 ms without a long animation frame. Closing now hands off about 16.3–16.5 ms after visible liner zero, compared with roughly 417 ms before. Three warm cycles had no 50 ms long frame/task, although the full observer window includes one 33.74 ms RAF gap. An idle open packet's draw count stayed unchanged for 22.2 seconds. These are bounded Chrome/M4 Pro measurements, not compositor scanout or physical Safari certification. Startup 459 ms and rear-admission 59 ms outliers remain recorded separately; the work does not claim all startup frames are smooth or that driver caches were cold. Independent final functional/performance review approves this frozen candidate.

## Final validation and limits

Reviewed source candidate: `58fa8839f150a8fe61175ca416d58ee442fd421b0801b9bd05a4bbca7387c261` across 380 files. Implementer native route checks passed 188 assertions in 35.74 seconds; 27 focused tests passed 78,150 assertions (mostly geometric vertex checks); app/device/state typechecks and scoped lint passed. Exact build hashes, commands and captures live in evidence/direct-manipulation/browser/. Tests use native Start routes, cookies and temporary SQLite with synthetic upstream dependencies; account-specific live Apple behavior and physical Safari hardware are not certified.

Independent review rejected the initial hidden retry, disappearing preparation/incorrect resize admission, duplicate static print, occluded own-seat carrier and geometrically ineffective press. Later source and visible-frame rechecks accepted their corrections, including phone movement with delayed own-sheet artwork and a normal-size press sequence. [Final review](reviews/direct-manipulation-review.md) remains the authority for renewed independent tests and all six acceptance dispositions. Passing an assertion count or setting a material/spring property is not a substitute for the visible sequence.

Independent final validation passed 188 native assertions, three canonical startup tests, 34 targeted source tests, scoped lint and changed-package typechecks. The lead also ran the full root typecheck: 12/12 projects clean. The source fingerprint remained unchanged after validation.

Implementation commits: `4a01b56` — Keep sticker program preparation bounded and cancellable; `5cc196c` — Make sticker packs and placed stickers directly draggable. This handover and its evidence are committed separately.

Existing art legibility and stylized material limits remain explicit; no photographic realism or owner taste approval is inferred. Test servers and temporary profiling snapshots were cleaned up; the owner’s authenticated localhost:3000 tab remains intact. The delivery closeout verifies the final worktree after committing these records.
