# Final U15 browser observations

Reviewed commit: `f1ec1f79075ff77a0c524bff07da5afd35a37d0e`

The review used two independent browser paths against `http://localhost:3000`:

- the in-app browser, which exposed the current flag-off `T3` state;
- Chrome 151 launched with `--enable-blink-features=CanvasDrawElement`, connected over CDP, which exposed the `T1` HTML-in-canvas path.

The rendered provider is Apple-shaped: `packages/panel/src/model.ts` constructs the fixture with `APPLE_SUPPORTS`. The unsupported Apple rows exercised here were lyrics, library removal, playlist removal/reordering, and queue removal/reordering. Offline is out of the launch capability model.

## Runtime observations

| Check | Observation |
|---|---|
| Unsupported controls | Zero disabled controls. No visible `Lyrics`, `Remove from playlist`, `Reorder playlist`, `Remove from queue`, `Reorder queue`, or `Downloaded only` control on S03, S08, S13, or the permission-denied S13 state. |
| Both colourways | Black and white devices reached S03, S08, and S13. Each retained one focused `role="application"` panel and the same Apple-shaped action set. |
| Centre cycle | On S13, repeated centre presses produced `volume → scrub → rate → volume`; no lyrics stop appeared. |
| Keyboard | `Enter` navigated S03 → S08 → S13; `Backspace` returned S13 → S08 → S03; `ArrowUp` changed the highlighted row after a pointer-wheel gesture. |
| Click wheel | A clockwise pointer arc over the physical annulus moved the S03 highlight from Albums to Search. Focus returned to the application and keyboard input continued to work. |
| Permission denied | S13 rendered subscription guidance and no playback action controls; disabled count remained zero. |
| Automatic flip/error | URL, front-face query, and canvas context remained stable through navigation and centre cycling. No alert, page error, error route, or automatic back-face transition occurred. |
| T1 composition | `data-composite-tier="T1"`, one canvas, one composited DOM panel, `data-composite-ready="true"`, and no context loss in both colourways. |
| Flag-off state | The in-app browser detected `T3` and rendered no device fallback. This is the accepted RISK-01/deferred-fallback state, not a fallback approval. It did not redirect or flip to an error surface. |

The pointer path used on the 390 × 606 CSS-pixel canvas was approximately `(600,470) → (645,480) → (680,515) → (695,560) → (680,605) → (645,640) → (600,650)`.

## Accessibility signal

The T1 S03 panel returned zero Axe violations (21 passes; contrast remained incomplete because of gradient/pseudo-element rendering). The T1 white S13 panel also returned zero violations (23 passes), with two incomplete checks: contrast, and `aria-prohibited-attr` on five passive status `div`/`span` labels. The latter is recorded as a non-blocking Minor in the review; it does not create a disabled or misleading unsupported capability.

Console inspection found no application error. Chrome emitted one upstream Three.js development warning that `THREE.Clock` is deprecated; there is no application `THREE.Clock` use in the repository.

## Screenshots

- `u15-t1-black-s03.png` — black T1 device, S03.
- `u15-t1-white-s03.png` — white T1 device, S03.
- `u15-t1-white-s08.png` — white T1 device after keyboard navigation to S08.
- `u15-t1-white-s13.png` — white T1 device after keyboard navigation to S13.
- `u15-root-both-colourways-s03.png` — both plain-DOM colourways at S03.
- `u15-root-both-colourways-s08-keyboard.png` — both plain-DOM colourways at S08.
- `u15-root-both-colourways-s13-keyboard.png` — both plain-DOM colourways at S13.
- `u15-root-both-colourways-permission-denied-s13.png` — both permission-denied S13 states.
- `u15-iab-t3-no-fallback.png` — flag-off T3 state retained only to document the deferred fallback boundary.

U14 thumb-occlusion and H-6 owner aesthetic approval were not assessed or cleared.

After the browser pass, `bun run gates` completed successfully: 11/11 TypeScript projects, repository lint, 939 tests, and all 16 automated gates passed. As designed, the runner continued to list U14 and U15 as manual gates; this review supplies the U15 inspection only.
