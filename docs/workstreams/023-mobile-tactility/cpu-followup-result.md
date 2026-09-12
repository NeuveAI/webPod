# Remaining CPU bottlenecks after PR 4

PR 4 merged into main at `0f9732a56123b4e56ef1deb91888fc44a92a3275`. Investigation branch: `codex/device-cpu-profile`. Application code is unchanged by this investigation; the pre-existing external `.gitignore` edit is preserved.

## Current-browser evidence

The captures used the user's existing Chrome tab `http://localhost:3000/webpod`, iPhone 16 Pro Max emulation, 440×956 and 6× CPU slowdown. The initial configured DevTools MCP connection pointed to a different instance and was not used as evidence. Native Computer control selected the correct window. Its stalled Performance panel was reopened and 6× throttling restored before capture. DOM inspection confirmed DPR 3 and a1320×2664 canvas. This is a development server, not a production-build benchmark.

Rotation: six keyboard inputs produced keydown handler durations455,206,224,172,168,30ms. React development instrumentation contributes heavily. Renderer resize configuration is present during interaction; setSize accounts for73.3ms self samples inside keydown intervals. Competing Canvas and observer DPR ownership is a source-level candidate, but the trace does not include the numerical resize arguments and does not prove an oscillation. The minimal investigation/fix boundary is one shared numeric DPR source while retaining the existing physical-pixel resolver, not reducing pixel density.

Sticker handling: a short keyboard preview/cancel capture exercised the real sticker handlers. The first move took1534.8ms; the following events136.6,61.3,57.5,69.4ms. First-move self samples include606.7ms in recursive collision serialization and529.5ms in dispatch. These are separate self categories; dispatch inclusive time includes serialization and must not be added to them. Ordinary subsequent poses did not show those first-start costs. Development effect replay also affects this path. Dispatch self time may include native structured cloning, but the samples do not isolate that subspan.

Source inspection identifies an avoidable round trip: a collision root received from a worker is restored, then recursively serialized again for carry-worker initialization. Retaining its existing immutable serialized snapshot with collider lifetime avoids that repeated allocation. This targets startup and restarts; ordinary worker pose requests already send small inputs. The cooperative fallback currently requests snapshots per pose and would benefit from the same cache.

A separate source-level candidate remains repeated transfer of unchanged wear geometry, which loses identity and can miss damage-texture caching on placed-sticker carry. This capture used an earned sticker's keyboard placement preview and cancellation; it does not validate pointer peeling, previously placed sticker wear, continuous pointer dragging, or release fitting. Those paths must not inherit these timing claims.

## Next optimization boundaries

1. Reuse the immutable collision snapshot across carry initialization/fallback, with disposal and replacement invalidation.
2. Resolve Canvas DPR through one owner and measure whether resize work disappears at identical output resolution.
3. Preserve stable wear-resource identity across worker messages, then capture actual placed-sticker dragging.
4. Compare the same gestures in a production build before deciding how much React propagation/scene preparation remains an end-user bottleneck. Do not infer GPU time from JS samples or use these development costs to justify lowering effects quality.

Detailed independent evidence: `cpu-followup-trace.md`, `cpu-followup-motion.md`, `cpu-followup-stickers.md`, and sanitized JSON summaries in `evidence/cpu-followup/`. Raw native trace exports remain in Downloads, outside Git.

## Capture cleanup

Both completed native recordings were stopped. The sticker capture placed its stop in the same operation's finally block. Both export confirmation steps were completed and the resulting file verified: `Trace-20260911T001443.json.gz`,2364520bytes. Final native state showed Record value0 with no active Stop control or pending save dialog. The attempted remote sticker recorder stalled on a connection prompt; its owned helper/child processes were terminated and the pending prompt cancelled. That attempt is excluded from evidence. No profiling process started by this investigation remains running, and no deployment was made.
