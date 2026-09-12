# Hidden-tab orientation cancellation

## Confirmed defect and scope

Lead's actual Chrome touch test on clean 1b007f6 began a front enclosure drag (36,450 → 90,450), hid the tab, and returned. Visibility changed visible → hidden → visible, but the shared orientation controller remained held until a manually dispatched touch cancellation. Saved sticker placement, held sticker state and pending saves were unchanged.

`bindDeviceOrientationControls` owned active capture and listened for blur/pointer cancellation, but never subscribed to document visibility. Chrome's hidden transition did not guarantee either other event. The existing blur cleanup also failed to notify the native pointer owner.

Only `apps/web/src/device-preview-orientation.ts` and its existing test file change. The controller listens on its stage's ownerDocument (global document fallback), rejects new grabs while hidden, and shares one interruption path between blur and hidden. It sends the native pointer cancellation for the active pointer, removes capture/listeners, stops local/remote release motion, and rejects an outstanding flick. Return to visibility does not resume a stale gesture. The current pose is preserved. Disposal removes the visibility subscription.

No renderer protocol, animation mathematics, saved placement, UI geometry, shader or visual quality changes.

## Verification

`bun test apps/web/src/device-preview-orientation.test.ts`: 36 tests, 205 assertions pass. Added cases cover hidden without blur, exact main/native pointer cancellation, capture release, stale move/up events, repeated hidden+blur, hidden admission refusal, fresh visible grab, disposal, local flick interruption/no resumption, remote cancellation and late renderer progress rejection.

`bun run --cwd apps/web typecheck` and scoped ESLint both pass. Evidence/frozen hashes: `evidence/gpu-worker/final-visibility/manifest.json`; test output `tests.txt`. Independent review and clean current-Chrome hidden/reentry checks remain lead-owned gates.
