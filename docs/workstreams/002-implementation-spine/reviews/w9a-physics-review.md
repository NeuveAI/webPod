# W9a 3D click-wheel physics — antagonistic review

Reviewed the W9a implementation at commits `2ec0861`, `890b4f3` and
`52cd65a`, the current source and unchanged interaction/geometry siblings, the
binding 002 scope/decisions/HITL/review documents, W8 rest-geometry proof, and
the checked-out Three.js/R3F/browser-pointer sources under
`/Users/vinicius/code/agentic-context/`. I did not implement a fix, stage,
commit or reset anything.

## Verdict

**REQUEST_CHANGES — 4 Major, 1 Minor.**

The geometric mechanism is real and mostly well executed: it mutates local
positions and analytic normals, follows device-local contact under rotation,
restores the W8 arrays byte-for-byte and does not install an idle frame loop.
That does not clear the slice. A live reduced-motion transition can leave the
GPU showing a depressed control after the CPU geometry has returned to rest;
the release duration changes materially with display refresh rate; the visual
proof is manufactured through an expressly forbidden proof API and does not
contain the required browser interaction trace; and the first implementation
commit does not typecheck by itself.

U14/thumb occlusion (H-5) and the both-colourway aesthetic decision (H-6)
remain owner-only. This review does not clear either one.

## Major findings

### Major 1 — enabling reduced motion during a release restores only CPU state and can strand the rendered depressed frame

`packages/device/src/control-physics.ts:295-300` settles both channels and then
cancels the scheduled frame, but never calls `invalidate()`. That is not an
optional optimization in a `frameloop="demand"` canvas: imperative buffer
mutation is presented only when the canvas is invalidated. The repository's
checked-out R3F source says the same in
`react-three-fiber/docs/advanced/scaling-performance.mdx`; Three's
`BufferAttribute.needsUpdate` merely advances the attribute version and does
not itself schedule an R3F render.

The reachable sequence is:

1. press wheel or Select;
2. release, creating a non-null release and one pending frame;
3. the media query changes to reduced motion before the release completes;
4. `setReducedMotion(true)` restores the arrays and cancels that sole frame;
5. the demand canvas keeps displaying its last depressed frame until some
   unrelated invalidation happens.

An independent controller harness measured `deformedBefore=true`, two
invalidations before the toggle, two after it, byte-restored arrays, and zero
pending frames. In other words, the internal state is correct while the
owner-visible result is stale.

The existing test at `packages/device/src/control-physics.test.ts:206-224`
does not exercise this sequence: it enables reduced motion before calling
`releaseWheel()`, thereby taking the separate branch at
`packages/device/src/control-physics.ts:337-344`, which does invalidate. I also
deleted that branch's invalidation as a mutation plant; all eight focused
controller tests remained green. The reduced-motion rendering contract is
therefore not gated. W9A-06's claim that a live preference change snaps both
controls home is false at the rendered-frame boundary.

### Major 2 — the 24-frame escape hatch makes release motion refresh-rate dependent

`packages/device/src/control-physics.ts:372-381` ends a release on either
elapsed time or `CONTROL_RELEASE_FRAME_LIMIT`. The latter is described as a
frozen-timestamp safety bound, but it is applied unconditionally to healthy
timestamps. On a high-refresh display, frame count wins before the configured
duration.

I drove the current controller with exact synthetic refresh intervals. The
120 ms wheel release settled as follows:

| Refresh | Observed settle time | Frames |
| --- | ---: | ---: |
| 15 Hz | 133.33 ms | 2 |
| 30 Hz | 133.33 ms | 4 |
| 60 Hz | 133.33 ms | 8 |
| 120 Hz | 125.00 ms | 15 |
| 240 Hz | **100.00 ms** | 24 |
| 360 Hz | **66.67 ms** | 24 |

Normal frame quantisation accounts for being up to one frame late; it does not
account for settling 44% early. Select's 96 ms release is likewise truncated
at sufficiently high refresh. This directly violates D-060's frame-rate
independence rule and makes the physical feel depend on the display.

The only bound test, `packages/device/src/control-physics.test.ts:256-275`,
holds the timestamp at zero and asserts the 24-frame escape itself. It never
runs valid timestamps at two refresh rates, so it proves hostile-clock cleanup
without proving the ordinary motion contract.

### Major 3 — W9a manufactures visual proof through a forbidden API and still omits the required browser proof

The binding scope is explicit at
`docs/workstreams/002-implementation-spine/scope.md:79`: visual proof may use
the real routes, but **no proof-only route, harness or API may be created to
manufacture evidence**. W9a adds all of the following solely for evidence:

- a public `controlEvidencePose` prop on `DeviceCanvas` at
  `packages/device/src/DeviceCanvas.tsx:61-62` and consumes it at lines
  `164-165`;
- a package-level synthetic pose component at
  `packages/device/src/ControlPhysicsScope.tsx:83-114` that calls the
  controller directly;
- a query-string control surface at
  `apps/web/src/routes/[_]spike.device.tsx:296-299` and a direct-`DeviceCanvas`
  evidence branch at lines `366-375`, bypassing `CompositeDevice` and the
  pointer event chain under review.

W9A-08 labels this a "minimal evidence exception", but no owner ruling grants
that exception. An implementer's local decision cannot override the workstream
scope. The problem is not that the meshes or materials are alternate: they are
real. The problem is that the held state is injected by a proof API instead of
being reached through the production pointer lifecycle whose correctness the
capture is supposed to support.

The resulting evidence also does not meet the dispatch. The verifiability map
at `dispatch/W9-wheel-physics-sfx.md:47-50` requires a pointer-down/hold/release
browser trace and oblique macro frames. `evidence/w9a-browser.md:12-25` lists
sixteen front-on 1280×720 stills of synthetic held states. There is no pointer
trace, no release sequence and no oblique macro. Consequently the captures
cannot prove pointer capture, cancellation, release motion, rotated-device
contact, or that the user-reachable composite renders the same state.

I also opened both the ordinary `/_spike/device` route and the synthetic
production-surface query in the owner-visible in-app browser. The surrounding
DOM rendered, but the device canvas was blank in both cases. That may be the
known T3/WebGL environment caveat, but it means these saved images do not close
owner-visible testability in this environment. The evidence set contains no
immutable producer/browser identity or trace that would let a reviewer bridge
that gap.

### Major 4 — commit `2ec0861` is not independently type-correct

The review protocol requires every commit to typecheck alone
(`docs/workstreams/002-implementation-spine/review-system-prompt.md:99`). I
reconstructed `2ec0861` with `git archive`, attached the existing workspace
dependency installation, and ran:

`bunx tsc --noEmit -p packages/device/tsconfig.json`

It fails at `2ec0861:packages/device/src/index.ts:80-88` because that commit
exports five symbols that do not exist until `890b4f3`:

- `wheelContactFromRay`
- `clampWheelContactToRing`
- `ClickWheelSelectEnd`
- `ClickWheelSelectStart`
- `WheelContactSample`

The later two commits typecheck in equivalent archives, and the current W9a
source typechecks. That does not repair the broken first implementation commit
or make the claim that each commit stands alone true.

## Minor finding

### Minor 1 — all sixteen `.png` evidence artifacts are JPEG files

Every path listed at `docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:12-25`
has a `.png` suffix, but file-signature inspection identifies every one as
JFIF JPEG, 1280×720, three components. This is not the cause of the missing
interaction proof, but an evidence index should tell the truth about its
artifacts; the extension/content mismatch also makes MIME handling and later
pixel-exact tooling unreliable.

## Adversarial verification

I planted each mutation in the current source, ran the smallest relevant test,
and restored the exact bytes before moving to the next plant.

| Plant | Result |
| --- | --- |
| invert the wheel contact angle | red; 1 focused failure |
| turn the local footprint into whole-wheel deformation | red; 1 focused failure |
| suppress normal attribute upload | red; 1 focused failure |
| remove body `worldToLocal` conversion | red; 2 focused failures |
| remove pointer-cancel cleanup | red; 1 mounted-input failure |
| replace bounded release with a permanent frame request | red; 1 focused failure |
| remove reduced-motion release invalidation | **green; 8/8 pass** — exposes Major 1's gate hole |
| run valid release timestamps at 15–360 Hz | **green suite, divergent result** — exposes Major 2 |

The implementation's own excessive-travel and stuck-press plants were also
reproduced by their gates. Cancellation/lost-capture/blur/unmount coverage was
read against the mounted event path, not inferred from pure controller tests.

