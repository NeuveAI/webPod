# Production sticker interaction verification

2026-09-06, implementer run; independent approval is in reviews/final-implementation-review.md.

`bunx --bun playwright test --config apps/web/tests/playwright.config.ts sticker-collection.e2e.ts`

Result: **2 passed (56.5s)**. Served immutable worktree snapshot fingerprint **a8aa363b8e33fe697dcac1c67fa7966c767d51d0964735745850cb03ad6cc31f**, 279 browser source files. Chrome T1 production `/` routing to the existing product route; real Canvas/DOM controls, mocked Apple/provider and scoped sticker HTTP endpoints. No claim of real account authorization or live backend integration: that remains owner identity dependent.

First test verifies rear tease, keyboard pull equivalent, earned pack open, failed PNG (503) followed by explicit retry and successful load with exactly two artwork requests, actual 45px partial cylindrical peel, pointercancel, fresh peel dragged onto camera-projected rear surface, successful persistence, keyboard placement, remove, reload restoration, 375px reduced motion, keyboard arrow reposition/Enter and Escape focus return.

Second test verifies review F2: delay placement A, choose B, finish A successfully, B remains selected; delay save B, choose A, fail B, A remains selected and no stale failure message appears. It verifies F3: cancel partial pack pull → tease/progress0; cancel held rear landing → open/landing0; start peel, change reduced motion while captured, continue moving and release → remains tease/progress0/landing0.

Curated images are numbered in test order: 01 rear tease, 02 open pack, 02b partial peel, 03 saved sticker, 03b identical production scene with dev-only clearcoat disabled, 04 mobile reduced-motion keyboard result. Material angle/palette and context restoration evidence is separately under evidence/surface.

`bun test apps/web/src/sticker-runtime.test.ts apps/web/src/sticker-motion.test.ts apps/web/src/music-runtime.test.ts apps/web/src/production-device-view.test.ts`: **24 pass, 0 fail, 84 assertions**. Includes exact F1 sequence: PUT409 → pending reconciliation GET → logout → GET rejection; inventory remains null and status signed-out.

`bunx --bun tsc --noEmit -p apps/web/tsconfig.json`: pass.

Scoped ESLint for `apps/web/src/sticker-*.{ts,tsx}`, production-device-view.tsx, music-runtime.ts and sticker-collection.e2e.ts: pass.

After this served snapshot, one small UI conditional added a truthful partial/failed import retry notice. It passed app typecheck/lint and does not alter the complete-import test path. Independent reviewer is rerunning the current snapshot.

## Final combined checkpoint

`bunx --bun playwright test --config apps/web/tests/playwright.config.ts sticker-collection.e2e.ts sticker-material.e2e.ts`: **3 passed (58.7s)**, immutable source fingerprint **e714a9f35b3ec45a82e7f3520356de66d95b0a85acdfaac8425195232e8ba190**, 279 browser source files. This is the final implementer source, including partial import notice, centralized intent admission, keyboard supersession and tier/context-loss availability.

F2 regression now parameterizes the previously omitted keyboard and fresh-pointer siblings: delayed save success cannot clear a subsequent ArrowLeft placement or a newly held peel. Every fresh command, selection, pointer start, or admitted arrow manipulation passes `admitIntent`: cancel pointer ownership/RAF, then advance presentation generation. Delayed server writes retain durable results but may not mutate a newer presentation. Ongoing movement and animation completion do not manufacture new intent.

The combined material test additionally verifies three actual PNGs loaded after authenticated bootstrap, dark/bright/ivory rear and oblique base-vs-finish, real WEBGL context loss with visible restoring status and unavailable sticker controls, context restoration with returning controls, and unchanged GPU draw counts during 700ms resting windows before/after restoration. Material screenshots and runtime JSON were copied to evidence/surface. Current numbered interaction images were refreshed from this run.
