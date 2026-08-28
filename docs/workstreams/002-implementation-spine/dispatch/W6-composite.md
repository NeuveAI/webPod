# Dispatch packet — W6 · The composite seam (T1 `html-in-canvas`)

**Status:** W6.0 `Ready on W0` (jumps the queue) · W6.1+ `Ready on W3 + W4` · **Lane:** L-E · **Blocks:** W5b

This is the **main path** under the owner's 2026-08-28 ruling, and the newest, least-settled code in the repo. Read `preview-validation.md` before anything else — RISK-01 is yours to hold.

## Read first
`preview-validation.md` in full · `scope.md` targets B and C · `dependency-graph.md` "The seam, in one picture" · 001 `stack-research.md` **§1.1–1.9** (the whole html-in-canvas section) · `~/code/agentic-context/html-in-canvas/README.md` + `Examples/webGL.html` · `~/code/agentic-context/three.js/src/textures/HTMLTexture.js` and `examples/jsm/interaction/InteractionManager.js` and `examples/webgl_materials_texture_html.html` · `~/code/agentic-context/react-three-fiber/docs`.

Skills: `/interface-craft`, `/runtime-review`, `/modern-web-guidance`.

## Correctness target
The panel's DOM pixels reach the device's screen mesh through `html-in-canvas`, behind a strategy interface with exactly one implementation; the panel remains real DOM with native focus, selection and accessibility **while composited**; and a single tier value is the only place in the app that knows which strategy is live.

## The property that must not be lost
`layoutsubtree` marks canvas descendants as real DOM: *"only semantic information is exposed to accessibility, without geometry"* until you call `updateElementGeometry` with a `canvasTransform`, at which point *"the element's accessibility information is updated to include geometry information."* **3D contexts must call it explicitly** — unlike 2D, which gets it free from `drawElementImage`.

So: `updateElementGeometry({ canvasTransform })` is **mandatory**, must be recomputed every time the device moves, and is what makes the composited panel screen-reader-navigable. Skipping it yields a panel with content and no positions. That is not a cosmetic gap — it is the difference between the thesis holding and not.

## Slices

