# Review — volumetric device (`9502d04`, `92db49e`)

Verdict: REQUEST_CHANGES

I reviewed this personally in the shared workspace, grounded the geometry against Pencil components `VWaJS` and `zbTc3` through Pencil MCP, read the required workstream documents, and re-ran the local checks I could complete without delegating.

## Major findings

1. `/_spike/device` cannot currently clear the required edge pose because the first visible shell hit is unnamed.

   - `packages/device/src/Device.tsx:644-649` creates the steel shell mesh/material without a mesh name or material name.
   - `packages/device/src/probe-raycast.ts:132-166` only reports the first visible hit by `object.name` and `material.name`.
   - `apps/web/src/routes/[_]spike.device.tsx:398-449` rejects any sample whose first visible hit does not match the expected identity.

   My independent live run on `/_spike/device` reproduced this failure at the 90° edge pose:

   `window.__deviceCalibration.setParams({ pose: "edge", colourway: "white" }); window.__deviceCalibration.sample()`

   threw:

   `device probe rejected --poly-w-0: expected device-body/body-white, hit nothing/; ray Mesh[visible=true;materials=MeshPhysicalMaterial:true:false:1] > device-body[visible=true;materials=body-white:true:false:1]`

   That blocks the scope requirement that the 90° edge view be proxy-verifiable from the actual rendered object (`docs/workstreams/002-implementation-spine/scope-volumetric-device.md:55-65`). Right now the diagnostic route used as proof rejects the edge pose.

2. The rear-pose verifier is still targeting the wrong rendered surface.

   - `packages/device/src/Device.tsx:625-640` intentionally places `device-back-composition` as a visible double-sided composition plane in front of the steel back.
   - `packages/device/src/luminance-probe.ts:123-124` maps the rear surface identity to `device-steel-back` / `steel-back`.
   - `packages/device/src/luminance-probe.ts:341-352,447-453` uses that steel identity for every rear probe target.
   - `apps/web/src/routes/[_]spike.device.tsx:398-449` then rejects the rear sample when the first visible hit is the composition plane instead of the steel.

   My independent live run on `/_spike/device` reproduced this at the rear pose:

   `window.__deviceCalibration.setParams({ pose: "rear", colourway: "white" }); window.__deviceCalibration.sample()`

   threw:

   `device probe rejected --steel-0: expected device-steel-back/steel-back, hit device-back-composition/; ray device-back-composition[visible=true;materials=MeshBasicMaterial:true:true:1] > device-back-composition[visible=true;materials=MeshBasicMaterial:true:true:1] > device-steel-back[visible=true;materials=steel-back:true:false:1]`

   This is not just a test nuisance. The committed rear object and the verifier disagree about which surface constitutes the rendered rear pixel, so the rear-readability proof is not trustworthy yet.

## Missing evidence

I independently completed:

- `bunx tsc --noEmit -p packages/device/tsconfig.json` → exit 0
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → exit 0
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → exit 0
- `bun test packages/device packages/composite` → 144 passed
- `bun run lint` → exit 0
- `bun run build` → exit 0
- `bun run gates` → exit 0

I also inspected the committed browser evidence, responsive Playwright evidence, and the Pencil-authoritative front/rear components.

I did not complete the extra fresh composite pose/DPR/interaction rerun I had started after being told to stop long-running commands. The committed suite does cover responsive containment, DPR 1/2/3, and composite refit, but I am not treating composite three-quarter/edge/rear interaction as independently re-cleared by a second instrument in this review. Missing evidence alone would keep this from APPROVE even without the two majors above.

## Notes

- `docs/workstreams/002-implementation-spine/diary/volumetric-device.md:3-5,55-67` and `docs/workstreams/002-implementation-spine/evidence/volumetric-device-verification.md:41-73` are too strong for me to accept as approval evidence today. They present the slice as browser-verified/green, but my independent edge/rear pose probe still rejects the standalone verifier and I did not finish a second-instrument composite rerun after stopping the longer browser work.
- I found no separate blocker in the per-package/app typecheck, lint, build, or automated gate runs; the blocking surface here is proof correctness at the live edge/rear poses.

