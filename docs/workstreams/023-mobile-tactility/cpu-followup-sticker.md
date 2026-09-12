# Native sticker keyboard CPU follow-up

The recording exercises the real sticker keyboard path. It exposes a large first-interaction initialization stall in collision snapshot serialization and carry-worker context dispatch. The subsequent four keys do not repeat that serialization in this capture.

Source: native export `Trace-20260911T001443.json.gz`, kept outside Git. Metadata confirms iPhone 16 Pro Max and 6× CPU throttling. The lead reports a focused earned sticker peel control, then Right, Right, Up, Left, Escape, with no Enter commit. There are exactly five keydown/keyup pairs. The main-thread profile spans 6,475.440 ms; the native selected range was approximately 6.77 seconds. A second worker profile is present and deliberately excluded from main-thread attribution. Recording stop and export completion were confirmed by the lead.

Actual sampled paths include sticker-collection onKeyDown → admitIntent → supersedeStickerInteraction/updateStickerInteraction; PeelingPrint mounts and requests carry preparation. The cancel path includes lower → animateStickerValue. Focus/blur events occur around the last key; earlier key handlers did execute. This is not merely a recording of keys sent to an unfocused page.

## Main-thread evidence

Keydown event durations, in order: 1,534.785, 136.649, 61.275, 57.450 and 69.434 ms. Total: 1,859.593 ms. These are dispatch durations, not INP or input-to-paint latency.

The first event alone contains 529.497 ms of carry dispatch self samples and 606.747 ms of collision serializeNode self samples, aggregated across recursive nodes. These are disjoint self costs. Carry dispatch inclusive time is 1,203.951 ms, which already contains serialization and must not be added to those self totals. transferPaperGeometry contributes 24.216 ms self over keydown intervals; GC contributes 214.733 ms. All four later keydowns have zero observed dispatch/serializeNode self samples under these exact symbol matches.

Source explains the first-event concentration. `packages/device/src/sticker-carry-preparation.ts:63` initializes context only when there is no worker. At line 81 it copies rear attributes with transferPaperGeometry, calls visibility.snapshot and posts the full context without a transfer list, preserving live buffer ownership. `packages/device/src/sticker-collision.ts:146` snapshots the tree through recursive serializeNode (line 28), allocating serialized bounds/nodes. Later ordinary jobs at carry-preparation line 84 send the pose input. The large dispatch self time is compatible with structured-clone/send work, but this sample trace does not isolate the postMessage native subspan; it must not be labeled an exact postMessage timer.

Two distinct mount → dispatch parent stacks appear during the first event, one under a different Fiber effect traversal. Together with development JSX/debug frames, this is consistent with development effect replay duplicating initialization. Production may pay fewer initializations, but recursive snapshot creation and untransferred structured cloning are real code paths. This evidence supports investigating cached/worker-owned collision context and initialization lifetime; it does not authorize removing correctness data or transferring live rendering buffers.

Five application tasks exceed 50 ms, one for each keydown; the maximum is 1,536.440 ms. The separate 3,534.016 ms task containing CpuProfiler::StartProfiling is excluded as instrumentation startup. The focused sample window runs from first keydown through final keyup plus one second (3,123.138 ms), so unrelated idle time does not dilute the first-event stall.

Sanitized symbols, parent stacks, per-event self totals and timings are retained in `evidence/cpu-followup/sticker-summary.json`. The same absolute-timestamp sorting and nonoverlapping sample weighting as the rotation analysis handles negative V8 deltas. Inclusive costs overlap; sample weights are estimates. No raw URL queries, tokens, source payloads or private art are retained.

Limits: this is a development capture under CPU emulation, not native phone or production performance. It covers keyboard preview placing and cancellation, not pointer peeling, commit/sticking, or interaction with existing placed-sticker wear. It does not measure GPU execution or validate visual quality. No implementation or browser changes were made during analysis.
