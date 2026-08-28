# W4 device luminance evidence

Generated from the running `/_spike/device` route with:

```sh
bun run scripts/w4-tune.ts report docs/workstreams/002-implementation-spine/evidence/w4-luminance-report.json
```

The raw 43-row result, measured RGB values, rig parameters and deltas are in
`w4-luminance-report.json`.

| Surface | Pass | Total | Worst absolute delta |
|---|---:|---:|---:|
| body-black | 2 | 8 | 25.19 |
| body-white | 2 | 8 | 16.61 |
| wheel-ring-black | 0 | 4 | 17.65 |
| wheel-ring-white | 1 | 4 | 7.03 |
| select-black | 0 | 4 | 18.00 |
| select-white | 1 | 4 | 9.34 |
| steel-back | 9 | 11 | 5.08 |
| **All** | **15** | **43** | **25.19** |

RMS delta is **10.13**. The ±4 gate is therefore **not met**. This file is a
failure record, not acceptance evidence. It prevents the materially improved
preview from being mistaken for numeric closure.

One exact boundary originally graded false because colour arithmetic produced
`4.000000000000028`. The evaluator now admits only `1e-9` of representation
noise, with tests proving an exact boundary passes and a `4.000001` delta fails.
