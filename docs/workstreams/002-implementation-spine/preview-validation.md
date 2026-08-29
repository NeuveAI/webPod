# 002 — Preview validation plan and the html-in-canvas tiering

Two separate questions get answered by two separate previews. Conflating them is how a nostalgia toy ships.

| Preview | Route | Answers | Gate owner |
|---|---|---|---|
| **P1 — the experience** | `/` | Can a human drive this well as a plain DOM app with a keyboard? | reviewer (mechanical) + owner (U14, in hand) |
| **P2 — the object** | `/_spike/device` | Does the modelled iPod read as the object, and do its materials match the spec numbers? | owner (aesthetic) + reviewer (luminance sampling) |

---

## Build order ruling, and the risk it carries

**Owner ruling, 2026-08-28:** T1 `html-in-canvas` is the **main path** and is built first; T2/T3/T4 are deferred to a later workstream, with the seam designed now so they are additive rather than a rewrite.

That inverts what 001 recommends, so the reasoning is recorded rather than assumed. **What makes it defensible:** the panel is real DOM in T1 too — `layoutsubtree` keeps canvas descendants in the accessibility tree, and the shipped `getElementTransform(element, screenSpaceTransform)` result is written to the panel's CSS transform so native geometry follows it. So building T1 first does not violate the DOM-panel law; it exercises it. The implementation uses three.js `InteractionManager`'s shipped-browser mechanism rather than the explainer-only `updateElementGeometry` API that Chrome 151 does not expose.

**What it costs, stated plainly and tracked, not waved away:**

> ### RISK-01 · T3 is the shipping default and is not built · opened 2026-08-28 · owner: lead
> `html-in-canvas` is a WICG **Community Group** explainer — incubation, not standards track — behind a Chrome Canary flag, with **no origin trial, no second implementer, an unfinished spec**, and a WebGL entry point that is **mid-rename**: the repo's own demo carries a try/catch spanning `texElementImage2D` and `texElementSubImage2D` because the method does not currently have a stable name (`stack-research.md` §1.1–1.4, read from `~/code/agentic-context/html-in-canvas`).
>
> Until T3 lands, webPod runs for approximately nobody but the owner. **This is not self-correcting:** `HTMLTexture` degrading to a plain `Texture` yields a blank screen mesh, not T3 — T3 needs `InteractionManager`'s `matrix3d` overlay path, which is real work.
>
> **Release gate:** no user-facing release before T2–T4 land and the whole §15 gate set is signed off in a **flag-off** profile. Re-read this row at the start of every subsequent workstream until it closes.

**Two consequences that are in scope NOW, not deferred**, because they are T1-blocking bugs rather than fallback concerns:
1. **Cross-origin artwork must be proxied same-origin.** It will not paint under read-back-allowed rendering. This gets *more* urgent under a T1-first order, not less.
2. **`mix-blend-mode` does not survive rasterisation**, so the panel's scanline / sub-pixel triad layers go to a shader overlay (design-system §12.3 item 6). The panel was already authored canvas-safe — Panel Discipline forbids `backdrop-filter`, translucency and blur inside it — so this is the only casualty.

**Do not bind application code to the raw WebGL entry point.** Go through three.js `HTMLTexture`, which absorbs the rename churn and feature-detects with `'requestPaint' in parent`. A direct `texElementSubImage2D` call in our source is a blocking finding.

**Profiles.** Keep two: `webpod-canary` with `chrome://flags/#canvas-draw-element` **on** is where 002 is developed and demoed. `webpod-baseline` with the flag **off** is where RISK-01 gets closed later. Both exist from now; the second simply has nothing to show yet.

## The four tiers

The reason this is a manageable risk is that the tiers are **the same architecture at four fidelities, not four architectures**. The panel is real DOM in every one of them. Only who owns the *pixels* changes.

| Tier | Condition | Pixels | Interaction / a11y | Loses |
|---|---|---|---|---|
| **T1** | flag on (`'requestPaint' in HTMLCanvasElement.prototype`) | DOM composited into the WebGL material via three.js `HTMLTexture` | native — `getElementTransform(element, screenSpaceTransform)` supplies the matrix written to the panel's CSS transform, following three.js `InteractionManager`, so hit-testing, focus, selection and accessibility geometry remain browser-native | nothing |
| **T2** | flag off + `three-html-render` polyfill | polyfilled rasterisation | same | fidelity, unknown amount |
| **T3** | flag off, no polyfill | DOM panel is a CSS-3D-transformed overlay registered to the modelled bezel | native, via `InteractionManager`'s per-frame `matrix3d` — the browser does the perspective divide, so it stays correct through the flip | only "pixels genuinely inside the WebGL material". Nothing in a11y, focus, selection or actuation. |
| **T4** | no WebGL, or context lost, or `prefers-reduced-motion` | no device render at all; flat DOM | native | the object. **The product still works** — this is exactly the stage-2 checkpoint, which is why it is built first. |

