# Final Neuve review shell handoff

Human decision pending. This is advisory tool routing and UI provenance, not independent approval or a new correctness finding.

The actual `get_review_model` MCP call returned `status: ok` with branch-current validation and19 human-required units. The command-owned model reports Blocked, unresolved source relations and no path/snapshot-matched scoped checks for these19 units. Those unmatched tool correlations do not erase the independently reviewed source and retained tests/browser evidence; conversely, independent engineering approval does not record a human tool decision.

## Intended committed range and provenance

- Repository: `repo-c88b1a21075f`, branch `codex/gpu-worker-rendering`.
- Verified artifact range: `4cc7f4a7f5964d04733c5bb6a1e0b23cde0d072c` → `eff3f20693c0c1f80c93851feed906a79394f05d` (`eff3f20`), committed snapshot.
- Lead's focused host triage is the final command scope; this lane did not regenerate or reinterpret its range.
- Artifact: `.neuve-artifact/triage-1789159323-300591000-58026.json`.
- Read model: `read-model-2353b899dda716238cb67800`.
- Snapshot: `branch-snapshot-eb84b28878d6fcf3d8b57af1`.
- Matrix: `review-unit-matrix-af14b8d674c4e80b4951d714`, rule `review-unit-matrix-rules-v5`.
- MCP audit: `audit-mcp-get-review-model-1789159401620407000`.
- Model schema: `neuve.mcp.review.branch.v0`.

Actual read command: `bun /tmp/webpod-neuve-mcp-call.ts get_review_model /tmp/webpod-neuve-repo.json /tmp/webpod-final-review-model.json`. The helper starts the installed `/Users/vinicius/.local/bin/neuve mcp serve --repo /Users/vinicius/code/webPod`, initializes MCP and calls the advertised tool. Fresh `resources/read` retrieved `ui://neuve/review-shell`; `tools/list` confirmed the available reads and decision tool. No decision tool was called.

## Final CLI artifacts (lead-owned execution)

All four retained command outputs identify the same committed base→eff3f20 range above. Broad passes orient the range; the focused host pass supplies the19-unit shell model. No broad command was rerun by this integration lane.

| Operation | Retained output | Actual artifact |
| --- | --- | --- |
| Scan | `/tmp/webpod-final-neuve-scan.txt` | `.neuve-artifact/scan-1789159180-619757000-56971.json` |
| Broad triage | `/tmp/webpod-final-neuve-triage.txt` | `.neuve-artifact/triage-1789159219-731928000-57197.json` |
| Sources: `packages/composite/src/device-render-host.ts` | `/tmp/webpod-final-neuve-host-sources.txt` | `.neuve-artifact/sources-1789159280-557289000-57712.json` |
| Focused host triage | `/tmp/webpod-final-neuve-host-triage.txt` | `.neuve-artifact/triage-1789159323-300591000-58026.json` |

The outputs explicitly exclude uncommitted changes. Subsequent evidence-only notes do not extend this source snapshot. Lead reports final source checks/smoke complete and PR6 ready for human review; the tool's manual lane and the independently accepted engineering evidence remain separate. Neither manual routing nor a local gate records automatic human approval.

## Visible actual shell

No native Neuve tool was exposed in this Codex tool session. A temporary local host serves the exact actual MCP shell HTML unchanged inside an iframe and forwards only `get_review_model`, `list_review_models` and same-repository review-resource reads to the real stdio server. Served-shell SHA equality and actual forwarded model status/count were verified. Lead observed the shell visibly loaded in Codex reviewTab2 with19 units.

The host-only banner states: **Read-only review. Reply in the task with your decision; buttons here do not record approval.** The shell's existing Accept controls are not a record of approval. Mutating RPC calls are rejected; no decisions were fabricated or persisted. A human can inspect the actual shell and give a bounded decision in the task, then the lead can use the actual decision tool under explicit authorization.

Temporary local URL: `http://127.0.0.1:59888/c3820647-1cf6-4d7d-839f-d351b3a9e396`. Host script `/tmp/webpod-review-shell-host.ts`; metadata `/tmp/webpod-review-shell-host.json`. Local host lifetime is limited to its running process; it is not a deployed product route. No application source, current Chrome tab, or performance trace was touched by this subtask. Raw model/resource responses stay in `/tmp`; this note retains bounded provenance only.

## Manual host paths

- `packages/composite/src/CompositeDevice.tsx`
- `packages/composite/src/WorkerDeviceCanvas.tsx`
- `packages/composite/src/device-render-host.ts`
- `packages/composite/src/html-in-canvas.ts`
- `packages/composite/src/lcd-material-nodes.ts`
- `packages/composite/src/native-canvas-measurement.ts`
- `packages/composite/src/native-carry-controller.ts`
- `packages/composite/src/native-carry-input.ts`
- `packages/composite/src/native-carry-resources.ts`
- `packages/composite/src/native-pack-controller.ts`
- `packages/composite/src/native-pack-layout.ts`
- `packages/composite/src/native-pack-query.ts`
- `packages/composite/src/native-pack-resources.ts`
- `packages/composite/src/native-screen-transport.ts`
- `packages/composite/src/native-sticker-controller.ts`
- `packages/composite/src/native-sticker-resources.ts`
- `packages/composite/src/native-sticker-warmup.ts`
- `packages/composite/src/native-workspace-reframe.ts`
- `packages/composite/src/panel-projection.ts`

## AX note

The validated model and real shell make the requested manual scope inspectable. The generic unresolved-source/unmatched-check routing remains advisory and needs human interpretation alongside independent evidence. Native MCP UI integration was unavailable, so the faithful temporary read-only host was necessary. The shell's visible Accept affordance without a persistence call is potentially misleading; the outer banner explicitly states that limitation. No auto-approval is claimed.
