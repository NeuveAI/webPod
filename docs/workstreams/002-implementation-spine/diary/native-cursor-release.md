# Native cursor release diary

## 2026-09-03

- Recorded the owner's cancellation of the animated 3D hand for the 12-hour
  release window and replaced it with semantic native cursors.
- Reused the existing ray-confirmed perimeter hover and accepted orientation
  grab callbacks. The cursor layer does not own orientation or click-wheel
  state.
- Added a scoped canvas attribute for wheel-control hover, with mounted R3F
  coverage across the annulus and Select plus deterministic unmount cleanup.
- Reviewer correction: removed the duplicate orientation cursor controller and
  its terminal listeners. `grab`/`grabbing` now come exclusively from the
  existing stage dataset published by `bindDeviceOrientationControls`, whose
  pointer-up, cancellation, lost-capture, and disposal paths remain authoritative.
- Kept the click-wheel annulus and Select on `pointer`; they never advertise
  whole-device movement. CSS cursor rules apply only to fine hover pointers.
- Focus, keyboard operation, touch behavior, panel semantics, device geometry,
  materials, lighting, navigation, and audio were not changed.
- Mounted click-wheel tests pass, including real R3F hover routing and cleanup.
- A dedicated Chrome test now proves live DOM attributes and computed styles on
  `/_spike/device`: default scene, pointer preview/wheel controls, grab/grabbing
  from authoritative orientation state, cancellation cleanup, selectable outside
  text, and fine/coarse pointer containment.
- The rerun repository gate has green types, lint, and 1,160 tests; U8 alone is
  red on unrelated concurrent `apps/web/src/music-runtime.ts` work.
- Owner visual sign-off remains open.
