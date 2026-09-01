# W9a corrective gate evidence

Run from `/Users/vinicius/code/webPod` on September 1, 2026, after every
corrective mutation plant had been reverted.

| Command | Result |
| --- | --- |
| `bun run typecheck` | exit 0; 11/11 TypeScript projects clean |
| `bun run lint` | exit 0 |
| `bun test` | exit 0; 1,086 pass, 0 fail, 66,347 expectations across 66 files |
| `bun test packages/device` | exit 0; 193 pass, 0 fail, 62,415 expectations across 27 files |
| `bun run build` | exit 0; Vite client and SSR builds complete |
| `bun run gates` | exit 0; 16 automated pass, 0 automated fail; U14/U15 manual |
| scoped `git diff --check` | exit 0 on every W9a corrective/evidence path |

The build retains the advisory 1.23 MB Three.js client-chunk warning.

## Corrective mechanisms now gated

- enabling reduced motion during an active wheel/Select release restores the
  byte-exact arrays, emits one final invalidation and leaves no pending frame;
- both release channels sweep 15, 30, 60, 120, 240 and 360 Hz, settle no earlier
  than their duration and no later than one healthy frame after it;
- a 360 Hz wheel release requests more than 24 healthy frames, proving the
  hostile-clock escape cannot truncate it;
- a frozen timestamp still exits after exactly 24 non-advancing callbacks;
- direct reduced-motion release also invalidates its restored pose;
- production `DeviceCanvas`, `ControlPhysicsScope` and the spike route expose
  no `controlEvidencePose` or `ControlPhysicsEvidence` seam.

See `w9a-mutations.md` for the deliberately falsified variants.

## Historical archive check

With both the workspace and package-local dependency installations attached:

- original `2ec08618a69bf3ce8cf94d23810ced6e8e832a63`: exit 2, exactly five
  missing click-wheel exports from `packages/device/src/index.ts`;
- corrective `0591daf35a85bf818e46e7b803ab35605e8252ca`: exit 0.

This proves current correctness and the historical defect simultaneously. It
does not pretend an additive fix can mutate `2ec0861`; the owner-only remedy is
in `w9a-owner-history-rewrite.md`.

## Evidence boundary

All sixteen legacy files report as JFIF JPEG 1280×720 after their truthful
`.jpg` rename. They are rejected synthetic artifacts, not acceptance proof.

No connected Chrome T1 session was available, so no browser interaction proof
is claimed. `w9a-browser.md` records the exact Chrome version, connector error,
required flag and still-open production-pointer capture checklist. The known T3
blank path was not counted green.
