# Adapter contract review

## Verdict: APPROVE

Final adapter-contract lane approval follows the historical findings and closure evidence below. No unresolved Critical/Major findings remain.

Checkpoint SHA-256: native Apple/Spotify production diff against base `553e97a956dfd2250290db7d7c8e8a0eac839bdf4fbafc628f314e0c609728da`; manager.ts `98630f759b786ec2838eebaf94eff99228325082e5f7a937e19e40e7bc5dba29`; apple-contract.test.ts `e36d2ac3d54052f2ac171e859f417a7baa520554d59cc57191a53ddbad5145b9`. This checkpoint includes the Spotify error branch patch but precedes durable-test verification.

### Correctness check

Loaded strict-critique and team-orchestration review protocol, workstream scope, decisions D1–D8, architecture, provider-contracts and implementation diary. Global `docs/decisions.md` and `docs/platform_decisions.md` are absent. The repo explicitly has no Neuve/Kanban; no such tools were invoked. Official and installed-source limitations are recorded in provider-contracts.md.

Lane: native adapter mechanics and real-adapter/common-manager regression preservation, against base `36f0b97`. Apple production code was initially unchanged; extracted test fixture preserves old native assertions. Spotify native total assertions moved to the managed run rather than being deleted: correct ownership change. No auth, API paging or artwork code changes identified in this lane.

### Findings

- **Critical — native Apple station can start after retirement** (`packages/providers/src/apple/apple-provider.ts:997`). A pending seed lookup survives common-manager deactivation and then calls native pause/setQueue/play. The common post-completion generation check cannot undo those side effects. Independent `/tmp/webpod-apple-station-review.test.ts` deferred `api.music`, deactivated the manager, then resolved the station response: observed `['pause', 'pause', 'setQueue', 'play']` instead of unchanged `['pause']`. This violates D1/D7/D8 and acceptance criterion 5. Capture and check native transaction/session validity across the preparation/API/queue/play awaits; retain cancellation correction if native play itself settles late. Add the actual-adapter regression.
- **Critical, patched during review; durable regression pending — Spotify asynchronous playback error left common state loading** (`packages/music-management/src/manager.ts`, pending-intent observation branch). Following successful HTTP play, Spotify `playback_error` preserves prior/null native item. The manager discarded that error for failing target identity matching. Independent `/tmp/webpod-spotify-error-review.test.ts` observed native `error` and managed `loading` (one failed managed test). Current patch handles error before identity matching; independent probe now passes both native/managed runs, 78 assertions. Add this exact SDK-event case to durable tests before closure.
- **Major — required Apple boundary evidence incomplete** (`packages/music-management/src/apple-contract.test.ts`). Initial managed Apple test exercises one three-track duplicate selection plus paused seek. Native tests preserve many invariants but do not establish that new manager interpretation preserves short-window absolute indices, selected-track fallback, mutations, cancellation, and native error behavior. Add focused actual-adapter cases for the changed reconciliation boundaries, especially absolute index versus native short-window count and cancellation/error paths. Final source-to-test mapping is required by scope criterion 7; research recommendations alone are not the mapping.

### Independent checks so far

- `bun test packages/music-management/src packages/providers/src/apple packages/providers/src/spotify`: 120 passed, 0 failed, 423 assertions before concurrent fixes.
- `bunx tsc --noEmit -p packages/providers/tsconfig.json` and the music-management package: passed.
- Scoped ESLint over music-management TS, Apple fixture/test, Spotify source/test: passed.
- Independent temporary probes above intentionally run outside tracked source and do not mutate accounts or play real audio.

Final checks must be rerun after a stable fingerprint/handover and the blocking regression fixes. No production playback claim is made from mocks.

### Rereview: blockers resolved, final handoff pending

All three findings above are resolved in the inspected patch. Apple station lookup now captures request generation and delegates to the existing guarded native play transaction; both the durable test and independent retirement probe pass. Spotify's durable managed test emits `playback_error` following HTTP success, verifies selected metadata/index with error, and verifies subsequent recovery. Apple managed tests now exercise a 250-item selected context with native 100-item window at absolute index 175 and a native one-item fallback; neither confuses native window size with selected-context total. A native late-pause completion regression also passes.

`evidence.md` maps actual adapter and common-manager test cases to the research packet's protocol sources. Original Apple test assertions remain intact after fixture extraction. Original Spotify native total assertions moved to corresponding managed assertions; no other regression assertions were weakened. This is targeted protocol regression coverage, not exhaustive vendor API certification; unchanged Spotify repeat values 1/2 remain a useful non-blocking future test addition.

Independent final command including the two temporary probes: 131 tests passed, 0 failed, 535 assertions across seven files (`/tmp/webpod-adapter-review-final.log`). Both package typechecks, scoped lint including newly changed Apple production source, and `git diff --check` passed (`/tmp/webpod-adapter-review-final-static.log`).

Inspected SHA-256: Apple source `2116604ae6f17c1fc343f9c58c846212bfeda80aa80f582a8e5542f4f3557860`; Spotify source `25d05568b5d7cc36ab38f026353cb10d40d67297aa3a223ee10424f1de74dfb7`; manager `38e4a15df59f3098232ff97232c0cdea99cd64590d97685e2c0416fd0c467ca6`; Apple managed tests `43c1a0cad5f7cfc88a625006f27ae8819f03980ee412794185442d548e21fea5`. No unresolved Critical/Major findings in this lane; formal approval awaits final stable source/build handoff.

### Final stable approval

Inspected the final queue-removal/reordering invalidation and synchronous selection queue-clear changes for adapter consequences. Actual MusicKit window append now confirms that 101 native items do not produce a false count against absolute occurrence 175. Both native and managed Spotify runs now assert official repeat modes 0→off, 1→all, 2→one, closing the earlier non-blocking test suggestion.

Independent final rerun: **135 passed, 0 failed, 550 assertions**, including both formerly failing native probes (`/tmp/webpod-adapter-review-stable.log`). Repeated music-management typecheck and scoped changed test/source lint passed. Earlier independent providers typecheck and native-source lint remain valid because native source hashes did not change. Diff check passed. Inspected final implementer production build log completion and final evidence/handover: 847 impacted tests, 14 project typechecks, changed-file lint and build passed. No live audio guarantee inferred.

Final approved SHA-256: manager `80304d9d9db9e0e9b95ab9da16e8a0e7f016fc4571d6d4bffe6f0206f8f2ad97`; Apple source `2116604ae6f17c1fc343f9c58c846212bfeda80aa80f582a8e5542f4f3557860`; Spotify source `25d05568b5d7cc36ab38f026353cb10d40d67297aa3a223ee10424f1de74dfb7`; Apple managed tests `baae065c2729068bebed1539c33cffb798fa4c3a81b41d5db55f205a74c1f161`; Spotify tests `b5e7cddca4f69f3b3603e12fef81b66aaa9b9415e78f22199c9b237f13e82bef`.

Scope D1–D8 preserved within this lane. The evidence proves actual adapter translation plus common-state behavior under controlled events, preserves prior assertions with explicit ownership migration, and records external-event/live-account limitations honestly. Source edits after these fingerprints require targeted rereview.
