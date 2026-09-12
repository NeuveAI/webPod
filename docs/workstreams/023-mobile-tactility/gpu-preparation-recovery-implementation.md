# CPU022 — preparation canonical recovery

Implementation frozen for independent review. This is an authored implementation handoff, not its own source approval or completion of the native renderer goal.

The renderer acquisition API and GL hook are unchanged. Cancelling a genuinely dispatched private lease still terminates the sole preparation worker before freeing its pending private-copy reservation. A later acquisition can now restore canonical ownership from the exact retained query bytes instead of rejecting a permanently nonresident cache entry. It does not rerun the geometry or texture recipe.

## Ownership and scheduling

The existing broker is the only preparation and accounting authority. Recovery occupies its normal execution slot: queued form preparation waits during a reseed, and reseed callers wait for existing preparation. There is one shared reseed transaction and at most four in-flight renderer acquisition callers. Concurrent callers share the seed, then use the existing four-lease and 128 MiB admission policy; capacity rejection is explicit rather than an unbounded queue of private copies.

The broker snapshots only small wire metadata from mounted immutable wrappers, pins the cache entry, reserves one complete additional payload, and copies typed buffers cooperatively. Copies preserve byte offsets, view lengths, normalized/item-size metadata, groups, bounds, draw ranges, names, texture samplers and texels. Shared buffer identity is preserved through a buffer map. The source arrays are never transferred. Each copy checkpoint handles at most 256 KiB; `yieldSteps` begins after a macrotask and yields against its existing four-millisecond budget. Allocation of one destination ArrayBuffer remains a native indivisible operation, so this is not a mobile maximum-step timing guarantee.

The private copy transfers into the same worker protocol with entry and recovery IDs. The worker adopts that copy as canonical, acknowledges it, and subsequently clones renderer-private resources directly onto the provided MessagePort as before. It never calls the recipe for a seed. Worker identity plus both IDs reject retired acknowledgements. The existing host microtask cleanup fix is outside this slice and was not edited.

Accounting includes main query bytes, resident canonical bytes, one recovery-copy reservation, and existing private/pending renderer lease reservations. After a copy is transferred, that same reservation covers worker adoption until its exact acknowledgement changes it to canonical accounting. Cancellation during cooperative copying keeps the reservation and cache pin until the generator has unwound; cancellation after transfer terminates the worker before releasing them. A seed timeout, worker failure, unavailable Worker constructor or seed transfer failure rejects native acquisition while retaining the complete GL/query resources. A later caller may retry. The existing normal preparation fallback remains unchanged for an uncached recipe.

## Exact manifest

Application source (only these three files):

- `packages/device/src/immutable-shell-preparation.ts`
- `packages/device/src/immutable-shell-worker.ts`
- `packages/device/src/device-preparation-data.ts`

Retained evidence:

- `evidence/gpu-worker/preparation-recovery/baseline.patch` — handoff patch archived before editing.
- `evidence/gpu-worker/preparation-recovery/baseline-sha256.txt` — pre-edit hashes of the three source files.
- `evidence/gpu-worker/preparation-recovery/check.ts`
- `evidence/gpu-worker/preparation-recovery/check.json`

This diary is the only additional document. No browser, trace, dependency, route, host, scene or commit changes were made.

## Validation

`bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation-recovery/check.ts` passes 15 retained checks with actual Bun module workers and native MessagePorts. Only React commit callbacks, acknowledgement delivery, and one injected seed transfer failure are controlled. It proves genuine dispatched private-copy cancellation, exact retry parity, mounted query identity and non-detachment, late old worker/seed acknowledgements, cancellation before copying and after worker adoption, concurrent callers sharing a seed, bounded admission, failed transfer recovery, and final disposal. Every delivered resource is compared against the complete borrowed query wire data, including geometry and texture metadata. The default assembly has 23,148,696 bytes. The initial six seed attempts issue only one geometry preparation request. The added unrelated-form eviction scenario prepares one second form once; final totals are two legitimate form preparations, seven reseeds, and at most one live producer. Final cache, worker, recovery, request, private-lease and byte counts are zero.

Additional executed checks:

- Existing preparation lifecycle experiment: 12 checks pass, including StrictMode reacquisition, two owners, stale workers, exact cooperative fallback and queue bounds.
- Existing curved-shell, product-shell, hardware-geometry, screen-aperture and textures suites: 31 tests pass, 155,035 assertions.
- Device and composite TypeScript checks pass.
- ESLint passes for the three source files and the retained new TypeScript probe.
- Scoped `git diff --check` passes.

The historical `renderer-host/prepared-leases.ts` proof's final assertion expects permanent rejection after canonical loss. That expectation is intentionally superseded by this recovery proof; it must not be presented as a passing current recovery test. The original cold preparation recipe and its established parity evidence are unchanged.

These are source and offline lifecycle proofs, not Chrome cancellation acceptance, GPU visual parity or a 6× phone performance measurement. The independent reviewer must accept this implementation separately. The supervisor retains native end-to-end and final process gates.

## Independent-review correction

The reviewer found that eviction of an unrelated unmounted form could call the idle worker stop path while another form's recovery was active. The request's own signal remained live, but its recovery was incorrectly aborted. The idle-stop condition now also requires no active recovery. The authored actual-worker proof adds two mounted forms, canonical loss, active default recovery and unrelated form unmount; exact default query identity/output survive and final ownership still returns to zero. Only `immutable-shell-preparation.ts` changed in this correction. Source is refrozen for the same independent reviewer; this diary does not approve the correction itself.
