# Dispatch packet — W8 · Volumetric device and orientation seam

**Status:** Guarded and ready for geometry/orientation implementation.

Mandatory first read:

- `scope-volumetric-device.md`
- `dispatch/W4-device-layer.md`
- `dispatch/W6-composite.md`
- `reviews/visual-repair-review.md`
- `AGENTS.md`
- Pencil MCP components VWaJS and zbTc3
- installed Three/R3F under `/Users/vinicius/code/agentic-context/`

Load and follow: `modern-web-guidance` first for client work,
`interface-craft`, `interface-design-guardrails`, `web-design-guidelines`,
`global-patterns`, `vercel-react-best-practices`, and `runtime-review` where the
render loop or resource lifecycle changes.

Implement the three scoped slices without treating screenshots as geometry.
The main path remains real DOM in canvas. Preserve demand rendering and expose a
single typed orientation root. Sensor permission UX remains deferred; pointer
and keyboard pose validation are in scope. Write the exact diary, decisions,
evidence, and review artifacts named by the scope. Run package and app
typechecks, lint, tests, browser DPR/pose matrix, production builds, and the full
gate suite. Use focused, trailer-free commits and leave unrelated token/history
artifacts untouched.

An independent antagonistic reviewer must approve the implementation before the
owner is asked for visual acceptance.
