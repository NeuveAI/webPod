# Antagonistic review — W6 T1 composite

**Reviewed commits:** `8208ccc`, `9d6979a`, `cf6b75a`, `cbfe7f3`, `1c21a7d`  
**Verdict:** **REQUEST_CHANGES — 8 Major, 3 Minor**

The central experiment is real: in Chrome 151 with
`--enable-blink-features=CanvasDrawElement`, Three uploads the DOM through
`HTMLTexture`; the panel remains in the accessibility tree; native focus,
pointer hit-testing and ArrowDown work; and a settled page requests zero rAF
callbacks over two seconds. None of that clears the slice. The geometry becomes
wrong after a viewport/camera change, the strategy interface cannot represent
the four tiers it claims to model, the required U10 re-review is absent, and two
T1-blocking content restrictions remain unresolved.

## Review setup and primary sources

Loaded in full before forming findings:

- `docs/workstreams/002-implementation-spine/{scope.md,dependency-graph.md,hitl-decisions.md,preview-validation.md,review-lanes.md,review-system-prompt.md,decision-log.md,tracker.md}`
- `docs/workstreams/002-implementation-spine/dispatch/W6-composite.md`
- `docs/workstreams/002-implementation-spine/{diary/w6.md,decisions/w6.md}` and every `evidence/w6-*`
- W3/W4 public boundaries and their current working-tree state
- `docs/workstreams/001-interface-design-handover/{readme.md,pm-spec.md,design-system.md,stack-research.md}` (read-only)
- `/strict-critique`, `/runtime-review`, `/modern-web-guidance`, `/browser-security`, `/interface-craft` + Design Critique, `/agent-browser`, `/cdp-session`, `/team-orchestration`, its review protocol, and `/workstream-scoping`

No Neuve board or shell exists in this repository; `scope.md` records the owner
ruling that `tracker.md` is the process source instead.

Experimental/runtime claims below are grounded in these exact read-only clones:

- `/Users/vinicius/code/agentic-context/html-in-canvas` @ `fcbe8f33a83307ef410c5a834350e53f154eb593`
  - `README.md:27-46,321-396`
  - `Examples/webGL.html:25-43,55-80,180-191`
- `/Users/vinicius/code/agentic-context/three.js` @ `ae46171bedd9885f1019637fee6a86d2380eac01`
  - `src/textures/HTMLTexture.js:26-70`
  - `src/renderers/webgl/WebGLTextures.js:324-342,1257-1321`
  - `examples/jsm/interaction/InteractionManager.js:118-222`
  - `examples/webgl_materials_texture_html.html:73-177`
  - `src/materials/Material.js:528-548`
  - `src/geometries/ExtrudeGeometry.js` (`WorldUVGenerator` cap mapping)
- `/Users/vinicius/code/agentic-context/react-three-fiber` @ `ff3899dbf43d2a88895fecf53c147192abfd7431`
  - `docs/API/canvas.mdx`
  - `docs/API/hooks.mdx`
  - `docs/advanced/scaling-performance.mdx`

## Major findings

### Major 1 — native hit geometry becomes stale after a canvas/camera viewport change

**Files:** `packages/composite/src/html-in-canvas.ts:94-96,120-126,152-158`; `packages/device/src/screen-mesh.ts:210-219`

The implementation calls `InteractionManager.update()` only for a screen mesh
world-matrix notification or a resize of the **panel element**. W4's notifier
suppresses notifications whenever `mesh.matrixWorld` is unchanged. Neither path
covers a canvas CSS-size change, a camera projection change, or a replacement
camera.

That omission is not theoretical. Three's pinned
`InteractionManager.js:127-206` recomputes its viewport matrix from
`canvas.clientWidth/clientHeight` and the current camera only when `update()` is
called. I reproduced the flagged route at 1280×720 and then resized it to
800×500. The rendered device and screen shrank, but the transformed DOM host
kept its old 213×160 CSS-pixel bounds and its old `matrix3d`. A pointer click at
`(300,200)`—outside the now-visible device screen—still focused `application
"webPod music player"`.

