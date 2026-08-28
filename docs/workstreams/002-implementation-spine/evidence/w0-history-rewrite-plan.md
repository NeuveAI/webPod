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

```bash
# 3.0 — starting point. Confirm main is at the tip you expect before cloning.
cd ~/code/webPod
git log --format='%h %s' -6
#   8f27b02 chore: repo hygiene and agent instruction law
#   9e65a48 chore: bun workspace scaffold
#   2305f4b docs: interface design handover (workstream 001)
#   2516827 design: refinements
#   92c5e41 design: cleanup and improvements
#   1efe77e design: add base design.pen and some exported frames

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

### Before

```
$ git log --format='%h %s' --stat
8f27b02 chore: repo hygiene and agent instruction law
 .claude/settings.local.json |  3 ---
 AGENTS.md                   | 47 +++++++++++++++++++++++++++++++++++++++++++++
 CLAUDE.md                   |  9 ---------
 3 files changed, 47 insertions(+), 12 deletions(-)

9e65a48 chore: bun workspace scaffold
 43 files changed, 1277 insertions(+)

2305f4b docs: interface design handover (workstream 001)
 .claude/settings.local.json                        |    3 +
 CLAUDE.md                                          |    9 +
 design.pen                                         | 2536 +++++++----------
 .../001-interface-design-handover/design-system.md | 2985 ++++++++++++++++++++
 .../001-interface-design-handover/handover.html    |  765 +++++
 .../001-interface-design-handover/pm-spec.md       | 2180 ++++++++++++++
 .../001-interface-design-handover/readme.md        |  131 +
 .../stack-research.md                              | 1521 ++++++++++
 images/generated-1787847078990.png                 |  Bin 0 -> 745448 bytes
 9 files changed, 8629 insertions(+), 1501 deletions(-)

2516827 design: refinements               1 file changed
92c5e41 design: cleanup and improvements  1 file changed
1efe77e design: add base design.pen ...   4 files changed
```

Commit `2305f4b`'s message ends with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

### After

```
<new-hash> chore: repo hygiene and agent instruction law
 AGENTS.md | 47 ++++++++++++++++++++++++++++++++++--------------
 1 file changed                       # no .claude, no CLAUDE.md; AGENTS.md modified in place

<new-hash> chore: bun workspace scaffold
 43 files changed, 1277 insertions(+)  # unchanged

<new-hash> docs: interface design handover (workstream 001)
 AGENTS.md                                          |    9 +      # was CLAUDE.md
 design.pen                                         | 2536 +++++++----------
 .../001-interface-design-handover/design-system.md | 2985 ++++++++++++++++++++
 .../001-interface-design-handover/handover.html    |  765 +++++
 .../001-interface-design-handover/pm-spec.md       | 2180 ++++++++++++++
 .../001-interface-design-handover/readme.md        |  131 +
 .../stack-research.md                              | 1521 ++++++++++
 images/generated-1787847078990.png                 |  Bin 0 -> 745448 bytes
 8 files changed, 8626 insertions(+), 1501 deletions(-)   # -1 file, -3 lines: .claude gone

2516827 design: refinements               # hash UNCHANGED
92c5e41 design: cleanup and improvements  # hash UNCHANGED
1efe77e design: add base design.pen ...   # hash UNCHANGED
```

`2305f4b`'s message ends after the "Key decisions" paragraph, with no trailer.

---

## 6. Publishing — owner only

The rewrite changes `2305f4b`, which `origin/main` currently points at:

```
$ git show-ref
8f27b0257555e93b3990271ec6d6ba7ab84ff40e refs/heads/main
2305f4bbb09a42a07d872019d31a58c4ef3d98d8 refs/remotes/origin/main
```

So publishing it is a force-push to `git@github.com:NeuveAI/webPod.git`, which **only the owner
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
