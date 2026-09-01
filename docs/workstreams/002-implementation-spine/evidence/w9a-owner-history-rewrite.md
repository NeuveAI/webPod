# W9a owner-only local history repair

## Status

**OWNER ACTION REQUIRED. Do not ask an agent to execute this plan.**

No history rewrite or force-push was executed while preparing this document.
The current source is type-correct, but that cannot change the immutable
historical object `2ec0861`.

## Reproduced defect

Archive typecheck of the original core commit:

```text
2ec08618a69bf3ce8cf94d23810ced6e8e832a63
packages/device/src/index.ts(80,3): TS2305 wheelContactFromRay
packages/device/src/index.ts(81,3): TS2305 clampWheelContactToRing
packages/device/src/index.ts(86,8): TS2724 ClickWheelSelectEnd
packages/device/src/index.ts(87,8): TS2305 ClickWheelSelectStart
packages/device/src/index.ts(88,8): TS2305 WheelContactSample
exit 2
```

An equivalent archive of corrective commit
`0591daf35a85bf818e46e7b803ab35605e8252ca` exits 0. The five exports belong
with `890b4f3`, where the symbols are introduced. An additive commit cannot
make the old core commit standalone-green.

## Before map

```text
base       7556a5ffa08bb858e7b67ab4e1bd9ce0049b8e80
core       2ec08618a69bf3ce8cf94d23810ced6e8e832a63
input      890b4f390b1adde54555430edb20a85368f30731
w9a docs   52cd65a567eb9a014ec2fa6c6846523585cbcaf2
correction 0591daf35a85bf818e46e7b803ab35605e8252ca
```

Record the branch tip immediately before acting; descendants after `2ec0861`,
including interleaved W9b commits, will all receive new identities.

## Owner procedure

Start only from a clean worktree and empty index. Replace `main` if the owner is
repairing another local branch. Keep every command in the same shell so the
before/after variables survive each interactive stop.

```sh
OLD_BASE=7556a5ffa08bb858e7b67ab4e1bd9ce0049b8e80
OLD_CORE=2ec08618a69bf3ce8cf94d23810ced6e8e832a63
OLD_INPUT=890b4f390b1adde54555430edb20a85368f30731
OLD_CORRECTION=0591daf35a85bf818e46e7b803ab35605e8252ca
OLD_HEAD=$(git rev-parse main)

test -z "$(git status --porcelain)"
test "$(git rev-parse "$OLD_CORE^")" = "$OLD_BASE"
test "$(git rev-parse "$OLD_INPUT^")" = "$OLD_CORE"
git branch "backup/w9a-before-history-repair-$OLD_HEAD" "$OLD_HEAD"

GIT_SEQUENCE_EDITOR="sed -i '' -e 's/^pick 2ec0861 /edit 2ec0861 /' -e 's/^pick 890b4f3 /edit 890b4f3 /'" \
  git rebase -i --rebase-merges --committer-date-is-author-date "$OLD_BASE"
```

At the `2ec0861` stop, remove only the premature exports:

```diff
 export {
   wheelAngleFromRay,
-  wheelContactFromRay,
-  clampWheelContactToRing,
   type ClickWheelArcEnd,
   type ClickWheelArcSample,
   type ClickWheelInputSurfaceProps,
   type ClickWheelPointerType,
-  type ClickWheelSelectEnd,
-  type ClickWheelSelectStart,
-  type WheelContactSample,
 } from "./click-wheel-input";
```

Then amend and continue:

```sh
git add -- packages/device/src/index.ts
GIT_COMMITTER_NAME='Vinicius Dallacqua' \
GIT_COMMITTER_EMAIL='vinicius.dallacqua@mpyadigital.com' \
GIT_COMMITTER_DATE='2026-09-01T21:11:56+02:00' \
  git commit --amend --no-edit --date='2026-09-01T21:11:56+02:00'
NEW_CORE=$(git rev-parse HEAD)
test "$NEW_CORE" != "$OLD_CORE"
git rebase --continue
```

At the `890b4f3` stop, add those exact five exports to the same two export
blocks, then amend and continue:

```sh
git add -- packages/device/src/index.ts
GIT_COMMITTER_NAME='Vinicius Dallacqua' \
GIT_COMMITTER_EMAIL='vinicius.dallacqua@mpyadigital.com' \
GIT_COMMITTER_DATE='2026-09-01T21:12:03+02:00' \
  git commit --amend --no-edit --date='2026-09-01T21:12:03+02:00'
NEW_INPUT=$(git rev-parse HEAD)
test "$NEW_INPUT" != "$OLD_INPUT"
test "$(git rev-parse "$NEW_INPUT^")" = "$NEW_CORE"
git rebase --continue
```

After replay finishes:

```sh
NEW_HEAD=$(git rev-parse main)
NEW_CORRECTION=$(git log --format=%H --grep='^fix(device): make control release demand-safe$' -1)

test "$NEW_HEAD" != "$OLD_HEAD"
test "$NEW_CORRECTION" != "$OLD_CORRECTION"
test "$(git merge-base "$OLD_BASE" "$NEW_HEAD")" = "$OLD_BASE"
test "$(git rev-list --count "$OLD_BASE..$NEW_HEAD")" = "$(git rev-list --count "$OLD_BASE..$OLD_HEAD")"
git range-diff "$OLD_BASE..$OLD_HEAD" "$OLD_BASE..$NEW_HEAD"

printf 'core %s -> %s\ninput %s -> %s\ncorrection %s -> %s\nhead %s -> %s\n' \
  "$OLD_CORE" "$NEW_CORE" "$OLD_INPUT" "$NEW_INPUT" \
  "$OLD_CORRECTION" "$NEW_CORRECTION" "$OLD_HEAD" "$NEW_HEAD"
```

The literal after-hashes cannot be known honestly before the owner performs
the replay: every descendant commit incorporates its new parent, and commit
identity includes committer metadata. The commands above print the exact
before/after map and assert the expected parent graph. Do not substitute
invented hashes in advance.

## Standalone verification

Verify at least the rewritten core, input, correction and final tip from
isolated archives. The package-local dependency installation must be made
available; a top-level `node_modules` symlink alone is insufficient here.

```sh
for REV in "$NEW_CORE" "$NEW_INPUT" "$NEW_CORRECTION" "$NEW_HEAD"; do
  SCRATCH=$(mktemp -d)
  git archive "$REV" | tar -x -C "$SCRATCH"
  ln -s /Users/vinicius/code/webPod/node_modules "$SCRATCH/node_modules"
  mkdir -p "$SCRATCH/packages/device"
  ln -s /Users/vinicius/code/webPod/packages/device/node_modules "$SCRATCH/packages/device/node_modules"
  (cd "$SCRATCH" && bunx --bun tsc --pretty false --noEmit -p packages/device/tsconfig.json)
  rm -rf "$SCRATCH"
done

bun run typecheck
bun run lint
bun test
bun run build
bun run gates
```

Inspect `git range-diff` before publishing. The intended semantic difference is
only that the five index exports move from the core commit to the input commit;
all later corrective source/evidence must survive unchanged.

## Publication consequence

A pushed branch requires owner coordination because every descendant hash
changes. Collaborators must save work, fetch, and reset/rebase onto the new tip.
Only the owner may publish with force:

```sh
git push --force-with-lease=main:$OLD_HEAD origin main
```

If any precondition, standalone archive, range-diff or full gate fails, abort
publication and restore the backup branch. An agent must not run the force-push.
