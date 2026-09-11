# Independent sticker warmup and resource review

Verdict: **APPROVE the corrected eight-source CPU025 milestone below.** One confirmed Major admission defect was independently reproduced, corrected by the author and independently rerun. No remaining Critical or Major source finding was confirmed in this boundary. This is not whole-host, visual, GPU performance or manual acceptance. Native packet/carry interaction, all appearances, fallback and matched6× traces remain required with the lead. The reviewer made no application edits, browser actions or commits.

## Exact source boundary

Final author archive: `evidence/gpu-worker/sticker-warmup/manifest.json` and its eight `frozen/` source copies. Hashes independently checked against the worktree:

| File | SHA-256 |
|---|---|
| `packages/composite/src/native-sticker-warmup.ts` | `e864e4d13a1996e66848c4d3d43ae83b2c57d5fa5607475773f3b481ea31009e` |
| `packages/device/src/sticker-warmup-renderer.ts` | `bd283fcfa65606597e64f9d9d8c3a4aea01153f41148aa56f64c10c597708c46` |
| `packages/device/src/sticker-prepared-damage.ts` | `0569f05a3336fea11e53648455d6afd51fbe5339faaf5272ec647e9dcfb5d949` |
| `packages/device/src/sticker-transaction-broker.ts` | `b05a560fd272a4a74e729251792136799cc4264e8412a484e18654822dd1f44c` |
| `packages/device/src/sticker-transaction-data.ts` | `f28a4f8b3b0787620e4ded4498236a10435adcd29e8f160a88f921e6daae5f0a` |
| `packages/device/src/sticker-transaction-worker.ts` | `797b998a54f2dc4e8870ae754322d992b6d6f03682094776ae69e12dedefca54` |
| `packages/device/src/sticker-material-nodes.ts` | `bac746d29fe60abe503de9eb3de7a2b0f8a86c3606530460c3f0ea76bdab9866` |
| `packages/device/src/sticker-wear-nodes.ts` | `38cc33e87e171af22e21866ab576ebed43909d4a77f6f250792e3b4da7cfcff0` |

CPU009's earlier prepared-damage exports are preserved. The optional contour input, private render-damage protocol, broker accounting and node input type narrowing are CPU025's reviewed deltas. Moving native pack/equipped/carry acquisition adapters, host/worker orchestration and StickerCollection motion integration are not included in these eight source hashes.

## Major finding, corrected

`sticker-transaction-broker.ts:193` private acquisition originally enforced its32-owner limit only after awaiting cold canonical preparation. One hundred same-key calls retained100 ports/promises/abort listeners while reporting privateOwners0 and rejecting none. This inherited path was explicitly in the current bounded private-resource scope, so it blocked source approval despite normal catalog success.

The author now claims a private slot before canonical acquisition/await, with exactly-once release on acquisition failure, cancellation and eventual lease retirement. Byte accounting remains a separate pending/delivered phase. Independent retained `reviewer-private-admission.ts/json` now proves100 requests produce68 immediate rejections,32 admitted cold owners and final zero entries,workers,private owners/bytes. The same script failed on the initially frozen source. Broker hash `b05a560...` supersedes initial `399e230...`.

## Correctness and ownership review

The default GL `preparePrint` path still computes exact contours; only the explicit warmup option omits them. Damage key, alpha, field and GPU texels are unchanged. Borrowed geometry wrappers and registered prepared resources remain owned through release. The node-material/wear changes narrow accepted TypeScript fields only; no shader expression, sampler format or material value changes.

Renderer-private damage is copied by the existing canonical worker using the exact GPU Uint8 bytes and dimensions/sticker ID. Main never detaches its buffers. Default private acquisition still sends the full result. Pending private copies reserve twice their selected storage, delivered copies once until explicit lease release. Releasing a delivered lease's redundant canonical pin does not release its independent private bytes; canonical eviction/worker shutdown can coexist with a live independent renderer copy.

The accounting function deduplicates main backing ArrayBuffer identities across retained inputs/results, charging full backing allocations for views. Separate worker canonical results and independent private transfers remain charged. Prospective admission, execution and eviction share the same calculation. Same-producer contour references require the exact field object and pin that canonical entry through completion/cancellation. Producer loss clears that optimization and follows the existing exact cooperative fallback. Active cancelled native work remains accounted until completion/retirement. These counters bound managed buffers, not all JS/browser/GPU heap.

