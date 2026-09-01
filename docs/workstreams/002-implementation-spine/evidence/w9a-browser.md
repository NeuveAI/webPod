# W9a browser evidence index

Route template:

`/_spike/device?capture=1&diagnostic=production-surface&view=front&colourway=<black|white>&lighting=<key-only|fill-only|combined>&control=<rest|select-press|wheel-0|wheel-90>`

The captures use the existing W8 production materials, world-fixed key/fill
rig, camera fit and physical geometries. `control` is a deterministic held pose
on the same controller used by pointer input; it is not a paint or alternate
mesh path.

## White hardware

| Light | Rest | Select | Wheel right | Wheel bottom |
| --- | --- | --- | --- | --- |
| Key | `w9a-browser/w9a-white-key-only-rest.png` | `w9a-browser/w9a-white-key-only-select-press.png` | `w9a-browser/w9a-white-key-only-wheel-0.png` | `w9a-browser/w9a-white-key-only-wheel-90.png` |
| Fill | `w9a-browser/w9a-white-fill-only-rest.png` | `w9a-browser/w9a-white-fill-only-select-press.png` | `w9a-browser/w9a-white-fill-only-wheel-0.png` | `w9a-browser/w9a-white-fill-only-wheel-90.png` |
| Combined | `w9a-browser/w9a-white-combined-rest.png` | `w9a-browser/w9a-white-combined-select-press.png` | `w9a-browser/w9a-white-combined-wheel-0.png` | `w9a-browser/w9a-white-combined-wheel-90.png` |

## Black hardware, combined light

- `w9a-browser/w9a-black-combined-rest.png`
- `w9a-browser/w9a-black-combined-select-press.png`
- `w9a-browser/w9a-black-combined-wheel-0.png`
- `w9a-browser/w9a-black-combined-wheel-90.png`

## Reading the frames

- Rest retains the owner-approved material seams with no standing recess.
- Select press is the deeper, uniform local-normal travel.
- Wheel 0° and 90° move the broad highlight/normal response with the contact;
  the rest of the ring remains byte-identical.
- Isolated key and fill prove that the response comes from both physical light
  contributions rather than a combined-pass overlay.
