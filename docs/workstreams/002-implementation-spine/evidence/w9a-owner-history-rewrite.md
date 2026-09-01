# W9a owner-only local history repair

## Status and authority boundary

**OWNER ACTION REQUIRED. No agent may execute this rewrite or its publication.**

No history rewrite, ref replacement or force-push was executed while preparing
this document. Current source is type-correct, but that cannot change immutable
commit `2ec0861`.

The original defect reproduces in an isolated archive:

```text
2ec08618a69bf3ce8cf94d23810ced6e8e832a63
packages/device/src/index.ts(80,3): TS2305 wheelContactFromRay
packages/device/src/index.ts(81,3): TS2305 clampWheelContactToRing
packages/device/src/index.ts(86,8): TS2724 ClickWheelSelectEnd
packages/device/src/index.ts(87,8): TS2305 ClickWheelSelectStart
packages/device/src/index.ts(88,8): TS2305 WheelContactSample
exit 2
```

Those five exports belong in `890b4f3`, where their definitions first exist.
An additive commit cannot make the old core commit standalone-green.

## Exact before state

```text
repository   /Users/vinicius/code/webPod
target       main
base         7556a5ffa08bb858e7b67ab4e1bd9ce0049b8e80
core         2ec08618a69bf3ce8cf94d23810ced6e8e832a63
input        890b4f390b1adde54555430edb20a85368f30731
w9a docs     52cd65a567eb9a014ec2fa6c6846523585cbcaf2
correction   0591daf35a85bf818e46e7b803ab35605e8252ca
```

The owner must set `TARGET_BRANCH` deliberately if repairing a branch other
than `main`. The script switches to and asserts that branch before recording
`OLD_HEAD`. It refuses a dirty tree, an existing Git operation, a missing
commit, an unexpected parent/subject, a stale state file or an existing backup
ref before it creates the backup or begins detached commit construction.

The publication policy is intentionally one-way: the fetched remote tip must
equal local `OLD_HEAD` or be an ancestor of it. A local branch may contain
unpublished descendants, but a remote-ahead or divergent branch aborts before
any rewrite. The owner must first integrate every remote-only commit normally;
the history repair must never be used to discard it.

## Phase 1 — owner rewrite and verification

Run this entire block in zsh from one terminal. It is fail-fast. Its traps print
recovery commands but intentionally do not move refs automatically.

