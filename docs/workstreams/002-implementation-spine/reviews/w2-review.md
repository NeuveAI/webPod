# Review: W2 — Jotai store, detent reducer, screen state machine, announcement debounce

Reviewer: antagonistic lane L-C reviewer. Nothing below is taken from the diary; every claim
in this document was re-derived by running it. Commits reviewed: `5f92872`, `1bbe51d`,
`55b34dd`, `4fce0f1`, `0634b34`, `30d6509`, `852993f`. Package: `packages/state/**`.

## Verdict: REQUEST_CHANGES

Four Major findings. The slice is genuinely good work — the reducer is pure, the silence seam
is one line, the store needs no React, and every gate the engineer claims does in fact pass on
my machine. It fails on a single recurring shape: **the invariants this slice owns are enforced
where the code is, and delegated where the code is not**, and the delegated half has no gate and
no documentation. The most consequential instance inverts U13 completely in a real browser.

---

## The three standing questions (D-038, D-040) — answered explicitly

**1. Does any finding in this document contradict the method used to produce the rest of it?**

Yes, and spending it changed a finding. I first wrote Major 2 as "the D-042 density ruling has
no test", proved by planting `compact/medium/airy = 7/7/7` and watching 93/93 stay green. The
method behind that finding is: *a constant asserted only through itself is not asserted*. I had
not applied that method anywhere else. So I went back and planted the other spec constants:

- `ANNOUNCE_DEBOUNCE_MS: 350 → 50` — **93 pass, 0 fail.** U13's own number is ungated.
- `DETENT.arcDegPerDetent / touchDeadZoneDeg / fast / fasterThreshold` falsified — **7 fail.**
- `DETENT.hapticSuppressAbovePerSec: 12 → 1200` — **1 fail.**

The arc geometry is genuinely gated because those tests feed literal degrees and pixels and
assert literal detent counts. `VISIBLE_ROWS` and `ANNOUNCE_DEBOUNCE_MS` are not, because every
assertion about them computes both sides from the symbol. That is a sharper and more general
finding than the one I started with, and Major 2 is now stated in those terms. Had I not asked
this question I would have shipped the narrow version and left the U13 constant unexamined —
which is the D-035 shape exactly: a correctly-handled local finding that was also evidence I had
not spent.

**2. For each conclusion I endorse: does the reason given actually support it, or does it merely
arrive at the same place?**

One of my endorsements failed this and is downgraded. I was going to certify property 1 —
"state is reachable outside React" — on the strength of `Bun.resolveSync('react')` throwing plus
18 React-free tests. Both are true and I verified both. But the *capability requirement* in the
dispatch is not "the package does not need React"; it is "**tool callbacks must read and write the
same state the UI renders**." Unresolvability proves the first and is silent on the second.
Nothing in `packages/state` forces W3's `Provider` to be handed `deviceStore` — `createDeviceStore()`
is exported and can legally be called inside a component, at which point the singleton a tool
callback addresses and the store the UI renders are two different devices, with no type error and
no failing test. The evidence is real; the conclusion it supports is narrower than the property.
Recorded as Minor 5 rather than as praise.

I also checked the reasoning I am *accepting*. D-042's ruling ("page by density") and D-043's
ruling ("pin jotai exactly") are both complied with in the artifacts I can check —
`VISIBLE_ROWS = 8/6/4` at `contract.ts:159-163`, `"jotai": "2.20.3"` with no caret at
`packages/state/package.json:13`, exactly one physical jotai copy installed. But D-043's *reason*
is "two module instances make a Provider invisible to a hook" — which is a statement about atom
identity, and atom identity is broken by two copies of **`@webpod/state`**, not only by two copies
of jotai. Pinning jotai is necessary and is not sufficient. That is a note for W3, not a finding
against W2, and I am recording it rather than letting the pin stand in for the guarantee.

**3. Where a document applies a caution inconsistently, the inconsistency is the finding.**

This is the spine of the review. The slice's own stated method, in three places
(`contract.ts:24-30`, `detent.ts:19-23`, `detent.ts:249-252`), is: *derive it once, inside the
module that owns it, so no call site can forget.* It is applied rigorously to `silenced` and to
`actor` — a caller literally cannot supply either, and I could not find a bypass. It is then
**not** applied to three other invariants the same module owns:

| Invariant | Enforced where | Consequence |
|---|---|---|
| silence rule | inside `detent()`, one line | unbreakable — verified |
| actor tag | inside `detent()`, derived | unbreakable — verified |
| page = one viewport (D-042) | pushed to the caller as `pageRows: number` | Major 2 |
| the announcer's clock domain | pushed to the caller, undocumented | Major 1 |
| effective density (Dynamic Type) | nowhere; two atoms disagree | Major 3 |

There is no principle separating the first two from the last three. `detentActionAtom`
(`store.ts:263`) holds the store and could derive all three; it derives none of them. The same
inconsistency appears in the bookkeeping: `diary/w2.md` has an explicit *"What I did not build,
deliberately"* section listing three omissions (React bridge, tool registration, clicker audio) —
and does not list the fourth, §4.4's inertial coast (Major 4). Three disclosed, one not, with no
principle dividing them.

**My own principle, stated so it can be checked:** I assert a finding flatly only where I have a
red test or a direct code-versus-published-doc contradiction. I hedge where reachability depends
on a consumer that does not exist yet. Majors 1–4 are all in the first category. Minors 3, 5 and 6
are in the second and are worded as such.

---

## Findings

### [MAJOR] `startAnnouncer` mixes two clock domains by default; U13 inverts to 30/30 in a browser (`packages/state/src/store.ts:359`)

`const now = options.now ?? (() => Date.now())`. The due time it compares against is
`input.timestampMs + ANNOUNCE_DEBOUNCE_MS`, where `timestampMs` comes from whatever the consumer
passes to `detentActionAtom`. `DetentInput.timestampMs` (`contract.ts:454, 467, 486, 495`) is
documented only as a timestamp — no clock domain is specified anywhere in the published contract.

In a browser the idiomatic and correct value for that field is `event.timeStamp`, which is on the
`performance.now()` monotonic origin (small: ~1e4), while the driver's default clock is
`Date.now()` (~1.8e12). `dueAtMs - now()` is then hugely negative, `Math.max(0, …)` clamps to `0`,
the timer fires on the next macrotask, and `flushAnnouncer` sees `nowMs >= dueAtMs` and emits.
Every detent announces.

I ran it (ATTACK 7): a 30-detent flick through the real store with the default `startAnnouncer`
and `performance.now()`-based timestamps produced **30 announcements, not 1**.

```
ATTACK 7 announcements spoken: 30
expect(spoken).toBe(1)  →  Received: 30
```

Why it matters: this is U13, the gate the fourth commit exists to satisfy, and the failure mode is
the one `announce.ts:4-9` names in its own docstring — *"a live region that speaks every row the
highlight passes over is unusable for the person it exists to serve, and the defect is completely
invisible to anyone not listening to it."* It fails open, in the loud direction, and no gate in
the repo would catch it. The engineer clearly knew a shared clock was required — the driver test at
`announce.test.ts:419` deliberately writes `const start = Date.now()` and feeds `start + i` — but
that requirement was encoded in a test fixture and in nothing else: not the type, not the TSDoc,
not a guard. That is the D-040 shape: the caution was applied once and not carried to the seam.

Fix is small: state the clock domain on `DetentInput.timestampMs`, and either make `now` required
or have `startAnnouncer` refuse a due time more than one debounce window away from its own clock.

### [MAJOR] D-042's densities and U13's 350ms are asserted only through themselves; both can be reverted with 93/93 green (`packages/state/src/contract.ts:159-163`, `packages/state/src/contract.ts:809`)

Planted (PLANT 7): `VISIBLE_ROWS = { compact: 7, medium: 7, airy: 7 }` — i.e. the flat 7 that
D-042 explicitly ruled against, applied to every density at once. Result: **93 pass, 0 fail**, and
`tsc --noEmit` exit 0.

Planted (PLANT 9): `ANNOUNCE_DEBOUNCE_MS = 50`. Result: **93 pass, 0 fail**.

Both survive because every assertion about them is self-referential — `expect(outcome.rowDelta)
.toBe(VISIBLE_ROWS[density])` at `detent.test.ts:107`, `expect(…).toBe(VISIBLE_ROWS.compact)` at
`store.test.ts:230`, `29 * 20 + ANNOUNCE_DEBOUNCE_MS` throughout `announce.test.ts`. Contrast the
arc geometry, which *is* gated: falsifying `arcDegPerDetent`, `touchDeadZoneDeg` and both
acceleration thresholds turns 7 tests red, because those tests feed literal degrees and assert
literal counts.