This breaks the correctness target at dispatch lines 24-28 and 64: browser-native
hit-testing and accessibility geometry are only correct while the first viewport
and camera remain unchanged. Add a non-polling resize/camera invalidation path
and a flagged-browser regression that proves visible pixels, DOM bounds, pointer
target and accessibility bounds stay aligned.

### Major 2 — renderer and camera replacement leave a detached or stale strategy alive

**File:** `packages/composite/src/CompositeDevice.tsx:103-119`

When the renderer changes, `setRenderContext()` calls `this.source?.detach()` but
does not set `this.source = null`; `reconcile()` therefore refuses to attach a
source to the new renderer. When only the camera changes, it does not even
detach: the existing `InteractionManager` keeps the old camera captured by
`connect()` (`InteractionManager.js:118-123`) while the coordinator stores a
different one. The four Bun tests never instantiate the lifecycle and cannot
catch either branch.

This is especially material at the context boundary the slice claims to handle.
Test renderer replacement, camera replacement, context loss/restore, repeated
attach/detach, and partial-attach failure through the real coordinator.

### Major 3 — W6.4, the blocking U10 re-review, was not delivered

**Files:** `docs/workstreams/002-implementation-spine/dispatch/W6-composite.md:79-80,88-95`; `docs/workstreams/002-implementation-spine/evidence/w6-t1-browser.txt:7-19`

The dispatch requires composited and bare axe reports, a bare-mount report, an
idle-rAF report, screen-reader notes and keyboard traversal, followed by a
dedicated accessibility-review commit. None of
`w6-axe-composited.txt`, `w6-axe-bare.txt`, `w6-panel-mounts-bare.txt`, or
`w6-raf-idle.txt` exists. The one browser note contains an accessibility snapshot,
one ArrowDown and an rAF count; it is not the prescribed U6/U7/U11/U12 re-review,
does not cover both colourways or Dynamic Type, and is not a screen-reader pass.

My independent flagged-Chrome axe run found zero definite violations but left
`color-contrast` and `aria-prohibited-attr` **incomplete**. That is useful signal,
not clearance. The required evidence needs to settle those inconclusive results
instead of replacing them with a tree dump.

The committed `w6-composite-black-current.png` is also a blank white 1280×720
image, not the clamped screen described by its adjacent prose. The actual banded
capture currently exists only as untracked `w6-composite-black.png`. A visual
artifact that does not depict its claimed state cannot prove or diagnose it.

### Major 4 — the “four-tier” interface cannot represent T4 and does not prove the promised additive seam

**Files:** `packages/composite/src/pixel-source.ts:7-35`; `packages/composite/src/pixel-source.test.ts:5-19`

`PanelPixelRequirements.renderer` admits `'none'`, but every
`PanelPixelSource.attach()` unconditionally requires a `WebGLRenderer`, `Camera`
and W4 `ScreenMeshHandle`. A T4 flat-DOM strategy therefore needs fake WebGL and
device objects or an interface edit. That directly fails dispatch lines 42-57
and `preview-validation.md:35-53`, which require the interface to be written
against all four tiers while implementing only T1.

The seam test proves only that one frozen constant equals itself. It does not
compile a renderer-less strategy, a CSS-overlay strategy, or otherwise prove the
owner's stated test: add a strategy without editing the interface, panel or
device. Use a discriminated attachment/requirements contract or another shape
that makes each declared requirement structurally meaningful, while still
shipping only T1.

### Major 5 — the “single tier value” is neither the ruled Jotai value nor the value the component renders

**Files:** `packages/composite/src/tier-store.ts:10-58`; `packages/composite/src/CompositeDevice.tsx:48-53`; `apps/web/src/routes/_probe.capabilities.tsx:57-60`

`preview-validation.md:50-53` rules one Jotai tier value, set at boot and context
events. W6-D1 explicitly deferred that atom to W6.1. W6.1 instead introduced a
second module-global mutable store (`Set` + module variable), and no rendered
component subscribes to it. `CompositeDevice` hardcodes
`data-composite-tier="T1"` even after `markCompositeContextLost()` publishes T4.
In the flagged browser, dispatching `webglcontextlost` removed the panel from the
document/accessibility tree while the rendered tier remained T1; restore happened
only through the coordinator's private listener.

