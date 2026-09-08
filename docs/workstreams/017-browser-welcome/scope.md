# Browser welcome and device teaser

Status: ready for local implementation; visual direction remains owner-reviewable.

Primary source: the user's request for HTML-in-Canvas setup guidance and a looping
Three.js device demo with a rear sticker reveal. No publishing or commits requested.

## Acceptance and verification

| Slice | Correctness | Proof | Intended commit |
| --- | --- | --- | --- |
| Browser guidance | Actual API support bypasses setup regardless of version. Old Chrome, other browsers, missing graphics and reduced motion receive accurate instructions. WebMCP is not a gate. | Pure policy tests, live Chrome inspection | Guide unsupported browsers into webPod |
| Teaser | Existing physical model, ordinary CanvasTexture demo screen, rear stickers; no HTMLTexture or account initialization. | Front/rear screenshots on the product route, browser errors | Preview the device before browser setup |
| Lifecycle | Pause control, reduced motion, hidden-tab suspension, cleanup; narrow-screen layout stays readable. | Browser checks, typecheck and lint | Same as teaser |

Definition of done: policy tests, relevant regression tests, `bun run typecheck`,
`bun run lint`, and visual inspection of `/` with the feature unavailable and
available. No proof-only routes. Evidence in `evidence/`; results and final review
in `review.md`; implementation notes and decisions in `decisions.md`.

Dependency graph: capability policy -> welcome gate -> animated preview -> browser
verification. Single implementation owner; no independent agent dispatch.
Review lanes: capability/lifecycle correctness and interface/motion visual review.
Use workstream-scoping, interface-craft, interface-design-guardrails and React
performance guidance. Do not modify credentials, server domain services, WebMCP,
encrypted design.pen, existing personal placements, or unrelated workstreams.

## Sources and decisions

- Primary: `packages/composite/src/capabilities.ts`, `tier-store.ts` define the
  existing capability report and feature detection; reuse their types and exports.
- Supporting: https://developer.chrome.com/blog/html-in-canvas-origin-trial and
  https://wicg.github.io/html-in-canvas/ document the experimental flag. No verified
  stable shipping milestone: never infer availability from a future version number.
- Supporting: installed `apps/web/node_modules/three/src/textures/CanvasTexture.js`
  and installed Fiber/Jotai types define rendering and state APIs.
- Supporting: existing `DeviceCanvas`, `ScreenMeshHandle`, `DeviceStickerScene`
  contracts and immutable sticker catalogue; reuse without parallel geometry.
- Missing source: requested `/Users/vinicius/code/.better-coding-agents/resources/`
  does not exist. Existing checkouts are in `/Users/vinicius/code/agentic-context/`;
  installed pinned dependencies win. Global-patterns/Jotai skill references to
  `~/code/agent-context/` are also absent; repository law and installed sources win.
- Anti-source: old comments promising flat DOM/T3 fallback describe unbuilt behavior.

## HITL and assumptions

No blocking decisions. Use the existing dark studio with a compact setup banner,
large model and minimal introductory copy. Considered a setup modal and a separate
marketing page; chose inline guidance to keep the model visible during setup.
Quality targets: clear setup, tangible model, restrained motion, readable mobile.
Chrome blocks ordinary web navigation to its privileged flags pages: expose the
address and reliable copy instructions, with a new-tab link as a best-effort helper.
Static fallback must remain honest when WebGL is unavailable. Do not claim that
preview playback is real or mutate saved collections. Owner judges visual taste
from the implemented product; no merge or deployment is part of this request.
