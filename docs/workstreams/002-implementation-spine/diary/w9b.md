# Diary — W9b · interaction audio

**Lane:** W9b · **Status:** technical re-review approved, all remaining Minors
fixed, and owner sound-quality gate approved.

## What landed

The state package now publishes a read-only, sequence-numbered interaction
feedback event only after the authoritative press or detent outcome exists.
The event carries the already-decided `clickerTicks`, `silenced`, actor, origin,
and button. Sub-detent travel, raw pointer movement, agent movement, and zero
budgets therefore never reach the audible path.

The implementation summary below records the original 2026-09-01 model. The
2026-09-02 owner-recording section supersedes its physical-button composition
and gain values while preserving the approved digital detent.

The composite package owns one store-scoped exact-once subscription hub across
all mounted devices. Each boundary may hold a lazy Web Audio runtime, but one
sequence has one selected audio owner. It makes three short procedural voices: an 8ms,
3kHz-filtered wheel tick; a 16ms Select click; and a 12ms secondary button
click. The source is deterministic noise plus a small decaying plastic body,
not an external sample and not a notification oscillator.

The physical Select surface added by W9a now crosses the composite boundary on
release and dispatches exactly one human `pressActionAtom`. Cancellation,
lost capture, an unmatched pointer, or a repeated release dispatches nothing.
This closes the real-device path; testing `pressActionAtom` in isolation was not
enough.

## Lifecycle

No `AudioContext` exists before activation. The composite uses `Event.isTrusted`
on pointer-down or key-down as its default browser-autoplay eligibility signal,
constructs/resumes the context there, and keeps only a bounded activation queue.
That flag identifies user-agent dispatch; it is not proof that a person caused
the event. Human/agent sound eligibility remains state-owned. Blur, hidden
documents, explicit mute, and disposal clear pending feedback, stop
active/scheduled sources, and suspend or close the context. A monotonic
lifecycle-operation identity covers activation, blur, hidden, mute, and
disposal. Older suspension or resume completions cannot overwrite newer intent;
a newer activation waits out and repairs any older pending suspension before it
reports `running`. Terminal `unsupported`, `failed`, and `disposed` diagnostics
survive later mute changes and blur/hidden/unmount interruption calls.

The runtime returns structured scheduled/silent/deferred/unavailable results.
It does not log failures. The mounted root mirrors bounded diagnostics through
`data-wp-audio-*` attributes so browser evidence can distinguish locked,
running, suspended, and no-sound states without console instrumentation.

## What testing changed

The first scheduler passed ordinary resume and disposal tests but had a race:
if a suspended context finished resuming after the document became hidden, its
old promise could set the runtime back to `running`. The first one-way epoch
guard closed that case but not its mirror: an old suspension could still defeat
a newer activation. The review fix replaced it with operation ordering across
both directions. Another test found that unsupported Web Audio was reported as
generic `not-activated` after the failed activation; it remains explicitly
`unsupported`.

The antagonistic review added nine failing plants: deferred blur and mute
suspensions, stale resume rejection after disposal and interruption, duplicate
attachment, duplicate public mounts, malformed agent provenance, and the
unreachable mounted mute seam. They failed **18 pass / 9 fail** before the
fixes and now pass as permanent tests. The public feedback shape is human-only,
the mounted component exposes `interactionAudioEnabled`, and the unreachable
`rate-limit` reason is gone.

The available T3 in-app-browser attempt happened to leave the runtime locked: an
automated 10-detent input produced `silent:not-activated:0/10`, with no warning
or error. That observation proves only that this particular event path did not
activate Web Audio. The re-review's headless-Chromium `page.mouse.click()` did
produce an `isTrusted` event and moved the runtime to `running`, which is valid
browser behavior and demonstrates why `isTrusted` is not a human-provenance
check. Agent silence instead comes from the authoritative actor/silence
contract. A real Chromium
`OfflineAudioContext` renders the production graph into a reproducible WAV so
the owner can judge the synthesis without relying on graph assertions.

The technical re-review's final plants also changed the implementation in three
small ways: terminal lifecycle labels can no longer be overwritten by mute or
interruption; the renderer under `packages/composite/scripts/` is now included
in the package's normal TypeScript project; and the public activation predicate
is named and documented as event eligibility rather than human provenance.

A final closure plant exposed one ordering hole inside that first claim:
`setEnabled(false)` wrote the ordinary `suspended` label after
`requestSuspend()` returned from a synchronous throw, erasing the terminal
`failed` result. The muted provisional label is now written before the platform
request, so either synchronous or asynchronous suspend failure supersedes it
with `failed`. The permanent fake backend throws synchronously rather than
returning a rejected promise, and asserts both the lifecycle and structured
`graph-failed` result.

## Current gates

- W9b focused tests: 33 pass, 0 fail, 197 assertions.
- State + W9b focused tests: 69 pass, 0 fail, 282 assertions.
- Repo tests: 1,089 pass, 0 fail.
- Repo lint: clean.
- Production build: clean; Vite retains its existing large-chunk warning.
- State and composite TypeScript: clean.
- Repo TypeScript: 11/11 projects clean.
- `bun run gates`: 16 automated pass, 0 fail; standing manual U14/U15 remain.

## Owner listening pass

**Verdict: approved by owner.** After listening to the production-generated SFX,
the owner stated in this thread on 2026-09-01: “sounds just like the real thing,
great job.” This closes the W9b sound-taste gate.

## 2026-09-02 · Owner-recorded switch lifecycle correction

The owner supplied `clickwheel-sounds.m4a` and clarified a mistaken model in the
first implementation. The wheel itself is one digital detent. Every physical
button combines that digital actuation with a quieter switch-down transient and
a separate switch-up transient on actual release. The recording is 21.461333s,
mono AAC at 24kHz. Its isolated button clusters expose the second phase roughly
145–184ms after the first, which ruled out synthesizing a fixed-delay double
click.

The correction adds stable pointer/key contact identities across device and
composite. Down is exact-once, release is exact-once, hold timing is retained
while initial AudioContext activation resolves, and an admitted down reserves
capacity for its future up. Cardinal semantic acceptance still occurs only on
release; drag-off/cancel/lost capture cannot navigate. Store press feedback is
now deliberately silent in the audio runtime to prevent the direct lifecycle
from being replayed after state accepts the action. Rotational detents continue
through the authoritative state stream unchanged.

The owner preview now contains six fast detents, three isolated detents, a
160ms Center tap, a 650ms Center hold and a 170ms Menu tap. A companion JSON
labels every digital-down, physical-down and physical-up onset. The generated
WAV is 3.4s/48kHz mono PCM16, peaks at -33.957426dBFS, and has no clipped
sample. The physical balance still needs the owner's auditory validation; no
claim extends the prior approval beyond the unchanged digital voice.

Correction commit: `009fdd2` (`feat(audio): model physical button contact
phases`). Focused device/composite tests are 60 pass / 0 fail. Repo tests are
1,181 pass / 0 fail with 78,076 assertions. TypeScript is 11/11 clean, repo
lint is clean, the production build is clean, and `bun run gates` reports 16
automated pass / 0 fail with the standing manual U14/U15 checks still open. A
flagged production Chrome run of `cardinal-audio.e2e.ts` passed against source
fingerprint `de7d6b20ca3f9208ea5989990af85eed1b78d0adb7b73e7587b7060de2d91a2d`.
