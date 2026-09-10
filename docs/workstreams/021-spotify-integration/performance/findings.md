# Scrolling investigation

Connected to the user's existing Chrome through its DevToolsActivePort WebSocket on port 9222. The standard /json/version endpoint returned 404. Used agent-browser CDP profiling and an initial Playwright CPU profile, without reading cookies or auth state.

## Changes

- Inactive marquee labels no longer read geometry or attach ResizeObservers. Active labels read both dimensions before writes and avoid unchanged style/attribute writes.
- Hover/highlight immediately prefetches image bytes into a bounded 24-entry cache. It no longer decodes two pixel samples for every passing row. Stable selection and Now Playing reuse those bytes for decoding, avoiding a second fetch.
- Passing pointer rows no longer start relationship pagination. The existing sustained-highlight preparation still fetches catalogue data; artwork fetching remains immediate.

## Evidence and limits

Initial real mouse-wheel CPU profiles cover 36 forward/back events at slow/medium/fast intervals, with scrollWidth reads prominent (21/16/29 ms self time). Occasional frame gaps were 58/50/67 ms; no observer long tasks were reported in this initial run. These runs are retained as baseline-*.cpuprofile. The later frame probe corrected a stale rAF-loop issue, so its frame metrics are not used as an apples-to-apples comparison with that first run.

The matched layout experiment uses the same in-page wheel event sequence at 120/40/8 ms, verifies it remains in a list, and observes 19/27/36 distinct selected row positions. These are synthetic application inputs, not a claim about hardware-input latency. layout-before.json.gz temporarily restores the previous marquee implementation; after-songs.json.gz uses the optimized implementation. Style/layout recalculation events: 270 -> 205; time: 50.65 -> 46.89 ms. Layout events: 112 -> 110; time: 9.86 -> 8.99 ms. This supports reduced layout work, not a dramatic overall latency claim. Both recordings reported one ~85 ms long task during the slow phase; medium/fast reported none. Debugger/V8 interrupt overhead is significant in the trace.

The fixes are restored in the working tree. A recording that left Songs for Now Playing was discarded. Chrome remains open.

Checks: 24 mounted Panel tests, 8 runtime tests (including fetch-before-decode and byte reuse), and 1 marquee test (including no inactive geometry reads) pass. All 13 typecheck projects, changed-file lint, production build and diff checks pass.
