# Review: `f1ec1f7` — final owner handoff reconciliation

## Verdict: REQUEST_CHANGES

Two Major findings block approval. The implementation/status reconciliation is
otherwise supported by current committed state.

## Review setup

- Reviewed only `f1ec1f7` and its two changed files: `handoff.md` and
  `tracker.md`.
- Read `AGENTS.md`, the complete 002 scope, HITL register, decision log,
  dependency graph, review lanes, preview validation, W0 rewrite plan, and S2
  rewrite amendment.
- Loaded `strict-critique`, `workstream-scoping`, `team-orchestration`, and
  `global-patterns`, including the orchestration review protocol. There is no
  Neuve board or shell by binding repo law, so the workstream tracker is the
  process source of truth.
- Consulted `/Users/vinicius/code/agentic-context/bun` for the script-runner
  assumptions. Git rewrite behavior was checked against the official
  `git-filter-repo` program and manual because `agentic-context` has no Git
  implementation clone.
- Did not inspect `design.pen` or anything under `cert/`.

## Independent verification

- A pristine local clone of current committed `HEAD` (`f1ec1f7`) passed:
  11/11 TypeScript projects, lint, 939 tests, 16/16 automated gates, and both
  client and SSR builds. U14 and U15 remained explicitly manual.
- The historical assertions reproduce: `2305f4b` is the first relevant path
  commit and the only commit with a banned trailer; `55b34dd` contains exactly
  the four stated S2 paths plus S1 and W2 paths; `origin/main` is `2305f4b`;
  current `HEAD` is 203 commits ahead; `AGENTS.md` is tracked; the local
  `CLAUDE.md -> AGENTS.md` symlink is ignored; `.claude/` is ignored.
- The S2 split was replayed in a disposable clone. Its 198-step rebase
  completed without conflict, produced the expected two additional commit
  boundaries (209 commits from the original 207), and left the final tree
  identical to `f1ec1f7`.
- The W0 callback-file syntax was tested with the official current
  `git-filter-repo`; it is valid and stripped the planted trailer. This was
  attacked rather than assumed.
- Existing final review verdicts and the W4/W7/canonical-evidence review commits
  support the tracker status changes. U15 has direct structural inspection in
  the W5b/provider evidence; U14 and H-6 remain correctly uncleared.

## Findings

- **[MAJOR] The reconciled sequence is still not an exact, single-source
  procedure and can silently start W0 from the pre-S2 history**
  (`handoff.md:127-150`). The handoff says to use the verified S2-rewritten
  clone as W0's source and not the original repository, but the W0 document it
  tells the owner to execute still hard-codes `cd ~/code/webPod`, records
  `BEFORE_TIP` there, and runs `git clone webPod webPod-rewrite`. The S2 document
  likewise retains the unresolved target
  `git switch <branch-containing-55b34dd>`. No replacement commands bind (a)
  the exact S2 output branch, (b) the W0 clone source, (c) `BEFORE_TIP`, and (d)
  the eventual `main` publication target to the same object. An owner can follow
  both referenced documents literally and successfully rewrite the original
  pre-S2 history, losing the required S2 boundary split while every W0-local
  invariant remains green. For an owner-only destructive workflow, prose that
  asks the operator to reinterpret hard-coded commands is the ambiguity the
  handoff exists to eliminate. Supply one copy/pasteable reconciled command
  sequence with explicit, validated source and target paths/refs, including an
  equality check that the W0 source `HEAD` is the verified S2 output tip.

- **[MAJOR] The only prescribed publication command cannot satisfy its own
  force-with-lease safety check** (`handoff.md:150-152`). The handoff delegates
  publication exclusively to W0 section 6. Pass 1/2 causes
  `git-filter-repo` to remove `origin` and its remote-tracking refs; section 6
  then runs `git remote add origin ...` followed immediately by
  `git push --force-with-lease origin main`, without fetching the newly added
  remote or supplying an explicit expected old OID. I reproduced this with the
  official `git-filter-repo`: after a real hash rewrite, the exact sequence is
  rejected with `stale info`. The earlier `git fetch origin` is executed in the
  original repository, not the rewritten clone, and cannot establish the
  rewritten clone's lease. This fails safely, but it makes the owner handoff
  non-executable and invites an unsafe improvisation to `--force`. Re-add the
  remote, fetch it in the rewritten clone, verify the fetched `origin/main`
  equals the recorded pre-rewrite remote OID, and use an explicit
  `--force-with-lease=refs/heads/main:<expected-oid>` before presenting the
  publication step as prepared.

## Non-findings

- The handoff never authorizes an agent to rewrite, filter, publish, or
  force-push. It stops at owner actions and preserves the standing law.
- The rewrite scope includes all three requested history changes: remove
  `.claude/`, strip banned attribution trailers, and make the historical
  `CLAUDE.md` to `AGENTS.md` rename. The ignored local symlink is accounted for.
