# Surface implementation diary

2026-09-06. Implemented after baseline cleanup authorization; no commit yet, independent review required.

## Sources and decisions

Research source list and design reasoning are in ../surface-research.md. Additional required reading: jotai-state/SKILL.md and ~/code/agent-context/jotai-react-query.md, local resources/jotai/src/vanilla/{atom,store}.ts, vercel-react-best-practices/SKILL.md. Current installed Three Mesh.js confirms interpolation of rear mesh hit normals. Physical shader map alpha is sampled before alpha-test and lighting; the backing specialization changes only RGB immediately after that canonical map chunk, preserving the same alpha.

Rear coordinate contract agreed directly with backend: stickerId identity; one placement per sticker; max12; normalized rear-view center/width and clockwise rotation, physical body 330x552; backend pure catalogue/validator lives @webpod/stickers. UI owns spring timing, reduced motion, pointer capture and persistence. Renderer owns no RAF, scheduler or user state. Exposed camera-backed projection handle is runtime-only; continuous pack/peel/landing props remain serializable.

## Changed surfaces

- packages/device/src/sticker-contract.ts: artwork, placement, pack, scene/projection and pixel geometry seams.
- sticker-surface.ts: exact shell projection with flat-cap fast path, normal lift, bounded grid and cylindrical peel preserving UVs.
- sticker-textures.ts: shared per-URL subscriber-count texture ownership, late-load cleanup, sRGB print and deterministic non-color RGBA roughness.
- StickerSurface.tsx: model-attached printed face and unprinted adhesive underside; named physical coat, alpha-test before lighting, explicit material disposal and borrowed-map semantics.
- StickerPackScene.tsx: existing Canvas and rig; camera-screen anchored laminated wrapper/seams; true curl deformation and vertex landing into transformed device rear; accurate pointer ray projector.
- Device.tsx/DeviceCanvas.tsx/index.ts; CompositeDevice.tsx: minimal production path integration.
- materials.ts: one laminate/wrapper recipe, not per-genre literals.
- packages/state/src/stickers.ts/index.ts: shared inventory/status/interaction action atoms, placement admission, replacement/removal, account-reset semantics.
- scripts/sticker-assets.ts + apps/web/vite.config.ts + .gitignore: before either Vite dev/build, validate all manifest hashes and copy sixty public URL PNGs. Copies generated and ignored; manifest source remains sole artwork authority.
- Targeted tests: packages/device/src/sticker-surface.test.ts, packages/state/src/stickers.test.ts, scripts/sticker-assets.test.ts.

## Verification

`bun test packages/device/src/sticker-surface.test.ts packages/state/src/stickers.test.ts scripts/sticker-assets.test.ts`: 7 pass, 0 fail. Covers all 60 visible crops/flat-cap normals and positions, rear handedness, off-body rejection, real peel curvature/fixed contact/UV continuity, deterministic green-channel roughness, external atom subscriber updates, invalid/unearned rejection, duplicate replacement and account reset, hash-identical production URL copies and inflation/dimensions of every RGBA PNG.

`bunx --bun tsc --noEmit -p packages/device/tsconfig.json`, same for packages/state and packages/composite: pass. Scoped ESLint covering new renderer/state/assets and changed Device/Canvas/Composite/Vite files: pass. Rechecked tests after explicit front/back material ownership change: 7 pass.

## Remaining acceptance work

No screenshots or subjective motion approval claimed yet: UI engineer integrating actual / route. Lead/reviewer must verify production build output URLs, client hydration, texture loader recovery and shared disposal/context-loss behavior under real WebGL; rear/oblique dark/bright/ivory alpha/specular including cutout holes; actual pull/peel/landing video and final rest; reduced motion and keyboard equivalents; tier fallback and existing playback/input regressions. The source tests prove geometry/state, not visual finish. Material values remain initial tuning recipe.

Quality facets are provisional pending visible production evidence: tactile 3/5 (actual curl/contact but unreviewed feel), legible 3/5 (source crop preserved, final size unreviewed), cohesive 4/5 (same model/rig/canvas), responsive 3/5 (no permanent loop, active projection performance unmeasured), accessible 2/5 (renderer projection hooks ready; final semantic controller still integrating). Do not report these as final product ratings.

## Review patch: transient artwork recovery