## Verified clean

- Wheel travel is genuine local geometry deformation. It does not use UV,
  screen-space, view-space, material-only or shader-only fakery.
- Contact is transformed into body-local space before the controller sees it;
  the four cardinal contacts and a rotated device remain local.
- The compact footprint preserves topology continuity. An independent sweep of
  6,144 deformed triangles found a minimum face-normal versus shading-normal
  dot product of `0.9999975` (mean `0.99999992`).
- Position and normal arrays return byte-exactly to the W8 rest state. The
  unchanged W8 flush/material suite passes 12/12, and no standing sidewall,
  torus or static recess was introduced.
- Select follows its curved local normals, travels farther than the ring, and
  remains restrained at the model scale.
- The visible wheel/decal shares the deformed geometry while the invisible hit
  surfaces stay fixed, preserving hit testing and screen alignment.
- Mouse, touch and pen use pointer capture. Release, pointer cancel, lost
  capture, blur, callback-throw and unmount paths clear active interaction;
  Enter supplies the keyboard Select path.
- Text-selection suppression remains scoped to the composite gesture and
  restores the prior document selection. The W9a commits do not alter that
  sibling or the detent reducer/runtime.
- The current source has no idle rAF loop, no `useFrame` polling, no new resource
  leak, no type escape, no prohibited naming and no commit trailer.

## Gate and worktree record

- `bun run gates`: exit 0; 16 automated pass, 0 automated fail; 2 manual gates
  remain outstanding.
- Current repository tests: 1,073 pass, 0 fail, 66,258 expectations across 66
  files.
- Current typecheck: 11/11 projects clean. Repository lint and client/SSR build
  are clean; the existing large Three.js chunk warning remains advisory.
- Focused W8 rest-geometry tests: 12 pass, 0 fail.
- Scoped W9 source diff/check: clean after every plant was reverted.
- The pre-existing shared worktree remains dirty in other lanes. I did not
  stage, commit, reset or modify those files.

# Re-review — W9a corrections (`0591daf`, `c74d377`)

## Verdict

**REQUEST_CHANGES — 2 Major.** The two runtime defects are genuinely fixed and
their new tests are load-bearing. The proof-only production API is gone, and the
synthetic JPEGs are now honestly quarantined. W9a nevertheless still lacks the
required production-browser interaction proof, and its broken historical commit
has not been repaired. The proposed owner-only rewrite procedure is also not safe
to execute verbatim.

## Disposition of the original findings

| Original finding | Re-review status | Evidence |
|---|---|---|
| Major 1 — reduced-motion release misses its final render | **CLOSED** | `packages/device/src/control-physics.ts:296-308` settles both controls, invalidates once, then cancels the pending frame. The exact deletion plant now fails the focused test at `packages/device/src/control-physics.test.ts:227-250`. |
| Major 2 — valid high-frequency timestamps trigger the stall escape | **CLOSED** | `packages/device/src/control-physics.ts:373-397` resets the consecutive-stall counter after every forward timestamp. The exact 15–360 Hz sweep at `packages/device/src/control-physics.test.ts:282-341` passes, while replacing the reset with an increment fails at 240 Hz. |
| Major 3 — proof-only API and no production proof | **PARTIALLY CLOSED; Major remains** | The API half is closed by `packages/device/src/control-physics.test.ts:343-370`; the production-browser half remains open at `docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:5-42`. |
| Major 4 — first implementation commit is not standalone-coherent | **OPEN** | `2ec0861` still fails its isolated archive typecheck with five missing exports. The owner-only plan has not been executed and is not yet safe to execute as written. |
| Minor 1 — JPEG evidence was misrepresented | **CLOSED** | `docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:46-66` identifies the images as rejected synthetic captures and explicitly denies them evidentiary value. |

## Remaining Major findings

### Major R1 — the required production-browser proof is still absent

`docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:5` correctly
says that no capture was accepted, and lines 23-42 leave the pointer lifecycle,
oblique macro sequence, rest equality and no-idle-frame checks open. That is an
honest report of a blocker, not completion of the lane. The dispatch requires a
real pointer down/hold/release trace and rendered macro evidence at
`docs/workstreams/002-implementation-spine/dispatch/W9-wheel-physics-sfx.md:47-50`.

I independently opened the ordinary `/_spike/device` route in the in-app browser.
The route DOM and controls rendered, but the canvas reproduced the documented T3
blank state. The separate Chrome connector was unavailable. Consequently there
is still no owner-visible evidence that the production pointer path drives the
real model, that the visible press reads correctly under oblique lighting, or
that release returns to the exact W8 rest pose in a browser. Pure-controller and
mounted synthetic tests cannot clear those rendering claims. This remains a
Major until the production route is captured successfully or an owner accepts a
documented reduction of the dispatch's browser-proof requirement.

### Major R2 — the history remains broken, and the owner procedure is fail-open

The current source is green, but history is not: independently archived
`2ec0861` exits 2 with the same five missing exports, while archived `0591daf`
exits 0. Preparing an owner-only rewrite is the correct authority boundary, but
preparing a plan does not make the old commit coherent.

More importantly, the proposed command sequence is unsafe to run verbatim:

- `docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:45-62`
  records `main` in `OLD_HEAD` but neither checks out nor asserts that `main` is
  the current branch. `git rebase -i` rewrites the checked-out branch, so a clean
  checkout of another branch would rewrite the wrong target while the backup ref
  still points at `main`.
- The preconditions and postconditions at lines 50-61 and 110-125 are bare
  `test` commands with no fail-fast shell mode or `&&` chain. In the documented
  paste-and-run form, a failed identity, cleanliness or ancestry check does not
  stop the following rebase or publication steps. I confirmed the shell behavior
  independently: a failing `test` is followed by the next command under `zsh`.
- The archive loop at lines 133-155 is fail-open for the same reason. A failed
  archive or typecheck does not abort the loop, and it verifies only the device
  package even though correction `0591daf` also changes the web route.

Before the owner acts, the plan needs an explicit target-branch assertion or
checkout, fail-fast execution, and verification that aborts on every failed
archive/typecheck. After the owner performs the rewrite, both amended commits and
the full rewritten range still need the stated isolated checks before any
owner-only force-with-lease publication. No agent should execute that operation.

## Independent correction verification

I reran the focused tests in an isolated archive and then planted the exact two
former defects, asserting that each edit had actually landed before running the
test:

| Plant | Result after correction |
|---|---|
| delete the release invalidation from the live reduced-motion transition | **red** — 9 pass, 1 fail; expected 3 invalidations, received 2 |
| replace the healthy-timestamp `stalledFrames = 0` with `+= 1` | **red** — 9 pass, 1 fail; at 240 Hz the release settled at 100 ms instead of at least 120 ms |

After restoring the isolated copy byte-for-byte, the focused suite returned to
10/10 passing. An independent timing harness over the current controller produced
bounded releases at every requested rate: wheel/select completion was
133.33/133.33 ms at 15 Hz, 133.33/100 ms at 30 Hz, 133.33/100 ms at 60 Hz,
125/100 ms at 120 Hz, 120.83/100 ms at 240 Hz, and 122.22/97.22 ms at 360 Hz.
Every result is at least the configured duration and less than one frame beyond
it. The reduced-motion sequence moved from two to three invalidations, cancelled
the sole pending frame, and left no scheduled callback.

## Proof and evidence audit

- `ControlPhysicsEvidence`, `controlEvidencePose` and
  `requestedControlPose` no longer exist in production source or package exports.
  Their only remaining occurrences are absence assertions in
  `packages/device/src/control-physics.test.ts:343-370`. The public controller
  `reset()` seam is also gone.
- All 16 files under `evidence/w9a-rejected-synthetic/` are actual JFIF JPEGs,
  the former accepted-evidence directory is absent, and no trace or macro capture
  is being passed off as production proof. The quarantine is honest.
- Commits `0591daf` and `c74d377` are trailer-free and pass `git show --check`.
  The current device and web typechecks, scoped lint, client/SSR build and full
  gate suite pass. The full gate run reports 1,086 tests, 66,347 expectations,
  16 automated gates passed and the two manual gates still outstanding.

## Worktree record

The current W9a source and evidence paths were clean before this re-review. I
modified only this review file by appending this section. I did not implement,
stage, commit, reset or rewrite anything. The shared worktree's unrelated lane
changes remain untouched.