Why it matters: D-042 is a lead ruling that overrode a primary spec, and 350ms is U13's own number
from §4.4. Neither has a gate. A future edit reverting either — including the very "reversible in
one line" edit `decisions/w2.md` §2.1 advertises — lands silently green. Two tests with literal
`8`/`6`/`4` and a literal `350` close it.

Compounding it, at the store seam: `detentActionAtom` (`store.ts:263`) forwards the caller's
`pageRows` (`contract.ts:485`) untouched while holding `visibleRowCountAtom`, which knows the
right number. I drove a flat-7 page through the public store API on a compact (8-row) screen and
it moved 7 rows (ATTACK 6) — the exact orphan-row failure D-042's rationale is built on. The
reducer is pure and cannot read the store, but `detentActionAtom` can, and it is the entry point
W3 will use.

### [MAJOR] `densityAtom` is inert: nothing reconciles it into the stack, and the contract says it is authoritative (`packages/state/src/contract.ts:979-984` vs `contract.ts:1065-1068`)

`densityAtom`'s TSDoc: *"The effective row density. Device state rather than a per-screen constant,
because Dynamic Type at 130% or more forces `airy` regardless of what a screen would prefer."*

`visibleRowCountAtom`'s TSDoc, 80 lines later: *"Read from the current frame rather than from
`densityAtom`, with the device setting as the fallback before any screen is pushed."*

Both cannot be true, and the second one is the code. `densityAtom` is read exactly once, at
`store.ts:216`, to seed the initial menu frame. After that no exported writer rewrites frames on a
density change; `pushScreen` copies `frame.density` verbatim and `readScreen` reports it.

Measured (ATTACK 5): push a `compact` screen, then `store.set(densityAtom, 'airy')` — the Dynamic
Type case the TSDoc names:

```
after densityAtom = 'airy':  visibleRowCount = 8   visibleRows.length = 8   snapshot.density = compact
```

Nothing moves. Why it matters: a consumer honouring Dynamic Type at 130% has exactly one atom to
write and writing it does nothing — no error, no type failure, no test. The row height and the
window size then disagree, which `visibleRowCountAtom`'s own comment describes as *"the kind of
off-by-one that only shows up as a row you can never scroll to."* Either export a
`setDensityActionAtom` that remaps the stack, or delete the claim from `densityAtom` and say
plainly that frame density is set at push time by whoever builds the frame.

### [MAJOR] §4.4's inertial coast is absent from the reducer and undisclosed (`packages/state/src/detent.ts:301`)

`export const endGesture: EndGestureFn = () => IDLE_DETENT_ACCUMULATOR`.

001 §4.4, the table the dispatch names as *"the engineering contract"*, Release row, touch and
mouse arc: *"Inertial coast: remaining angular velocity decays at 0.94/frame, firing a detent every
15° until |ω| < 60°/s. Every coasted detent still clicks."* §4.3 repeats it for Cover Flow
("momentum coasting preserved"). It is not in `scope.md`'s non-goals, and 001 §16's M0 milestone
scopes *"the `detent()` reducer with all four input paths"* to this stage.

The reducer computes and stores exactly the quantity a coast needs — `speedDegPerSec`, maintained
at `detent.ts:212-213` and `detent.ts:235` — and `endGesture` then discards it along with
everything else, so a consumer cannot recover ω from the state package either. The decay constant,
the 60°/s floor and "every coasted detent still clicks" appear nowhere in `packages/state`.

Why it matters as a *finding* rather than as a scope question: `diary/w2.md` has a section headed
*"What I did not build, deliberately"* that lists three omissions with reasons. This one is not in
it, and it is not in `decisions/w2.md` either. W3 inherits an `endGesture` whose TSDoc says it
"ends a gesture, discarding residual travel" with no hint that a documented behaviour is missing
between the last event and that call. Either implement it, or record it as a deferral in the same
list as the other three — an omission that is disclosed is a plan; an omission that is not is a
defect the next lane discovers.

---

### [MINOR] `DetentOutcome.multiplier` is documented "Always `1` on the key path" and is not (`packages/state/src/contract.ts:570` vs `packages/state/src/detent.ts:199`)

`multiplier = input.page ? input.pageRows : DETENT.rowsSlow`. With `Shift` on a compact screen it
is **8**; I measured it. The published contract says it is always 1 on that path. `multiplier`
is the field a consumer would read to assert "the keyboard did not accelerate" — it is exactly
what `detent.test.ts:91` uses for that purpose — so the false statement is on the one field where
being wrong costs something.

### [MINOR] The silence predicate exists at two call sites, and the diary says it exists at one (`packages/state/src/store.ts:160`, `packages/state/src/detent.ts:252`)

`const silenced = input.source !== 'human'` appears verbatim in both files. `diary/w2.md` claims
*"No call site re-derives it."* It does. Presses are not detents and cannot go through `detent()`,
so this is not a violation of the §15.2 letter, and both copies are currently correct — but it is
two places to change a rule whose whole design argument (`detent.ts:19-23`) is that there must be
one. A shared `isSilenced(source)` predicate satisfies both call sites and the argument.

### [MINOR] A driver clock reading below the due time strands the announcement permanently (`packages/state/src/store.ts:376-380` with `packages/state/src/announce.ts:151-153`)

`flushAnnouncer` returns the **same state object** when it is not yet due. `set(announcerAtom,
sameRef)` is a no-op to jotai, so the `store.sub(announcerAtom, arm)` subscription does not fire,
`arm()` is not called — and the timer callback has already set `handle = null`. Nothing is armed
and nothing will re-arm until the next movement. The settling summary is dropped.

Demonstrated (ATTACK 8) with the public `AnnouncerDriverOptions` injection points: due at 1350,
timer fires with the clock reading 1349, `liveRegionAtom` stays `null` forever while
`announcerAtom` still holds `settling` with `dueAtMs: 1350`.

I hedge the reachability honestly: I probed Bun's real `setTimeout` 400 times and it never fired
early (`n=400 fired-early=0`), so this is not reachable today via the default driver on this
runtime. It becomes reachable two ways. A backward `Date.now()` step (NTP correction) between arm
and fire is one. The other is the natural fix for Major 1: aligning the driver on
`performance.now()` to match `event.timeStamp` puts it on a clock browsers deliberately coarsen,
where reading back a value below the due time is ordinary. Re-arming when a flush produces nothing
is one line and removes the class.

### [MINOR] `screenStackAtom` is documented "Never empty", defaults to empty, and `popScreen` calls that state the root (`packages/state/src/contract.ts:989`, `contract.ts:993`, `packages/state/src/screen.ts:144`)

`atom<readonly ScreenFrame[]>([])`, and `popScreen` guards with `stack.length <= 1`, so
`popScreen([])` returns `{ stack: [], bump: 'right' }` — I ran it. A consumer that uses the
exported atoms directly rather than `createDeviceStore()` (both are public) gets a `Menu` press
that publishes an elastic bump announcing "this is the top" for a stack with no top. `< 1` should
be a separate case, or the atom should not be constructible in a state the doc says cannot exist.

### [MINOR] `menuRows` is documented to take visible children as given; it has no such parameter, and the default stack hard-renders `Radio` and `Now Playing` (`packages/state/src/menu.ts:29`, `menu.ts:123`, `packages/state/src/store.ts:216`)

`menu.ts:23-30` states that `Now Playing` is shown only while audio is loaded and that `Radio` is
**absent from the tree** rather than greyed when the provider cannot make stations — 001 §15.3 #7 —
"see `menuRows`, which takes the visible children as given." `menuRows(node: MenuNode)` takes a
node and maps `node.children` unconditionally. `createDeviceStore()` therefore ships a main menu
containing both rows before anything is known about the provider, and `store.test.ts:175` asserts
that stack renders on the first frame. The filtering seam the comment promises does not exist in
the signature. Either give `menuRows` a visible-children parameter or correct the comment; the
current pair reads as a guarantee and is a description of an intention.

### [INFO] Duplicated clause in the contract's header (`packages/state/src/contract.ts:26-27`)

`"…so no call site can forget. Nothing in / nothing in this stage emits anything but \"human\""`.
Cosmetic, in the file the whole workstream reads first.

### [INFO] 30 rapid key detents produce 2 announcements, not 1 — correct, and worth stating