```zsh
set -euo pipefail

readonly REPO_ROOT='/Users/vinicius/code/webPod'
readonly TARGET_BRANCH='main'
readonly REMOTE='origin'
readonly OLD_BASE='7556a5ffa08bb858e7b67ab4e1bd9ce0049b8e80'
readonly OLD_CORE='2ec08618a69bf3ce8cf94d23810ced6e8e832a63'
readonly OLD_INPUT='890b4f390b1adde54555430edb20a85368f30731'
readonly OLD_CORRECTION='0591daf35a85bf818e46e7b803ab35605e8252ca'

VERIFY_ROOT=''
BACKUP_BRANCH=''

fail() {
  print -u2 -- "ERROR: $*"
  return 1
}

cleanup_verify() {
  if [[ -n "${VERIFY_ROOT:-}" && -d "$VERIFY_ROOT" ]]; then
    local verify_parent="${TMPDIR:-/tmp}"
    verify_parent="${verify_parent%/}"
    if [[ "$VERIFY_ROOT" == "$verify_parent"/webpod-w9a-verify.* ]]; then
      command rm -rf -- "$VERIFY_ROOT"
    else
      print -u2 -- "Refusing unexpected cleanup path: $VERIFY_ROOT"
    fi
  fi
}

operation_in_progress() {
  [[ -d "$(git rev-parse --git-path rebase-merge)" ||
     -d "$(git rev-parse --git-path rebase-apply)" ||
     -f "$(git rev-parse --git-path CHERRY_PICK_HEAD)" ||
     -f "$(git rev-parse --git-path MERGE_HEAD)" ||
     -f "$(git rev-parse --git-path REVERT_HEAD)" ]]
}

on_failure() {
  local status="$1"
  set +e
  trap - ZERR INT TERM EXIT
  cleanup_verify
  print -u2 -- ''
  print -u2 -- "W9a history repair stopped with status $status."
  print -u2 -- "No publication command has run. Inspect 'git status' first."
  print -u2 -- "If a rebase is active:      git rebase --abort"
  print -u2 -- "If a cherry-pick is active: git cherry-pick --abort"
  print -u2 -- "If detached with staged changes: use the path-bounded recovery section"
  print -u2 -- "Target branch: ${TARGET_BRANCH:-unset}"
  print -u2 -- "Backup branch: ${BACKUP_BRANCH:-not-created}"
  print -u2 -- "See the Recovery section before moving any ref."
  exit "$status"
}

trap 'on_failure $?' ZERR
trap 'on_failure 130' INT
trap 'on_failure 143' TERM

cd "$REPO_ROOT"
[[ "$(git rev-parse --show-toplevel)" == "$REPO_ROOT" ]] ||
  fail "not at the asserted repository root"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "worktree/index must be completely clean before branch checkout"
if operation_in_progress; then
  fail "another Git operation is already in progress"
fi

git switch "$TARGET_BRANCH"
[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] ||
  fail "checked-out branch is not $TARGET_BRANCH"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "target branch is not clean"

OLD_HEAD="$(git rev-parse "$TARGET_BRANCH")" ||
  fail "could not resolve target branch head"
[[ "$OLD_HEAD" =~ '^[0-9a-f]{40}$' ]] || fail "OLD_HEAD is not a commit hash"
readonly OLD_HEAD
OLD_COUNT="$(git rev-list --count "$OLD_BASE..$OLD_HEAD")" ||
  fail "could not count the original range"
[[ "$OLD_COUNT" =~ '^[0-9]+$' ]] || fail "OLD_COUNT is not numeric"
readonly OLD_COUNT
STATE_FILE="$(git rev-parse --git-path w9a-history-repair.state)" ||
  fail "could not resolve repair state path"
[[ -n "$STATE_FILE" ]] || fail "repair state path is empty"
readonly STATE_FILE
BACKUP_BRANCH="backup/w9a-before-history-repair-$OLD_HEAD"
readonly BACKUP_BRANCH

[[ ! -e "$STATE_FILE" ]] ||
  fail "stale repair state exists at $STATE_FILE"
if git show-ref --verify --quiet "refs/heads/$BACKUP_BRANCH"; then
  fail "backup branch already exists: $BACKUP_BRANCH"
fi

git cat-file -e "$OLD_BASE^{commit}"
git cat-file -e "$OLD_CORE^{commit}"
git cat-file -e "$OLD_INPUT^{commit}"
git cat-file -e "$OLD_CORRECTION^{commit}"
[[ "$(git rev-parse "$OLD_CORE^")" == "$OLD_BASE" ]] ||
  fail "core parent is not the expected base"
[[ "$(git rev-parse "$OLD_INPUT^")" == "$OLD_CORE" ]] ||
  fail "input parent is not the expected core"
[[ "$(git show -s --format=%s "$OLD_CORE")" ==
   'feat(device): model transient control travel' ]] ||
  fail "core subject changed"
[[ "$(git show -s --format=%s "$OLD_INPUT")" ==
   'feat(device): drive wheel travel from live contact' ]] ||
  fail "input subject changed"
git merge-base --is-ancestor "$OLD_BASE" "$OLD_HEAD"
git merge-base --is-ancestor "$OLD_CORE" "$OLD_HEAD"
git merge-base --is-ancestor "$OLD_INPUT" "$OLD_HEAD"
git merge-base --is-ancestor "$OLD_CORRECTION" "$OLD_HEAD"

# Fetch exactly the target ref so the captured remote object is available for
# ancestry inspection. FETCH_HEAD is the lease snapshot used in Phase 2.
git fetch --no-tags "$REMOTE" "refs/heads/$TARGET_BRANCH"
REMOTE_LINE="$(git ls-remote --exit-code --heads "$REMOTE" "$TARGET_BRANCH")" ||
  fail "could not read remote target"
[[ "$(print -r -- "$REMOTE_LINE" | wc -l | tr -d ' ')" == '1' ]] ||
  fail "remote target did not resolve to exactly one ref"
EXPECTED_REMOTE_HEAD="${REMOTE_LINE%%[[:space:]]*}"
[[ "$EXPECTED_REMOTE_HEAD" =~ '^[0-9a-f]{40}$' ]] ||
  fail "remote lease value is not a commit hash"
[[ "$(git rev-parse FETCH_HEAD)" == "$EXPECTED_REMOTE_HEAD" ]] ||
  fail "fetched target and captured remote lease disagree"
git cat-file -e "$EXPECTED_REMOTE_HEAD^{commit}"

if [[ "$EXPECTED_REMOTE_HEAD" != "$OLD_HEAD" ]]; then
  git merge-base --is-ancestor "$EXPECTED_REMOTE_HEAD" "$OLD_HEAD" ||
    fail "remote is ahead or divergent; integrate remote-only history before repair"
fi
readonly EXPECTED_REMOTE_HEAD

# Every precondition is now complete. Only now create a recovery ref.
git branch "$BACKUP_BRANCH" "$OLD_HEAD"
[[ "$(git rev-parse "$BACKUP_BRANCH")" == "$OLD_HEAD" ]] ||
  fail "backup branch does not point to OLD_HEAD"

# Construct the corrected core detached, leaving TARGET_BRANCH untouched.
git switch --detach "$OLD_CORE"
git apply --index <<'PATCH_REMOVE_PREMATURE_EXPORTS'
diff --git a/packages/device/src/index.ts b/packages/device/src/index.ts
--- a/packages/device/src/index.ts
+++ b/packages/device/src/index.ts
@@ -77,13 +77,8 @@ export {
   clockwiseWheelAngleDeg,
   shortestWheelDeltaDeg,
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
PATCH_REMOVE_PREMATURE_EXPORTS

[[ "$(git diff --cached --name-only)" == 'packages/device/src/index.ts' ]] ||
  fail "core amendment touches more than the index"
git diff --cached --check
GIT_COMMITTER_NAME='Vinicius Dallacqua' \
GIT_COMMITTER_EMAIL='vinicius.dallacqua@mpyadigital.com' \
GIT_COMMITTER_DATE='2026-09-01T21:11:56+02:00' \
  git commit --amend --no-edit --date='2026-09-01T21:11:56+02:00'
NEW_CORE="$(git rev-parse HEAD)" || fail "could not resolve rewritten core"
[[ "$NEW_CORE" =~ '^[0-9a-f]{40}$' ]] || fail "NEW_CORE is not a commit hash"
readonly NEW_CORE
[[ "$NEW_CORE" != "$OLD_CORE" ]] || fail "core hash did not change"
[[ "$(git rev-parse "$NEW_CORE^")" == "$OLD_BASE" ]] ||
  fail "rewritten core parent changed"
[[ "$(git diff --name-only "$OLD_CORE" "$NEW_CORE")" ==
   'packages/device/src/index.ts' ]] ||
  fail "rewritten core tree differs outside the index"

CORE_INDEX="$(git show "$NEW_CORE:packages/device/src/index.ts")"
for symbol in wheelContactFromRay clampWheelContactToRing \
  ClickWheelSelectEnd ClickWheelSelectStart WheelContactSample; do
  if print -r -- "$CORE_INDEX" | grep -Fq "$symbol"; then
    fail "premature core export remains: $symbol"
  fi
done
unset CORE_INDEX

# Replay input onto the corrected core, then put the five exports here.
git cherry-pick "$OLD_INPUT"
git apply --index --reverse <<'PATCH_ADD_INPUT_EXPORTS'
diff --git a/packages/device/src/index.ts b/packages/device/src/index.ts
--- a/packages/device/src/index.ts
+++ b/packages/device/src/index.ts
@@ -77,13 +77,8 @@ export {
   clockwiseWheelAngleDeg,
   shortestWheelDeltaDeg,
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
PATCH_ADD_INPUT_EXPORTS

[[ "$(git diff --cached --name-only)" == 'packages/device/src/index.ts' ]] ||
  fail "input amendment touches an unexpected staged path"
git diff --cached --check
GIT_COMMITTER_NAME='Vinicius Dallacqua' \
GIT_COMMITTER_EMAIL='vinicius.dallacqua@mpyadigital.com' \
GIT_COMMITTER_DATE='2026-09-01T21:12:03+02:00' \
  git commit --amend --no-edit --date='2026-09-01T21:12:03+02:00'
NEW_INPUT="$(git rev-parse HEAD)" || fail "could not resolve rewritten input"
[[ "$NEW_INPUT" =~ '^[0-9a-f]{40}$' ]] || fail "NEW_INPUT is not a commit hash"
readonly NEW_INPUT
[[ "$NEW_INPUT" != "$OLD_INPUT" ]] || fail "input hash did not change"
[[ "$(git rev-parse "$NEW_INPUT^")" == "$NEW_CORE" ]] ||
  fail "rewritten input parent is not NEW_CORE"
[[ "$(git rev-parse "$NEW_INPUT^{tree}")" ==
   "$(git rev-parse "$OLD_INPUT^{tree}")" ]] ||
  fail "rewritten input does not restore the exact original input tree"

INPUT_INDEX="$(git show "$NEW_INPUT:packages/device/src/index.ts")"
for symbol in wheelContactFromRay clampWheelContactToRing \
  ClickWheelSelectEnd ClickWheelSelectStart WheelContactSample; do
  print -r -- "$INPUT_INDEX" | grep -Fq "$symbol" ||
    fail "input export is missing: $symbol"
done
unset INPUT_INDEX

# Rewrite only the named target branch's descendants after OLD_INPUT.
git switch "$TARGET_BRANCH"
[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] ||
  fail "target branch was not restored before rebase"
[[ "$(git rev-parse HEAD)" == "$OLD_HEAD" ]] ||
  fail "target branch moved before rebase"
git rebase --rebase-merges --committer-date-is-author-date \
  --onto "$NEW_INPUT" "$OLD_INPUT"

[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] ||
  fail "rebase ended on the wrong branch"
if operation_in_progress; then
  fail "Git operation remained active after rebase"
fi
NEW_HEAD="$(git rev-parse HEAD)" || fail "could not resolve rewritten target head"
[[ "$NEW_HEAD" =~ '^[0-9a-f]{40}$' ]] || fail "NEW_HEAD is not a commit hash"
readonly NEW_HEAD
NEW_COUNT="$(git rev-list --count "$OLD_BASE..$NEW_HEAD")" ||
  fail "could not count rewritten range"
[[ "$NEW_COUNT" =~ '^[0-9]+$' ]] || fail "NEW_COUNT is not numeric"
readonly NEW_COUNT
[[ "$NEW_HEAD" != "$OLD_HEAD" ]] || fail "target head did not change"
[[ "$NEW_COUNT" == "$OLD_COUNT" ]] || fail "commit count changed"
[[ "$(git merge-base "$OLD_BASE" "$NEW_HEAD")" == "$OLD_BASE" ]] ||
  fail "base ancestry changed"
git merge-base --is-ancestor "$NEW_CORE" "$NEW_HEAD"
git merge-base --is-ancestor "$NEW_INPUT" "$NEW_HEAD"
git diff --quiet "$OLD_HEAD" "$NEW_HEAD" -- ||
  fail "final tree differs from the pre-rewrite target tree"

OLD_SEQUENCE="$(git log --reverse \
  --format='%an%x09%ae%x09%aI%x09%s' "$OLD_BASE..$OLD_HEAD")" ||
  fail "could not read original commit sequence"
NEW_SEQUENCE="$(git log --reverse \
  --format='%an%x09%ae%x09%aI%x09%s' "$OLD_BASE..$NEW_HEAD")" ||
  fail "could not read rewritten commit sequence"
[[ -n "$OLD_SEQUENCE" && -n "$NEW_SEQUENCE" ]] ||
  fail "commit sequence is unexpectedly empty"
readonly OLD_SEQUENCE NEW_SEQUENCE
[[ "$NEW_SEQUENCE" == "$OLD_SEQUENCE" ]] ||
  fail "author/date/subject sequence changed"

while IFS= read -r old_revision; do
  if git merge-base --is-ancestor "$old_revision" "$NEW_HEAD"; then
    fail "old descendant unexpectedly remains in rewritten history: $old_revision"
  fi
done < <(git rev-list "$OLD_BASE..$OLD_HEAD")

NEW_CORRECTION="$(git log --format='%H%x09%s' "$OLD_BASE..$NEW_HEAD" |
  awk -F '\t' '$2 == "fix(device): make control release demand-safe" {print $1}')"
readonly NEW_CORRECTION
[[ "$NEW_CORRECTION" =~ '^[0-9a-f]{40}$' ]] ||
  fail "corrective commit did not resolve uniquely"
[[ "$NEW_CORRECTION" != "$OLD_CORRECTION" ]] ||
  fail "corrective descendant hash did not change"
git diff-tree --no-commit-id --name-only -r "$NEW_CORRECTION" |
  grep -Fxq 'apps/web/src/routes/[_]spike.device.tsx' ||
  fail "rewritten correction no longer contains the web route change"

# Fail-closed standalone verification of every rewritten commit. Both affected
# TypeScript boundaries are checked in each isolated archive.
verify_parent="${TMPDIR:-/tmp}"
verify_parent="${verify_parent%/}"
VERIFY_ROOT="$(mktemp -d "$verify_parent/webpod-w9a-verify.XXXXXX")"
trap 'cleanup_verify' EXIT
verified_count=0

while IFS= read -r revision; do
  scratch="$VERIFY_ROOT/$revision"
  mkdir -p "$scratch"
  git archive "$revision" | tar -x -C "$scratch"
  ln -s "$REPO_ROOT/node_modules" "$scratch/node_modules"
  mkdir -p "$scratch/packages/device" "$scratch/apps/web"
  ln -s "$REPO_ROOT/packages/device/node_modules" \
    "$scratch/packages/device/node_modules"
  ln -s "$REPO_ROOT/apps/web/node_modules" \
    "$scratch/apps/web/node_modules"
  (
    cd "$scratch"
    bunx --bun tsc --pretty false --noEmit -p packages/device/tsconfig.json
    bunx --bun tsc --pretty false --noEmit -p apps/web/tsconfig.json
  )
  verified_count=$((verified_count + 1))
done < <(git rev-list --reverse "$OLD_BASE..$NEW_HEAD")

[[ "$verified_count" == "$NEW_COUNT" ]] ||
  fail "archive verification did not cover the full rewritten range"
cleanup_verify
VERIFY_ROOT=''
trap - EXIT

cd "$REPO_ROOT"
bun run typecheck
bun run lint
bun test
bun run build
bun run gates
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "verification changed tracked or untracked repository state"

print -r -- ''
print -r -- 'Inspect this range-diff before publication:'
git range-diff "$OLD_BASE..$OLD_HEAD" "$OLD_BASE..$NEW_HEAD"

umask 077
{
  print -r -- "REPO_ROOT=$REPO_ROOT"
  print -r -- "TARGET_BRANCH=$TARGET_BRANCH"
  print -r -- "REMOTE=$REMOTE"
  print -r -- "OLD_HEAD=$OLD_HEAD"
  print -r -- "EXPECTED_REMOTE_HEAD=$EXPECTED_REMOTE_HEAD"
  print -r -- "BACKUP_BRANCH=$BACKUP_BRANCH"
  print -r -- "NEW_CORE=$NEW_CORE"
  print -r -- "NEW_INPUT=$NEW_INPUT"
  print -r -- "NEW_CORRECTION=$NEW_CORRECTION"
  print -r -- "NEW_HEAD=$NEW_HEAD"
  print -r -- "VERIFIED_COMMITS=$verified_count"
} >| "$STATE_FILE"
chmod 600 "$STATE_FILE"

printf '%s\n' \
  "core       $OLD_CORE -> $NEW_CORE" \
  "input      $OLD_INPUT -> $NEW_INPUT" \
  "correction $OLD_CORRECTION -> $NEW_CORRECTION" \
  "head       $OLD_HEAD -> $NEW_HEAD" \
  "backup     $BACKUP_BRANCH -> $OLD_HEAD" \
  "verified   $verified_count isolated commits (device + web)" \
  "state      $STATE_FILE" \
  'STOP: owner must inspect range-diff before running Phase 2.'

trap - ZERR INT TERM
```