# Re-review — Major R2 after `d131777`

## Verdict

**REQUEST_CHANGES — Major R2 remains open. Major R1 remains separately open and
is not waived.** Commit `d131777` closes the original wrong-branch, bare-test and
device-only archive-loop defects. The publication procedure still lacks one
necessary remote-history invariant, so its exact lease can safely detect a
concurrent move while still overwriting commits that were already remote-only
when Phase 1 began.

## Remaining Major finding

### Major R2.1 — the lease does not prove that the captured remote history is contained locally

`docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:149-159`
proves that the named local commits are ancestors of `OLD_HEAD`, then captures
the remote tip as `EXPECTED_REMOTE_HEAD`. It never proves that the captured
remote tip equals `OLD_HEAD` or is an ancestor of it. Phase 2 at lines 500-511
only proves that the remote has not moved *since that capture* before using the
captured value as the exact `--force-with-lease` expectation.

That leaves this accepted sequence:

1. `origin/main` already contains a commit not reachable from local
   `TARGET_BRANCH` when Phase 1 starts.
2. Phase 1 records that divergent remote commit as `EXPECTED_REMOTE_HEAD` and
   successfully rewrites only the stale local branch.
3. No one moves the remote before Phase 2, so the equality check and exact lease
   both pass.
4. The force-push replaces the remote with `NEW_HEAD`, dropping the pre-existing
   remote-only commit from the branch.

The lease command itself is correctly exact; the missing guard is before the
rewrite. The plan must fail unless `EXPECTED_REMOTE_HEAD` is proven to be equal
to, or an ancestor of, `OLD_HEAD` according to the owner's intended publication
policy. The current read-only state happens to be safe:
`origin/main=2305f4bbb09a42a07d872019d31a58c4ef3d98d8` is an ancestor of
`main=d13177779aa29c7573b2698fb7ff23a64e471d0e`. That observation is temporal,
however; it is not a guard in the owner procedure and may no longer be true when
the owner runs it.

## Audit disposition for the corrected plan

| Requested audit | Disposition | Independent check |
|---|---|---|
| Repository and branch assertions | **PASS** | Lines 108-127 assert the absolute repository root, fully clean tree/index, no active Git operation, explicit branch switch, current branch identity and unchanged target tip before rewriting. |
| Fail-fast Phase 1 | **PASS** | `set -euo pipefail` plus the `ZERR` trap stops a planted failed guard; the continuation marker was not reached. Both extracted zsh blocks pass `zsh -n`. |
| Recovery ref and automatic safety | **PASS with recovery-documentation caveat below** | The backup is created only after preconditions and is verified against `OLD_HEAD`; failure traps report rather than moving refs automatically. Main is untouched during detached construction and has an explicit backup after descendant replay. |
| Full archive verification | **PASS** | Lines 306-336 enumerate every rewritten commit, check both `packages/device/tsconfig.json` and `apps/web/tsconfig.json`, count iterations against `NEW_COUNT`, and inherit `pipefail`. A planted failure in an equivalent zsh `while` body triggered the trap and prevented continuation. |
| Full-tip verification | **PASS** | Lines 338-365 require typecheck, lint, tests, build and gates before writing the Phase 2 state file, then require the repository to remain clean. |
| Publication authority | **PASS** | Phase 1 never pushes; Phase 2 is explicitly owner-only and inert until the owner changes the range-diff approval sentinel. This complies with D-003 and `AGENTS.md`. |
| Publication lease | **PARTIAL — Major above** | Lines 500-516 correctly re-read the remote and use a fully qualified exact lease, but do not reject pre-capture remote divergence. |

## Minor findings

### Minor R2.a — Phase 2's `readonly` assignments mask parser failures

At `docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:463-483`,
`state_value` is invoked inside `readonly NAME="$(state_value NAME)"`. Under the
documented zsh mode, the `readonly` builtin returns success even when the command
substitution failed. I reproduced this with the exact function shape: a missing
state key printed the continuation marker and the shell exited 0. The later
branch/hash/remote checks appear to reject the resulting empty or multi-line
values, so I did not find a publication bypass; nevertheless the parser is not
actually fail-fast where the document says it is. Assign first, check status,
then mark the value readonly.

### Minor R2.b — recovery omits the detached, staged, no-operation state

`docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:407-440`
covers an active rebase, an active cherry-pick and a completed rebase. It does
not cover a failed amend or post-apply guard during detached construction, when
the index can contain the planned patch but neither `CHERRY_PICK_HEAD` nor a
rebase exists. A direct `git switch main` may then refuse because of staged
changes. The backup and target ref remain safe, so this is not another Major,
but the promised recovery section should name that state and give an inspect-
first, path-bounded cleanup route. The post-rebase restore block should also
make its clean-tree precondition executable rather than merely printing
`git status --short` before moving `main`.

## Major R1 remains open

No new production-browser proof is supplied or claimed by `d131777`. The
ordinary in-app route still has the documented blank-WebGL blocker and the
separate Chrome extension remains unavailable. The production pointer trace,
oblique press/release frames, exact rendered rest return and no-idle-frame proof
at `docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:23-42`
therefore remain required. This re-review does not waive or downgrade Major R1.

## Review and worktree record

- `d131777` changes only the owner-plan document, is trailer-free and passes
  `git show --check`.
- No implementation type/lint rerun was required for this documentation-only
  correction; no implementation path changed in the commit.
- I performed only read-only Git/remote queries, zsh syntax checks and harmless
  failure-semantics probes. I did not run a rebase, cherry-pick, ref move, push
  or any other rewrite/publication command.
- I appended only this disposition to the existing review. I did not edit
  implementation, stage, commit or reset anything.

# Final re-review — Major R2 and Minors after `c10188f`

## Scoped verdict

**APPROVE the Major R2 owner-plan safety correction. Minor R2.b is CLOSED.
Minor R2.a remains OPEN but non-blocking. Overall W9a remains
REQUEST_CHANGES solely because Major R1 production-browser proof is still open
and unwaived.**

This approval means the written rewrite/publication procedure is sufficiently
guarded for the owner to execute under D-003. It does **not** claim that the
owner has executed it or that historical commit `2ec0861` is already repaired.

## Disposition

### Major R2.1 — CLOSED

The missing pre-capture remote-history invariant now exists at
`docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:170-188`:

- Phase 1 fetches exactly `refs/heads/$TARGET_BRANCH` without tags;
- it independently reads the advertised branch tip;
- it requires `FETCH_HEAD` and the captured exact-lease hash to agree;
- it requires the captured remote commit object to exist locally; and
- before backup creation or detached construction, it rejects any remote tip
  that is neither equal to nor an ancestor of local `OLD_HEAD`.

The later check at lines 651-662 still re-reads the branch and uses the saved
hash in a fully qualified exact `--force-with-lease`. The two checks now cover
different races correctly: Phase 1 rejects pre-existing remote-only history;
Phase 2 rejects movement after the accepted snapshot. The current read-only
state also satisfies the policy: `origin/main` at
`2305f4bbb09a42a07d872019d31a58c4ef3d98d8` is an ancestor of local `main` at
`da768682b6bea8edc9d5b3082cd34338c869bd08`.

### Minor R2.a — OPEN, non-blocking

`docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:606-629`
removes the `readonly NAME="$(state_value NAME)"` form, but the uniqueness guard
is still not load-bearing. Each assignment invokes `state_value` as the left
side of an `||` list. In zsh that conditional context allows the function to
continue after `fail` returns from lines 609-612; `fail` does not return from
`state_value` itself.

The exact control-flow plant made `grep -c` report two `TARGET_BRANCH` keys and
made the value parser return `main`, corresponding to a valid value plus an
empty duplicate whose trailing newline is stripped by command substitution.
The function printed `ERROR: state key is missing or duplicated`, then returned
`main`, printed `PARSER_CONTINUED:main`, and exited 0. Thus the state parser can
still accept a duplicated key if its resulting scalar passes the downstream ref
validation. This is not a demonstrated publication bypass from the trusted
Phase 1 state writer, so it remains Minor; the guard should explicitly `return
1` after either failed parser invariant rather than relying on shell errexit.

### Minor R2.b — CLOSED

The recovery section at lines 474-581 now covers the previously omitted
detached, staged, no-operation state and the completed-rebase state:

- both recovery paths have inert owner-confirmation sentinels;
- the detached path asserts repository identity, detached HEAD and absence of
  active Git operations;
