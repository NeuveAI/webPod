# Final test attribution

Read-only verification by core_implementer at 2026-09-06T22:49:08.131641+00:00.

HEAD: `2f1001a0b72b1829a581123e4cc4691f0c60319e`.

No implementation or test source changed. No credentials or unrelated workstream documents read. Tests performed their normal temporary database/server lifecycle. Only this attribution note was written.

## Conclusion

All 16 failures in the monolithic root run are accounted for outside the WebMCP tool implementation: 14 server failures reproduce from an existing uncleaned Happy DOM global registration, one current experimental sticker atlas test times out under broad-run load but passes isolated, and one unchanged studio test contains a stale diagnostic-route source-string assertion. The required WebMCP scope passes **595 tests, 0 failures**. This establishes no observed WebMCP regression; it does not claim the repository-wide suite is green.

The shared tree was changing externally during this work. The lead also reports a production build overlapped the original broad run; no browser test failure was observed there. The original broad run therefore is not claimed to have a uniform immutable source/artifact snapshot. The independent final native proof is owned by the evaluator and should be cited separately.

## Commands and exact outcomes

### Root broad run (lead-owned)

`bun test`

Exit 1. Log SHA256 `6cd6e64697b5e533e35662b3402d706220e14b9e83a1ead5d97748993dba9d14`.

```text
  ^ this test timed out after 5000ms.
(fail) incoming request abort cancels Apple fetch and releases device admission without grants [5003.80ms]
  ^ this test timed out after 5000ms.
 1550 pass
 16 fail
 560645 expect() calls
Ran 1566 tests across 138 files. [197.88s]
```

### Required WebMCP scope

`bun test packages/tools packages/state packages/composite packages/panel apps/web/src`

Exit 0. Log SHA256 `bfbb6185a3e914c6a1b19390bb26b9d9fa5f1f89f5f924516023fd799cf7032b`.

```text
apps/web/src/server/sticker-runtime.test.ts:
(pass) production database rejects absent, relative, public, traversal and symlink paths [0.82ms]
 595 pass
 0 fail
 4470 expect() calls
Ran 595 tests across 53 files. [3.99s]
```

### Isolated server failing groups

`bun test packages/server-core/src/stickers/stickers.test.ts packages/server-core/src/stickers/import-budget.test.ts packages/server-core/src/stickers/live.test.ts`

Exit 0. Log SHA256 `70b516e27e4b5323f8bbad86b388ac32f893e5bdd85b54f7815f77e595d93e2f`.

```text
(pass) runtime disposal cancels admitted upstream work and releases database ownership [3.63ms]
(pass) global upstream admission is bounded and forged session secrets cannot resolve an owner [5.71ms]
(pass) incoming request abort cancels Apple fetch and releases device admission without grants [4.66ms]
 40 pass
 0 fail
 237 expect() calls
Ran 40 tests across 3 files. [337.00ms]
```

### Isolated device failing groups

`bun test packages/device/src/StudioEnvironment.test.ts packages/device/src/sticker-wrap.test.ts`

Exit 1. Log SHA256 `7fcf50f45c2cb6abbc9c0856f4f9089c51324daebac0daf41f9060e8efec8dcb`.

```text
      at <anonymous> (/Users/vinicius/code/webPod/packages/device/src/StudioEnvironment.test.ts:94:17)
(fail) three fixed reflection cards have finite transforms and dispose every owned resource [1.27ms]
 4 pass
 1 fail
 26412 expect() calls
Ran 5 tests across 2 files. [4.53s]
```

### Positive contamination reproduction

`bun test packages/device/src/click-wheel-input.integration.test.tsx packages/server-core/src/stickers/stickers.test.ts packages/server-core/src/stickers/import-budget.test.ts packages/server-core/src/stickers/live.test.ts`

Exit 1. Log SHA256 `035cdae5b08371bb2742b15b3969aac90159fbbf9fe1136caeac59cbee96d81b`.

```text
  ^ this test timed out after 5000ms.
(fail) incoming request abort cancels Apple fetch and releases device admission without grants [5003.15ms]
  ^ this test timed out after 5000ms.
 47 pass
 14 fail
 333 expect() calls
Ran 61 tests across 4 files. [25.30s]
```

## File-by-file attribution

| Failed file | Broad failures | Isolated result | Attribution |
|---|---:|---|---|
| `packages/server-core/src/stickers/stickers.test.ts` | 1 | All its tests pass in the 40-test server-only run | Origin header lost under Happy DOM Request; B3 endpoint receives 403. |
| `packages/server-core/src/stickers/import-budget.test.ts` | 2 | All its tests pass in the 40-test server-only run | Same 403 issue plus Happy DOM Response rejected by native Bun server, followed by duplicate Content-Length parse error. |
| `packages/server-core/src/stickers/live.test.ts` | 11 | All its tests pass in the 40-test server-only run | Same 403 issue, invalid response follow-on, and five tests waiting for upstream admission that never occurs. |
| `packages/device/src/sticker-wrap.test.ts` | 1 | Pass, 4479.05 ms | Broad run reports 14001.93 ms against default 5000 ms timeout. Experimental untracked source; no geometry assertion failure in isolated execution. Timing sensitivity remains. |
| `packages/device/src/StudioEnvironment.test.ts` | 1 | Fails identically at line 94 | Expects `studioEnvironment={undefined}` literally in old spike route, now a wrapper that renders DevicePage. Earlier reflection disposal/transform assertions passed. |

