# Sticker pack flip transitions

User reports dropped frames as packet spawns/dismisses when device flips. Priority is diagnosing and fixing this transition, preserving authored timing, geometry, materials, effects and exact interaction behavior. Baseline source902c9d1; use the user-provided existing DevTools trace before recording new work. Existing current Chrome localhost tab is the only profiling target. No approval to merge or deploy is inferred.

Investigation: correlate pack visibility changes with React commits, preparation/compilation, worker dispatch and resource retirement; distinguish main and renderer/compute workers. Inspect cold first reveal versus repeated flips, including reversals. Save existing trace and confirm any dialog, never leave a recording active. Broad aggregate scripting time is not root-cause proof.

Lead owns browser and bounded trace analysis. Author source audit is read-only until a concrete cause and narrow file scope are recorded. Separate reviewer validates any fix, lifetime bounds and matched runtime behavior. No lower quality, larger memory caps, or unbounded hidden-scene cache. Preserve pending/current resources and input/media priority.

Tracked follow-ups remain actual hide/resume with observed visibility event, reduced-motion behavior, and genuine GPU-loss/recovery validation. They are separate from the current pack-transition priority.

## Preserved user evidence and queue

Owning ticket WEBPOD-CPU-030 is in progress, no dependencies, source SRC-CLI-1789164803247-1. Expected evidence: `Attributed transition profile and validated fix`; validation scope: current Chrome sticker pack flip transitions, resource lifetime and unchanged fidelity.

The existing recording was exported through DevTools and the native Save dialog accepted. File: `/Users/vinicius/Downloads/Trace-20260912T000938.json.gz`. Metadata reports iPhone 16 Pro Max, CPU throttling 6, 11.864 seconds, 212,520 trace events. The device toolbar's separate network/device throttling selector says disabled; the Performance CPU setting and saved metadata both confirm 6× CPU. Main renderer PID62025/TID4853675. No new recording was started; Record remained off after export.

User React custom-track screenshot identifies repeated StickerAppearanceEditor spans, one 356.10 ms. Source audit is `gpu-pack-flip-editor-audit.md`; trace sample attribution is pending. Treat component spans as potentially inclusive. Main trace also contains a 1.889-second CpuProfiler::StartProfiling event and substantial nested async debug instrumentation; do not treat aggregate scripting as application self time or add nested duration totals.

Follow-up tickets are WEBPOD-CPU-027 (actual hide/resume), WEBPOD-CPU-028 (reduced motion), WEBPOD-CPU-029 (genuine GPU loss/recovery), all ready and separate from the priority pack investigation. Prior review gates remain recorded independently.

## First implementation slice: hidden editor contour guard

Trace attribution confirms approximately5.6seconds in the editor contour chain, including exact visibility raycasts. The screenshot's356.10ms span is present in changed-prop async React measures; numeric TimeStamp entries cover a different set of renders. Presence during the trace is not recoverable, so the hidden guard must not be claimed to eliminate all observed stalls before matched validation.

Authorized file boundary: `apps/web/src/sticker-editor.tsx`, plus a focused existing-pattern behavioral proof/test and this workstream evidence. Gate contour computation when no shown editor or presence is fully zero; retain the existing contour and placement behavior for every positive-presence frame, including exit. Preserve hooks, cancellation/error/tool state, retained selection, and recomputation on re-entry/current projection. No memo comparator ignoring callbacks, no geometry simplification, worker protocol change or raycast algorithm change in this slice.

Engineer must verify hidden retained editor receives zero contour calls across projection updates, positive-presence dismissal still computes, and reopening computes the current pose. Exercise no-selection, cancellation/error and return behavior as applicable. Run app typecheck and scoped lint, preserve unrelated .gitignore, leave app changes uncommitted for independent review. Evidence/decision log: `gpu-pack-flip-hidden-editor-fix.md`. Reviewer independently verifies source/behavior/typecheck after frozen handoff. Lead owns actual current-Chrome before/after interaction validation; do not mutate the browser from agents. Closeout requires evidence and separate review; any remaining visible contour cost stays explicitly open.

## Current-Chrome guard checkpoint

Frozen guard4234685 on normal devserver, requested/effective worker, existing iPhone emulation and6×CPU. Existing Night Shift placement preserved. Trusted rear rotation then sticker click opened actual controls; orientation change dismissed the editor, second rotation remained hidden. Reopening exposed scale/rotation/return controls again; Escape dismissed after its fade. Reset view returned front. No wear/placement edits or return-to-pack action. Temporary RAF/LoAF/longtask observers were stopped in finally and removed; no new DevTools trace was started.

A bounded7.642second probe (376frame intervals) during dismissal and a second flip reported maxRAF300.1ms, p9533.7ms. Six long tasks303/196/142/142/152/77ms: the first five were within1.72seconds of probe start during visible dismissal; the last at4.899seconds near second rotation. This is a single development-build observation, not a matched before/after benchmark or proof all remaining cost is contour. It confirms unresolved transition jank while the editor remains visible; exact post-guard stack attribution is still required. Preserving fidelity means fixing that cost rather than cutting the exit animation. Raw bounded observer output and probe are retained under evidence/gpu-worker/pack-flip/.

## Next scope: exact visible contour work

Open priority after hidden guard: attribute the remaining positive-presence transition tasks with a bounded post-fix profile, then move/batch the exact contour visibility queries if they still dominate. Candidate boundary is one immutable pose/contour query per animation frame on a worker, latest-result publication with stale/cancel protection and bounded ownership. GPU use is appropriate only if exact visibility and latency can be preserved; the current native renderer already uses worker/WebGPU. Do not replace exact occlusion with a simplified contour or drop authored fade frames. Existing visibility code already prepares transforms once and uses pretransformed collider data; repeated preparation is not the demonstrated hotspot. Keep lifecycle follow-ups separate.

Tracking authority going forward is this workstream, per the latest supplied AGENTS.md. Earlier board references are retained as historical provenance; no new board IDs are needed.
