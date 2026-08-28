# 002 — Review lanes

Two standing reviewers, so no lane queues for a slot. **A reviewer never reviews code it wrote**; pairings are recorded in `tracker.md`.

Every reviewer loads `review-system-prompt.md` verbatim, plus the lane's skills below, plus this directive:

> Be extra critical. Question every line. Assume the code is wrong until proven right. If you find ANY critical or major issue, the verdict MUST be REQUEST_CHANGES.

| Lane | Slices | Skills to load | Ground truth to read before reviewing | Sharpest question for this lane |
|---|---|---|---|---|
| **L-A · Platform & build** | W0 scaffold, tokens, hygiene, W5 gates | `/global-patterns`, `/bun-http` | `~/code/agentic-context/bun`, `ui/apps/v4/app/globals.css`, `ui/apps/v4/components.json`, design-system §12.1 | Do the gates actually **fail** on a planted violation? A gate that has never gone red is not a gate. |
| **L-B · Data & services** | W1 providers, later `server-core` | `/effect-services`, `/global-patterns` | `~/code/agentic-context/effect` (**4.0.0-rc.112**), pm-spec §14 | Does any `supports()` return `true` for something unproven? Is `provider.id ===` used anywhere outside `packages/providers`? |
| **L-C · State & correctness** | W2 state core | `/jotai-state`, `/global-patterns` | `~/code/agentic-context/jotai/docs/core/store.mdx` (**`published: false`**), pm-spec §4.3–4.7 | Is the store genuinely reachable and mutable with **no React tree mounted**? Is a keyboard arrow **exactly** one detent with no acceleration, on every path? |
| **L-D · Interface** | W3 panel | `/interface-craft`, `/web-design-guidelines`, `/interface-design-guardrails`, `/neuve-motion`, `/modern-web-guidance` | design-system §4, §5.11, §6, §11; pm-spec §10, §15.1; `design.pen` via MCP | Was this designed in dark and then tinted for light? Show me both screenshots for every state, or it is not done. |
| **L-E · Render & performance** | W4 device layer | `/interface-craft`, `/runtime-review`, `/modern-web-guidance` | `~/code/agentic-context/three.js`, `react-three-fiber/docs`, design-system §12.3, §14.1 | Is any gradient **painted** rather than emerging from the light rig and env map? Does an untouched device produce **0 rAF callbacks**? |
| **L-E · Composite seam** | W6 | `/interface-craft`, `/runtime-review`, `/modern-web-guidance` | `~/code/agentic-context/html-in-canvas` (README + `Examples/webGL.html`), `three.js/src/textures/HTMLTexture.js`, `examples/jsm/interaction/InteractionManager.js`, 001 `stack-research.md` §1 | **Could T3 be added without changing the `PanelPixelSource` interface?** If not, the interface is wrong and this is a Major finding. Also: does `packages/panel` still mount bare with no canvas and no three.js — is there a test proving it? Is `updateElementGeometry` called on device movement and **only** on device movement? Is any tier compared outside `packages/composite`? Is the raw WebGL entry point called directly anywhere? |

## Escalation to the lead — do not resolve these in a review thread

- A conflict between two primary sources (001 prose vs `design.pen` canvas vs a clone's API).
- A finding that would require changing a recorded H-decision.
- Anything that smells like an invented permission, an invented agent-presence signal, or a fact with no API behind it — surface it to the lead *and* the owner, because these are the four failure modes that already got through once.
- **Any W6 finding that would require `packages/panel` to change to become compositable.** The panel is not W6's to patch, and a panel bent to suit a Canary-flag API is how the DOM law quietly dies. Route it to the lead.
