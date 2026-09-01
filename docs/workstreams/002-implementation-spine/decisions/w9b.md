# Decisions — W9b · interaction audio

## Sources read

Repository sources were read before implementation: `AGENTS.md`, the complete
W9 dispatch, workstream 002 scope/decisions/reviews, state detent/store/silence
contracts and tests, composite click-wheel lifecycle, current app/provider
surfaces, and the W9a input seam.

The local dependency source was
`/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`; its
`get`/`set`/`sub` store contract is the subscription boundary used here. The
configured `global-patterns` reference points at the absent sibling
`~/code/agent-context/global.md`, so no claim was taken from that broken alias.

Browser behavior was grounded in the W3C Web Audio specification and MDN's Web
Audio best-practices, `AudioContext.resume()`, `AudioContext.state`, GainNode,
OfflineAudioContext, and `Event.isTrusted` pages. The modern-web-guidance sources used were
`accessibility` and `efficient-background-processing`. The current web design
guidelines supplied the no-sound-only-feedback rule. Vercel React guidance was
applied to stable external listeners and effect cleanup; no React state was
introduced.

## W9b-D1 · Feedback is published after state decides

The state store is the one enforcement boundary. It publishes a read-only event
after `pressActionAtom`, `detentActionAtom`, or `coastActionAtom` has produced an
authoritative outcome. Composite consumes `clickerTicks` and `silenced`; it does
not calculate detents, acceleration, coast, actor, or eligibility.

This is why raw pointer samples cannot make sound and why coast emits only what
the state budget returns. A second physics implementation in audio would drift.

## W9b-D2 · The active W9 dispatch supersedes the older wheel-only sentence

The older product specification says the clicker is wheel-detent-only. The
owner's active direction and W9 decision 6 explicitly require one click per
eligible human button press as well. W9b implements the narrower current
instruction: Select/press outcomes click; generic UI activation and pointer
movement do not.

## W9b-D3 · Procedural transients, no sample assets

Procedural Web Audio avoids network, preload, licensing, and decoding latency.
Wheel is an 8ms decaying noise impulse through a 3kHz band-pass with ±2% pitch
variation. Select and secondary buttons add a small decaying plastic body and
use 16ms/12ms low-pass envelopes. This is deliberately mechanical and local,
not a tonal alert. There are no assets to license or preload.

## W9b-D4 · One compressed, bounded graph

Every voice connects source → filter → envelope → master → compressor →
destination. Peak voice gains are 0.05 wheel, 0.075 Select, and 0.06 secondary;
master gain is 0.62. At most 12 voices can exist, and at most eight feedback
events wait for first activation. Wheel starts are spaced at 1/30 second and
cannot queue more than the voice cap permits. Excess work is reported and
dropped rather than increasing gain or allocating indefinitely.

The constants are asserted against literals so a future rewrite cannot move
both implementation and expectation together.

## W9b-D5 · Activation and backgrounding are ordered operations

Construction and resume happen only from an activation-eligible pointer/key
listener. Its default `Event.isTrusted` check is an autoplay eligibility signal:
it rejects ordinary script dispatch, but user-agent automation may still create
trusted events. It is not proof of human origin. The state-owned actor and
silence fields remain the provenance boundary.

Feedback before activation is not replayed. Feedback that arrives while that
first resume is pending is bounded so the initiating physical click is not
lost. Every activate, blur/hidden interrupt, mute change, and dispose gets a
monotonic operation identity. An asynchronous completion may update lifecycle
only while it remains current. A newer activation observes older pending
suspensions, then confirms or restores `running`, so the physical context and
the published lifecycle agree. Blur/hidden/mute clears pending events, stops
voices, and suspends. Dispose closes and disconnects.

Terminal lifecycle labels are authoritative: `unsupported`, `failed`, and
`disposed` survive later mute changes and blur/hidden/unmount interruption, so
diagnostics do not relabel terminal disposal as ordinary suspension or lock.
When muting a running backend, the provisional `suspended` label is assigned
before calling `suspend()`. A synchronous throw or asynchronous rejection can
therefore supersede that provisional state with terminal `failed`; the caller
never writes an ordinary label after the failure boundary returns.

Failures are data: `unsupported`, `resume-failed`, `context-suspended`,
`voice-cap`, and `graph-failed`. Nothing logs to the console. The first review
proved `rate-limit` was unreachable behind the 12-voice cap, so the dead public
reason and its contradictory claim were removed.

## W9b-D6 · Mute is a runtime seam, not invented settings UI

No existing clicker mute setting exists. `setEnabled(boolean)` remains the
runtime seam, and `CompositeDevice.interactionAudioEnabled` makes it reachable
from the mounted product. Disabling stops voices and suspends; the next real
activation can resume after re-enable. W9b adds no setting, label, persistence,
or panel UI.

## W9b-D7 · Browser evidence is observable but not semantic feedback

The composite root mirrors lifecycle and bounded counters in
`data-wp-audio-*`. These attributes are diagnostics only. Sound never carries
navigation meaning and does not replace focus, selection, visual depression,
screen movement, bumps, or announcements.

## W9b-D8 · One store sequence has one audio owner

One store-scoped subscription hub owns sequence consumption. It records the
latest consumed `seq` before dispatch and chooses one eligible binding, biased
toward a running/activating runtime and then the most recently activated
boundary. Duplicate attachment of one runtime and multiple public device mounts
therefore cannot replay one authoritative event. The hub is held in a `WeakMap`
and releases its sole store subscription after the final binding detaches.

## W9b-D9 · Eligible feedback is human by type and by runtime check

`InteractionFeedbackEvent` now carries `HumanActor` and literal
`silenced: false`; an agent-owned audible event cannot be constructed through
the public type. The store publisher narrows again before writing, and the
audio runtime defensively checks actor provenance so malformed JavaScript data
still produces a structured `silenced` result.

## W9b-D10 · Sound quality is owner-judged

Deterministic graph tests remain necessary but do not establish taste. The same
production graph can now render through `OfflineAudioContext` into a PCM WAV.
That reproducible artifact and the live route are the human-quality gate. The
owner must decide whether the result is restrained, plastic/mechanical, lighter
on wheel than Select, and articulate under a flick; W9b does not self-approve
that judgement.

## W9b-D11 · The evidence renderer belongs to the composite typecheck

The renderer imports and executes the production graph, so drift in that script
would invalidate reproducibility even if runtime code stayed green. The
composite TypeScript project therefore includes both `src/**/*.ts(x)` and
`scripts/**/*.ts`; the ordinary package and repo typechecks now cover the
renderer rather than relying on an exceptional one-off command.
