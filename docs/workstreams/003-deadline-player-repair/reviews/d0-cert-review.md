# Review: D0 — Portable server-side MusicKit key-path/runtime fix

## Verdict: APPROVE

**Current findings:** 0 Critical · 0 Major · 0 Minor

### Correctness Check

- Source of truth: `AGENTS.md` credential law; 002 decision log D-017; `../002-implementation-spine/decisions/apple-integration.md` decisions 1–4; 003 `scope.md`; 003 `review-lanes.md` D0. Repository law explicitly says there is no Neuve shell or Kanban board, so the 003 initiative tracker was used and no Neuve commands were run.
- Kanban ticket: not applicable by repository law. Tracker slice D0 is `in-review` in `tracker.md`.
- Correctness target: resolve an explicitly configured relative local key path from the repository root, retain absolute runtime validation in server-core, read/sign under both Node and Bun, and keep key material and signing code out of the client bundle and logs.
- Dispatch scope: D0 predates the 003 dispatch packets; review was limited to `apps/web/vite.config.ts`, `packages/server-core/src/apple-developer-token.ts`, and `../002-implementation-spine/apple-local-test-runbook.md`, plus the existing signer test, server route, generated client/server bundles, and live endpoint needed to verify them.
- Dependency/HITL status: D0 is independent. No owner decision is required for the implementation itself. Real-account authorization remains the owner's later D3/H-1 gate.
- DoD checklist: runtime behavior, sanitized endpoint behavior, deterministic regression coverage, public signer documentation, scoped typecheck/lint, build, and bundle boundary passed.
- Review lane coverage: D0 certificate/runtime portability and security boundary reviewed. D1/D2 changes were treated as concurrent foreign work.
- Type/lint/doc gates: the D0-scoped server-core and app typechecks, scoped ESLint, and production build pass after correction. The exported signer's server-only/runtime/key-format/signature/failure contract is documented.
- Git history/staging: the three D0 files are separable as the first path-scoped commit in the recorded commit plan; no commit was made by this reviewer.
- Verification evidence: `evidence/d0-corrections.md`; 9 deterministic tests cover the real Node signer and relative/absolute/empty/runtime-precedence normalization; a synthetic temporary P-256 PKCS#8 key previously produced a 64-byte signature in Node 24.8 and Bun 1.4.0; the prior sanitized live Node route checks passed; the regenerated production client bundle contains no credential/filesystem/signing markers.
- Decision-log status: D-017 remains satisfied by the implementation: no key default, no credential output, server-only signing, and short-lived/no-store token behavior. The scoped local relative-path bootstrap refines the older apple-integration decision 3 without weakening server-core's absolute-path requirement. No `docs/decisions.md` or `docs/platform_decisions.md` exists in this repository.

### Resolved Findings

- [RESOLVED MAJOR] The real signer now has deterministic Node-subprocess coverage using a generated, mode-0600 temporary PKCS#8 key with unconditional cleanup. The same suite fixes relative, absolute, empty, and runtime-environment-precedence behavior for the extracted normalizer. The test emits only a fixed success sentinel, never key material or a signature. (`packages/server-core/src/apple-developer-token.test.ts:42`, `apps/web/vite.config.test.ts:5`, `apps/web/vite.config.ts:22`)
- [RESOLVED MAJOR] The exported signer now documents its server-only boundary, runtime requirements, accepted absolute-path PKCS#8 input, raw 64-byte ES256 output, error mapping, and non-logging invariant. (`packages/server-core/src/apple-developer-token.ts:94`)

### Re-review

- Date: 2026-09-03.
- Correction evidence inspected: `evidence/d0-corrections.md`.
- The correction is confined to D0 source/tests/docs. Concurrent D1/D2 work remains foreign to this verdict.
- No hardcoded production key-path default was introduced. Relative path resolution occurs only for an explicitly supplied local Vite environment value; server-core still requires the normalized runtime path to be absolute.
- No client-reachable signing implementation was introduced. The regenerated client output passes the credential/filesystem/signing marker assertion.
- No credential, token, endpoint URL, account identifier, signature, or `cert/` content was read or emitted during re-review.

### Final recheck

- Date: 2026-09-03.
- Verdict remains **APPROVE** with **0 Critical · 0 Major · 0 Minor**.
- The runtime-generated fixture assembles synthetic PEM boundaries only in memory, writes a mode-0600 temporary file, invokes the real exported signer in a Node subprocess, asserts only the signature-length invariant through a fixed success sentinel, and removes the temporary directory in `finally`. No tracked credential signature or key material is required by the test. (`packages/server-core/src/apple-developer-token.test.ts:42`)
- The focused D0 suite passes 9/9, confirming the real Node signer and all normalization cases still execute after removing the tracked synthetic PEM marker.
- The static-only gate passes all 13 automated predicates, including `CREDENTIALS`; only the two expected manual product checks remain outstanding.
- The documented extended-timeout gate test was independently reproduced: `bun test --timeout 30000 scripts/gates.test.ts` passes 59/59. The two NAMING cases that can exceed Bun's default five-second timeout are therefore host-timing artifacts, not D0 or credential-scanner failures.
- Scoped ESLint, both affected TypeScript project checks, and `git diff --check` pass.
- The only explicit subprocess output in the corrected fixture is the fixed `ok` sentinel. Production signer/config code introduces no logging calls, and the server-only/no-default/client-boundary conclusions from the first two review passes remain unchanged.

### Suggestions (non-blocking)

- Keep the runbook's wording scoped to local Vite bootstrap. Server-core correctly continues to reject relative runtime paths, so deployed runtimes still need an absolute `APPLE_MUSICKIT_KEY_PATH`.

### Commands run

- `bun test packages/server-core/src/apple-developer-token.test.ts` — 4 pass, 0 fail.
- `bunx tsc --noEmit -p packages/server-core/tsconfig.json` and `bunx tsc --noEmit -p apps/web/tsconfig.json` — passed in the D0 snapshot.
- `bunx --bun eslint apps/web/vite.config.ts packages/server-core/src/apple-developer-token.ts` — passed.
- `bun run lint` — passed.
- `bun run build` — client and SSR builds passed.
- Synthetic Vite-config imports under Node and Bun — both resolved the relative test path from the repository root.
- Synthetic P-256 signer probes under Node and Bun — both returned 64-byte signatures; no signature or key material was output.
- Sanitized live `GET /api/apple/developer-token` checks — same-origin 200 with expected shape/no-store; cross-origin 403 with no token.
- Generated-bundle marker scan — zero credential/filesystem/signing markers in `apps/web/dist/client`; markers present only in `apps/web/dist/server`.
- `bun run typecheck` after concurrent D1 edits — foreign-lane failure in the in-progress provider `prepare` implementation; not attributed to D0.
- Re-review: `bun test packages/server-core/src/apple-developer-token.test.ts apps/web/vite.config.test.ts` — 9 pass, 0 fail.
- Re-review: scoped ESLint over the four D0 source/test files — passed.
- Re-review: server-core and app TypeScript checks — passed.
- Re-review: `bun run build` — client and SSR builds passed.
- Re-review: regenerated client-boundary assertion — passed.
- Final recheck: focused D0 suite — 9 pass, 0 fail.
- Final recheck: `bun run scripts/gates.ts --static-only` — 13 automated pass, 0 fail; 2 manual outstanding.
- Final recheck: `bun test --timeout 30000 scripts/gates.test.ts` — 59 pass, 0 fail.
- Final recheck: scoped ESLint, server-core/app TypeScript checks, and `git diff --check` — passed.
