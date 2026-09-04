# D4 dispatch — `THREE.Clock` deprecation warning

## Objective

Identify and remove the repeated `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` console warning shown in the owner-provided capture, without hiding warnings or destabilizing the 3D device.

## Required reading and boundaries

- Follow `/AGENTS.md`, `../scope.md`, and `../review-lanes.md`.
- Load `global-patterns` and `vercel-react-best-practices` before editing.
- Ground React Three Fiber and three.js behavior in the installed source plus `~/code/agentic-context/`, not memory.
- First prove whether the constructor is called by webPod code, React Three Fiber, or another dependency.
- Do not suppress/filter `console.warn`, patch `node_modules`, or replace `THREE.Clock` text mechanically.
- Prefer the smallest supported dependency or application migration. If the warning is transitive and no compatible supported upgrade exists, document that result instead of masking it.

## Owned surfaces

- package manifests and `bun.lock` only if a verified compatible dependency correction is required
- device/composite/render-loop source and tests only when causal evidence points there
- `docs/workstreams/003-deadline-player-repair/diary/d4.md`
- `docs/workstreams/003-deadline-player-repair/evidence/d4-*`

Do not touch panel/provider behavior or styles, the D0 certificate files, `cert/`, `.neuve/`, or `.neuve-artifact/`.

## Verification

- Reproduce before and prove absence after in the same browser path.
- Run affected tests/typechecks, lint, client and SSR build, and a short device/composite smoke check.
- Record dependency compatibility evidence and any version changes.
- Do not commit. Report changed paths, residual risk, and proposed commit message.
