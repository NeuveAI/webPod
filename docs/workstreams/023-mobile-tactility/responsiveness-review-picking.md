# Picking peer review

Reviewer: independent scheduling engineer. Target: responsiveness-scope.md picking lane; reviewed separate author's Device.tsx, orientation-picking.ts, sticker-pick-cache.ts and admission section of StickerPackScene.tsx. Read team-orchestration review protocol and full scope. Worker carry edits are a separate review boundary.

## Verdict

Semantic review: no Critical or Major finding. Author diary and retained evidence reviewed. Picking lane APPROVE; combined integration gate remains held pending passing device type/lint after in-flight worker edits settle.

## Evidence and reasoning

The orientation broad phase rejects only rays whose intersections with both full enclosure depth planes are strictly inside the rectangle eroded by at least the entire allowed grab band/corner radius. Convexity makes the intervening ray interior too. Uncertain, parallel and oblique contacts retain exact rendered-shell triangle/material raycasting. The proxy keeps the event object identity expected by first-visible-hit arbitration; actual rendered shells retain their names and geometry for sticker and probe paths. Pinned R3F event source sets internal.lastEvent before intersecting; its recursive Raycaster does not exclude invisible event meshes. Wheel admission separately checks frontInteractive and normal direction, so removing interior shell events does not expose back-facing controls.

Sticker selection still calls the existing intersectStickerPrint alpha/wear/wrapped-geometry path. Reverse indexed traversal preserves topmost placement order. Expensive assembly and shell arbitration now happens after a real ink hit; transparent/empty hits still fall through. The original physical perimeter test is retained. The shared result cache lasts only to the microtask checkpoint, and keys include pointer, immutable scene identity, visibility epoch, host bounds, content/camera matrices and projection. It cannot retain pointer results across normal later events or worker completions. Cold visibility conservatively returns no pick until prepared (worker lane readiness behavior).

Independently executed evidence/responsiveness-picking/check.ts: all560 sampled exact-versus-broad-phase comparisons passed across front/rear, mouse/touch and7 poses. Interior rejections per140 rays:48 mouse and25 touch. The experiment checks that rejected samples contain no permitted perimeter hit and fallback hits retain exact positions/face IDs/proxy ownership. Its offline Bun timings are not production mobile latency or visual evidence.

Initial independent `bun run --cwd packages/device typecheck` and scoped ESLint were blocked by concurrent worker edits: unresolved names in sticker-carry-computation.ts and ref dependency compiler diagnostics in the carry portion of StickerPackScene.tsx. Picking helper/Device lint produced no diagnostics. These failures were immediately reported to supervisor and author; a final rerun is required. Supervisor owns combined build/browser checks.

## Limits

No source-only production speedup is claimed. Retained experiment is finite default-form coverage; conservative geometry argument and unchanged fallback are the broader correctness basis. Real browser touch, transparent/wrapped sticker and rotation smoke remain integration checks, not replaced by this review.

Supervisor subsequently expanded picking implementation to a worker-built triangle candidate index. The above approval covers only the reviewed broad-phase/admission snapshot; final picking verdict is HELD until that new implementation is independently reviewed.

## Triangle candidate index follow-up

Reviewed shell-picking.ts, shell-picking-index.ts, shell-picking-preparation.ts and worker plus Device integration. The private index rearranges triangle references but keeps original vertex IDs; leaf tests call pinned Three Mesh.raycast, then restore original faceIndex/object and original triangle iteration order. This preserves material sides, normals, UVs and ties. Material arrays, partial draw ranges, morph attributes, unsupported position storage and version/identity changes use unchanged source raycasting. Non-position attributes refresh live. Private index geometry borrows attributes but never renders; disposal does not dispose the original shell.

Shared preparation pool bounds one active worker and four waiting jobs. It transfers copied position/index arrays, never original render buffers. Source generation and geometry version checks gate installation; abort removes queued jobs or terminates active worker. Worker instance identity rejects messages from old instances. Idle/timeout/error/messageerror closes the worker. No input command waits for readiness: exact original raycast remains available.

Independently reran expanded check.ts:840 indexed/exact ray comparisons passed on front/rear,7 poses,20 targets and all3 material sides, including control-hole and perimeter locations. Full hit face, UV, normal, point, distance, faceIndex and object ownership checked. Also reran560 broad-phase comparisons. Independent device typecheck and scoped lint pass after carry import cleanup. These offline timings are not a mobile-browser latency measurement. Lifecycle experiment and final author readiness remain pending before the final verdict.

## Final picking verdict: APPROVE

Author corrected the historical diary wording and typed lifecycle probe. Independently ran lifecycle.ts (serialization, active/queued cancellation, stale old-worker success/error ignored, idle termination and overflow), author fallback.ts, and separately authored reviewer-fallback.ts. The latter compares every serialized hit field and object identity against Three for ready, partial draw range, material-array groups, changed position version, pending, unavailable Worker and disposed states. The initial reviewer probe's deepStrictEqual compared vectors from separate imported Three entrypoints; it was corrected to compare all serialized hit data and explicit mesh identity, not class constructor identity. All final probes pass. Device tsc and source/probe lint pass. No Critical/Major picking finding remains; supervisor combined browser/build remains the final integration gate. Review does not approve this reviewer's authored collision recovery.
