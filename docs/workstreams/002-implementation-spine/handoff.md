# 002 — Owner handoff

**State:** implementation and independent review complete; owner validation and
owner-operated history repair remain.

This handoff reconciles the current repository rather than repeating teammate
reports. The audited committed tip was
`4668475dc0c4cdc6da4deb2ca28a703c88d28dd3`; this documentation-only handoff
commit is its successor.

## What is complete

- Every implementation slice in `tracker.md` is independently approved.
- W4's Pencil-first material hierarchy, geometry and evidence boundary received
  a final **0 Critical / 0 Major / 0 Minor** verdict in
  `reviews/w4-conflict-review.md`, committed as `096be68`.
- W7's device, composite and panel seams each received a final **0 / 0 / 0**
  verdict in the three `click-wheel-*-review.md` files.
- The canonical-evidence path gate received a final approval in
  `reviews/fe5c309-gate-exemption-review.md`, committed as `4668475`.
- U15's unsupported-control absence has been inspected through the approved
  provider, panel and click-wheel review lanes. The gate runner continues to
  label it manual because it cannot automate reviewer judgment.

## Verification at the handoff boundary

Two runs were made on 2026-08-29:

1. The ordinary working tree, while preserving all intentional local artifacts.
2. A disposable local clone at committed tip `4668475`, retaining the Git object
   database required by the W7 provenance tests while excluding every dirty
   working-tree artifact.

Both produced:

| Check | Result |
|---|---|
| `bun run typecheck` | **11/11 projects clean** |
| `bun run lint` | exit 0 |
| `bun test` | **939 pass / 0 fail**, 50 files |
| `bun run gates` | **16 automated pass / 0 fail**; U14 and U15 reported manual |
| `bun run build` | client and SSR builds pass |

The client build emits the existing large-chunk advisory; it is not a failed
gate. Tool-command assumptions were checked against
`/Users/vinicius/code/agentic-context/bun`; the repository's package scripts are
the executable source of truth.

## Preserved working-tree artifacts

These are intentionally outside this handoff commit.

### Modified, preserved

The seven files below are formatting-only churn previously classified by an
independent read-only audit. They remain unstaged and uncommitted because
committing them would obscure W0's exact token provenance:

- `packages/tokens/src/fx.ts`
- `packages/tokens/src/geometry.test.ts`
- `packages/tokens/src/geometry.ts`
- `packages/tokens/src/globals.css`
- `packages/tokens/src/index.ts`
- `packages/tokens/src/motion.ts`
- `packages/tokens/src/tokens-parity.test.ts`

### Untracked, preserved

Four superseded W4 calibration captures:

- `evidence/w4-baseline-white-front.png`
- `evidence/w4-crown-max-black-front.png`
- `evidence/w4-crown-max-steel-back.png`
- `evidence/w4-crown-max-white-front.png`

Seven superseded/intermediate W6 captures:

- `evidence/w6-composite-black-final.png`
- `evidence/w6-composite-black.png`
- `evidence/w6-composite-white-final.png`
- `evidence/w6-dynamic-130-composited.png`
- `evidence/w6-dynamic-200-composited.png`
- `evidence/w6-resize-aligned-final.png`
- `evidence/w6-resize-aligned.png`

None is required by the final approved evidence set. They remain local because
deleting collaborator data requires an owner decision. Do not stage them into a
history-repair clone.

At closeout, `evidence/final-u15-browser/` also appeared as an untracked capture
set owned by a concurrent browser-review lane. This handoff neither classifies
nor consumes it; preserve it for that owner and keep it out of this commit.

## H-1 history-rewrite audit

No rewrite or publication action was run during closeout. The governing law is
D-003 and `AGENTS.md`: an agent prepares; the owner executes.

### Current facts, independently rechecked

- `2305f4b` is still an ancestor and the earliest commit touching `.claude/` or
  historical `CLAUDE.md`.
- `2305f4b` is still the only commit containing a banned attribution trailer.
- `55b34dd` is still an ancestor and still mixes S2's four paths with S1 and W2.
- The current tip tracks `AGENTS.md`; local `CLAUDE.md -> AGENTS.md` is an
  untracked symlink; `.gitignore` ignores both `CLAUDE.md` and `.claude/`.
- `origin/main` remains at `2305f4b`; the audited local tip was 202 commits
  ahead before this documentation commit.
- `git-filter-repo` is still not installed.

### Plan quality and composition

`evidence/w0-history-rewrite-plan.md` is now the **single authoritative owner
sequence**. It contains concrete absolute paths and refs, records source and
remote state outside the clones, performs S2 first, and permits W0 pass 1 only
after W0 `HEAD` equals the recorded S2 output tip/tree/count and all three split
commits are verified ancestors. It never reclones or resets W0 from the original
repository or remote. `evidence/s2-history-rewrite-amendment.md` remains the
review source for the split's exact path boundaries, but explicitly delegates
execution and composition to the W0 plan.

