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

### Final-review correction

The final re-review identified six places where a green result did not support
the claim. The correction stayed within those six findings.

The isolated server now has a source identity handshake: Playwright fingerprints
137 current source inputs, passes the digest into a fresh strict-port Vite
process, and checks a recomputed health response before every test. The final
control and mutation runs both used digest
`a403b8fb702b7c30d9caed39214ebe19957cc4cc2c691cd523696e2b6c527d7a`.

U4 now covers all 48 state/screen/colourway combinations with a universal
element-and-pseudo inventory. The product gained solid title, metadata, and
divider paints under reduced transparency; the final evidence contains zero
reduced translucent paints and zero backdrop filters. U7 no longer accepts
incomplete contrast results: the dark and light tertiary tokens were corrected,
and The Fray plus the battery glyph are explicitly present in both colourway
reports with zero accepted failures.

U11 now asserts 1.25 raster scale at both 130% and 200%, in addition to airy
density and clipping. U12 exposed and fixed a real event-boundary bug: the panel
had intercepted Enter from its nested Love button. Both S13 buttons now retain
native tab, focus, Enter, and Space behavior. U13 is production-wired through a
single reference-counted announcer lease. Thirty real wheel events settle on row
31 and publish exactly one sentence naming row 31; assertive error and busy
loading checks remain.

The mutation runner retains the original ten clean→landed→selected-red plants
and adds six direct closures: `SOURCE`, `U4_SOLID`, `U7_ALL_TEXT`,
`U11_RASTER`, `U12_ACTION`, and `U13_SETTLED`. Final verification: isolated
10/10; all 16 plants red; typecheck 11/11; lint clean; 865 tests pass; build
passes; repository gates report 16 automated pass, 0 fail, with only the
pre-existing manual U14 and U15 judgments outstanding.

### Same-review U7 interpolation correction

The reviewer found one remaining hole in U7: the analytical evaluator treated
gradient stops as the complete paint set. That proves the endpoints, not the
continuous interpolation. The supplied counterexample is exact: `#767676`
over `linear-gradient(#000,#fff)` has endpoint ratios 4.623 and 4.542, yet an
interior point is the same gray and therefore 1:1.

The evaluator now carries conservative RGBA bounds instead of point colours.
Every adjacent stop pair contributes its full component-wise interpolation
box; solid paint, element opacity, and alpha compositing propagate bounds; and
contrast uses the nearest non-overlapping luminance intervals or 1:1 when they
overlap. The unplanted U7 report retains zero failures. The new
`U7_INTERPOLATION` plant lands on the visible S13 mode chip, prints both passing
endpoint ratios, produces a 1:1 lower bound in both colourways, and turns the
selected U7 test red. The complete mutation run is now clean 10/10 control plus
17/17 landed→selected-red plants. Repository gates pass with 867 tests and
5,500 assertions.
