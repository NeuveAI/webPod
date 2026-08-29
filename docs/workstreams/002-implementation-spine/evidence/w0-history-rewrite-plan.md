# W0.2 — reconciled owner-only history rewrite plan

**Status: prepared and not run against an authoritative branch or remote.** This
is the single authoritative sequence for S2 boundary repair, W0 history hygiene,
and publication preparation. An agent may validate it only in disposable clones.
Only the owner may run it against the repository that will be published, and only
the owner may execute the final force-with-lease command.

The binding order is: committed `main` → verified S2 clone → verified W0 clone →
remote-lease reconstruction. The W0 workspace must never be cloned or reset from
the original repository or pre-S2 remote. Equality checks below make that mistake
fatal before pass 1.

## 1. Fixed paths, refs, and pre-rewrite state

Run after teammates stop and the owner preserves the intentional artifacts in
`handoff.md`. An existing destination is a stop condition; there is deliberately
no recursive-delete recovery command.

```bash
SOURCE_REPO=/Users/vinicius/code/webPod
S2_REPO=/Users/vinicius/code/webPod-s2-rewrite
W0_REPO=/Users/vinicius/code/webPod-history-rewrite
STATE_FILE=/Users/vinicius/code/webPod-history-rewrite-state.gitconfig
REMOTE_URL=git@github.com:NeuveAI/webPod.git
PUBLISH_BRANCH=main
MIXED_COMMIT=55b34dd

test ! -e "$S2_REPO"
test ! -e "$W0_REPO"
test ! -e "$STATE_FILE"
test "$(git -C "$SOURCE_REPO" branch --show-current)" = "$PUBLISH_BRANCH"
test "$(git -C "$SOURCE_REPO" remote get-url origin)" = "$REMOTE_URL"

git -C "$SOURCE_REPO" fetch --no-tags origin \
  refs/heads/main:refs/remotes/origin/main
EXPECTED_REMOTE_MAIN=$(git -C "$SOURCE_REPO" rev-parse refs/remotes/origin/main)
LIVE_REMOTE_MAIN=$(git -C "$SOURCE_REPO" ls-remote --exit-code origin \
  refs/heads/main | cut -f1)
test -n "$EXPECTED_REMOTE_MAIN"
test "$LIVE_REMOTE_MAIN" = "$EXPECTED_REMOTE_MAIN"

SOURCE_TIP=$(git -C "$SOURCE_REPO" rev-parse refs/heads/main)
SOURCE_TREE=$(git -C "$SOURCE_REPO" rev-parse "$SOURCE_TIP^{tree}")
SOURCE_COUNT=$(git -C "$SOURCE_REPO" rev-list --count "$SOURCE_TIP")
test "$(git -C "$SOURCE_REPO" log --reverse --format='%h' -- \
  .claude CLAUDE.md | head -1)" = 2305f4b
test "$(git -C "$SOURCE_REPO" log --format='%h %(trailers:only=true)' \
  | grep -iEc 'co-authored-by|claude-session|generated with')" = 1
git -C "$SOURCE_REPO" merge-base --is-ancestor 2305f4b "$SOURCE_TIP"
git -C "$SOURCE_REPO" merge-base --is-ancestor "$MIXED_COMMIT" "$SOURCE_TIP"

git config --file "$STATE_FILE" rewrite.sourceTip "$SOURCE_TIP"
git config --file "$STATE_FILE" rewrite.sourceTree "$SOURCE_TREE"
git config --file "$STATE_FILE" rewrite.sourceCount "$SOURCE_COUNT"
git config --file "$STATE_FILE" rewrite.expectedRemoteMain "$EXPECTED_REMOTE_MAIN"
git config --file "$STATE_FILE" rewrite.remoteUrl "$REMOTE_URL"
```

The state file is outside all repositories and contains only object IDs and the
remote URL. It is the validated transfer contract between phases.

## 2. S2 boundary split in its own clone

This is the only clone sourced from the original repository. It copies committed
`main`, not uncommitted source artifacts.

