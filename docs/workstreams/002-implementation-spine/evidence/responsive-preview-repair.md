# Responsive preview repair evidence

## Runtime matrix

Flagged Google Chrome was launched with
`--enable-blink-features=CanvasDrawElement` against the real routes.

| Viewport | Composite | Device spike | Assertions |
|---|---:|---:|---|
| 320×568 | pass | pass | centred, contained inline and block, exact ratio, no document overflow |
| 375×667 | pass | pass | same |
| 390×844 | pass | pass | same |
| 430×932 | pass | pass | same |
| 1440×900 | captured | captured | authored-size desktop reference |

A same-page 390×844 → 390×568 → 390×844 resize also passed. The frame
contracted below 400px tall, expanded above 500px, remained centred and
ratio-correct, and retained the keyboard-selected row. Bare mode independently
preserved the 272×204 raster at 320×568.

The composite paint gate waits for the real panel host beneath the canvas and a
subsequent HTML-in-canvas `paint` event. The standalone gate invokes the real
calibration sample command, which forces a WebGL render, before taking the
screenshot. Empty-canvas existence is not accepted as visual evidence.

## Captures

- `responsive-previews/composite-320x568.png`
- `responsive-previews/composite-375x667.png`
- `responsive-previews/composite-390x844.png`
- `responsive-previews/composite-desktop-1440x900.png`
- `responsive-previews/device-320x568.png`
- `responsive-previews/device-375x667.png`
- `responsive-previews/device-390x844.png`
- `responsive-previews/device-desktop-1440x900.png`

The 430×932 viewport is asserted as the fourth mobile geometry case but is not a
required retained screenshot.

## Focused command

```text
RESPONSIVE_PREVIEW_EVIDENCE_DIR=docs/workstreams/002-implementation-spine/evidence/responsive-previews \
  bunx playwright test --config apps/web/tests/playwright.config.ts \
  apps/web/tests/responsive-previews.e2e.ts

14 passed
```

## Verification

- `bun run typecheck` — 11/11 projects clean
- `bun run lint` — clean
- `bun test` — 950 passed, 0 failed across 51 files
- `bun run gates` — 16 automated passed, 0 failed; U14 and U15 remain manual
- `bun run build` — client and SSR builds passed

## Scope statement

The captures prove route sizing, centring, visibility, DPR backing, and
paint-complete evidence. They do not approve the lighting/material aesthetic or
the composite texture's filtering quality.
