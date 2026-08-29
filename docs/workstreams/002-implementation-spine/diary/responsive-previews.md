# Diary — responsive preview repair

## Reproduction

At 528px wide, the composite route's non-wrapping navigation established a
min-content width larger than the viewport. The page clipped that width with
`overflow: hidden`, leaving the header and the right half of the device outside
the visible area. Width and height were also constrained independently, so a
short viewport changed the authored enclosure ratio.

The standalone route fixed the stage at 330×552 inside a clipped fixed page.
The browser then scaled that stage without a viewport fit contract, and its
normal preview used the calibration-only DPR 1 default.

## Implementation

- Made each route own the full logical viewport with dynamic block units and
  safe-area padding.
- Wrapped diagnostic links without changing DOM or focus order.
- Introduced one measured composite frame around the existing package boundary;
  no device, composite, panel, or token package changed.
- Preserved 330×552 and 272×204 using one uniform scale factor.
- Made the standalone stage responsive and centred with logical sizing.
- Added a paint-complete browser helper: T1 waits for the real DOM host to be
  reparented and for a canvas `paint` event; the standalone route forces one
  real calibration render before capture.

## Self-correction

The first passing geometry check was insufficient: it proved horizontal
containment but allowed the device to extend below a 320×568 viewport, and
screenshots sometimes raced the on-demand renderer and captured an empty stage.
The final test asserts block containment too and screenshots only after an
observable paint boundary. This is why the committed captures differ from the
first generated set.

## Deliberate boundary

This lane repairs responsive preview mechanics only. It does not claim to fix
the package-level lighting, material response, or HTML-texture filtering called
out by the owner; those require separately owned device/composite changes.

