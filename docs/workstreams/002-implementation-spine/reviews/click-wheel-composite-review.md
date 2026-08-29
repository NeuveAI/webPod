# Review: W7 composite click-wheel runtime — commits `cf5e9b0` and `38b5f05`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 5 Major · 0 Minor

## Correctness check

- **Source of truth loaded:** `AGENTS.md`; workstream 002 `scope.md`, `decision-log.md`, `hitl-decisions.md`, `dependency-graph.md`, `review-lanes.md`, `review-system-prompt.md`, W6 dispatch/diary/decisions/evidence, D-068, the W7 architecture handoff, and the adjacent device/panel/state implementation. There is no W7 dispatch, diary, decision, or composite evidence artifact in the repository.
- **Canonical grounding loaded:** `/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`; React StrictMode documentation; R3F event docs and `packages/fiber/src/core/events.ts`; the checked-in Three/R3F/Jotai sources under `/Users/vinicius/code/agentic-context`. The current Vercel Web Interface Guidelines were fetched on 2026-08-29. The modern-web-guidance search was run with `bunx` because repo law prohibits its documented `npx` invocation; it returned no close pointer-capture guide.
- **Dispatch scope:** the two commits touch only composite, its declared state dependency, and the lockfile. Commit messages contain no trailers. Composite files are byte-clean in the current worktree.
- **Browser provenance:** fresh Vite server from the current worktree; fresh Google Chrome profile; `--enable-blink-features=CanvasDrawElement`; CDP port 9333; real route `http://localhost:3000/_probe/composite`; `'requestPaint' in HTMLCanvasElement.prototype === true`; `data-composite-tier="T1"`; one canvas; committed composite bytes unchanged from the reviewed commits. The device package was concurrently dirty, so this run is valid production-boundary evidence for composite but not a frozen whole-tree artifact.
- **Owner-only gates:** U14 phone-in-hand occlusion and H-6 both-colourway aesthetic acceptance remain outstanding and are not cleared here.

## Findings

- **[MAJOR] The production bridge can be replaced by three no-op arc callbacks while every composite test and composite TypeScript check remains green.** (`packages/composite/src/CompositeDevice.tsx:90`, `packages/composite/src/CompositeDevice.test.tsx:17`, `packages/composite/src/click-wheel-browser.test.ts:10`) — I replaced `runtimeRef.current?.arcStart(sample)`, `.arcMove(sample)`, and `.arcEnd(end)` with `void sample` / `void end` in a clean archive and proved the edit landed. Result: **38/38 composite tests pass and `tsc -p packages/composite` passes**. The file called `click-wheel-browser.test.ts` is only a `FakeWheelRoot`; it never mounts `CompositeDevice`, `ClickWheelInputSurface`, the singleton `deviceStore`, React effects, or the real event hierarchy. Consequently the required production claims — exact path mapping, singleton-store movement, screen/body/ring exactly-once behavior, StrictMode listener lifecycle, cancellation flowing from device to runtime, and no panel double handling — are not gates. This is the precise verifier mismatch the review prompt forbids: the unit runtime can be correct while the shipped bridge does nothing.

- **[MAJOR] The claimed refresh-rate invariant does not gate elapsed-frame forwarding.** (`packages/composite/src/click-wheel-runtime.ts:114`, `packages/composite/src/click-wheel-runtime.test.ts:67`) — I replaced `Math.max(0, frameMs - previous) / 1000` with the frame-dependent constant `1 / 60`, confirmed the mutation in the archived source, and the entire runtime suite still passed **9/9**, including “settles on the same row from 15 to 240Hz.” The assertion observes only the final clamped row for one gesture, so materially wrong coast distance can land at the same list boundary and read as invariant. W2 already documents this exact defect class (D-060); the adapter reintroduces it without an effective gate. Assert the forwarded deltas and/or use an unclamped screen with exact travelled rows/detents at every refresh rate.

- **[MAJOR] The binding 120ms wheel-idle policy is self-derived and accepts any value.** (`packages/composite/src/click-wheel-runtime.ts:13`, `packages/composite/src/click-wheel-runtime.test.ts:90`) — I changed `WHEEL_IDLE_MS` from `120` to `20`, confirmed the mutation, and the runtime suite remained **9/9 green** because line 95 compares the scheduled delay to the same exported symbol. This violates D-050’s literal-plant rule and would silently change residual-drop timing by 6×. The test must assert the specification literal independently, cover rescheduling from the last event, and prove no end/coast occurs before that boundary.

- **[MAJOR] A real click-wheel arc removes keyboard focus and leaves Arrow navigation dead.** (`packages/composite/src/CompositeDevice.tsx:90`, `packages/device/src/click-wheel-input.tsx:253`, `packages/panel/src/Panel.tsx:122`) — in the fresh flagged-Chrome T1 route I first focused the panel and verified Arrow navigation. I then performed a real CDP mouse arc over the production annulus, continued outside it under capture, and released. The arc moved the selection and emitted one settled live-region announcement, but `document.activeElement` became `BODY`; the immediately following `ArrowDown` did not move the selected row. The changed composite/device event path never restores or preserves the panel’s `role="application"` focus. This contradicts the explicit W7 review requirement to preserve focus/keyboard behavior and turns the path gesture into a mode switch that strands keyboard/switch users. Add a production-level test and a deliberate focus contract; do not merely test the standalone panel.

