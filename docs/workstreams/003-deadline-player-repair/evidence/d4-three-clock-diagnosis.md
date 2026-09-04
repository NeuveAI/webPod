# D4 evidence — `THREE.Clock` deprecation

**Captured:** 2026-09-03
**Source posture:** shared working-tree snapshot; no immutable commit identity claimed
**Credential posture:** no credential file or value was read, copied, or logged

## Causal proof

The repository source search found no application constructor for `THREE.Clock`. The installed stable Fiber bundle contains this store initialization:

```text
@react-three/fiber@9.7.0 ... events-156d8d12.esm.js:1016
clock: new THREE.Clock()
```

The installed Three source contains the corresponding diagnostic:

```text
three@0.185.1 ... src/core/Clock.js:61
Clock: This module has been deprecated. Please use THREE.Timer instead.
```

A fresh Chrome session was launched with `CanvasDrawElement` enabled and opened the production device path at `/_spike/device`. It reached T1 with one canvas and emitted one matching warning. A narrowly scoped test-only `console.warn` wrapper retained the original call and captured this causal stack:

```text
warn (three.module-*.js)
new Clock (three.module-*.js)
@react-three_fiber.js
createStoreImpl
createStore
createWithEqualityFnImpl
createWithEqualityFn
createStore
```

The wrapper existed only inside the disposable Playwright page; no application console behavior was changed.

## Compatibility investigation

| Candidate | Evidence | Decision |
|---|---|---|
| Keep stable Fiber 9.7.0 and Three 0.185.1 | Exact installed bundle calls `new THREE.Clock()`; exact Three source warns | Warning remains, runtime stays supported |
| Update Fiber | npm `latest` is already 9.7.0; Timer/scheduler architecture is published only as `10.0.0-alpha.4` | Rejected for deadline branch: prerelease renderer migration |
| Downgrade Three to 0.182.0 | Clean published package inspection found no `HTMLTexture` | Rejected: breaks the T1 composite's required source type |
| Pass a Timer through `<Canvas>` | Fiber initializes the store clock before later canvas configuration | Rejected: cannot prevent constructor warning |
| Filter warnings or transform dependency code | Would hide diagnostics or patch transitive code | Forbidden by dispatch |

No manifest or lockfile was changed.

## Commands and sanitized outcomes

- Repository and owned-source `rg` scans — no webPod `Clock` constructor found.
- Installed Fiber/Three source scans — causal constructor and warning line found.
- `bun pm view @react-three/fiber version` — `9.7.0`.
- `bun pm view @react-three/fiber@10.0.0-alpha.4 dist-tags --json` — `latest` remains `9.7.0`; Fiber 10 is tagged `alpha`.
- Clean published archive inspection of `@react-three/fiber@10.0.0-alpha.4` — scheduler-based store; package adds `@pmndrs/scheduler` and broad renderer changes.
- Clean published archive inspection of `three@0.182.0` — no `HTMLTexture` file/export.
- Headless installed Chrome smoke with `--enable-blink-features=CanvasDrawElement` — T1, one canvas, one exact warning, no navigation error.
- `bun test packages/device/src packages/composite/src` — 299 pass, 0 fail, 73,662 assertions across 40 files. Mounted R3F tests repeat the warning once per constructed test root.
- `bun run --cwd packages/device typecheck` — clean.
- `bun run --cwd packages/composite typecheck` — clean.
- `bun run lint` — clean.
- `bun run build` — client and SSR builds completed successfully.
- Production client asset scan for the exact warning literal — no matches.

## Completion posture

The packet explicitly allows a documented transitive limitation when no compatible supported upgrade exists. That is the safe outcome here. The warning is not removed from development because every removal available today violates a packet boundary or increases runtime risk; production output does not contain the exact warning diagnostic.
