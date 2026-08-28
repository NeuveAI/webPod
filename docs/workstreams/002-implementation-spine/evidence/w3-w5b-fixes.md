# W3 response to W5b U3 and U7

## Product changes

- U3: the reduced-motion media query disables authored animation and transition on the panel root, descendants, and pseudo-elements. Explicit selectors match or exceed the specificity of the success, selection, skeleton, and progress declarations without using `!important`, so W5b can still inject and detect a regression.
- U7: the light tertiary text token changed from `#64748b` to `#607086`. The secondary token remains `#475569`, preserving the hierarchy.

## Browser proof

`bun run scripts/browser-gates.ts`: **10 passed**.

- U3 computed `animation-name: none` and `transition-duration: 0s` in both colourways.
- U7 measured minimum contrast: dark **5.0876659065:1**, light **4.6524381262:1**; no failures and no axe violations.
- Updated reduced-motion screenshots: `w5b-browser/w5b-u3-reduced-motion-{dark,light}.png`.
- The full W5b light-colourway screenshot matrix was regenerated because the tertiary token is visible across S03, S08, and S13 states.

`bun run scripts/browser-gate-mutations.ts`: all ten mutations **RED AS REQUIRED**. In particular, W5b's U3 injected animation and U7 low-contrast token each fail their unchanged browser gate.

`bun run --cwd packages/panel test:e2e`: **11 passed**, including axe, preferences, all state/colourway screenshots, target geometry, provider artwork, and raster compatibility.

## Repository verification

- `bun run typecheck`: **11/11 projects clean**.
- `bun run lint`: **pass**.
- `bun run build`: **pass** (client and SSR).
- `bun test`: W3 tests pass; repository result is **856 pass / 3 fail**, all three in concurrent W4 device material/light-rig work.
- `bun run gates`: **15 automated pass / 1 automated fail / 2 manual outstanding**. The sole automated failure is the same foreign W4 test set. U14 and U15 remain manual and are not claimed.
