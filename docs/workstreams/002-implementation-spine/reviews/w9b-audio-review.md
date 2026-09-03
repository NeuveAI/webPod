# W9b interaction SFX — antagonistic review

**Reviewed:** 2026-09-01
**Requested commit range:** `0c1f6fc` through `b013871`
**Integration inspected at:** `80186ed` (including the later physical Select bridge)
**Verdict:** **REQUEST_CHANGES** — 3 Major, 4 Minor

The state-owned feedback budget is the right architecture and most of its local
properties survive attack. This does not pass as a browser audio lifecycle yet.
A newer trusted activation can be overwritten by an older suspend, duplicate
bindings replay one authoritative sequence more than once, and the required
audible/product-quality result has never been heard or recorded by a human.

## Major findings

### Major 1 — an older pending suspend can defeat a newer trusted activation

`packages/composite/src/interaction-audio.ts:289-313` treats a currently-running
backend as an immediately successful activation. In parallel,
`packages/composite/src/interaction-audio.ts:366-380` awaits an earlier
`suspend()` and then unconditionally writes `lifecycle = 'suspended'`. There is
no epoch/current-operation check on the suspension completion.

Plant: start with a running backend, make `suspend()` pending, call
`interrupt()`, then call `activate()` from a new human activation before the old
suspend settles. `activate()` reports `{status: 'running'}`, but when the older
promise resolves the runtime ends at `lifecycle: 'suspended'`. The plant expected
the newer activation to win and failed **0 pass / 1 fail** (`received
"suspended"`, expected `"running"`). The same ordering is possible through the
fire-and-forget mute suspension at `packages/composite/src/interaction-audio.ts:354-364`.

This is not diagnostic-only. A click immediately after focus return or re-enable
can be accepted as the required autoplay gesture and then silently invalidated
by older work. The next interaction is lost unless the human activates yet
again. W3C's `resume()`/`suspend()` operations are asynchronous; the fake backend
at `packages/composite/src/interaction-audio.test.ts:407-421` changes state
synchronously and therefore cannot expose this ordering. Gate both blur and mute
with deferred suspension, and make the newest lifecycle operation authoritative.

### Major 2 — one feedback sequence is not consumed exactly once

`packages/composite/src/interaction-audio.ts:423-452` installs a new store
subscription every time it is called and forwards the current event without an
ownership or sequence-consumption guard. The event already contains the identity
needed to detect replay (`packages/state/src/contract.ts:1087-1104`), but the
runtime remembers no last-consumed sequence. `CompositeInputController.attach`
also creates one audio runtime and subscription per mounted boundary at
`packages/composite/src/CompositeDevice.tsx:251-264`; `CompositeDevice` is public,
while every instance uses the same singleton store at
`packages/composite/src/CompositeDevice.tsx:323-330`.

Plant: attach one runtime twice to one store, then publish one human Select
press. Expected one voice; received **two**. The plant failed **0 pass / 1 fail**.
The existing integration test at
`packages/composite/src/CompositeDevice.integration.test.tsx:168-245` proves one
mount consumes once; it cannot prove duplicate subscribers do not duplicate the
effect.

This violates W9 decision 6 and the dispatch proof “N real detents ⇒ N budgeted
ticks” at `docs/workstreams/002-implementation-spine/dispatch/W9-wheel-physics-sfx.md:35-37,51-53`.
The exact-once property must survive duplicate attachment/mounting, not depend on
the page happening to contain one subscriber.

### Major 3 — the required audible result has no audible evidence

The work itself says the owner listening pass remains pending at
`docs/workstreams/002-implementation-spine/diary/w9b.md:3-4,49-53`. The
“Manual audible preview” in
`docs/workstreams/002-implementation-spine/evidence/w9b-interaction-audio.md:91-108`
is a checklist, not a result. The only browser transcript is an automated,
locked T3 path that scheduled no audio
(`docs/workstreams/002-implementation-spine/evidence/w9b-interaction-audio.md:64-89`).

