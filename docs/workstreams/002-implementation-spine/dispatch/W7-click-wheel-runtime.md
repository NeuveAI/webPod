# Dispatch — W7 · production click-wheel runtime

**Lane:** L-C / L-E · **Depends on:** W2 reducer, W4 input annulus, W6 T1 composite seam

## Correctness target

The mounted production annulus routes mouse, touch and pen arc samples into the
singleton `deviceStore`; the reducer remains the only owner of detent physics.
Release may coast through one injected external RAF driver. Cancellation never
coasts. A capture-phase, non-passive root wheel listener writes exactly once and
ends a wheel burst after 120ms of inactivity. Pointer use must preserve the
panel's `role="application"` focus so keyboard navigation continues.

## Owned surface

`packages/composite/src/click-wheel-runtime*`, `CompositeDevice*`, package
dependency metadata, W7 tests, and W7 orchestration/evidence artifacts. Consume
the existing `@webpod/device` input surface and `@webpod/state` singleton. Do not
add `useState`, `useFrame`, tier policy, haptics, or duplicate wheel geometry.

## Verification

- Mounted production-boundary test: no-op arc callbacks must fail.
- Unclamped 15–240Hz coast plus elapsed-frame mutation gate.
- Literal 120ms idle boundary, last-event rescheduling, and no early end/coast.
- Deterministic focus restoration test.
- Fresh Chrome 151 with `CanvasDrawElement`, stable source fingerprint, real arc,
  application focus after release, and a subsequent keyboard movement.
- Scoped typecheck/test/lint, full typecheck/test/lint/build/gates.

## Evidence

`evidence/w7-composite-mutations.md`, `evidence/w7-browser.json`,
`evidence/w7-browser-provenance.md`, and `evidence/w7-gates.txt`.