Phase 1 never invokes `git push`. A failure in archive extraction, either
TypeScript project, any full gate, or any exact graph/tree check aborts before
the state file and publication phase are available.

## Exact expected after-state checks

Phase 1 must establish all of these before publication:

- fetched `EXPECTED_REMOTE_HEAD` equals `OLD_HEAD` or is its ancestor; a
  remote-ahead or divergent target is rejected before backup/rewrite work;
- `NEW_CORE != OLD_CORE`, with parent exactly `OLD_BASE`;
- only `packages/device/src/index.ts` differs between old and new core;
- none of the five premature exports exists in `NEW_CORE`;
- `NEW_INPUT != OLD_INPUT`, with parent exactly `NEW_CORE`;
- `NEW_INPUT^{tree} == OLD_INPUT^{tree}` and all five exports exist there;
- `NEW_HEAD != OLD_HEAD`, while commit count, final tree and ordered
  author/date/subject sequence remain exactly equal;
- every old descendant after `OLD_BASE` is absent from `NEW_HEAD` ancestry;
- the rewritten correction is unique, has a new hash, and still changes
  `apps/web/src/routes/[_]spike.device.tsx`;
- every rewritten commit independently typechecks both `packages/device` and
  `apps/web` from an archive;
- full typecheck, lint, tests, build and gates pass from the rewritten tip;
- the worktree/index remains clean and the backup still names `OLD_HEAD`.

