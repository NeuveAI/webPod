# Diary — W9b · interaction audio

**Lane:** W9b · **Status:** review fixes complete; owner sound-quality verdict
and antagonistic re-review remain.

## What landed

The state package now publishes a read-only, sequence-numbered interaction
feedback event only after the authoritative press or detent outcome exists.
The event carries the already-decided `clickerTicks`, `silenced`, actor, origin,
and button. Sub-detent travel, raw pointer movement, agent movement, and zero
budgets therefore never reach the audible path.

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

No `AudioContext` exists before activation. The composite listens for a trusted
pointer-down or key-down, constructs/resumes the context there, and keeps only a
bounded activation queue. Blur, hidden documents, explicit mute, and disposal
clear pending feedback, stop active/scheduled sources, and suspend or close the
context. A monotonic lifecycle-operation identity covers activation, blur,
hidden, mute, and disposal. Older suspension or resume completions cannot
overwrite newer intent; a newer activation waits out and repairs any older
pending suspension before it reports `running`.

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

The browser-control pass could not produce a human activation—and should not be
able to. In the available T3 in-app browser, an automated 10-detent wheel input
left the runtime locked and produced `silent:not-activated:0/10`, with no
warning or error. The audible `running` path is therefore an owner listening
step, not something the test driver spoofs. A real Chromium
`OfflineAudioContext` now renders the production graph into a reproducible WAV
so the owner can judge the actual synthesis without relying on graph assertions.

## Current gates

- W9b focused tests: 30 pass, 0 fail, 187 assertions.
- State + W9b focused tests: 66 pass, 0 fail, 272 assertions.
- Repo tests: 1,086 pass, 0 fail.
- Repo lint: clean.
- Production build: clean; Vite retains its existing large-chunk warning.
- State and composite TypeScript: clean.
- Repo TypeScript: 11/11 projects clean.
- `bun run gates`: 16 automated pass, 0 fail; standing manual U14/U15 remain.

## Owner listening pass

**Verdict: pending owner.** Listen first to
`evidence/w9b-interaction-audio-preview.wav`: Select occurs at 0.12s, six wheel
ticks begin at 0.40s, and a secondary button occurs at 0.78s. Then open
`http://localhost:3000/_spike/device` in the T1 browser, make one genuine
click/tap to unlock audio, rotate the wheel slowly and rapidly, press Select,
then background and restore the tab. The wheel should be lighter and shorter
than Select, rapid detents should remain individual without a loud stack, and
returning from background must not release queued sound. The `data-wp-audio-*`
attributes on the composite root provide the accompanying event transcript.
