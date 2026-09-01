# W9b interaction-audio evidence

## Commits

| Commit | Surface |
| --- | --- |
| `0c1f6fc` | authoritative state feedback stream and tests |
| `d05019e` | bounded procedural scheduler and browser backend |
| `ff697c3` | mounted composite subscription and disposal |
| `81c9dc3` | interrupted-resume race and structured unsupported result |
| `6004bc9` | injected Web Audio graph proof |
| `754f643` | literal product-budget gates |
| `5b44872` | internal audio status vocabulary passes the permission-copy gate |
| `b013871` | muted construction guard and diagnostic-failure containment |
| `59291a4` | physical Select release, browser diagnostics, and disposal proof |

The Select-release bridge follows W9a's typed input seam in `2ec0861`, so both
commits typecheck independently in dependency order.

## Deterministic proof

Command:

```sh
bun test packages/composite/src/interaction-audio.test.ts \
  packages/composite/src/web-audio-backend.test.ts \
  packages/composite/src/CompositeDevice.integration.test.tsx
```

Result: **20 pass, 0 fail, 160 assertions**.

Covered claims:

- no backend construction or replay before human activation;
- suspended-context resume and bounded first-click queue;
- interruption during resume cannot revive background audio;
- one eligible press produces one click;
- N authoritative detents produce N budgeted 30Hz-spaced ticks;
- zero for sub-detent, agent, silenced, and disabled paths;
- 12-voice and eight-pending-event caps;
- ±2% pitch bound and literal 30Hz/12/8/0.02 gates;
- natural end, blur, hidden, detach, dispose, suspend, close, and graph failure;
- source/filter/envelope/master/compressor topology;
- 8ms wheel, 12ms secondary, 16ms Select envelopes;
- deterministic, finite, decaying, ≤1 procedural buffers;
- every per-voice node disconnects and completion is idempotent.

State-specific command:

```sh
bun test packages/state/src/feedback.test.ts packages/state/src/store.test.ts
```

Result from the implementation checkpoint: **35 pass, 0 fail**. The feedback
tests cover one press, N direct detents, sub-detent zero, agent/system zero,
coast budget provenance, and sequence identity.

## Browser event/audio transcript

Route: `http://localhost:3000/_spike/device`.

Available browser: Codex in-app browser, negotiated composite tier T3. T3 has no
3D input canvas, but the mounted composite boundary and scroll lifecycle remain
available. The transcript came from the root's own `data-wp-audio-*`
diagnostics; no console hooks were installed.

```text
initial
  tier=T3 lifecycle=locked scheduled=0 dropped=0 last=null

automated pointer attempt
  lifecycle=locked scheduled=0 dropped=0 last=null
  warnings/errors=[]

automated wheel input, authoritative budget 10
  lifecycle=locked scheduled=0 dropped=10
  last=silent:not-activated:0/10
  warnings/errors=[]
```

The automated pointer remaining locked is expected: browser automation is not
accepted as human activation. The wheel transcript proves that an authoritative
feedback event cannot bypass the lock or generate an autoplay error.

## Manual audible preview

1. Run `bun run dev` and open `http://localhost:3000/_spike/device` in the T1
   browser used for the composite preview.
2. Before touching the device, inspect the composite root: audio lifecycle is
   `locked`, counters are zero, and no `AudioContext` error appears.
3. Make one genuine click/tap or key activation inside the device. Lifecycle
   becomes `running`; no old wheel event is replayed.
4. Rotate slowly: each row-changing detent gives one light, short tick. Move less
   than a detent: silence.
5. Flick: coasted ticks match the state budget, remain individually articulated,
   and scheduled voices never exceed 12.
6. Press Select once: one slightly weightier plastic click. Cancel or drag off:
   no click.
7. Trigger an agent-originated detent/press through the tool path: visible state
   changes, audio counters do not schedule a voice.
8. Background or blur while sounds are queued, then return. Lifecycle becomes
   `suspended`; queued sound does not burst. The next genuine activation resumes.

## Repo gate checkpoint

| Gate | Result |
| --- | --- |
| `bun run lint` | exit 0 |
| `bun test` | 1,073 pass, 0 fail |
| `bun run build` | exit 0; existing large-chunk warning only |
| state TypeScript | exit 0 |
| composite TypeScript | exit 0 |
| `bun run typecheck` | 11/11 projects clean |
| `bun run gates` | 16 automated pass, 0 fail; manual U14/U15 outstanding |

The manual gates are not W9b audio claims: U14 is owner thumb-occlusion
validation and U15 is reviewer inspection of unsupported controls.