- **[MAJOR] Required W7 policy/provenance artifacts are absent, so the browser and lifecycle posture is not reproducible from the commits.** (`docs/workstreams/002-implementation-spine/tracker.md:25`, `docs/workstreams/002-implementation-spine/decision-log.md:824`, `packages/composite/src/click-wheel-browser.test.ts:10`) — the repository has a W7 tracker row and D-068’s panel ruling, but no W7 dispatch, no per-slice decision entry for the browser-invented 120ms idle boundary, no diary, and no committed flagged-browser evidence. The architecture handoff explicitly required that policy to be recorded. There is therefore no source fingerprint or durable evidence for touch emulation, seam crossing, reduced-motion release, screen/body/ring exactly-once input, cancellation, keyboard focus, one announcement, or zero RAF after settlement. My independent run proves some happy paths, but it cannot retroactively make the reviewed commits reproducible, and the current dirty device tree prevents treating it as an immutable whole-slice capture.

## Verified behavior that is not a finding

- The runtime uses the exported singleton `deviceStore`; no second production store is constructed.
- Mouse maps to `mouse-arc`; touch and pen map to `touch-arc`; the shortest-angle formula handles both ±179° seam directions.
- New gestures reset competing momentum, release calls `endGestureActionAtom`, cancellation avoids coast, and document-hidden/window-blur/reduced-motion listeners are removed by `dispose()` in the isolated runtime.
- The real root has `touch-action: none` and `overscroll-behavior: contain` from first paint.
- The real root capture listener prevents default wheel scrolling; synthetic wheel events dispatched at the transformed panel and canvas each produced one reducer-sized movement rather than the panel fallback doubling it.
- A real captured mouse arc continued outside the visible wheel. One flick produced one live-region mutation. After coast settled, the instrumented RAF request/fire counters remained unchanged over a further 500ms.
- No `useState`, tier check in the runtime/device surface, haptic call, type escape, lint disable, workstream-name leak, or commit trailer was found in the reviewed commits.

## D-038 questions

1. **Does a finding contradict the method used elsewhere?** Yes: the implementation correctly injects clocks/timers/events for deterministic unit tests, but the evidence then labels a fake-target unit file “browser” and leaves the actual React/R3F bridge unmeasured. The injection discipline cannot support a production-boundary claim by itself; Major 1 is that inconsistency.
2. **Do the reasons support the endorsed conclusions?** The runtime tests support isolated state-machine behavior. They do **not** support production wiring, exact refresh invariance, the 120ms literal, or preserved keyboard focus. The browser run supports the happy-path arc/capture and exactly-one announcement, and directly contradicts the focus-preservation conclusion.

## Gates and adversarial checks run independently

- `bun test packages/composite` → 38 pass, 0 fail.
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → clean.
- `bunx eslint packages/composite/src` → clean.
- `bun run build` → client and SSR builds pass; existing large-chunk warning only.
- `bun run gates` → 15 automated pass, 1 unrelated pre-existing CREDENTIALS false positive in `reviews/w5a-review.md`; U14/U15 manual. This is not attributed to either reviewed commit.
- Production arc callbacks replaced with no-ops in a clean archive → edit confirmed; 38/38 pass; composite tsc clean (**gate failure**).
- Runtime coast delta replaced with `1 / 60` → edit confirmed; 9/9 pass (**gate failure**).
- `WHEEL_IDLE_MS` changed `120 → 20` → edit confirmed; 9/9 pass (**gate failure**).
- Fresh flagged Chrome T1: requestPaint true; capture continued outside the wheel; arc moved the singleton-backed panel; one announcement; coast reached stable 0 additional RAF; reduced-motion change cancelled outstanding frames; focus regressed to BODY and immediate Arrow input did nothing.
- Commit audit → `cf5e9b0` and `38b5f05` are coherent, trailer-free, and limited to the declared composite dependency/runtime/wiring surface.

---

# Re-review — W7 corrections `d9c621a` and `7127ca1`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 2 Major · 0 Minor

The refresh-rate, 120ms-idle, and focus implementation defects are corrected. The two remaining blockers are verifier-boundary defects: the mounted test still stops before the final production handoff, and the committed browser proof neither fails on bad results nor identifies the reviewed commit's bytes.

## Finding disposition

| Original Major | Disposition | Independent result |
|---|---|---|
| Production callbacks can become no-ops | **OPEN — narrowed** | The controller forwards are gated, but the final `CompositeDevice` → `CompositeSceneBridge` handoff is not. |
| 15–240Hz gate accepts fixed `1 / 60` | **RESOLVED** | The test is unclamped and exact; the original mutation now fails 0/1. |
| 120ms policy is self-derived | **RESOLVED** | Literal, 119ms negative, 120ms transition, and last-event rescheduling are present; `120 → 20` fails 0/1. |
| Arc strands keyboard focus | **RESOLVED in implementation** | Mounted test and clean Chrome 151 both restore `role="application"`; ArrowUp moves row 7 → 6. |
| W7 policy/provenance absent | **OPEN — artifacts exist, proof is invalid** | Dispatch/decision/diary/evidence are committed, but the runner is not a gate and its committed digest is not commit `7127ca1`. |

