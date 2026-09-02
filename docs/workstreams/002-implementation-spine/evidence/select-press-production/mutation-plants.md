# Select press mutation plants

All plants were run against the correction before implementation commit
`024c15137ccf7bb0587a7706629f555d02728dbe`. Expected failures are evidence that
the relevant gate is load-bearing.

## 1. Declarative child transform overwrite

Plant: add `position={[0, 0, 0]}` to the `device-select` child mesh in
`AxialSelectControl.tsx`.

Command: `bun test packages/device/src/control-physics.test.ts`

Result: **10 pass, 1 fail**. The production-structure gate reports the exact
planted child element and rejects `position=`. This prevents R3F from reapplying
rest over an active imperative hold.

## 2. Full floor disk occlusion

Plant: change the Select seam floor's inner radius from `wheel.selectR` to `0`.

Command: `bun test packages/device/src/select-press-visibility.test.ts`

Result: **0 pass, 2 fail**. The radial topology gate receives minimum radius
zero instead of 37, and the held visibility ray receives
`device-select-seam-floor` instead of `device-select`.

## 3. Center target routed into wheel physics

Plant: replace the production pointer-path `pressSelect()` call with
`pressWheel(0)`.

Command: `bun test packages/device/src/click-wheel-input.integration.test.tsx`

Result: **11 pass, 3 fail**. Mouse/touch/pen Select presses fall from three to
zero, the mounted target reports zero Select presses instead of one, and the
center mesh remains at local Z zero instead of
`-0.6407766990291263`.

The restored focused set is 27 pass, 0 fail, 987 assertions. The complete
device package is 198 pass, 0 fail, 73,307 assertions.
