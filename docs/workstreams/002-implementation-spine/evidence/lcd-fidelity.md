# LCD fidelity evidence

## Pencil references

- `mObBW` — Screen / Music Menu
- `HYNXu` — Screen / Now Playing
- `H4QpB` — M2 · Music Menu — Human, dark-device instance
- `A76Ib` — M1 · Now Playing — Human, dark-device instance

Pencil was read only through its MCP. The two fixture artwork assets were
exported from the authored artwork nodes; the `.pen` document was not edited.

## Browser proof

Flagged Chrome uses `--enable-blink-features=CanvasDrawElement` and asserts:

- 272×204 screen geometry;
- 21px title and row rhythm;
- 168/104 split-panel geometry;
- 88×88 menu and Now Playing artwork;
- 12×12 chevrons and one coherent five-icon Now Playing group;
- keyboard selection, Albums navigation, playback navigation, and Love state;
- paint-complete HTML-in-canvas capture.

```text
LCD_FIDELITY_EVIDENCE_DIR=docs/workstreams/002-implementation-spine/evidence/lcd-fidelity \
  bunx playwright test --config apps/web/tests/playwright.config.ts \
  apps/web/tests/lcd-fidelity.e2e.ts

4 passed
```

The preserved responsive suite also passes 14/14 after the LCD changes.

## Repository verification

- `bun run typecheck` — 11/11 projects clean
- `bun run lint` — clean
- `bun test` — 951 passed, 0 failed across 51 files
- `bun run gates` — 16 automated passed, 0 failed; U14 and U15 remain manual
- `bun run build` — client and SSR builds passed

## Captures

Source DOM, before the screen shader:

- `lcd-fidelity/source-panel-mobile-390x844.png`
- `lcd-fidelity/source-panel-desktop-1440x900.png`
- `lcd-fidelity/source-now-playing-mobile-390x844.png`
- `lcd-fidelity/source-now-playing-desktop-1440x900.png`

End-to-end composited device:

- `lcd-fidelity/music-menu-mobile-390x844.png`
- `lcd-fidelity/music-menu-desktop-1440x900.png`
- `lcd-fidelity/now-playing-mobile-390x844.png`
- `lcd-fidelity/now-playing-desktop-1440x900.png`

## Honest boundary

The source captures are crisp and validate this panel pass. The composited
captures still show material scanline intensity and texture softening. Those
effects originate after panel rasterization and remain open for the separately
owned composite/screen-mesh lane. These captures must not be used to approve
the end-to-end LCD shader.
