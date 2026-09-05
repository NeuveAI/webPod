# Cartoon hand cursor

Status: Awaiting owner approval of design AND rigging before browser integration.

Owner clarified this approval boundary on 2026-09-05. Browser mount and CSS were
removed, and native-cursor tests restored. Runtime files are disconnected drafts.
Do not remount or continue browser implementation until the owner approves both.

## Correctness and defaults

Replace the desktop fine mouse pointer across the player with an original white,
rounded cartoon glove. Four expressive poses: idle, pinch at the enclosure edge,
grab during the existing captured rotation, press on actionable controls. Fast
motion and acceleration above a rolling baseline trigger brief directional smears.
Contact stays at the actual pointer; animation must never intercept input.
Native cursors remain available for text entry, touch, loading and renderer failure.
Reduced motion retains useful poses but disables smear and secondary motion.

The source of truth is the user request and AGENTS.md. Existing native-cursor
expectations describe replaced behavior. Existing gesture datasets are supporting
integration contracts; orientation/playback implementation is out of scope.

Proposed visual default: soft 3D white glove with three fingers plus thumb, a rolled
cuff and dark seam details. Optional style question sent; no functional blockers.
Visual quality requires inspecting Blender renders and the existing player route.

## Decomposition and verification

| Slice | Files | Correctness and proof | Commit suggestion |
| --- | --- | --- | --- |
| References + asset | `assets/hand/`, `scripts/hand/`, `apps/web/public/hand/` | Blender source, separate armature/mesh, named pose clips; exported skin and animation inspection; pose renders | `Build a reusable cartoon glove rig in Blender` |
| Runtime | `apps/web/src/hand-cursor/`, root mount and cursor CSS | Shared Jotai state, GLTF skin loading, pose blending, bounded smears, cleanup and native fallback; typecheck and lint | `Animate the desktop glove cursor from player interactions` |
| Browser verification | `apps/web/tests/native-cursor.e2e.ts`, workstream evidence | Existing player route: idle/pinch/grab/press, pointer cancellation, native fallback, reduced motion; screenshots and browser checks | `Verify glove cursor states and document skin authoring` |

Dependency: references → Blender asset → runtime → browser verification. Work is
local and sequential, with no independent implementation dispatch. Preserve all
pre-existing edits. No commits/pushes are required; the above are staging boundaries.

## Gates and type sources

Use installed Three.js GLTFLoader/AnimationMixer/Object3D types and Jotai
createStore/atom. Read Jotai's local store docs. The mandated
`~/code/agentic-context/` is absent; official docs and installed dependency sources
are the fallback, with no invented upstream APIs. Blender 5.2.1 LTS is installed.
No new UI component library needed for a pointer-transparent rendering surface.

Run app typecheck, scoped eslint, browser interaction checks and asset inspection.
Prefer browser regression coverage; do not add unit tests per local global guidance.
Document lifecycle, rig contract and non-obvious motion/affordance decisions.

## Evidence and definition of done

- [ ] Editable `.blend`, reproducible Blender Python authoring script and GLB.
- [ ] Four visibly distinct poses, separate named skeleton and skin contract.
- [ ] Desktop integration and acceleration-driven smear with stable contact.
- [ ] Input pass-through, blur/cancel/leave cleanup, touch and failure fallback.
- [ ] Reduced-motion behavior; type/lint/browser checks recorded.
- [ ] Rendered pose reference and in-player screenshot inspected.

Research lives in `research.md`; decisions and authoring contract in `decisions.md`;
progress and final checks in `handover.md`; visual/check artifacts in `evidence/`.
Review lanes are asset silhouette/deformation, gesture correctness, lifecycle and
accessibility. Visual taste remains explicitly reviewable by the owner.

## Guardrails

Never access `cert/` contents or `design.pen`. No force push. Bun/bunx only.
No useState. No changes to unrelated workstreams or device material work.
No downloaded third-party models; references inform an original mesh.