The authoritative sequence is:

1. Preserve the intentional dirty artifacts, capture committed local `main` and
   exact live `origin/main`, and write their OIDs to the external state file.
2. Clone local `main` once into the fixed S2 path. Split `55b34dd`, prove the
   final tree is unchanged and count is source + 2, record the three split OIDs,
   and keep the backup branch/tag through post-publication verification.
3. Clone the fixed W0 path **from the verified S2 path**. Require exact equality
   with the recorded S2 tip/tree/count plus split ancestry before pass 1.
4. H-1 explicitly requires the historical rename, so execute W0 pass 2 and run
   the whole-history descendant check in W0 §4. If it fails, stop and create a
   new W0 destination from the untouched verified S2 source rather than amending
   a descendant or omitting the rename.
5. Before rebinding evidence, require: the rewritten base tree equals the
   verified S2/source tree; its count equals the S2 count; the three
   pre-`2305f4b` hashes remain unchanged; `design.pen` is byte-identical; no
   `.claude/`, historical `CLAUDE.md`, or banned trailer anywhere; `AGENTS.md`
   is present through the intended history; and the rewritten W7 reviewed
   commit is uniquely identified by its unchanged reviewed tree and subject.
6. Regenerate W7's immutable browser evidence with the existing producer bound
   to that rewritten reviewed commit. Run the existing 9-test schema suite,
   which mutates commit, tree, digest and count, then create one evidence-only
   commit touching exactly `w7-browser.json` and `w7-browser-provenance.md`.
   Record the resulting final tip/tree/count, require count = S2 count + 1,
   prove runtime source is unchanged, restore the ignored local symlink, and run
   typecheck, lint, all tests, 16 gates, and `bun run build` (client + SSR).
7. After `git-filter-repo` removes `origin`, re-add and verify its URL in W0,
   fetch exact `main`, and require fetched and live OIDs to equal the remote OID
   captured before rewriting. Then stop at the prepared owner-only command,
   which uses
   `--force-with-lease=refs/heads/main:<captured-expected-oid>` and an explicit
   `refs/heads/main:refs/heads/main` refspec.

Recovery is deliberately redundant: the original repository remains untouched,
the S2 procedure creates backup refs, and either failed rewrite is abandoned in
its disposable clone. Existing collaborators must re-clone after publication;
pulling the old lineage can reintroduce removed objects.

The complete chain was replayed from scratch in disposable clones with official
`git-filter-repo`; the explicit lease was exercised only with `--dry-run`
against a disposable bare remote. After the evidence-only commit, the final
fixture was 214 commits at tip `d6775815b1020416fa7020943349be49b6a925e0`
and tree `a172ff9e065e3194c012e43b5f25efb81793991a`. It passed 11/11
typechecks, lint, 941 tests, all 16 automated gates, and the combined client+SSR
`bun run build`; moving the remote made both the OID preflight and explicit
lease reject stale state. Exact commands and results are in
`evidence/final-history-rewrite-dry-run.md`. No authoritative rewrite or push
occurred.

## Exact remaining owner actions

### 1. U14 / H-5 — phone in hand

Expose the development server to the phone on the local network and open `/` in
the flagged Chrome profile. Hold the phone normally and drive the production
click-wheel annulus with the thumb through slow movement, a fast flick, reversal,
Select, Menu, Previous and Next. Pass only if informational feedback remains
visible outside the thumb's ±33° inner-ring contact patch and navigation remains
legible throughout. Record pass/fail in `tracker.md`; a desktop simulation cannot
clear this gate.

### 2. H-6 — aesthetic acceptance

Review both panel colourways at the authored 272×204 size and the black front,
white front and steel back at `/_spike/device`. Compare against the saved Pencil
component `VWaJS` and artboards `A76Ib`, `H4QpB` and `DLqSo`. Decide all three:

- the device reads as the intended iPod rather than a toy;
- panel type is legible and correctly weighted at 272×204 in both colourways;
- light mode is an inverted polarity, not an inverted hue.

Record an explicit pass or the exact rejected surface. H-6 is judgment, not a
gate a teammate or screenshot digest can clear.

### 3. H-1 — owner-operated history repair

Run the reconciled two-stage procedure above, using the two prepared evidence
documents. Stop and recover on any invariant or tree-equivalence failure. The
owner alone performs publication and collaborator coordination.

### Optional, not an MVP blocker: H-10

The MusicKit write probe remains authorised but unrun because it requires the
owner's interactive sign-in and a Music User Token. It can close documentary
uncertainty around playlist removal/reordering, but 002 registers no tools or
playlist-edit UI, so it does not block this MVP handoff.

## Release boundary

This handoff closes the T1-first MVP, not the later flag-off public release.
RISK-01 remains accepted and open: T2–T4 fallbacks/polyfills are intentionally a
later workstream, exactly as the owner directed. A user-facing release still
requires those tiers and the full flag-off §15 validation.
