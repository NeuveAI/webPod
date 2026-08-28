# Dispatch packet — W4 · Device layer

**Status:** `Ready on W0` · **Lane:** L-E · **Blocked by:** W0 · **Blocks:** W6

## What this is
**The device layer of the product** — promoted from a throwaway spike by the owner's 2026-08-28 ruling that T1 `html-in-canvas` is the main path. W6 composites the panel onto the screen mesh you build, so your output is depended upon rather than discarded.

It still answers the early question 001 §3.4 rank 4 poses — *does the modelled iPod read as the object?* — and that clause still bites: if the body and back face do not read as genuinely physical, the design needs re-scoping, and **week one is when to find that out, not week six.** Raise it to the lead the moment you suspect it.

**You must expose a screen mesh** for W6 to composite onto: a flat quad at the panel's position and scale, with a documented material slot, `MeshBasicMaterial` with `toneMapped: false` per §12.3. Its transform must be queryable, because W6 recomputes `updateElementGeometry`'s `canvasTransform` from it every time the device moves. Agree the shape of that boundary with the lead before you build it — it is the one part of your package another lane depends on.

## Read first
`scope.md` · `preview-validation.md` · 001 `design-system.md` **§12.3** (the CSS-vs-three.js boundary — "the single most important table in this handover"), **§12.0** (re-derived R5 geometry), §5.1–5.10 (material recipes), §10.4 and §10.5 (the chrome and glass anti-slop rules), **§14.1** (the frame-budget rule) · `~/code/agentic-context/three.js` and `react-three-fiber/docs`.

Skills: `/interface-craft`, `/runtime-review`, `/modern-web-guidance`.

## Correctness target
`/_spike/device` renders the iPod body in both colourways — glossy polycarbonate, recessed click wheel, translucent Select, mirror-polished steel back, cover glass — such that a **vertical luminance sample through the render matches the §4.2–4.5 gradient stop tables within ±4 units**, and the geometry matches §12.0.

## The rule that decides whether this passes
> **Gradients are never painted.** One key light at 12 o'clock. Colour comes from material parameters, a light rig and an env map.

A painted gradient on a metal is precisely the "chrome reads as grey plastic" failure of §10.4, and it will be rejected on sight. The steel's dark horizon band is a **reflection of the room's dark half**, not a ramp: generate a 512×256 equirect env map from the §4.4 stop table plus a sky blob and a horizon line, and let the non-monotonic luminance **emerge from the reflection**.

§12.3 gives you the exact `MeshPhysicalMaterial` / `MeshStandardMaterial` parameters for all seven surfaces. Use them. The §4.2–4.5 stop tables do not disappear when you go 3D — **they become the acceptance criterion.** Tune the rig until the sampled column matches.

## Materials are injected, not inlined
**Owner ruling, 2026-08-28:** later fallback tiers are expected to need different textures, shaders and possibly a different renderer. You are not building that, and you must not build a variant system for it. What you **must** do is leave the door unlocked:

- Material parameters, the env map and any shader come in as **inputs** to your components, defaulting to the §12.3 values sourced from `packages/tokens`. Do not inline a magic number in a material constructor — §12.3's table is the source and `packages/tokens` is where it lives.
- The screen mesh's material is a **documented slot**. W6 fills it; you supply a sane default so the device renders standalone.
- Anything genuinely renderer-specific stays behind a named function rather than being sprinkled through component bodies.

One implementation, one variant, no registry. The test is whether a later tier could supply an alternative set by passing different inputs — not whether you built the mechanism to choose between them.

## Geometry — §12.0, re-derived, use these numbers
`wheelR` **115**, body **330×552** (wheel/body **0.697** vs the real 5G's 0.699) · Select r **42**, lip to **46** · label band **r 77–79**, from the constant `innerR + ringW × 0.493` (**not** ×0.57, and certainly not ×0.30) · recess-shadow reach **r 104**.

## The frame budget — a hard gate, not an optimisation
> `<Canvas frameloop="demand">`. The render loop is **off by default**.

- **An untouched device must produce 0 rAF callbacks.** Verified in DevTools. This is a battery-sensitive mobile-first product and a 60fps loop rendering an unchanged object is the largest avoidable power cost in the build.
- **No unconditional `useFrame`.** Every `useFrame` body early-returns when its driving state is inert; components call `invalidate()` only while animating.
- Accelerometer shimmer, if you implement it: sample `deviceorientation` at **20 Hz, not 60**, lerp toward target, **auto-suspend after 2s** below 0.4°/s. Never requested on load — asked at first wheel `pointerdown`, never re-asked after denial, with a **static 135° key-light fallback that is not a flat surface**.
- Anything oscillating below ~4 Hz belongs in CSS on a DOM overlay, never in the 3D loop.

## Explicitly out of scope
Any panel content, any DOM-in-canvas, `HTMLTexture`, `InteractionManager`, the `three-html-render` polyfill, the expose flip, agent FX, haptics. **Compositing is W6's, not yours** — if you find yourself drawing DOM into the canvas you have crossed the seam. You expose the screen mesh; W6 fills it.

## Verification
`evidence/w4-device-luminance.md` with the actual sampled column beside the §4.2–4.5 stop table and the delta per stop (must be ≤4) · `evidence/w4-geometry.txt` asserting the §12.0 numbers from the imported `packages/tokens` constants, not re-typed · `evidence/w4-raf-idle.txt` proving 0 rAF callbacks on an untouched device · screenshots of both colourways, front and back · per-package tsc, lint, gates.

## Guardrails
Own `packages/device/**` and `apps/web/src/routes/_spike.device.tsx` — **only files prefixed `_spike.`**. W3 owns `index.tsx` and the root layout; W6 owns `_probe.*`. Never write `packages/panel`, `packages/state` or `packages/composite`, and never import them.

## Artifacts
`diary/w4.md` · `decisions/w4.md` · `evidence/w4-*` · review `reviews/w4-review.md` (lane L-E)

## Commits
`feat(device): device body materials and geometry` → `feat(device): screen mesh boundary`
