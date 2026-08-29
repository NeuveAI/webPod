# D-068 panel browser evidence

Date: 2026-08-29

The panel Playwright suite now starts a dedicated Vite server on port 4318 with
`--strictPort` and `reuseExistingServer: false`. Before starting it hashes the
browser runtime source using the same helper as W5b, prints that identity, and
passes it into the server's `/__webpod_health` endpoint. Every screen
navigation requires a valid expected digest, current digest, and non-empty
source set. The suite does not attach to, or trust, any process already serving
the checkout. This controlled-fresh-server property is the stale-reuse proof;
the current digest remains diagnostic because other teammates legitimately
write unrelated browser sources during this shared-tree suite. Playwright
results and visual evidence are written under the operating-system temporary
directory, outside both the repository and the runtime source set.

## Focus-handler mutation

Mutation: remove `onClick={onClick}` from the panel application while retaining
the non-interactive pointer-down policy.

Command:

```text
bun run test:e2e -- --grep "panel rows focus"
```

Result: **RED**, 1 failed. The isolated run reported the same source digest in
the parent and worker (`9bbe59c4…`). The assertion failed at
`expect(panel).toBeFocused()` after clicking Albums. This proves the test ran
the mutated source and that the explicit focus handler is load-bearing.

## Native-action guard mutation

Mutation: remove the interactive-descendant guard from the panel click handler.

Command:

```text
bun run test:e2e -- --grep "Love uses"
```

Result: **RED**, 1 failed. The Love provider/state effect completed
(`aria-pressed="true"`), then `expect(love).toBeFocused()` failed. The parent
application had stolen native focus.

## Swallowed-action mutation

Mutation: remove the Love button's `onClick` provider command.

Command:

```text
bun run test:e2e -- --grep "Love uses"
```

Result: **RED**, 1 failed. After the real browser click the button remained
`aria-pressed="false"`, so the provider-backed Jotai state effect is not a
decorative assertion. The same test also requires a native `button`, authored
and rendered dimensions of at least 44 px, retained button focus, and no screen
navigation.

All three mutations were restored before the green runs and commit.

## Immutable served-source proof

The final harness copies the browser workspace into a dedicated temporary
snapshot before Playwright starts. It excludes Git metadata, dependencies,
generated output, documentation, `cert/`, `.env*`, `.claude/`, and
`design.pen`; dependencies are installed inside the snapshot with the frozen
lockfile, so workspace links resolve to snapshot packages rather than the live
shared tree. Vite runs only from that snapshot with a strict dedicated port and
no server reuse.

`fingerprintBrowserSources(snapshotRoot)` establishes the expected digest and
file count. The snapshot's own health endpoint recomputes both on every check,
and browser assertions require exact expected/current equality for both values.
Writes from foreign live lanes are therefore neither fingerprinted as served
source nor able to contaminate the run.

Plant command:

```text
PANEL_PROVENANCE_PLANT=MIDRUN bun run test:e2e -- --grep "served source identity"
```

The plant appended a marker to the snapshot's fingerprinted
`packages/panel/src/model.ts` after the first green identity check. The second
check was **RED**: expected digest `303ea8d3…`, current digest `50310905…`, with
the explicit failure “the immutable served snapshot changed during the browser
proof”. A clean full run then passed all 14 browser tests with digest
`303ea8d3…` and 151 files at both ends.
