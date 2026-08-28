# W4 device luminance evidence

Generated from the running `/_spike/device` route with:

```sh
bun run packages/device/calibration/tune.ts report docs/workstreams/002-implementation-spine/evidence/w4-device-luminance.json
```

The raw 43-row result, measured RGB values, rig parameters and deltas are in
`w4-device-luminance.json`.

| Surface | Pass | Total | Worst absolute delta |
|---|---:|---:|---:|
| body-black | 1 | 8 | 16.50 |
| body-white | 1 | 8 | 186.03 |
| wheel-ring-black | 0 | 4 | 26.53 |
| wheel-ring-white | 0 | 4 | 77.00 |
| select-black | 1 | 4 | 19.07 |
| select-white | 1 | 4 | 32.19 |
| steel-back | 4 | 11 | 118.98 |
| **All** | **8** | **43** | **186.03** |

The ±4 gate is **not met**. This is a bounded source-conflict record, not
acceptance evidence. A per-row optical-normal fit reached 32/43, but independent
holdouts showed broad blue/bronze bands and merged white surfaces—the exact
material failure Pencil and the owner reject. Product defaults and the tuner now
use smooth profiles. The regularized white/light and black/dark captures beside
this file are the visual holdouts; D18 records why pointwise fitting was removed.

One exact boundary originally graded false because colour arithmetic produced
`4.000000000000028`. The evaluator now admits only `1e-9` of representation
noise, with tests proving an exact boundary passes and a `4.000001` delta fails.
