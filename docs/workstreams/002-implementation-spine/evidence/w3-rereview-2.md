# W3 second re-review correction evidence

- Panel TypeScript: clean.
- App TypeScript: clean.
- Scoped ESLint: clean, including the artwork effect's primitive `artUrl` dependency.
- Panel unit tests: 19 pass, 0 fail.
- Playwright: 11 pass, 0 fail from the package's self-starting command.
- Screenshot determinism: the suite freezes the evidence clock, disables animation/transition only in the capture page, waits for asynchronous receipts/provider samples, then a second complete run compares every generated W3 PNG byte-for-byte; comparison exit 0.
- Provider artwork: `w3-provider-artwork.json` records the same-origin URL, 176×176 decoded dimensions, and provider sample source for both colourways; `w3-s13-provider-{dark,light}.png` are 544×408 crops.
- Continuous playback: `w3-keyboard.json` records 749.9ms advancement during an 800ms observation. The deterministic clock test proves two leases share one clock and only the final release clears it.
- Active option: `w3-keyboard.json` records that the focused application's active descendant changed with keyboard navigation.
- Target size: `w3-axe.json` records one evaluated `target-size` node per colourway and a measured 48×48 preview target (24×24 panel pixels at 2× preview scale).
- D-019: package source tests reject `Downloads`, `downloaded`, `Play downloads`, and `⤓`; browser state tests assert cached-metadata-only behavior on S03/S08/S13.
- Success: browser tests require S08's returned object key and non-zero playlist-library total, and reject a volume receipt on S08. S13 separately proves its volume mutation and receipt.

## Planted failures

Each plant was applied, its targeted command was run, and the source was restored before the clean sweep:

| Plant | Command | Observed failure |
|---|---|---|
| Replace elapsed playback ticking with `tick(0)` | `bun test packages/panel/src/runtime.test.ts` | exit 1; expected 900ms, received 0ms |
| Replace cached-metadata offline receipt with a Downloads receipt | `bun test packages/panel/src/Panel.test.tsx` | exit 1 in the D-019 source contract |
| Replace S08's created-playlist receipt with `Volume changed.` | package Playwright filtered to `success receipts` | exit 1; expected `Created`, received `Volume changed.` |

The aggregate `bun run gates` result is recorded in `w3-gates.txt`. U14 and H-6 remain owner-only and are not claimed.
