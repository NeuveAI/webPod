# Baseline DevTools evidence

See ../../../diaries/direct-manipulation-performance.md for interpretation, measured results, file ownership proposal and after plan. This directory records actual Chrome DevTools MCP traces through the real production route, supplemented by Event Timing, Long Animation Frames, bounded RAF and diagnostic WebGL timing. It does not contain raw Chrome trace exports: the MCP server rejects repository output paths; exact refusals are in baseline-cold-devtools.md.

Source:78f9687938df885fef966c105f25b3a8c6498b5bf1c8fcec2a232598ea6c511e /376. Bun1.4.0, pinned Three0.185.1/R3F9.7.0, Chrome152, Apple M4 Pro ANGLE Metal, desktop1280×900 and narrow375×812 at DPR1, CPU1x/no network throttle. Narrow is viewport emulation, not a hardware-mobile result. Baseline was an independent installed/built snapshot, so shared subsequent source writes cannot alter these results.

- `baseline-*-devtools.md`: actual MCP findings, with the initial cold result transcribed and labeled because its raw response was not initially saved to a file.
- `baseline-*-observers.json`: bounded event/frame/DOM-progress observations. Exclude trace-startup frames before the first input when comparing interaction costs.
- `baseline-phone-first-use-observers.json`: includes transparent diagnostic WebGL call timings and GPU identity; shader cache may have been warmed by the preceding desktop run.
- `baseline-metrics.json`: compact extracted results. Event durations are quantized browser Event Timing; use the DevTools insight for its reported INP breakdown.
- `fixture.mjs`: host the existing built product with synthetic trusted upstreams/native cookie/SQLite handlers. Requires an isolated built source snapshot and owned output directory; never run against live credentials.
- `observer-init.js`, `webgl-instrumentation.js`: transient owned-page diagnostics. No production route or application state hook is added.

Reproduction sequence: prepare an isolated snapshot with scripts/browser-source-fingerprint.ts, `bun install --frozen-lockfile --ignore-scripts`, `bun run --cwd apps/web build`, then `bun fixture.mjs <snapshot> <owned-runtime-output>`. Create an isolated DevTools MCP page, inject generated musickit-init.js before navigating to host.json's URL, sign in through Settings, focus the real orientation region, Home then fifteen Shift+ArrowRight presses. Reveal the packet and start performance_start_trace before opening its liner. Record close separately; repeat three warm reveal/open/close cycles and a native DevTools drag of the packet lip toward the device region. Stop tracing through performance_stop_trace and request INPBreakdown. Always close only owned pages/processes and dispose the temporary DB.

The first desktop cold trace included a20s idle interval between open/close because tools were inspected between actions. Analysis isolates gesture windows; this idle interval is not counted as animation latency. The later warm trace performs three rapid interruptible cycles. Neither trace establishes live Apple-network performance or physical Safari-device smoothness.

## Final reviewed candidate

Read `after-report.md` for source58fa8839…c261 /380, exact measured windows and comparison limits. After traces returned a wrong origin and are explicitly rejected; accepted after evidence is page-specific PerformanceObserver/RAF/actual WebGL submission instrumentation through Chrome DevTools MCP. Baseline stored trace origins were rechecked and match their original fixture.

The fixture now injects the existing deterministic SDK in the isolated HTML response before application scripts, avoiding the current tool's unreliable navigate initScript. Optional fourth fixture argument points to `after-observer-init.js` for startup measurement. Do not treat the initial wrong-SDK attempt or misbound trace INP as product evidence. No production code is injected or modified, and no alternate UI route is used.