- it refuses every unstaged/staged path except
  `packages/device/src/index.ts`, refuses all untracked paths, and requires an
  actual planned change before restoring only that exact path;
- it verifies a fully clean tree before returning to the target branch; and
- completed-rebase recovery validates the exact old hash and backup ref, clean
  tree, target branch and no active operation before its explicitly owner-run
  ref restoration, then verifies the restored head and cleanliness.

That is inspect-first, path-bounded recovery rather than a broad destructive
fallback.

## Independent guard plants

No plant invoked Git rewrite, ref movement or publication. Git-affecting
commands were replaced by inert shell outcomes where necessary.

| Guard plant | Expected | Result |
|---|---|---|
| fetched tip differs from advertised lease snapshot | stop before backup | **red**, exit 1; backup marker not reached |
| advertised remote is divergent from local old head | stop before backup | **red**, exit 1; rewrite marker not reached |
| advertised remote is an ancestor of local old head | accept preflight | **green**, exit 0 |
| remote changes after Phase 1 snapshot | stop before push | **red**, exit 1; push marker not reached |
| duplicated state key followed by a valid scalar | parser must stop | **incorrectly green**, exit 0 — Minor R2.a remains |
| path-bounded cleanup sentinel remains `NO` | no restore | **red**, exit 1 |
| recovery sees an unexpected staged path | no restore | **red**, exit 1 |
| recovery sees only the expected staged path | permit only bounded restore | **green**, exact expected path reached |
| recovery sees no planned path change | no restore | **red**, exit 1 |
| completed-rebase restore sentinel remains `NO` | no ref move | **red**, exit 1 |

The Phase 1, path-bounded recovery, completed-rebase recovery and Phase 2
blocks all pass `zsh -n`. The unchanged full-range archive loop still checks
both `packages/device` and `apps/web`, counts every rewritten revision and
inherits `pipefail`; its previous fail-fast disposition remains valid.

## Major R1 remains separate and unwaived

Commit `c10188f` supplies no production-browser evidence and makes no such
claim. The in-app WebGL route remains blank and the separate Chrome extension
remains unavailable. The production pointer trace, oblique press/release
captures, exact rendered rest return and no-idle-frame proof at
`docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:23-42`
remain a Major blocker. Approval of R2 does not alter that disposition.

## Review and worktree record

- `c10188f` changes only the owner-plan document, is trailer-free and passes
  `git show --check` and `git diff --check`.
- No implementation type/lint run was required for this documentation-only
  correction; no implementation path changed in the commit.
- I ran only read-only Git/remote inspection, zsh syntax checks and inert
  failure-semantics plants. I did not fetch, rebase, cherry-pick, amend, restore,
  switch branches, create/move refs, push or otherwise execute the plan.
- I appended only this verdict. I did not edit implementation, stage, commit or
  reset anything.

# Final focused re-review — Minor R2.a after `0fd2620`

## Scoped verdict

**Minor R2.a is CLOSED. The Major R2 owner-plan correction and both associated
Minors are now APPROVED. Overall W9a remains REQUEST_CHANGES solely because
Major R1 production-browser proof is still open and unwaived.**

This disposition covers only the state-parser correction in `0fd2620`. It does
not claim that the owner has executed the rewrite/publication plan or that the
historical commit has already been repaired.

## Minor R2.a — CLOSED

At
`docs/workstreams/002-implementation-spine/evidence/w9a-owner-history-rewrite.md:606-620`,
both parser invariants now return explicitly from `state_value` after `fail`.
The assignments at lines 627-635 therefore cannot convert a duplicated or
empty state key into a successful scalar merely because the function is called
from the left side of an `||` list.

I reran the exact adversarial shape from the prior finding using a temporary
state file with these two records:

```text
TARGET_BRANCH=main
TARGET_BRANCH=
```

That is the previously dangerous valid-plus-empty duplicate: `sed` can still
produce a scalar that command substitution would normalize to `main`, but the
uniqueness check must reject it before value parsing. With the current function
and assignment control flow, the plant produced:

```text
ERROR: state key is missing or duplicated: TARGET_BRANCH
ERROR: could not parse TARGET_BRANCH
```

It exited **1**, and `PARSER_CONTINUED:main` was absent. A one-record control
containing only `TARGET_BRANCH=main` exited **0** and printed
`PARSER_ACCEPTED:main`. The added `return 1` is therefore load-bearing without
breaking valid state parsing.

## Major R1 remains separate and unwaived

Commit `0fd2620` changes no implementation or production-browser evidence.
The production pointer trace, oblique press/release captures, exact rendered
rest return and no-idle-frame proof remain required under the preceding Major
R1 disposition. Closing Minor R2.a does not waive or downgrade that blocker.

## Review and worktree record

- `0fd2620` changes only the owner-plan document, is trailer-free and passes
  `git show --check`.
- No implementation type/lint run was applicable to this documentation-only
  parser correction.
- The duplicate-key plant used only a temporary file and the parser's current
  shell control flow. It did not execute any Git command from the owner plan.
- I appended only this closure. I did not edit implementation, execute a
  rewrite, move refs, push, stage, commit or reset anything.

# Antagonistic review — wheel-readability correction (`b9cf6d9`, `3aebf7d`)

## Verdict

**REQUEST_CHANGES — 3 Major, 1 Minor.**

The correction preserves the binding `0.08 mm` wheel travel and keeps the new
response inside the wheel's physical material. Rest is genuinely dark, Select,
body, screen and glass do not receive the response, reduced motion clears it,
and no new idle frame loop exists. Those good boundaries do not make the result
acceptable. The response source does not continuously follow the real contact;
the accepted browser captures visibly contain the prohibited front-facing
oval/blob; and the evidence omits the required white-quarter case and any
temporal proof capable of falsifying shimmer.

The earlier W9a Major R1 remains separate and unwaived. The new evidence is
honestly scoped to this readability correction and expressly declines to close
the larger production-browser checklist.

## Major findings

### Major W9R-1 — the claimed continuous contact source snaps between mesh vertices

`packages/device/src/control-physics.ts:144-173` searches the immutable position
array for the nearest vertex, then publishes that vertex's deformed position and
normal as the light source sample. The actual pointer contact is discarded after
the nearest-neighbour search. With the production 128 × 24 wheel tessellation
(`packages/device/src/front-control-geometry.ts:9-10` and
`packages/device/src/Device.tsx:329-338`), that is a quantised mesh sample, not
the continuous body-local pose promised by
`packages/device/src/wheel-readability.ts:53`.

I swept the current production geometry through 36,001 contacts at 0.01°
increments. The published source remained byte-identical for as much as 2.07°,
then jumped by up to `3.447961` model pixels in one 0.01° input step; its XY
error relative to the real contact reached `1.746024` model pixels. The nominal
angular mesh step is 2.8125°. That discontinuity is large enough to move the
grazing cone independently of the continuously recomputed deformation and is a
concrete shimmer mechanism during a drag.

The tests do not exercise this contract. The four-cardinal pose test at
`packages/device/src/wheel-readability.test.ts:63-108` bypasses
`readabilitySampleAt` by manufacturing already-sampled points, while the
controller test at `packages/device/src/control-physics.test.ts:195-217` asks
only that 0° and 90° differ. The existing signed-angle seam test proves the
deformed geometry is continuous at one seam; it does not prove the readability
source is continuous between vertices. This fails both real contact-following
and the explicit no-shimmer requirement.

### Major W9R-2 — the committed hold frames show the forbidden front-facing blob, and the shader gate permits it

The visual failure is present in the correction's own accepted evidence:

- `evidence/w9a-readability/white-front-bottom-hold.png` shows a large, flat,
  warm oval around the lower wheel contact;
- `evidence/w9a-readability/black-front-bottom-hold.png` shows the same local
  disc as a dark oval; and
- `evidence/w9a-readability/black-quarter-bottom-hold.png` preserves it at the
  oblique pose rather than resolving it into a restrained grazing edge.

This is not added physical travel—the `0.08 mm` gate holds—but it is still the
front-facing blob the owner explicitly prohibited. The implementation explains
why. `packages/device/src/wheel-readability.ts:127-145` sends the synthetic
incident light through Three's `RE_Direct`. In the pinned Three source,
`RE_Direct_Physical` accumulates both GGX specular and Lambert diffuse. The test
at `packages/device/src/wheel-readability.test.ts:151-157` claims protection by
asserting that this source file does not contain the literal `directDiffuse`,
but the diffuse addition is hidden inside the function it deliberately calls.
The white wheel therefore receives a broad warm diffuse contribution over the
elliptical contact footprint, exactly as the capture shows.