## Findings

- **[MAJOR] The new mounted test still does not gate the final production handoff to the R3F surface.** (`packages/composite/src/CompositeDevice.tsx:84-98`, `packages/composite/src/CompositeDevice.integration.test.tsx:44-77`) — the integration test mounts `CompositeInputBoundary` directly and invokes the render-prop handlers it captures at line 57. It never mounts `CompositeDevice`, `DeviceCanvas`, `CompositeSceneBridge`, or the `ClickWheelInputSurface` props at lines 93–97. In a clean `7127ca1` archive I replaced those three final props with callbacks that reference but do not invoke `onArcStart`, `onArcMove`, and `onArcEnd`; the mutation was confirmed, **all 41 composite tests passed, and composite TypeScript passed**. Thus the exact shipped bridge can still be dead while the new “production” gate remains green. Mount `CompositeDevice` with a controlled DeviceCanvas/scene seam, or extract and gate one typed adapter that is itself the only value passed to `CompositeSceneBridge`; the test must cross the line it claims to protect.

- **[MAJOR] The committed Chrome evidence is not self-failing and its fingerprint does not identify the reviewed commit.** (`scripts/w7-browser-evidence.ts:61-86`, `docs/workstreams/002-implementation-spine/evidence/w7-browser.json:7-16`) — the runner computes `sourceStable`, focus, keyboard continuation, and page errors, then only prints them. It never asserts any of them. In a clean archive I removed both focus-restoration calls: Chrome reported `focusAfterArc.role: null` and `keyboardContinued: false`, yet `bun run scripts/w7-browser-evidence.ts` exited **0**. Separately, clean commit `7127ca1` fingerprints to **`8dc78efc…b13884` / 151 files**, while the committed evidence records **`303ea8d3…df2a1` / 151 files**. A clean replay passes behaviorally but necessarily disagrees with the evidence because `7127ca1` changed fingerprinted package/lock inputs after the recorded run. The current dirty-tree replay produced a third stable digest (`2a65325e…6818a`), demonstrating that before/after equality only proves no mid-run write, not commit identity. Assert every acceptance field, fail on page errors or digest drift, and regenerate evidence from the final committed tree (or record and verify the exact commit/tree identity without creating a self-referential hash).

## Independent verification

- Focused: composite TypeScript clean; **41 pass / 0 fail / 143 expects**; scoped ESLint clean.
- Full: **11/11** typecheck; **906 pass / 0 fail / 44,256 expects**; lint and client/SSR build pass; gates **16 automated pass / 0 fail**, U14/U15 correctly manual.
- Clean Chrome 151, `CanvasDrawElement`, T1: production arc moved row 4 → 7, application focus restored, ArrowUp moved row 7 → 6, no page errors.
- `Math.max(0, frameMs - previous) / 1000 → 1 / 60`: elapsed-frame test fails 0/1 with equal 1353.6 speeds.
- `WHEEL_IDLE_MS 120 → 20`: literal boundary test fails 0/1.
- Remove arc-end focus restore: mounted integration test fails 0/1 with BODY active.
- Replace only the final scene handoff with no-op wrappers: **41/41 pass and composite TypeScript clean** — remaining gate failure.
- Remove both focus restores and run committed browser harness: bad JSON, **exit 0** — remaining gate failure.

All adversarial changes were made only in an isolated `/tmp` archive and restored there. Shared composite source and index were not modified. U14/H-5 and the both-colourway aesthetic decision/H-6 remain owner-only and are not cleared by this review.

---

# Re-review — corrections `d9c621a` and `7127ca1`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 1 Major · 0 Minor

Four of the five prior Majors are closed. The provenance Major remains blocking because the committed evidence digest does not describe the committed source tree.

## Prior findings

1. **Production bridge no-op mutation — CLOSED.** In a clean `git archive 7127ca1`, I replaced all three mounted forwards in `CompositeInputController.handlers` with `void sample` / `void end`, confirmed the edit at the mutated source lines, and ran `bun test packages/composite/src/CompositeDevice.integration.test.tsx`. Result: **0 pass / 1 fail**, with the singleton highlight expected `> 0` and received `0`. The mounted Happy DOM gate now crosses React effects, the production handler object, and the exported singleton `deviceStore`; it fails for the intended reason.

2. **Frame-dependent coast mutation — CLOSED.** I replaced the elapsed frame expression with the exact prior mutation `1 / 60`, confirmed the edit, and ran the two focused coast tests. The elapsed-frame test failed because the 15Hz and 240Hz stores both reported `1353.6`; the unmutated clean archive travels exactly to row `673` from 15–240Hz on an unclamped 1,000-row screen. The gate now distinguishes elapsed frame input rather than accepting a shared clamped endpoint.

