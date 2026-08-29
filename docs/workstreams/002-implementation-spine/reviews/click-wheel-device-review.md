# Review: W7 device click-wheel input surface — commit `5a11916`

## Verdict: REQUEST_CHANGES

### Findings

- **[MAJOR] The tests never mount or exercise the exported component, so the complete browser-event adapter can be severed without a red gate** (`packages/device/src/click-wheel-input.test.tsx:1`, `packages/device/src/click-wheel-input.tsx:191`) — I replaced the three JSX handlers with callbacks that only reference, but never invoke, `onPointerDown`, `onPointerMove`, and `onPointerUp`. The edit was asserted present, TypeScript remained clean, and all 8 committed tests still passed. None of the required boundary behavior is therefore gated: Fiber's synthetic `event.target` capture API, the native Canvas-event host, `onArcStart`/`onArcMove`/`onArcEnd`, listener installation, `pointercancel`, unexpected `lostpointercapture`, duplicate terminal events through the real component, or unmount cancellation. The two lifecycle tests construct `ClickWheelCaptureSlot` by hand and call `finishClickWheelCapture`; they do not prove that production ever populates the slot or routes a browser event into it. This is a high-risk R3F↔DOM lifecycle seam and the workstream review contract treats missing deterministic evidence as Major. Add a mounted Fiber/DOM boundary test (using the pinned Fiber behavior, not a hand-shaped `ThreeEvent`) that goes red when each production handler or listener is disconnected.

- **[MAJOR] The named live-transform test passes when the production world-matrix refresh is deleted** (`packages/device/src/click-wheel-input.test.tsx:29`, `packages/device/src/click-wheel-input.tsx:119`) — the test helper calls `mesh.updateWorldMatrix(true, false)` immediately before `wheelAngleFromRay`, so removing the load-bearing production call at line 120 leaves `bun test … -t "samples the live ray"` green. The complete file happens to fail later in the parallel-ray test because module-global scratch state retains the previous rotated plane; that is D-058 exactly: red for a reason that does not support the claimed conclusion. A stale-transform regression can pass the assertion whose name says it catches it. Build the ray from an independently calculated expected transform, then dirty a parent/mesh transform without pre-updating the object under test; assert the named test itself goes red when line 120 is removed.

- **[MINOR] “Front-face-only” is usage convention, not an enforced property of the exported surface** (`packages/device/src/click-wheel-input.tsx:188`, `packages/device/src/DeviceCanvas.tsx:62`) — `DeviceCanvas` renders `Device` and `children` as siblings. `Device` applies its `face="back"` rotation inside `ViewerLitDeviceFrame`, while `ClickWheelInputSurface` remains an unrotated front-facing ring at positive z. A caller that combines the public `face="back"` canvas state with the public input surface gets an invisible but raycastable front annulus over the back view. The current composite has no back mode, so this does not block today’s front-only MVP, but the component’s stated property is not structural and there is no front/back gate. Either place the surface in the same model transform or make front-only enablement explicit at the API boundary.

### Verified behavior and non-findings

- Pinned framework truth: `@react-three/fiber` 9.7.0 from `/Users/vinicius/code/agentic-context/react-three-fiber/packages/fiber/src/core/events.ts` and `src/web/Canvas.tsx`; Three 0.185.1 from the pinned `/Users/vinicius/code/agentic-context/three.js` clone and `bun.lock`.
- Fiber capture is additive and the synthetic `event.target` is the supported capture API. The component correctly avoids stale `event.point` and samples `event.ray` synchronously against a plane derived from `matrixWorld`.
- A real Chrome run with `CanvasDrawElement` enabled reached T1. A mouse arc began inside the annulus, continued at radius 145 outside the 115-radius wheel with `canvas.hasPointerCapture(1) === true`, advanced to “Row 8 of 8. Search.”, and ended with capture false. This proves the normal capture path, not cancellation or teardown.
- Canonical radii are transitively literal-gated by `layout.test.ts`. Planting `inner = selectR + 1` produced exactly 1 failing click-wheel test.
- Clockwise/counter-clockwise signs and ±179° seam results are correct.
- Primary-pointer and left-mouse filtering helpers are correct for the stated contract.
- No executable `event.point`, `useState`, `useFrame`, state import, tier check, or haptic call exists in the changed implementation.
- The invisible mesh adds no frame driver; `DeviceCanvas` remains `frameloop="demand"`.
- Commit scope is exactly the two new device files plus `src/index.ts`. Commit message has no trailer; the three files are byte-identical to `5a11916` in the current worktree.

### Gates I ran myself

- `bunx tsc --noEmit -p packages/device/tsconfig.json` → clean.
- `bunx --bun eslint packages/device/src/click-wheel-input.tsx packages/device/src/click-wheel-input.test.tsx packages/device/src/index.ts` → clean.
- `bun test packages/device/src/click-wheel-input.test.tsx` → 8 pass / 0 fail.
- `bun test packages/device` → 68 pass / 0 fail.
- `bun run typecheck` → 11/11 projects clean.
- `bun run lint` → clean.
- `bun run gates` → 15 automated pass, CREDENTIALS red on pre-existing prose in `reviews/w5a-review.md:21`; unrelated to this commit. U14 and U15 remain manual as the runner reports.
- Full repo test stage inside the gate → 900 pass / 0 fail on the current concurrent tree.
- Mutation: canonical inner radius `+1` → 1 failure, edit asserted present.
- Mutation: all three production JSX handlers converted to no-op references → 8/8 click-wheel tests still pass and device TypeScript remains clean, edit asserted present.
- Mutation: delete production `mesh.updateWorldMatrix(true, false)` → targeted “samples the live ray” test still passes; the full file fails only in the separate parallel-ray test because it reuses stale module scratch state.
- Flagged Chrome boundary probe on `/_probe/composite` → T1; capture true outside wheel; row advances; capture false after release.

