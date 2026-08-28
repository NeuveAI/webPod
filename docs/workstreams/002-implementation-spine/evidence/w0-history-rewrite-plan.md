# W0.2 — history rewrite: prepared, NOT run

**Status: prepared and stopped.** Nothing in this file has been executed. Per repo law in
`AGENTS.md`, an agent may prepare a rewrite and print the commands; the owner runs them.

> `origin/main` is already at `2305f4b`, and that commit is one of the ones this rewrite
> changes. Publishing the result therefore requires a **force-push, which the owner performs.**

---

## 1. What the rewrite has to do

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

The tip commit `8f27b02` contains **both** a delete of `CLAUDE.md` and a create of `AGENTS.md`.
After `--path-rename CLAUDE.md:AGENTS.md` that single commit holds two changes for the same
path — one delete, one create — and which of them survives depends on how `filter-repo`
de-duplicates them. If the delete wins, **`AGENTS.md` vanishes at the tip** while every earlier
commit still has it, which is a silently wrong result rather than an error.

`git cat-file -e HEAD:AGENTS.md` in step 3.6 is the check that catches it. If it fails:

```bash
# Restore the file at the tip from the content that is already correct in the parent,
# then amend. This does not need another filter-repo pass.
git checkout HEAD~1 -- AGENTS.md 2>/dev/null || git show 8f27b02:AGENTS.md > AGENTS.md
git add AGENTS.md
git commit --amend --no-edit
git cat-file -e HEAD:AGENTS.md && echo "fixed"
```

Alternative if you would rather not risk it at all: skip pass 2 entirely. The rename at
`8f27b02` is honest history — the file genuinely was renamed at that commit — and only the
`.claude/` removal and the trailer strip are load-bearing.

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
