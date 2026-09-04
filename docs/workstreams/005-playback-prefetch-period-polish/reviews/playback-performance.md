# Review: W005 Lane A — playback, navigation, and runtime performance

## Verdict

**APPROVE**

Counts: **0 Critical · 0 Major · 0 Minor**.

The frozen candidate fixes the observed playback/navigation failures and passes
the real authenticated MusicKit replay. Accepted navigation now publishes a
same-turn typed shell; speculative relationship work is bounded and does not
duplicate or hold the accepted selection behind the batch tail; selected-track
playback reaches S13 immediately, becomes authoritative, and advances progress;
and root, Play/Pause, Next, and resume preserve one serialized transport order.
The previously observed play-without-pause exception did not recur.

## Correctness check

Reviewed repository law and the complete W005 scope, dependency graph, HITL
decisions, research/material source record, implementation dispatch, review
lanes, tracker, implementation diary, and verification/replay evidence. There is
no repository board to reconcile under repo law. No implementation source was
edited by this reviewer, no credential or `cert/` content was read, and no Neuve
shell command was run because repo law and D005-05 explicitly forbid that path.

The earlier `7.46s` trace is not used as latency evidence: its clock began before
a separate DevTools input call. The valid baseline fact is structural—the old
selection awaited relationship data and exposed no destination shell—which was
confirmed from the pre-fix source and replaced by deterministic same-turn shell
tests.

## Adversarial findings

No Critical, Major, or Minor findings remain.

During review, deterministic probes did expose defects in selection supersession,
low-to-high request handling, transport serialization, root pause state, station
confirmation, and the pause-during-replacement boundary. Those defects were
fixed before freeze and independently re-falsified. In particular:

- A→B→C and track↔station selections are latest-wins. A newer selection cannot
  let a stale queue become audible; pause invalidates a selection even while it
  is waiting at the mandatory replacement-pause boundary.
- A resolved `play()` at MusicKit state `none` is not treated as playback
  confirmation. Selected identity plus authoritative playing/progress owns the
  pending→determinate transition; duplicate queue occurrences are disambiguated.
- Active queue replacement crosses a public `pause()` boundary. Normal skip,
  pending skip, root pause, resume, and physical Play/Pause use serialized
  provider writes; the redundant post-skip `play()` path is absent.
- Stable-focus preparation uses only the public provider/MusicKit facade, is
  idle-only, and does not mutate an active or paused queue. No direct HLS,
  license, private playback URL, preview-media request, or false seconds-buffered
  claim exists.
- Relationship caches are 32 entries/5 minutes and artwork is 48 entries/10
  minutes. Pending and resolved work share the bounds; rejected work is evicted;
  TTL, LRU eviction, teardown, and cancellable supersession abort work. The
  source-owned known-track index is capped at 256 and abandoned Apple
  continuation handles at 32. The Apple identity registry is authoritative
  LocalKey state, clears on provider teardown, and is deliberately not evicted
  while the session is live because doing so would break stable identity for a
  large library.
- Visible-list speculation is exactly items 0–3 plus focus ±1, de-duplicated and
  clamped. Non-abortable MusicKit relationship work is reused/promoted rather
  than duplicated; cancellable work is superseded. Late resolutions cannot
  replace a screen after Menu/back.
- Initial library publication waits for only one page from each collection.
  Continuation pages drain one collection/page at a time with an event-loop yield,
  rather than four unbounded full-library drains.
- Production entry is Apple-only. `/` redirects to the Apple device; no demo
  query, switch, fallback, or runtime fixture import appears in the production
  client or SSR bundle.
- Interaction audio remains procedural. Three bounded blueprints are created at
  module load; the final three AudioBuffers are created only at user activation;
  first scheduling performs no synthesis/buffer allocation and passes the
  synchronous latency-budget test.

## Sanitized authenticated timing

The following values came from the frozen candidate in the already authenticated
Chrome DevTools session. They contain no tokens, URLs, provider identifiers, or
library metadata.

| Path | input→shell/S13 | input→data/ready | audio playing | first advancing progress | relationship calls | peak relevant concurrency | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Cold boot | n/a | usable S03 `2192.8ms` | n/a | n/a | n/a | n/a | pass |
| Root→album list | `33.6ms` | warm list already available | n/a | n/a | n/a | n/a | pass |
| Warm album | S08 loading `23.4ms` | rows `45.1ms` | n/a | n/a | `1` selected request, reused | `6` bounded relationship window | pass |
| Cold non-prefetched album under load | S08 loading `28.8ms` | rows `363.8ms` | n/a | n/a | `3` total window calls; no selected duplicate | `3` | pass |
| New track selection | S13 `35.7ms` | determinate `1352.1ms` | `987.6ms` | first 1s tick `1973.3ms` | n/a | n/a | pass |
| Resume from root | S13 `18.3ms` | retained position | `352.7ms` | resumed from retained time | n/a | n/a | pass |

For the deliberate cold-contention replay, three focus-neighbor requests began
`22.8ms` after the focus change and lasted `551.9–602.1ms`. Enter was accepted
while all three were active. The selected relationship completed and painted at
`363.8ms` after input, before the longest background request completed, and the
request total remained three. That falsifies both duplicate-I/O and accepted-work-
behind-batch-tail regressions. The broader warm window peaked at six bounded
relationship calls lasting `342–717ms`; the selected album did not wait behind
that window.

## Authenticated transport replay

| Action | Observed result |
| --- | --- |
| Select new song | Prior audio reset at `+507.7ms`; audio played at `+987.6ms`; determinate state at `+1352.1ms`; progress advanced |
| Pause on Now Playing | `audio.paused` became true within the observed `22ms` |
| Resume on Now Playing | Position advanced within `98.2ms` |
| Next | Item changed and position reset within `26.9ms`; ready/playing returned at about `444ms` |
| Menu/back to S03 | Audio paused and retained the provider position (`29.613s`) |
| Play/Pause at root | S13 returned in `18.3ms`; audio resumed in `352.7ms` at the retained ~`30s` position |
| Second Play/Pause | Audio paused in `23.2ms` and remained on S13 |

Final media state was paused with readyState 4 and no media error. Since the hard
reload, Console contained **zero** repeated-play or uncaught transport errors.
Three generic resource responses remained (two 404 and one known station 400),
with no JavaScript stack/message; they did not affect library navigation or
transport and are not the removed MusicKit sequencing failure.

## Independent verification

| Check | Result |
| --- | --- |
| `bun run gates` on final documentation/source tree | 11/11 TypeScript projects; lint clean; 1,313 tests / 78,752 assertions; 16 automated gates passed, 0 failed |
| Panel Playwright | 17/17 passed; immutable source fingerprint `7e5d4d6b…` |
| Production LCD-fidelity Playwright | 4/4 passed; immutable source fingerprint `8f19bb6e…` |
| Fresh `bun run build` | Client and SSR builds passed; only the existing advisory chunk-size warning remained |
| Production bundle scan | Zero fixture/demo markers; no concrete signing-key path or key material |
| `git diff --check` | Passed |

U14 physical thumb occlusion remains an explicit owner phone-in-hand gate. U15's
unsupported-control inspection is satisfied for this lane by the Apple-only entry,
capability-filtered routes, and production browser evidence; it does not weaken
the separate visual review's manual posture.

## Neuve dogfood feedback

Neuve was intentionally not invoked. Repository law says there is no Neuve shell
for this project, and D005-05 records that repo-specific constraint.
