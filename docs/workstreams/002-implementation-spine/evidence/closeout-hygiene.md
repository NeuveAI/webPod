# MVP closeout hygiene audit

**Date:** 2026-08-29

## W6 image classification

Seven untracked PNGs are preserved but deliberately excluded from the closeout
commit:

- `w6-composite-black.png`
- `w6-composite-black-final.png`
- `w6-composite-white-final.png`
- `w6-dynamic-130-composited.png`
- `w6-dynamic-200-composited.png`
- `w6-resize-aligned.png`
- `w6-resize-aligned-final.png`

They are intermediate captures from 2026-08-28/29. None is referenced by the
approved W6 evidence. The durable, tracked evidence is
`w6-composite-black-review.png`, `w6-composite-white-review.png`, and
`w6-resize-hit-test-review.png`, which are named by `w6-axe-composited.txt` and
`w6-geometry-lifecycle.txt`. The earlier W6 review mentions
`w6-composite-black.png` only to identify an untracked correction candidate,
before the final `*-review.png` captures were produced.

**Recommendation:** after owner confirmation, delete the seven intermediate
captures rather than committing duplicate visual evidence. They remain untouched
for now because they are user/collaborator data and deletion was not authorised.

## Generated browser output

`apps/web/tests/test-results/` contains Playwright scratch state, currently only
`.last-run.json`. The directory is ignored. Durable browser evidence remains in
the workstream evidence directory.

`packages/panel/test-results/` is likewise active panel-E2E runner output. It is
ignored with its own scoped entry and preserved locally; no panel source or test
implementation is part of this hygiene commit.

## History rewrite posture

`evidence/w0-history-rewrite-plan.md` remains prepared and unexecuted. The branch
still contains the original `2305f4b` trailer, while newer commits contain no
matching attribution trailers. Repo law requires the owner—not an agent—to run
the prepared rewrite and any resulting force-push.
