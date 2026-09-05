# Lower-left screen reflection

The approved seam, input alignment, and reflection work was committed first as `193984a` (`Close Classic shell seam and align wheel input and screen reflections`). The owner approved this lighting refinement for commit after visual review.

`packages/device/src/product-studio.ts` adds a small cool-white card to the screen-only environment. Its position `[-5, 3, 50]` sits within the existing PMREM capture volume; the existing softening and key-card orientation produce a gentle lower-left screen reflection. The shared metal environment and physical scene lights are unchanged.

Captured both finishes at five orientations with the deterministic LCD fixture using `CAPTURE_UI=1 CAPTURE_PREFIX=accent-after bun docs/workstreams/014-classic-consolidation/evidence/capture.ts`. Front views and the black oblique view were visually inspected. The new accent remains smaller than the main reflection and leaves text legible.

Pixel comparison against the committed `fit-after` front views found no changed pixels outside the screen for either finish. See `evidence/accent-lighting.json`; rendered evidence is `evidence/accent-after-{black,white}-{front,oblique,side,reflection,bottom}.png`.

Validation: 222 device tests passed, all 11 typecheck projects clean, production build passed, and ESLint passed for the changed source. Logs are saved as `evidence/accent-{tests,types,build,lint}.txt`.
