# Native rotation CPU follow-up

The new recording shows expensive main-thread key handling, but it is a development build with substantial React debugging overhead. It does not establish production rotation cost or GPU execution time.

Source: native DevTools export `Trace-20260911T000602.json.gz`, retained outside Git in Downloads. The initially supplied September 10 export was the previous recording and was rejected after its sample and event counts matched the old evidence. The lead confirmed the September 11 export. Metadata identifies iPhone 16 Pro Max and 6× CPU throttling; lead verified the 440×956 viewport and localhost:3000 capture. Renderer process/thread: 74270/3381954. The profile spans 18,442.191 ms and contains exactly six keydown/keyup pairs. The sequence Right, Right, Up, Left, Down, Home comes from the operator; key payloads are not retained.

## Input window and attributable costs

The six keydown dispatch durations are 455.301, 206.133, 223.655, 171.999, 168.449 and 30.301 ms, totaling 1,255.838 ms. These are main-thread event durations, not input-to-next-paint latency. The focused window begins at the first keydown (8,914.854 ms after profile start) and ends one second after the final keyup, spanning 3,018.452 ms. It includes settling after Home. Overall idle time is not used to dismiss these stalls.

Within keydown intervals, React DOM's processRootScheduleInMicrotask has approximately 729.769 ms inclusive sampled time. Fiber's reconciler scheduling branch has approximately 426.600 ms. These overlap through nested stacks and must not be added. Visible source frames include runWithFiberInDEV and jsxDEV; native run/createTask leaves occur below these development debug wrappers. A large part of this capture therefore measures development/debugger work. It cannot justify a production renderer migration by itself.

A concrete renderer path is worth investigating in a production comparison: WebGLRenderer.setSize has 73.299 ms self sampled time inside keydown intervals, through Fiber configure → setDpr → WebGLRenderer.setPixelRatio → setSize. The relevant trace coordinates and complete parent chain are in the JSON. This establishes that resize configuration work occurs during these interactions; it does not establish why DPR changed, how many real reallocations occurred, or whether the same cost persists in production.

Across the complete focused window, overlapping inclusive samples are React DOM 1,158.941 ms, Fiber 1,084.830 ms and Three 246.896 ms. Native texElementImage2D contributes 46.299 ms self samples; renderer setSize across all call sites contributes 78.392 ms. Explicit draw/flush/readback-style native leaves account for only 0.860 ms under the narrow symbol matcher. That is not a GPU timing measurement: browser/driver synchronization can be hidden inside other native calls, and GPU execution can occur asynchronously. No conclusion that GPU shading is cheap or expensive follows from these CPU numbers.

There are 16 main-thread tasks longer than 50 ms outside profiler startup, totaling 2,396.792 ms, all around the interaction/settlement period. The maximum is 475.129 ms. The separate 3,919.996 ms task containing CpuProfiler::StartProfiling is instrumentation startup and is excluded from application stall counts.

## Method and limits

`rotation-summary.json` contains sanitized top self/inclusive symbols for the whole profile, the focused window and keydown-only intervals, plus selected parent stacks and long tasks. Only asset basenames and source coordinates are retained, without URL queries or payloads. V8 chunks contain 2,280 negative time deltas: sample timestamps are accumulated, sorted by absolute time, then weighted until the next sample, preventing duplicate overlapping duration. Boundary samples are clipped to each interval. Inclusive stack weights overlap; symbol groups are intentionally not a partition. Samples are estimates, not exact instrumented function timers.

No app, browser or deployment changes were made for this analysis. The raw trace remains outside Git. The next useful comparison is an identical native capture of a production build, retaining the same viewport, throttle and input sequence. That separates React development tracing overhead from retained application scheduling, resize and HTML texture work before choosing another optimization.
