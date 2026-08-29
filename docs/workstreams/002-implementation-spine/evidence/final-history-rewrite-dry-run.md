# Final history-rewrite dry-run evidence

Date: 2026-08-29

Scope: disposable local clones only. No authoritative branch was rewritten and
no remote push was executed. The publication checks used a disposable bare
repository and `git push --dry-run`.

## Tool and fixture

- Official `git-filter-repo` package revision reported: `a40bce548d2c`.
- Source: committed local `main` as it existed when the run began.
- Pre-rewrite remote-main fixture: `2305f4bbb09a42a07d872019d31a58c4ef3d98d8`.
- Source commit count: 209.

## S2 → W0 transfer

- Interactive S2 replay stopped at `55b34dd`, split the state, S1, and S2 path
  sets into the three prescribed commits, and replayed 200 rebase steps.
- S2 output count: 211, exactly source + 2.
- S2 output tree equals the source tree.
- The S1 split parent equals the state split; the S2 split parent equals the S1
  split.
- W0 was cloned from the S2 clone. Its input tip, tree, count, and all three
  split-commit ancestor checks matched before pass 1.

## W0 rewrite

- Pass 1 removed every `.claude/` history entry and every banned trailer.
- Pass 2 removed historical `CLAUDE.md`; `AGENTS.md` exists at the rename commit
  and every descendant.
- Final count remained 211.
- Final tree equals the verified S2 tree; `design.pen` has the same blob OID.
- `git-filter-repo` removed `origin`, reproducing the review's premise.

During the first descendant check, zsh interpreted `$commit:AGENTS.md` as a
parameter modifier. The plan was corrected to `${commit}:AGENTS.md`, then the
whole descendant sweep passed. This is why the evidence records command-level
execution rather than only intended invariants.

## Publication preparation

- Re-added a disposable `origin`, fetched exact `refs/heads/main` into
  `refs/remotes/origin/main`, and verified fetched and live OIDs both equalled
  the pre-rewrite expected OID.
- The exact explicit-lease command succeeded under `--dry-run` while the remote
  remained at that OID.
- The disposable remote was then advanced to a different OID. The preflight OID
  comparison rejected it, and the same explicit lease dry-run independently
  exited 1 with `(stale info)`.

These results prove both safety directions: the prepared command is executable
with freshly reconstructed lease data, and cannot publish over a remote that
moved after the expected OID was recorded.
