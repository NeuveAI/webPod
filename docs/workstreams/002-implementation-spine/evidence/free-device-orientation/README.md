# Free device orientation evidence

## Reviewed source

- Implementation commit: `7fcf1af2c407ae138711b1fd1063661ca20d4bd5`
- Git tree: `5db311f7ae46738d6069cf62013de31617c4041f`
- Browser-source fingerprint: `4a4f7cbf125c9b62f275b0322283e3ccea85d6453c2ec1f4a9a67148c6f4ca1b`
- Browser-source files: `205`
- Canonical-route prerequisite: `8bbf55b615469c23162b7d537cbd806c9a2496ee`

The immutable Playwright replay used `W5B_SOURCE_COMMIT=7fcf1af2c407ae138711b1fd1063661ca20d4bd5`.
The producer reconstructed the commit/tree identity above and served its Git
snapshot rather than the dirty shared checkout.

The canonical-view lane was active in the shared checkout while this work was
implemented. Its temporary `ProductionPanelState` / `ProductionPanelView`
export removal was preserved and excluded. That lane ultimately restored those
nonessential removals and committed only the legacy redirect in `8bbf55b`; a
fresh diff then showed `production-device-view.tsx` contained only the two
orientation callback props before `7fcf1af` was committed.

## Browser acceptance

Real Chrome with `CanvasDrawElement` enabled passed 7/7 scenarios from the
immutable implementation commit:

1. A projected physical edge advertises `grab`, captures, rotates pitch/yaw,
   continues after leaving the edge band, and releases.
2. Body centre, native LCD DOM, click-wheel ring, and Select do not start
   orientation.
3. A real CDP touch stream starts on the same edge, rotates, ends, and leaves
   page scroll at `(0, 0)`.
4. Yaw reaches the rear, a rear-shell edge continues rotating, pitch clamps at
   +45°, and Option/Alt drag reaches bounded roll without yaw drift.
5. A projected rounded corner is a live orientation handle.
6. `pointercancel` ends capture; Reset view restores front while preserving the
   selected white colourway and light room.
7. Front/Quarter/Edge/Rear buttons are absent, Reset view remains, and idle text
   selection remains enabled.

The real-browser run also observed T1 composite ownership and the shared
external preview API. The stage has no broad pointer-down listener, and R3F
remains `frameloop="demand"` with no `requestAnimationFrame`, `useFrame`, or
`useState` in the orientation path.

## Deterministic and lifecycle coverage

- Focused route/device tests: 15 passed, 105 assertions at the final pre-commit
  gate (including the canonical redirect ownership test).
- Device math admits straight edges and rounded corners and rejects the LCD,
  wheel, Select, centre, non-primary pointers, and shells behind a nearer ray
  hit.
- Controller coverage includes mouse, pen, touch, pointer capture, unrelated
  pointer release, cancel, lost/early capture release, blur, disposal, exact
  gains, non-finite input, keyboard roll/reset, deep-frozen snapshots, and
  reset-preserved appearance.
- Repository: 1,125 passed, 0 failed, 77,702 assertions.
- TypeScript: 11/11 projects clean.
- Lint: clean.
- Production build: clean.
- Automated gates: 16 passed, 0 failed; the standing U14/U15 owner/manual gates
  remain outside this interaction slice.

## Mutation controls

All mutations were applied one at a time and restored before the clean runs:

| Plant | Result |
|---|---|
| Return `true` for every enclosure point | `2 pass / 1 fail`; centre/face rejection failed |
| Treat every shell as the first visible ray hit | `2 pass / 1 fail`; LCD/wheel/Select occlusion failed |
| Remove drag orientation clamping/wrapping | `5 pass / 2 fail`; large pitch/yaw and roll plants failed |

The exact 18-unit perimeter band and the `0.28 / 0.42 / 0.18` pitch/yaw/roll
gains are literal-locked in addition to behavioral coverage, so a tuning drift
cannot pass by deriving both sides of a test from the changed symbol.

## Captures

All three captures are 1280×900 PNGs from the immutable source above.

- `front.png` — SHA-256 `06ff2c1cca3347f3d304ca98c1612a904783db71ca2f6c102ea06e39c756c490`
- `free-quarter.png` — custom `{ pitchDeg: 18, yawDeg: -42, rollDeg: 4 }`,
  SHA-256 `67e7dc5dcb025167166c917f3ba5d3e3fbfba13025ae1f694b3cee1d3b8f5834`
- `rear.png` — SHA-256 `bbd875bd8695cbc66f18314859cee5210c872a7403f3f503a5a37b67c9932ce7`

These images demonstrate that direct manipulation changes the one physical
model root; they are not substitutes for the pointer/capture assertions above.