3. **`WHEEL_IDLE_MS: 120 → 20` mutation — CLOSED.** I applied the exact prior mutation and confirmed it in source. Both focused wheel-idle tests failed: the independent literal assertion expected `120` and received `20`, and the 119ms rescheduling assertion found the gesture already idle. The policy is now recorded in `decisions/w7.md` and gated independently of the exported symbol.

4. **Flagged-Chrome focus and keyboard regression — CLOSED.** I ran `bun run scripts/w7-browser-evidence.ts` independently from the live checkout and again from a clean `git archive 7127ca1`, each with a fresh Chrome profile, fresh Vite process, Chrome 151, `CanvasDrawElement`, `requestPaint === true`, and tier T1. In both runs a real mouse arc moved the selected row, `document.activeElement` ended with `role="application"` / label `webPod music player`, the following `ArrowUp` moved row 7 to row 6, and `pageErrors` was empty. The mounted deterministic test also restores application focus after its simulated Blink focus loss.

5. **Complete, truthful W7 artifacts/provenance — STILL OPEN.** The dispatch, diary, decisions, mutation report, gate report, runner and browser-result files now exist and accurately describe the intended method. The recorded source identity is not reproducible, however; see the remaining Major below.

## Remaining finding

- **[MAJOR] The committed browser result is fingerprinted against uncommitted concurrent bytes, not against the commits it claims make the proof reproducible.** (`docs/workstreams/002-implementation-spine/evidence/w7-browser.json:8`, `docs/workstreams/002-implementation-spine/evidence/w7-browser-provenance.md:10`, `scripts/w7-browser-evidence.ts:29`) — the committed JSON records digest **`303ea8d3961d…`** for 151 files. I ran the committed runner from an exact clean `git archive 7127ca1` with the archive's own app/package sources and obtained stable before/after digest **`8dc78efc13ed…`**, also for 151 files, while reproducing all browser behavior. Running it from the current dirty shared checkout produced a third stable digest, **`cfd9997a10f5…`**. Therefore “stable before/after” proves only that the shared checkout did not change during each run; it does not identify the immutable source that produced the committed result. The prose says the committed runner lets the reviewer reproduce *the result*, but its recorded digest cannot be derived from either reviewed commit and no manifest/tree/diff artifact maps `303ea8…` back to bytes. This is the same provenance failure as the prior Major, now made easier to see by the new hash: the browser behavior is verified, but the committed evidence is not tied to a reviewable source snapshot. Run the proof from an immutable archive/snapshot of a named commit (or commit the runner first, run that exact tree, then commit only evidence), record that commit/tree identity, and assert the recorded digest equals a fresh fingerprint of that immutable source.

## No new implementation finding

No new runtime, React lifecycle, state, accessibility, type, lint, scope, naming, or commit-trailer defect was found in `d9c621a` / `7127ca1`. The only blocker is the unresolved prior provenance finding above. The blank-line-at-EOF notices from `git diff --check` on five new Markdown files are non-functional formatting noise and are not elevated to findings.

## Gates and evidence rerun independently

- Clean archive baseline: `bun test packages/composite/src` → **41 pass / 0 fail / 143 expects**; composite tsc and scoped eslint clean.
- Exact no-op mounted-wiring mutation → **RED**, 0/1; singleton highlight remained 0.
- Exact `1 / 60` frame mutation → **RED**, elapsed-frame test 1 failure; both speeds `1353.6`.
- Exact `120 → 20` mutation → **RED**, 2 focused failures.
- Fresh flagged Chrome from live checkout → T1, requestPaint true, stable `cfd999…` digest, application focus restored, Arrow movement continued, no page errors.
- Fresh flagged Chrome from exact `git archive 7127ca1` → T1, requestPaint true, stable `8dc78e…` digest, application focus restored, Arrow movement continued, no page errors; digest does **not** match committed `303ea8…` evidence.
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → clean.
- `bun test packages/composite/src` → 41 pass / 0 fail.
- `bunx eslint packages/composite/src scripts/w7-browser-evidence.ts` → clean.
- `bun run typecheck` → 11/11 clean.
- `bun test` → **907 pass / 0 fail / 44,257 expects**.
- `bun run lint` → clean.
- `bun run build` → client and SSR pass; pre-existing large-chunk warning only.
- `bun run gates` → exit 0; all 16 automated gates pass; U14 and U15 remain explicitly manual.
- Standalone `d9c621a` archive → composite tsc clean and 41/41 composite tests green.
- Commit audit → both correction commits are scoped and trailer-free; no `useState`, `useFrame`, tier policy, haptic call, second production store, type escape, lint disable, or implementation-name leak was introduced.

---

# Final provenance re-review — `06652d8`, `617508e`, `da2a229`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 1 Major · 0 Minor

The immutable snapshot mechanism is now real and independently reproducible, but the committed W7 browser evidence was not regenerated from it. The final prior Major therefore remains open.

## Remaining finding

