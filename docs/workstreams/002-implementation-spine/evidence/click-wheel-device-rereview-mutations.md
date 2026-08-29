# Click-wheel device re-review mutations

All mutations were applied to the production implementation, the edit was
confirmed by `apply_patch`, the named focused command was run, and the mutation
was reverted before the next run.

| Mutation | Command | Result |
| --- | --- | --- |
| Replace all three JSX event handlers with callbacks that reference but never invoke the production handler | `bun test packages/device/src/click-wheel-input.integration.test.tsx` | **RED:** 4 failed, 1 passed. Capture never began; cancellation, lost-capture and unmount paths consequently had no terminal event. |
| Disconnect the native `pointercancel` and `lostpointercapture` listeners after capture starts | `bun test packages/device/src/click-wheel-input.integration.test.tsx` | **RED:** 2 failed, 3 passed. The ordinary captured release and unmount paths stayed green; both native terminal paths failed independently. |
| Delete `mesh.updateWorldMatrix(true, false)` from `wheelAngleFromRay` | `bun test packages/device/src/click-wheel-input.test.tsx -t "refreshes a dirty parent"` | **RED:** the named test itself failed, expected 90°, received 90.358922°. No other test or shared scratch state supplied the failure. |
| Remove the back-face early return from `ClickWheelInputSurface` | `bun test packages/device/src/click-wheel-input.integration.test.tsx -t "back-facing"` | **RED:** the named test found the raycastable `click-wheel-input` mesh in the back-facing scene. |

Clean baseline before mutations: the two focused files passed **13/13**. The
mounted tests use `@react-three/fiber` 9.7.0's real reconciler, web event manager
and synthetic capture API with native PointerEvents supplied by Happy DOM. They
do not construct a `ThreeEvent` fixture.
