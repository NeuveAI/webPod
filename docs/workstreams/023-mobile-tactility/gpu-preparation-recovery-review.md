# Preparation recovery independent source review

Verdict: **APPROVE for the bounded corrected CPU022 source**, after one confirmed Major was fixed and independently reproduced as resolved. This is not native renderer activation, browser fallback acceptance, or full-goal completion. Reviewer authored none of these application changes and made no application fixes.

## Scope and review setup

Read gpu-worker-scope dispatch H and its explicit same-authority reseeding decision, gpu-renderer-host-plan, and gpu-preparation-recovery-implementation.md. Used strict-critique, team review protocol and runtime lifecycle/ownership checklist. The dispatch permits exact copying of retained immutable query bytes after real canonical loss; permanent rejection is no longer the required behavior. Inspected the three owned modules and actual worker/MessagePort caller protocol, plus existing ShellGeometryTransfer and cooperative scheduler contracts. Existing parent-owned tracking/manual process ledger remains separate; this review does not invent a board gate result or human waiver.

Reviewed source SHA256:

| File (packages/device/src) | SHA256 |
| --- | --- |
| immutable-shell-preparation.ts | `86551c42c51b8feed5ddf2c9df46e32ce9f4b31514cfb179706cf239ba1756c1` |
| immutable-shell-worker.ts | `745b327eade51cdf7d234491e7fe9bfc76ca32bf797462a722a3c5b795c8d619` |
| device-preparation-data.ts | `3204a47658676fcf70ba0154133b0f3c1210ea82d175a9267cf06a9d2627807a` |

## Resolved Major

`immutable-shell-preparation.ts:33`: the idle eviction condition initially ignored an active recovery. With two mounted forms after producer loss, acquiring a renderer lease for one form and unmounting the other caused its zero-delay eviction to call stop(), aborting the unrelated live reseed. The actual request signal was never aborted. This violated shared-owner isolation and could trigger unnecessary native fallback during unrelated device cleanup.

Independent actual-worker reproduction is retained as evidence/gpu-worker/preparation-recovery/reviewer-unrelated-eviction.ts/json. Before correction it failed with `AbortError: Cancelled`; after the author added `!recovery` to the idle shutdown condition, the same reproduction succeeds with `fulfilled` and `callerAborted:false`. The reservation still clears after actual copying unwinds or the worker retires. Empty-pool shutdown remains covered by original and extended lifecycle checks.

## Ownership and exactness findings

No remaining Critical/Major source finding in this slice. Recovery shares the existing preparation execution slot; it does not invoke prepareDeviceSteps for cached data. Borrowed metadata references remain attached to the pinned query owner. One extra payload is reserved before copying, retained through cooperative cancellation unwind or worker adoption, then becomes canonical accounting only after the matching worker/entry/recovery acknowledgement. Private renderer copies remain independently charged until release; caller count is admitted before awaiting preparation. Retired worker callbacks cannot mark a replacement resident.

The worker adopts seed data into the same canonical map and later sends private copies through the existing port protocol. Main mounted buffers are never transferred. Copy metadata preserves texture sampler/color/flip/mip flags, geometry groups/bounds/drawRange, typed views and shared buffer identity. Independent reviewer-copy.ts/json additionally exercises shared buffers with nonzero Float32/Uint16/Uint8/Uint8Clamped view offsets and cancellation preservation, beyond the default assembly's actual-worker byte comparison.

Copy loops yield every256KiB using the existing4ms cooperative scheduler. An individual ArrayBuffer allocation remains native and indivisible; this is explicitly documented and not claimed to meet a phone timing bound. No shared-memory availability assumption or per-frame preparation was introduced.

## Independently executed verification

- Actual recovery `check.ts`:15 checks pass; two legitimate form preparations, seven reseeds, peak one worker; final cache/request/recovery/private/buffer accounting zero. Includes exact default23,148,696-byte query/private comparison, cancelled dispatch, old worker/seed acknowledgements, concurrent shared seed, transfer failure, retry and unrelated eviction.
- `reviewer-unrelated-eviction.ts`: confirmed failing-before/passing-after actual owner isolation reproduction.
- `reviewer-copy.ts`: exact metadata/bytes, shared buffer identity, nonzero view offsets/lengths, private ownership and initial cancellation pass.
- Existing preparation lifecycle.ts:12 checks pass, including StrictMode, two owners, stale worker, cold failure/cooperative recovery and queue bounds.
- `bun test packages/device/src/curved-shell.test.ts packages/device/src/product-shell.test.ts packages/device/src/hardware-geometry.test.ts packages/device/src/screen-aperture.test.ts packages/device/src/textures.test.ts`:31 pass,0 fail,155,035 assertions.
- Device and composite typechecks pass after the correction. Scoped ESLint passes for all three source modules, authored check and both independent proofs. Scoped git diff--check passes.

Logs: /tmp/cpu022-independent-{check,lifecycle,tests,lint,device-types,composite-types}.log. Retained proof files are under evidence/gpu-worker/preparation-recovery/. The historical renderer-host/prepared-leases.ts permanent-rejection assertion was intentionally not run or reported as passing, because its final expectation contradicts the approved recovery policy.

Lead still owns current-Chrome native cancellation/retry, complete GL fallback, scene fidelity, raster quality,6× responsiveness, combined final gates and manual process closure. No browser or GPU-speed conclusion follows from these source/offline checks.
