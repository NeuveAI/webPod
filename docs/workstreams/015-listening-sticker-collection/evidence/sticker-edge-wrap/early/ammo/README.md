# Pinned Ammo diagnostic

These artifacts do not establish a working corner wrap. The initial four-node capability preflight passed. The complete C03 exterior seed and frozen load-duration prerequisites subsequently passed independent review.

The first C03 run is explicitly a **fixed initial target substrate/press variant**, not the original current-support adhesion experiment. Initial targets remain fixed; any later capture would measure distance to those targets and would not establish physical adhesion after sliding.

- `c03-initial-oom.log`: initial uninstrumented 64 MiB abort. Its initial attribution to construction was incorrect.
- `c03-construction-phase.log`: bounded construction-only diagnostic reaches all stages and then throws an intentional stop. This is not another OOM.
- `c03-step-phase.log`: unchanged 64 MiB run completes 183 steps at 120 Hz and aborts in native step 184. Before that step, measured native time is 640.366 ms and force time is 34.471 ms. Simulated time completed is 1.525 seconds, before the 2.908333-second press endpoint.
- `c03-64mib-failure.json` and `c03-64mib-cleanup.json`: stage/count summary and explicit ownership destruction ledger. No durable partial mesh was captured before this OOM; no metric or contact verdict is claimed.
- `c03-128mib-loader-failure.log`: approved fixed 128 MiB trial fails during module instantiation. The loader option exists, but the binary memory import requires both minimum and maximum 1024 pages (64 MiB). The second identical 240 Hz loader attempt was not launched.
- `memory-import.json` and its probe: binary limit parsed directly from the unmodified WASM import section.
- `c03-audit-not-run-probe.txt`: prepared diagnostic only; not executed, no audit result implied.

The pinned sparse SDF uses 0.25-unit voxels and allows 262,144 cells, each containing 64 scalar distances plus metadata. This makes dynamic cache pressure plausible, but no cell count or allocation stack was measured. The 19-object destruction ledger does not prove linked internal SDF allocations were freed; isolated process exit reclaims the heap. No engine binary, dependency, lockfile, force parameter, collision setting, or artwork changed.

Commands: `bun /tmp/webpod-ammo-79190a1f/c03-fixed-target.ts` for the recorded 64 MiB variant; `MEMORY_MIB=128 RUN_HZ=120 bun /tmp/webpod-ammo-79190a1f/c03-fixed-target.ts` for the rejected loader attempt. The durable probe copies distinguish their exact revisions. Raw engine assets remain in the isolated temporary cache; URLs and hashes are in `preflight.json`.

## Authorized partial-state recovery

A single unchanged 64 MiB, 120 Hz run subsequently stopped at 150 steps (1.25 seconds), before the known OOM. `c03-partial-150-mesh.json` retains original rest coordinates, indices and solved node positions/velocities; `c03-partial-150-audit.json` reports both-half/full-material strain and contact diagnostics. Native time was 519.280 ms and force time 24.511 ms. Principal stretches were 0.93109–1.06174, with no degenerate triangles, but 134 shell-intersecting triangles and 10 self-overlap pairs were found. Maximum sampled vertex-support distance was 62.083, still during pressing. These are partial-state measurements, not a completed wrap or adhesion verdict.

The periodic checkpoint writer replaced a single file every 30 steps. Only its final mesh survives, so no earlier position trajectory or swept certificate is claimed. The complete per-step timing timeline is preserved. The summary states connected-pair shrink and interior-gap limitations explicitly. All 19 native owners were destroyed and the process exited.