**T1 is what we build in 002.** T3 remains the eventual shipping default and must be treated as the product rather than a degradation when it is built (RISK-01). **T4 must never be reachable only by accident** — it is a first-class path because it is also the reduced-motion path and the WebGL-context-loss path.

The strategy interface in `packages/composite` must be written against **all four rows of this table**, not against the one being implemented. If T3 cannot be added later without changing the interface, the interface is wrong — that is a design review question for W6, and the reviewer is instructed to ask it.

### Detection rules
- Feature-detect, never UA-sniff: `'requestPaint' in HTMLCanvasElement.prototype`, exactly as three.js itself does (`'requestPaint' in parent` in `HTMLTexture.js`).
- Handle `webglcontextlost` by falling to T4 and back up on restore. A dropped context on a mobile GPU must not take the music player down with it.
- The tier is a single value in the Jotai store, set once at boot and on context events, read everywhere. No component decides its own tier.

### The constraint that bites every tier, including T4
> **Cross-origin album artwork will not paint.** Read-back-allowed rendering excludes cross-origin `<img>` data — and cross-origin is exactly how Apple Music and Spotify serve artwork. It must be proxied same-origin through the Bun backend.

This affects Now Playing, Cover Flow, the sidecar and every thumbnail, and it is **not** a stage-6 problem: it changes the shape of `packages/server-core` and the artwork URL helper from the first commit. `artworkUrl()` returns a proxied URL, always, in every tier.

### Two more, recorded so nobody rediscovers them
- DOM mutations made inside the `paint` event **do not appear until the following frame**.
- `mix-blend-mode` does not survive rasterisation — which is why the panel's scanline / sub-pixel triad layers are specified as a shader overlay, not CSS, in design-system §12.3 item 6. The panel was already authored canvas-safe (Panel Discipline forbids `backdrop-filter`, translucency and blur inside the panel), so this is the only casualty.

---

## P1 — validating the experience

Run `bun dev`, then in the **baseline** profile:

**Mechanical, by the reviewer, before you are asked to look at anything:**
1. `bun run gates` → 0 findings (U8 permission language, U9 `useState`, U10 canvas-in-panel, plus the §15.2 greps)
2. `bunx tsc --noEmit -p <pkg>/tsconfig.json` per package → clean
3. `bun test` → green, including the store-outside-React contract test
4. Playwright: keyboard-only traversal S03 → S08 → S13 and back, **arrow keys exactly one detent with no acceleration**
5. axe: target-size ≥44px (U6) and contrast 4.5:1 body / 3:1 at 18px+ (U7), **in both colourways**
6. Emulated `prefers-reduced-motion` (U3), `prefers-reduced-transparency` (U4), `prefers-contrast: more` (U5)
7. Screenshot pairs, light and dark, of every state — a screen designed only in dark **is not designed**
8. `aria-live` count during a 30-detent flick must be exactly **1**

**By you, and only by you:**
9. **U14, on your phone, in your hand.** Scroll the wheel with your thumb and confirm you can see the response. Feedback under the contact patch is a defect that does not exist on a desktop simulator — which is precisely why it keeps shipping.
10. Both-colourway aesthetic call, against `design.pen` artboards `A76Ib` (M1 Now Playing), `H4QpB` (M2 Music Menu), `DLqSo` (M1L Light).

## P2 — validating the object

11. **Luminance sampling, mechanical:** a vertical column sampled through the render must match the design-system §4.2–4.5 gradient stop tables within **±4 units**. This is how a 2D spec survives into 3D: you tune the light rig and env map until the numbers match, rather than painting a gradient onto a metal — which is the exact "chrome reads as grey plastic" failure §10.4 names.
12. **Geometry check:** `wheelR` 115, body 330×552, ratio 0.697 against the real 5G's 0.699; Select r42/lip46; label band r77–79 from the constant `innerR + ringW × 0.493`.
13. **Materials are parameters, never paint:** one key light at 12 o'clock, env map supplying the steel's non-monotonic horizon band. A painted gradient here fails the review on sight.
14. **Your call:** does it read as the object? 001 §3.4 rank 4 attaches an escalation clause to this question — if the answer is no, the design needs re-scoping, and week one is when to find that out, not week six.

I will screenshot both routes through the pencil MCP browser and put them beside the `design.pen` artboards, so you are comparing images rather than reading a description of images.
