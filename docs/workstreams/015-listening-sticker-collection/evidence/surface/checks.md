# Surface check record

2026-09-06, local Bun 1.4.0.

- Seven targeted geometry/state/asset tests passed, 0 failed (117328 assertions, including all sixty assets and full grid samples).
- Device, state, composite TypeScript checks passed.
- Scoped ESLint passed.
- `syncStickerAssets(process.cwd())` returned 60; generated public assets ignored by git.
- Full production build URLs and real WebGL visual/lifecycle evidence remain lead/UI/reviewer integration gates; no screenshot evidence manufactured by source inspection.

Review patch: 11 tests now pass (4 new directly exercise texture cache request/disposal races). Device typecheck and renderer scoped lint pass after patch. Explicit retry API is exported and renderer ready/error callbacks provided to app integration. Lead reports full build PASS and matching SHA256 for all 60 built client assets; HTTP/browser acceptance is separate.

Final combined browser gate:3/3 passed58.7s (UI engineer run); surface engineer inspected current context-loss/recovery images and material-runtime.json. Real GPU draw counters stable991/991 and1123/1123 across700ms intervals. ContextLost now has semantic restoring status and unavailable sticker controls until recovery. Full T4 alternative renderer remains out of scope.