- **[MAJOR] The committed W7 result still identifies the old dirty-tree run rather than the immutable named snapshot.** (`docs/workstreams/002-implementation-spine/evidence/w7-browser.json:7`, `docs/workstreams/002-implementation-spine/evidence/w7-browser-provenance.md:11`, `scripts/w7-browser-evidence.ts:33`) — running the current immutable runner with `W7_SOURCE_COMMIT=da2a229` resolves commit **`da2a22937df3229a159d282d5d6028f249cad19d`**, tree **`2c8b8f758185924c0a983ada150ec71ecfc6fdaf`**, and source **`8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884` / 151 files**. The served health endpoint reports that same identity before and after the real flagged-Chrome run, and the browser behavior succeeds. The committed JSON, however, still records **`303ea8d3961d0bdb3fe584fa0f1f9f8e0a46161de246ae750b93739bf01df2a1` / 151 files**, uses the superseded `sourceBefore`/`sourceStable` schema, and contains neither `reviewedCommit` nor `reviewedTree`. The provenance prose likewise still describes only equal before/after hashes and claims that the committed runner reproduces “the result.” It does not reproduce the committed result's source identity. Commit the successful immutable-run JSON and update the provenance note to name the reviewed commit/tree and exact digest; until then the durable evidence remains tied to unrecoverable concurrent bytes.

## Independently verified corrections

- The archive is selected by a required `W7_SOURCE_COMMIT`, resolved as a commit and tree, and contains only the declared package/runtime inputs. Independent archive inspection found none of `cert`, `.claude`, `design.pen`, `docs`, `.env`, or `.env.local`; the runtime assertion enforces the same exclusions.
- An independent fingerprint of a separately extracted `git archive da2a229` produced **`8dc78efc13ed…b13884` / 151 files**, exactly matching the runner, the Vite health endpoint before/after, and the post-run snapshot fingerprint.
- The immutable flagged-Chrome run used Chrome 151 with `CanvasDrawElement`, reached T1 with `requestPaint`, restored application focus, continued keyboard movement from row 7 to row 6, and emitted no page errors.
- `W7_PROVENANCE_PLANT=MIDRUN` visibly landed a mutation in the extracted snapshot and exited **1**: expected `8dc78efc…/151`, received `bdd58ebb…/151`. The temporary snapshot was removed in `finally`; the repository remained unchanged.
- The follow-up `d66c66b` at current HEAD correctly waits for and validates the immutable Vite health endpoint before starting Chrome. It changes only the evidence runner and is trailer-free.
- The composite/W7 implementation paths are clean in the shared checkout. The wider tree has unrelated active device/token changes, which are excluded by the Git archive source boundary and were not reviewed or modified here.

## Focused gates

- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → clean.
- `bun test packages/composite/src` → **41 pass / 0 fail / 143 expects**.
- `bunx eslint packages/composite/src scripts/w7-browser-evidence.ts scripts/browser-source-fingerprint.ts` → clean.
- Commit scope/trailer audit → `06652d8`, `617508e`, `da2a229`, and current sequencing follow-up `d66c66b` each touch only the runner and contain no trailers.

No new runtime, lifecycle, input, accessibility, type, lint, exclusion, snapshot-mutation, or commit-scope finding was found. Approval is withheld solely because the committed evidence artifact still does not record the now-reproducible immutable result.

---

# Final provenance closeout — `d66c66b` and `50ebdde`

## Verdict: APPROVE

**Severity:** 0 Critical · 0 Major · 0 Minor

