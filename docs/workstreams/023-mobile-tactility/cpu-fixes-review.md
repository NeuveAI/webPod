# Independent CPU fixes review

Verdict: APPROVE. No blocking correctness findings in the completed resource and density lanes. Reviewer authored neither implementation. Scope: WEBPOD-CPU-003, depending on CPU-001/002; read cpu-fixes-scope.md and prior native trace/source audits.

## Resource ownership

The collider retains the existing immutable prepared serialized root; synchronous construction serializes lazily once. snapshot still calls ensure, so disposal rejects access. Disposal drops the cached tree. New collider identity owns replacement state. Borrowed coordinate/provenance arrays are not transferred or detached; cooperative temporary colliders still clone the disposal-owned metadata. This removes the demonstrated recursive reserialization path, while native context cloning and rear attribute copying remain.

Worker wear revisions follow actual source/target geometry identity. Unchanged frames omit the immutable payload; changed surfaces and transitions to null publish a new revision. Copies are transferred, preserving worker source geometry. Main-thread acceptance consumes valid resource payloads even when the corresponding pose is discarded by epoch, so a subsequent same-worker reference can resolve. Worker-instance and active-job guards still precede acceptance, preventing old-worker resource installation. Assembly/revision replacement clears the cache.

The cache owns one lease, with separate leases for displayed and retired frames. Cache replacement/stop cannot prematurely dispose geometry still referenced by a frame. commit releases retired leases; unmount releases the current and retired frames. Per-lease release is idempotent. Worker failure uses the original cooperative computation, with its explicit frame release callback. Source/target geometry math and pointer constraints are unchanged. Steady fallback wear identity is not optimized by this patch.

## Density ownership

Canvas and the physical-box observer now share one per-Canvas Jotai numeric source. Semantic range changes replace the owner; ordinary orientation renders and new equivalent array objects do not. Equal measurements produce no atom notification. Explicit numeric DPR disables observation. The physical resolver is unchanged, including fractional ratios, browser-density maximum and clamp, and the initial range-derived resolution policy is retained.

Observer cleanup disconnects observers/listeners and prevents queued stale callbacks from publishing. Changed numeric Canvas configuration follows Fiber's existing resize/invalidation path. The manifest adds only the already pinned Jotai version and the lockfile adds one workspace dependency entry. No geometry, effects, camera fitting or resolution reduction is introduced.

## Independent validation

- Device typecheck and scoped implementation lint pass.
- 75 existing tests across seven density, screen, camera, collision, preparation, visibility and free-carry files pass; 863,722 assertions, no failures.
- Resource experiment rerun: ten checks pass, including prepared-root identity, query parity, disposal rejection, metadata preservation, real worker discarded-epoch resource handling, stable wear identity, changed-source replacement and commit/unmount ownership.
- Six carry cases match the original computation exactly: sheet, attached, detached, landing, landed and return. Cooperative execution also retains exact parity.
- Density experiment rerun: actual observer/store lifecycle passes fractional physical density, identical publication suppression, 60 modeled configuration checks, emulation/clamp, resize/zoom, canvas isolation, numeric opt-out and stale cleanup.

The density configure counter models installed Fiber's numeric guard; it is not a live WebGL buffer benchmark. No new browser capture was made by this reviewer. Earlier native recordings were development builds with effect replay/debug overhead, so this review establishes structural correctness and deterministic parity rather than production speedup. The original first-carry dispatch self cost includes work not removed here; no claim that the whole stall is eliminated is approved. Supervisor owns combined build and any permitted live verification.

## Live verification remains unresolved

After the source approval, the supervisor's current Chrome development tab became blank following HMR/reload; CDP inspection also timed out. Fresh native Console output reported an immutable-shell-preparation timeout handler taking 39,608 ms and WebGL context loss. The earlier texElementImage2D “No cached paint record” errors were older implementation-period logs, not freshly reproduced after this reload. These observations are supervisor-provided, not independently captured by this reviewer.

A bounded read-only ordering audit found that old and new density code both reach Fiber's existing renderer resize path. At the observed DPR 3, equal initial/physical measurements produce no new density publication. The pre-existing HTML texture adapter gates first paint but does not reset that gate on drawing-buffer resize; this is a plausible race boundary, not a demonstrated cause of the current blank screen. Shell preparation is unchanged by this CPU-fix diff. Neither these facts nor the passing deterministic checks establish that the live failure is unrelated to the changes.

Source review remains APPROVE, with live validation explicitly incomplete. Do not present the blank-screen check as passed, a confirmed baseline/environment failure, or a confirmed regression. A draft PR is appropriate while this gate is unresolved; this review does not authorize merge or deployment. No additional application changes were made during the bounded audit.