I measured it: the first press is `immediate` and the following 29 fall inside
`KEY_REPEAT_WINDOW_MS` and summarise once, giving `Row 2 of 200` then `Row 31 of 200`. That is
what §4.4's A11y row specifies ("Immediate per keypress … debounced only during auto-repeat") and
U13 is scoped to a flick. Recorded so a later reader does not mistake it for a U13 failure.

### [INFO] Three U8 permission-vocabulary hits survive in prose (`contract.ts:96, 186, 187`)

All three are TSDoc stating that the permission model does **not** exist and why the states
assuming it were deleted. Pre-cleared in `evidence/w2-greps.txt`. Correct to keep — removing them
deletes the warning — but W5's U8 gate will need a permanent clearance mechanism rather than a
manual pass each run.

---

## Gates I cannot clear, and must not approve around

**U14 (thumb occlusion) and the both-colourway aesthetic call are owner-only — H-5 and H-6.**
I did not clear them and no agent can. `packages/state` renders nothing, so neither applies to
this package today; but the reducer decides what feedback *exists* (`clickerTicks`,
`hapticPulses`, `BumpEvent`), so the numbers reviewed here become W3's occlusion problem on real
glass. Stating it rather than passing over it.

---

## What I verified and could not break

Recorded because it is load-bearing for W3, not as decoration.

- **One keypress = one detent, no acceleration, under abuse.** 200 keydowns 1ms apart: 200 rows,
  `multiplier` set = `{1}`, every `|detents| === 1`. 200 alternating-direction keydowns all at
  `timestampMs: 0`: net 0 rows, every multiplier 1. A keydown injected into an arc gesture already
  wound to the ×7 multiplier: 1 detent, 1 row, multiplier 1. Same through the store: 200 keydowns
  → `highlightIndex` exactly 200. The `baseFor` path-switch reset (`detent.ts:119-122`) is what
  makes the interleaved case safe, and it is correct.
- **The silence seam.** One call site inside `detent()` (`detent.ts:252`) for all five paths.
  10 path × source combinations: `silenced` true, `clickerTicks` 0, `hapticPulses` 0, movement
  still happens. An agent supplying `agentOrigin: 'human:touch'` gets `actor: 'agent:human:touch'`
  and stays silent — the tag is derived, not accepted. I could not find a bypass.
- **U13 on the flick path.** 200 detents through the real store, real reducer, no mocks: 0
  announcements mid-flick, exactly 1 after settle. 30 detents each arriving 349ms after the last,
  with a flush attempted at every 349ms boundary: 0 mid-flight, exactly 1 at the end.
- **Enumerable screen shape.** `screenSnapshotAtom` keys are exactly `face, screenId, title,
  density, rows, highlightIndex, totalRows, visibleRows, agentActive`; row `index` stays absolute
  under windowing; the highlight is always inside the reported window.
- **Menu at root bumps, always.** 10 consecutive root pops: 10 `right` bumps with `seq` 1…10, no
  coalescing. Planting a no-op turns 2 tests red.
- **Store outside React.** `Bun.resolveSync('react', packages/state)` throws — verified myself,
  outside the test. `packages/state/node_modules` contains one entry, `jotai`. Read, write,
  subscribe, unsubscribe and derived-atom subscription all work with no tree mounted. See the
  caveat in standing question 2.
- **Menu tree fidelity.** `MENU_ROOT` and `SETTINGS_ROOT` match 001 §4.2 row for row and in order,
  including the deliberate 2005 removals and the kept `Composers`.
- **Type escapes: zero.** No `any`, no `as unknown`, no non-null assertion, no `@ts-expect-error`,
  no `eslint-disable` anywhere in `packages/state/src`.
- **Forbidden names: zero.** `agentPresent|agentAttached|agentIdle|isAgentConnected` returns 0
  repo-wide in code. Exactly five `DeviceStateName`s and one `AppMode`. The eight deleted names
  appear only inside one TSDoc block that warns against reintroducing them.
- **No `useState`** in `packages/state`, and neither known-open escape (`R['useState'](0)`,
  destructured alias) is used.
- **Commit hygiene.** No `Co-Authored-By`, `Claude-Session` or "Generated with" on any of the seven
  commits. `002` / `implementation-spine` / `workstream` appear 0 times in `packages/state/src`.
- **D-034.** `55b34dd` does contain six files belonging to the Apple spike lane, exactly as the
  diary and the D-034 correction record. `cert/` is gitignored with 0 tracked files. The disposition
  is the lead's and I am not reopening it.
- **TSDoc.** Every export carries it, and it documents behaviour, invariants and footguns rather
  than restating signatures. This is above the stated bar. The defects I found in it are the four
  places where it describes behaviour the code does not have (Majors 3 and 4, Minors 1 and 6) —
  which is the risk of documentation this assertive, and the reason those are findings rather than
  nitpicks.

## Suggestions (non-blocking)

- `resetInputState` (`store.ts:238`) and `clearAnnouncer` (`announce.ts:170`) are exported and
  called by nothing but their own tests. The diary already says to delete them if still unused when
  the panel lands; worth doing then rather than finding a use.
- `startAnnouncer` returns a combined unsubscribe-and-cancel and that path is correct — including
  the re-entrant `arm()` fired from inside the flush. Adding an `AbortSignal` overload would let W3
  tie it to a component lifetime without holding the closure.
- W3 note, from standing question 2: pinning `jotai` (D-043) protects jotai's identity, not
  `@webpod/state`'s. Two resolutions of `@webpod/state` produce two `screenStackAtom`s and the same
  silent symptom. Worth an assertion in W3 that the store its `Provider` receives is `deviceStore`.

---

## Gates I ran myself

Every command below was run by me in this working tree unless marked otherwise. Nothing was
committed, staged, added or reset; `git status --porcelain packages/state` is empty and
`git diff --stat packages/state` is empty at the time of writing.

| Command | Result |
|---|---|
| `bunx tsc --noEmit -p packages/state/tsconfig.json` | exit 0, clean |
| `bun run typecheck` | **11/11 projects clean** |
| `bun run lint` (`bunx --bun eslint .`) | exit 0, clean |
| `bun test packages/state` | **93 pass, 0 fail**, 267 assertions |
| `bun test` (repo-wide) | **140 pass, 0 fail**, 365 assertions |
| `bun run gates` | exits 1 — `bun run gates: not implemented`. W0's placeholder, W5's work, not a W2 regression |
| `grep -rniE 'agentPresent\|agentAttached\|agentIdle\|isAgentConnected'` repo-wide | 0 hits in code (4 hits, all in `docs/` prose describing the gate) |
| `grep -rn 'useState' packages/ apps/` | 1 hit, a comment in another lane's `_probe.capabilities.tsx`; 0 in `packages/state` |
| `grep -rnE 'CONFIRMING\|CO_PILOT\|AGENT_DENIED\|SOLO_HUMAN\|AGENT_ATTACHED_IDLE\|AGENT_PENDING_CONSENT\|AGENT_STAGED\|HUMAN_PRIORITY_LOCK' packages/ apps/` | 3 hits, all one TSDoc block at `contract.ts:98-100` warning against reintroducing them |
| U8 permission grep over `packages/state/src` | 3 hits at `contract.ts:96,186,187`, all prose stating the model does not exist |
| Type-escape scan (`any`, `as unknown`, `!.`, `@ts-expect-error`, `eslint-disable`) over `packages/state/src` | **0** |
| `Bun.resolveSync('react', packages/state)` | throws `Cannot find package 'react'` — verified outside the test suite |
| `ls packages/state/node_modules` | one entry: `jotai` → `jotai@2.20.3` |
| `grep '"jotai"' packages/*/package.json apps/*/package.json` | one declaration, `packages/state`, exact `2.20.3`, no caret |
| `ls node_modules/.bun \| grep jotai` | exactly one installed copy |
| `git archive <commit>` → clean dir → `bunx tsc --noEmit -p packages/state/tsconfig.json`, for all five implementation commits | **all five exit 0** — the standalone-typecheck claim reproduces |
| `git log -1 --format='%s%n%b'` × 7 commits, grepped for trailers | clean, all seven |
| Real-timer skew probe, 400 iterations, `setTimeout(due - Date.now())` | `fired-early=0 worst=0ms` — Minor 3 is not reachable via Bun's default timers today |

### Violations I planted, and what happened

All planted by me, all different in mechanism from the engineer's three (`evidence/w2-mutation-check.txt`).
Originals were copied to a scratchpad and restored byte-for-byte after each run; the tree was
verified clean afterwards.

