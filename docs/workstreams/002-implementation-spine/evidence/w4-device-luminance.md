# W4 device luminance evidence

Generated from the running `/_spike/device` route with:

```sh
bun run scripts/w4-tune.ts report docs/workstreams/002-implementation-spine/evidence/w4-luminance-report.json
```

The raw 43-row result, measured RGB values, rig parameters and deltas are in
`w4-luminance-report.json`.

| Surface | Pass | Total | Worst absolute delta |
|---|---:|---:|---:|
| body-black | 1 | 8 | 26.55 |
| body-white | 2 | 8 | 16.51 |
| wheel-ring-black | 0 | 4 | 16.86 |
| wheel-ring-white | 1 | 4 | 7.24 |
| select-black | 0 | 4 | 18.00 |
| select-white | 1 | 4 | 9.34 |
| steel-back | 9 | 11 | 5.08 |
| **All** | **14** | **43** | **26.55** |

RMS delta is **10.15**. The ±4 gate is therefore **not met**. This file is a
failure record, not acceptance evidence. It prevents the materially improved
preview from being mistaken for numeric closure.

One exact boundary originally graded false because colour arithmetic produced
`4.000000000000028`. The evaluator now admits only `1e-9` of representation
noise, with tests proving an exact boundary passes and a `4.000001` delta fails.
