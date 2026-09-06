# Independent session checks

2026-09-06, reviewer session lane. Synthetic credentials only, temporary/in-memory databases. No live Apple request or existing user DB. No browser snapshot process started.

- `bun test apps/web/scripts/sticker-start.integration.test.ts apps/web/scripts/sticker-production.test.ts packages/server-core/src/stickers/live.test.ts apps/web/src/server/sticker-runtime.test.ts`: **12 passed, 0 failed, 290 assertions**. Read tests before execution. Integration imports actual built Start server and injects only trusted request context, served through Bun native HTTP. Production test starts the actual Bun entry, fetches SSR `/`, all 60 files with SHA256 checks, and authenticated boundary401. These are real route-boundary/transport checks with synthetic Apple upstream, not live MusicKit verification.
- `bun test packages/server-core/src/stickers/stickers.test.ts`: **19 passed, 0 failed, 74 assertions**. Covers earning, grants, migration/reopen, tenant boundaries, failure-preserving imports, bounded Apple responses and HTTP schema/origin guards.
- `bunx --bun tsc --noEmit -p apps/web/tsconfig.json` and `bunx --bun tsc --noEmit -p packages/server-core/tsconfig.json`: **passed**. At initial execution app tsconfig excluded new scripts; engineer notified to extend the gate before final approval.
- `bunx --bun eslint packages/server-core/src/stickers apps/web/src/server apps/web/src/server.ts apps/web/src/routes/api.stickers*.ts apps/web/scripts apps/web/src/sticker-runtime.ts apps/web/src/sticker-runtime.test.ts apps/web/vite.config.ts`: **passed**.
- Inspected built client JavaScript for `bun:sqlite`, `createLiveStickerServer`, `mintAppleDeveloperToken`, `APPLE_MUSICKIT_KEY_PATH`, `sticker_sessions`: **no matching files**. This is a targeted server-code boundary check, not a claim of exhaustive secret scanning.
- Initial review issues have explicit passing regressions: logout using only active cookie revokes access; database path function rejects absent/relative/public/traversal/symlink locations and accepts canonical private path. Code now derives revocation devices from both valid credentials and resolves existing path ancestors before containment checks.

Supplementary runtime review loaded modern-web-guidance before client session diff; searched `Abort fetch on logout and prevent stale authentication callbacks` via bunx and retrieved security guide. Applied cookie/origin guidance under scoped device-recovery contract (blanket storage clearing would contradict retained recovery identity). Jotai skill/reference and supplied Interface Craft/Guardrails/Neuve Motion reviewed; no animation/style/3D files changed in this session lane, so subjective physical-material approval stays with existing UI evidence and its review lane.

## Follow-up gate checks

- App tsconfig now includes `scripts/**/*.ts`; independently reran app tsc successfully. Production transport and both native integration tests now participate in static verification.
- Snapshot source fingerprint now includes `apps/web/scripts`; snapshot exclusion includes private `.data` and SQLite database/sidecars. `bun test scripts/browser-source-fingerprint.test.ts`: **6 passed, 42 assertions**. Scripts fingerprint and production scripts eslint passed.
- Latest `bun test packages/server-core/src/stickers/live.test.ts packages/server-core/src/stickers/stickers.test.ts apps/web/src/sticker-runtime.test.ts`: **35 passed, 164 assertions**. This includes newly added global upstream admission and forged-session checks and client delayed credential-callback cancellation.
- Source inspection confirmed future-schema rejection now precedes persistent journal-mode changes.
- Full browser automatic cookie/preparation/sign-in/rendered-inventory seam remains separately requested; a manual native cookie jar does not establish this behavior. Incoming Request.signal cancellation regression requested in addition to already passing explicit logout and runtime-disposal cancellation tests.

## Production page extraction review

Independently compared the full HEAD diagnostic device route against new `apps/web/src/device-page.tsx`, not merely the large move diff. Differences are import relocation; exported DevicePage; DEV-only capture/diagnostic/window control exposure and playback diagnostics; removal of the DEV-only product rejection. Existing ProductDeviceView hierarchy, settings, orientation lifecycle, styles and motion remain identical. `/` is canonical with `ssr:false`; the legacy diagnostic route alone retains its DEV guard. No source correctness defect in this extraction.

Loaded actual Interface Craft + storyboard/design-critique, Interface Design Guardrails and its four resources, Neuve Motion + tokens/principles/reduced-motion, Jotai and React performance skills. Retrieved current Web Interface Guidelines from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` for accessibility and motion checks. Existing keyboard region, focus ring, labeled settings/actions and motion ownership remain in the same component tree; no new style/animation system or component state was introduced. Actual rendered experience still requires browser evidence below.

`bun test apps/web/src/device-preview-orientation-source.test.ts apps/web/tests/production-device-view.test.ts`: **4 passed, 47 assertions**. These are explicitly structural source regressions, not browser-rendering proof.

## First real-browser independent run

`bun test apps/web/scripts/sticker-browser.integration.test.ts apps/web/scripts/sticker-start.integration.test.ts apps/web/scripts/sticker-production.test.ts`: **3 passed, 260 assertions**, 4.87s. Built server hash `f4c5218a1abb57549e39816390d6fdb97b61ab2b11d601629b00b023e953aac4`. Browser operated production `/`, verified T1 Canvas, signed in through the real developer-token and sticker endpoints, checked HttpOnly cookie transport, pulled/peeled/stuck using real pointer input, signed out/reconnected, and isolated a second browser. MusicKit SDK and trusted server Apple/signing dependencies alone are synthetic; zero `/api` interceptions.

Visual QA caught an evidence gap despite passing tests: regenerated `browser-03-reloaded.png` showed an empty device canvas/background; the first starter and placed captures showed the correct rear device and artwork. The reload test waited inventory and lip visibility but not rendered device readiness. Reviewer sent this to engineer to distinguish capture timing from a lifecycle fault and require settled visible reload proof before final approval. No subjective reload/material success claimed from that empty image.

## Final independent closure

Engineer added bounded actual screenshot pixel polling for orange artwork in the rear landing region and saves the exact passing frame. No product instrumentation was added. Independently reran the same three built native/browser/production tests: **3 passed, 260 assertions**, 5.18s, with two successful Playwright screenshot readiness polls. Visually inspected the regenerated reload image: real silver rear and orange Sound Check artwork now visible at the persisted placement, matching the initial saved view. The prior blank capture was a paint-readiness race and is no longer accepted as evidence.

Final app TypeScript check includes all scripts and canonical pinned Playwright imports; scoped lint passes. Rechecked current built client JS: no matching SQLite/live server/key configuration/session table implementation markers. Final independent review disposition is **APPROVE**, recorded in reviews/session-review.md with explicit source-equivalence, structural-test and actual production-browser evidence separated.
