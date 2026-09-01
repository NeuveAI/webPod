# W9a owner readability correction evidence

> Superseded on September 2, 2026 by
> `evidence/w9a-readability-rereview.md`. The antagonistic review rejected the
> nearest-vertex source, `RE_Direct` diffuse path, broad held oval and incomplete
> browser matrix documented here. These artifacts remain as an honest record of
> the rejected revision; they are not current acceptance evidence.

## Outcome

The click-wheel contact is now easier to read without changing W9's physical
travel. `CONTROL_TRAVEL.wheelMm` remains 0.08. A weak grazing response follows
the real deformed contact point and enters only the wheel material's Three
physical-light calculation. It has no scene-light object, so it cannot reach
Select, the screen, glass or body.

The response compares the interpolated live normal with a controller-installed
immutable rest normal. Only the displaced slope facing the body-local grazing
source receives the extra BRDF contribution. The source contains no UV, view,
camera, screen-space, time or random input.

Named visual calibration:

| Quantity | Value |
| --- | ---: |
| Existing wheel travel | 0.08 mm |
| Tangent offset | 7.5 mm |
| Lift above local surface | 1.2 mm |
| Range | 16 mm |
| Inner / outer cone | 20° / 42° |
| Normal-slope start / full | 1° / 1.35° |
| Peak linear irradiance | 0.06 |
| Rest irradiance | exactly 0 |

These are bounded visual calibration values under the existing product rig,
not claimed OEM measurements. The Three/R3F implementation was grounded in:

- `/Users/vinicius/code/agentic-context/three.js/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js`
- `/Users/vinicius/code/agentic-context/react-three-fiber/docs/advanced/scaling-performance.mdx`

The implementation preserves R3F demand rendering. Held contact mutates the
existing geometry/uniforms and calls the existing `invalidate()`. Only W9's
bounded release requests frames. The response contains no `useFrame`,
`requestAnimationFrame` or timer.

## Production browser provenance

- Date: September 1, 2026
- Route: `http://localhost:3000/_spike/device`
- Product path: ordinary T1 `CompositeDevice`; no query controls or proof API
- Browser: local Google Chrome 152 (`Chrome/152.0.0.0` user agent)
- Launch flag: `--enable-blink-features=CanvasDrawElement`
- Viewport: 1280 × 1100 CSS px
- DPR: 1
- WebGL2: available
- Pointer: real Chrome mouse `move` → `down left` → held move → `up left`
- Console: no page or shader errors; only Three's pre-existing Clock deprecation warning

The real black-front sequence began on the right wheel quadrant, remained held
while moving to the bottom quadrant, then released. The panel selection moved
from Albums to Search during that held arc, which is production evidence that
the existing composite/state navigation path—not a visual-only harness—received
the pointer movement. White-front and black-quarter runs repeated down/hold/up.

The connected Codex in-app browser loaded the production controls but rendered
the already-documented blank T3 WebGL canvas and reported no console error. It
was rejected as visual proof. The captures below came only from the separately
launched flagged Chrome T1 run.

## Capture index

All files are genuine 1280 × 1100 RGB PNGs.

### Black, front

- `w9a-readability/black-front-rest.png`
- `w9a-readability/black-front-right-hold.png`
- `w9a-readability/black-front-bottom-hold.png`
- `w9a-readability/black-front-released.png`

### White, front

- `w9a-readability/white-front-rest.png`
- `w9a-readability/white-front-bottom-hold.png`
- `w9a-readability/white-front-released.png`

### Black, quarter

- `w9a-readability/black-quarter-rest.png`
- `w9a-readability/black-quarter-bottom-hold.png`
- `w9a-readability/black-quarter-released.png`

These captures establish the correction's production reachability and visual
calibration. They do not retroactively claim every still-open item in the
larger W9 browser checklist.

## Deterministic assertions

`control-physics.test.ts` and `wheel-readability.test.ts` cover:

- source position/target follows contact at 0°, 90°, 180° and 270°;
- immutable rest normals remain unchanged while live normals deform;
- rest and terminal intensity are exactly zero;
- irradiance, range, source placement, cone and slope thresholds are literal-bounded;
- Select cannot activate or receive the wheel response;
- held contact invalidates once and starts no frame;
- release reuses W9's bounded demand-frame lifecycle and clears at exact rest;
- reduced motion keeps direct feedback but clears without release frames;
- shader installation fails closed if a required Three chunk seam disappears;
- no UV/camera/time proxy, idle loop or proof-only production binding exists.

## Adversarial plants

Every plant asserted that its edit landed before running its focused test, and
every edit was reverted afterward.

| Plant | Result |
| --- | --- |
| Peak irradiance `0.06 → 0.6` | 2 failures: literal calibration and `< 0.25` bound |
| Initial rest irradiance `0 → 0.1` | 1 failure: installed shader was lit at rest |
| Pin response sample to wheel centre | 1 failure: second contact no longer followed first |
| Remove held-contact `invalidate()` | 4 lifecycle/invalidation failures |
| Bind response to Select in production | 1 wheel-only ownership failure (and TypeScript rejects the extra argument) |
| Add a response-owned `requestAnimationFrame` loop | 1 static no-idle-loop failure |
| Omit immutable rest-normal geometry attribute | 1 failure before normal-delta proof could run |

## Interface audit

The interface-craft and Web Interface Guidelines pass found no new interaction
surface. Existing mouse/touch/pen capture, keyboard Select semantics, text
selection prevention and hit geometry remain unchanged. Motion is interruptible,
direct feedback survives reduced motion, release animation is minimized there,
and no continuous animation or React state was introduced.

## Gates

Implementation commit: `b9cf6d9` (`fix(device): reveal shallow wheel contact`).

- `tsc --noEmit` for `packages/device` and `apps/web`: pass;
- scoped ESLint for all five implementation/test paths: pass;
- `bun test packages/device`: 202 pass, 0 fail;
- `bun run typecheck`: 11/11 projects clean;
- `bun run lint`: pass;
- `bun test`: 1,098 pass, 0 fail;
- `bun run build`: pass (the existing large-chunk advisory remains);
- `bun run gates`: 16 automated pass, 0 automated fail; U14 and U15 remain
  the workstream's explicit manual owner/reviewer checks.

The shared worktree's unrelated
`evidence/volumetric-device-browser.txt` contains pre-existing trailing
whitespace, so a repository-wide `git diff --check` reports that foreign lane.
The W9a source, tests, diary, decision, and evidence paths pass their scoped
whitespace checks.