### Confirmed HTTP global contamination

`packages/device/src/click-wheel-input.integration.test.tsx:53` installs `GlobalRegistrator.register()` at module scope and contains no unregister/afterAll cleanup. The file is unchanged in the working tree; its latest modifying commit is `193984a` (before this WebMCP work).

Combining only that device test file with the three isolated-success server files reproduces **exactly the same 14 server failures**: 47 pass, 14 fail. The server-only command passes all 40 in 337 ms. This is positive causal evidence rather than an attribution based only on paths.

A standalone Bun check from `packages/device` saved native Request/Response constructors, registered Happy DOM, constructed a synthetic same-origin POST, and unregistered. It returned:

```json
{"requestConstructorReplaced":true,"responseConstructorReplaced":true,"originHeader":null,"expectedOrigin":"https://webpod.test","responseIsNative":false}
```

`packages/server-core/src/stickers/http.ts:7-9` rejects a request when its Origin header does not equal its URL origin, explaining the 403s. The broad and contamination logs both show native Bun rejecting a non-native Response and then `Parse Error: Duplicate Content-Length`. These outcomes are not production WebMCP responses.

### Persistent stale studio assertion

`apps/web/src/routes/[_]spike.device.tsx` currently imports and renders DevicePage; it has no direct studioEnvironment prop. Both the route and StudioEnvironment test are unchanged in this worktree. The route last changed at `b62df0a` (before this task). The failure is reproducible independently and remains an open repository-wide test issue. It is not fixed here because this subtask is attribution only.

### Atlas timeout limitation

The isolated atlas test passes its geometry assertions but takes 4.48 seconds, close to Bun’s default 5-second timeout. The broad run took 14 seconds. Load sensitivity is the supported inference; its untracked/concurrently edited status prevents asserting a historical baseline or fully stable geometry fingerprint for the broad run. Coordinate any timeout/performance repair with the sticker geometry owner.

## Exact broad failure titles

- `packages/device/src/sticker-wrap.test.ts`: candidate arc atlas preserves rear center and reaches front with finite outward local frames [14001.93ms]
- `packages/device/src/StudioEnvironment.test.ts`: three fixed reflection cards have finite transforms and dispose every owned resource [0.87ms]
- `packages/server-core/src/stickers/stickers.test.ts`: HTTP validation and Effect runtime > B3 HTTP enriches missing genre once and accepts authoritative unknown without network loop [1.11ms]
- `packages/server-core/src/stickers/import-budget.test.ts`: 24 validated pages survive in-flight own deadline and generate starter in the first session [0.34ms]
- `packages/server-core/src/stickers/import-budget.test.ts`: native Bun fetch body cancellation preserves own deadline identity after a validated page [7.71ms]
- `packages/server-core/src/stickers/live.test.ts`: device collection sessions > preparation alone cannot read; verified import survives logout, reconnect, rotation, restart and remains isolated [0.59ms]
- `packages/server-core/src/stickers/live.test.ts`: device collection sessions > failed upstream authorization never grants a session or creates a collection [0.25ms]
- `packages/server-core/src/stickers/live.test.ts`: device collection sessions > logout while upstream import is suspended prevents activation and grants [5003.43ms]
- `packages/server-core/src/stickers/live.test.ts`: device collection sessions > failed library import returns explicit failed inventory without erasing prior grants [1.07ms]
- `packages/server-core/src/stickers/live.test.ts`: device collection sessions > catalogue enrichment has no user token and stale device generation cannot write [0.34ms]
- `packages/server-core/src/stickers/live.test.ts`: logout revokes captured active access even when the device cookie is missing [0.30ms]
- `packages/server-core/src/stickers/live.test.ts`: rapid authenticated reload reuses inventory and bounded preparation rejects excess work [0.27ms]
- `packages/server-core/src/stickers/live.test.ts`: logout interrupts catalogue enrichment without metadata or listening credit writes [5001.75ms]
- `packages/server-core/src/stickers/live.test.ts`: runtime disposal cancels admitted upstream work and releases database ownership [5003.82ms]
- `packages/server-core/src/stickers/live.test.ts`: global upstream admission is bounded and forged session secrets cannot resolve an owner [5003.90ms]
- `packages/server-core/src/stickers/live.test.ts`: incoming request abort cancels Apple fetch and releases device admission without grants [5003.80ms]

## Remaining material concerns

- Root `bun test` remains red unless the pre-existing global-registration cleanup and stale source assertion are repaired and atlas timing is addressed by their owners.
- Passing isolated groups does not excuse monolithic contamination; it explains why the original root result cannot be used as evidence of a WebMCP server regression.
- Full root lint remains red in unrelated historical evidence scripts (112 errors, as documented by the lead); this subtask did not rerun or change those scripts.
- Core/sticker approvals and final native 11/11 proof are separately owned records, not results recreated by this attribution subtask.