The deterministic graph tests are useful but cannot establish the Definition of
Done at `docs/workstreams/002-implementation-spine/dispatch/W9-wheel-physics-sfx.md:69-75`:
that the output is audible, restrained, individually articulated under a flick,
and plausibly plastic/mechanical instead of a beep or click/pop. They assert
node calls and finite decaying samples at
`packages/composite/src/web-audio-backend.test.ts:25-106`; they do not render or
listen to the resulting signal on a real output path. No audible artifact,
device/browser listening record, or owner judgement exists. This is a required
human-quality gate, not something graph topology can substitute for.

## Minor findings

### Minor 1 — agent silence is a convention in a public event shape, not a structural contract

The authoritative store path is safe: `packages/state/src/store.ts:75-103`
refuses silenced/zero budgets and `packages/state/src/silence.ts:30-32` makes
agent/system sources silent. However, the public
`InteractionFeedbackEvent` type permits `{actor: 'agent:*', silenced: false,
clickerTicks: 1}` at `packages/state/src/contract.ts:1087-1104`, and the public
runtime checks only `event.silenced` at
`packages/composite/src/interaction-audio.ts:178-182`. Both the runtime and its
event-facing API are exported at `packages/composite/src/index.ts:37-55`.

Plant: pass a fully typed agent Select event with `silenced: false`. Expected no
voice; received one (**0 pass / 1 fail**). The existing audio test at
`packages/composite/src/interaction-audio.test.ts:177-187` changes `actor` and
`silenced` together, so it proves only the boolean branch. This is Minor because
the current private state writer cannot produce the malformed combination, but
the public contract does not make the core agent-silence law unrepresentable.

### Minor 2 — a rejected resume overwrites disposal/interruption state

The fulfillment handler at `packages/composite/src/interaction-audio.ts:322-340`
checks `disposed`, `activationEpoch`, and `enabled`. The rejection handler at
`packages/composite/src/interaction-audio.ts:341-345` checks none of them and
unconditionally writes `failed`.

Plant: begin activation, queue a press, dispose, then reject the pending resume.
Expected `{status: 'disposed', reason: 'disposed'}` and a disposed snapshot;
received `{status: 'failed', reason: 'resume-failed'}` (**0 pass / 1 fail**).
It does not revive audio, so this is below Major 1, but it makes the structured
outcome and lifecycle diagnostics false precisely during cleanup. The immediate
rejection test at `packages/composite/src/interaction-audio.test.ts:247-259`
does not cover stale rejection.

### Minor 3 — the mute seam is not reachable in the mounted product

`setEnabled()` exists at `packages/composite/src/interaction-audio.ts:354-364`,
but the only callers in the repository are tests. `CompositeDeviceProps` exposes
no sound/clicker preference at `packages/composite/src/CompositeDevice.tsx:50-59`,
and the production runtime is constructed internally at
`packages/composite/src/CompositeDevice.tsx:327-330`. The unit-level muted
runtime plant passes, but no user or application state can place the mounted
runtime into that state.

Sound is not the sole navigation signal — visual depression, movement, focus,
bumps, and announcements remain — so this is not an accessibility blocker by
itself. It is still incomplete user control over automatically introduced sound,
which MDN's Web Audio guidance recommends exposing.

### Minor 4 — `rate-limit` is a dead advertised outcome

The scheduler checks the 12-voice cap before the queue-ahead limit at
`packages/composite/src/interaction-audio.ts:233-247`. The maximum allowed queue
ahead is defined as exactly `(12 - 1) / 30` at
`packages/composite/src/interaction-audio.ts:22-23`; the twelfth wheel voice is
allowed at that boundary, and the thirteenth exits on `voice-cap` before it can
reach `rate-limit`. With current constants and natural Web Audio completion,
`rate-limit` is therefore unreachable.

The public reason union still advertises it at
`packages/composite/src/interaction-audio.ts:59-73`, and W9b-D5 claims it is a
reported failure at
`docs/workstreams/002-implementation-spine/decisions/w9b.md:62-71`. The 100-tick
test confirms the actual result is 12 scheduled / 88 dropped with `voice-cap`
(`packages/composite/src/interaction-audio.test.ts:205-225`). The 30 Hz behavior
is still enforced by spacing, but the status vocabulary and evidence should not
claim a branch that cannot occur.

## What held under attack