The no-blob gate is not load-bearing. In an isolated `b9cf6d9` archive I
replaced the slope term
`geometryNormal - webpodWheelRestNormal` with plain `geometryNormal`, the
plausible regression that turns the local term into ordinary front lighting.
All 19 readability/controller tests still passed. The production code currently
contains the subtraction, but neither the deterministic suite nor the accepted
visual criterion rejects the prohibited appearance it was meant to prevent.

### Major W9R-3 — the required browser evidence matrix and temporal proof are incomplete

The production provenance at
`docs/workstreams/002-implementation-spine/evidence/w9a-readability.md:40-62`
is internally consistent and correctly attributed: it names the ordinary
`/_spike/device` T1 `CompositeDevice` path, a real Chrome pointer sequence and
the changed panel selection, and it honestly rejects the blank in-app T3 canvas.
I reproduced that caveat: the local route rendered its ordinary controls and
state attributes, but mounted no observable canvas in the in-app browser and
logged no console error. The saved rest/released artifacts are also honest:
white-front and black-quarter pairs are byte-identical.

What is missing is binding acceptance coverage. The capture index at
`docs/workstreams/002-implementation-spine/evidence/w9a-readability.md:68-85`
contains black-front, white-front and black-quarter runs, but no white-quarter
run at all. White is the colourway in which the blob is strongest, so black
quarter cannot stand in for it. All accepted artifacts are stills; there is no
continuous pointer recording or sampled frame sequence that could reveal the
source plateaus/jumps from Major W9R-1, and no production-browser idle-frame
measurement. Thus the evidence cannot establish the explicitly requested
black + white, front + quarter matrix or the no-shimmer claim.

## Minor finding

### Minor W9R-a — response teardown is correct but its cleanup assertion is not load-bearing

`packages/device/src/control-physics.ts:320-328` correctly clears the wheel
response when its geometry binding is detached. I removed only
`readability?.clear()` at line 324 in an isolated archive and reran the complete
readability/controller set: all 19 tests remained green. Pointer release,
cancel, lost-capture, blur and reconciler unmount are well covered through the
input path, but no test proves that replacing/unmounting the bound wheel clears
the material response independently. This is a gate hole rather than a current
runtime defect, hence Minor.

## Adversarial verification

| Check or plant | Result |
| --- | --- |
| 36,001-point, 0.01° production-geometry sweep | **red** — up to 2.07° source plateau and 3.447961 px jump |
| replace rest-normal delta with plain live normal | **incorrectly green** — 19/19 focused tests passed |
| remove detach-time response clear | **incorrectly green** — 19/19 focused tests passed |
| exact reduced-motion clear path | green; direct feedback remains, release clears immediately with no frame |
| exact 15–360 Hz release sweep | green; completion remains duration-based and bounded at every rate |
| pointer mouse/touch/pen, release/cancel/lost-capture/blur/unmount | green; mounted production-handler tests pass |
| permanent response-owned loop/source scan | green; none exists; only the bounded controller release owns rAF |
| rest artifact identity | green; white-front and black-quarter rest/released files are byte-identical |

## Verified clean

- `CONTROL_TRAVEL.wheelMm` remains exactly `0.08`; no static recess or deeper
  press was introduced.
- Geometry and analytic normals deform locally in device space and return to
  the immutable W8 rest arrays. Select keeps its separate, restrained travel.
- The response material is created once for `device-wheel`; body, Select,
  screen, glass and the label decal do not receive it.
- Uniform position/direction are transformed through the model-view transform,
  so the local response rotates with the device rather than with the camera,
  screen or UVs.
- Rest irradiance is exactly zero. Release, reduced motion, disposal and the
  current detach implementation clear it.
- `frameloop="demand"` remains intact. Held contact invalidates once per input;
  only the bounded return-to-rest animation requests frames; there is no
  response-owned `useFrame`, timer or permanent rAF.
- The commits do not alter detent physics, fixed hit geometry, panel/screen
  alignment or composite text-selection suppression.
- Both commits are trailer-free and pass `git show --check`.

## Gates and worktree record

- Device and web TypeScript checks: pass.
- Scoped ESLint: pass.
- `bun test packages/device`: 202 pass, 0 fail, 62,503 expectations.
- Focused lifecycle/readability suite: 42 pass, 0 fail.
- `bun run gates`: 16 automated pass, 0 automated fail; 1,098 repository tests
  pass; U14 and U15 remain manual.
- I inspected the current web interface rules, interface-craft direct-manipulation
  criteria, the pinned Three physical-light implementation and R3F demand-frame
  guidance. They reinforce continuous spatial response, reduced-motion cleanup
  and zero idle work; they do not excuse the findings above.
- I appended only this section. I did not edit implementation, stage, commit,
  reset, rewrite refs or push. The shared worktree's unrelated lane changes and
  pre-existing untracked review remain otherwise untouched.

# Re-review — wheel-readability corrections (`8a3a104`, `25178b8`)

## Verdict

**REQUEST_CHANGES — 1 correction Major remains.** Major W9R-1, Major W9R-3
and Minor W9R-a are closed: the source is genuinely analytic and continuous,
the correction evidence now covers black and white at front and quarter poses
with a real production pointer trace and a zero-idle trace, and detach cleanup
has an independent failing plant. Major W9R-2 is only partially closed. The
diffuse `RE_Direct` route and plain-normal admission are gone, but the replacement
does not evaluate a specular BRDF or the wheel material at all, and the accepted
frames still display the prohibited contact-shaped blob.

The earlier, full-W9a Major R1 remains separate and unwaived. This new evidence
materially proves the wheel-readability path, but it does not supply the Select
press/release sequence or the key-only/fill-only/combined macros still listed in
`evidence/w9a-browser.md:28-40`.

## Disposition of the readability findings

| Prior finding | Status | Re-review evidence |
| --- | --- | --- |
| Major W9R-1 — nearest-vertex source snapping | **CLOSED** | `control-physics.ts:162-197` samples the analytic shell at the actual contact. An independent 360,001-angle sweep and 100,001-point radial sweep had zero repeated samples; angular steps stayed `0.001287235–0.001288834` px, radial steps `0.000646123–0.000646771` px, normals remained unit to `2.22e-16`, and the signed seam closed to `1.78e-14` px. Quantisation and a distinct seam-direction flip both fail `control-physics.test.ts:269-305`. |
| Major W9R-2 — diffuse/blob path and non-load-bearing normal guard | **PARTIALLY CLOSED; Major remains** | `RE_Direct` and diffuse accumulation are absent, and the exact plain-`geometryNormal` plant now fails `wheel-readability.test.ts:128-168`. The new raw accumulator write still bypasses the material BRDF and the captures still show a blob; details below. |
| Major W9R-3 — incomplete browser/temporal evidence | **CLOSED for the readability correction** | All twelve black/white × front/quarter rest/hold/release PNGs exist and were visually inspected. Thirteen one-degree seam crops move continuously. The Chrome traces identify the ordinary `/_spike/device` route, `CompositeDevice`, R3F `onPointerDown`, `click-wheel-input.tsx` and `ControlPhysicsController.wheelContact`; the paired idle trace has zero animation-frame, begin/draw-frame or paint events. |
| Minor W9R-a — detach clear ungated | **CLOSED** | `control-physics.test.ts:461-488` distinguishes current from stale detach. Deleting only the current binding's `readability?.clear()` now fails 1 of 16 focused tests. |

## Remaining Major — the “specular” response is an additive mask, not a material response, and still reads as a blob

`packages/device/src/wheel-readability.ts:128-142` computes a cone/range/slope
mask and adds its RGB value directly to
`reflectedLight.directSpecular`. The destination variable's name does not make
that value specular. The injected code never reads `material`,
`geometryViewDir`, roughness, Fresnel, clearcoat or `BRDF_GGX`. An independent
inspection of the installed fragment block returned `usesMaterial=false`,
`usesView=false` and `usesGGX=false`.

That is materially different from Three's pinned physical path at
`/Users/vinicius/code/agentic-context/three.js/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js:487-529`,
which computes incidence, evaluates `BRDF_GGX(lightDir, viewDir, normal,
material)`, and applies multi-scattering compensation before accumulating the
specular result. The current response consequently ignores the real black and
white wheel finishes—most visibly their very different roughness values at
`packages/device/src/materials.ts:118-125` and `:141-148`. It is a body-local,
slope-shaped additive color mask placed in a specular bucket, not the binding
lighting/material response.

