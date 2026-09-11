# Bounded production and DEV runtime observations

The valid production run shows startup work followed by a substantially steadier observed entrance. A successful native sticker pickup/drop still includes a141ms main task after pickup. These observations identify a profiling target; they are not GPU timings, proof of autonomous entrance, a baseline speedup, or full-goal acceptance.

## Provenance and faithful coverage

Only the latest valid `/tmp/webpod-production-same-origin-entry-probe.json` is used: same-origin production client `index-DuyC5bju.js`, sourcef89be7f, effective worker. The separate3001 and initial same-origin error/landing runs are excluded. The peel input shares the entry's performance.timeOrigin, and the parent reports successful native NightShift drag from(131,433) to(220,150). Rotation is a separate DEV navigation/run and cannot be used as a production before/after comparison. Parent owns browser conditions and confirms current mobile440×956/DPR3/6×; these JSON files do not independently record the emulation setting.

Retained inputs, original observer text and offline analysis are under evidence/gpu-worker/production/. `analyze.ts` computes SHA256 and nearest-rank quantiles into summary.json; scoped ESLint passes. No browser or application changes were made by this analyst. The collectors were bounded and stopped/removed by the lead.

The observer records consecutive main-window RAF timestamp differences, not worker/GPU presentation timestamps. Its first phase record is created on the first RAF (even when the stage is absent), so absolute RAF timestamps can be reconstructed from that first phase timestamp plus successive deltas. The script verifies every later phase timestamp matches the reconstructed sequence within0.00001ms. It does **not** add deltas to observer installation time: first RAF timestamp may precede the callback's performance.now, as the steady probes demonstrate.

No2000-frame or300-entry cap was reached. PerformanceObserver support failures are swallowed and not recorded; disconnect does not drain takeRecords. Thus “zero recorded” entries is the correct wording, particularly at the interval end. Event observation uses a16ms threshold, so absence does not establish zero input cost. Phase timestamps are first RAF observations, not exact mutation times, and contain no logical elapsed or full hint completion mark.

## Production entry

Observer installed at204.7ms and stopped at17,290.9ms after navigation:17,086.2ms total. First RAF timestamp419ms. Stage warming first observed at3,220.1ms, entering at4,884.8ms, DOMcomplete at6,820.2ms; effective worker and failure null. Warming→entering observation gap1,664.7ms; entering→DOMcomplete1,935.4ms. DOMcomplete is the1900 logical-ms public settlement boundary; the authored hint continues to3460ms. It must not be labeled full entrance/hint completion.

| Observed window | Fully contained main RAF intervals | p95 / max gap | Recorded task evidence |
| --- | ---: | --- | --- |
| Before stage warming,204.7–3220.1ms |92 |116.5 /217.5ms |Startup work; includes a task crossing the warming boundary |
| Warming observed,3220.1–4884.8ms |54 |134.7 /298.2ms |Remaining startup/resource/provider work |
| Entering observed,4884.8–6820.2ms |109 |31.5 /35.3ms |No recorded long task or long animation frame; four gaps above33.34ms, none above50ms |
| After DOMcomplete,6820.2–17290.9ms |628 |18.5 /18.7ms |No recorded long task or long animation frame |

Across startup before entering,15 unique long tasks total1,768ms, maximum293ms;18 long animation frames were recorded. Window overlap lists in summary.json may include the same boundary-crossing task twice; do not add their counts. All startup long tasks finish before observed entering. Whole-run p95 is18.6ms across883 intervals, but more than10s of the run is after DOMcomplete, so that aggregate hides startup gaps and understates the entrance-specific p95.

The largest startup LoAF script is a293.2ms MusicKit `Response.json.then` callback around3211.1ms; its record attributes13ms forced style/layout. Other startup records include MessagePort callbacks labeledD, FrameRequestCallback labelsmb/c, and worker-message handlers from the minified app bundle. These are broad callback boundaries, not source-component attribution. No claim that a particular geometry/React component consumed their entire duration is supported. The early startup's unobserved pre-install/first-RAF portion also prevents a complete navigation CPU budget.

The entering window is encouraging evidence for this one healthy production run under the reported conditions. It does not demonstrate worker progress while main is blocked: the current entrance still receives main-clock samples, and this observed entering window has no long main task to test stall independence. No GPU frame/pixel alignment measurement is included.

## Production NightShift pickup/drop

Observation spans3,695.6ms;215 stored RAF intervals, p9517.6ms, maximum133.8ms. There is one recorded141ms long task starting373397.5ms and one149.2ms LoAF with93.1ms blocking. The LoAF attributes141.2ms to `MessagePort.onmessage`, minified functionD in `src-BV2gYAs6.js`, with zero attributed forced style/layout. This does not identify the internal work performed or imply all style/layout costs were zero.

