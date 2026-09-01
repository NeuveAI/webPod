# Flush click-wheel correction — source and model record

This correction follows the research-first workflow: owner originals are the
primary physical source, the public source ledger remains an independent
cross-check, and Pencil is a design reference only. The implementation was not
tuned from the owner's prose alone.

## Primary comparison set

The originals remain in the owner's Downloads directory and are identified by
filename and SHA-256 in [`../source-ledger.md`](../source-ledger.md). Six views
directly support this correction:

| Original | View | Property used |
|---|---|---|
| `IMG_2239.HEIC` | near-front macro | faceplate/wheel/Select visually share one plane; hairline seams |
| `IMG_2240.HEIC` | repeated front exposure | same result under a second exposure; independent white material relationships |
| `IMG_2242.HEIC` | shallow wheel oblique | no meaningful wheel or Select sidewall; no annular Select border |
| `IMG_2243.HEIC` | top/front oblique | control assembly follows the crowned front rather than a flat inset plane |
| `IMG_2248.HEIC` | near-front lower face | wheel/body ratio and outer assembly hairline |
| `IMG_2249.HEIC` | alternate near-front oblique | repeated flush read and separate wheel/Select plastics |

The hand-held cameras do not calibrate an Apple machining depth. They do settle
the rendered visual target: the surfaces are coplanar within a manufacturing
hairline, with no exposed wall. The model therefore encodes exact coincidence
and records explicit maximum tolerances rather than inventing a recessed OEM
dimension.

## Diagnosed causes

| Candidate cause | Finding |
|---|---|
| axial offsets | **causal:** wheel `1` model unit below faceplate; Select another `0.5` below wheel |
| recessed shell cut | **partly causal:** the physical opening is correct, but its old deep floor created a trench |
| bevel geometry | **causal:** dished annulus changed the wheel plane and normal field |
| edge material | not causal; no decorative ring material existed |
| AO/contact shadow | not causal; no AO map or contact-shadow proxy exists on this assembly |
| cast/receive shadow | not causal; neither is enabled on the wheel assembly |
| normal discontinuity | **causal:** cylinders and dish could not share the faceplate's analytic normal field |

## Installed constraints

`PX_PER_MM = 330 / 61.8 = 5.3398` model units per millimetre.

| Constraint | Production | Acceptance |
|---|---:|---:|
| faceplate → wheel top-surface delta | `0` | `<= 0.10mm` |
| wheel → Select top-surface delta | `0` | `<= 0.10mm` |
| wheel outer radial seam | `0.5` model unit = `0.094mm` | `<= 0.10mm` |
| Select radial seam | `1` model unit = `0.187mm` | `<= 0.20mm` |
| seam-floor offset | `0.05` model unit = `0.009mm` | `<= 0.02mm` |
| projected wall at 40° oblique | `0` | `<= 0.02mm` |

Wheel and Select are independent zero-wall meshes whose vertices and analytic
normals sample the same crowned faceplate functions. The shell keeps a real
circular opening; one zero-wall backing patch is visible only through the two
radial seams. There is no wheel-well cylinder, Select cylinder, torus, bevel
ring, AO proxy, or shadow proxy.

## Browser proof

- [`reference-failure-corrected.png`](./reference-failure-corrected.png) —
  owner reference | rejected recessed render | corrected live render for all
  six primary views.
- [`lighting-macro-matrix.png`](./lighting-macro-matrix.png) — black and white
  neutral, key-only, fill-only and combined live-browser macros with identical
  geometry/camera.
- `black-combined-oblique.png` and `white-combined-oblique.png` — defined
  production oblique, showing no wheel or Select wall.

Camera matching is approximate because the owner images are hand-held and
their lens metadata does not establish an orthographic projection. Geometry
and installed depth—not raw photo color—are the comparison target here.
