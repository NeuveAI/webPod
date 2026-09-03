# Native cursor release diary

## 2026-09-03

- Recorded the owner's cancellation of the animated 3D hand for the 12-hour
  release window and replaced it with semantic native cursors.
- Reused the existing ray-confirmed perimeter hover and accepted orientation
  grab callbacks. The cursor layer does not own orientation or click-wheel
  state.
- Added scoped canvas attributes for wheel-control hover and orientation
  `grab`/`grabbing`, with deterministic cleanup on pointer up, pointer cancel,
  lost pointer capture, canvas replacement, and unmount.
- Kept the click-wheel annulus and Select on `pointer`; they never advertise
  whole-device movement. CSS cursor rules apply only to fine hover pointers.
- Focus, keyboard operation, touch behavior, panel semantics, device geometry,
  materials, lighting, navigation, and audio were not changed.
- Cursor unit and mounted click-wheel regression suites pass (33 tests). Device
  typecheck and repository lint pass. The full repository gate remains red only
  because the pre-existing dirty Apple provider relationship test expects
  `Night` and currently receives `undefined`.
- Native browser evidence could not be captured in this session because the
  configured Chrome computer-use surface was unavailable. DOM attributes and
  lifecycle tests are the primary evidence; owner visual sign-off remains open.