Warmup keeps one active preparation, one latest source and one in-flight frame. Source/finish identity controls generation, while callbacks refresh without redoing the work. Success requires the matching compile ACK; stale/reentrant ACKs cannot ready a newer source. An empty replacement barrier retires the prior compiled material/resource owner before another full catalog. Query-only ownership releases after accepted ACK; renderer-private leases persist until replacement/retirement. Failure/disposal aborts preparation, and sent leases remain held until explicit renderer retirement. Finite preparation/ACK timers reject stalled ownership.

The worker warmup validates three appearance variants per artwork, actual material mesh count, environment presence and byte/count admission, and delegates real pack/node-material assembly. Read-only host seam inspection confirms `backend.compile(candidate.root,camera,scene,abort.signal)` uses the current camera/scene, old warm owner disposal precedes accepted ACK, and host termination calls rendererRetired. This is not approval of all moving worker paths or actual GPU compilation/display.

## Independent verification

All commands use Bun. Evidence directory is `docs/workstreams/023-mobile-tactility/evidence/gpu-worker/sticker-warmup/`:

- `reviewer-private-admission.ts`: independent actual-worker correction reproduction described above.
- `private-damage.ts`:9 actual-worker checks, default full payload27,648 bytes versus exact GPU4,096 bytes, private isolation, canonical eviction with live private copies, pre-abort and cancellation during copy. Reran after correction.
- `accounting.ts`:7 actual-broker checks: shared offset8,192-byte backing storage versus independent buffers; separate canonical outputs; exact reference, cloned-but-equal fallback, cancellation pin and forced producer loss. Reran after correction.
- `catalogue.ts`: independently reran after correction; first10 real PNG-alpha artworks plus full8-print packet and current/candidate carry coexist at79,201,888 transaction bytes,9,061,272 paper bytes and6,660,240 carry bytes. All owners/workers/bytes return to zero. Controlled image interfaces and exact worker alpha are not native bitmap/GPU fidelity or timing evidence.
- `owners.ts`:14 actual preparation/material-owner checks, including default contours versus omitted warmup contours and matching damage/geometry.
- `worker-guards.ts`:8 helper rejection/disposal checks.
- `lifecycle.ts`:16 controller checks, including actual60-second preparation and ACK watchdogs, source/callback refresh, supersession, rejection, reentrancy and query-only release.
- `bun test packages/device/src/sticker-texture-cache.test.ts packages/device/src/sticker-program-preparation.test.ts packages/device/src/sticker-alpha.test.ts packages/device/src/sticker-contour-visibility.test.ts`:21 pass,0 fail,17,730 assertions.
- Device/composite/web typechecks and eight-source/reviewer-proof scoped ESLint pass. Device typecheck and broker/proof lint reran after the correction. Logs: `/tmp/cpu025-review-*.log`.

## Packaging and remaining acceptance

Independently checked every relative import using `git cat-file -e HEAD:<resolved-path>`: the six standalone sources are sticker-transaction-broker.ts, sticker-transaction-data.ts, sticker-transaction-worker.ts, sticker-prepared-damage.ts, sticker-material-nodes.ts and sticker-wear-nodes.ts; all imports exist at HEAD. The prepared-damage baseline is retained as sticker-prepared-damage.before.txt with SHA256 `29058552f8cf7556733ce727394f60934bb1198e9a25d22a8019eb3cea5cfdad`; it already includes the three host-owned exports. Those preserved declarations are explicitly visible in this final file, but this review does not certify unrelated exports in other host modules. The two new warmup modules import still-untracked native resource/pack assembler modules, so stage them with the separately reviewed complete dependency set rather than importing unreviewed host code implicitly. The end-to-end proof scripts likewise use host adapters outside this eight-source acceptance; their current results are useful integration evidence, not standalone-commit portability claims.

Lead-owned native appearance/interaction/fallback/performance acceptance and the explicit manual process ledger remain open. No ticket metadata, controlled compile ACK, program construction or passing budget proof substitutes for those gates.

## Explicit whole-file export acceptance

Follow-up narrow review independently compared the archived prepared-damage host baseline against HEAD: removing exactly `export` before `PreparedPrint`, `PrintInput`, and `preparePrint` produces HEAD byte-for-byte. These are the only host-owned changes in that baseline. Both interfaces remain the same structural types; exporting the existing function creates no new producer, invocation, state or disposal behavior. Its caller owns the returned release as before. The native pack/equipped/carry callers consume that same existing implementation rather than copying it.

