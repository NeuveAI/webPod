# W4 device luminance evidence

Generated from the running `/_spike/device` route with:

```sh
bun run packages/device/calibration/tune.ts report docs/workstreams/002-implementation-spine/evidence/w4-device-luminance.json
```

The raw 43-row result, measured RGB values, rig parameters and deltas are in
`w4-device-luminance.json`.

| Surface | Pass | Total | Worst absolute delta |
|---|---:|---:|---:|
| body-black | 2 | 8 | 19.99 |
| body-white | 4 | 8 | 19.20 |
| wheel-ring-black | 2 | 4 | 14.07 |
| wheel-ring-white | 3 | 4 | 11.84 |
| select-black | 1 | 4 | 16.03 |
| select-white | 2 | 4 | 13.05 |
| steel-back | 10 | 11 | 6.07 |
| **All** | **24** | **43** | **19.99** |

RMS delta is **9.47**. The ±4 gate is **not met**; this is truthful red
evidence, not acceptance evidence.

D-067 invalidates the former 8/43 and 32/43 reports. They were measured against
the stale 33px / n=4.2 silhouette without object/material identity, so endpoint
pixels could come from the seam or room and still be attributed to a body.
This run derives the 330×552, circular-26 enclosure from `DEVICE_LAYOUT`, keeps
body samples 3px inside and recessed controls 6px inside, and rejects every
sample unless the first rendered raycast hit is the expected named mesh and
material. It does not search past unnamed surfaces. The sole skip is a generated
wheel-label canvas texel whose alpha is proven to be zero; unreadable or
unrecognised transparent surfaces fail closed.

The lights are world/viewer-space siblings of the model group, so flipping to
the back rotates only the object. Back targets are solved in the viewer-facing
168° gradient frame, inverse-transformed into model-local coordinates, and then
projected through the live model matrix. All 11 steel rows therefore see the
same world-space key/fill frame; the four off-axis rows remain on their intended
iso-lines after the π face rotation.

The checked candidate deliberately retains smooth geometry. Its only added body
degree is one quadratic vertical crown (`−2.125` body px), applied to actual
vertices and shared with probe depth; it has no stop-local controls. The pointwise
normal fit that produced the old 32/43 result also produced broad blue/bronze
bands and merged white surfaces, so it is not a valid visual implementation.
The white/light, black/dark, and two back captures beside this file show the
candidate that was actually retained.

Calibration trajectory, always using valid first-hit samples:

| Checkpoint | Pass | Worst absolute delta |
|---|---:|---:|
| Corrected frame, inherited rig | 6/43 | 57.78 |
| Initial bounded room/front solve | 15/43 | 22.93 |
| Gate-ordered bounded solve | 23/43 | 19.99 |
| Paused room checkpoint | 24/43 | 20.02 |
| Final required front-only run | **24/43** | **19.99** |

The final `search-front 250` run reduced only lower-order error and did not
reduce the 18 front failures. No further search, room-only pass, new model, or
tolerance waiver followed it.

One exact boundary originally graded false because colour arithmetic produced
`4.000000000000028`. The evaluator now admits only `1e-9` of representation
noise, with tests proving an exact boundary passes and a `4.000001` delta fails.
