# D0 correction evidence

Date: 2026-09-03

## Blocking findings addressed

- Added deterministic coverage for `webCryptoAppleTokenSigner`. The test generates
  a temporary synthetic P-256 PKCS#8 PEM, invokes the exported signer in a Node
  subprocess, asserts only the 64-byte result invariant, and removes the fixture.
  Its PEM boundaries are assembled only at runtime, so no credential signature or
  key material is present in tracked source or command output.
- Extracted Vite's Apple server-environment normalization into a pure exported
  helper. Coverage fixes the contract for relative, absolute, and empty key paths,
  plus process/runtime environment precedence over file-loaded values.
- Added TSDoc to the exported signer covering server-only use, runtime key-path and
  PKCS#8 requirements, input/output invariants, mapped failures, and the non-logging
  boundary.

No live credential, environment value, token, key material, or signature was read
or emitted while producing this evidence.

## Verification

- `bun test packages/server-core/src/apple-developer-token.test.ts apps/web/vite.config.test.ts`
  — 9 passed, 0 failed.
- `bunx --bun eslint apps/web/vite.config.ts apps/web/vite.config.test.ts packages/server-core/src/apple-developer-token.ts packages/server-core/src/apple-developer-token.test.ts`
  — passed.
- `bunx tsc --noEmit -p packages/server-core/tsconfig.json` — passed.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` — passed.
- `bun run build` — client and SSR production builds passed.
- `bun run gates` after D5 stabilized — typecheck, lint, and all 13 static
  predicates passed, including `CREDENTIALS`; the aggregate test command reported
  1,240 passed and only two pre-existing `scripts/gates.test.ts` `NAMING` fixture
  cases failed because they exceeded Bun's default five-second timeout. The full
  summary was 15 automated passed, 1 automated failed, and 2 manual outstanding.
- `bun test --timeout 30000 scripts/gates.test.ts` — all 59 gate tests passed. The
  two aggregate-timeout cases completed in 11.08 seconds and 8.33 seconds,
  confirming host timing rather than a D0 behavior or scanner failure.
- `bun run scripts/gates.ts --static-only` — 13 automated passed, 0 failed, with
  the expected 2 manual checks outstanding.

## Re-review boundary

Review the D0 source and test changes only. D1/D2 and `.neuve` changes remain
concurrent foreign work and were not modified by this correction.