- The state actions are the only current production writers. Press, direct
  detent, coast, sub-detent, agent, and system tests reproduce; raw gesture
  movement has no audio route.
- A human press publishes one budget, and ordinary N-detent events preserve N in
  the authoritative event. The intentional 100-tick stress case remains bounded
  at 12 voices and 88 reported drops.
- Hidden-tab interruption, blur, detach, dispose, unsupported Web Audio,
  immediate resume rejection, graph failure, no-preactivation replay, and muted
  no-construction behavior all reproduce in their covered orderings.
- Per-voice nodes disconnect; the procedural buffer cache is bounded to three
  kinds; active voices and pending events are capped; no console logging,
  `useState`, raw oscillator alert, network asset, or sound-only semantic signal
  was introduced.
- Mutation controls proved their edits landed before measurement. Setting
  `WHEEL_TICK_RATE_HZ` to zero produced **2 failures**; setting wheel duration to
  zero produced **1 failure**. Both mutations were restored byte-clean.

## Independent verification

| Check | Result |
| --- | --- |
| Exact W9b focused command | 20 pass, 0 fail, 160 assertions |
| State + W9b focused tests | 55 pass, 0 fail, 245 assertions |
| State TypeScript | exit 0 |
| Composite TypeScript | exit 0 |
| Scoped ESLint | exit 0 |
| `bun run gates` | exit 0; 16 automated pass, U14/U15 still manual |
| Repo tests inside gates | 1,073 pass, 0 fail |
| Production build | exit 0; existing large-chunk warning only |
| Isolated archive typechecks | `0c1f6fc` through `b013871`, plus `59291a4`, all pass after fresh offline install |
| Commit trailers | none in `0c1f6fc^..b013871` |
| `git diff --check` | only the pre-existing blank-line-at-EOF warning in `decisions/w9b.md:85` |