```bash
git clone --no-local --branch "$PUBLISH_BRANCH" "$SOURCE_REPO" "$S2_REPO"
test "$(git -C "$S2_REPO" rev-parse HEAD)" = "$SOURCE_TIP"
test "$(git -C "$S2_REPO" rev-parse HEAD^{tree})" = "$SOURCE_TREE"
test "$(git -C "$S2_REPO" rev-list --count HEAD)" = "$SOURCE_COUNT"
test -z "$(git -C "$S2_REPO" status --short)"

git -C "$S2_REPO" branch backup/s2-before-split "$SOURCE_TIP"
git -C "$S2_REPO" tag "backup-s2-before-split-$(date +%Y%m%d-%H%M%S)" \
  "$SOURCE_TIP"
git -C "$S2_REPO" rebase -i --rebase-merges "$MIXED_COMMIT^"
```

In the todo, change only `pick 55b34dd feat(state): screen state machine` to
`edit 55b34dd feat(state): screen state machine`. When rebase stops:

```bash
git -C "$S2_REPO" reset HEAD^
git -C "$S2_REPO" add -- \
  packages/state/src/contract.ts packages/state/src/index.ts \
  packages/state/src/menu.ts packages/state/src/screen.test.ts \
  packages/state/src/screen.ts packages/state/src/store.test.ts \
  packages/state/src/store.ts
git -C "$S2_REPO" commit -m "feat(state): screen state machine"

git -C "$S2_REPO" add -- \
  docs/workstreams/002-implementation-spine/decisions/s1.md \
  docs/workstreams/002-implementation-spine/evidence/apple-capability-spike.md
git -C "$S2_REPO" commit -m "docs(apple): revise capability evidence"

git -C "$S2_REPO" add -- scripts/spikes/mint-apple-dev-token.ts \
  scripts/spikes/probe-apple.ts \
  docs/workstreams/002-implementation-spine/decisions/s2.md \
  docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md
git -C "$S2_REPO" commit -m \
  "spike(apple): probe catalog capabilities read-only"
git -C "$S2_REPO" rebase --continue
```

Verify and record the exact S2 output:

```bash
S2_TIP=$(git -C "$S2_REPO" rev-parse refs/heads/main)
S2_TREE=$(git -C "$S2_REPO" rev-parse "$S2_TIP^{tree}")
S2_COUNT=$(git -C "$S2_REPO" rev-list --count "$S2_TIP")
test "$S2_TREE" = "$SOURCE_TREE"
test "$S2_COUNT" = "$((SOURCE_COUNT + 2))"
test -z "$(git -C "$S2_REPO" status --short)"

STATE_SPLIT=$(git -C "$S2_REPO" log --format='%H' \
  --grep='^feat(state): screen state machine$')
S1_SPLIT=$(git -C "$S2_REPO" log --format='%H' \
  --grep='^docs(apple): revise capability evidence$')
S2_SPLIT=$(git -C "$S2_REPO" log --format='%H' \
  --grep='^spike(apple): probe catalog capabilities read-only$')
test "$(printf '%s\n' "$STATE_SPLIT" | grep -c .)" = 1
test "$(printf '%s\n' "$S1_SPLIT" | grep -c .)" = 1
test "$(printf '%s\n' "$S2_SPLIT" | grep -c .)" = 1
test "$(git -C "$S2_REPO" rev-parse "$S1_SPLIT^")" = "$STATE_SPLIT"
test "$(git -C "$S2_REPO" rev-parse "$S2_SPLIT^")" = "$S1_SPLIT"

git config --file "$STATE_FILE" rewrite.s2Tip "$S2_TIP"
git config --file "$STATE_FILE" rewrite.s2Tree "$S2_TREE"
git config --file "$STATE_FILE" rewrite.s2Count "$S2_COUNT"
git config --file "$STATE_FILE" rewrite.stateSplit "$STATE_SPLIT"
git config --file "$STATE_FILE" rewrite.s1Split "$S1_SPLIT"
git config --file "$STATE_FILE" rewrite.s2Split "$S2_SPLIT"

git -C "$S2_REPO" diff --exit-code "$SOURCE_TIP^{tree}" "$S2_TIP^{tree}"
bun --cwd "$S2_REPO" run typecheck
bun --cwd "$S2_REPO" test
bun --cwd "$S2_REPO" run lint
bun --cwd "$S2_REPO" run gates
```

