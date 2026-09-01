# W8 owner correction evidence

## Browser review surface

The route now accepts stable capture-only evidence views without changing the
normal interactive preview:

- `/_spike/device?diagnostic=neutral&capture&view=front`
- `/_spike/device?diagnostic=neutral&capture&view=three-quarter`
- `/_spike/device?diagnostic=neutral&capture&view=left-edge`
- `/_spike/device?diagnostic=neutral&capture&view=right-edge`
- `/_spike/device?diagnostic=neutral&capture&view=top`
- `/_spike/device?diagnostic=neutral&capture&view=bottom`
- `/_spike/device?diagnostic=neutral&capture&view=rear`
- `/_spike/device?diagnostic=neutral&capture&view=rear-three-quarter`

Pencil's integrated browser reviewed every link against the live local route
on September 1, 2026. The neutral front shows a flat Select face, a 4-unit dark
annular seam, and no convex highlight profile. The tilted front shows the face
below the wheel with no proud side silhouette. Left and right orthographic
edges show one exact material handoff and mirrored rolled-rear profiles. Top,
bottom, and rear-three-quarter views show a broad continuous steel roll without
a pointed terminal lip, triangular lower-corner kink, or sudden slope break.

## Pencil comparison

Pencil MCP read component `VWaJS` without reading `design.pen` from disk:

| Node | Authored bounds |
|---|---:|
| Body | 330 × 552 |
| Active screen | 272 × 204 |
| Stylised wheel | 230 × 230 |
| Select | 84 × 84 |
| Previous / next frames | 17 × 17 |
| Play frame | 15 × 15 |
| Pause frame | 15 × 15, 3px after play frame |
| MENU text | 38 × 13 |

The physical Apple image, rather than Pencil's stylised wheel diameter, remains
the production authority. Pencil's separate play and pause nodes establish the
required discrete marks and visible gap.

## Structural gates and plants

- package suite: 161 passing tests before the final repository sweep;
- Select: closed flat cylinder; 0.3mm recess; 4-unit annular gap; no dome,
  proud wall, radial dome-thickness map, or calibration knob;
- rear: 49 quarter-ellipse rings, one shared seam, open boundaries only at that
  seam, finite shared normals, and maximum adjacent roll-normal turn below
  0.23 radians;
- decals: previous/next 20×13 boxes, MENU unchanged, play/pause 3.5-unit gap;
- mutation results: flush Select 3 failures; linear rear wedge 2 failures;
  zero play/pause gap 1 failure; 13-unit skip box 1 failure.

The final repository sweep passed 11/11 TypeScript projects, repo lint, the
production build, 1,020 tests, and all 16 automated gates. U14 (owner
thumb-occlusion validation) and U15 (reviewer inspection of unsupported-control
absence) remain the two standing manual gates; neither is a geometry test.

The in-app Browser connector was unavailable during this pass. The required
Pencil MCP was available, so its integrated browser supplied the live visual
inspection while Bun, TypeScript, and ESLint supplied the local structural
gates.
