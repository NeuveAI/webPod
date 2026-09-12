# Visible contour query owner — Phase C1

Scope: the dedicated exact-query worker, its main owner, and the approved discriminated pose stamp. This does not activate UI integration or establish browser performance acceptance. Phase A's exact kernel and Phase B's canonical descriptor/budget remain unchanged.

## API and coherence

`createStickerContourQuery()` exposes `request`, `clear`, `subscribe`, `getSnapshot`, and `dispose`. A demand captures an adopted print identity/revision, validated canonical contour descriptor, prepared contour, nine local quad samples, borrowed collider snapshot/revision, exact matrices/rectangle, lineage, and pose metadata. The caller must supply one coherent adopted capture; requested future placement data is not valid input.

Native stamps carry the actual render authority fields. GL stamps explicitly describe monotonic query-capture sequence/layout/scene/resource revisions, without inventing native motion epochs. Selection/source, backend, collider, visibility, and layout/rectangle changes are hard barriers. Ordinary matrix changes retain the current result while one executing and one latest demand progress. Result stamps are validated before publication. Current interaction authority remains separate from this historical presentation result.

Equivalent geometric demands are deduplicated independently of transport sequence. One thousand unchanged captures with new sequence values dispatch one query; one thousand changed poses retain only an executing sample and latest sample. External-store snapshots retain identity between real pending/result/error transitions. `clear` is for hard barriers, hide, or unmount, never ordinary pose-effect cleanup. Errors latch until explicit clear/retry.

## Ownership and bounds

The existing canonical transaction producer sends an exact private contour through a MessagePort. Collider copying starts after an initial yield and uses 2,048-element checkpoints through the existing cooperative scheduler, then transfers each private buffer once. Borrowed arrays remain attached and unchanged. Native typed-array allocation itself remains indivisible; checkpoints are not a hard per-device timing guarantee.

The existing 128 MiB collision budget charges twice the collider bytes while its borrowed/private pair is retained, plus a conservative structural allowance for current/candidate output, split paths, temporary lists, and result clones. This allowance is not an exact JavaScript heap-size claim. Contour private bytes remain charged by the existing transaction authority. Dispatched resource pairs discard captured descriptor references and retain only primitive matching keys. Shared collider references survive print replacement until their final owner releases.

There is one active query, one latest demand, one result credit, and at most current/candidate resource pairs. Publications occur in one RAF callback. Replacement release acknowledgements prevent further resource installation until ownership drains. Missing install/query/release acknowledgements retire the worker after the bounded deadline. Termination precedes settled lease/reservation release; cancelled cooperative copies remain charged until their continuation settles. There is no synchronous full-sweep fallback.

## Retained checks

Run from repository root:

```sh
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/visible-contour/owner/check.ts
bun run --cwd packages/device typecheck
bun run --cwd apps/web typecheck
bunx eslint packages/device/src/sticker-contour-query.ts packages/device/src/sticker-contour-query-worker.ts packages/device/src/sticker-contour-query-data.ts docs/workstreams/023-mobile-tactility/evidence/gpu-worker/visible-contour/owner/check.ts
```

The actual query and transaction module workers/private MessagePorts pass 31 cases: exact synchronous-kernel result parity, empty contours, sequence-only dedupe, latest-pose drain, collider reuse, borrowed-buffer integrity, stale generation rejection, send failure, missing result/release ACK, throwing observers, cancellation during initial copy, capacity rejection, and final zero ownership. Controlled timers/query holding exercise lifetime boundaries; this is not browser throughput evidence.

The default production assembly has 200,913 triangles and 20,267,280 typed snapshot bytes. A current/candidate query plus concurrent existing collision build peaks at **70,885,700 / 134,217,728 bytes** in the shared ledger and returns to zero. This combines the real default assembly with representative synthetic-alpha production print geometry; it is not a full-catalogue heap measurement. Results and exact frozen source hashes are under `evidence/gpu-worker/visible-contour/owner/`.

## Runtime handoff — proposed temporary instrumentation only

No instrumentation was added. For lead-approved, archived-and-restored measurement, use bounded owner-local Performance marks/measures at these existing boundaries:

