# W0.2 — history rewrite: prepared, NOT run

**Status: prepared and stopped.** Nothing in this file has been executed. Per repo law in
`AGENTS.md`, an agent may prepare a rewrite and print the commands; the owner runs them.

> `origin/main` is already at `2305f4b`, and that commit is one of the ones this rewrite
> changes. Publishing the result therefore requires a **force-push, which the owner performs.**

---

## 1. What the rewrite has to do

> ⚑ **Where the hashes in this section are valid.** Every hash named below — `2305f4b`,
> `8f27b02` and the rest — refers to the **original repo** (`~/code/webPod`), which the
> rewrite never modifies. **None of them resolve inside `~/code/webPod-rewrite`**, because
> every commit from `2305f4b` onward gets a new hash there. Anything you run inside the
> rewritten clone identifies commits by message, as §4.1 does. The snapshots below were
> measured at the time of writing and the tip has moved since; §3.0 re-verifies the three
> invariants that actually matter at the moment you run this.

Three things, and only these three:

| # | Change | Which commits actually carry it |
|---|---|---|
| 1 | Remove `.claude/` from history | `2305f4b` (adds `.claude/settings.local.json`), `8f27b02` (deletes it) |
| 2 | Rename `CLAUDE.md` → `AGENTS.md` | `2305f4b` (adds `CLAUDE.md`), `8f27b02` (renames it) |
| 3 | Strip the `Co-Authored-By` trailer | `2305f4b` only — it is the only commit in the repo carrying one |

Measured, not assumed:

```
$ git log --all --format='%h %s' --name-only -- .claude CLAUDE.md AGENTS.md
8f27b02 chore: repo hygiene and agent instruction law
.claude/settings.local.json
AGENTS.md
CLAUDE.md
2305f4b docs: interface design handover (workstream 001)
.claude/settings.local.json
CLAUDE.md

$ for c in $(git rev-list --reverse HEAD); do ... done
1efe77e  design: add base design.pen and some exported frames    trailers:[]
92c5e41  design: cleanup and improvements                        trailers:[]
2516827  design: refinements                                     trailers:[]
2305f4b  docs: interface design handover (workstream 001)        trailers:[Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>]
9e65a48  chore: bun workspace scaffold                           trailers:[]
8f27b02  chore: repo hygiene and agent instruction law           trailers:[]
```

**Consequence for hashes.** The earliest commit any of the three changes touches is `2305f4b`.
So `1efe77e`, `92c5e41` and `2516827` keep their hashes; `2305f4b` and everything after it get
new ones. The three design commits are untouched, and `design.pen` is never rewritten.

---

## 2. Prerequisite

`git-filter-repo` is **not installed** on this machine:

```
$ command -v git-filter-repo
(nothing)
$ git filter-repo --version
git: 'filter-repo' is not a git command.
```

Install it first (Homebrew is the path of least resistance on this machine; the repo's
`bun`/`bunx`-only law governs the JS toolchain, not system package managers):

```bash
brew install git-filter-repo
```

---

## 3. The commands

Run these on a **fresh clone**, not on the working repo. `git filter-repo` refuses to run on a
repo with uncommitted state or an existing origin unless forced, and it drops the `origin`
remote by design — working on a clone keeps the original recoverable if anything goes wrong.

> **This plan is deliberately tip-independent.** It was written while other lanes were
> committing, so it names no specific HEAD. Everything below is expressed as invariants you
> verify at the time you run it, not as a snapshot that goes stale the next time anyone commits.

