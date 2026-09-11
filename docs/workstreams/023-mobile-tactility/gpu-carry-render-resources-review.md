# Independent private carry delivery review

Verdict: **APPROVE the bounded CPU026 source and interface milestone**. No confirmed Critical or Major defect remains in the three frozen files. This does not approve the moving native host, presentation, final-save integration, full browser behavior, or performance. The lead retains those gates and the final manual process ledger.

Reviewer did not author CPU026. Author's diary, scope dispatch K, renderer-host plan, original two-file baseline and exact frozen three-file archive were read before examining the implementation. The reviewer authored CPU025's separate damage/resource changes and does not approve that work here; CPU025 has a different independent reviewer.

## Exact reviewed source

`/tmp/webpod-cpu026-frozen-20260911/manifest.json`, baseline captured at2dbec7290d8831947a41526514cb9ba0cb7d2081. Live files matched frozen hashes when independently checked:

| File | SHA256 |
| --- | --- |
| packages/device/src/sticker-carry-preparation.ts | ad31d46f93c7309652d95399bc850950866a4dfc1f074c84f1be42da66f28d6a |
| packages/device/src/sticker-carry-worker.ts | ab77f45bd4c19889f487cc7926d1a11e7f9baf957cf82bbfef6dda5f4a84d88a |
| packages/device/src/sticker-carry-render-resources.ts | 2175d9d69e8c5b5b618049d3fa1457137c7159afe160ddf1dc0222f8310afb55 |

No application changes were made during this review. Original zero-argument GL preparation and the deformation algorithms remain unchanged; the diff adds opt-in resource custody, worker result retention and explicit private delivery.

## Findings and invariants verified

The same carry producer creates canonical native packets before transferring a distinct cloned main result. Subsequent private-port delivery clones that exact canonical packet. Main never transfers mounted geometry or reconstructs a second deforming surface. Full geometry attributes, indices, bounds, wear revision/geometry, pointer error and owner/job/epoch/assembly stamps survive the protocol. Stable wear arrays may be shared between canonical packets but are not detached by main or private transfer.

The main frame pin is acquired before private resource acquisition; commit can release retired canonical ownership while a displayed/query frame remains pinned. Unmount and producer retirement preserve settled private leases until their explicit renderer release. Pending cancellation terminates the producing worker before clearing reservations, rejects pending copies and ignores stale worker responses. Old settled private leases remain honestly charged. Default GL failure still uses its existing exact cooperative path; renderer mode explicitly fails instead of quietly deforming on main.

Admission is before private send: at most two completed canonical frames, two private renderer owners, one active computation reservation and one latest requested pose. Releasing the superseded frame opens capacity and drains the final latest pose. Resource copy timeout starts with the producer's start ACK so valid queueing is not mistaken for execution failure. The consuming native controller additionally has a45s preparation abort while waiting for acquisition; it must retain that outer guard to cover missing start/delivery messages. The source does not claim physical presentation acknowledgment.

Stamp admission checks source/gesture, conditional landing target, live worker generation and visibility assembly revision. Late old-worker messages cannot mutate the new owner's resources. Hidden default-GL work stops/resumes through its existing lifecycle; native producer retirement retains already-delivered leases. Complete browser hide/resume and host adoption behavior remain integrated acceptance, not inferred from these source checks.

## Independent verification

- Re-executed retained `evidence/gpu-worker/carry-render-resources/check.ts` with an actual module worker and MessagePorts. Main/private arrays, bounds, wear and stamps compare exactly; retransferring the private arrays leaves main buffers attached. Query-pin lifetime, two-owner admission, latest final drain, supersession, pending abort, late ACK, unsupported native producer, idempotent release and final zero pass. One worker/four computed jobs and1,110,040-byte representative payload are work/storage observations, not phone timings.
- Re-executed existing `evidence/cpu-fixes/resources/check.ts`: ten original GL collision/wear identity and disposal checks pass.
- Re-executed existing `evidence/performance/worker-lifecycle.ts`: unavailable-worker exact fallback, final epoch, hidden stop/resume, stale error, disposal and borrowed visibility provenance checks pass.
- Existing free-carry/return-path/projected-bounds suites:13 tests,862,660 assertions pass. These exercise authored geometry and constraints independently of the new wire comparison.
- Scoped lint on all three files and their retained actual-worker proof passes. Affected device/composite/web typechecks were rerun for this review; final results are recorded below.

No browser, trace or commit action was performed. Full native peel/carry/stick, source-to-carried handoff, worn artwork, rapid release/cancel, rotated hit projection, final fit/save, loss/fallback and matched6× responsiveness remain mandatory. No unavailable machine review/source-correlation diagnostic has been interpreted as correctness approval; the final Neuve/manual ledger is lead-owned.

Final independent typecheck result: device, composite and web all exited0 with no diagnostics. Review source remains the exact three hashes above.