Pointerdown starts373363.5ms, begins processing8.7ms later and finishes after6.6ms of handler processing. Its browser-reported event duration is144ms; that is not144ms of pointerdown handler execution. The141ms task starts18.7ms after pointerdown processing ends, overlapping the delayed presentation portion of the interaction. Pointerup reports32ms duration,7.6ms input delay and12ms processing. Both events share an interaction ID, but this small sample is not a page-level INP assessment. Synthetic/CDP gesture success and parent-observed placement persistence are functional context, not trusted-human activation or universal latency evidence.

Next target is bounded attribution inside the identified MessagePort callback during pickup, distinguishing scheduler work, query/resource adoption, projection and other subscribers. Haptics owns that instrumentation. Preserve timing before/after instrumentation and remove the probes; do not blame an arbitrary component from functionD alone. GPU rendering and the private carry worker are not timed by this main PerformanceObserver record.

## Separate DEV rotation

Observation spans3,637.1ms;214 stored main RAF intervals, p9518.5ms, maximum34.7ms, three gaps above33.34ms and none above50ms. No long tasks or LoAF entries were recorded. Pointerdown reports24ms event duration (9.7ms input delay,7.9ms processing); pointerup40ms (30ms input delay,3.7ms processing). Effective renderer worker, failure null.

This supports responsive main callback scheduling for one DEV rotation gesture and its surrounding rest, not measured GPU FPS or a production comparison. The main observer cannot prove the worker submitted a changed frame for each callback, show screenshot fidelity, or test behavior through a prolonged main stall.

## Remaining acceptance boundary

Retain startup, visible entrance, post-settlement rest and sticker interaction as separate windows. The immediate next investigation is the141ms post-pickup callback, alongside source-mapped startup callback attribution if cold-entry latency remains a concern. A matched production baseline and bounded worker/frame/presentation evidence are needed for speedup or GPU claims. Full native peel/stick semantics, exact LCD/FX/raster appearance, input/media activation, fallback/context-loss and final supervised acceptance remain separate required gates. This note neither approves its author's prior motion implementation nor marks the architecture complete.

## Valid PR5 production baseline comparison

Baseline exact commit4cc7f4a7f5964d04733c5bb6a1e0b23cde0d072c, treeac6307b4ddcb453ce7bbf070b1d9c8efffd0fe84, isolated git-archive production build `index-B26XPa1g.js`. Source/build manifest provenance is retained in evidence/gpu-worker/baseline-build.json and compact production/baseline-provenance.json. Valid inputs are `/tmp/webpod-baseline-entry-probe.json` and `/tmp/webpod-baseline-peel-frame-probe.json`, copied and hashed by the analyzer. Parent confirms same origin, Chrome phone440×956/DPR3/6× and actual placement1 after the peel. No source/server/browser changes were made for this analysis.

**Invalid baseline rotation is excluded:** `/tmp/webpod-baseline-rotation-frame-probe.json` had zero input events and no actual movement. It supplies no rotation comparison and is not included in summary statistics. The earlier current DEV rotation remains a separate observation, not a matched production baseline.

Both entry collectors reconstruct phase timestamps consistently from first RAF plus deltas. Baseline warming first observed3216.5ms, entering5366ms, DOMcomplete7931.5ms; current production warming3220.1ms, entering4884.8ms, DOMcomplete6820.2ms. Provider/session/network/cache and one-run ordering remain uncontrolled; the navigation-relative difference cannot all be credited to renderer work. Baseline does not expose the new renderer/failure DOM fields, so absent JSON fields are not a failure signal.

| Visible entrance observation | PR5 baseline | Current f89be7f |
| --- | ---: | ---: |
| Entering→DOMcomplete observed interval |2565.5ms |1935.4ms |
| Fully contained main RAF intervals |71 |109 |
| RAF median / p95 / maximum gap |32.9 /133.3 /166.6ms |16.7 /31.5 /35.3ms |
| RAF gaps above50ms |8 |0 |
| Recorded long tasks during entering |5;419ms total |0 |
| Recorded long animation frames during entering |6 |0 |

This paired run supports a narrower, useful conclusion: the current **observed visible entrance** had substantially fewer main scheduling stalls than this PR5 baseline. It is not just an aggregate dominated by post-entry idle frames. It still does not measure GPU execution or prove autonomous motion through a main stall. DOMcomplete remains public1900ms settlement, not full3460ms hint completion. Baseline’s longer observed entry is consistent with the retained clamped timeline experiencing larger callback gaps; it does not justify changing the curve.

Startup before entering had29 recorded baseline tasks totaling3283ms, versus15 current tasks totaling1768ms; baseline maximum553ms versus current293ms. These are separate startup observations with cache/provider/decode/compilation conditions not isolated. Both continue to have material startup work. No generalized cold-start speedup percentage is claimed from these two runs.

