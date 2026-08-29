# S2 history-boundary amendment — owner-only preparation

S2 first entered the branch in `55b34dd` (`feat(state): screen state machine`).
That commit also contains S1 revisions and W2 state behavior, so S2 cannot be
reviewed or replayed as a coherent historical unit. This document prepares a
repair; it does **not** authorize an agent to rewrite or force-push history.

## Current and desired boundaries

- Current mixed commit: `55b34dd`.
- S2 paths to split into their own commit:
  - `scripts/spikes/mint-apple-dev-token.ts`
  - `scripts/spikes/probe-apple.ts`
  - `docs/workstreams/002-implementation-spine/decisions/s2.md`
  - `docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md`
- Desired historical title: `spike(apple): probe catalog capabilities read-only`.
- The present correction commit, including the test and this amendment, should
  remain a later independent commit.

Splitting `55b34dd` rewrites that commit and every descendant. Existing commit
IDs, review references, and any open work based on them will change. A pushed
branch requires an owner-operated force push and coordination with every clone.

## Owner procedure and authoritative composition

The complete copy/pasteable procedure now lives in
`evidence/w0-history-rewrite-plan.md` §§1–3. It fixes the source branch to local
`main`, fixes both disposable paths, records the original tip/tree/count and
remote-main OID outside the clones, and binds the W0 input to the verified S2
output tip. **Use that procedure; do not run this amendment as a standalone
alternative.** In particular, never substitute the original repository or
remote for the S2 clone when creating W0's clone.

The commands below document the split itself. They are retained as the review
source for its exact path boundaries, but the W0 plan supplies their concrete
repository path and surrounding state-transfer checks.

## Split operation inside the S2 clone

Run only after all live teammates have stopped and the working tree is clean.
The backup refs make the operation locally recoverable.

```sh
test "$(git branch --show-current)" = main
git merge-base --is-ancestor 55b34dd HEAD
git status --short                         # must print nothing
git branch backup/s2-before-split HEAD
git tag backup-s2-before-split-$(date +%Y%m%d-%H%M%S) HEAD
git rebase -i --rebase-merges 55b34dd^
```

In the todo list, change `pick 55b34dd feat(state): screen state machine` to
`edit 55b34dd feat(state): screen state machine`. When rebase stops:

```sh
git reset HEAD^
git add -- packages/state/src/contract.ts packages/state/src/index.ts \
  packages/state/src/menu.ts packages/state/src/screen.test.ts \
  packages/state/src/screen.ts packages/state/src/store.test.ts \
  packages/state/src/store.ts
git commit -m "feat(state): screen state machine"

git add -- docs/workstreams/002-implementation-spine/decisions/s1.md \
  docs/workstreams/002-implementation-spine/evidence/apple-capability-spike.md
git commit -m "docs(apple): revise capability evidence"

git add -- scripts/spikes/mint-apple-dev-token.ts \
  scripts/spikes/probe-apple.ts \
  docs/workstreams/002-implementation-spine/decisions/s2.md \
  docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md
git commit -m "spike(apple): probe catalog capabilities read-only"
git rebase --continue
```

The exact path sets above are derived from `git show --name-only 55b34dd`.
Before publishing, the owner must compare the rewritten tree with the backup and
verify that only commit boundaries changed:

```sh
git diff --exit-code backup/s2-before-split^{tree} HEAD^{tree}
git log --format='%H%n%B%n---' backup/s2-before-split..HEAD
bun run typecheck
bun test
bun run lint
bun run gates
```

If any check fails, abort before publishing and return to the backup branch.
Publication remains owner-only under `AGENTS.md`. The W0 plan §8 is the only
publication preparation: it reconstructs the remote removed by
`git-filter-repo`, fetches exact `origin/main`, compares it with the pre-rewrite
record, and prepares an explicit expected-OID lease before stopping.