# Re-review — `e76d1a3` + `929d8d3`

## Verdict: REQUEST_CHANGES — 1 Major

The two exact Majors from the initial review are closed.

- Edge proof is now tied to the visible shell with stable semantic identity: `packages/device/src/Device.tsx:645-648`, `packages/device/src/probe-raycast.ts:174-190`, and `apps/web/src/routes/[_]spike.device.tsx:430-481`.
- Rear proof now classifies the rendered back-composition plane while still requiring steel behind it: `packages/device/src/Device.tsx:625-641`, `packages/device/src/luminance-probe.ts:155-163,219-229`, and `apps/web/src/routes/[_]spike.device.tsx:456-481`.
- The matcher was not broadened until green. `visibleProbeHits()` only collapses consecutive exact duplicates, and the planted fail-closed cases are present and green in `packages/device/src/probe-raycast.test.ts:69-97,144-197` and `packages/device/src/luminance-probe.test.ts:219-249`.

I also closed the missing-evidence gap myself on August 31, 2026:

- `bunx tsc --noEmit -p packages/device/tsconfig.json` → exit 0
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → exit 0
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → exit 0
- `bun test packages/device packages/composite` → 149 pass / 0 fail
- `bun run lint` → exit 0
- `bun run gates` → exit 0, 16 automated passed, 0 failed; `U14`/`U15` still manual
- fresh flagged Chrome 151 T1 matrix on a local Vite server at `127.0.0.1:4318`:
  - composite front / three-quarter / edge / rear all resolved `tier: "T1"`
  - each pose kept exactly one panel host and one canvas
  - `requestPaint` was true in all four poses
  - keyboard interaction continued in all four poses
  - no horizontal overflow at 390×844 (`scrollWidth === clientWidth === 390`)
  - DPR 1/2/3 WebGL buffers measured exactly 330×552, 660×1104, and 990×1656
  - resize 390×844 → 390×568 → 390×844 preserved centering and keyboard continuity

## New Major

1. The refreshed evidence still under-classifies a material-acceptance failure that remains scope-blocking.

   - `docs/workstreams/002-implementation-spine/dispatch/W4-device-layer.md:17-26` makes the stop-table match an acceptance criterion, not a nice-to-have.
   - `docs/workstreams/002-implementation-spine/evidence/volumetric-device-verification.md:113-114` reduces the remaining failures to a note that they are “luminance deltas”.
   - `docs/workstreams/002-implementation-spine/evidence/volumetric-device-browser/summary.json:86-223` still reports failures on all four sampled device poses.

   I did not stop at the checked-in counts. I re-ran `window.__deviceCalibration.sample()` independently in flagged Chrome after the semantic-proof fixes had landed:

   - front / white: 15 of 16 failed, max `|delta| = 65.85`
   - three-quarter / black: 13 of 16 failed, max `|delta| = 70.72`
   - edge / white: 3 of 3 failed, max `|delta| = 51.79`
   - rear / white: 8 of 11 failed, max `|delta| = 205.64`

   Representative misses from the independent rerun:

   - `--poly-w-2`: expected `240.93`, measured `220.22`, delta `-20.71`
   - `--edge-shell-w-1`: expected `173.88`, measured `122.09`, delta `-51.79`
   - `--steel-4`: expected `108.81`, measured `24.44`, delta `-84.37`

   Because the edge and rear verifier now follows the visible rendered stack honestly, these are no longer explainable as the old hidden-surface/identity bug. They are the current output of the shipped material/light stack on the surfaces W8 says must read correctly. The relevant implementation surface is the current material and rig definition at `packages/device/src/materials.ts:141-174` and `packages/device/src/light-rig.ts:61-76`, plus the rear composition stack at `packages/device/src/Device.tsx:625-651`.

   I am therefore not comfortable approving `929d8d3`'s framing of the remaining failures as merely informational. The exact previous Majors are closed; this new Major remains.

## Owner-only uncleared items

`U14`, `U15`, and final owner aesthetic acceptance are still manual/owner-only per `docs/workstreams/002-implementation-spine/scope-volumetric-device.md:67-68`. I am not using those to fabricate this verdict either way.