| Same requested NightShift drag | PR5 baseline | Current production |
| --- | ---: | ---: |
| Observer span |4078.1ms |3695.6ms |
| Recorded long tasks |3;422ms total;292ms maximum |1;141ms total/maximum |
| Recorded long animation frames |5 |1 |
| Main RAF p95 / maximum gap |18.6 /283ms |17.6 /133.8ms |
| Pointerdown reported event duration / handler processing |144 /11.4ms |144 /6.6ms |
| Pointerup reported event duration / handler processing |112 /48.4ms |32 /12ms |

The same drag script requested(131,433)→(220,150), and placement was confirmed by the lead in both cases. Actual event timestamps differ: baseline down→up1348.1ms, current968ms. Scheduling and probe spans therefore are not identical even with identical requested coordinates; treat this as two paired real interaction examples, not a statistically controlled benchmark. The pickup's reported144ms event duration did **not** improve in these samples, despite a shorter handler and lower maximum task later in the gesture. The current141ms post-pickup task remains an unresolved responsiveness target and must not be hidden by the lower overall tail.

The baseline has a292ms task starting97.2ms after pointerdown, followed by71ms and59ms tasks after pointerup. Current has the141ms task34ms after pointerdown. These relative placements describe observation windows only; minified callback boundaries do not identify component ownership. Task/sample/LoAF timings are main-thread observations, not worker or GPU durations. Further bounded attribution and repeated matched production gestures should confirm whether the observed improvement persists across artwork, cache state and failure recovery before any broad performance claim.

### Verified baseline rotation, awaiting matching current production

The replacement `/tmp/webpod-baseline-rotation-verified-frame-probe.json` is valid and retained separately. Parent verified reset-front with no packet/placements, a trusted CANVAS down/24moves/up without cancellation, actual rear after the action, zero placements and removed probe. This replaces only the invalid rotation evidence; it does not turn the earlier current DEV run into production.

The valid baseline spans4064.8ms with225 main RAF intervals, p9533.3ms/max50.8ms. No long task was recorded; one87.8ms LoAF includes40.6ms attributed to a minified pointermove callback. Pointerdown reported40ms (12ms input delay,22.8ms processing); pointerup80ms (21.7ms input delay,6.2ms processing). Matching current production rotation is pending, so no comparative verdict is drawn yet.

### Matching verified current production rotation — regression remains

The valid current input is `/tmp/webpod-native-production-rotation-verified-frame-probe.json`, with matching retained observer and gesture proof. Parent verified complete/worker/front before, trusted CANVAS(410,450)→(28,450) down/moves/full up, rear afterward, worker retained, failure null and probe removed. Raw input required a0.75 coordinate scale after navigation; actual CSS target coordinates were checked. The earlier `/tmp/webpod-native-production-rotation-frame-probe.json` hit HTML at(546,600) and is **invalid/excluded**. No heavy builds occurred during the valid run according to the lead.

| Verified production front→rear | PR5 baseline | Current native |
| --- | ---: | ---: |
| Observer span |4064.8ms |3822.7ms |
| Stored main RAF intervals |225 |210 |
| RAF p95 / maximum gap |33.3 /50.8ms |32.4 /68.2ms |
| RAF gaps above50ms |1 |2 |
| Recorded long tasks |0 |2;71ms and67ms |
| Recorded long animation frames |1 |3 |
| Pointerdown event duration / processing |40 /22.8ms |80 /64.6ms |
| Pointerup event duration / processing |80 /6.2ms |64 /5.7ms |

This pair does **not** support an across-the-board rotation improvement. Similar p95 masks a worse current maximum gap and more expensive initial input: pointerdown processing is64.6ms versus22.8ms and recorded event duration doubles40→80ms. Pointerup is shorter in this sample, but does not cancel the down/move regression. These are single verified gestures with different actual down→up spans (baseline1183.1ms/current1049.2ms), not a universal statistical result.

The current71ms task starts50975.6ms,8.1ms after pointerdown's50967.5ms timestamp. Its73.9ms LoAF records:

- DIV.onpointerdown, minified `o` in `src-BV2gYAs6.js`:23.4ms at50985.4ms.
- CANVAS.onpointerdown, minified `D` in that bundle:37ms at51008.9ms.

The67ms task starts51053.7ms,86.2ms after the down timestamp. Its70.6ms LoAF records two move callbacks:

- CANVAS.onpointermove, minified `k` in `src-BV2gYAs6.js`:45.2ms at51054.8ms.
- CANVAS.onpointermove, minified `i` in `index-DuyC5bju.js`:21.1ms at51100ms.

All four records attribute zero forced style/layout. This narrows the next target to the exact down/move handler chain, including why both event owners execute and which internal operations dominate. It does not yet prove duplicate raycasting, identify geometry cost, or establish that the shared handler itself is unnecessary. The third73.9ms LoAF later in the run contains no script attribution and no long-task record; do not assign it to those handlers.

The earlier DEV rotation's zero observed tasks must not be used to override these matching production results. Keep current native default/full-goal acceptance separate until this measured down/move regression and the141ms pickup callback have been attributed and addressed or otherwise resolved with concrete evidence.
