# Production CPU correction follow-up

The paired captures support removal of the observed long main-thread stalls, **not an overall pickup-latency win**. Current exact productiona822fecf2544841688b27d943bb1393fc302dba1 was built from its archived tree, clientindex-CC2h7_xA.js. Lead verified real current-Chrome440×956,DPR3,6×CPU gestures, nativeworker/no failure, actual rear after rotation and placement1 after first cold NightShift pickup/drop. This analysis made no application/browser/build changes.

| Bounded observation | Prior f89 production | CPU fixes a822 |
|---|---:|---:|
| Rotation observer span |3822.7ms|3635.6ms|
| Rotation mainRAF p95 / max |32.4 /68.2ms|31.9 /49.2ms|
| Rotation observed longtasks |2 (71/67ms)|0|
| Rotation down event / handler |80 /64.6ms|48 /29.6ms|
| Rotation up event / handler |64 /5.7ms|24 /4.7ms|
| Peel observer span |3695.6ms|3654.3ms|
| Peel mainRAF p95 / max |17.6 /133.8ms|18.5 /65.7ms|
| Peel observed longtasks |1 (141ms)|0|
| Peel down event / handler |144 /6.6ms|184 /6.3ms|
| Peel up event / handler |32 /12ms|32 /19.1ms|

These are individual matched-purpose examples, not repeated statistical trials. Rotation drag duration changed1049.2→885.4ms; peel968→926.9ms. Cold cache/provider/audio state is not fully controlled. The hover change suppresses captured moves, so the smaller initial down cannot be attributed exclusively to that fix. Current rotation still has8mainRAF intervals>33.34ms (prior6); its largest gaps48.6/49.2ms occur after release. One56.4ms LoAF has no attributed scripts and starts174ms afterup. No GPU frame/submission timing was measured.

## Pickup timeline and unresolved presentation

All times here are relative to current pointerdown105440.9ms:

- Input processing starts+16.7ms; handler ends+23.0ms after6.3ms work. Public down processing is already short.
- The72.7ms LoAF begins+47.9ms,24.9ms after handler end. Within it, MessagePort callbackD starts+48.9ms and runs26.2ms; timer callbacks start+76.4/+102.2ms and run15.4/8.1ms. All report zero forcedstyle/layout. Script labels do not prove which timer is a carry copy checkpoint.
- That LoAF begins rendering at+120.2ms and style/layout at+120.6ms. Its total attributed script time49.7ms is spread across callbacks; no individual50ms task and zeroLoAF blockingDuration are compatible with a delayed render opportunity.
- MainRAF gap65.7ms spans+45.8→111.5ms. A later34.7ms interval occurs+2161.7ms, well after the926.9ms drag. The full capture is phasecomplete/worker throughout, so this is interaction work, not entrance.
- EventTiming reports184ms duration. Subtracting the16.7ms delay and6.3ms processing gives approximately161ms presentation remainder, versus128.7ms prior. This is quantized event timing, not a precise first-carried-sticker appearance timestamp. For example rotation's48ms rounded event minus48.6ms processing+delay gives a negative0.6ms remainder; preserve that rounding artifact rather than interpreting negative latency.

The prior141.2ms MessagePort callback is absent in this bounded capture; replacing a monolithic task with chunks improves interruptibility but does not guarantee that the next frame wins scheduling. The current26.2ms MessagePort plus timers also cannot explain every millisecond of the184ms event. Missing intermediate script attribution, renderer/worker readiness, composition and browser event-presentation association remain unresolved. No trace or private-renderer-present timestamp exists here.

## Next bounded decision

Proactive context priming is **source-justified as the next controlled experiment**, not proven to fix the184ms event. `native-carry-controller.ts:52–59` waits for an actual nativeCarryInput before updating visibility/requesting deformation. `sticker-carry-preparation.ts:58,92–101` requireswanted and then starts the first rear/collision snapshot copy. Thus immutable context work is still on the cold pickup critical path, although it now yields first. Preparing that SAME context once when the rear/packet becomes usable and visibility revision is ready could remove it from pickup without changing the trajectory or delaying public/media input. It must use the existing producer/context reservation, latest-generation invalidation, fixed byte cap, cancelled-copy unwind and hide/dispose retirement; no second warmup worker or unlimited idle cache. Cold input must retain the yielding safety path, since priming may not finish or may be invalidated by controls/assembly changes.

Before choosing a new global scheduling policy, add only bounded owner-local context-ready/copy-start/end and first carry-result/adoption markers for the lead's matching production gesture, and compare one cold versus already-context-ready pickup. These markers separate copy readiness from shader/resource/worker adoption. If firstpaint remains delayed after context is already ready, prioritize render-aware scheduling of the remaining background work; do not shrink arbitrary geometry or defer same-turn public state. The existing shared `yieldSteps` uses a4ms deadline and setTimeout(0), checking only after a generator step; that yields task ownership but promises neither a paint between slices nor a4ms hard bound under6×/allocation/GC. A narrower carry-only scheduling correction would need measured per-step costs and cancellation/final-sample parity, not an unreviewed change to all cooperative workers.

No full native/CPU goal approval follows. The successful saved drop is correctness evidence; the slower reported pickup event remains an acceptance concern. Actual GPU cadence and the exact first visible carried frame require separate evidence.

Retained inputs/provenance/observer source/arithmetic: `evidence/gpu-worker/production-cpu-fixes/`. `analyze.ts` recomputes hashes, nearest-rank RAF stats, down/up delay/handler/remainder and task/LoAF timing. It reconstructs RAF from the original probe's firstphase frame anchor; firstRAF timestamps can precede installationperformance.now in the same rendering cycle. Observers were stopped/removed by lead; collection caps were not reached. Original probes swallow unsupported observer errors and disconnect without drainingpending records, so zero means no **recorded** entries, not exhaustive absence. No invalid earlier rotation attempts or DEV runs enter this comparison.

## Same-page repeated pickup qualification

Lead subsequently returned the first testplacement to0 and repeated the same earned NightShift gesture on the same production page/source/settings; placement1 and native/no failure were again verified, with observers removed. Retained repeat-peel input/observer joins the analyzer. Over3665.1ms,218mainRAF intervals havep9518.6/max35.2ms, no recorded longtasks and one51ms LoAF. Down event56ms consists of16.4ms inputdelay,22.3ms handler and approximately17.3ms rounded presentation remainder; up32ms/11.7ms handler. Gesture935.1ms is close to first926.9ms. A10.2ms Worker.onmessage script belongs to the LoAF starting124.4ms afterdown, after the reported56ms event presentation boundary.

Compared with firstcold184ms/6.3ms handler/161ms remainder, repeat56ms has a **longer**22.3ms handler but much shorter presentation remainder. That strengthens the case for cold deferred setup/readiness, rather than immediate pointer handler duration, as the next isolation target. It does not isolate retained carry context from artwork/damage/program/resource caches, browser/JIT state or changed scheduling. Priming remains a justified bounded experiment, not a proven128ms improvement or a statistical claim. The repeat also shows why mainRAF maximum and LoAF duration must not be treated as interchangeable GPU/display metrics.
