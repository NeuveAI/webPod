# W4 → W6 screen seam evidence

Route: `http://localhost:3000/_probe/composite?colourway=black&state=ready`

Browser: Chrome 151 with `--enable-blink-features=CanvasDrawElement`.

Final regularized rerun: `w4-composite-black-t1.png` and
`w4-composite-white-t1.png`. Both report T1, render the complete live DOM panel,
retain the normalized screen orientation, and keep the device visible against
the dark composite room. The flagless in-app browser remains the deferred T4
case and is not treated as evidence against this seam.

After normalizing the device-owned screen geometry UVs, the complete 320 × 240
menu texture renders inside the 272 × 204 screen instead of clamping to a
horizontal edge band. The browser capture is `w4-composite-seam.png`.

Verification:

- `packages/device/src/screen-mesh.test.ts` pins every UV to
  `u = x / width + 0.5`, `v = y / height + 0.5`.
- Extents are exactly `[0,1]` on both axes.
- Orientation is TL `(0,1)`, TR `(1,1)`, BR `(1,0)`, BL `(0,0)`.
- Device suite: 33 pass, 0 fail.
- Existing composite suite: 4 pass, 0 fail.
- No file in `packages/composite` or `packages/panel` was changed for the fix.