The visual evidence shows the consequence rather than rescuing it. The lower-
right contact in `black-front-hold.png` is a broad bright pool surrounding a
dark oval; `black-quarter-hold.png` preserves the same pool obliquely. The white
front and quarter holds retain a fainter oval. More decisively, the enlarged
seam crops `frame-174.png` through `frame-186.png` show a soft circular halo
travelling around the left side. It moves smoothly now—so the shimmer finding
is closed—but it is still the front-facing blob the owner prohibited.

The purported no-blob test is not load-bearing against this defect class.
Keeping its expected slope-gated line intact and adding a second raw line,
`reflectedLight.directSpecular += webpodWheelGrazingColor *
webpodWheelGrazingIrradiance`, leaves all 6/6 readability tests green. The test
proves the absence of the old diffuse spelling and the presence of one desired
substring; it does not prove that all optical energy is spatially gated or
material-evaluated. This remains Major because it fails the binding correction
method and the accepted appearance, not merely because the test could be
stronger.

## Browser evidence audit

- All twelve stills are real 1280 × 1100 RGB PNGs with a Google/Skia profile.
  Each rest/released pair is byte-identical at the documented SHA-256, while
  each hold differs.
- All thirteen 400 × 400 temporal crops have unique hashes. Visual inspection
  found continuous motion through the signed seam rather than the former
  two-degree source plateau or a one-frame jump.
- The active raw trace reproduces the documented 100,671 events: 472
  `RequestAnimationFrame`, 273 `FireAnimationFrame`, 199 cancellations, 426
  begin frames and 199 draw frames. Its stacks name the production route and
  the real click-wheel pointer/controller chain.
- The idle trace spans 2.069 seconds in the same Chrome process and contains
  zero request/fire/cancel animation frames, begin/draw frames,
  `AnimationFrame::Render`, `AnimationFrame::Presentation` or paint events.
- The former proof-only control-pose names remain absent from production source;
  their only hits are negative assertions. The pre-existing device-preview API
  configures colourway/orientation and does not inject a held physics state.
- This closes Major W9R-3's correction-specific matrix and temporal/idle gaps.
  It does **not** silently close the older full-W9a browser checklist:
  `evidence/w9a-browser.md:5` still truthfully says no complete W9a interaction
  set is accepted, and its Select/light-isolation items remain uncaptured.

## Adversarial verification

| Independent check or plant | Result |
| --- | --- |
| 360,001 angular + 100,001 radial production-source samples | green; no plateaus, bounded steps, finite unit normals, seam closure `1.78e-14` |
| quantise analytic source point to integer model pixels | **red** — 1 failure, 15 pass |
| flip tangent direction only across the signed seam | **red** — 1 failure, 15 pass; maximum step became `42.73077` px |
| replace live/rest normal delta with plain live normal | **red** — 1 failure, 5 pass |
| route the correction into `directDiffuse` | **red** — 1 failure, 5 pass |
| delete current detach-time response clear | **red** — 1 failure, 15 pass |
| add a second ungated additive `directSpecular` term | **incorrectly green** — 6/6 pass; no-blob/material-response gate hole |

## Verified clean and worktree record

- Wheel travel remains exactly `0.08 mm`; the analytic ring and existing gap
  floor share the transient height field and restore exactly. No static recess
  or Select/body/screen response binding was introduced.
- Demand rendering, reduced motion, pointer release/cancel/lost-capture/blur/
  unmount handling, fixed hit geometry, text-selection scoping and detent
  physics remain unchanged and green.
- Device and web TypeScript pass; scoped lint passes; `bun test packages/device`
  passes 205/205 with 62,517 expectations; `bun run gates` passes 11/11
  typechecks, repository lint, 1,101 tests and all 16 automated gates; the
  client/SSR build passes with only the existing chunk-size advisory.
- Both commits are trailer-free and pass `git show --check`.
- I appended only this re-review section. All mutation plants ran in isolated
  temporary archives. I did not edit implementation, stage, commit, reset,
  rewrite refs or push. The shared worktree's unrelated changes remain intact.

# Final re-review — material BRDF and production lifecycle (`3a5ba00`, `9c5dea6`)

## Verdict

**REQUEST_CHANGES — 1 Major remains.** The rendering defect itself is closed:
the current contact card supplies incident energy to Three 0.185.1's real
material-aware GGX multiscatter and clearcoat paths, the old raw additive/
diffuse/emissive response is absent, and the complete current wheel captures no
longer show the prohibited broad front-facing blob. The older W9a Major R1
production-browser proof is also closed by the new combined-light Select
lifecycle matrix together with the already accepted production wheel trace and
idle trace.

The correction is not approvable yet because its runtime “exhaustive” shader
guard is not exhaustive. A compile-valid lvalue swizzle permits the exact raw
additive energy path this correction is meant to make impossible, while the
focused suite remains completely green.

U14/thumb occlusion and the both-colourway aesthetic decision remain owner-only
under H-5/H-6. This review does not clear either one.

## Remaining Major

### Major W9R-2.1 — the fail-closed output parser ignores swizzled accumulator writes

`opticalOutputWrites` at
`packages/device/src/wheel-readability.ts:171-174` recognizes an output only when
the accumulator name is followed immediately by `=` or `+=`. It therefore does
not recognize legal GLSL lvalues such as `reflectedLight.directSpecular.rgb`,
`clearcoatSpecularDirect.rgb` or `totalEmissiveRadiance.rgb`. The count comparison
at lines 204-213 consequently cannot make the “exactly two writes” claim true for
all valid writes. The current plants at
`packages/device/src/wheel-readability.test.ts:195-252` exercise only the bare,
unswizzled accumulator spelling.

I proved the escape in an isolated archive of `3a5ba00`. I inserted exactly one
compile-valid line after the legitimate GGX contribution and asserted that the
edit landed once before running the suite:

```glsl
reflectedLight.directSpecular.rgb +=
  webpodWheelGrazingColor * webpodWheelGrazingIrradiance;
```

Result: **8 pass, 0 fail, 83 expectations**. The raw term ignores incidence,
roughness, view direction, Fresnel and both BRDFs; it can recreate the rejected
blob while coexisting with the exact required GGX line. Both the runtime guard's
TSDoc at `packages/device/src/wheel-readability.ts:177-180` and the evidence claim
at `docs/workstreams/002-implementation-spine/evidence/w9a-material-brdf.md:49-65`
therefore overstate the structural guarantee. This is Major because exhaustive
rejection of an extra accumulator write is a binding condition of this correction,
and the guard passes a plausible implementation of the prohibited defect.

## Material-path disposition

The implementation half of the prior optical Major is **CLOSED**:

- `packages/device/src/wheel-readability.ts:145-151` computes base and clearcoat
  `dot(N,L)` incidence and passes the gated incident energy to
  `BRDF_GGX_Multiscatter(lightDir, geometryViewDir, geometryNormal, material)` and
  `BRDF_GGX_Clearcoat(lightDir, geometryViewDir, geometryClearcoatNormal,
  material)` respectively.
- In the installed Three 0.185.1 shader, `BRDF_GGX_Multiscatter` calls
  `BRDF_GGX`, reads `material.roughness`, `specularColorBlended`, `specularF90`
  and the view/light DFG terms, and applies the multiscatter compensation. The
  base GGX path computes the half vector, Schlick Fresnel, Smith-correlated
  visibility and GGX distribution. The clearcoat path independently reads
  clearcoat F0/F90/roughness and uses the real view direction and clearcoat
  normal.
- The current custom block contains no raw additive output, diffuse accumulator,
  Lambert call, emissive term or generic `RE_Direct(...)` call. Its surrounding
  `#if defined(RE_Direct)` is only a compile-feature guard.
- Distinct plants that replaced the real view direction with the normal, replaced
  multiscatter with the simpler BRDF, or collapsed white roughness onto black all
  went red. The black `0.44`/`0.08` and white `0.8`/`0.035` roughness/clearcoat
  differences are therefore consumed by one common physical path rather than a
  colourway response branch.

## Visual evidence and older Major R1 disposition

I visually inspected all wheel and Select rest/hold/released captures and the
temporal seam sequence. The artifact set is complete as claimed: twelve wheel
PNGs, twelve Select PNGs and thirteen temporal PNGs; the stills are genuine
1280×1100 RGB PNGs, the temporal crops are genuine 400×400 RGB PNGs, all thirteen
temporal hashes are unique, and the documented endpoint and black-front
rest/release hashes reproduce.

