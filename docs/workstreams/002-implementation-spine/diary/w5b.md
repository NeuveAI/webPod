# W5b diary — browser gate harness

## 2026-08-29

Read `AGENTS.md`, the W5b dispatch, the W3/W6 evidence and decisions, the
team-orchestration, modern-web-guidance, web-design-guidelines, agent-browser,
and CDP-session skills. Dependency behavior was grounded in
`/Users/vinicius/code/agentic-context`, specifically TanStack Virtual's
Playwright configuration, TanStack Router's basic Playwright configuration,
and Bun's test-writing guide.

The harness owns `apps/web/tests/**` and two browser-gate runners under
`scripts/**`. It uses the Playwright and axe installations already owned by
`packages/panel`; no package or lockfile changed. The configuration runs one
flag-off Chromium worker against the real root route and retains traces on
failure.

Implemented U1–U13 as ten named tests:

- U1 captures 3 screens × 8 states × 2 colourways = 48 PNGs.
- U2 applies `grayscale(1)` to the real page and proves the human actor,
  selected-option semantics, label, and keyboard movement survive.
- U3/U4/U5 use CDP media features and assert computed behavior, with paired
  captures.
- U6 runs axe in both colourways and measures every visible native action at
  44×44 or larger.
- U7 runs axe contrast and an independent computed-colour threshold evaluator
  for every visible text leaf in both colourways.
- U11 checks every visible text leaf at 200% across S03/S08/S13 and both
  colourways for clipping or active ellipsis.
- U12 exercises S03→S08→S13→S08, alternating and rapid arrow keys, and visible
  focus on both the application and native action.
- U13 observes the real polite live region through a 30-key detent burst and
  records exactly one non-empty announcement.

`scripts/browser-gate-mutations.ts` injects one isolated CSS, DOM, or event
mutation per automated gate. All ten filtered runs exit non-zero. The mutation
runner checks that the edit is effective by observing the failing browser
assertion, rather than treating process startup as proof.

After W3 fixes `1693761` and `e1f5dd2`, the fresh flag-off baseline is 10/10.
The review response replaced every original plant with a different mutation.
The runner now proves a clean isolated baseline first, launches every mutation
against a fresh strict-port server, verifies the edit landed in the browser,
and requires the named gate—not merely the process—to turn red.

U4 now inventories every element and pseudo-element for backdrop filters,
checks the emulated media query, bloom, shadow, opaque title-gradient stops,
and agent scrims. U7 treats axe's browser paint evaluation as authoritative
and supplements it with a conservative gradient/pseudo-element model that
fails closed on unresolved paint. U11 walks clipping ancestors. U12 uses real
Tab traversal, both colourways, the state matrix, and held-key repeat events.
U13 keeps duplicate announcement records and covers assertive errors and busy
loading state. U2's greyscale automation remains evidence, while visual actor
identification is explicitly reviewer-only. U14 and U15 remain manual.
