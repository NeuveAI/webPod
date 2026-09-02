# Apple integration verification

Date: 2026-09-02

## Automated results

- `bun test packages/server-core/src/apple-developer-token.test.ts packages/providers/src/apple/apple-provider.test.ts` → 8 pass, 0 fail.
- `bunx tsc --noEmit -p packages/providers/tsconfig.json` → clean.
- `bunx tsc --noEmit -p packages/server-core/tsconfig.json` → clean.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → clean.
- targeted ESLint over changed Apple/server/route files → clean.
- `bun run build` → client and SSR production builds complete.
- client bundle audit for `APPLE_MUSICKIT_KEY_PATH`, `APPLE_TEAM_ID`, `node:fs`, `readFile`, `pkcs8`, and `AuthKey_` → zero matches. The token route and signer occur in the server bundle only.

No credential-bearing command was run. No token value was captured.