The held wheel cue is now a small asymmetric edge crescent whose response differs
with the two real finishes. The old broad circular/oval pool is absent in black
and white at both front and quarter poses. The thirteen seam frames move that
crescent continuously rather than showing a front-facing plateau or jump. This
closes the visual half of Major W9R-2; final aesthetic acceptance remains H-6.

The older full-W9a Major R1 is **CLOSED**. The new `select/` matrix shows the
ordinary `/_spike/device` `CompositeDevice` in black and white, front and quarter,
through rest, held Select travel and release. The proof-only pose API remains
absent from production; its only source hits are negative tests. Combined with
the prior production wheel pointer trace, mounted Select lifecycle tests, exact
CPU rest gates and zero-idle production trace, this supplies the dispatch's
owner-visible interaction and combined-feel evidence without a synthetic pose
seam.

The limitation is narrower and must remain explicit: Select was captured only
under the combined rig. Key-only and fill-only interactive Select macros remain
unproved because the existing light-isolation query renders the diagnostic
`DeviceCanvas` path and would bypass the production pointer chain. The binding W9
dispatch requires the combined feel; it does not require isolated key/fill
macros. My prior re-review incorrectly treated the implementer's checklist in
`evidence/w9a-browser.md` as if it were the dispatch. That authority error is
mine, and it is corrected here rather than silently waived.

## Minor findings

### Minor W9R-b — the old browser-status document now contradicts the accepted evidence

`docs/workstreams/002-implementation-spine/evidence/w9a-browser.md:5` still says
that no W9a browser capture is accepted, and lines 28-40 still label the complete
acceptance list open. That was truthful before `9c5dea6`, but it now conflicts
with `evidence/w9a-material-brdf.md:68-122`. Mark the older status as historical/
superseded and preserve only its rejected-synthetic provenance and the honest
isolated-light limitation.

### Minor W9R-c — the scoped expectation count does not reproduce

`docs/workstreams/002-implementation-spine/evidence/w9a-material-brdf.md:126-131`
records the device package as 62,539 expectations. Two independent current runs
of `bun test packages/device` produced 207 pass, 0 fail and **62,542** expectations.
The full gate's 1,103 tests and 66,484 expectations do reproduce exactly, so this
is an evidence-number correction rather than a behavioral failure.

## Adversarial verification

| Independent check or plant | Result |
| --- | --- |
| current GGX/multiscatter/clearcoat source trace against installed Three 0.185.1 | green; real material roughness, view, Fresnel, distribution, visibility and compensation are used |
| replace `geometryViewDir` in the base response | **red** — 2 focused failures |
| replace `BRDF_GGX_Multiscatter` with the non-multiscatter path | **red** — 2 focused failures |
| collapse white roughness `0.8` to black roughness `0.44` | **red** — 1 focused failure |
| add the exact prior bare raw `directSpecular` line | **red** — current in-test plant rejects it |
| add raw `reflectedLight.directSpecular.rgb += ...` beside the valid GGX line | **incorrectly green** — 8/8 focused tests pass; remaining Major |
| proof-only pose/API grep | green; production hits 0, negative test hits only |
| visual matrix/signatures/hashes | green; 12 wheel + 12 Select + 13 temporal genuine PNGs, all claimed dimensions present |

## Gates and worktree record

- Device and web TypeScript: pass.
- Scoped ESLint: pass.
- Focused readability suite: 8 pass, 0 fail, 83 expectations.
- `bun test packages/device`: 207 pass, 0 fail, 62,542 expectations.
- `bun run gates`: 11/11 typechecks, repository lint, 1,103 tests, 66,484
  expectations and all 16 automated gates pass; U14/U15 remain manual.
- Client and SSR build: pass; the existing large-client-chunk advisory remains
  non-failing.
- Commits `3a5ba00` and `9c5dea6` are trailer-free and pass `git show --check`.
- I appended only this section. Mutation work ran in isolated temporary archives.
  I did not edit implementation, stage, commit, reset, rewrite refs or push. The
  shared worktree's unrelated changes remain untouched.

# Final focused re-review — swizzled output guard (`dc77331`)

## Verdict

**REQUEST_CHANGES — 1 Major remains.** Commit `dc77331` closes the exact
same-line `.rgb +=` reviewer plant, closes a distinct same-line `.gr +=` plant,
marks the stale browser status historical/superseded, and corrects the focused
and device-package expectation counts. The guard remains fail-open to the same
valid swizzled assignment when ordinary GLSL whitespace includes a newline.

## Remaining Major

### Major W9R-2.2 — newline-separated swizzles disappear from the “fail-closed” scan

The candidate suffix in
`packages/device/src/wheel-readability.ts:194-200` is explicitly
`[^;\n{}]*?`. If a newline appears between the optical accumulator and its
swizzle, `matchAll` returns no candidate for that write. Because the scanner
does not see an invalid candidate, it also does not take the intended
fail-closed branch at lines 203-213; the write is silently omitted from both
the custom-block and whole-shader counts at lines 247-254.

I planted this exact raw term once in an isolated `dc77331` archive:

```glsl
reflectedLight.directSpecular
  .gr += webpodWheelGrazingColor.rg * webpodWheelGrazingIrradiance;
```

The focused suite remained **8 pass, 0 fail, 86 expectations**. I independently
compiled the same struct-field/newline/`.gr +=` form with Chrome
152.0.7977.65's WebGL fragment compiler; compilation succeeded with an empty
info log. This is therefore not hypothetical malformed syntax. It adds raw
ungated energy to the real specular accumulator while preserving the two exact
required GGX statements and can reintroduce the rejected contact blob.

The new deterministic plants at
`packages/device/src/wheel-readability.test.ts:206-255` cover bare and swizzled
assignments only when the accumulator, suffix and operator share one line. The
runtime comment at `packages/device/src/wheel-readability.ts:174-180` calls the
scanner fail-closed, and the evidence still claims exactly two optical writes at
`docs/workstreams/002-implementation-spine/evidence/w9a-material-brdf.md:49-65`.
Ignoring a valid form instead of rejecting it contradicts both claims. This
remains Major for the same binding reason as W9R-2.1: an extra raw accumulator
write must be structurally rejected, not merely rejected under one formatting.

## Prior finding disposition

| Prior item | Status | Independent result |
| --- | --- | --- |
| exact reviewer `reflectedLight.directSpecular.rgb += ...` plant | **CLOSED** | edit asserted once; focused suite red with 6 pass / 2 fail |
| alternate same-line `reflectedLight.directSpecular.gr += ...` plant | **CLOSED** | edit asserted once; focused suite red with 6 pass / 2 fail |
| fail-closed optical-write invariant | **OPEN · Major** | newline-separated `.gr +=` compiled in Chrome and left 8/8 focused tests green |
| stale `w9a-browser.md` status | **CLOSED** | lines 1-13 now identify the document and verdict as historical/superseded; lines 36-53 separate the closed combined-light lifecycle from the still-unproved key/fill isolation |
| focused/device expectation counts | **CLOSED** | current runs reproduce 8/8 and 86 expectations, plus 207/207 and 62,545 expectations |

## Gates and worktree record

- Device TypeScript: pass.
- Scoped ESLint: pass.
- Focused readability suite: 8 pass, 0 fail, 86 expectations.
- `bun test packages/device`: 207 pass, 0 fail, 62,545 expectations.
- `bun run gates`: 11/11 typechecks, repository lint, 1,103 tests, 66,487
  expectations and all 16 automated gates pass; U14/U15 remain manual.
- `dc77331` is trailer-free and passes `git show --check`.
- Repo law explicitly replaces Neuve/Kanban with this workstream's document
  tracker, so no Neuve command or ticket mutation was applicable.
- Every mutation ran in an isolated temporary archive and asserted its edit
  landed exactly once. I appended only this section; I did not edit
  implementation, stage, commit, reset, rewrite refs or push. The shared
  worktree's unrelated changes remain untouched.

# Final-final focused re-review — multiline output guard (`2ea2398`)

## Verdict

