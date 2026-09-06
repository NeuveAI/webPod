# First desktop liner reveal: DevTools MCP recording

Recorded with mcp__chrome_devtools__performance_start_trace / performance_stop_trace on the owned actual production root. Reload=false, autoStop=false; Chrome152,1280×900 DPR1, CPU1x, no network throttle. This file transcribes the returned cold-run summary and subsequent INPBreakdown insight. Full Event Timing, LoAF and RAF samples are retained separately.

Trace bounds returned by MCP:514625605104–514646633185µs. Insight set:NO_NAVIGATION. Observed INP56ms, CLS0.00. Longest interaction pointerdown: input delay0.4ms, processing2ms, presentation53ms. No field/CrUX data. The Cache insight reported2.1MB of assets without long cache lifetime; this is a local synthetic fixture response, not a production cache-policy diagnosis.

The mid-animation long task is visible in the independent PerformanceObserver record:130ms task at57032.3ms;146.1ms LoAF beginning57016.6ms, paint57162.7ms, presentation57208ms. Script attribution129.9ms to FrameRequestCallback `bO`, index-ChEousuE.js character1185481. Reading the frozen built source maps bO→mO→gl.render in R3F. Forced style/layout duration is0. This is rendering-path attribution, not proof that every millisecond was shader compilation.

## Raw export limitation

The MCP server rejected an absolute output path within the repository:

`Error: Access denied: path /Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/direct-manipulation/performance/baseline-desktop.json.gz (...) is not within any of the configured workspace roots.`

A supported relative path attempt was also rejected:

`Error: Access denied: path webpod-baseline-warm.json.gz (canonical: /Users/vinicius/code/webPod/webpod-baseline-warm.json.gz) is not within any of the configured workspace roots.`

Tracing without filePath succeeded and returned real trace findings/insights. No raw trace file was returned by that mode. The configured-root restriction was not bypassed or changed. Consequently this evidence preserves actual MCP recording summaries plus separate observer measurements, not an exportable Chrome flame-chart trace or a claimed GPU-frame-drop counter.
