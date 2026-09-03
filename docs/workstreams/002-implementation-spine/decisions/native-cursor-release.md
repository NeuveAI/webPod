# Native cursor release decision

**Date:** 2026-09-03
**Status:** Settled by owner

The owner cancelled the proposed animated 3D hand because the release window is
12 hours. This release uses the platform cursor vocabulary instead: `default`
for the scene, `pointer` for click-wheel and preview controls, `grab` for the
ray-confirmed enclosure perimeter, and `grabbing` only while the orientation
owner has accepted and holds that pointer.

Wheel cursor intent is reflected on the scoped canvas from mounted R3F ray hits.
Orientation cursors consume only the existing `data-orientation-grab` state
published by the preview's authoritative drag owner; there is no second cursor
lifecycle or terminal-event listener. No bitmap/SVG cursor, cursor-following DOM, new 3D
asset, model loading, animation, or component-local React state is introduced.
Fine-pointer media queries contain the visual cursor rules, so touch and coarse
pointers retain their existing behavior. Keyboard operation and focus styling
remain unchanged.

Reversal cost is low: remove the wheel canvas attribute and its CSS rule.
Reintroducing a 3D hand is a separately scoped post-release feature and is not
an extension of this implementation.