Literal after-hashes cannot be known before the owner executes the replay:
descendant identity includes its new parent and committer metadata. Phase 1
prints and persists the exact resulting map only after every check passes.

## Recovery guidance

The trap does not run destructive recovery automatically.

If Phase 1 stops while a rebase is active:

```zsh
cd /Users/vinicius/code/webPod
git status
git rebase --abort
git switch main
```

If it stops during detached cherry-pick construction:

```zsh
cd /Users/vinicius/code/webPod
git status
git cherry-pick --abort  # only when CHERRY_PICK_HEAD exists
git switch main
```

If an apply, amend or post-amend guard fails while detached and no Git operation
is active, the planned index patch can remain staged. Inspect first; do not run
a broad restore. This block prints the complete status and both diffs before it
will accept the explicit cleanup confirmation. It then refuses every changed or
untracked path except the one planned index file and restores only that path:

```zsh
set -euo pipefail

readonly REPO_ROOT='/Users/vinicius/code/webPod'
readonly TARGET_BRANCH='main'
readonly EXPECTED_PATH='packages/device/src/index.ts'
readonly OWNER_CONFIRMS_PATH_BOUNDED_CLEANUP='NO' # owner changes to YES after inspection

fail() {
  print -u2 -- "ERROR: $*"
  return 1
}

cd "$REPO_ROOT"
[[ "$(git rev-parse --show-toplevel)" == "$REPO_ROOT" ]] ||
  fail "not at the asserted repository root"

git status --short --branch
git diff -- "$EXPECTED_PATH"
git diff --cached -- "$EXPECTED_PATH"

[[ "$OWNER_CONFIRMS_PATH_BOUNDED_CLEANUP" == 'YES' ]] ||
  fail "owner has not approved cleanup after inspecting status and diffs"
[[ -z "$(git branch --show-current)" ]] ||
  fail "this recovery applies only to detached HEAD"
[[ ! -d "$(git rev-parse --git-path rebase-merge)" &&
   ! -d "$(git rev-parse --git-path rebase-apply)" &&
   ! -f "$(git rev-parse --git-path CHERRY_PICK_HEAD)" &&
   ! -f "$(git rev-parse --git-path MERGE_HEAD)" &&
   ! -f "$(git rev-parse --git-path REVERT_HEAD)" ]] ||
  fail "a Git operation is active; use its abort command instead"

unstaged_paths="$(git diff --name-only)" || fail "could not inspect unstaged paths"
staged_paths="$(git diff --cached --name-only)" || fail "could not inspect staged paths"
untracked_paths="$(git ls-files --others --exclude-standard)" ||
  fail "could not inspect untracked paths"
[[ -z "$unstaged_paths" || "$unstaged_paths" == "$EXPECTED_PATH" ]] ||
  fail "unexpected unstaged path; preserve it and stop"
[[ -z "$staged_paths" || "$staged_paths" == "$EXPECTED_PATH" ]] ||
  fail "unexpected staged path; preserve it and stop"
[[ -z "$untracked_paths" ]] ||
  fail "untracked files exist; preserve them and stop"
[[ -n "$unstaged_paths" || -n "$staged_paths" ]] ||
  fail "there is no planned path change to clean"

git restore --source=HEAD --staged --worktree -- "$EXPECTED_PATH"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "path-bounded cleanup did not produce a clean detached tree"
git switch "$TARGET_BRANCH"
[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] ||
  fail "target branch was not restored"
```

