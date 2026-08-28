# W5a decisions — static correctness gate harness

## W5a-D1 · Keep the existing typechecked Bun entrypoint

W0 installed `scripts/gates.ts` and root `package.json` already invokes it. W5a
kept that TypeScript entrypoint instead of adding a second shell surface. It is
included by `scripts/tsconfig.json`.

## W5a-D2 · U8 is content-aware, with no path/line allowlist

The first version's allowlist was removed after review proved forbidden copy
could be appended to an allowed line. U8 now parses authored strings and JSX,
ignores comments and provider-layer factual diagnostics, removes only the exact
required `permission-denied` token, then checks the remainder for authorization
and approval morphology. Required state plus forbidden prose still fails.

## W5a-D3 · Trailer scope is `origin/main..HEAD`

The owner has not executed the prepared history rewrite and `2305f4b` still has
the historical trailer. The branch gate judges `origin/main..HEAD`, with
`HEAD^..HEAD` only in an isolated repository without `origin/main`.

## W5a-D4 · Credential hygiene covers tracked artifacts without disclosure

The gate obtains paths from `git ls-files`, scans every tracked working-tree
artifact (including docs/evidence and key-like paths), and checks synthetic
ignore sentinels. A tracked `cert/` path is reported from metadata without being
opened. Content findings emit only path, line and a generic label; matching text
is never echoed. Nothing enumerates, opens, hashes or prints the real `cert/`.

## W5a-D5 · Executable laws use syntax; prose laws use authored content

Provider, tool-return, flip, tier, U9 and U10 use the TypeScript parser. They
cover property/element access, destructuring, tainted return variables, catch and
rejection callbacks, JSX error handlers, equality/switch/method tier branches,
and lowercase or uppercase Canvas elements. Authored-content laws scan strings,
JSX and CSS/HTML while ignoring comments where factual documentation is legal.
No harness file is exempt.

## W5a-D6 · The stale global-pattern path is evidence, not authority

The skill points to absent `~/code/agent-context/global.md`; the corrected
`agentic-context` root has no `global.md` either. Bun behavior is grounded in the
exact clone files listed in the diary rather than recalled.

## W5a-D7 · Manual gates are not automated successes

U14 and U15 appear as manual outstanding checks. They do not increment automated
passed or failed counts and cannot represent owner/reviewer validation that did
not happen.

## W5a-D8 · Every mutation proves its precondition

Each adversarial test writes a fresh fixture, reads it back and asserts the exact
mutation exists before invoking the gate. A failed substitution cannot make
unchanged green code look like evidence that a guard held.

## W5a-D9 · Content reads require a safe regular-file boundary

Every source and credential content read now follows the same order: reject the
protected `design.pen` and `cert/` paths, inspect with `lstat`, and read only a
regular file. Symlinks, directories and special files are never opened or
followed. Git metadata can reject a tracked credential-shaped path without
reading it.

## W5a-D10 · One-step data flow is part of semantic enforcement

Provider and tier predicates compute fixed-point alias sets across declarations
and later assignments. Tool-result taint includes later assignments. Flip checks
include standard error event listeners in addition to catch, JSX and promise
rejection callbacks.

## W5a-D11 · Evidence hashes safe dirty content, not status names alone

The evidence fingerprint hashes status metadata plus content of dirty regular
files. It skips `design.pen`, `cert/` and symlinks before reads. Tests prove that
different edits at one path produce different hashes and that changing an
ignored symlink target does not affect the result.
