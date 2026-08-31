# W4/W6 strict visual re-review evidence

## Material authority and LAW 2

Pencil VWaJS and zbTc3 were compared through Pencil MCP only. The final owner
set is:

- `w4-material-rereview/white-front.png`
- `w4-material-rereview/black-balanced.png`
- `w4-material-rereview/steel-back.png`

White now separates pearl shell, recessed cool wheel, and raised Select. Black
remains neutral and layered. Steel retains its independent room reflection and
printed/inlay hierarchy.

Installed Three 0.185.1 and
`/Users/vinicius/code/agentic-context/three.js` agree on the relevant seam:
`MeshSSSNodeMaterial` adds scattering inside `direct()` and multiplies by
`lightColor`; classic WebGL's `RE_Direct_Physical` receives an `IncidentLight`
whose point-light color already carries distance attenuation. The corrected
shader injects there. It has no ambient, independent key direction, edge source,
or post-light additive output.

## DPR and native LCD acuity

`w6-acuity-rereview/white-mobile-dpr-{1,2,3}.png` records complete responsive
captures. `w6-acuity-rereview/lcd-native-dpr-{1,2,3}.png` records the WebGL
device canvas. Backing stores remain 330×552, 660×1104, and 990×1656; HTML
rasters remain 320×240, 640×480, and 960×720.

The distinct acuity gate normalizes the projected LCD to 272×204 and reports:

| DPR | edge P95 | edge P99 | required P95 |
|---:|---:|---:|---:|
| 1 | 17.4252 | 36.8424 | 14 |
| 2 | 27.4764 | 62.2768 | 23 |
| 3 | 31.4894 | 82.5616 | 27 |

This gate evaluates rendered pixels rather than source dimensions. Replacing
nearest sampling with the reviewed linear filter or restoring the scanline/
triad source also fails the static mechanism test, so the rejected path cannot
silently return behind unchanged backing metrics.

The exact zoom disagreement is covered at the R3F handoff: resolved physical
ratio `1.5` is received as numeric `1.5`, never `[1, 1.5]`.