The final provenance Major is closed. Independent replay resolves `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa` to tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3` and reproduces digest `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884` across 151 files. The committed JSON names that exact commit/tree; expected source, health before, health after, and direct source-after fingerprint all match. The mid-run mutation exits 1 with `bdd58ebbf5f7bdb72318d87901fcd2024d438c1cb29395ef9e6d949f336a9bd8`, and no stale `303ea8d…`, `sourceBefore`, or `sourceStable` value remains in the active W7 evidence or runner. Focused composite tests, TypeScript, and evidence-runner ESLint pass. No new finding.

---

# Independent final provenance re-review — `06652d8`, `617508e`, `da2a229`, `d66c66b`, `50ebdde`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 1 Major · 0 Minor

## Correctness check

- **Source of truth:** workstream 002 scope, W7 dispatch, dependency graph, HITL register, review lanes, binding review prompt, W7 decisions/diary/evidence, and the prior review history were read. Browser/runtime claims were grounded against the checked-in sources under `/Users/vinicius/code/agentic-context` rather than model recall. This repo deliberately has no Neuve shell or Kanban board; `tracker.md` is the operational queue.
- **Correctness target:** immutable flagged-Chrome evidence must identify the reviewed Git commit/tree and served bytes, reject mid-run source drift, and make those identity fields mandatory in the evidence contract.
- **Dispatch scope:** the five commits modify only `scripts/w7-browser-evidence.ts` and the two W7 provenance artifacts. Current composite, runner, fingerprint-helper, and W7 evidence paths are clean; unrelated active W4/device and token changes were excluded.
- **Dependency/HITL status:** no dependency or HITL decision was bypassed. U14 phone-in-hand validation and H-6 both-colourway aesthetic acceptance remain owner-only and are not cleared here.
- **Type/lint/doc gates:** composite TypeScript clean; 41/41 focused tests pass; scoped ESLint clean; changed commits are coherent and trailer-free.
- **Verification evidence:** the green immutable run and red mutation were independently replayed. Archive exclusions and current evidence values were independently inspected.
- **Decision-log status:** W7-D4 requires evidence tied to bytes. The current implementation supplies the identity values, but does not make them a required evidence schema.

## Findings

- **[MAJOR] Commit/tree identity is present in today’s output but is not required by any schema or gate.** (`scripts/w7-browser-evidence.ts:117`) — `result` is an inferred object literal with no declared evidence type, parser, schema, or test asserting the required keys. In an isolated archive of `50ebdde`, I removed only `reviewedCommit: resolvedCommit` and `reviewedTree` from lines 118–119; the runner still bundled successfully. Repository search found no independent consumer or validator requiring either field. Consequently a future regeneration can silently produce provenance JSON without the two fields while TypeScript, focused tests, and lint remain green—the exact regression this re-review was explicitly asked to prove impossible. Define a closed evidence schema/type with required `reviewedCommit` and `reviewedTree`, validate the emitted/committed JSON against it, and add a mutation gate showing removal of either field turns red.

## Independently reproduced evidence

- `W7_SOURCE_COMMIT=d66c66b… bun run scripts/w7-browser-evidence.ts` → exit 0; commit `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa`, tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3`, digest `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`, 151 files; health before/after and direct source-after all exact; T1/requestPaint/focus/keyboard checks pass with no page errors.
- `W7_PROVENANCE_PLANT=MIDRUN` → exit 1 after confirming the plant landed; received `bdd58ebbf5f7bdb72318d87901fcd2024d438c1cb29395ef9e6d949f336a9bd8` / 151 against the expected immutable digest.
- The scoped `git archive d66c66b` manifest contains none of `cert/`, `.claude/`, `.env*`, `design.pen`, or `docs/`.
- Active W7 JSON contains the exact reviewed commit/tree and no stale `303ea8d`, `sourceBefore`, or `sourceStable` field. The separate D-068 panel evidence legitimately retains `303ea8d…` as historical panel mutation evidence and is outside this W7 artifact assertion.
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → clean.
- `bun test packages/composite/src` → 41 pass, 0 fail, 143 expects.
- `bunx eslint packages/composite/src scripts/w7-browser-evidence.ts scripts/browser-source-fingerprint.ts` → clean.
- Trailer scan over all five commits → no `Co-Authored-By`, `Claude-Session`, or generated-with footer.

## D-038 questions

1. **Does a finding contradict the method used elsewhere?** Yes. The runner treats source-byte identity as structural at runtime, but treats the identity metadata that makes the result reviewable as optional object decoration. The method is strict about the measured bytes and permissive about naming those bytes.
2. **Does the reason support the conclusion?** The exact green/red replays support source immutability. The mere presence of two JSON keys does not support the stronger conclusion that the schema requires them; the removal plant directly falsifies that claim.

## Suggestions (non-blocking)

- None.

---

# Independent provenance-contract re-review — `ec5bec0`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 1 Major · 0 Minor

## Finding

- **[MAJOR] The runtime evidence object is validated after construction, but its construction is still not type-enforced.** (`scripts/w7-browser-evidence.ts:117`, `scripts/w7-browser-evidence-schema.ts:18`) — in an isolated exact archive of `ec5bec0`, I deleted both `reviewedCommit: resolvedCommit` and `reviewedTree` from the runner’s `result` object and confirmed the edit. `bunx tsc --noEmit -p scripts/tsconfig.json` still exited 0, and all seven schema tests still passed because they exercise the separately committed JSON and hand-mutated records, not the runner’s constructed result. The mutated full runner correctly exited 1 at `parseW7BrowserEvidence`, so runtime validation is real; however, the requested contract was explicitly schema/**type**/runtime enforcement. The exported `W7BrowserEvidence` type currently does not constrain `result` because `parseW7BrowserEvidence` accepts `unknown`. Annotate the constructed result or use `satisfies W7BrowserEvidence`, then plant deletion of each identity field and prove scripts TypeScript turns red; retain the runtime parser for the JSON boundary.

## Independently reproduced evidence