- Demand capture (`Captured.at`, before preparation/copy): existing `stamp.submittedAt` already includes cold startup and copy wait. Record only generation/sequence and scalar resource revisions.
- `prepare`: before/after `yieldSteps(copySnapshot(...))`, private transaction acquisition, and each `installed` ACK. These distinguish initial yield/allocation/copy, producer delivery, and worker installation. Record scalar copied/reserved bytes only.
- Worker: existing `startedAt` and `completedAt` already delimit the exact sweep with comparable epoch-based timestamps.
- Main result receipt and RAF publication: temporary marks around the actual state publication give delivery/RAF wait and `publishedAt - submittedAt` end-to-end age. Pair this with a bounded main-thread profile/LoAF observer; worker sweep duration alone is insufficient.
- At admission/replacement/clear, read `stickerCollisionBudgetSnapshot()` and bounded counts of current/candidate/active/latest units. Use a fixed record limit and capture deadline, remove marks/listeners afterward, and restore source hashes. No global production API is needed.

Compare the same production gesture and CPU throttle against the prior 83–95 ms synchronous stalls. Report first-query age separately from warm samples, publication cadence, main-task attribution, and current-input correctness. Zero main sweeps and bounded ownership are source/test gates; acceptable measured contour age, active human/tool behavior, fade, hide/resume, and GL/native parity remain integrated runtime gates.

### Prepared temporary measurement patch (not applied)

`owner/runtime-instrumentation.patch.txt` modifies only the main query owner. `runtime-instrumentation-manifest.json` records the exact original and proposed instrumented SHA-256. Before application, verify the original hash, archive that exact source byte-for-byte outside the working source tree, and run `git apply --check` against the patch. If the reviewed source changes, regenerate against the reviewed source rather than forcing this patch. Apply only after the lead authorizes the runtime measurement window. Never commit the instrumented source.

The temporary owner starts a 15-second window on its first demand and records at most 100 Performance measures (four per successful publication, at most 25 complete samples). It adds no timers, global API, listener, worker messages, or dense data. Measures are `wp-contour:published-age`, `worker-sweep`, `pre-sweep`, and `post-sweep`. Details contain only generation, sequence, collider reservation bytes, and output reservation bytes. Reserved collider bytes include borrowed/private accounting, not merely copied bytes. Exceptions from measurement cannot change application failure behavior.

Capture after a clean owner mount and collect within the window using the existing evaluation surface:

```js
performance.getEntriesByType('measure')
 .filter(entry => entry.name.startsWith('wp-contour:'))
 .map(entry => ({name:entry.name,startTime:entry.startTime,duration:entry.duration,detail:entry.detail}))
```

After collecting, clear only these four measure names with `performance.clearMeasures(name)`. Source restoration removes all future measurement; no pending instrumentation timer needs cancellation. Restore the archived original, verify its SHA-256 against the manifest and verify an empty source diff. Rebuild/reload the clean version before final performance acceptance. Keep the capture's bundle/source provenance separate from clean measurements. This patch has been prepared but has not been applied or runtime validated; scoped type/lint checks are required when it is applied.

## Independent review correction

Candidate admission capacity rejection now rolls back only that candidate and preserves the exact compatible current result/private owners. It latches a recoverable error and drops pending demand, preventing automatic admission loops; explicit clear/retry recaptures after capacity is available. Cold capacity failures and fatal protocol/send/watchdog failures retain the prior retirement behavior. Hard barriers still clear incompatible results. Three added cases prove exact current identity/reservation retention, 1,000 rejected repeats without dispatch, and successful explicit retry/final zero. The reviewer’s independent actual-worker capacity reproducer now reports `retained:true`.

Renderer-owner replacement must dispose its old query owner (C2 projection lifetime), rather than treating native motionEpoch as a renderer generation. Assembly hard barriers use actual collider identity/revision; C2 clears saved-placement source changes. Compatible sceneRevision/ordinary motion alone is not a hard barrier.

Private-admission follow-up also fills all 32 real private-owner slots after a current result, then rejects a candidate after its pair allocation. The allocated output reservation and shared collider reference roll back exactly, current identity remains, a hard session barrier clears it immediately, and final ownership reaches zero.