| # | Plant | Where | Result |
|---|---|---|---|
| 1 | Keyboard acceleration, **rate-gated** (`×3` when the previous detent was < 20ms ago) | `detent.ts:199` | **RED — 1 fail.** "NO acceleration, ever: 40 keydowns 5ms apart" |
| 2 | Every movement announces immediately, planted in the **store** rather than the announcer (`urgency: outcome.announce` → `'immediate'`) | `store.ts:283` | **RED — 8 fail** across two suites |
| 3 | React made reachable — symlinked `react` and `react-dom` into `packages/state/node_modules` | package boundary | **RED — 1 fail.** "React is not reachable from this package at all" |
| 4 | Silence seam bypassed for `'system'` only, leaving `silenced` itself correct (`clickerTicks` re-derived from `source === 'agent'`) | `detent.ts:253` | **RED — 1 fail.** "system movement is silent too" |
| 5 | `Menu` at root becomes a no-op (`bump: 'right'` → `null`) | `screen.ts:144` | **RED — 2 fail** |
| 6 | `readScreen` reports `visibleRows: frame.rows.length` | `screen.ts:191` | **RED — 1 fail** |
| 7 | **D-042 reverted:** `VISIBLE_ROWS = { compact: 7, medium: 7, airy: 7 }` | `contract.ts:159-163` | **GREEN — 93 pass, 0 fail, tsc exit 0.** → Major 2 |
| 8 | Arc geometry falsified: `arcDegPerDetent 15→20`, `touchDeadZone 18→30`, thresholds `240/540 → 100/200` | `contract.ts:389-407` | **RED — 7 fail** |
| 9 | **U13's constant reverted:** `ANNOUNCE_DEBOUNCE_MS 350 → 50` | `contract.ts:809` | **GREEN — 93 pass, 0 fail.** → Major 2 |
| 10 | `hapticSuppressAbovePerSec 12 → 1200` | `contract.ts:432` | **RED — 1 fail** |

### Hostile behavioural probes (no source modified)

| Probe | Result |
|---|---|
| 200 keydowns 1ms apart, pure reducer | 200 rows, multiplier set `{1}`, every `\|detents\|` = 1 — **holds** |
| 200 alternating-direction keydowns, all `timestampMs: 0` | net 0 rows, every multiplier 1 — **holds** |
| Keydown injected into an arc gesture wound to the ×7 multiplier | 1 detent, 1 row, multiplier 1 — **holds** |
| 200 keydowns through `detentActionAtom` | `highlightIndex` exactly 200 — **holds** |
| 10 path × source combinations for silence | all silent, all still move — **holds** |
| Agent supplying `agentOrigin: 'human:touch'` | `actor: 'agent:human:touch'`, silenced — **holds** |
| 200-detent flick through the store | 0 mid-flick, exactly 1 after settle — **holds** |
| 30 detents each 349ms apart, flushed at every 349ms boundary | 0 mid-flight, exactly 1 at the end — **holds** |
| 30 detents timestamped with `performance.now()`, default `startAnnouncer` | **30 announcements** — Major 1 |
| `densityAtom` set to `'airy'` over a `compact` frame | `visibleRowCount` stays 8 — Major 3 |
| `pageRows: 7` through `detentActionAtom` on a compact screen | moves 7 rows — Major 2 |
| `multiplier` on `key` + `page` | **8**, documented as always 1 — Minor 1 |
| Driver clock reading 1349 against a due time of 1350 | announcement stranded, never re-armed — Minor 3 |
| `popScreen([])` | `{ stack: [], bump: 'right' }` — Minor 4 |
| `direct` detent of 1000 on a 10-row screen | clamps to row 9, window correct, `rowDelta` still reports 1000 — **holds** |
| Two module instances of the state package (`import()` of `index.ts`) | same `deviceStore` object — **singleton holds** within one resolution |

---
---

# Re-review — W2 fixes