Read full reviews/surface-review.md and patched the first Major specifically. Factored request ownership into sticker-texture-cache.ts with injected loading adapter. `retryStickerArtwork()` is the public explicit retry action: a single invocation starts at most one request per failed, live URL; successful/pending entries do not restart. There are no timers, automatic retries, or background loops. Both shared subscribers remain mounted and receive loading/success/error transitions. Request generations and entry identity reject stale callbacks and dispose returned GPU textures after last-unmount or supersession. The renderer now exposes `onArtworkReady(id)` alongside error; UI engineer is wiring production feedback/retry and recovery clearing in its owned app files.

Added sticker-texture-cache.test.ts with four failure/lifecycle cases: duplicate subscribers share initial/retry; first failure → explicit retry success; repeated failure never causes an autonomous request; unmounted and superseded callback texture disposal cannot overwrite current state. `bun test packages/device/src/sticker-texture-cache.test.ts packages/device/src/sticker-surface.test.ts packages/state/src/stickers.test.ts scripts/sticker-assets.test.ts`: 11 pass / 0 fail. Device TypeScript and scoped new renderer ESLint: pass.

Lead reports `bun run build` passed and independently matched SHA256 for all sixty assets under apps/web/dist/client/stickers/playworn. Recorded as lead evidence, not this lane's own run. Browser HTTP/alpha/material/gesture/context-loss/demand-rest evidence remains the coordinated UI acceptance lane; no synthetic route introduced.

## Production material browser gate

Added only apps/web/tests/sticker-material.e2e.ts per lead ownership. Production `/` test passed27.5s with deterministic Apple/API fixtures. Six real captures copied to evidence/surface and inspected: dark/bright/ivory rear and oblique, base/finished, real context loss and recovery. Actual GPU draw count stable700ms at rest before/after recovery. Details and source fingerprint in evidence/surface/material-browser.md. App typecheck and new test lint pass. Reused UI's already-passing pointer peel/cancel/PNG retry/mobile evidence rather than duplicating its run. Snapshot runner released to UI before its F2/F3 rerun.

Important observed limitation reported to lead: context-loss T4 screenshot is blank white/broken-image indicator, since CompositeDevice has no T4 presentation branch. This passes recovery but does not certify a usable fallback. Right body wall also darker after recovery; artwork survives. No unsolicited material tuning or unrelated fixes made during evidence run.

Updated observed facets: tactile3/5 (real curl supplied in UI evidence and coat visible, owner feel judgment pending), legible4/5 (all three palettes readable at actual widths), cohesive4/5 (one production rig with restrained localized finish), responsive4/5 (actual GPU settles at rest and restores), accessible3/5 (UI equivalents tested separately; T4 presentation needs explicit limitation/fix). These remain evidence-backed reviewer inputs, not owner approval.

## Context-loss presentation and readiness correction

Lead authorized a bounded correction after image inspection: CompositeDevice now displays `Restoring device view…` as polite semantic status while contextLost, retaining the Canvas for restoration. This is not a replacement T4 renderer. UI engineer gated sticker controls/capture through current composite T1 capability. Material test asserts status and sticker availability during real loss/recovery. Updated capture pending combined run.

Reviewer's combined test initially failed asset count0 after5s. Inspected the actual trace with reviewer: GPU T1 was established but only development-token HTTP200 had occurred; no sticker session request had started before the asset assertion expired. T1 is not authorization/inventory readiness. The material test now explicitly waits for successful POST /api/stickers/session bootstrap response (bounded30s) before asserting texture loads, instead of increasing a fixed sleep. Failing trace retained by reviewer as evidence/surface/material-combined-readiness-failure.trace.zip. UI engineer owns the serialized combined rerun after this correction.

Final combined run reported by UI engineer:3/3 passed58.7s fingerprint e714a9f35b3ec45a82e7f3520356de66d95b0a85acdfaac8425195232e8ba190. Personally inspected updated05 (legible semantic restoring notice; no sticker controls) and06 (all three prints recovered). Numeric artifact personally read:991→991 draws before loss,1123→1123 after restoration,700ms windows,3 HTTP artwork successes. Updated material-browser.md to describe fixed context-loss presentation accurately. Independent reviewer now rerunning narrow material test to close its earlier readiness failure. No material recipe or identity/persistence changes in this lane.
