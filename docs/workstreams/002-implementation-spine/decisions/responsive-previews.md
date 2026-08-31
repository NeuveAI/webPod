# Decisions — responsive preview repair

## RP-D1 · The route stage fits one authored rectangle into measured available space

The composite preview has three independently sized grid rows: controls, the
device stage, and help. Viewport arithmetic cannot know the wrapped control
height, and independently constraining device width and height distorts the
330×552 enclosure.

The stage therefore observes its own content box and writes two CSS custom
properties from one scale factor:

`min(1, availableInline / authoredInline, availableBlock / authoredBlock)`.

This preserves either 330×552 or 272×204 exactly while responding to dynamic
mobile browser chrome. The observer writes layout only when the rounded value
changes. It owns no product state and creates no React closure state.

## RP-D2 · Controls wrap; the page never expands to their min-content width

The nine diagnostic links remain in DOM order and wrap into centred rows. The
header and every grid child have `min-inline-size: 0`; the route owns exactly
100% of the document inline size and clips only accidental visual spill. This
keeps every control visible without a hidden horizontal scroller or a `100vw`
width that includes scrollbar space.

## RP-D3 · Looking follows physical density; measuring remains explicit

The standalone device passes `[1, 3]` to `DeviceCanvas`, activating its existing
physical-pixel `ResizeObserver` instead of pinning WebGL to DPR 2. The separate
LCD source keeps its authored 272×204 coordinate system, but allocates
`ceil(logical × devicePixelRatio)` backing pixels and scales its 2D context.
That preserves layout and UV geometry while avoiding an under-backed texture on
DPR 3 displays. A re-armed resolution media query updates the source after page
zoom or a display-density change.

The calibration boundary is unchanged: the runner can still set numeric DPR 1
before pixel readback, as required by the existing probe contract.

## RP-D4 · Validation controls are mobile-sized, not visually compacted

All nine header links and the standalone HUD buttons have a 44px minimum block
size at every viewport. The
short-height media query may tighten surrounding gaps and typography, but it
cannot shrink pointer targets. Existing wrapping and `min-inline-size: 0`
contain the larger controls at 320px without changing DOM or focus order.

## Sources read

- `~/code/agentic-context/tanstack/router/docs/router/routing/file-naming-conventions.md`
- `~/code/agentic-context/react-three-fiber/docs/API/canvas.mdx`
- `~/code/agentic-context/react-three-fiber/docs/advanced/scaling-performance.mdx`
- Modern Web Guidance: `css-layout`, `css`, and
  `expose-canvas-content-to-browser-features`, retrieved with `bunx`
- Requested interface critique, interface guardrail, web guideline, React, and
  routing skill instructions