# Re-review — `faadf18` under owner-settled D-064

## Verdict: REQUEST_CHANGES — 2 Major, 2 Notes

Reviewed personally in the current shared workspace. No delegation, tasks, threads, worktrees, staging, commits, implementation edits, or direct `.pen` file access. I loaded `modern-web-guidance` first, then strict critique and the requested design/frontend/runtime skills. Strict critique's normal teammate-review requirement is explicitly superseded here by the owner's "No delegation" instruction, so this is a personal antagonistic re-review.

Owner-settled D-064 is treated as binding: the ±4 stop-table check applies only to canonical white front, black front, and steel rear. Rotated poses are judged by physical continuity, material identity, silhouette, occlusion, and absence of view-locked shading; pose-specific lights, painted gradients, hidden proxy sampling, and altered reference values remain forbidden.

## Independent verification performed

- Mandatory docs read: `AGENTS.md`, `scope-volumetric-device.md`, owner-settled `decision-log.md` D-064 at `:857-867`, `dispatch/W8-volumetric-device.md`, `dispatch/W4-device-layer.md`, the prior `volumetric-device-review.md`, `diary/volumetric-device.md`, `decisions/volumetric-device.md`, `evidence/volumetric-device-verification.md`, and `evidence/volumetric-device-browser/summary.json`.
- Pencil reference read only through the Pencil MCP for `VWaJS` and `zbTc3`. I did not read or grep `design.pen` directly. The reference still shows the white front as a layered polycarbonate/glass object and the rear as a distinct brushed steel/inlay object; native captures are closer than the earlier flat passes, but owner aesthetic acceptance remains uncleared.
- Three/R3F grounding used exact files under `/Users/vinicius/code/agentic-context`: `three.js/src/textures/HTMLTexture.js`, `three.js/src/renderers/webgl/WebGLTextures.js`, `three.js/examples/jsm/interaction/InteractionManager.js`, `react-three-fiber/packages/fiber/src/web/Canvas.tsx`, `react-three-fiber/packages/fiber/src/core/renderer.tsx`, `react-three-fiber/packages/fiber/src/core/loop.ts`, and `react-three-fiber/packages/fiber/src/core/store.ts`. The installed repo package is `three@0.185.1` and `@react-three/fiber@9.7.0`; the checked `/Users/vinicius/code/agentic-context/three.js/package.json` labels that clone as `0.185.0`, so I am recording the clone-version mismatch rather than pretending it is not there.
- Fresh flagged-Chrome measurements in the shared workspace, with `CanvasDrawElement` enabled, passed the mechanical path: `requestPaint`, `layoutSubtree`, and `texElementImage2D` were present; `texElementSubImage2D` was absent; T1 composite focus/keyboard worked through the DOM panel; DPR 1/2/3 produced 330×552, 660×1104, and 990×1656 WebGL buffers; mobile 320/375/390 viewports centered without horizontal overflow; resize preserved centering; demand idle stayed at 0 rAF over the idle window.
- Fresh canonical samples in that same flagged browser had no failures: black front max delta `3.9999999999999964`, white front max delta `3.893699999999967`, black-front-again matched black front, and steel rear max delta `4`. Rotated three-quarter, edge, and custom-flip samples failed closed with the D-064 non-canonical message while the visible object remained a single rotated model.
- Fresh bounded checks passed: `bunx tsc -p packages/device`, `bunx tsc -p packages/composite`, `bunx tsc -p apps/web`, `bun run typecheck` (11/11), `bun run lint`, `bun run build`, `bun test` (966 pass / 0 fail), and `bun run gates` (16 automated passed / 0 failed, with `U14` and `U15` still manual).

## Major 1 — shipped cover glass still uses an unattenuated additive edge-light shader

`docs/workstreams/002-implementation-spine/scope-volumetric-device.md:16-17` forbids material lift from being a view-locked painted gradient or an unattenuated extra light, and owner-settled D-064 repeats the same prohibition at `docs/workstreams/002-implementation-spine/decision-log.md:861-867`.

