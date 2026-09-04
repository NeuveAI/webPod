# Quiet-host browser recheck

Date: 2026-09-04

After the implementation, PM review, and independent review were complete, the
host load fell from the earlier saturated condition. The lead reran the two
previously host-budget-limited cases together in a fresh private temporary
directory:

```text
TMPDIR=<private temp> bunx --bun playwright test \
  --config packages/panel/playwright.config.ts \
  --grep "prescribed state matrix|canonical list window sustains frame pacing"
```

Result: **2 passed in 9.6s**.

The lead then reran the complete panel browser suite in another fresh private
temporary directory:

```text
TMPDIR=<private temp> bunx --bun playwright test \
  --config packages/panel/playwright.config.ts
```

Result: **20 passed in 32.3s**. This closes the earlier screenshot-stabilization
timeout and CPU-throttled frame-budget follow-up without changing implementation.