The packet also requires zero tier comparisons outside `packages/composite`.
`_probe.capabilities.tsx:59` still compares two tiers outside the package. The
gate misses the `!==` form. There is not yet one authoritative value “the rest of
the app reads.”

### Major 6 — the same-origin artwork contract points to a route that does not exist

**Files:** `packages/providers/src/artwork.ts:13-18,24-36,55-68`; `packages/server-core/src/index.ts:1-9`

W6.3 marks same-origin artwork as T1-blocking, not fallback work. The URL helper
returns `/artwork`, but `server-core` is still an empty placeholder and the app
has no corresponding route. I observed repeated 404 responses for the real
panel request, and direct `curl` returned 404 for both `/artwork?...` and the
fixture source. The current composite therefore paints fallback blocks, not
album artwork.

W6 was right not to edit another lane silently, but “coordinate the proxy with
the lead” is part of its completion contract. Record and resolve that dependency
before calling the T1 slice complete.

### Major 7 — the current W3 boundary is not canvas-safe, and W6 did not report it

**File:** `packages/panel/src/panel.css:102-106`

The packet says `mix-blend-mode` does not survive rasterisation and that the
panel is otherwise canvas-safe. Current S13 still uses both `mix-blend-mode:
screen/multiply` and large blurred filters inside the DOM panel. W6 moved the
scanline/triad to its shader, but did not identify this separate artwork-bloom
blend dependency. That means the bare and composited Now Playing treatments are
not equivalent, exactly where W6.3 says the boundary must be settled.

This is a W3-owned correction, not permission for W6 to edit panel code. W6 must
raise it as a blocking boundary finding and prove the eventual composited S13 in
both colourways.

### Major 8 — the public composite component is not SSR-safe and the mandatory gate is red

**Files:** `packages/composite/src/CompositeDevice.tsx:29-40,58-63`; `docs/workstreams/002-implementation-spine/dispatch/W6-composite.md:88-95`

`CompositeDevice` calls `document.createElement()` from a render-time `useMemo`.
The dev route's `ssr:false` hides that package-level contract. Rendering the
public export with `react-dom/server` independently fails with
`ReferenceError: document is not defined`; its TSDoc does not say client-only.
In a TanStack Start app this makes safe reuse depend on every caller remembering
an undocumented route option and gives no hydration story.

Separately, `bun run gates` is required to return zero. It currently finishes
**13/18** and exits 1. Some failures are classifier false positives or foreign
lanes, but U9 includes W6's own `useState` prose and the slice's evidence still
describes the runner as a placeholder. A mandatory aggregate gate cannot be
reported complete while red and stale.

## Minor findings

### Minor 1 — a queued pixel request can run after detach

**File:** `packages/composite/src/html-in-canvas.ts:98-103,144-150,160-210`

`queueMicrotask(requestPixels)` is not canceled or guarded by attachment identity.
If Strict Mode cleanup, context loss, tone replacement, or unmount detaches before
the microtask runs, the closure still marks a disposed texture dirty, calls
`requestPaint()` and invalidates the old screen. Add an attachment generation or
an `attached` guard.

### Minor 2 — capability routing still violates its own escaped-underscore ruling

**Files:** `apps/web/src/routes/_probe.capabilities.tsx:1-25`; `docs/workstreams/002-implementation-spine/dispatch/W6-composite.md:32-40`

D-032 and the amended dispatch require `[_]probe.capabilities.tsx`, but W6.0 still
ships `_probe.capabilities.tsx`, occupying `/capabilities` instead of the dev
namespace. The discrepancy is documented but not corrected.

### Minor 3 — the W6 diary contradicts itself after the continuation

**File:** `docs/workstreams/002-implementation-spine/diary/w6.md:3-19,23-35`

The new header says W6.1/W6.2 are complete, then the unchanged “What exists now”
section says there is no strategy, no T1 implementation and nothing beyond the
probe. A durable handoff cannot hold both states without an explicit historical
marker.

## Independently verified positives

- Chrome 151 stable with `CanvasDrawElement` resolves T1 and exposes
  `texElementImage2D` arity 3 plus `getElementTransform`.
- The application/listbox/options remain in the accessibility tree below Canvas.
- Pointer focus and ArrowDown work at the initial viewport.
- The panel host is a `drawable` child of a `layoutsubtree` canvas and receives a
  Three-authored CSS `matrix3d`.
