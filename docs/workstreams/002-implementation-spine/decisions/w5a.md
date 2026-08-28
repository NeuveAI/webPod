# W5a decisions — static correctness gate harness

## W5a-D1 · Keep the existing typechecked Bun entrypoint

The dispatch names `scripts/gates.sh`, while W0 deliberately installed and
typechecked `scripts/gates.ts` and root `package.json` already invokes it. W5a
kept the TypeScript entrypoint. This satisfies the substantive requirement that
one command runs the gates and closes the already-reviewed failure mode where
the runner itself sat outside every TypeScript project. Adding a shell wrapper
would create a second untyped orchestration surface with no additional caller.

## W5a-D2 · U8 clearances are explicit and narrow

U8 is not a blind vocabulary ban: `permission-denied` is itself one of the
required account states, and provider diagnostics truthfully describe API and
account restrictions. The harness therefore records narrow path-and-line
patterns for the current manually-cleared non-agent meanings. New copy, another
path, or changed wording is a finding. Probe scripts are outside the U8 product
surface; apps and packages remain covered.

No other zero-count grep receives a clearance. In particular, textual mentions
of `useState`, `navigator.vibrate`, and generic words containing `handed` remain
findings because their packet contracts explicitly require zero grep hits.

## W5a-D3 · Trailer scope is `origin/main..HEAD`

The owner has not yet executed the prepared history rewrite and the shared base
commit `2305f4b` still contains the historical trailer being removed. A branch
gate must judge commits added on the branch, not make every descendant
permanently red on a known base defect. The runner uses `origin/main..HEAD`, with
`HEAD^..HEAD` only for an isolated repository without `origin/main`. The
mutation test creates a second commit and proves its trailer is caught.

## W5a-D4 · Credential hygiene is checked without opening `cert/`

The credential gate uses only git metadata and synthetic ignore sentinels:

- `git ls-files` rejects tracked `cert/`, key extensions and non-example env files;
- `git check-ignore --no-index` proves the required patterns cover invented paths;
- implementation source is checked for private-key markers and relative
  `cert/` defaults.

Nothing enumerates, opens, hashes or prints the real `cert/` directory.

## W5a-D5 · Syntax-sensitive checks use the TypeScript parser

The flip gate inspects catch clauses, promise catch callbacks and named
error/failure handlers. The tier gate inspects equality and switch cases. The
tool gate inspects returned expressions rather than comments. These are AST
checks because a multiline grep would either miss the forbidden structure or
flag unrelated documentation. The literal zero-count contracts remain literal
line scans.

## W5a-D6 · The stale global-pattern skill path is evidence, not authority

`/Users/vinicius/.agents/skills/global-patterns/SKILL.md` points to the absent
`~/code/agent-context/global.md`. The corrected
`/Users/vinicius/code/agentic-context` root also has no `global.md`. W5a records
that defect and grounds Bun behavior in the exact clone files listed in the
diary instead of inferring project rules from a missing file.
