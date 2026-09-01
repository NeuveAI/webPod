# Diary — W9b · interaction audio

**Lane:** W9b · **Status:** implementation complete; owner listening pass and
independent runtime review remain.

## What landed

The state package now publishes a read-only, sequence-numbered interaction
feedback event only after the authoritative press or detent outcome exists.
The event carries the already-decided `clickerTicks`, `silenced`, actor, origin,
and button. Sub-detent travel, raw pointer movement, agent movement, and zero
budgets therefore never reach the audible path.

The composite package subscribes to that stream and owns one lazy Web Audio
runtime per mounted device. It makes three short procedural voices: an 8ms,
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
context. An activation that resolves after interruption is suspended again and
cannot revive audio in a hidden tab.

The runtime returns structured scheduled/silent/deferred/unavailable results.
It does not log failures. The mounted root mirrors bounded diagnostics through
`data-wp-audio-*` attributes so browser evidence can distinguish locked,
running, suspended, and no-sound states without console instrumentation.

## What testing changed

The first scheduler passed ordinary resume and disposal tests but had a race:
if a suspended context finished resuming after the document became hidden, its
old promise could set the runtime back to `running`. An activation epoch now
invalidates that completion and immediately re-suspends the context. A second
test found that unsupported Web Audio was reported as generic `not-activated`
after the failed activation; it now remains explicitly `unsupported`.

The browser-control pass could not produce a human activation—and should not be
able to. In the available T3 in-app browser, an automated 10-detent wheel input
left the runtime locked and produced `silent:not-activated:0/10`, with no
warning or error. The audible `running` path is therefore an owner listening
step, not something the test driver spoofs.

## Current gates

- W9b focused tests: 20 pass, 0 fail, 160 assertions.
- Repo tests: 1,073 pass, 0 fail.
- Repo lint: clean.
- Production build: clean; Vite retains its existing large-chunk warning.
- State and composite TypeScript: clean.
- Repo TypeScript: 11/11 projects clean.
- `bun run gates`: 16 automated pass, 0 fail; standing manual U14/U15 remain.

## Owner listening pass

Open `http://localhost:3000/_spike/device` in the T1 browser, make one genuine
click/tap to unlock audio, rotate the wheel slowly and rapidly, press Select,
then background and restore the tab. The wheel should be lighter and shorter
than Select, rapid detents should remain individual without a loud stack, and
returning from background must not release queued sound. The `data-wp-audio-*`
attributes on the composite root provide the accompanying event transcript.