```bash
# 3.0 — starting point. Record the current tip and confirm the invariants the
#       rewrite depends on. Do not expect a particular hash here.
cd ~/code/webPod
BEFORE_TIP=$(git rev-parse HEAD); echo "before: $BEFORE_TIP"
BEFORE_COUNT=$(git rev-list --count HEAD); echo "commits: $BEFORE_COUNT"

# Invariant 1 — 2305f4b is still the first commit carrying .claude/ and CLAUDE.md,
#               so it is the earliest commit the rewrite touches.
git log --reverse --format='%h' -- .claude CLAUDE.md | head -1     # expect: 2305f4b

# Invariant 2 — 2305f4b is still the only commit with a banned trailer.
git log --format='%h %(trailers:only=true)' | grep -iE 'co-authored-by|claude-session'
                                                                    # expect: one line, 2305f4b

# Invariant 3 — history has not already been rewritten.
git merge-base --is-ancestor 2305f4b HEAD && echo "2305f4b is an ancestor: OK"

# 3.1 — fresh clone to operate on.
cd ~/code
git clone webPod webPod-rewrite
cd webPod-rewrite

# 3.2 — the trailer-stripping callback, as a file so the quoting is unambiguous.
cat > /tmp/strip-trailers.py <<'PY'
import re

lines = message.decode("utf-8", "replace").splitlines()

# Drop the trailer lines this repo has outlawed, plus any blank lines they leave
# stranded at the end of the message. Matching is anchored and case-insensitive
# so a differently-cased variant cannot slip through.
BANNED = re.compile(
    r"^\s*(co-authored-by|claude-session|generated[- ]with)\s*:",
    re.IGNORECASE,
)
GENERATED_FOOTER = re.compile(
    r"^\s*(\xf0\x9f\xa4\x96\s*)?generated with \[?claude",
    re.IGNORECASE,
)

kept = [
    l for l in lines
    if not BANNED.match(l) and not GENERATED_FOOTER.match(l)
]
while kept and not kept[-1].strip():
    kept.pop()

return ("\n".join(kept) + "\n").encode("utf-8")
PY

# 3.3 — PASS 1: remove .claude/ from every commit, and strip the trailers.
#        These two are independent, so they share one pass.
git filter-repo \
  --invert-paths \
  --path .claude/ \
  --message-callback /tmp/strip-trailers.py

# 3.4 — VERIFY PASS 1 before going further.
git log --all --format='%h %s' --name-only -- .claude          # expect: no output
git log --format='%B' | grep -iE 'co-authored-by|claude-session|generated with'
                                                                # expect: no output, exit 1

# 3.5 — PASS 2: rename CLAUDE.md to AGENTS.md across history.
git filter-repo --path-rename CLAUDE.md:AGENTS.md

# 3.6 — VERIFY PASS 2. ⚑ THIS CHECK IS NOT OPTIONAL — see §4.
git cat-file -e HEAD:AGENTS.md && echo "AGENTS.md present at tip: OK"
git log --all --format='%h %s' --name-only -- CLAUDE.md        # expect: no output
git log --follow --format='%h %s' -- AGENTS.md                 # expect: both commits listed
```

---

## 4. ⚑ The one thing that can go wrong, and how to tell

**Read this before running pass 2. It is the only step that can hand you a wrong tree
without reporting an error.**

The commit that renamed `CLAUDE.md` to `AGENTS.md` contains **both** a delete of
`CLAUDE.md` and a create of `AGENTS.md`. After `--path-rename CLAUDE.md:AGENTS.md` that
one commit holds two changes for the same path — one delete, one create — and which
survives depends on how `filter-repo` de-duplicates them. If the delete wins,
**`AGENTS.md` disappears** from that commit onward until the next commit that writes it.
No error is raised. The tree is simply wrong.

### 4.1 Find the commit at risk — by message, never by hash

Every hash from `2305f4b` onward is different inside the rewritten clone, so a hash from
this document, or from your own `git log` in the original repo, will not resolve there.

```bash
# Inside ~/code/webPod-rewrite, after pass 2.
RENAME_COMMIT=$(git log --format='%H %s' \
  | grep 'repo hygiene and agent instruction law' | cut -d' ' -f1)
test -n "$RENAME_COMMIT" && echo "rename commit: $RENAME_COMMIT"
```

### 4.2 The check — across the whole history, not just the tip

`AGENTS.md` must exist at that commit and at **every commit after it**. Checking only the
tip is not enough: a later commit that happens to write `AGENTS.md` would restore it at
the tip while leaving a hole in the middle.

```bash
BAD=0
for c in $(git rev-list --reverse "${RENAME_COMMIT}^..HEAD"); do
  git cat-file -e "$c:AGENTS.md" 2>/dev/null \
    || { echo "MISSING at $(git log -1 --format='%h %s' "$c")"; BAD=1; }
done
[ "$BAD" = 0 ] && echo "AGENTS.md present at every commit from the rename onward: OK"
```

### 4.3 If it failed — start over without pass 2

⚑ **Do not try to repair it with `git commit --amend`.** That only ever works when the
damaged commit is the tip, and it is not: several commits now sit on top of it. Amending
would rewrite the wrong commit and leave the hole in place.

Repairing a mid-history commit means another full rewrite pass, which is strictly more
risk than simply not doing the optional half. Throw the clone away and redo pass 1 only:

