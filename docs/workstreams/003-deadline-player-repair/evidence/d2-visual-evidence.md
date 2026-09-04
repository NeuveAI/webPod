# D2 visual evidence — compact period iPod/Aqua presentation

**Captured:** 2026-09-03
**Source posture:** shared working-tree snapshot; no immutable commit identity claimed
**Browser:** Google Chrome 152
**Authored panel size:** 272×204

## Captures

| Surface | Dark/black device | Light/white device |
|---|---|---|
| Music root | [dark](./d2-visuals/music-root-dark.png) | [light](./d2-visuals/music-root-light.png) |
| Artists | [dark](./d2-visuals/artists-dark.png) | [light](./d2-visuals/artists-light.png) |
| Nested tracks | [dark](./d2-visuals/nested-tracks-dark.png) | [light](./d2-visuals/nested-tracks-light.png) |
| `prefers-contrast: more` Artists | [dark](./d2-visuals/contrast-more-artists-dark.png) | [light](./d2-visuals/contrast-more-artists-light.png) |

All 8 PNGs are exactly 272×204. The root capture includes the concurrent D1 correction that derives preview art from the selected provider entity instead of the old authored forest fixture.

## Runtime observations

The overflowing nested-track list reported the same values in both colourways:

```json
{
  "panel": [272, 204],
  "renderedRows": 8,
  "rowHeights": [22.875],
  "selectedWeight": "500",
  "plainWeight": "500",
  "railWidth": 5,
  "overflow": "true"
}
```

This proves the selected material does not change row metrics, exactly 8 rows occupy the 183px list viewport, and the rail is narrower than the prior 7px implementation. Static markup tests separately prove that the rail is absent at 8 rows and appears at 9.

Under `prefers-contrast: more`, Chrome resolved the selected foreground to `rgb(255, 255, 255)` for the dark colourway and `rgb(0, 0, 0)` for the light colourway. Both retained the two-layer Aqua material rather than collapsing selection identity.

## Verification

- Panel unit/material/navigation/runtime suite: 84 pass, 0 fail.
- Focused D2 unit/material suite: 22 pass, 0 fail.
- TypeScript: 11/11 projects clean.
- ESLint: clean.
- Production client and SSR builds: clean.
- Scoped diff whitespace check: clean.
- Current Web Interface Guidelines audit: pass for the changed list/scroll surfaces. Text remains truncation-safe; focus replacement, reduced motion, reduced transparency, high contrast, and forced colours remain explicit.

## Browser-test limitation

The legacy production-device scrollbar Playwright case was aligned with the new 5px rail, but its current run timed out before list assertions while waiting for the CanvasDrawElement composite source to attach. The failure is in `settleCompositePaint()` and does not indicate a list failure. This evidence therefore proves the canonical DOM LCD surface; it does not claim to close the separate HTML-to-canvas renderer-test limitation.