Commits re-reviewed: `a16c48f` (the nine fixes), `f8b1435` (grep hygiene), `7087d54` (docs and
evidence). Everything below was run by me in this working tree. Nothing was staged, added, reset or
committed; `git status --porcelain packages/state` is empty at the time of writing. The two items
the coordinator excluded — `bun run gates` exiting 1 (W0's placeholder, W5a unstarted) and the
repo-wide `react-hooks/refs` lint failure in the device lane's `[_]spike.device.tsx` — are not
reported as W2 findings. `bunx --bun eslint packages/state` is clean on its own.

## Verdict: REQUEST_CHANGES

**All four original Majors are genuinely fixed, and three of them are fixed better than I asked.**
The two plants that stayed green now go red at exactly the claimed counts. Every one of the nine
Minors and INFOs is closed. The D-054 shape-change claims are real: I proved each one with `tsc`
rather than by reading the comment that asserts it.

**Four new Majors, all in the new code.** Three of them are the same defect the fix was written
against, surviving one seam over: two clocks reconstructed in `BumpEvent.at`; a density write that
the TSDoc explicitly blesses leaving the highlight off-screen; and a D-051 guard whose counter is
off by one, so the *first* production call — the exact call D-051 names — succeeds. The fourth is
new: the coast travels four times as far at 30fps as at 120fps.

---

## The three standing questions (D-038, D-040, D-048)

**1. Does any finding here contradict the method used to produce the rest of it?**

Yes, and it produced R2 and R3. My round-1 Major 1 rested on a general principle — *two time
sources reaching one comparison is the defect, not the particular pair* — and I verified the fix by
re-running the particular case (`performance.now()` timestamps against `Date.now()`). Re-running
one case tests the instance, not the principle. So I went looking for any other place a
caller-supplied number and a device-clock number land in the same field, and found `BumpEvent.at`
with three writers on two scales (R2). The same move applied to Major 3: I had asserted "no writer
reconciles `densityAtom`", the fix added two writers, and I verified *those*. Asking instead
"is there a route that changes density and does **not** reconcile" found the one the TSDoc
recommends (R3). Both new Majors come from spending the round-1 method rather than re-running the
round-1 test.

**2. Does the reason given actually support the conclusion?**

The D-051 test at `store.test.ts:283` is the clearest instance I have seen of this. It stubs
`NODE_ENV='production'`, calls `createDeviceStore()`, and correctly observes a throw — so it is
green, and the conclusion it is written to support ("a second device outside a test throws") is the
right conclusion to want. But it passes because **twenty-five earlier `createDeviceStore()` calls in
the same file have already pushed `devicesBuilt` past 1**. In a real document the counter starts at
0, because the singleton is built through `buildDeviceStore` which does not increment it. I ran the
same call in a fresh module with no test runner and it returned a second store without complaint.
Right assertion, green for a reason that does not support it, and the failure it certifies against
is still fully reachable.

I also checked the conclusion *I* am endorsing about Major 1. "U13 holds" is now supported by three
measurements on three timestamp domains rather than by one, and by a `tsc` proof that no caller
time can reach the comparison at all. That reason does support it.

**3. Where a caution is applied inconsistently, the inconsistency is the finding.**

D-049 was promoted from my round-1 review and the fix applies it thoroughly to four seams. It is
then not applied to `popScreenActionAtom` and `pressActionAtom`, which still take a caller's time
and publish it (R2); and D-054 is applied to `AnnouncerDriverOptions.now` and `DetentInput.pageRows`
— both deleted — but not to `densityOverrideAtom` and `dynamicTypeScaleAtom`, which stay publicly
writable in a way that produces an invalid state, with a TSDoc explaining that this is deliberate
(R3). Same author, same commit, same two laws, four seams closed and three left open. That is the
finding, not the individual seams.

**D-048 — a flag is not an answer.** `CoastStepFn`'s TSDoc names the frame-rate mechanism
explicitly (*"the decay is specified per frame rather than per second, so this scales the distance
travelled and not the decay itself"*) and stops there. Naming the mechanism is not settling whether
its consequence is acceptable, and the consequence is a 4× spread (R4). Two lines of arithmetic
settle it; it was cheap the whole time.

---

## Was landing the four Majors as one commit the right call?

**The claim holds for one pair and over-generalises for the rest. At least three commits were
available, probably four.** I checked the symbol graph rather than taking the reasoning:

| Fix | New symbols | Referenced by |
|---|---|---|
| clock | `clockAtom`, `ClockHolder`, `defaultNow` | `contract.ts`, `store.ts` |
| coast | `coastStep`, `coastActionAtom`, `coastDecayPerFrame`, `coastFloorDegPerSec` | `contract.ts`, `detent.ts`, `store.ts` |
| density | `effectiveDensityAtom`, `densityOverrideAtom`, `dynamicTypeScaleAtom`, `AIRY_FORCING_TYPE_SCALE` | `contract.ts`, `store.ts`, `menu.ts` |
| page size | `viewportRows` parameter | `contract.ts`, `detent.ts` |
| silence extraction | `isSilenced`, `feedbackFor` (`silence.ts`) | `detent.ts`, `store.ts` |

- **The coast references no clock, density or page-size symbol** (`grep -nE "clock|Clock|density|Density|viewportRows|page"` over `detent.ts:280-399` → nothing). **The clock code references no coast symbol** (over `store.ts:456-566` → nothing). **`silence.ts` references none of the four.**
- The one genuine interlock is **page size × density**: `detent(…, viewportRows)` is fed from `visibleRowCountAtom`, which is the density fix. Splitting those two would need an intermediate where the reducer takes a viewport that no atom coherently supplies. That pair belongs together and the engineer is right about it.

`coastActionAtom` calls `applyMovement`, which reads `clockAtom` — but that is a consequence of the
chosen order, not a necessity: a coast-only commit landing first would call the pre-fix
`applyMovement` that took a timestamp, exactly as `detentActionAtom` did. Either order typechecks.

**Sharing `contract.ts` is not interlocking.** Additive edits in disjoint regions of one file
create no dependency, and a commit is a chosen set of edits rather than a discovered one. A
four-commit split — `refactor: one silence predicate` → `fix: one clock` → `fix: one page size and
one density` → `feat: the inertial coast` — is available and each part typechecks alone. The cost
is real: `a16c48f` is +1800/−363 across twelve files and four unrelated defects, and the D-051
counter bug (R1) is precisely the kind of thing that is easier to miss inside a commit that large.
Not a finding against the code; a judgement against the claim, which I was asked for.

---

## New findings

### [MAJOR · R1] D-051's guard is off by one — the first production `createDeviceStore()` succeeds (`packages/state/src/store.ts:311-322`, `store.ts:343`)

`deviceStore` is built by `buildDeviceStore({})`, which **does not increment `devicesBuilt`**. So in
a browser the counter is 0 when a consumer calls the factory, `devicesBuilt` becomes 1, `1 > 1` is
false, and a second store comes back. Run outside a test runner:

```
NODE_ENV = ""
FIRST  createDeviceStore() in production:  NO THROW  ← second store obtained
SECOND createDeviceStore() in production:  THREW — A second device store was constructed…
  singleton densityOverride = null
  second    densityOverride = airy
  same object? false
```

The TSDoc at `store.ts:309` states `@throws If called outside a test runner, or more than once for
the document.` The first clause is false. And D-051's own worked example —
`<Provider store={createDeviceStore()}>` — is **one** call, so the ruling's motivating case passes.
See standing question 2 for why the test does not catch it.

Two fixes, and D-054 prefers the second: (a) throw whenever `!underTest()`, unconditionally; or
(b) stop re-exporting the factory from `index.ts` (`index.ts:14` exports `./store` wholesale) and
move it to a test-only entry point, so the call a consumer would write does not resolve.

### [MAJOR · R2] Two clocks are still constructible: `BumpEvent.at` has three writers on two scales (`packages/state/src/store.ts:112`, `store.ts:179`, `store.ts:426`)

The announcer fix is complete and I could not break it. The same field one seam over is not fixed.
With a device clock pinned at `500000` and a caller passing `1.7e12`:

```
[2CLK] bump.at from detentActionAtom      = 500000        ← device clock  ✓
[2CLK] bump.at from popScreenActionAtom   = 1700000000000 ← caller
[2CLK] bump.at from pressActionAtom       = 1700000000000 ← caller
```

`applyMovement` stamps `get(clockAtom).now()`; `popScreenActionAtom(at: number)` and
`pressActionAtom` (which passes `input.timestampMs`) stamp whatever the caller supplies. One atom,
one published field, two time bases, chosen by which control the human touched. A panel that ages a
bump (`now - bump.at`) gets a sane answer for a wheel bump and a number near 1.7×10¹² for a `Menu`
bump. The coordinator's test is met: I can build two clocks again.

The remedy is the one already applied twelve lines away — delete the parameter, read `clockAtom`.
`popScreenActionAtom`'s `at` and `PressInput.timestampMs` are the last caller-supplied times that
reach a published field. I confirmed no caller time reaches a *comparison* any more: `detent()`'s
`sinceLastDetentMs` and `sinceLastEventMs` compare `input.timestampMs` only against values derived
from earlier `input.timestampMs`, which is self-consistent within one caller.

### [MAJOR · R3] The density write the TSDoc blesses leaves the highlight outside the window (`packages/state/src/store.ts:195-201`)

> *"⚑ Writing `densityOverrideAtom` directly works too, and is deliberately left possible:
> everything downstream reads `effectiveDensityAtom`, so the viewport size, the page size and the
> reported snapshot all move together with no reconciliation step to forget."*

It does not work. With the highlight on row 60 of a 100-row compact screen:

```
[DENS] via setDensityActionAtom        → highlight 60  window [57, 58, 59, 60]   ✓
[DENS] via densityOverrideAtom         → highlight 60  window [53, 54, 55, 56]   ✗
[DENS] via setDynamicTypeScaleActionAtom → highlight 60  window [57, 58, 59, 60] ✓
[DENS] via dynamicTypeScaleAtom        → highlight 60  window [53, 54, 55, 56]   ✗
```

The highlighted row is not among the rows reported or rendered. That is the *exact* failure
`visibleRowCountAtom`'s own comment names — *"the kind of off-by-one that only shows up as a row you
can never scroll to"* — reachable through the route the TSDoc recommends, on the field the fix was
written for. The sentence gets the mechanism right (derived reads do move together) and the
conclusion wrong (the *window* does not, and the window decides what is on the glass).

D-054's answer: do not export `densityOverrideAtom` and `dynamicTypeScaleAtom` as writable. Keep
them module-private and export only `setDensityActionAtom` / `setDynamicTypeScaleActionAtom`, so
the half-working route is unconstructible rather than documented as fine. This is the same move the
same commit made for `now` and `pageRows`.

### [MAJOR · R4] The coast travels 4× further at 30fps than at 120fps, and no test covers any rate but 1/60 (`packages/state/src/detent.ts:353-354`, `packages/state/src/contract.ts:461`)

`coastStep` decays the velocity **per call** (`speed * 0.94`) while scaling the distance by
`frameSeconds`. Total travel is therefore `v₀·Δt / (1 − 0.94)` — linear in the frame interval.
Measured, one identical flick:

```
[FPS]  30fps →  32 detents over 46 frames, 491.9 deg
[FPS]  60fps →  16 detents over 46 frames, 246.0 deg
[FPS]  90fps →  10 detents over 46 frames, 164.0 deg
[FPS] 120fps →   8 detents over 46 frames, 123.0 deg
[FPS] ratio 30fps/120fps = 4.00 ×
```

The frame *count* to rest is 46 at every rate, which is the tell: the decay is counting frames and
the travel is counting seconds, and the two disagree about what a frame is.

Why it matters rather than being a transcription question: this is a phone-first product,
ProMotion iPhones run at 120Hz and drop to lower rates under Low Power Mode and in background
tabs, so the same flick lands on a different row on the same device depending on power state. The
harm is the one D-042 was ruled on — counted movement must not depend on something the human cannot
see. All six coast tests in `detent.test.ts` (lines 658, 688, 701, 730, 746, 753) pass `1 / 60`, so
by D-050 the property is ungated: I could change the physics to any frame-rate law and nothing goes
red.

I record the counter-argument honestly, because it is the strongest one: 001 §4.4 says *"decays at
0.94/frame"*, and this workstream's law is transcribe-don't-redesign. But `coastStep` **takes
`frameSeconds`**, which is a decision to be frame-rate aware, and having taken it the decay must be
too (`0.94 ** (frameSeconds * 60)`). This needs a lead ruling of the D-042 / D-052 kind — either
the coast is frame-rate invariant, or the lead rules that a coast is display-dependent — but it
cannot be transcribed silently with the consequence unnamed. `decisions/w2.md` records the coast as
a fix; it does not record the 4×.

---

## The two plants that stayed green in round 1

Both now go red, at exactly the counts claimed.

| Plant | Round 1 | Round 2 |
|---|---|---|
| `VISIBLE_ROWS = { compact: 7, medium: 7, airy: 7 }` — D-042 reverted | **93 pass, 0 fail** | **126 pass, 10 fail** |
| `ANNOUNCE_DEBOUNCE_MS: 350 → 50` — U13's own constant | **93 pass, 0 fail** | **132 pass, 4 fail** |

`gates.test.ts` is the right answer to D-050: it asserts each ruling against a literal transcribed
from the spec, with the § cited and — in the `not.toBe(7)` case — the rejected value named so a
reader knows why the assertion exists.

## D-050 applied to every constant the fixes introduced

Each planted individually, tree restored between runs.

| Plant | Result |
|---|---|
| `AIRY_FORCING_TYPE_SCALE: 1.3 → 2.0` | **RED — 2 fail** |
| `DETENT.coastDecayPerFrame: 0.94 → 0.5` | **RED — 5 fail** |
| `DETENT.coastFloorDegPerSec: 60 → 5` | **RED — 1 fail** |
| `KEY_REPEAT_WINDOW_MS: 250 → 25` | **RED — 3 fail** |
| `ROW_HEIGHT_PX.compact: 26 → 99` | **RED — 1 fail** |
| `DETENT.hapticSuppressAbovePerSec: 12 → 1200` | **RED — 2 fail** |

**Nothing stayed green.** Every spec constant in the package is now gated. The one property I could
falsify without turning anything red is the coast's frame-rate law (R4), which is a behaviour
rather than a constant.

## Major 1 — the hardest look

The fix is structural, not documentary, and I could not defeat it.

| Probe | Result |
|---|---|
| 30-detent flick, `performance.now()` timestamps, **default** driver (the original bug, verbatim) | **1 announcement** (was 30) |
| Same flick, `Date.now()` timestamps | **1 announcement** |
| Same flick, `Math.random() * 1e13` timestamps — non-monotonic, wrong scale, adversarial | **1 announcement** |
| Device clock supplied via `createDeviceStore({ now })`, caller timestamps on a different scale | debounce due at `clock + 350`; flush before → `null`, at → announcement |
| Timer fires with the clock reading 1349 against a due time of 1350 (round-1 Minor 3) | **re-arms**, then speaks at 1350. Was: stranded forever |
| Can any caller-supplied time reach a comparison? | **No.** `flushAnnouncementsActionAtom` and `endGestureActionAtom` take no arguments; `AnnouncerDriverOptions.now` does not exist; `detent()`'s time deltas compare caller time only against earlier caller time |
| Can two clocks be rebuilt anywhere? | **Yes — `BumpEvent.at`.** See R2 |

The shape of the fix is right: one clock per device, in `clockAtom`, read by `applyMovement` and by
the driver, with the *only* injection point on `createDeviceStore`. "A second injection point is how
the halves came apart" is the correct diagnosis and the correct remedy.

## D-054 — the claims tested by type, not by comment

I compiled a file of deliberate misuses under the repo's own `tsconfig.base.json`. `tsc` reports an
**unused** `@ts-expect-error` as an error, so **exit 0 proves every directive suppressed a real
error and every control line compiled** — the enforcement is the type and the arity, not the prose.

```
tsc --noEmit → exit 0
  @ts-expect-error  detent(…, { …, pageRows: 7, … }, 8)          ← pageRows is not a property
  @ts-expect-error  detent(acc, keyInput)                         ← viewportRows is required (arity)
  @ts-expect-error  startAnnouncer(store, { now: () => 0 })       ← no `now` on the driver
  @ts-expect-error  store.set(flushAnnouncementsActionAtom, 12345)
  @ts-expect-error  store.set(endGestureActionAtom, 12345)
  controls: the five legitimate forms compile with no directive
```

`pageRows` is **gone from the type**, not ignored: `grep -rn pageRows packages/ apps/` returns one
hit and it is a comment. Page size is now the reducer's third argument, supplied by
`detentActionAtom` from `visibleRowCountAtom`. Paging by density holds through every route I could
find — `Shift+Arrow` 8 then `⏭` 8 on compact, then 4 and 4 after an `airy` override.

Applying D-054 in the other direction, as asked: **R1 and R3 are both fixes that added a check where
the shape could have been changed instead.** R1 added a counter; the shape change is to stop
exporting the factory. R3 added two action atoms and a comment asking people to use them; the shape
change is to make the raw atoms unwritable. Both are the same move the same commit made twice
correctly.

## Major 4 — the coast, verified

Real, pure, and correct except for R4.

| Property | Result |
|---|---|
| Momentum kept on `endGesture` above the floor; idle below it | ✓ released at 1000°/s → `coasting: true`; a slow arc → `coasting: false` |
| Decay is exactly 0.94 per frame | ✓ `speed₁ === speed₀ × 0.94` to 9 decimal places |
| Stops below 60°/s and returns to `IDLE_DETENT_ACCUMULATOR` | ✓ rest after **46** frames, matching `ceil(ln(60/1000)/ln(0.94))` computed independently |
| Pure — same accumulator in, same answer out, input unmutated | ✓ byte-identical outcomes, accumulator unchanged |
| Coasted detents click; an agent's coast is silent | ✓ human 16 ticks, agent 0 |
| U13 survives the coast | ✓ 10-detent flick + 46 coast frames → **0** announcements before settle |
| Same distance at any refresh rate | ✗ **4× spread — R4** |
| The rAF driver deferral is disclosed | ✓ `diary/w2.md` lines 295 and 311, in the omissions list, flagged as *"new to this list, which is the point"* |

## Everything else I re-verified

| Check | Result |
|---|---|
| `bunx tsc --noEmit -p packages/state/tsconfig.json` | exit 0 |
| `bunx --bun eslint packages/state` | exit 0 |
| `bun test packages/state` | **136 pass, 0 fail**, 498 assertions (was 93) |
| `bun test` repo-wide | **413 pass, 0 fail** |
| `git archive` → clean dir → `tsc` for `a16c48f`, `f8b1435`, `7087d54` | all three exit 0 |
| Commit trailers on the three new commits | clean |
| `002` / `implementation-spine` / `workstream` in `packages/state/src` | 0 hits |
| `agentPresent\|agentAttached\|agentIdle\|isAgentConnected` repo-wide in code | 0 |
| `useState` in `packages/state` | 0 |
| Type escapes — `any`, `as unknown`, `@ts-ignore`, `eslint-disable`, non-null assertion | **0**; and **0** `@ts-expect-error` in shipped source |
| U8 permission vocabulary in `packages/state/src` | 3 hits, all the same pre-cleared prose stating the model does not exist |
| **D-055** — `atom(fn)` sweep over every atom in the package | **clean.** `clockAtom` is the only atom holding a function and it is boxed as `{ now }`; the only other non-literal initialisers are `IDLE_DETENT_ACCUMULATOR` and `IDLE_ANNOUNCER_STATE`, both plain objects |
| D-051 static gate greps `packages` **and** `apps` | ✓ `store.test.ts:314` spawns `grep -rn --include=*.ts --include=*.tsx createDeviceStore packages apps` from the repo root. One narrowness: offenders are filtered by *file prefix*, so a real call added inside `store.ts`, `contract.ts` or `menu.ts` would be excluded — those are W2's own files, so the exposure is small, but the filter should match the doc-comment lines rather than the whole file |
| 200 keydowns 1ms apart | 200 rows, `multiplier` set `{1}`, `accelerated` false throughout |
| Keydown injected into a wound-up ×7 arc | 1 row, `accelerated: false` |
| Silence on all 10 path × non-human-source combinations | silent, still moves |
| 200-detent flick | exactly 1 announcement |

## Round-1 Minors — all closed

| Round-1 finding | Status |
|---|---|
| M1 `multiplier` documented "always 1 on the key path" | **Closed, and better than asked.** The doc now warns that reading `multiplier` for this gives a false positive on `Shift+Arrow`, and a new `accelerated: boolean` field answers the question honestly — `false` on key, scroll and direct paths always |
| M2 silence predicate duplicated in two files | **Closed.** `silence.ts` holds `isSilenced` / `actorFor` / `feedbackFor`; the reducer, the coast and the press handler are three *callers* of one rule |
| M3 early timer strands the announcement | **Closed.** `if (spoken === null) arm()` at `store.ts:555`, with the browser-coarsening reason recorded. Verified: re-arms at 1349, speaks at 1350 |
| M4 `popScreen([])` published a phantom root bump | **Closed.** `screen.ts:147` separates "no device yet" from "at the root"; verified `bumpAtom` stays `null` |
| M5 `menuRows` claimed to take visible children and did not | **Closed.** `MenuVisibility` predicate, rows re-indexed after filtering so a tool is told a screen position rather than a tree position — which is the right call and was not asked for |
| INFO duplicated "Nothing in / nothing in" clause | **Closed** |
| INFO 30 key detents → 2 announcements | Unchanged and correct per §4.4 |
| Standing-question-2 note: nothing stopped W3 building a second store | Promoted to D-051, fix attempted, **still open — R1** |

## Gates I cannot clear

**U14 (thumb occlusion) and the both-colourway aesthetic call remain owner-only — H-5, H-6.** The
coast makes this slightly more pointed than in round 1: `coastStep` now decides how many clicker
ticks and haptic pulses fire *after* the thumb lifts, and whether that feedback is right is a
question about a hand on real glass. Stating it rather than passing over it.

## Suggestions (non-blocking)

- `gates.test.ts` is the most valuable file added here. Its header explains why it must not be
  deleted as duplication, which is the failure mode a later reader would otherwise cause.
- `store.test.ts:314`'s static gate would be stronger as a repo-level check once W5a exists, since
  it currently only runs when someone runs this package's tests.
- The D-051 counter (`devicesBuilt`) becomes dead weight if the factory moves to a test-only entry
  point, which is the R1 fix I would prefer.

# Final re-review — W2 through D-063 (`4cd4a62`)

**2026-08-28 · fresh review after every prior round · implementation not edited**

## Verdict: REQUEST_CHANGES — 3 Major, 4 Minor

The reducer and store core now withstand the original review. I independently reproduced every
prior Major closure, replayed the coast at 15–240 Hz, ran the state suite sixteen ways concurrently
under six CPU hogs, and rebuilt every W2 commit from a clean `git archive`. The remaining blockers
are not hidden arithmetic defects: one deferred product policy is already implemented, the final
evidence and public contract disagree with the code and with each other, and the dispatch's static
acceptance gate still cannot run successfully.

## Findings

### Major 1 — D-063 says “do not implement either” haptic policy; W2 implements and gates suppression

The binding ruling defers the conflict between suppressing haptics above 12 detents/sec and firing
every third pulse, explicitly saying **“Do not implement either”**
(`decision-log.md:739-750`). W2's own handoff repeats that neither behavior is implemented and the
seam is left (`decisions/w2.md:776-783`; `evidence/w2-d063-wheel-model.txt:29-32`). That claim is
false:

- `contract.ts:497-502` publishes `hapticSuppressAbovePerSec: 12` as product policy.
- `silence.ts:72-73,93-98` converts that policy into `hapticPulses: 0` above the threshold.
- `gates.test.ts:162-164` and `detent.test.ts:271-287` deliberately lock suppression in.

This is not merely an actuator seam reporting neutral counts. It has already chosen the §4.9
behavior and removes every pulse before a future actuator layer can choose. Either D-063 must be
superseded by an owner ruling grounded in the now-read specialist §4.9, or W2 must leave a genuinely
policy-neutral seam. Until then the implementation contradicts settled law in the dangerous
direction: tests make the unauthorized choice harder to remove.

### Major 2 — the post-D-063 evidence and public contract are self-contradictory

`evidence/w2-coast-frame-rate.txt:45-67` says it was re-measured *after D-063* and reports
**16 detents / 74 rows / 240°**, including 46 frames at 60 Hz. The D-063-specific artifact reports
**17 detents / 32 rows / 255°**, including 63 frames at 60 Hz
(`evidence/w2-d063-wheel-model.txt:34-51`). I replayed the current implementation independently:
the second table is correct at every sampled rate (15, 30, 60, 120 and 240 Hz). The older artifact
therefore presents stale pre-D-063 measurements as a current re-measurement.

The stale account is also still embedded in the published contract:

- `contract.ts:402-406` says every detent number comes from §4.4 even though D-063 replaced five
  behaviors from specialist §9.4.
- `contract.ts:854-859` still specifies a 60°/s floor, while the implementation and ruling use 21.
- `contract.ts:870-872` says elapsed time scales distance but not decay, the exact frame-dependent
  model D-060 removed.
- `detent.test.ts:673` and `evidence/w2-coast-frame-rate.txt:78-87` still describe stopping below
  60°/s.

Evidence is a required acceptance artifact here, not historical scratch output. A future engineer
can follow the most confidently labelled “re-measured” file or the public function contract and
reintroduce a behavior the gates reject. Reconcile or explicitly supersede the stale artifacts and
make the exported TSDoc describe the implementation that actually shipped.

### Major 3 — W2's required static acceptance gate is still unavailable

The W2 dispatch requires `bun run gates` in addition to tests, TypeScript and lint
(`dispatch/W2-state.md:34-35`), and the initiative DoD requires that command to return zero findings
(`scope.md:72,91`). At this final review it still exits 1 with the scaffold placeholder
`bun run gates: not implemented`. W5a owns the runner, so this is not authorization for W2 to edit
`scripts/`; it is nonetheless an acceptance blocker. The slice cannot be called finally green while
one of its mandatory checks does not exist.

### Minor 1 — the internal-module boundary comment is stale

`internal.ts:4-6` says `package.json` exposes only `.`. It now exposes both `.` and `./testing`.
The security property still holds — `./internal` is absent — but the stated proof is factually
wrong and should name the actual closed export map.

### Minor 2 — the D-063 mutation artifact does not record its edit precondition

`evidence/w2-d063-go-red.txt:8-13` says sources were restored between runs and then records nine red
plants, but it does not record a diff/hash/grep proving each mutation landed. Red results make these
particular plants credible under D-064, and I confirmed the current behavioral gates independently;
the artifact still fails the standing evidence format established at `decision-log.md:769-779`.

### Minor 3 — one implementation comment still names the superseded ×7 tier

`detent.ts:433-435` describes a flick “moving 7 rows per detent.” D-063's tiers are ×1/×4/×12.
The code uses the correct constants; the explanation is stale.

### Minor 4 — W2's final gate artifact predates its final two commits

`evidence/w2-gates.txt` identifies `7765438` as its tested revision. The timing-test correction
`a7fbaee` and final documentation commit `4cd4a62` came later. My independent current-HEAD checks
are green except for the missing static runner, but the committed evidence does not establish that.

## Prior findings and required invariants — independent closure check

| Surface | Final result |
|---|---|
| One clock | **Closed.** Gesture timestamps are used only for within-gesture deltas; bumps, announcement due-times, flushes and the driver all read the boxed device `clockAtom`. No `Date.now()`/`performance.now()` comparison is rebuilt in store actions. |
| Singleton/test factory | **Closed.** `deviceStore` is the public singleton; `createDeviceStore` is absent from `@webpod/state`, present only at `@webpod/state/testing`, and throws on the first production call. The fresh-process guard test is independent of prior test state. |
| Density and page size | **Closed.** Writable primitives are private, public density atoms are read-only, the action re-clamps every frame, Dynamic Type forces airy density, and reducer paging receives the effective viewport from the store rather than a caller-provided value. Literal gates reject `{7,7,7}` and a moved 350 ms debounce. |
| Announcer/U13 | **Closed.** A 30-detent flick produces one polite announcement; keyboard behavior remains immediate/countable; early timeout re-arm is bounded. |
| Coast determinism | **Closed in code.** Current replay is exactly 17 detents / 32 rows / 255° from 15–240 Hz; frame count alone scales. Variable-rate replay agrees. The rAF driver remains explicitly deferred. |
| D-063 acceleration | **Closed.** ×1/×4/×12 at 720/1080°/s; only lists over 40 rows accelerate; ω clamps at 1440°/s; reversal-only 1.8° hysteresis does not touch keyboard input; coast floor is 21°/s. The nine recorded falsifications all turn tests red. |
| Haptic seam | **Open — Major 1.** The code resolves the policy D-063 deferred. |
| Timer stability | **Closed.** Sixteen concurrent package suites under six CPU hogs: 16/16 green, 181 tests each, zero failures. |

## Gates and history

| Check | Result |
|---|---|
| `bunx tsc --noEmit -p packages/state/tsconfig.json` | exit 0 |
| `bunx --bun eslint packages/state` | exit 0 |
| `bun test packages/state` | 181 pass, 0 fail |
| `bun run lint` | exit 0 repo-wide |
| `bun test` | 651 pass, 0 fail repo-wide at current HEAD |
| `bun run gates` | **exit 1 — placeholder; Major 3** |
| 19 W2 commits rebuilt with `git archive` | every commit typechecks; every commit containing tests passes its then-current suite |
| Trailer scan | no `Co-Authored-By`, `Claude-Session`, or `Generated with` trailer |
| Changes after `4cd4a62` under `packages/state` | none |
| Working-tree changes under `packages/state` | none |

The first contract-only commit has no test files, so `bun test packages/state` correctly has no
matching suite there; I did not misreport Bun's “no tests found” exit as a passing test run.

## Jotai grounding

Jotai claims were checked against the current local source, not the stale `agent-context` path:

- `/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`
- `/Users/vinicius/code/agentic-context/jotai/src/vanilla/store.ts`
- `/Users/vinicius/code/agentic-context/jotai/src/vanilla.ts`

Those sources confirm the vanilla store's `get`, `set` and `sub` contract, `sub`'s unsubscribe
return, and the distinction between Jotai's module default store and a custom `createStore()`.
W2's explicit module singleton plus test-only custom-store boundary is therefore consistent with
the exact installed architecture, not a remembered React-provider pattern.

## Gates I cannot clear

U14 thumb occlusion and the both-colourway aesthetic call remain owner-only under H-5/H-6. This
review makes no claim about either. No implementation file was edited, staged, reset or committed.

# Re-review — W2 final-review fixes (`6e7fca1`, `ece7a24`)

**2026-08-29 · independent replay against every finding above · implementation not edited**

## Verdict: APPROVE — 0 Critical, 0 Major, 1 Minor, 1 Info

### Correctness Check

- **Source of truth:** AGENTS.md; 002 scope, W2 dispatch, D-063/D-064/D-066, HITL register,
  review-system prompt, full W2 diary/decisions/evidence, and every earlier section of this review.
  Jotai behavior was rechecked against
  `/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`,
  `/Users/vinicius/code/agentic-context/jotai/src/vanilla/store.ts`, and
  `/Users/vinicius/code/agentic-context/jotai/src/vanilla.ts`.
- **Kanban ticket:** none by repo law; the workstream tracker is the queue.
- **Correctness target:** W2 reports countable movement and candidate feedback while enforcing
  actor/path silence once; no high-rate haptic actuator policy is selected in state.
- **Dispatch scope:** `6e7fca1` changes only six W2 implementation/test files. `ece7a24` changes
  only W2 diary, decisions and evidence. No foreign file was swept into either commit.
- **Dependency/HITL status:** D-063's haptic choice remains deferred. U14 and the both-colourway
  call remain owner-only and are not claimed here.
- **Neuve HITL gate:** unavailable and inapplicable by AGENTS.md; this repo has no Neuve board or
  Neuve shell workflow.
- **DoD checklist:** scoped TypeScript, lint and tests pass. The static gate runner executes, but
  five lexical/foreign findings are classified under Info below rather than charged to W2.
- **Review lanes:** state semantics, haptic/silence boundary, mutation evidence, documentation,
  gates and history were all re-run in this review.
- **Type/lint/doc gates:** clean except the one stale evidence artifact in Minor 1.
- **Git history/staging:** both commits are ordered after `4cd4a62`, are trailer-free, and build
  independently from `git archive`. `packages/state` is byte-clean in the working tree.
- **Verification evidence:** 181 scoped tests pass; the repository gate run executes 697 tests
  with zero failures. Three new haptic mutations and all nine D-063 mutation hashes were verified
  independently.
- **Decision-log status:** D-063 is now followed literally: neither suppression nor every-third
  vibration is selected by W2.

### Findings

- **[MINOR] The canonical W2 gate transcript still stops at `7765438`.**
  `evidence/w2-gates.txt:1-46` remains labelled as a run on `7765438`; it does not record the
  successful scoped checks for `6e7fca1` and `ece7a24`. The implementation and current review are
  independently green, so this is not a behavioral blocker, but it is the only finding from the
  prior final review that the two commits did not close. A resumable fixer should append a dated
  section for `ece7a24` with scoped `tsc`, scoped ESLint, 181 state tests, the two archive checks,
  and the accurately classified W5a/foreign static-gate output. Do not rewrite the historical
  `7765438` run.

- **[INFO] `bun run gates` is operational; its five failures are W5a matcher/foreign findings,
  not W2 failures.** The runner's own TYPES, LINT and TESTS stages pass. The residual findings are:
  U8's clearance names `packages/panel/e2e/panel.spec.ts` while the foreign file is
  `panel.e2e.ts`; U9 matches truthful `useState` prohibition comments; HAPTICS matches
  `silence.ts:88` explaining why a non-touch path must never call `navigator.vibrate`; HALO matches
  ordinary English “handed”; and NAMING matches a foreign Apple spike's bookkeeping reference.
  `scripts/gate-core.ts:38-48,64,266,269-275` confirms these are broad line regexes. Removing or
  euphemising truthful W2 documentation would weaken the code to satisfy a false-positive grep and
  is not an acceptable fix. W5a should make the gates syntax/identifier-aware or narrowly clear
  truthful domain prose.

### Every prior final-review finding

| Prior finding | Re-review result |
|---|---|
| Major 1 — unauthorized high-rate haptic suppression | **Closed.** The threshold constant and rate branch are gone. `feedbackFor` has no rate parameter and returns one candidate pulse per human touch detent. |
| Major 2 — evidence/contracts contradict D-063 | **Closed.** Current evidence agrees on 17 detents / 32 rows / 255° and 21°/s. Exported TSDoc now describes time-normalized decay and the §9.4 specialist ruling. Historical measurements remain explicitly historical. |
| Major 3 — `bun run gates` was a placeholder | **Closed for W2.** The runner now executes. Its W2 type/lint/test stages pass; residual static findings are the W5a/foreign issues classified above. |
| Minor 1 — stale internal export-map comment | **Closed.** `internal.ts:4-6` truthfully names the closed `.` / `./testing` map and absence of `./internal`. |
| Minor 2 — mutation edits lacked landing proof | **Closed.** The before hashes equal the current source hashes, and I independently reproduced all nine after hashes exactly: `8dc6e73e…5b741`, `79c6dc81…1b33`, `684de5a0…ae95`, `d43f2bab…3df1`, `2ad8fe4c…aed2`, `ec3ea6d5…36b3`, `f6ac5497…3f05`, `db3451a6…0ee53`, and `b4fa3591…363f`. |
| Minor 3 — stale ×7 implementation comment | **Closed.** `detent.ts:434` now says ×12. |
| Minor 4 — final gate artifact predates final commits | **Still Minor 1 above.** |

### Haptic and silence semantics — independent mutations

Each mutation ran in a clean archive of `ece7a24`; the runner required a changed SHA-256 and an
exact grep match before running tests.

| Mutation | Result |
|---|---|
| Reintroduce a high-rate drop (`count > 3 ? 0 : count`) | **1 failure:** policy-neutral high-rate touch test |
| Remove actor silence from candidate pulses | **2 failures:** agent movement and agent coast |
| Remove the touch-path restriction | **2 failures:** keyboard and mouse haptic tests |

This is the required separation: W2 still enforces that agent/system movement is silent and only a
human touch path can request a pulse, while it does not decide whether an actuator suppresses or
samples a rapid stream. `detentsPerSecond` remains available beside the candidate count, so the
future actuator can implement either owner-ratified policy without reconstructing state or undoing
filtering.

### Verification

| Check | Result |
|---|---|
| `bunx tsc --noEmit -p packages/state/tsconfig.json` | exit 0 |
| `bunx --bun eslint packages/state` | exit 0 |
| `bun test packages/state` | 181 pass, 0 fail |
| `bun run lint` | exit 0 repo-wide |
| `bun run gates` type/lint/test stages | pass; 697 tests, 0 fail |
| `6e7fca1` from `git archive` | typecheck and 181 tests pass |
| `ece7a24` from `git archive` | typecheck and 181 tests pass |
| Commit trailers | none |
| `packages/state` worktree/diff after `ece7a24` | clean |

### Suggestions (non-blocking)

- Refresh `w2-gates.txt` without altering its truthful historical section.
- Fix W5a's lexical false positives at the matcher/clearance layer, not in truthful product docs.

### Neuve Dogfood Feedback

- **Commands run:** none; AGENTS.md states there is no Neuve shell or Kanban board.
- **Artifact refs:** none.
- **Kanban updates:** none.
- **HITL gate:** no Neuve-routed unit exists.
- **Signal value / sticking points / format feedback / backlog signals:** not applicable.
- **Feedback artifact:** not created because Neuve is unavailable by repo law.
