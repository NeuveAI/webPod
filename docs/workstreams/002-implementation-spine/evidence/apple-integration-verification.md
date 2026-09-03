# Apple integration verification

Date: 2026-09-03

## Automated results

- `bun test packages/server-core/src/apple-developer-token.test.ts packages/providers/src/apple/apple-provider.test.ts` → 8 pass, 0 fail.
- `bunx tsc --noEmit -p packages/providers/tsconfig.json` → clean.
- `bunx tsc --noEmit -p packages/server-core/tsconfig.json` → clean.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → clean.
- targeted ESLint over changed Apple/server/route files → clean.
- `bun run build` → client and SSR production builds complete.
- client bundle audit for `APPLE_MUSICKIT_KEY_PATH`, `APPLE_TEAM_ID`, `node:fs`, `readFile`, `pkcs8`, and `AuthKey_` → zero matches. The token route and signer occur in the server bundle only.

## Final wiring results

- `bun test packages/providers/src/apple/apple-provider.test.ts packages/providers/src/fixture/fixture-provider.test.ts packages/providers/src/stub.test.ts packages/panel/src/navigation.test.ts apps/web/src/music-runtime.test.ts` → 154 pass, 0 fail.
- `bun run typecheck` → 11/11 TypeScript projects clean.
- The production panel now receives the selected `MusicProvider` and a provider-neutral navigation source. Fixture is deterministic and remains the safe default; Apple is selected explicitly with `?provider=apple` or `VITE_WEBPOD_PROVIDER=apple`.
- Fake MusicKit coverage verifies library mapping, session changes, transport, album/playlist tracks, and artist albums without using credentials.

No credential-bearing command was run. No token value was captured.