- Backup and failure recovery are directionally sound: the original repository
  remains untouched, S2 creates branch and tag refs, and failed W0 clones are
  discarded. The blockers are source/target binding and publication lease
  correctness, not absence of recovery intent.
- The pristine-clone gate table and the tracker completion statuses are current
  and reproducible at `f1ec1f7`.

The review is intentionally left uncommitted because the verdict is
`REQUEST_CHANGES`.

---

# Re-review — fix commit `a3ac939`

## Verdict: REQUEST_CHANGES

The two original Majors are fixed: W0 is now bound to the verified S2 output,
and the explicit expected-OID lease is both executable and stale-safe. Two new
Majors surfaced when replaying the complete procedure rather than stopping at
its history assertions.

## Replay results

- Replayed the documented S2 split from committed `a3ac939` in a disposable
  clone. The rebase stopped only at `55b34dd`, replayed 201 steps, produced 212
  commits from the 210-commit source, preserved the source tree, and created
  exactly the state → S1 → S2 parent chain.
- Cloned W0 only from that S2 clone. Exact tip, tree, count, split-object,
  ancestry, and parent-order guards passed on the correct input.
- Planted wrong pre-S2 tip, wrong tree, wrong count, dangling split ancestry,
  and wrong split-parent inputs. Every corresponding guard exited nonzero before
  filtering.
- Replayed both official `git-filter-repo` passes. Final history had 212
  commits, no `.claude/`, no historical `CLAUDE.md`, no banned trailer, the
  same final tree and `design.pen` blob, and `AGENTS.md` at the rename commit and
  every descendant. The ignored `CLAUDE.md -> AGENTS.md` working-tree symlink
  was restored without dirtying Git.
- Re-added and fetched a disposable bare `origin`. The exact explicit-lease
  push succeeded with `--dry-run` while remote `main` matched the captured OID.
  After advancing the remote, both the live-OID preflight and the unchanged
  explicit lease rejected publication; the latter exited 1 with `stale info`.
- No authoritative repository, branch, or remote was rewritten or pushed.

## Findings

- **[MAJOR] The rewrite invalidates W7's immutable evidence identity, so the
  required post-rewrite test and gate suite is red**
  (`evidence/w0-history-rewrite-plan.md:257-260`,
  `evidence/w7-browser.json:2`,
  `scripts/w7-browser-evidence-schema.test.ts:79-86`). W7 evidence declares
  pre-rewrite commit `d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa` and the tests
  intentionally require that exact commit to resolve. The W0 rewrite changes
  every commit from `2305f4b` onward and removes the old object from the
  rewritten clone. In the exact replay, `bun test` produced **936 pass / 5
  fail**: all five failures came from `git rev-parse --verify d66c66b…^{commit}`.
  `bun run gates` therefore cannot reach the promised green completion state.
  This is not an incidental test fixture: immutable source identity was the
  independently approved W7 correctness boundary. The rewrite plan needs an
  explicit, deterministic migration of W7's reviewed commit to its rewritten
  counterpart, preserving and re-verifying the same reviewed tree and source
  fingerprint, with the resulting final-tree/count consequences incorporated
  into every invariant and reviewed independently. A fresh post-publication
  clone must pass without retaining old-history backup refs.

- **[MAJOR] The exact owner procedure invokes a package script that does not
  exist** (`evidence/w0-history-rewrite-plan.md:261-262`). Root `package.json`
  defines `build` but no `build:ssr`; `bun run build` already performs both the
  client and SSR builds. The replay reached the command and exited 1 with
  `Script not found "build:ssr"`. Because this block is a mandatory pre-publication
  invariant, the copy/pasteable sequence cannot complete even after the W7
  provenance failure is repaired. Remove the nonexistent command or add a real
  script through the normal independently reviewed implementation history; do
  not leave an owner to infer which mandatory check is accidental.

## Evidence-integrity note

`handoff.md:154-158` says the “full chain” was executed, while
`evidence/final-history-rewrite-dry-run.md` records history and lease outcomes
but omits the required type/lint/test/gate/build block entirely. The omitted
block is precisely where both failures above occur. The corrected dry-run
artifact must report every prescribed command and its result rather than using
“full chain” for a partial execution.

## Authority check

The updated documents remain compliant with `AGENTS.md`: they authorize agents
only to validate disposable clones, reserve the authoritative rewrite and final
force-with-lease command to the owner, and contain no command that grants an
agent publication authority.

This re-review remains uncommitted because the verdict is `REQUEST_CHANGES`.

---

# Final re-review — through `8e8dcd4`

## Verdict: APPROVE

No Critical, Major, or Minor findings remain. I replayed the complete documented
S2 → W0 → W7 evidence-rebind sequence from the requested committed boundary,
not from the two later review-only commits currently above it.

## Independent replay

