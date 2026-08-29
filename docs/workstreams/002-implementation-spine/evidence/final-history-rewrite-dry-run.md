# Final history-rewrite dry-run evidence

Date: 2026-08-29

Scope: disposable local clones and a disposable bare remote only. No
authoritative branch was rewritten and no non-dry-run push occurred.

## Exact successful fixture

- Source tip: `c4df1449c3afc5dc38189a2503f2ecb9443d9362`
- Source tree: `43549a2079ce1d421ccb966b822f86281376b98e`
- Source count: 211
- Captured remote `main`: `2305f4bbb09a42a07d872019d31a58c4ef3d98d8`
- S2 tip/count: `b8c40a44080849d9188270c1d05b146b489e6004` / 213
- W0 rewrite base: `107af42a4f72515c3d9c899ed7ab1290162ef7aa`
  with the unchanged source tree and count 213
- Rewritten W7 reviewed commit/tree:
  `c98a1ae69790a700c0bc11a8b0d281d715b5cfae` /
  `7d93de5f0b960adf1ecd3bba72114444bac63ad3`
- Rebound source identity:
  `8dc78efc13ed68be287f46113dec3dcbf9dc3763c1d30a6c72e5ccb437b13884`
  / 151 files
- Final evidence-rebound tip/tree/count:
  `d6775815b1020416fa7020943349be49b6a925e0` /
  `a172ff9e065e3194c012e43b5f25efb81793991a` / 214

## Exact command chain exercised

This is the successful second replay, reproduced without omitted phases. The
fixture substituted a local bare remote so publication could be tested with
`--dry-run`; the authoritative plan uses the recorded GitHub URL instead.

