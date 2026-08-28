# Panel correction evidence map

This map addresses every binding review finding and all re-review entry criteria. It is an index to executable evidence, not a waiver.

## Findings 1–16

1. S13 renders deterministic pale/dark fixture artwork, exact 3×3/8×8 treatment inputs, actor-hue exclusion, luminance guards, fixed plates, polarity-specific bloom, and reduced-transparency fallback. Four focused screenshots cover both axes.
2. S08 uses `useVirtualizer` with a 120-row fixture, a measured spacer, bounded mounted rows, and 4× CPU-throttled browser evidence.
3. S08 Enter calls the fixture provider’s `play`; S13 subscribes through `useSyncExternalStore` to playback and progress. Keyboard evidence records non-zero progress.
4. The browser state-matrix test asserts screen-specific behavior for every prescribed state, and the 48-image matrix covers both colourways.
5. Success mutates fixture volume, carries human/agent origin, renders the matching actor channel, and emits an in-raster receipt.
6. Closed URL parsing reaches 100%, 130%, and 200%; effective density reports 8/6/4 rows and browser checks reject raster clipping.
7. Store initialization occurs in a document-scoped effect, the route is client-only, and a server-render test proves rendering does not mutate the singleton.
8. Every authored final font size is at least 11px; a mutation-resistant test parses every `font-size` declaration.
9. Playwright proves keyboard traversal, selected-option semantics, progress, preference emulation, axe results in both colourways, and the target-size rule explicitly.
10. Evidence includes 48 state crops, four artwork crops, four Dynamic Type crops, and six preference crops, each locator-cropped at exact 2× raster scale without page chrome.
11. Deterministic tests bind the eight-row skeleton and ≥11px typography literals, plus provider subscriptions, commands, virtualization, adaptive art, and store purity.
12. W3’s scoped type/lint/unit/browser commands pass. The W5a-owned aggregate is currently prevented from loading by a concurrent deletion of `scripts/gate-core.ts`; this dependency is recorded verbatim in `w3-gates.txt`.
13. The app imports canonical `@webpod/panel`; its manifest declaration was committed in the earlier correction and the lockfile carries panel browser-test dependencies without removing device/composite dependencies.
14. Public exports carry lifecycle/return TSDoc. Implementation and test names contain no workstream identifiers.
15. All new screenshot evidence is real PNG data produced by Playwright. The earlier mislabeled files were converted to PNG in the first correction.
16. Search input is narrowed by closed parsers with explicit return unions and no unchecked casts.

## Re-review entry criteria

1. Provider playback/progress: `w3-keyboard.json` and browser test.
2. TanStack Virtual >100: 120 rows plus `w3-virtual-performance.json`.
3. Complete states: browser assertions and 48 state crops.
4. Adaptive artwork: four `w3-s13-art-*` crops and deterministic model tests.
5. Dynamic Type: four `w3-dynamic-*` crops and no-clipping assertions.
6. Store purity: server-render mutation test and client-only route.
7. Browser accessibility/preferences: `w3-axe.json` and six preference crops.
8. Mutation gates: exact skeleton count and parsed minimum font-size tests.
9. Universal runner dependency: exact current failure recorded in `w3-gates.txt`; W3-owned constituent gates pass.
10. Canonical package: `apps/web/src/routes/index.tsx` imports `@webpod/panel`.

U14 thumb occlusion and H-6 both-colourway aesthetic acceptance remain owner-only and are not claimed.
