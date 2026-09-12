# Review: CPU023 — native measurement and density publication

## Verdict: APPROVE — measurement delta only

### Correctness Check

- Source of truth: dispatch I and recorded decisions in gpu-worker-scope.md, gpu-renderer-host-plan.md, existing pixel-density.ts and html-in-canvas.ts resolvers, and archived WorkerDeviceCanvas.before.txt (SHA256 d7c9e453677ddd423d5813dbe11feaf95f88f02f6ab0a18b93c89d4e5d93b5c4).
- Kanban ticket: WEBPOD-CPU-023, in-progress, source references SRC-CLI-1789138385593-1/-2. Show/context read; explicit Canvas release satisfied, no parent dependency. This reviewer did not author the implementation.
- Correctness target: one observer/scheduling owner per canvas generation, exact CSS/backing/raster density, deduplicated publication, DPR-only/hidden/zero-size/replacement behavior and listener cancellation.
- Dispatch scope: native-canvas-measurement.ts plus **only the measurement delta** in WorkerDeviceCanvas.tsx against the archived before file. The surrounding untracked Canvas implementation, host, worker, protocol, screen upload and native-element-image dynamic allocation extension are excluded. This does not approve staging the entire untracked Canvas.
- Frozen snapshot: /tmp/webpod-cpu023-reviewed-fix-20260911/. Helper SHA256 `363fd1d3a45344c6978b3dac3ec5d81748804f4f8dd2ef812166ff35168122eb`; caller SHA256 `75a951e1a4028fe04853d4dd901fa0ed67f68f6e17302e3defbde067c847e729`. Both hashes verified. Caller hash identifies comparison input, not approval of all its existing code.
- Integration: numerical equality is checked before camera fitting/matrix allocation and revision advancement. The caller retains its camera/framing formulas and floor backing dimensions. Measurement passes coherent raster dimensions to updateLayout(layout, raster); host owns capture/texture revision and adoption. Existing logical 320×240 destination and intrinsic-panel fitting remain separate.
- Numerical policy: original resolveCanvasPixelRatio, explicit numeric override, max(native DPR, resolved DPR), panel raster quantization and frame sizing remain canonical. Physical evidence is retained only for matching CSS/native-DPR inputs. No quality cap or new preference.
- Type/lint/doc gates: independently ran device, composite and web TypeScript checks; all pass. Final helper/caller and all native-layout TypeScript evidence pass scoped ESLint. Documentation identifies browser and full-host limits.
- Existing tests: 13 pass, 49 assertions across pixel-density and html-in-canvas. Actual measurement-owner lifecycle: 16 checks pass, using Happy DOM canvas and deterministic scheduling/observer/media callbacks. No browser-rendering claim.
- Reviewer proof: evidence/gpu-worker/native-layout/reviewer-density.ts and .json independently exercise both regressions below; final changed:false and coalescedCorrect:true.
- Git/staging: no reviewer application edits or commits. Helper/evidence can form a bounded source commit; full caller awaits host review.

### Findings

- **RESOLVED MAJOR — duplicate resize downgraded valid physical density.** The initial helper consumed its observer entry, then a duplicate window/visualViewport notification used only native DPR. With unchanged 390×844 CSS, physical DPR 1.5 and native DPR 1, it changed backing 585×1266 to 390×844 and LCD raster 640×480 to 320×240. The author now retains physical evidence with CSS/native-DPR provenance. Independent replay preserves output and suppresses duplicate publication.
- **RESOLVED MAJOR — coalescing discarded newer physical evidence.** The first correction saved evidence only during flush; a same-frame resize could discard a fresh observer entry beforehand. Physical DPR 1.75 followed by resize reproduced stale 1.5. The author now saves small physical metadata in the observer callback and validates provenance at flush. Independent replay produces DPR 1.75 and floor backing 682×1477.
- No remaining Critical or Major finding in this bounded delta. Hidden state cancels frames; zero/nonfinite CSS dimensions retain valid layout. Disposal removes resize, viewport, media and visibility listeners, disconnects the observer, cancels the frame and guards stale callbacks. Replacement starts independently. Pose/React prop notifications do not invoke measurement.

### Suggestions (non-blocking)

- None. Actual current-Chrome raster allocation, resize upload/binding, visual fidelity, native failure recovery and 6× responsiveness remain mandatory host acceptance. This source review does not satisfy those gates.

### Neuve Dogfood Feedback

- Commands: owning kanban show/context; focused sources usage for native-canvas-measurement.ts with current uncommitted range; scoped evidence and gate records.
- Source artifact: .neuve-artifact/sources-1789139242-852335000-22065.json.
- Limitation: SourceGuardLimit/MetadataOnlyRange/ProviderUnavailable fallback, missing semantic usage and no correlated source context. Formula/lifecycle inspection and independent reproductions establish this bounded source disposition, not that advisory output.
- Value: ticket scope and archived-before boundary distinguish measurement from the larger untracked host caller.
- Supervisor retains final manual/source-correlation ledger and native acceptance. No inferred waiver, full-goal completion or whole-Canvas approval. Ticket gate is bounded process evidence only.
- This review is the retained feedback narrative; a local feedback event accompanies the source artifact.