**The whole current `packages/device/src/sticker-prepared-damage.ts` is explicitly APPROVED**, including all three export declarations and the separately reviewed optional contour change, at SHA256 `0569f05a3336fea11e53648455d6afd51fbe5339faaf5272ec647e9dcfb5d949`. No other unreviewed logic is hidden in the delta. This closes the whole-file staging ambiguity; no exclusion patch is necessary. It does not approve the moving native callers themselves.

## Independent per-art query lifetime delta — APPROVE

Reviewed after the author freeze against HEAD2856a5a8031de57b372c6236aa4d39cc27630d96. Exact frozen two-source manifest /tmp/webpod-warmup-lifetime-freeze/manifest.json independently matches current bytes:

| File | SHA256 |
| --- | --- |
| packages/composite/src/native-pack-resources.ts | a187375328e1002f425679ba21924e4d81f6ef97fecf434d08e6485603983feb |
| packages/composite/src/native-sticker-warmup.ts | be36a81a1cb5b739d65e153d8ea430573a6dcf3531d5aaa383f0a2b0ca8009a7 |

No Critical/Major finding remains in this bounded delta. No application source changes were made by this reviewer. Prior full host/native performance approval is not extended.

The new materialOnly path is opted into only by invisible warmup and rejects contour-enabled, reused-visible-owner or non-print recipes. After each art's independent geometry/damage/private bitmap capture, query owners are released and maps cleared. The separate transferOwners set retains only wire identities/transfer flags, so later transferred() still marks all delivered resources despite empty query maps. Bitmap cleanup captures its renderer wire rather than the query pair. Private lease callbacks remain held in owners until exact frame replacement/renderer retirement; early query release is not early renderer release or readiness. Default visible preparation retains its original query maps and ownership through current/candidate lifetimes.

The existing aggregate64MiB guard now consumes captured byte totals plus the per-art peak, rather than measuring cleared collections. Cumulative counting is conservative across arts; the adapter and brokers retain their existing fixed artwork/private/global caps. The scalar peak is the measured per-art query-buffer footprint, not total process peak heap. No producer, geometry/texel algorithm, material variants or compile-ACK state machine changed.

Independent reruns:

- `REVIEW_WARM_ACK_MS=1000 bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/sticker-warmup/reviewer-cold-overlap.ts`: ten IDs (A01–A05/B01–B05), existing eight-print packet with C01/E01 neighbors, held1s compile ACK, all admitted. Settled transaction accounting77,816,960bytes,17private owners; paper9,061,272bytes. These are retained settled accounting, not sampled peak heap. Both failure fields null and final owners/queues/bytes zero.
- `per-art-lifetime.ts`: actual workers/ports/node assembly with declared controlled decode/bitmap boundary; one main artwork owner at a time, empty query maps before compile, exact private geometry attributes and GPU texels versus visible default, existing visible geometry retained through failure and cancellation, exactly-once bitmap closure and final zero. Query peak27,488bytes/cumulative82,464bytes in the three-art small fixture.
- `owners.ts`:14 actual ownership/material checks pass, all three appearance variants retained and readiness published only after matching ACK; final paper/transaction zero.
- `lifecycle.ts`:18 checks pass, including actual60s preparation and ACK deadlines, abort/late result, stale/reentrant readiness and retirement, unchanged64MiB rejection/exact-bound acceptance. Preparation is controlled in this lifecycle proof; actual preparation is covered separately above.
-17 existing program/texture-cache/paper tests pass,75,163 assertions (/tmp/cpu025-query-lifetime-tests.log). Device/composite/web typechecks and both source plus authored proof scoped ESLint pass. Frozen hashes rechecked after runs.

These two files are stageable together against the stated HEAD: their imports and required existing resource contracts are already present. The review does not silently include other uncommitted host/resource work. Existing current-Chrome full native cold entry, packet interaction, resize/fallback and6× acceptance remain lead-owned. The earlier unhealthy emulation interval is not used as a passing or failing performance comparison here.

Tracking handoff: source-linked review evidence for existing CPU025, refs SRC-CLI-1789139460322-1/-2 and the scope's invisible warmup lifetime paragraph. Parent maintains the requested board/manual gate; this source approval does not mark the overall architecture complete.
