# Hidden editor contour guard

CPU030; source SRC-CLI-1789164803247-1. Base902c9d1a54af93c524b53076abc037949b12176f. Application source frozen for independent review; no commit/browser actions by author.

`apps/web/src/sticker-editor.tsx` now gates the existing contour memo by shown editor and positive presence. The boolean is a dependency, so reopening refreshes the current projection even when its version has not advanced since the hidden render. Numeric presence is not a dependency: spring frames alone still reuse the existing contour. Every positive exit frame retains prior behavior. Hooks, retained last selection, cancellation, errors, tooltip, return action and HUD branches are byte unchanged. This does not claim to eliminate visible-editor contour work or all5.6s sampled in the original trace; presence was not captured there.

Verification:

- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/hidden-editor/check.ts` passes. It executes the actual extracted production memo using deterministic dependency semantics, with pinned original source retained in baseline.txt. Baseline24 calls becomes3 visible calls and zero hidden calls across21 updates. Positive fade, same-version current-pose reopening, presence-only cache reuse, no-selection and final/reduced-motion zero are exercised.
- Prefix and suffix equality checks preserve all lifecycle/cancel hooks and error/return rendering branches. This is not a mounted React interaction test; live dismissal/reopen/cancellation behavior remains a lead validation gate.
- `bun run --cwd apps/web typecheck` passes.
- `bunx eslint apps/web/src/sticker-editor.tsx docs/workstreams/023-mobile-tactility/evidence/gpu-worker/hidden-editor/check.ts` passes.
- `git diff --check` passes.

Frozen application SHA256:4234685bf634c154e9a5cec74244a515c5a768f62f1b28bc104de877ce4a3e75. Proof source/result and pinned baseline are in evidence/gpu-worker/hidden-editor/. No geometry, shader, cap, worker or packet lifetime changes. Independent review and matched live runtime validation remain pending.