- Baseline `bun test scripts/w7-browser-evidence-schema.test.ts` → 7 pass, 0 fail. Missing `reviewedCommit`, missing `reviewedTree`, malformed IDs, and well-formed mismatched IDs each reject with their specific error.
- Independent direct parser matrix → all six missing/malformed/mismatch cases red; valid evidence parses.
- Mutated runner without both identity fields → scripts TypeScript **green** and schema tests **7/7 green** (blocking type-gate failure); full flagged-Chrome runner exits 1 with `W7 reviewedCommit must be a lowercase 40-character Git object id` (runtime gate works).
- Valid current runner against `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa` → exit 0; tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3`; digest `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`; 151 files; exact health before/after/source-after; T1, requestPaint, focus restoration, keyboard continuation, and no page errors.
- Current mid-run source mutation → exit 1 after the plant confirms it landed; received `bdd58ebbf5f7bdb72318d87901fcd2024d438c1cb29395ef9e6d949f336a9bd8` / 151.
- `bunx tsc --noEmit -p scripts/tsconfig.json` → clean unmutated.
- `bunx eslint scripts/w7-browser-evidence.ts scripts/w7-browser-evidence-schema.ts scripts/w7-browser-evidence-schema.test.ts` → clean.
- `bun test packages/composite/src` → 41 pass, 0 fail, 143 expects.
- Commit `ec5bec0` is scoped, coherent, and trailer-free. Current composite/runner/schema paths are clean; only this review artifact is modified.

## Prior provenance disposition

All prior immutable-source, exact-identity, archive-exclusion, source-health, mutation, browser-behavior, scope, and trailer claims remain closed. Approval is withheld solely because deletion of required identity fields does not yet turn the type gate red.

---

# Final provenance-contract re-review — `cebbe2a`

## Verdict: APPROVE

**Severity:** 0 Critical · 0 Major · 0 Minor

The remaining type-contract Major is closed. The producer now applies `satisfies W7BrowserEvidence` directly to the complete result object before runtime validation and JSON serialization, with no `as W7BrowserEvidence`, `as unknown`, `as any`, `@ts-expect-error`, or lint-disable escape.

## Independent mutation results

- Exact `cebbe2a` archive, delete only `reviewedCommit` from the producer → scripts TypeScript exits 2 with **TS1360**, naming missing required property `reviewedCommit` on `W7BrowserEvidence`.
- Fresh exact `cebbe2a` archive, delete only `reviewedTree` from the producer → scripts TypeScript exits 2 with **TS1360**, naming missing required property `reviewedTree` on `W7BrowserEvidence`.
- Unmodified `bunx tsc --noEmit -p scripts/tsconfig.json` → clean.
- `bun test scripts/w7-browser-evidence-schema.test.ts scripts/w7-browser-evidence-type.test.ts` → 8 pass, 0 fail. Missing, malformed, and well-formed-but-mismatched commit/tree identities remain independently rejected; valid committed evidence parses.
- Scoped ESLint over the producer, schema, and both test files → clean.

## Prior provenance revalidation

- Valid immutable browser run against commit `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa` → exit 0; tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3`; digest `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`; 151 files; exact expected/health-before/health-after/source-after identity; T1 with `requestPaint`; focus restored; keyboard navigation continued; no page errors.
- Mid-run snapshot mutation → plant confirms it landed, then exits 1 with `bdd58ebbf5f7bdb72318d87901fcd2024d438c1cb29395ef9e6d949f336a9bd8` / 151 against the expected immutable digest.
- The scoped archive still excludes `cert/`, `.claude/`, `.env*`, `design.pen`, and `docs/`.
- Composite suite remains 41 pass, 0 fail, 143 expects.
- `cebbe2a` is scoped, diff-clean, and trailer-free. All reviewed implementation/evidence paths are clean; only this review artifact is modified.

No provenance, schema, type, runtime, browser, scope, exclusion, cleanup, or history finding remains. U14 phone-in-hand validation and H-6 both-colourway aesthetic acceptance remain owner-only and are not cleared by this review.

---

# Evidence-contract re-review — `ec5bec0`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 1 Major · 0 Minor

The commit/tree omission defect is closed: the committed artifact is parsed, both fields are required lowercase 40-character object IDs, and missing, malformed, and well-formed-but-different values independently turn the gate red. The remaining defect is that the same contract does not bind the committed source fingerprint to the immutable result it claims to preserve.

## Finding

- **[MAJOR] `expectedSource` is syntax-checked but not identity-checked, so the committed artifact can name the right commit/tree and the wrong bytes while all new gates remain green.** (`scripts/w7-browser-evidence-schema.ts:33-43`, `scripts/w7-browser-evidence-schema.test.ts:10-19`, `docs/workstreams/002-implementation-spine/evidence/w7-browser.json:9`) — `parseW7BrowserEvidence` accepts any lowercase 64-character value and any positive integer. The test's `expected` contract contains only `reviewedCommit` and `reviewedTree`, and `toMatchObject(expected)` never compares the known `8dc78efc…/151` source identity. In an isolated `git archive ec5bec0` I replaced the committed artifact's digest with 64 zeroes and `fileCount: 152`; the plant was confirmed and **all 7 schema tests passed**. That recreates the prior provenance failure with syntactically valid metadata: the immutable runner still knows the truth, but the durable committed result is allowed to disagree with it. Extend the expected contract (or the artifact test) to require the exact digest and file count derived for `d66c66b`; ideally require and cross-check `healthBefore`, `healthAfter`, and `sourceAfter` as the same identity rather than leaving the claimed four-way equality outside the schema.

## Independently verified corrections

- Deleting `reviewedCommit` from the actual artifact makes the baseline committed-JSON test fail with `W7 reviewedCommit must be a lowercase 40-character Git object id`.
- Restoring it and independently deleting `reviewedTree` fails with the corresponding `reviewedTree` error.
- Malformed and well-formed-but-different commit/tree values are separately gated in the test source.
- The browser runner validates its generated result against its resolved commit/tree before output.
- Baseline focused gates reproduce: scripts/composite TypeScript clean; scoped ESLint clean; **48 pass / 0 fail / 150 expects**; diff check clean; commit trailer scan clean.

