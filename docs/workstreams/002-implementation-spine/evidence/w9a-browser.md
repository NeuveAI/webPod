# W9a browser evidence status — historical and superseded

This document preserves the rejected first-pass provenance. Its interaction
status is superseded by `w9a-material-brdf.md`, which records accepted ordinary-
route wheel and combined-light Select evidence. The limitation remains real:
key-only and fill-only interactive Select macros are not proved because the
existing isolation branch renders `DeviceCanvas` and bypasses the production
`CompositeDevice` pointer chain.

## Verdict

At the time of this rejected first pass, no W9a browser capture was accepted as
interaction proof. This is a historical verdict, not the current W9a status.

The first pass used a `controlEvidencePose` query/API that drove the physics
controller directly. That bypassed the production `CompositeDevice` pointer
chain and violated the workstream ban on proof-only harnesses. The API and
query branch are deleted. The old files remain only as rejected visual
calibration artifacts so the evidence correction is auditable.

## Historical browser provenance and blocker

- Attempt: September 1, 2026 at 21:46:44 +02:00
- Required route: `http://localhost:3000/_spike/device`
- Required product path: production `CompositeDevice`, T1 HTML-in-canvas
- Required browser feature: `--enable-blink-features=CanvasDrawElement`
- Installed browser: Google Chrome 152.0.7977.65
- Browser connector result: `Browser is not available: chrome`
- In-app fallback: known T3 blank canvas; explicitly rejected as proof

Because no connected flagged Chrome T1 session was available, this revision
does not claim the dispatch's pointer-down/hold/move/release trace, release
sequence, or oblique macro frames. A reviewer or owner must provide that
environment and run the real pointer lifecycle through the existing route.

## Historical acceptance checklist

The later ordinary-route evidence closes items 1–6 and 8 for the wheel and the
combined-light Select lifecycle. Item 7 remains incomplete for isolated key and
fill lighting for the production-path reason stated above; combined lighting is
proved.

For each accepted run, record the immutable browser version, launch flags,
route, colourway, lighting mode, viewport and pointer type. Then capture:

1. rest;
2. real pointer down and held Select travel;
3. Select release sequence through exact flush rest;
4. wheel pointer down, continuous move and held contact at four angles;
5. wheel release sequence through exact flush rest;
6. oblique macro views proving local depression and changing normals;
7. key-only, fill-only and combined light for the macro states;
8. an interaction trace showing `CompositeDevice` received the lifecycle.

No query parameter or package API may inject these poses.

## Rejected artifacts

The sixteen rejected files are JFIF JPEG, 1280×720. Their original `.png`
suffixes were false; they are now truthfully named `.jpg` under
`w9a-rejected-synthetic/`.

### White hardware

| Light | Rest | Select | Wheel right | Wheel bottom |
| --- | --- | --- | --- | --- |
| Key | `w9a-rejected-synthetic/w9a-white-key-only-rest.jpg` | `w9a-rejected-synthetic/w9a-white-key-only-select-press.jpg` | `w9a-rejected-synthetic/w9a-white-key-only-wheel-0.jpg` | `w9a-rejected-synthetic/w9a-white-key-only-wheel-90.jpg` |
| Fill | `w9a-rejected-synthetic/w9a-white-fill-only-rest.jpg` | `w9a-rejected-synthetic/w9a-white-fill-only-select-press.jpg` | `w9a-rejected-synthetic/w9a-white-fill-only-wheel-0.jpg` | `w9a-rejected-synthetic/w9a-white-fill-only-wheel-90.jpg` |
| Combined | `w9a-rejected-synthetic/w9a-white-combined-rest.jpg` | `w9a-rejected-synthetic/w9a-white-combined-select-press.jpg` | `w9a-rejected-synthetic/w9a-white-combined-wheel-0.jpg` | `w9a-rejected-synthetic/w9a-white-combined-wheel-90.jpg` |

### Black hardware, combined light

- `w9a-rejected-synthetic/w9a-black-combined-rest.jpg`
- `w9a-rejected-synthetic/w9a-black-combined-select-press.jpg`
- `w9a-rejected-synthetic/w9a-black-combined-wheel-0.jpg`
- `w9a-rejected-synthetic/w9a-black-combined-wheel-90.jpg`

These files prove neither pointer behavior nor production reachability and must
not be cited to clear W9a.
