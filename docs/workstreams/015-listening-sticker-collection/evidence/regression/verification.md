# Existing device regression verification

2026-09-06. Independent reviewer. Starting checkout was clean at `accd9b55ca3f9c1a424aa9431efeb55c169a3336`. Application code remained at that committed checkpoint throughout. The final run includes only the independently reviewed browser snapshot input/provenance fix in `scripts/browser-source-fingerprint.ts`; its test/diary changes do not affect application behavior. No authentication implementation or source feature changes were made by this reviewer.

## Authoritative result

**13 passed (1.4 minutes)** using the existing fingerprinted Playwright runner, Chrome with CanvasDrawElement, isolated port 4327:

```sh
W5B_PORT=4327 APPLE_TEAM_ID= APPLE_MUSICKIT_KEY_ID= APPLE_MUSICKIT_KEY_PATH= APPLE_TOKEN_TTL_SECONDS= bunx --bun playwright test --config apps/web/tests/playwright.config.ts apps/web/tests/device-orientation.e2e.ts apps/web/tests/production-view-parity.e2e.ts apps/web/tests/product-lighting.e2e.ts
```

Immutable served fingerprint: **b02745a4073b8135718bc3c3c2665482e90af1f69c81020ddcf5b23df6e757f0**, **342 files**. This is a worktree snapshot of committed application bytes plus the narrow helper fix, not a claim that `reviewedCommit` metadata was populated. Product-lighting source-health assertion confirms expected and current digests/counts match. Exact output: `current-isolated-run.txt`.

- Device orientation: all nine existing tests passed, covering mouse edge capture, frame-by-frame flick/coast, non-orientation areas (LCD/wheel/Select), touch, yaw/pitch/roll, corner handle, cancellation/reset appearance and absence of pose presets.
- Product lighting: existing twenty-four-capture rig test passed its isolated lights, fill metrics and framing/source-identity assertions. Durable numerical output: `product-lighting-summary.json`. This is existing device regression evidence, not new sticker material tuning.
- Production view parity: all three existing tests passed, covering default probe/spike view, eight legacy query variants and normalized LCD image comparison. `production-view-parity-summary.json` records identical pixel hashes and zero mean/max/changed-pixel difference.

The parity suite uses its existing deterministic Apple Music fixture. Orientation/lighting tests do not require authorized music; Apple server configuration was explicitly blank, and their expected token-service 503 errors are recorded. No signing material, environment-file contents or live Apple user data was accessed. No new proof route or replacement fixture was introduced.

## Non-authoritative attempts retained

`current-run.txt`: initial run began with old fingerprint e714a9f/279; first three orientation tests hit the existing five-second mount deadline, then six orientation tests completed. Another engineer edited the fingerprint helper while it ran; a subsequent worker imported the live helper and recalculated a different expected digest. The run was terminated when this was detected, so it is not a final regression verdict. All nine orientation tests subsequently passed in the authoritative frozen-source run; the early timeouts do not establish a sticker regression.

`current-final-run.txt`: a restart encountered the earlier terminated run's orphan Vite process on port 4317, then navigation errors. These are setup failures, not product failures. Only the reviewer's confirmed orphan server processes were stopped. The authoritative run used the isolated free port 4327 and exited successfully. Future coordination must freeze fingerprint/config source for the whole Playwright run, because new workers import live config even though the served source tree is immutable.

No historical browser baseline was needed after all current regression tests passed. A temporary historical archive was prepared but not run, and cleaned afterward. Thus no historical browser pass/fail comparison is claimed.

## Snapshot input defect and reviewed fix

`archive-probe.json` proves the old runner's committed `accd9b5` archive omitted both Vite's new `scripts/sticker-assets.ts` import and the canonical sticker manifest. Its digest also excluded these inputs. This was a real sticker-build integration defect in the replay tool, not in device behavior.

Reviewed fix narrowly includes present sticker build inputs in archives and fingerprints source PNG/manifest/pipeline bytes while excluding generated public output. Independent `bun test scripts/browser-source-fingerprint.test.ts`: **5 passed, 37 assertions**; scoped ESLint passed. Tests execute the archived copy step (60 assets), compare source/public PNG bytes, prove source mutations change provenance, retain forbidden-root exclusions and permit old-commit extraction without a sticker pipeline.

Historical extraction is supported, but mixed-version fingerprint algorithms are deliberately not promised. `historical-algorithm-probe.json` demonstrates the new runner and old archived helper calculate different digests/counts for 8507a63. Historical browser replay must run the matching archived config/helper. The test and diary now state extraction-only historical coverage. No retrospective fingerprint algorithm redesign is part of this patch.

Verdict: **APPROVE** for these existing device regressions and the narrow snapshot-input fix. Existing scoped sticker approvals stand. Live identity/session/Start endpoint work remains deferred and this verification does not complete the stickers goal. No commits or pushes were made by this reviewer.