The shipped device creates and mounts this material unconditionally: `packages/device/src/Device.tsx:562-570` builds `coverGlassMaterial` through `createCoverGlassMaterial(...)`, and `packages/device/src/Device.tsx:793-798` places that material on the front cover-glass mesh. This is not a diagnostic-only overlay or a browser-proof-only override.

Inside that material, `packages/device/src/physical-materials.ts:81-87` installs fixed cool/warm shader uniforms, and `packages/device/src/physical-materials.ts:113-118` injects UV-edge masks plus Fresnel into `outgoingLight`:

- the cool/warm colors are constants, not derived from the world light rig;
- the edge masks are authored from `vWebpodGlassUv`, not from reflected environment radiance;
- the final operation is `outgoingLight += ...`, so it adds light after the physical material has already computed its lighting.

`packages/device/src/materials.test.ts:140-148` currently asserts that `glassEdgeCool`, `glassEdgeWarm`, and `webpodFresnel` exist, but it does not assert attenuation by the world-fixed lights, the environment, transmission, or exposure. That means the gate enshrines the exact shader shape D-064 forbids instead of constraining it.

This is a Major because D-064 did not relax physical material identity for the canonical passing poses. It relaxed only the static ±4 expectation for rotated poses. The implementation can pass the canonical luminance table while still violating the binding "no unattenuated extra light / no painted gradient" rule on a visible shipped surface.

## Major 2 — committed browser evidence is not reproducible as evidence for `faadf18`

The checked evidence records a browser source identity of `1e2dd4fcfc70eae800a97b6f6a86f91f82445ebb1854cf98a153b3bf7321842d` across 170 files at `docs/workstreams/002-implementation-spine/evidence/volumetric-device-browser/summary.json:5-8` and repeats that identity at `docs/workstreams/002-implementation-spine/evidence/volumetric-device-verification.md:95-98`.

I reconstructed the same source fingerprint algorithm from Git objects for `faadf18`, without using the dirty worktree. The reviewed commit is tree `a8ab5698850a353a113a3b83971611cad4674a47`, with 170 browser-served files, but its digest is `c85e83dc3bbc45b08762e4e56c4e980763b53ec8b611ba9c8cf23434da568f71`, not the checked evidence digest. I also measured the current dirty checkout separately; it has 170 files and digest `28719650951e16b271ee4c1b97667f71aef0f80b01fcf4eccd543b02607212b2`, also not the checked evidence digest.

So the durable browser proof was produced from neither the clean reviewed commit nor the current shared checkout. Same file count, different bytes. The route-level health check is useful for detecting mid-run HMR drift, but it is not a commit-identity proof: `scripts/browser-source-fingerprint.ts:21-42` intentionally hashes dirty working-tree bytes, `apps/web/tests/playwright.config.ts:8-10` sets the expected digest from whatever the workspace contains when the test starts, and `apps/web/tests/volumetric-device-verification.e2e.ts:273-274` only checks current equals expected within that run.

This is a Major because the request is specifically an independent re-review of commit `faadf18` and asks for evidence reproducibility. The fresh browser measurements I ran today are mechanically encouraging, but they prove the current mutable workspace state I served, not that the checked browser evidence belongs to `faadf18`.

## Notes

1. The suspicious exact boundary values were checked. The browser E2E asserts `sample.maxAbsDelta <= 4` at `apps/web/tests/volumetric-device-verification.e2e.ts:310-313`, and the fresh browser values were strictly within that condition. Separately, `packages/device/src/luminance-probe.ts:675-677` adds a `1e-9` epsilon in the lower-level evaluator and `packages/device/src/luminance-probe.test.ts:44-69` verifies a value infinitesimally greater than the exported tolerance can pass there. I am not making this a blocker because the browser proof has the stricter guard, but the lower-level name `LUMINANCE_TOLERANCE` is slightly less strict than it reads.
2. The requested `global-patterns` skill could be loaded, but both referenced global context files were missing at `/Users/vinicius/code/agent-context/global.md` and `/Users/vinicius/code/agentic-context/global.md`. I continued from repo law, exact workstream docs, and the framework source files above.

## Manual items

`U14`, `U15`, and final owner visual/aesthetic acceptance remain manual/owner-only. I am not using the native screenshots or Pencil comparison to fabricate acceptance either way.
