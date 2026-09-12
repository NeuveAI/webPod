# Review: hidden-tab orientation cancellation

## Verdict: APPROVE

### Correctness Check

- Source of truth: current AGENTS.md, gpu-final-visibility-fix.md, final feature-complete lifecycle scope, frozen orientation controller/tests and existing motion authority cancellation.
- Scope: only apps/web/src/device-preview-orientation.ts and its existing test. Independent frozen hashes are retained in evidence/gpu-worker/final-visibility/reviewer-manifest.json.
- Target: hiding without guaranteed blur must end the current enclosure drag/capture and local/remote motion, preserve its pose, and not resurrect it on visible return.
- Type/lint gates: web typecheck and scoped ESLint pass independently. All36 tests/205 assertions pass independently.
- Tracker: workstream documents only; no Neuve shell/board under repo law.
- Runtime gate: lead still verifies actual Chrome hidden/reentry and final source provenance. This source verdict does not substitute for that check.
- Reviewer made no application, browser, server, build or commit changes.

### Findings

No Critical/Major finding in this bounded fix.

The controller now uses its stage's ownerDocument, with a safe global fallback for existing callers. New grabs are rejected while hidden. Hidden and blur share one interruption path. An active pointer sends native pointer-cancel using the last recorded sample, then finish removes move/up/cancel/lost-capture listeners, clears the active owner and releases capture safely. Clearing active ownership before release prevents lost-capture reentry from repeating cancellation. Repeated hidden/blur events find no active pointer.

stopMotion uses the existing motion-generation barrier, cancels the remote owner, rejects a pending flick and clears local RAF ownership. Visible return has no resume action; a fresh visible grab remains available. The current orientation is not rewritten by interruption. Existing motion authority builds cancellation from its current intent, preserving the current pose boundary. Disposal removes the new visibility listener alongside existing ownership cleanup.

The added tests exercise hidden without blur, exactly one native cancellation, capture release, ignored late pointer events, repeated hidden/blur, hidden begin refusal, fresh visible begin, disposal, local flick rejection and no restart, remote cancellation and rejected late renderer progress. Existing motion, keyboard, reduced-motion and tool tests remain passing. No motion mathematics, saved placement or renderer protocol changed.

### Independent verification

```sh
bun test apps/web/src/device-preview-orientation.test.ts
bun run --cwd apps/web typecheck
bunx --bun eslint apps/web/src/device-preview-orientation.ts apps/web/src/device-preview-orientation.test.ts
```

Results:36 tests/205 assertions, web types and scoped lint pass. Exact frozen source/test hashes verified.

### Suggestions (non-blocking)

Retain the lead's real visibility transition evidence separately, since synthetic EventTarget tests do not establish browser event ordering.

### Neuve Dogfood Feedback

Not run: current repository instructions explicitly mandate workstream tracking and prohibit Neuve shell/board. No ticket or approval routing fabricated.
