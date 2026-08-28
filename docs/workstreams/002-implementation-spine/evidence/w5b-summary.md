# W5b evidence summary

Route: `http://localhost:3000/`

Profile: Chromium baseline with CanvasDrawElement flag off, mechanically
verified by the absence of `HTMLCanvasElement.prototype.requestPaint` before
every test.

## Baseline

Command: `bun run scripts/browser-gates.ts`

Result: 8 passed, 2 failed. Full output is in `w5b-baseline.txt`.

| Gate | Result | Evidence |
|---|---|---|
| U1 | pass | 48 `w5b-u1-*.png` files under `w5b-browser/` |
| U2 | pass | `w5b-u2-greyscale-human.png` |
| U3 | **fail** | light animation remains `wp-success-light`; paired `w5b-u3-*.png` |
| U4 | pass | paired `w5b-u4-*.png` |
| U5 | pass | paired `w5b-u5-*.png` |
| U6 | pass | `w5b-u6-axe-targets.json`: zero violations, both native targets ≥44×44 |
| U7 | **fail** | `w5b-u7-contrast.json`: light `The Fray` and battery glyph are 4.3851:1, required 4.5:1 |
| U11 | pass | six `w5b-u11-*.png`; no clipped/truncated visible text leaves |
| U12 | pass | `w5b-u12-keyboard.json` |
| U13 | pass | `w5b-u13-announcements.json`: 30 detents, exactly 1 announcement |
| U14 | manual | owner-only phone-in-hand thumb-occlusion validation |
| U15 | manual | reviewer-only unsupported-control structural inspection |

## Mutation proof

Command: `bun run scripts/browser-gate-mutations.ts`

Result: all ten gate-specific plants turned their filtered test red. Complete
output is in `w5b-planted-failures.txt`.

No product source, active W4 path, dependency manifest, or lockfile was changed.
