# Exact contour query runtime validation

Source be77986 in the user's existing Chrome instance, localhost production build, iPhone16ProMax440×956/DPR2 and DevTools6×CPU. Original trace remains open and stopped. No GPU process crash or replacement browser instance. This checkpoint does not yet close the panel measurement or final lifecycle/media gates.

## Qualified production observations

The temporary bounded Performance-measure patch was applied only after independent C1/C2 approval. Instrumented source and compiled assets are hashed in visible-contour/runtime/instrumented-manifest.json. Reviewed owner source was then restored byte-exactly (SHA96082b58a246d8987eb0608fe2207020e75f7383b80d1e41956f8760a8849c12), rebuilt, and reloaded for the clean measurement. No instrumentation is in the committed application.

An initial standalone cold query published in151ms, with11.1ms worker sweep. The qualified repeatable capture published its first query in118.9ms (101.8ms before sweep,11.2ms sweep,5.9ms after). Four warm transition results arrived in32.3,29.4,35.9 and17.0ms, with6.4–7.6ms sweeps. These are end-to-end presentation ages, not a claim that historical contours are current input geometry. Cold startup remains separately reported; the earlier83–95ms synchronous measurements describe positive fade tasks, not a matched cold baseline.

The qualified instrumented transition observed377 main RAF intervals, maximum18.7ms, p9518.4ms, and no long tasks or long animation frames. The clean repeat likewise observed377 intervals, maximum18.7ms, p9518.5ms, and no long tasks/long animation frames. Both stayed on the worker renderer with no failure. Main-window RAF is not GPU frame rate, and these single qualified runs do not establish a statistical speedup.

The runner requires visible Scale sticker controls before measuring dismissal. Earlier setup attempts ran before reload/entry had settled and did not open the editor; their clean observer output is explicitly excluded. The corrected runner waits for the new document and completed entry, lets the rear gesture settle, and asserts controls before the measured gesture. All observer instances have a12second guard and are disconnected/removed in finally.

The clean CPU profile was explicitly stopped and disabled, with an independent nine-second stop guard. Independent attribution in gpu-post-contour-attribution.md finds no corresponding sampled main contour/visibility/segment chain; the remaining132.551ms sampled offsetWidth cost motivates the separately scoped panel fix. No full trace was started for this check.

## Current-input and placement checks

Native registered get→rotate→release on the existing saved Night Shift produced a visible contour with inert tool-preview root, no alerts, then heldnull/pending0 and byte-equivalent saved placement. Physical active human corner drag changed the contour; touchCancel closed the editor and retained the exact saved placement with no held draft or pending save. The retained cancel JSON reports contour equality false because the editor/path is absent after dismissal; this is not a claim of a mismatched visible contour. No test placement was persisted or user sticker returned to inventory.

Evidence, bounded runners and source/asset hashes are under evidence/gpu-worker/visible-contour/runtime/. GL and final lifecycle/media checks follow; no feature-complete claim is made at this checkpoint.
