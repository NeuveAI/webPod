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

The final baseline is intentionally red on two product failures. Per the W5b
guardrail, no `src` file was changed:

1. U3: the light success-confirmation animation remains
   `wp-success-light` under `prefers-reduced-motion: reduce`; the dark
   colourway correctly resolves to `none`.
2. U7: light-panel secondary title text (`The Fray`) and its battery glyph
   measure 4.3851:1 where U7 requires 4.5:1.

The other eight browser gates pass. U14 and U15 are printed as manual
outstanding on every complete runner invocation; neither is claimed clear.
