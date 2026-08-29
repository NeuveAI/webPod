# W4 device luminance evidence

Generated from the running `/_spike/device` route with:

```sh
bun run packages/device/calibration/tune.ts report docs/workstreams/002-implementation-spine/evidence/w4-device-luminance.json
```

The raw 43-row result, measured RGB values, rig parameters and deltas are in
`w4-device-luminance.json`.

| Surface | Pass | Total | Worst absolute delta |
|---|---:|---:|---:|
| body-black | 2 | 8 | 22.41 |
| body-white | 1 | 8 | 16.77 |
| wheel-ring-black | 0 | 4 | 23.86 |
| wheel-ring-white | 0 | 4 | 14.79 |
| select-black | 2 | 4 | 18.79 |
| select-white | 1 | 4 | 14.37 |
| steel-back | 0 | 11 | 45.42 |
| **All** | **6** | **43** | **45.42** |

RMS delta is **16.36**. The ±4 gate is **not met**; this is truthful red
evidence, not acceptance evidence.

D-067 invalidates the former 8/43 and 32/43 reports. They were measured against
the stale 33px / n=4.2 silhouette without object/material identity, so endpoint
pixels could come from the seam or room and still be attributed to a body.
This run derives the 330×552, circular-26 enclosure from `DEVICE_LAYOUT`, keeps
body samples 3px inside and recessed controls 6px inside, and rejects every
sample unless a raycast hits the expected named mesh and material.

The checked candidate deliberately retains smooth geometry. The pointwise
normal fit that produced the old 32/43 result also produced broad blue/bronze
bands and merged white surfaces, so it is not a valid visual implementation.
The white/light, black/dark, and two back captures beside this file show the
candidate that was actually retained.

One exact boundary originally graded false because colour arithmetic produced
`4.000000000000028`. The evaluator now admits only `1e-9` of representation
noise, with tests proving an exact boundary passes and a `4.000001` delta fails.
