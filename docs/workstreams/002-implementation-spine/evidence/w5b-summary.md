# W5b evidence summary

Route: `http://localhost:3000/`

Profile: Chromium baseline with CanvasDrawElement flag off, mechanically
verified by the absence of `HTMLCanvasElement.prototype.requestPaint` before
every test.

## Baseline

Command: `bun run scripts/browser-gates.ts`

Result: 10 passed, 0 failed after W3 source fixes `1693761`/`e1f5dd2`. Full output is in `w5b-baseline.txt`.

| Gate | Result | Evidence |
|---|---|---|
| U1 | pass | 48 `w5b-u1-*.png` files under `w5b-browser/` |
| U2 | pass | `w5b-u2-greyscale-human.png` |
| U3 | pass | paired `w5b-u3-*.png`; all authored motion resolves to none/0s |
| U4 | pass | paired PNGs plus `w5b-u4-transparency.json` full filter/scrim/title census |
| U5 | pass | paired `w5b-u5-*.png` |
| U6 | pass | `w5b-u6-axe-targets.json`: zero violations, both native targets ≥44×44 |
| U7 | pass | axe zero violations; gradient/pseudo paint evidence in `w5b-u7-contrast.json` |
| U11 | pass | six PNGs; no own or ancestor-clipped visible text |
| U12 | pass | real traversal, Tab order, both colourways/state matrix, held repeats in JSON |
| U13 | pass | 30 detents, exactly 1 announcement; duplicate counting, alert and busy-state coverage |
| U14 | manual | owner-only phone-in-hand thumb-occlusion validation |
| U15 | manual | reviewer-only unsupported-control structural inspection |

## Mutation proof

Command: `bun run scripts/browser-gate-mutations.ts`

Result: clean control 10/10, then all ten verified-landed gate-specific plants turned their filtered test red. Complete
output is in `w5b-planted-failures.txt`.

No product source, active W4 path, dependency manifest, or lockfile was changed.