```bash
set -euo pipefail
ROOT=/private/tmp/webpod-final-replay2
mkdir -p "$ROOT"
# The isolated official git-filter-repo install and callback created during the
# first disposable attempt were copied byte-for-byte into this fresh fixture.
cp -R /private/tmp/webpod-final-replay.ai6fm3/tool "$ROOT/tool"
cp /private/tmp/webpod-final-replay.ai6fm3/strip.py "$ROOT/strip.py"
SOURCE=/Users/vinicius/code/webPod
S2=$ROOT/s2
W0=$ROOT/w0
REMOTE=$ROOT/remote.git
export PATH="$ROOT/tool/bin:$PATH"
export PYTHONPATH="$ROOT/tool"
test "$(git filter-repo --version)" = a40bce548d2c
test "$(shasum -a 256 "$ROOT/strip.py" | cut -d ' ' -f1)" = \
  "$(shasum -a 256 /private/tmp/webpod-final-replay.ai6fm3/strip.py | cut -d ' ' -f1)"

SOURCE_TIP=$(git -C "$SOURCE" rev-parse refs/heads/main)
SOURCE_TREE=$(git -C "$SOURCE" rev-parse "$SOURCE_TIP^{tree}")
SOURCE_COUNT=$(git -C "$SOURCE" rev-list --count "$SOURCE_TIP")
EXPECTED_REMOTE=$(git -C "$SOURCE" rev-parse refs/remotes/origin/main)

git clone --quiet --bare "$SOURCE" "$REMOTE"
git -C "$REMOTE" update-ref refs/heads/main "$EXPECTED_REMOTE"
git clone --quiet --no-local --branch main "$SOURCE" "$S2"
test "$(git -C "$S2" rev-parse HEAD)" = "$SOURCE_TIP"
test "$(git -C "$S2" rev-parse HEAD^{tree})" = "$SOURCE_TREE"
test "$(git -C "$S2" rev-list --count HEAD)" = "$SOURCE_COUNT"
(cd "$S2" && bun install --frozen-lockfile --ignore-scripts)
git -C "$S2" branch backup/s2-before-split "$SOURCE_TIP"
GIT_SEQUENCE_EDITOR="sed -i.bak 's/^pick 55b34dd /edit 55b34dd /'" \
  git -C "$S2" rebase -i --rebase-merges 55b34dd^

git -C "$S2" reset HEAD^
git -C "$S2" add -- \
  packages/state/src/contract.ts packages/state/src/index.ts \
  packages/state/src/menu.ts packages/state/src/screen.test.ts \
  packages/state/src/screen.ts packages/state/src/store.test.ts \
  packages/state/src/store.ts
git -C "$S2" commit -m 'feat(state): screen state machine'
git -C "$S2" add -- \
  docs/workstreams/002-implementation-spine/decisions/s1.md \
  docs/workstreams/002-implementation-spine/evidence/apple-capability-spike.md
git -C "$S2" commit -m 'docs(apple): revise capability evidence'
git -C "$S2" add -- scripts/spikes/mint-apple-dev-token.ts \
  scripts/spikes/probe-apple.ts \
  docs/workstreams/002-implementation-spine/decisions/s2.md \
  docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md
git -C "$S2" commit -m 'spike(apple): probe catalog capabilities read-only'
GIT_EDITOR=true git -C "$S2" rebase --continue

S2_TIP=$(git -C "$S2" rev-parse HEAD)
S2_TREE=$(git -C "$S2" rev-parse HEAD^{tree})
S2_COUNT=$(git -C "$S2" rev-list --count HEAD)
test "$S2_TREE" = "$SOURCE_TREE"
test "$S2_COUNT" = "$((SOURCE_COUNT + 2))"
STATE_SPLIT=$(git -C "$S2" log --format='%H' \
  --grep='^feat(state): screen state machine$')
S1_SPLIT=$(git -C "$S2" log --format='%H' \
  --grep='^docs(apple): revise capability evidence$')
S2_SPLIT=$(git -C "$S2" log --format='%H' \
  --grep='^spike(apple): probe catalog capabilities read-only$')
test "$(git -C "$S2" rev-parse "$S1_SPLIT^")" = "$STATE_SPLIT"
test "$(git -C "$S2" rev-parse "$S2_SPLIT^")" = "$S1_SPLIT"
(cd "$S2" && bun run typecheck)
(cd "$S2" && bun test)
(cd "$S2" && bun run lint)
(cd "$S2" && bun run gates)

git clone --quiet --no-local --branch main "$S2" "$W0"
test "$(git -C "$W0" rev-parse HEAD)" = "$S2_TIP"
test "$(git -C "$W0" rev-parse HEAD^{tree})" = "$S2_TREE"
test "$(git -C "$W0" rev-list --count HEAD)" = "$S2_COUNT"
for oid in "$STATE_SPLIT" "$S1_SPLIT" "$S2_SPLIT"; do
  git -C "$W0" merge-base --is-ancestor "$oid" "$S2_TIP"
done

cd "$W0"
git filter-repo --invert-paths --path .claude/ \
  --message-callback "$ROOT/strip.py"
git filter-repo --path-rename CLAUDE.md:AGENTS.md
test -z "$(git log --all --format='%H' -- .claude CLAUDE.md)"
test "$(git log --all --format='%B' \
  | grep -iEc 'co-authored-by|claude-session|generated with')" = 0
RENAME_COMMIT=$(git log --format='%H%x09%s' \
  | awk -F '\t' '$2 == "chore: repo hygiene and agent instruction law" {print $1}')
BAD=0
for commit in $(git rev-list --reverse "$RENAME_COMMIT^..HEAD"); do
  git cat-file -e "${commit}:AGENTS.md" 2>/dev/null || BAD=1
done
test "$BAD" = 0
test "$(git rev-list --count HEAD)" = "$S2_COUNT"
test "$(git rev-parse HEAD^{tree})" = "$S2_TREE"
REWRITE_BASE_TIP=$(git rev-parse HEAD)
REWRITE_BASE_TREE=$(git rev-parse HEAD^{tree})
(cd "$W0" && bun install --frozen-lockfile --ignore-scripts)

ORIGINAL_W7_COMMIT=d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa
ORIGINAL_W7_TREE=7d93de5f0b960adf1ecd3bba72114444bac63ad3
if git cat-file -e "$ORIGINAL_W7_COMMIT^{commit}" 2>/dev/null; then exit 1; fi
W7_REWRITTEN_COMMIT=$(git log --format='%H%x09%T%x09%s' \
  | awk -F '\t' -v tree="$ORIGINAL_W7_TREE" \
      -v subject='fix(composite): sequence immutable evidence server' \
      '$2 == tree && $3 == subject {print $1}')
test "$(printf '%s\n' "$W7_REWRITTEN_COMMIT" | grep -c .)" = 1
test "$(git rev-parse "$W7_REWRITTEN_COMMIT^{tree}")" = "$ORIGINAL_W7_TREE"

W7_JSON=docs/workstreams/002-implementation-spine/evidence/w7-browser.json
W7_PROVENANCE=docs/workstreams/002-implementation-spine/evidence/w7-browser-provenance.md
W7_SOURCE_COMMIT="$W7_REWRITTEN_COMMIT" \
  bun run scripts/w7-browser-evidence.ts > "$ROOT/rebound.json"
cp "$ROOT/rebound.json" "$W7_JSON"
W7_REWRITTEN_COMMIT="$W7_REWRITTEN_COMMIT" perl -0pi -e \
  's/d66c66bfdc8d1e284739dc3ecf73ac80b537e4fa/$ENV{W7_REWRITTEN_COMMIT}/g' \
  "$W7_PROVENANCE"
test "$(git diff --name-only | sort)" = \
  "$(printf '%s\n%s\n' "$W7_JSON" "$W7_PROVENANCE" | sort)"
git diff --quiet -- apps packages scripts package.json bun.lock tsconfig.base.json
bun test scripts/w7-browser-evidence-schema.test.ts
git add -- "$W7_JSON" "$W7_PROVENANCE"
git commit --only \
  -m 'docs(evidence): rebind W7 browser provenance after rewrite' \
  -- "$W7_JSON" "$W7_PROVENANCE"

FINAL_TIP=$(git rev-parse HEAD)
FINAL_TREE=$(git rev-parse HEAD^{tree})
FINAL_COUNT=$(git rev-list --count HEAD)
test "$FINAL_COUNT" = "$((S2_COUNT + 1))"
test "$(git rev-parse HEAD^)" = "$REWRITE_BASE_TIP"
test "$(git diff-tree --no-commit-id --name-only -r HEAD | sort)" = \
  "$(printf '%s\n%s\n' "$W7_JSON" "$W7_PROVENANCE" | sort)"
git diff --quiet "$REWRITE_BASE_TIP" HEAD -- \
  apps packages scripts package.json bun.lock tsconfig.base.json

ln -s AGENTS.md CLAUDE.md
git check-ignore --quiet CLAUDE.md
test -z "$(git status --short)"
bun run typecheck
bun run lint
bun test
bun run gates
bun run build

git remote add origin "$REMOTE"
git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
test "$(git rev-parse refs/remotes/origin/main)" = "$EXPECTED_REMOTE"
test "$(git ls-remote --exit-code origin refs/heads/main | cut -f1)" = \
  "$EXPECTED_REMOTE"
git push --dry-run \
  --force-with-lease=refs/heads/main:"$EXPECTED_REMOTE" \
  origin refs/heads/main:refs/heads/main

git -C "$REMOTE" update-ref refs/heads/main "$SOURCE_TIP"
git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
test "$(git rev-parse refs/remotes/origin/main)" != "$EXPECTED_REMOTE"
set +e
git push --dry-run \
  --force-with-lease=refs/heads/main:"$EXPECTED_REMOTE" \
  origin refs/heads/main:refs/heads/main
STALE_EXIT=$?
set -e
test "$STALE_EXIT" -ne 0
```

The callback body used by `--message-callback` is exactly the callback printed
in `w0-history-rewrite-plan.md` §4; its installed official
`git-filter-repo` revision reported `a40bce548d2c`.

## Results

- S2 and final W0: 11/11 typecheck, lint exit 0, 941 tests / 0 failures,
  16 automated gates / 0 failures.
- The focused W7 suite passed 9/9 and directly rejected well-formed wrong
  commit, wrong tree, wrong digest, and wrong file count values.
- `bun run build` produced both Vite client (213 modules) and SSR (376 modules)
  outputs. No nonexistent second build script was invoked.
- Matching expected-OID publication succeeded only under `--dry-run`.
- After the disposable remote moved, the OID preflight rejected it and the same
  explicit lease exited 1 with `stale info`.

This artifact reports the complete successful chain. An earlier partial replay
was discarded after it exposed invalid `bun --cwd … run` syntax; none of its
results are used here.