- Pinned the disposable source branch to
  `8e8dcd4905f03372a004986d6d01d5d3a7f451e0`: tree
  `de49800b406b2174a9492dd85da89f0543a4de9b`, count 213.
- Replayed the S2 split at `55b34dd`. The result was
  `8f542b4747b41009e9ed944c8310efaeb4682afd`, the same source tree, count
  215, with exactly one state, S1, and S2 split commit in the required parent
  order.
- Created W0 only from that verified S2 clone. Exact tip/tree/count and all
  three split-object ancestry checks passed. Independently substituted a wrong
  tip, tree, count, and non-ancestor split object; every corresponding predicate
  exited 1 before filtering.
- Ran both official `git-filter-repo` passes. Rewritten `main` retained the S2
  tree and count, contained `AGENTS.md`, and had no reachable `.claude/`,
  historical `CLAUDE.md`, or banned attribution trailer. The ignored local
  `CLAUDE.md -> AGENTS.md` symlink restored cleanly. Fetching the disposable
  pre-rewrite remote later necessarily made its old objects visible under
  `origin/main`; that is remote state being lease-checked, not part of the
  rewritten publication branch.
- Located the W7 source by the plan's tree-and-subject conjunction as
  `ebf82dff88681f630b32daf28a98fdb5416a6f46`, with the required unchanged
  tree `7d93de5f0b960adf1ecd3bba72114444bac63ad3`. The old commit no longer
  resolved.
- Ran the existing producer, `scripts/w7-browser-evidence.ts`, with
  `W7_SOURCE_COMMIT` bound to that rewritten commit. Its output carried the
  expected source digest
  `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`
  and 151 files. The existing schema suite passed 9/9 and directly rejected
  missing/malformed identity plus well-formed wrong commit, tree, digest, and
  file-count mutations.
- The evidence-only commit was
  `c02dd2245a127cf94783c39fc206c506f4aad42b`, tree
  `c57edecc26286fc53799b10811c316f8c3a201e2`, count 216. It is the sole
  child of the rewrite base and changes exactly `w7-browser.json` and
  `w7-browser-provenance.md`; application, package, build, and producer source
  are unchanged.

## Final gates and publication boundary

The final disposable history passed 11/11 TypeScript projects, repo lint, 941
tests / 0 failures, all 16 automated gates / 0 failures, and `bun run build`
for both client (213 modules) and SSR (376 modules). U14 and U15 remain reported
as manual rather than being miscounted as automated passes.

Against a disposable bare remote at captured OID `2305f4b`, the explicit
expected-OID lease succeeded under `--dry-run`. After advancing that remote to
`8e8dcd4`, the unchanged lease exited 1 with `stale info`; the preceding OID
equality check also rejected the changed state. No non-dry-run push occurred.

## Artifact and authority check

`final-history-rewrite-dry-run.md` contains the complete successful command
chain, including the authoritative producer, 9-test mutation suite,
evidence-only commit accounting, final gates/build, matching lease dry-run, and
stale-lease rejection. Its recorded fixture starts at `c4df144` and therefore
has counts 211 → 213 → 214; it labels those exact inputs and does not claim they
are `8e8dcd4`. The fresh replay above supplies the requested later-boundary
confirmation at 213 → 215 → 216. I found no omitted phase or unsupported
completion claim.

The handoff stops before the authoritative push and marks that command owner
only. No document delegates history rewriting or publication to an agent, and
this review executed neither action against the authoritative repository or
remote.

---

# Narrow re-review — `90f0581`

## Verdict: APPROVE

No findings. The commit changes only `handoff.md` and `tracker.md`, and the
reconciled claims are accurate:

- A pristine clone pinned to `90f0581` passed 941 tests / 0 failures and all 16
  automated gates / 0 failures. The harness still reports U14 and U15 as manual;
  the documents correctly distinguish that static label from U15's completed
  reviewer judgment.
- The U15 implementation review at `c4df144` and both-colourway re-review at
  `852270e` are both APPROVE. Together they record zero remaining accessibility
  findings, including the permanent light/dark Axe coverage.
- Required owner work is stated consistently as U14/H-5, H-6, and execution of
  H-1. H-10 remains explicitly optional and is not presented as an MVP blocker.
- `w0-history-rewrite-plan.md`, `s2-history-rewrite-amendment.md`, and
  `final-history-rewrite-dry-run.md` have byte-identical Git blobs before and
  after `90f0581`. The commit does not alter the approved procedure or evidence.
- Later documentation commits do not invalidate rewrite arithmetic: source tip,
  tree, and count are captured dynamically; S2 remains `source + 2`; the W7
  evidence commit remains `S2 + 1`. The dry-run's 211 → 213 → 214 values remain
  correctly scoped to its named `c4df144` fixture rather than asserted as the
  future authoritative result.

No implementation or history operation was executed for this review.