### Required review questions (D-038)

1. **Does a finding contradict the method used elsewhere?** Yes, unless kept explicit: the real-browser happy path is strong evidence for ordinary capture, but it cannot be spent as evidence for cancellation, lost-capture, or unmount cleanup. I do not use it to clear those paths.
2. **Does each endorsed reason support its conclusion?** The geometry and seam conclusions have direct numeric tests and independent browser behavior. The committed “live transform” test does not support its own title because its fixture performs the production update for the implementation; that mismatch is Major 2.

### Human-only gates

- H-5/U14 thumb-occlusion validation remains owner-only and cannot be cleared by this review.
- H-6 both-colourway aesthetic sign-off remains owner-only and is unrelated to this invisible input primitive.

### Review setup notes

- `AGENTS.md` explicitly states there is no Neuve board or shell, so no ticket or Neuve commands were invented.
- Loaded the 002 scope, dependency graph, HITL register, tracker, decision log, review prompt, W4/W6 dispatch context, and the conversation’s W7 pointer architecture.
- Loaded strict-critique, team-orchestration and review protocol, global-patterns, interface-craft/design-critique, web-design-guidelines, jotai-state, modern-web-guidance, and Vercel React best-practices. The modern-web helper’s prescribed `npx` command conflicts with repo law, so it was not run; current Web Interface Guidelines were fetched directly. The global-patterns/jotai skill paths still name missing `~/code/agent-context` files; framework claims were instead grounded in the repo-mandated `/Users/vinicius/code/agentic-context` pinned clones.

# Re-review — commit `abb7389`

## Verdict: APPROVE

**0 Critical, 0 Major, 0 Minor.** Both blocking findings and the non-blocking front-face finding from the original review are closed.

### Finding disposition

- **Major 1 — closed.** The integration suite mounts the exported `ClickWheelInputSurface` through the actual pinned `@react-three/fiber` 9.7 event manager and exercises the resulting JSX handlers, DOM pointer capture, native `pointercancel` / `lostpointercapture` listeners, and unmount cleanup. I independently replaced every mounted JSX handler with a callback that referenced but did not invoke the production handler. The edit was asserted present, device TypeScript remained clean, and the integration suite failed **4/5** tests for the intended missing capture/termination effects; only the unrelated back-face test remained green. This is no longer a hand-shaped `ThreeEvent` test.
- **Major 2 — closed.** The transform fixture now computes its expected parent/mesh transform independently, dirties the live object hierarchy, and does not pre-update the object under test. Removing only `mesh.updateWorldMatrix(true, false)` makes the specifically named dirty-parent test fail in isolation with expected `90` and received `90.35892209787333`. The production helper now uses invocation-local plane/vector scratch objects, so no prior test can lend it a stale module-global plane. I additionally ran each unit and integration file independently ten times; all runs were green. The focused pair was green in both requested CLI orderings. The isolated parallel-ray test also fails without the update, but the dirty-parent assertion now independently proves the claimed reason.
- **Minor 1 — closed.** `DeviceCanvasFaceContext` carries the active face to the input surface, and `ClickWheelInputSurface` returns `null` for `face="back"`. The mounted back-view integration test inspects the Fiber scene and finds no `click-wheel-input` mesh, hence no raycastable annulus. Removing the early return makes that exact test fail because the mesh appears. Front-only behavior is now structural at the public canvas boundary.

### Independent browser and gate verification

- Flag-enabled Chrome on `/_probe/composite` resolved **T1**. A real pointer started in the ring, remained captured after moving outside the wheel (`canvas.hasPointerCapture(1) === true`), advanced navigation to “Row 8 of 8. Search.”, and released capture on pointer-up. No page error was reported.
- `bunx tsc --noEmit -p packages/device/tsconfig.json` → clean.
- Scoped ESLint over the changed device files → clean.
- Focused unit + mounted integration tests → **13 pass / 0 fail**.
- Full device package → **73 pass / 0 fail**.
- Full repo test stage → **903 pass / 0 fail**; typecheck → **11/11**.
- Static credential, trailer, naming, state, and architecture gates passed. The current shared working tree’s full lint stage is red only at the concurrently modified, uncommitted `packages/composite/src/CompositeDevice.tsx:182` (`react-hooks/refs`). That file is outside `abb7389`; the committed device scope is lint-clean. This unrelated live-lane failure does not alter this commit’s verdict.
- `abb7389` has no commit trailers. Its device changes are scoped to the face propagation, mounted integration harness, transform isolation, and associated package/evidence updates described above.

### Mutation integrity and review posture

I read the submitted mutation evidence, then replayed the three decisive mutations in an isolated `git archive abb7389` tree rather than trusting its reported outcomes. Each mutation asserted that its edit landed before tests ran. The handler no-op, world-matrix deletion, and back-face early-return deletion all failed for their claimed observable reason. The clean archived baseline passed before mutation.

The original happy-path browser probe still does not by itself prove cancellation or teardown. Approval rests on the mounted deterministic lifecycle suite and its red mutations for those paths, with the browser probe serving only as an independent normal-path boundary check. H-5/U14 and H-6 remain owner-only visual gates and are not evidence supplied by this input-surface commit.