- The composited ready state requested **0 rAF callbacks over two idle seconds**.
- Application source contains no raw experimental WebGL upload call.
- Exactly one concrete pixel-source implementation exists; no T2-T4 fallback was
  overbuilt.
- `bunx tsc --noEmit -p packages/composite/tsconfig.json`, app TypeScript, scoped
  ESLint and the four composite Bun tests pass; repository typecheck is 11/11,
  lint is clean and 698 tests pass.
- The W4 UV attribution was accurate **for the committed boundary at
  `1c21a7d`**: the screen was an `ExtrudeGeometry` with raw shape-space cap UVs,
  matching Three's `WorldUVGenerator`. The current dirty W4 lane adds
  `screen-geometry.ts` with normalized UVs; I reproduced a correctly legible
  texture against that uncommitted change. This confirms the diagnosis, but it
  does not retroactively make the committed blank/banded W6 visual evidence an
  approval artifact.
- No reviewed commit carries an attribution trailer. W6 package boundaries use
  public `@webpod/device` and `@webpod/panel` exports; no direct package-source
  import was introduced by the composite route.

## Required re-review evidence

1. Flagged-browser regression for viewport resize, camera replacement, renderer
   replacement, context loss/restore and repeated attach/detach.
2. A compile-time four-tier seam proof that includes a renderer-less T4 shape,
   while retaining only one runtime implementation.
3. One Jotai-backed tier value with context-event updates and zero outside-package
   comparisons.
4. Working same-origin artwork and removal/relocation of every unsupported panel
   blend/filter effect.
5. The full W6.4 evidence set, both colourways, including conclusive contrast and
   accessibility geometry checks.
6. SSR/hydration behavior made safe or explicitly enforced as a typed/client-only
   boundary.
7. `bun run gates` exit 0 and refreshed W6 evidence captured from the final tip.

# Final re-review — 698f882, c939a30, aa12308

## Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

All eight Majors and all three Minors from the original review are closed. I
reviewed the three remediation commits, reran the scoped and aggregate gates,
and repeated the browser checks in Chrome 151 with
`CanvasDrawElement` enabled. This approval is for the W6 T1 composite boundary;
it does **not** clear owner-only U14 or H-6.

### Closure of the eight Majors

1. **Resize, camera geometry, and click regression — closed.**
   `html-in-canvas.ts:153-157` observes the renderer canvas and resynchronises
   from the live screen transform; `CompositeDevice.tsx:111-125` subscribes to
   R3F viewport size and resynchronises after committed camera/viewport changes.
   In flagged Chrome I independently reproduced the exact viewport transition:
   1280×720 produced `(513.807, 178.770, 252.385, 189.289)` and 800×500 produced
   `(323.031, 151.293, 153.937, 115.453)`. The stale old-screen point hit `MAIN`
   and left focus on `BODY`; clicking the new visible screen focused the native
   `role=application`. Changing FOV 24→36 changed the host from
   194.053×145.540 to 126.946×95.210 without losing T1 or native interaction.

2. **Renderer/camera replacement and lifecycle — closed.**
   `coordinator.ts:46-57` treats either identity change as a new attachment
   lifetime, detaches the source, removes old context listeners, and reconciles
   once. `coordinator.ts:90-103` cleans a partially attached source before an
   error escapes. The deterministic replacement, retry, clear, restore, and
   repeated-dispose cases at `CompositeDevice.test.tsx:27-119` all reproduced.
   The implementation no longer retains the detached source identified in the
   first review.

3. **W6.4 bare/composited accessibility — closed.**
   I injected axe-core 4.13.0 into the real flagged route independently. Bare
   black, bare white, composited black, and composited white each returned zero
   violations and 21 passing rules; each left only `color-contrast` incomplete,
   matching the committed reports and their endpoint calculations. The live
   composited accessibility tree retained the focused `application`, named
   `listbox`, eight named options, and the selected row after ArrowDown. The
   comparison uses the same panel implementation in both modes; no parallel
   accessibility surface was introduced. The committed evidence set now includes
   the bare/composited axe reports, keyboard/AX result, bare mount, resize/hit-test,
   Dynamic Type captures, and idle-rAF report.