Before the descendant rebase completes, `main` still points to `OLD_HEAD`. If
verification fails after the rebase completed, inspect and preserve any new
work first. With a clean tree, the owner can restore the backup without using
`reset --hard`:

```zsh
set -euo pipefail

readonly REPO_ROOT='/Users/vinicius/code/webPod'
readonly TARGET_BRANCH='main'
readonly OLD_HEAD='REPLACE_WITH_EXACT_40_HEX_OLD_HEAD'
readonly OWNER_CONFIRMS_COMPLETED_REBASE_RESTORE='NO' # owner changes to YES

fail() {
  print -u2 -- "ERROR: $*"
  return 1
}

cd "$REPO_ROOT"
[[ "$(git rev-parse --show-toplevel)" == "$REPO_ROOT" ]] ||
  fail "not at the asserted repository root"
[[ "$OWNER_CONFIRMS_COMPLETED_REBASE_RESTORE" == 'YES' ]] ||
  fail "owner has not approved restoring the completed rebase"
[[ "$OLD_HEAD" =~ '^[0-9a-f]{40}$' ]] ||
  fail "replace OLD_HEAD with the exact Phase 1 value"
BACKUP_BRANCH="backup/w9a-before-history-repair-$OLD_HEAD"
git check-ref-format --branch "$BACKUP_BRANCH" >/dev/null
readonly BACKUP_BRANCH

[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] ||
  fail "completed-rebase recovery must start on the target branch"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "tree/index must be clean before moving the target branch"
[[ ! -d "$(git rev-parse --git-path rebase-merge)" &&
   ! -d "$(git rev-parse --git-path rebase-apply)" &&
   ! -f "$(git rev-parse --git-path CHERRY_PICK_HEAD)" &&
   ! -f "$(git rev-parse --git-path MERGE_HEAD)" &&
   ! -f "$(git rev-parse --git-path REVERT_HEAD)" ]] ||
  fail "a Git operation is active; abort it before completed-rebase recovery"
[[ "$(git rev-parse "$BACKUP_BRANCH")" == "$OLD_HEAD" ]] ||
  fail "backup branch does not name OLD_HEAD"

git switch --detach "$BACKUP_BRANCH"
git branch -f "$TARGET_BRANCH" "$BACKUP_BRANCH"
git switch "$TARGET_BRANCH"
[[ "$(git rev-parse HEAD)" == "$OLD_HEAD" ]] ||
  fail "target branch was not restored to OLD_HEAD"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "restore did not finish cleanly"
```