```bash
cd ~/code
rm -rf webPod-rewrite
git clone webPod webPod-rewrite          # the original was never modified
cd webPod-rewrite
# run step 3.3 (the .claude/ removal + trailer strip), then stop.
# Skip 3.5 entirely.
```

### 4.4 Recommended default: skip pass 2 anyway

Of the three changes this rewrite makes, only two are load-bearing: removing `.claude/`
and stripping the trailer. **The rename is cosmetic.** The file genuinely was renamed at
that commit, so leaving it is honest history, not a defect — `git log --follow AGENTS.md`
traverses the rename correctly either way.

Pass 2 was worth attempting when that commit was the tip and a failure was one `--amend`
away from repair. It no longer is. Unless you specifically want `AGENTS.md` to appear
under that name from `2305f4b` onward, **run pass 1 and stop.**

If you do skip it, the §3.6 verification reduces to:

```bash
git log --all --format='%h %s' --name-only -- .claude    # expect: no output
git log --format='%B' | grep -iE 'co-authored-by|claude-session|generated with'
                                                          # expect: no output, exit 1
git cat-file -e HEAD:AGENTS.md && echo "AGENTS.md present at tip: OK"
```

---

## 5. Expected before / after

Stated as per-commit changes rather than a full log, because the tip moves.

### The two commits that change

**`2305f4b docs: interface design handover (workstream 001)`**

| | Before | After |
|---|---|---|
| `.claude/settings.local.json` | `3 +` | gone |
| `CLAUDE.md` | `9 +` | renamed to `AGENTS.md`, same 9 lines |
| files changed | 9 | 8 |
| insertions | 8629 | 8626 |
| message | ends `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` | ends after the "Key decisions" paragraph, no trailer |

Everything else in that commit — `design.pen`, the five 001 documents, the PNG — is untouched.

**`8f27b02 chore: repo hygiene and agent instruction law`**

| | Before | After |
|---|---|---|
| `.claude/settings.local.json` | `3 ---` | gone |
| `CLAUDE.md` | `9 ---` | gone (it was never created, so there is nothing to delete) |
| `AGENTS.md` | `47 +` | `47 ++---` — a modification of the file `2305f4b` now creates |
| files changed | 3 | 1 |

### What must NOT change

- **`1efe77e`, `92c5e41` and `2516827` keep their exact hashes.** They predate the first
  commit the rewrite touches. Verify with `git rev-parse`:
  ```bash
  git rev-parse 1efe77e^{commit} 92c5e41^{commit} 2516827^{commit}
  ```
- **`design.pen` is byte-identical at every commit.** Verify against the pre-rewrite clone:
  ```bash
  git -C ~/code/webPod rev-parse HEAD:design.pen
  git -C ~/code/webPod-rewrite rev-parse HEAD:design.pen    # must match
  ```
- **The commit count is unchanged.** The rewrite drops no commit:
  ```bash
  test "$(git rev-list --count HEAD)" = "$BEFORE_COUNT" && echo "count unchanged: OK"
  ```
- **Every commit from `2305f4b` onward gets a new hash.** That is expected, not a fault.
- **No commit anywhere gains or keeps a banned trailer:**
  ```bash
  git log --format='%B' | grep -iE 'co-authored-by|claude-session|generated with'
                                                              # expect: no output, exit 1
  ```

## 6. Publishing — owner only

The rewrite changes `2305f4b`. Confirm at the time you run it that `origin/main` is still
at or after that commit — if it is, the published history is being rewritten and a plain
push cannot express it:

```bash
git fetch origin
git rev-parse origin/main
git merge-base --is-ancestor 2305f4b origin/main \
  && echo "origin/main contains a commit this rewrite changes -> force-push required"
```

At the time of writing `origin/main` was exactly `2305f4b`, with every commit after it
unpushed. So publishing is a force-push to `git@github.com:NeuveAI/webPod.git`, which **only the owner
may perform**. For reference, and deliberately not run here:

```bash
cd ~/code/webPod-rewrite
git remote add origin git@github.com:NeuveAI/webPod.git
git push --force-with-lease origin main
```

Anyone else holding a clone re-clones afterwards; a `git pull` onto the old history will
re-introduce the removed blobs.

Note that removing `.claude/` from this repo's history does not remove it from GitHub's
storage: the old objects survive until GitHub garbage-collects, and remain reachable through
any existing PR ref, fork, or cached view. If the contents of `.claude/settings.local.json`
were sensitive, rotating whatever it contains matters more than the rewrite does. (Inspected:
it holds local tool-permission settings, no credentials.)
