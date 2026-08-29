# D-068 panel browser evidence

Date: 2026-08-29

The panel Playwright suite now starts a dedicated Vite server on port 4318 with
`--strictPort` and `reuseExistingServer: false`. Before starting it hashes the
browser runtime source using the same helper as W5b. Every screen navigation
checks `/__webpod_health` and requires the server's expected digest, current
digest, and file count to match the Playwright worker. Playwright results and
visual evidence are written under the operating-system temporary directory,
outside both the repository and the runtime source set.

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