All plants were confined to an isolated `/tmp` archive and restored. Shared owned source and index were not modified; foreign W4/device/token work was ignored.

---

# Final independent correction — `cebbe2a`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 1 Major · 0 Minor

The producer identity type defect requested for this round is fully closed: deleting `reviewedCommit` and `reviewedTree` independently produces TS1360 with the correct missing-property diagnostic, and `satisfies W7BrowserEvidence` is applied before validation/serialization without a cast escape. Runtime missing/malformed/mismatch validation also remains correct.

## Remaining finding

- **[MAJOR] The committed source fingerprint is still not bound to the reviewed commit/tree by the evidence contract.** (`scripts/w7-browser-evidence-schema.ts:57`, `scripts/w7-browser-evidence-schema.test.ts:10`, `docs/workstreams/002-implementation-spine/evidence/w7-browser.json:9`) — independently in an exact `cebbe2a` archive, I changed only the committed artifact’s `expectedSource.digest` to 64 zeroes and `fileCount` to 152, confirmed the mutation, and ran both focused evidence suites: **8 pass, 0 fail**. `W7BrowserEvidence` requires the shape, but `parseW7BrowserEvidence` only syntax-checks the fingerprint and its `expected` argument contains only commit/tree. Therefore the durable JSON can name the right Git objects and the wrong served bytes while schema, type, and focused tests all remain green. Extend the expected validated identity to include the exact digest and file count for the reviewed tree, then require the committed artifact’s `expectedSource`, `healthBefore`, `healthAfter`, and `sourceAfter` to equal it; plant a syntactically valid wrong digest/count and prove red.

## Verified closed

- Producer deletion of `reviewedCommit` → TS1360 naming missing `reviewedCommit`.
- Separate producer deletion of `reviewedTree` → TS1360 naming missing `reviewedTree`.
- No `as W7BrowserEvidence`, `as unknown`, `as any`, `@ts-expect-error`, or lint-disable escape at the producer boundary.
- Missing, malformed, and well-formed-but-mismatched commit/tree identities reject at runtime.
- The valid immutable Chrome replay and `bdd58ebb…/151` mid-run mutation still reproduce exactly; archive exclusions, focused composite tests, lint, commit scope, and trailer posture remain clean.

The earlier APPROVE paragraph in this appended history is superseded by this independent correction. Approval is withheld solely for the still-green wrong-source-identity plant above.

---

# Final source-bound provenance re-review — `d5688fa`

## Verdict: APPROVE

**Severity:** 0 Critical · 0 Major · 0 Minor

The final source-identity Major is closed. The committed evidence test now resolves the artifact’s `reviewedCommit`, verifies its `reviewedTree`, archives the canonical runtime inputs from that Git object, and fingerprints the extracted source independently. The reconstructed identity—not a copied digest constant—is passed into the runtime schema.

## Independent mutation results

- Exact `d5688fa` archive, replace only the committed digest with a syntactically valid 64-zero SHA-256 → focused schema test exits 1 with `W7 source fingerprint mismatch`, naming expected `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884` and the zero digest received.
- Fresh exact `d5688fa` archive, replace only committed `fileCount: 151` with `152` → focused schema test exits 1 with `W7 source file count mismatch: expected 151, received 152`.
- Both plants were confirmed before execution and confined to separate temporary archives.

## Contract and prior-provenance verification

- `satisfies W7BrowserEvidence` remains directly on the complete producer result before runtime validation and serialization; no `as W7BrowserEvidence`, `as unknown`, `as any`, `@ts-expect-error`, or lint-disable escape exists at that boundary.
- Prior independent deletion plants remain valid: removing `reviewedCommit` or `reviewedTree` separately produces TS1360 naming the corresponding missing property.
- Missing, malformed, and well-formed-but-mismatched commit/tree identities reject; syntactically valid wrong digest/count identities now reject; valid committed evidence reconstructs and parses.
- Unmodified evidence suites → 10 pass, 0 fail; scripts TypeScript and scoped ESLint clean.
- Composite suite → 41 pass, 0 fail, 143 expects.
- Fresh immutable Chrome replay against commit `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa` → exit 0; tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3`; reconstructed digest `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`; 151 files; exact expected/health-before/health-after/source-after identity; T1 with `requestPaint`; focus restored; keyboard continued; no page errors.
- Mid-run mutation confirms its write and exits 1 with `bdd58ebbf5f7bdb72318d87901fcd2024d438c1cb29395ef9e6d949f336a9bd8` / 151.
- Archive exclusions remain clean for `cert/`, `.claude/`, `.env*`, `design.pen`, and `docs/`; `d5688fa` is scoped, diff-clean, and trailer-free. Reviewed implementation/evidence paths are clean; only this review artifact is modified.

No provenance, schema, type, runtime, browser, exclusion, scope, cleanup, or history finding remains. U14 phone-in-hand validation and H-6 both-colourway aesthetic acceptance remain owner-only and are not cleared by this review.