### W6.0 — Capability probe · dispatch this ahead of W6's own dependencies
`apps/web/src/routes/_probe.capabilities.tsx`, a dev-only diagnostic that **calls the same detection code the product uses** (not a parallel copy — it renders `packages/composite`'s real probe, which is why it is not a proof-only route). It reports:
- `'requestPaint' in HTMLCanvasElement.prototype`
- whether `layoutSubtree` reflects on `<canvas>`
- which of `texElementSubImage2D` / `texElementImage2D` exists on the WebGL context, **by name**
- presence of `drawElementImage`, `updateElementGeometry`, `clearElementGeometry`, `getCanvasTransform`
- the resolved tier, and the browser/version string

**Why first:** it answers, cheaply, whether the owner's browser genuinely exposes the API and under which method name — a question the entire workstream now rests on. Hand the URL to the lead the moment it renders; the owner runs it in their own Chrome.

### W6.1 — `PanelPixelSource` strategy interface
Write the interface against **all four tiers** in `preview-validation.md`, implement only T1. If T3's `matrix3d`-overlay model cannot be added later without changing the interface, the interface is wrong — your reviewer is instructed to ask exactly this, so design for it now rather than defending it later.

**Owner ruling, 2026-08-28:** later tiers are expected to need *different textures, different shaders, possibly a different renderer* — not merely a different pixel path. So a strategy declares what it needs, not just what it does. Roughly:

```
interface PanelPixelSource {
  readonly tier
  readonly requires: { renderer, materialVariant, shaderVariants, textureSet }
  attach(screenMesh, panelElement)   // wire up
  syncGeometry(worldMatrix)          // only while the device moves
  detach()
}
```

**The discipline that keeps this from becoming speculative generality:** make the injection points exist, name them, and prove **exactly one** variant flows end to end. Do **not** build a variant registry, a resolver, an asset-pack loader or a second renderer in 002 — there is nothing to resolve between yet, and an abstraction with one implementation and no second caller is a guess. The test is: could a T3 author add a variant set by *adding* a strategy, without editing `packages/panel`, `packages/device`, or the interface itself? If yes, you are done.

Tier detection resolves once at boot, plus on `webglcontextlost` / `webglcontextrestored`, into **one value**. **`grep` for a tier comparison outside `packages/composite` must return 0** — no component decides its own tier.

### W6.2 — T1 strategy
Use three.js `HTMLTexture`. **Do not call the raw WebGL entry point** — its name is actively changing (`texElementImage2D` vs `texElementSubImage2D`, with the spec repo's own demo carrying a try/catch across both signatures). `HTMLTexture` absorbs that churn and already feature-detects with `'requestPaint' in parent`. A direct `texElementSubImage2D` in our source is a blocking finding.

Use `InteractionManager` for interaction: it writes a per-frame `matrix3d` CSS transform onto the DOM element so *"the browser dispatches pointer events to them natively"* and performs the perspective divide itself. Native hit-testing, native focus, native text selection, native a11y geometry — because it is a genuinely transformed DOM element.

Two behaviours to design around, not discover:
- **DOM changes made in the `paint` event do not appear until the subsequent frame.** Canvas drawing commands in that event do appear in the current frame. Do not mutate panel state from `paint`.
- Hit testing is a **flat, ordered list** with one matrix per drawable, *"skipping intervening clips and transforms"* — one affine mapping per drawable, not a general 3D pick. For a flat screen quad that is exactly enough; do not build on it expecting more.

### W6.3 — Content restrictions
Two are T1-blocking and land here, not in a fallback workstream:
- **Cross-origin artwork will not paint.** Both providers serve artwork cross-origin. `artworkUrl()` must return a **same-origin proxied** URL. Coordinate the proxy with the lead — it belongs to `packages/server-core` and is not yours to build alone.
- **`mix-blend-mode` does not survive rasterisation.** The panel's scanline / sub-pixel triad goes to a **shader overlay on the screen mesh** (design-system §12.3 item 6), which keeps it correct in every tier.

Also expect, and accept: no subpixel text antialiasing (greyscale AA, which for a 272×204 panel is arguably correct anyway), no system colors/themes, no visited-link info, no spellcheck markers.

### W6.4 — The U10 re-review · blocking
001 §15.0 U10: *"If `html-in-canvas` is adopted for the panel, U10 becomes a blocking re-review of U6, U7, U11 and U12 — rasterised text breaks screen readers, Dynamic Type and focus."* We adopted it. Run axe against the **composited** page and against the panel mounted bare, and record **both**. Because the panel stays DOM under T1 this *should* pass — and "should pass" is the exact class of assumption this project's review posture exists to distrust. Add a screen-reader pass over the composited panel and a keyboard traversal through it.

## Frame budget
`frameloop="demand"` still holds. `updateElementGeometry` and the `matrix3d` write happen **only while the device is moving**; an untouched composited device must still produce **0 rAF callbacks**. A per-frame geometry sync running on a static device is a blocking finding, not an optimisation note.

## Guardrails
Own `packages/composite/**` and `apps/web/src/routes/_probe.*`. **Do not build T2, T3 or T4, and do not build machinery whose only purpose is to host them** — the seam is a shape, not an implementation. Read `packages/panel`, `packages/device`. **Never write `packages/panel/src` or `packages/device/src`** — if the panel needs to change to be compositable, that is a finding you report to the lead, not a patch you apply. Dependencies point one way: `composite → {panel, device}`, never back.

## Verification
`evidence/w6-capability-probe.txt` (the owner's browser, real output) · `evidence/w6-axe-composited.txt` **and** `evidence/w6-axe-bare.txt` · `evidence/w6-panel-mounts-bare.txt` — a test mounting `packages/panel` with no canvas, no three.js, no composite, proving the DOM law holds independently · `evidence/w6-raf-idle.txt` (0 callbacks, composited, untouched) · screen-reader and keyboard traversal notes · per-package tsc, lint, gates.

## Artifacts
`diary/w6.md` · `decisions/w6.md` — **must record which `~/code/agentic-context/html-in-canvas` and `three.js` files you actually read**; recall is inadmissible for this API and your reviewer will check · `evidence/w6-*` · review `reviews/w6-review.md` (lane L-E)

## Commits
`feat(composite): tier detection and capability probe` → `feat(composite): panel pixel source interface` → `feat(composite): html-in-canvas strategy` → `test(composite): composited accessibility re-review`