Replace the `OLD_HEAD` sentinel with the exact value printed by Phase 1. Both
confirmation sentinels are deliberately inert. Do not delete the backup until
publication and collaborator recovery are complete.

## Phase 2 — owner-only publication

Run only after manually inspecting `git range-diff` and setting the explicit
approval variable. The saved pre-rewrite remote hash remains the lease value;
the script refuses if another writer moved the remote in the meantime.

```zsh
set -euo pipefail

readonly REPO_ROOT='/Users/vinicius/code/webPod'
readonly STATE_FILE="$REPO_ROOT/.git/w9a-history-repair.state"
readonly OWNER_RANGE_DIFF_APPROVED='NO' # owner changes this exact value to YES

fail() {
  print -u2 -- "ERROR: $*"
  return 1
}

state_value() {
  local key="$1"
  local count value
  count="$(grep -c "^${key}=" "$STATE_FILE")"
  if [[ "$count" != '1' ]]; then
    fail "state key is missing or duplicated: $key"
    return 1
  fi
  value="$(sed -n "s/^${key}=//p" "$STATE_FILE")"
  if [[ -z "$value" ]]; then
    fail "state key is empty: $key"
    return 1
  fi
  print -r -- "$value"
}

cd "$REPO_ROOT"
[[ "$(git rev-parse --show-toplevel)" == "$REPO_ROOT" ]] ||
  fail "not at the asserted repository root"
[[ -f "$STATE_FILE" ]] || fail "verified Phase 1 state is absent"

TARGET_BRANCH="$(state_value TARGET_BRANCH)" ||
  fail "could not parse TARGET_BRANCH"
REMOTE="$(state_value REMOTE)" || fail "could not parse REMOTE"
OLD_HEAD="$(state_value OLD_HEAD)" || fail "could not parse OLD_HEAD"
EXPECTED_REMOTE_HEAD="$(state_value EXPECTED_REMOTE_HEAD)" ||
  fail "could not parse EXPECTED_REMOTE_HEAD"
BACKUP_BRANCH="$(state_value BACKUP_BRANCH)" ||
  fail "could not parse BACKUP_BRANCH"
NEW_HEAD="$(state_value NEW_HEAD)" || fail "could not parse NEW_HEAD"

git check-ref-format --branch "$TARGET_BRANCH" >/dev/null
git remote get-url "$REMOTE" >/dev/null
git check-ref-format --branch "$BACKUP_BRANCH" >/dev/null
[[ "$OLD_HEAD" =~ '^[0-9a-f]{40}$' &&
   "$EXPECTED_REMOTE_HEAD" =~ '^[0-9a-f]{40}$' &&
   "$NEW_HEAD" =~ '^[0-9a-f]{40}$' ]] ||
  fail "state contains an invalid hash"
readonly TARGET_BRANCH REMOTE OLD_HEAD EXPECTED_REMOTE_HEAD BACKUP_BRANCH NEW_HEAD

[[ "$OWNER_RANGE_DIFF_APPROVED" == 'YES' ]] ||
  fail "owner has not approved the range-diff"
[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] ||
  fail "wrong branch checked out"
[[ "$(git rev-parse HEAD)" == "$NEW_HEAD" ]] ||
  fail "target branch moved after verification"
[[ "$(git rev-parse "$BACKUP_BRANCH")" == "$OLD_HEAD" ]] ||
  fail "backup no longer names OLD_HEAD"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] ||
  fail "repository is not clean"

REMOTE_LINE="$(git ls-remote --exit-code --heads "$REMOTE" "$TARGET_BRANCH")"
[[ "$(print -r -- "$REMOTE_LINE" | wc -l | tr -d ' ')" == '1' ]] ||
  fail "remote target did not resolve uniquely"
CURRENT_REMOTE_HEAD="${REMOTE_LINE%%[[:space:]]*}"
[[ "$CURRENT_REMOTE_HEAD" == "$EXPECTED_REMOTE_HEAD" ]] ||
  fail "remote moved after Phase 1; force-with-lease must not proceed"

# Owner-only. Agents must stop before this command.
git push \
  --force-with-lease="refs/heads/$TARGET_BRANCH:$EXPECTED_REMOTE_HEAD" \
  "$REMOTE" \
  "refs/heads/$TARGET_BRANCH:refs/heads/$TARGET_BRANCH"

PUBLISHED_HEAD="$(git ls-remote --exit-code --heads \
  "$REMOTE" "$TARGET_BRANCH" | awk '{print $1}')"
[[ "$PUBLISHED_HEAD" == "$NEW_HEAD" ]] ||
  fail "remote does not contain the verified rewritten head"

print -r -- "Published $TARGET_BRANCH at $NEW_HEAD with exact lease $EXPECTED_REMOTE_HEAD."
print -r -- "Keep $BACKUP_BRANCH until every collaborator has recovered."
```

## Consequences

- `OLD_BASE` remains the common base; `OLD_CORE` and every descendant through
  `OLD_HEAD` receive new hashes.
- The final source tree is byte-identical. The semantic history change is only
  moving five index exports from the core commit to the input commit.
- The current W9a correction, evidence commits, interleaved W9b commits and this
  plan are replayed with new parent identities; the range-diff must show them.
- The exact force-with-lease rejects publication if the remote branch changed
  after Phase 1 captured `EXPECTED_REMOTE_HEAD`.
- Before rewrite work begins, the fetched remote tip must equal `OLD_HEAD` or
  already be contained by it. Remote-ahead/divergent history is never dropped;
  the owner must integrate it and restart with a new clean preflight.
- Collaborators must save local work, fetch the rewritten branch, and explicitly
  rebase or reset their local branch onto `NEW_HEAD`. Their old descendant hashes
  must not be merged back.
- The backup branch remains a recoverable pointer to `OLD_HEAD`; removing it is
  a later owner decision after publication and collaborator coordination.