4. **T4-representable seam without fallback overbuild — closed.**
   `pixel-source.ts:7-47` discriminates renderer requirements and attachment
   shape: T1 receives WebGL/camera/screen, while `'none'` receives only the DOM
   panel. The compile-time fixture at `pixel-source.test.ts:8-21,39-42`
   implements a renderer-less T4 source without fake Three or device values.
   Exactly one runtime strategy still ships, so the requested additive seam is
   represented without implementing T2–T4.

5. **One Jotai tier value and context transitions — closed.**
   `tier-store.ts` owns one vanilla Jotai atom/store and exposes its snapshot and
   subscription; `CompositeDevice.tsx:40-64` renders from that subscription
   rather than a hard-coded tier. In flagged Chrome, a cancellable
   `webglcontextlost` changed the rendered tier T1→T4 with one canvas retained and
   the panel detached; `webglcontextrestored` returned it to T1 with one panel and
   one canvas. The package test independently observed exactly one external
   notification on loss. The aggregate TIER gate found no tier branch outside
   `packages/composite`.

6. **Same-origin artwork proxy integration — closed.**
   `apps/web/src/routes/artwork.ts:1-14` binds the literal route to the
   server-core contract and delegates GET to `handleArtworkRequest`. I requested
   the fixture URL through the running app and received HTTP 200, 412 bytes,
   `image/svg+xml`, same-origin CORP, CSP sandbox, and `nosniff`; the panel's
   resource timing also contained its `/artwork?...` request. Changes after
   `aa12308` add server security regression tests only and are foreign to W6.
   The running proxy produced no transient failure requiring attribution.

7. **Raster-compatible panel boundary — closed.**
   The former blend/filter dependency is absent. `panel.css:102-105` now uses a
   plain radial-gradient bloom and opaque/translucent metadata surfaces; the
   package test rejects authored `mix-blend-mode`. W6 consumes that public panel
   boundary without patching it. The earlier W4 UV defect was correctly reported
   as a blocker at the time, but the normalized W4 boundary had landed before
   these remediation commits and the current flagged render is legible. That
   historical diagnosis is not being used as permission to approve broken pixels.

8. **SSR, package ownership, and gates — closed.**
   `CompositeDevice.tsx:40-47,77-103` defers DOM host creation until the client
   snapshot and provides a stable T4 server snapshot. Rendering the public
   `@webpod/composite` export with `react-dom/server` independently returned
   `<div data-composite-tier="T4" data-composite-ready="false"></div>` without
   touching `document`. `jotai/vanilla` resolves directly from the composite
   package at pinned 2.20.3. Public `@webpod/*` boundaries are used; no direct
   package-source import was introduced. Scoped TypeScript, app TypeScript,
   scoped ESLint, and all 13 composite tests pass. `bun run gates` exits 0 with
   16 automated passes, 0 automated failures, and only U14/U15 manual. The
   current aggregate count is 805 tests rather than the committed evidence's
   804 because a later server-only regression test landed; that is benign foreign
   drift, not stale W6 evidence.

### Closure of the three Minors

- `html-in-canvas.ts:60,65-68,117-128,159-167,194-212` guards deferred paint work
  by attachment generation and identity, and removes the listener/observers on
  detach. The stale queued update cannot reach the disposed attachment.
- The capability file is now `apps/web/src/routes/[_]probe.capabilities.tsx`, so
  TanStack serves the intended `/_probe/capabilities` namespace.
- The diary marks its probe-only account as historical and the final decisions
  and evidence describe the implemented strategy consistently.

### Independent runtime notes

- Chrome exposed T1, `texElementImage2D` arity 3, and Three's
  `InteractionManager`/`getElementTransform` path. Application code still makes
  no raw experimental WebGL upload call.
- The host remained a real `drawable` descendant of the `layoutsubtree` canvas;
  native focus and accessibility geometry followed its Three-authored matrix.
- After the route settled, wrapping `requestAnimationFrame` and waiting 2.2
  seconds observed an idle delta of **0**.
- No reviewed commit contains an attribution trailer.

Owner-only U14 thumb-occlusion validation and H-6 both-colourway aesthetic
acceptance remain explicitly outstanding. This review does not clear either.