## 3. Validated S2 → W0 transfer

The source here is `$S2_REPO` — never `$SOURCE_REPO`, GitHub, or `origin`.

```bash
EXPECTED_S2_TIP=$(git config --file "$STATE_FILE" rewrite.s2Tip)
EXPECTED_S2_TREE=$(git config --file "$STATE_FILE" rewrite.s2Tree)
EXPECTED_S2_COUNT=$(git config --file "$STATE_FILE" rewrite.s2Count)

test "$(git -C "$S2_REPO" rev-parse refs/heads/main)" = "$EXPECTED_S2_TIP"
test "$(git -C "$S2_REPO" rev-parse HEAD^{tree})" = "$EXPECTED_S2_TREE"
test "$(git -C "$S2_REPO" rev-list --count HEAD)" = "$EXPECTED_S2_COUNT"

git clone --no-local --branch "$PUBLISH_BRANCH" "$S2_REPO" "$W0_REPO"
test "$(git -C "$W0_REPO" rev-parse refs/heads/main)" = "$EXPECTED_S2_TIP"
test "$(git -C "$W0_REPO" rev-parse HEAD^{tree})" = "$EXPECTED_S2_TREE"
test "$(git -C "$W0_REPO" rev-list --count HEAD)" = "$EXPECTED_S2_COUNT"
test -z "$(git -C "$W0_REPO" status --short)"

for key in stateSplit s1Split s2Split; do
  oid=$(git config --file "$STATE_FILE" "rewrite.$key")
  git -C "$W0_REPO" cat-file -e "$oid^{commit}"
  git -C "$W0_REPO" merge-base --is-ancestor "$oid" "$EXPECTED_S2_TIP"
done
test "$(git -C "$W0_REPO" rev-parse \
  "$(git config --file "$STATE_FILE" rewrite.s1Split)^")" = \
  "$(git config --file "$STATE_FILE" rewrite.stateSplit)"
test "$(git -C "$W0_REPO" rev-parse \
  "$(git config --file "$STATE_FILE" rewrite.s2Split)^")" = \
  "$(git config --file "$STATE_FILE" rewrite.s1Split)"
```

These guards prove the split commits, their order, and unchanged S2 tree are the
actual W0 input before pass 1.

## 4. W0 rewrite passes

Install `git-filter-repo` before this phase. The callback file avoids ambiguous
shell quoting.

```bash
cat > /tmp/webpod-strip-trailers.py <<'PY'
import re
lines = message.decode("utf-8", "replace").splitlines()
BANNED = re.compile(
    r"^\s*(co-authored-by|claude-session|generated[- ]with)\s*:",
    re.IGNORECASE,
)
GENERATED_FOOTER = re.compile(
    r"^\s*(\xf0\x9f\xa4\x96\s*)?generated with \[?claude",
    re.IGNORECASE,
)
kept = [line for line in lines
        if not BANNED.match(line) and not GENERATED_FOOTER.match(line)]
while kept and not kept[-1].strip():
    kept.pop()
return ("\n".join(kept) + "\n").encode("utf-8")
PY

cd "$W0_REPO"
test "$(git rev-parse HEAD)" = "$EXPECTED_S2_TIP"
test "$(git rev-parse HEAD^{tree})" = "$EXPECTED_S2_TREE"
test "$(git rev-list --count HEAD)" = "$EXPECTED_S2_COUNT"

git filter-repo --invert-paths --path .claude/ \
  --message-callback /tmp/webpod-strip-trailers.py
test -z "$(git log --all --format='%H' -- .claude)"
test "$(git log --all --format='%B' \
  | grep -iEc 'co-authored-by|claude-session|generated with')" = 0

git filter-repo --path-rename CLAUDE.md:AGENTS.md
test -z "$(git log --all --format='%H' -- CLAUDE.md)"
git cat-file -e HEAD:AGENTS.md
```

The old rename commit maps a delete and create onto the same path. Verify every
descendant tree, not only the tip:

```bash
RENAME_COMMIT=$(git log --format='%H%x09%s' \
  | awk -F '\t' '$2 == "chore: repo hygiene and agent instruction law" {print $1}')
test "$(printf '%s\n' "$RENAME_COMMIT" | grep -c .)" = 1
BAD=0
for commit in $(git rev-list --reverse "$RENAME_COMMIT^..HEAD"); do
  git cat-file -e "${commit}:AGENTS.md" 2>/dev/null \
    || { echo "AGENTS.md missing at $commit"; BAD=1; }
done
test "$BAD" = 0
```

If this fails, stop. Preserve the failed clone for diagnosis and start a new W0
destination from the still-verified `$S2_REPO`; never amend a descendant and
never use a pre-S2 source. H-1 requires the historical rename, so skipping pass
2 is not an accepted completion path.

## 5. Final invariants and local symlink

```bash
cd "$W0_REPO"
test "$(git rev-list --count HEAD)" = "$EXPECTED_S2_COUNT"
test "$(git rev-parse HEAD^{tree})" = "$EXPECTED_S2_TREE"
git rev-parse 1efe77e^{commit} 92c5e41^{commit} 2516827^{commit}
test "$(git -C "$S2_REPO" rev-parse main:design.pen)" = \
  "$(git rev-parse HEAD:design.pen)"
test -z "$(git log --all --format='%H' -- .claude CLAUDE.md)"
test "$(git log --all --format='%B' \
  | grep -iEc 'co-authored-by|claude-session|generated with')" = 0

test ! -e CLAUDE.md
ln -s AGENTS.md CLAUDE.md
test "$(readlink CLAUDE.md)" = AGENTS.md
git check-ignore --quiet CLAUDE.md
test -z "$(git status --short)"

bun run typecheck
bun test
bun run lint
bun run gates
bun run build
bun run build:ssr
```

The original repository and S2 backup refs remain recovery sources until a
fresh post-publication clone is verified.

## 6. Publication preparation — owner only

`git-filter-repo` removes `origin` and remote-tracking refs. Reconstruct that
state in the rewritten clone, fetch exact `main`, and compare it with the OID
captured before rewriting. Any mismatch is a hard stop.

```bash
cd "$W0_REPO"
EXPECTED_REMOTE_MAIN=$(git config --file "$STATE_FILE" rewrite.expectedRemoteMain)
EXPECTED_REMOTE_URL=$(git config --file "$STATE_FILE" rewrite.remoteUrl)
test -n "$EXPECTED_REMOTE_MAIN"
test "$EXPECTED_REMOTE_URL" = "$REMOTE_URL"

if git remote get-url origin >/dev/null 2>&1; then
  test "$(git remote get-url origin)" = "$EXPECTED_REMOTE_URL"
else
  git remote add origin "$EXPECTED_REMOTE_URL"
fi
test "$(git remote get-url origin)" = "$EXPECTED_REMOTE_URL"

git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
FETCHED_REMOTE_MAIN=$(git rev-parse refs/remotes/origin/main)
LIVE_REMOTE_MAIN=$(git ls-remote --exit-code origin refs/heads/main | cut -f1)
test "$FETCHED_REMOTE_MAIN" = "$EXPECTED_REMOTE_MAIN"
test "$LIVE_REMOTE_MAIN" = "$EXPECTED_REMOTE_MAIN"
test "$(git rev-parse refs/heads/main)" = "$(git rev-parse HEAD)"
```

Stop here. The prepared command names both destination ref and expected old OID:

```bash
# OWNER ONLY — prepared, never executed by an agent.
git push \
  --force-with-lease=refs/heads/main:"$EXPECTED_REMOTE_MAIN" \
  origin refs/heads/main:refs/heads/main
```

The explicit lease rejects a remote change even after the fetch. Never replace
it with `--force`, omit the expected OID, or reuse an OID from another ref. After
owner publication, verify a fresh clone and have collaborators re-clone.

Removing reachable history does not guarantee immediate deletion from hosting
caches, forks, PR refs, or old clones. Rotate anything sensitive independently.