**APPROVE — Major W9R-2.2 is closed; no Critical or Major remains in this
focused lane.** I independently planted each requested form exactly once in a
separate `2ea2398` archive. The exact multiline
`reflectedLight.directSpecular` + `.gr +=`, multiline bare `+=`, multiline
`clearcoatSpecularDirect.zyx +=`, and multiline
`totalEmissiveRadiance.pts +=` plants each made the focused suite red at **6
pass / 2 fail / 60 expectations**. A control containing the same multiline
`.gr +=` text in a block comment and an emissive `.rgb +=` line comment stayed
green at **8 pass / 0 fail / 91 expectations**. The source now strips comments
before scanning and admits newlines only inside semicolon/brace-bounded
candidates (`packages/device/src/wheel-readability.ts:196-223`); the independent
results show both halves are load-bearing rather than a comment false positive.

One non-blocking evidence correction remains: `w9a-material-brdf.md:62,127-130`
still says twelve plants, 86 focused expectations and 62,545 package
expectations. The current committed suite has sixteen plants and independently
reproduces **8/91** focused plus **207/62,550** package-wide. This is the same
Minor evidence-number class previously recorded, not a behavior failure.
Device TypeScript, scoped ESLint, `git show --check`, and the trailer audit pass.
I appended only this verdict; I did not edit implementation, stage, commit,
reset, rewrite refs or push.

# Docs-only count correction (`610332a`)

## Minor disposition

**CLOSED.** Commit `610332a` changes only
`docs/workstreams/002-implementation-spine/evidence/w9a-material-brdf.md` and
correctly records sixteen adversarial plants, **8 pass / 0 fail / 91
expectations** for the focused suite, and **207 pass / 0 fail / 62,550
expectations** package-wide. I reproduced both test counts independently and
counted sixteen plant entries in the committed test array. `git show --check`
and the trailer audit pass. No implementation was changed; I appended only this
Minor closure and did not stage or commit.

# Independent review — owner depth-axis correction (`2d0795e`, `9a4a981`)

## Verdict

**REQUEST_CHANGES — 1 Major, 1 Minor.** The production geometry is now genuinely
device-local-Z-only: an independent 15,552-configuration sweep checked
49,159,872 vertex samples across the visible ring and seam floor, with exact
immutable X/Y, bounded non-positive Z, monotonic depth, analytic normals and
byte-identical boundaries. All four requested mutation classes turn red. The
saved white three-quarter held image nevertheless still reads as a broad
travelling contact stamp, which the owner made an explicit rejection condition.

## Major finding

### Major W9R-3 — the real Z-only basin still renders as the prohibited broad contact stamp

The implementation mechanism is no longer the rejected lateral warp:
`packages/device/src/control-physics.ts:245-256` copies every production vertex
X/Y from immutable rest data and lowers only Z, while lines 265-273 derive the
normal analytically from that scalar field. The footprint remains a
5.5 mm × 8 mm ellipse (`packages/device/src/control-physics.ts:26-34`) and its
normal response follows the full compact field at lines 207-218.

The visual result still fails the binding owner criterion. In
`docs/workstreams/002-implementation-spine/evidence/w9a-depth-only/white-three-quarter-held.png`,
the held lower-right contact appears as a broad, multi-band diagonal smear
covering a substantial portion of the wheel. It is absent from
`white-three-quarter-rest.png` and returns exactly to rest after release, so it
is attributable to the active basin rather than static scene lighting. The
black quarter-held frame carries the same shape at lower contrast. This reads
as a travelling lateral warp/contact stamp rather than a restrained shallow
local depression.

The browser driver deliberately captures that held oblique state at
`apps/web/tests/wheel-depth-evidence.e2e.ts:136-144`, and the evidence text
calls the change acceptable at
`docs/workstreams/002-implementation-spine/evidence/w9a-depth-only.md:105-107`.
That claim does not survive visual inspection. The stronger statement in
`docs/workstreams/002-implementation-spine/decisions/w9a.md:203-206`—that the
ordinary material response “cannot stamp a travelling oval”—is also disproved
by the committed capture. Removing the auxiliary shader was necessary, but it
did not by itself satisfy the perceptual requirement.

This remains Major because the prompt makes the rendered reading, not merely
the displacement axis, binding. The correction must preserve the now-proven
immutable X/Y and depth cap while producing held front/quarter evidence that no
longer presents a broad moving stamp.

## Minor finding

### Minor W9R-3.a — the committed evidence is reproducible from the correction commit but is not self-attributing

`docs/workstreams/002-implementation-spine/evidence/w9a-depth-only/summary.json:20-21`
records both `reviewedCommit` and `reviewedTree` as `null`. The documented
command at `docs/workstreams/002-implementation-spine/evidence/w9a-depth-only.md:81-85`
does not set `W5B_SOURCE_COMMIT`, and the driver asserts only
`health.current === health.expected` at
`apps/web/tests/wheel-depth-evidence.e2e.ts:87-98`. That proves a mutable
snapshot stayed stable during one run, not which Git object supplied it.

I independently reran the production route from immutable commit
`2d0795e8ad38da3dfe347e42b5299aaeeb403fc8`, tree
`bd0458387536e69b267a1be9302f3ca4436a8070`, and source digest
`8de11af1d3cf96c08750683be62e4498c99e9423903366a1b0a916863fc6989f`.
The run passed and all twelve generated PNG hashes exactly matched the committed
captures. That independently recovers the attribution and prevents this from
becoming a second blocking finding, but the durable summary should record and
assert those identities directly.

## Geometry, removal and lifecycle disposition

- **Depth-only geometry: closed.** The independent sweep covered 144 contact
  angles × 9 radii × 6 depths on both production geometries. All 49,159,872
  sampled vertices retained X/Y with `Object.is`; no Z sample moved toward the
  viewer or exceeded 0.08 mm; depth was monotonic; 1,563,905 live-normal samples
  matched an independent analytic oracle within 2e-6.
- **Silhouette and seams: closed.** Inner/outer boundary positions and normals
  stayed byte-identical at every sample, including the seam-floor sibling.
  Existing release tests restore both arrays exactly, and all four committed
  rest/release browser pairs are byte-identical.
- **Auxiliary optical path: closed.** The former
  `wheel-readability.ts` and its test are deleted; old response symbols,
  attributes, hooks and package exports have zero production hits.
  `Device.tsx:583-590` creates the ordinary wheel polycarbonate material and
  has no contact shader hook. The generic polycarbonate transport hook is
  unchanged and has no contact state.
- **Demand/reduced motion: closed.** There is no `useFrame` poll. Holding
  performs one invalidation; only release requests bounded frames; reduced
  motion restores and invalidates once; disposal cancels and settles. The
  15–360 Hz and frozen-clock gates pass.
- **Input, hit testing, selection and SFX: unaffected.** The correction changes
  none of the click-wheel input, composite runtime, selection or audio files.
  Mounted mouse/touch/pen, release/cancel/lost-capture/blur/unmount and Enter
  lifecycle tests pass. Selection remains gesture-scoped, and the authoritative
  detent/clicker suites remain green.

## Adversarial verification

| Independent check or plant | Result |
| --- | --- |
| dense ring + seam-floor angle/radius/depth sweep | **green** — 15,552 configurations, 49,159,872 vertex samples |
| local X displacement | **red** — 4 focused failures |
| radial X/Y scaling | **red** — 5 focused failures |
| boundary Z and normal motion | **red** — 3 focused failures |
| reinstated wheel material shader cue | **red** — 1 focused failure |
| focused production physics suite | 13 pass, 0 fail, 394 expectations |
| mounted pointer/keyboard lifecycle | 23 pass, 0 fail, 92 expectations |
| selection/composite lifecycle | 5 pass, 0 fail, 27 expectations |
| detent/runtime/audio regression suite | 39 pass, 0 fail, 234 expectations |
| immutable production browser rerun | 1 pass; all 12 PNG hashes match committed evidence |

## Gates and worktree record

- Device and web TypeScript: pass.
- Scoped ESLint: pass.
- `bun test packages/device`: 196 pass, 0 fail, 62,709 expectations.
- `bun run gates`: 11/11 typechecks, repository lint, 1,092 tests, 66,651
  expectations and all 16 automated gates pass; U14/U15 remain manual.
- Client and SSR production build: pass; the existing large-client-chunk
  advisory remains non-failing.
- Commits `2d0795e` and `9a4a981` are trailer-free and pass
  `git show --check`.
- Every mutation ran in a separate temporary archive and asserted that its edit
  landed exactly once. I appended only this section; I did not edit
  implementation, stage, commit, reset, rewrite refs or push. Existing unrelated
  shared-worktree changes remain untouched.