The requested `/Users/vinicius/code/agentic-context/browser` directory is absent.
The configured skill aliases also point at the absent
`/Users/vinicius/code/agent-context/` sibling. I did not treat either missing
path as browser behavior. Browser conclusions were checked against the primary
[W3C Web Audio specification](https://www.w3.org/TR/webaudio/),
[MDN `AudioContext.resume()`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume),
[MDN `AudioContext.close()`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/close),
and [MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
The current modern-web-guidance query returned no directly relevant guide, so it
was not used as authority.

## Review hygiene

Temporary plant files and source mutations were removed/restored before this
review was written. No implementation file was left changed. I did not stage,
commit, reset, or alter the pre-existing index/worktree changes.

# Re-review — corrections through `9993cb3`

**Re-reviewed:** 2026-09-01
**Correction range:** `c6e7702` through `9993cb3`
**Verdict:** **APPROVE** (technical) — 0 Critical, 0 Major, 3 Minor
**Owner gate:** **still open** — this review does not decide whether the sound
reads as a convincing iPod clicker on the owner's speakers.

All three original Majors are closed at the technical-review boundary. The
resume/suspend ordering survives both fulfillment and rejection in the stale
direction; one store sequence now has one audio owner across duplicate bindings
and mounts; and a reproducible real-Chromium WAV now exercises the same graph
class as the live backend. The WAV converts the former evidence absence into an
owner listening gate. It does not let a technical reviewer approve taste.

## Remaining Minor findings

### Minor 1 — mute/interrupt can overwrite terminal lifecycle diagnostics

`packages/composite/src/interaction-audio.ts:414-429` changes lifecycle to
`locked` or `suspended` without first preserving `disposed`, `unsupported`, or
`failed`; `interrupt()` does the same for a backend-less terminal runtime at
`packages/composite/src/interaction-audio.ts:431-440`.

Independent reproduction:

- `activate()` with a null backend correctly returned
  `{status: 'unavailable', reason: 'unsupported'}`. After
  `setEnabled(false); setEnabled(true)`, the snapshot became `locked` and the
  next eligible event reported `not-activated`, not `unsupported`.
- After `dispose(); setEnabled(false)`, the snapshot became `locked` instead of
  remaining `disposed`, and `consume()` reported `disabled` instead of
  `disposed`.

This does not revive a context or produce sound: `disposed` is still held in a
separate boolean and disabled scheduling still short-circuits. It is therefore
Minor, like the original stale-rejection diagnostic defect, rather than a
lifecycle/audio Major. The public structured status is nevertheless false after
an allowed API call.

### Minor 2 — the renderer is green outside the normal TypeScript gate

`packages/composite/tsconfig.json:6` includes only `src/**/*.ts(x)`, while the
evidence producer begins at
`packages/composite/scripts/render-interaction-audio-preview.ts:1`. Consequently
the package typechecks recorded for `fcc18a7` and `38c52ad` at
`docs/workstreams/002-implementation-spine/evidence/w9b-interaction-audio.md:177-181`
do not typecheck the script changed by those commits.

The current script does pass an independent strict direct `tsc --noEmit` run and
executes successfully, so there is no present type defect and the commit-audit
result is literally reproducible. The gap is that the ordinary 11/11 sweep and
the claimed owning-package audit would stay green if this evidence producer
later acquired a type error.

### Minor 3 — `isTrusted` is an autoplay signal, not proof of a human

The default activation predicate at
`packages/composite/src/interaction-audio.ts:506` is appropriate for filtering
ordinary `dispatchEvent()` synthesis and satisfying browser autoplay policy.
The inference in `docs/workstreams/002-implementation-spine/diary/w9b.md:62-65`
that browser automation “should not be able to” activate it is too broad.

Against the current route, a real headless-Chromium `page.mouse.click()` changed
the mounted root from `data-wp-audio-lifecycle="locked"` to `"running"`, with
zero console warnings/errors. That is expected: `isTrusted` means generated by
the user agent, not cryptographic human provenance. MDN describes that exact
boundary in [`Event.isTrusted`](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted).

This does **not** reopen the agent-silence Major: the current authoritative
WebMCP/state path still tags agent actions as agent-owned and the malformed-agent
runtime plant remains silent. Workstream 002 also ships no WebMCP registrations.
The defect is the evidence wording, not the tested state/audio path.

## Original finding disposition

| Original finding | Re-review result |
| --- | --- |
| Major 1 — stale suspend defeats activation | **Closed.** Both blur and mute stale suspensions were replayed with deferred fulfillment and rejection. The newer activation ended `running`, with the backend also `running`. |
| Major 2 — duplicate consumption | **Closed.** One runtime attached twice plus a second runtime consumed each press/detent sequence once; detach order did not replay or swallow later eligible sequences. Two mounted React boundaries also passed the permanent exact-once plant. |
| Major 3 — no audible evidence | **Closed to owner validation.** The WAV is reproducible from the production synthesis graph; whether it sounds right remains owner-only. |
| Minor 1 — malformed agent can sound | **Closed.** The public event is human-only by type, the state writer narrows again, and a runtime-mutated `agent:*` actor returns structured `silenced` with zero voices. |
| Minor 2 — stale resume rejection corrupts state | **Closed.** Late rejection after interrupt returns `interrupted`; after dispose it returns `disposed`; neither overwrites the terminal snapshot. |
| Minor 3 — mute unreachable | **Closed at the slice boundary.** `CompositeDevice.interactionAudioEnabled` reaches the mounted runtime and prevents replay/construction. No route currently supplies a user-facing mute control; W9b-D6 explicitly leaves settings UI out of this slice. |
| Minor 4 — dead `rate-limit` | **Closed.** The reason and contradictory documentation are gone. |

## Independent plant results

I did not merely rerun the author's helper. A temporary independent seven-test
suite used a separate backend/voice/target implementation and then was deleted:

| Plant | Result |
| --- | --- |
| stale suspend resolves after newer activation | pass; runtime and backend both `running` |
| stale suspend rejects after newer activation | pass; runtime and backend both `running` |
| stale resume rejects after interrupt/dispose | pass; `interrupted` / `disposed`, no pending work |
| duplicate binding + duplicate runtime ownership | pass; exact one voice budget per sequence across detach order |
| malformed agent + zero/sub-detent | pass; zero voices |
| mute owner selection and no replay | pass; muted owner skipped, old sequence never replayed, next new sequence audible after re-enable |
| 100 detents + hidden/dispose cleanup | pass; 12 scheduled / 88 dropped, 30Hz spacing, every voice stopped once, context closed once, all listeners removed |

Result: **7 pass, 0 fail, 56 assertions**. The permanent state + W9b command
also reproduced **66 pass, 0 fail, 272 assertions**.

The two literal mutation controls proved their edits before measurement:

- `WHEEL_TICK_RATE_HZ: 30 -> 0` produced **20 pass / 2 fail**.
- wheel duration `0.008 -> 0` produced **24 pass / 1 fail**.

Both files were restored to their pre-plant SHA-256 values and are byte-clean.

## WAV and production-graph provenance

The artifact is not a hand-authored sample and not a parallel test synthesizer.
`createBrowserInteractionAudioBackend()` constructs `InteractionAudioGraph` at
`packages/composite/src/web-audio-backend.ts:23-35`; the offline renderer
constructs that same private class at
`packages/composite/src/web-audio-backend.ts:69-92`. Both call the same
`InteractionAudioGraph.schedule()` implementation at
`packages/composite/src/web-audio-backend.ts:114-162`, and both consume
`createInteractionVoiceSpec()` from the production scheduler.

I regenerated the WAV in real headless Chromium from the current Vite-served
module. It compared byte-for-byte with the committed artifact:

```text
bytes=96044
sha256=b0f145861e0c022c7f58e00c5fd6f3f0364984a16a67e9644f545c15117ff30e
cmp=identical
format=PCM Int16 mono, 48000 Hz, 1.000000 s
peak=0.0465087890625
rms=0.0009722483131697144
clipped_samples=0
nonzero_samples=1631/48000
```

As a provenance control, I changed the production graph's master gain from
`0.62` to `0.31`, proved the edit landed, and reran the same renderer. The WAV
hash changed to
`14d6d3b68fde5ada463df2256b53b7f08a4dde7ceda0a1a6894a903af0e7ce59`.
Restoring the production source restored its original source hash. This proves
the renderer is coupled to the graph under review, not merely that it emits a
valid WAV.

The measurable hierarchy is present: Select peak `0.046509`, wheel-window peak
`0.011444`, secondary-button peak `0.027130`, with no clipping. Measurements do
not establish that the 1.1kHz/1.5kHz plastic body reads as mechanical rather
than tonal, nor that the wheel is audible enough on the owner's output chain.
Those are exactly the pending owner judgements at
`docs/workstreams/002-implementation-spine/evidence/w9b-interaction-audio.md:140-144`.
MDN confirms that `OfflineAudioContext.startRendering()` renders the connected
graph and scheduled changes into the returned `AudioBuffer`; it does not claim
to substitute for a live-output listening pass.

## Gate and history checkpoint

| Check | Re-review result |
| --- | --- |
| Correction-focused permanent tests | 30 pass, 0 fail, 187 assertions |
| State + W9b focused tests | 66 pass, 0 fail, 272 assertions |
| Independent adversarial plants | 7 pass, 0 fail, 56 assertions |
| `bun run gates` | 16 automated pass, 0 fail; 1,086 repo tests pass |
| Repo typecheck | 11/11 clean |
| Repo lint | clean |
| Production build | clean; existing large-chunk warning only |
| Isolated correction commit typechecks | `c6e7702`, `ea9d8e8`, `f12509a`, `fcc18a7`, `38c52ad` all exit 0 after fresh offline installs |
| Direct renderer-script typecheck | exit 0 (not part of the normal package config; Minor 2) |
| `git diff --check 80186ed..9993cb3` | clean |
| commit trailers through `9993cb3` | none |
| `useState`, console error/warn/log, lint disables, type escapes on reviewed production paths | none |

The operation ordering is consistent with the Web Audio specification: resume,
suspend, and close are asynchronous control operations whose promises settle
after their state work, so completion order cannot be treated as intent order.
The monotonic operation identity is therefore load-bearing, not test ceremony.
See the primary [W3C Web Audio specification](https://www.w3.org/TR/webaudio-1.0/)
and [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Re-review hygiene

The original review above remains byte-for-byte unchanged: its original 11,541
bytes still hash to
`ee54035d35490816761dc3e03f06fbc14cf646a9fc1bdb18fd9fad0bb50fa751`.
Temporary plant files were deleted and all source mutations were restored by
verified SHA-256. I did not stage, commit, reset, or alter the pre-existing
unrelated worktree changes.

# Re-review — Minor closure after `628d9f1` and `0ca3024`

**Re-reviewed:** 2026-09-01
**Correction commits:** `628d9f1`, `0ca3024`
**Verdict:** **APPROVE** (technical) — 0 Critical, 0 Major, 1 Minor
**Owner gate:** **still open** — sound character on the owner's speakers remains
a human-taste decision and is not cleared by this review.

Two of the three prior Minors are fully closed. The activation terminology now
states the actual `Event.isTrusted` boundary, and the preview renderer is inside
the ordinary composite TypeScript project with a working red control. The
terminal-diagnostic fix closes the exact unsupported/failed/disposed
reproductions from the prior review and the asynchronous suspend-rejection
variant, but it still loses a synchronous suspend failure inside the mute call
itself.

## Remaining finding

### Minor 1 — mute overwrites a synchronous terminal suspend failure

`packages/composite/src/interaction-audio.ts:433-438` calls `requestSuspend()`
and then writes the ordinary muted lifecycle. If `suspend()` throws
synchronously, the catch at `packages/composite/src/interaction-audio.ts:293-297`
first records `failed`, but control returns to `setEnabled(false)` and lines
436-438 immediately replace it with `suspended`.

Independent plant: activate a running backend whose `suspend()` throws, then
mute it. Expected lifecycle `failed` and result reason `graph-failed`; received
lifecycle `suspended` and therefore an ordinary disabled/suspended diagnostic.
The three-case closure plant passed unsupported, constructor-failed and disposed
preservation, and a separate asynchronous rejection plant also passed; the
synchronous plant failed **2 pass / 1 fail, 10 assertions**.

This does not revive audio or escape the mute guard, so it remains Minor rather
than a lifecycle Major. It does mean the blanket claims that all three Minors
are fixed and terminal labels cannot be overwritten are still too broad at
`docs/workstreams/002-implementation-spine/diary/w9b.md:3-4,77-81` and
`docs/workstreams/002-implementation-spine/evidence/w9b-interaction-audio.md:48-54`.
The catch is not hypothetical dead code: the runtime deliberately handles a
synchronous backend throw, but the caller currently erases that structured
outcome.

## Disposition of the three prior Minors

| Prior Minor | Result |
| --- | --- |
| Terminal lifecycle diagnostics | **Partially closed.** Unsupported, pre-existing failed, disposed, and asynchronous suspend rejection survive mute/interruption. The synchronous suspend-throw path above remains. |
| Renderer outside normal TypeScript gate | **Closed.** `packages/composite/tsconfig.json:6` includes `scripts/**/*.ts`; both current and isolated-commit file lists contain the renderer. |
| `isTrusted` described as human proof | **Closed.** The public seam is now `isActivationEligible`, code and docs explicitly separate autoplay eligibility from actor provenance, and no `isHumanActivation` identifier remains. |

## Independent verification

- Focused state + W9b suite: **68 pass, 0 fail, 280 assertions**.
- Current repo suite: **1,088 pass, 0 fail**.
- Current composite typecheck: exit 0; scoped ESLint on changed runtime, tests,
  backend and renderer: exit 0.
- Isolated `628d9f1` archive: frozen offline install succeeded, composite
  typecheck succeeded, and repo typecheck reported **11/11 projects clean**.
- Renderer inclusion control: `tsc --listFiles` named
  `packages/composite/scripts/render-interaction-audio-preview.ts`; a planted
  `number`-to-`string` error in the isolated renderer made the ordinary package
  typecheck fail with **TS2322** and **TS6133**.
- Chromium activation control on the current route: synthetic
  `dispatchEvent()` produced `isTrusted=false` and remained `locked`; Playwright
  `page.mouse.click()` produced `isTrusted=true` and moved `locked -> running`,
  with no warning/error. That matches the corrected source and MDN definition:
  user-agent dispatch is not proof of human provenance.
- `git diff --check 9993cb3..0ca3024`: clean. Both correction commits have no
  trailers. No later commit through current `HEAD` changes the reviewed W9b
  implementation or evidence, and those paths have no working-tree overlap.
- No changed production path adds `useState`, console logging, lint disables,
  unsafe type escapes, or workstream-name leakage.

The current modern-web-guidance search again returned no Web Audio-specific
guidance, so it was not treated as authority. The activation conclusion was
cross-checked against MDN `Event.isTrusted` and the W3C Web Audio resume model.
The repo explicitly has no Neuve shell or Kanban board, so the workstream's
documented tracker/review artifacts remain the process source.

## Re-review hygiene

Before this append, the complete prior review was 22,256 bytes and hashed
`85b7439252d4363be292f6d350ffa734190a0d2cbbe6813fba021512298584b0`.
Temporary tests, browser scripts and archive copies were deleted. I did not edit
implementation, stage, commit, reset, or disturb the unrelated dirty worktree.

# Final focused re-review — `da76868`

**Re-reviewed:** 2026-09-01
**Verdict:** **APPROVE** (technical) — 0 Critical, 0 Major, 0 Minor
**Owner gate:** sound character on the owner's speakers remains open and is not
cleared by this technical verdict.

The last technical Minor is closed. `setEnabled(false)` now writes its
provisional ordinary muted lifecycle before calling `requestSuspend()` at
`packages/composite/src/interaction-audio.ts:431-438`. A synchronous throw is
therefore caught afterward at `packages/composite/src/interaction-audio.ts:293-297`
and leaves the final lifecycle `failed`; `consume()` reports `graph-failed`
rather than an ordinary disabled/suspended outcome.

The committed regression at
`packages/composite/src/interaction-audio.test.ts:136-146` uses a genuinely
synchronous throw. An independent backend plant also passed through mute,
re-enable and interrupt with **1 pass / 0 fail, 8 assertions**, preserving
`failed` and scheduling no voice. As a red control, I reversed only the two
blocks in an isolated `da76868` archive; the regression then failed exactly
**24 pass / 1 fail** with received lifecycle `suspended`. The test is
load-bearing rather than a restatement of the implementation.

Focused state + W9b tests pass **69/69 with 282 assertions**. Composite
TypeScript and scoped ESLint are clean; `git diff --check da76868^..da76868` is
clean; the commit has no trailer; and no later commit or working-tree change
overlaps the reviewed W9b paths. The correction adds no type escape, lint
disable, logging, `useState`, resource, listener, or ownership change.

Before this append, the complete prior review was 27,321 bytes and hashed
`ff10550c696d74de93dc57ae0c8a1d864175219b956f349589094c7026b348af`.
Temporary plant and archive files were deleted. I did not edit implementation,
stage, commit, reset, or alter unrelated worktree changes.

# Independent final confirmation — `da76868`

**Re-reviewed:** 2026-09-02
**Verdict:** **APPROVE** — 0 Critical, 0 Major, 0 Minor

The last W9b technical Minor remains closed. The regression at
`packages/composite/src/interaction-audio.test.ts:136-146` throws synchronously
from `suspend()` and passes against the current runtime. An independent
public-API plant preserved terminal `failed` through mute, re-enable and
interruption, returned `graph-failed`, and scheduled zero voices (**1 pass, 8
assertions**). Reversing only the fixed block order in an isolated `da76868`
archive made that committed regression fail **24 pass / 1 fail**, receiving
`suspended`; the test is load-bearing.

The current W9b-focused suite passes **34/34 with 199 assertions**. Composite
TypeScript, scoped ESLint, `git diff --check da76868^..da76868`, and commit
trailer checks are clean. Later changes add one boundary-consumption test and
record the owner's audio approval; they do not alter the reviewed runtime or
reopen this Minor. The owner sound-taste gate is now recorded closed by
`e3c5684`.

Before this append, the review was 29,210 bytes and hashed
`81d9a45e1f3934994ecee2d28eb4cf8a3a3a8bbef5d0a9b541b81e12b0e59426`.
The isolated archive was deleted. I did not edit implementation, stage, commit,
reset, or alter unrelated worktree changes.

# Final focused verdict — `da76868`

**Re-reviewed:** 2026-09-02
**Verdict:** **APPROVE** — 0 Critical, 0 Major, 0 Minor

The synchronous-suspend Minor remains closed. The production ordering at
`packages/composite/src/interaction-audio.ts:433-438` establishes the ordinary
muted lifecycle before `requestSuspend()`; a synchronous throw is therefore
handled afterward at `packages/composite/src/interaction-audio.ts:293-297` and
remains terminal `failed`. The committed regression at
`packages/composite/src/interaction-audio.test.ts:136-146` uses a genuinely
synchronous throw from `FakeBackend.suspend()` and passes.

The complete W9b-focused suite passes **34/34 with 199 assertions**; composite
TypeScript and scoped ESLint are clean. As a load-bearing red control, reversing
only the fixed block order in a verified isolated `da76868` archive produced
**24 pass / 1 fail**, with the regression receiving `suspended` instead of
`failed`. No later commit or working-tree change overlaps the reviewed runtime.
The isolated archive was moved to Trash; no implementation was edited, and
nothing was staged, committed, or reset.

# Requested final focused re-review — `da76868`

**Re-reviewed:** 2026-09-02
**Verdict:** **APPROVE** — 0 Critical, 0 Major, 0 Minor

The last W9b Minor remains closed. The regression at
`packages/composite/src/interaction-audio.test.ts:136-146` exercises a genuinely
synchronous throw from the non-`async` fake backend `suspend()` method. The
production ordering at `packages/composite/src/interaction-audio.ts:433-438`
sets the provisional muted lifecycle before requesting suspension, so the catch
at lines 293-297 supersedes it with terminal `failed` and nothing afterward
relabels the outcome.

The current W9b-focused suite passes **34/34 with 199 assertions**. An
independent public-API synchronous-throw plant passed **9 assertions**: terminal
`failed` survived mute, re-enable, and interruption; `consume()` returned
`graph-failed`; and zero voices were scheduled. Composite TypeScript and scoped
ESLint are clean. No W9b implementation path has a working-tree overlap, and I
did not edit implementation, stage, commit, or reset.

# Final independent focused verdict — `da76868`

**Re-reviewed:** 2026-09-02
**Verdict:** **APPROVE** — 0 Critical, 0 Major, 0 Minor

The last W9b technical Minor is closed. The provisional muted lifecycle is
assigned at `packages/composite/src/interaction-audio.ts:433-435` before the
suspension request at lines 436-438. A synchronous throw is consequently caught
after that assignment at lines 293-297 and remains terminal `failed`; no caller
subsequently restores an ordinary `suspended` label.

The regression at `packages/composite/src/interaction-audio.test.ts:136-146`
uses a non-`async` fake `suspend()` that throws before returning a promise. It
passes in the current **34/34, 199-assertion** W9b-focused suite. A separate
public-runtime plant also passed: after synchronous suspend failure, mute,
re-enable, and interruption preserved `failed`, `consume()` returned
`graph-failed`, and the backend scheduled zero voices. Composite TypeScript and
scoped ESLint are clean. No current working-tree change overlaps the reviewed
W9b implementation; I changed only this appended verdict and did not stage,
commit, or reset anything.

# Final focused re-review — last W9b Minor after `da76868`

**Re-reviewed:** 2026-09-02
**Verdict:** **APPROVE** — 0 Critical, 0 Major, 0 Minor

The final Minor remains closed. `setEnabled(false)` assigns the provisional
muted lifecycle before invoking `requestSuspend()` at
`packages/composite/src/interaction-audio.ts:433-438`; a synchronous backend
throw is then caught at lines 293-297 and leaves terminal `failed`. There is no
later ordinary lifecycle write in that call path.

The committed regression at
`packages/composite/src/interaction-audio.test.ts:136-146` is a genuine
synchronous plant: `FakeBackend.suspend()` is non-`async` and throws before it
can return a promise. The current focused suite passes **34/34 with 199
assertions**. A separate public-runtime probe also preserved `failed` through
mute, re-enable, and interruption, returned `graph-failed`, and scheduled zero
voices. Composite TypeScript and scoped ESLint are clean. No working-tree change
overlaps the reviewed runtime; I appended only this verdict and did not edit
implementation, stage, commit, or reset.
