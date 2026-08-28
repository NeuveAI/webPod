# Dispatch packet — W0 · bun monorepo scaffold, tokens, repo hygiene

**Status:** `Ready` · **Lane:** L-A · **Blocks:** W1, W2, W3, W4, W5a · **Blocked by:** nothing

## Mandatory reading before you write a line

1. `docs/workstreams/002-implementation-spine/scope.md` — in full
2. `docs/workstreams/002-implementation-spine/literature.md` — your rows: bun, shadcn/Tailwind v4, TanStack Start, the start-monorepo template
3. `docs/workstreams/001-interface-design-handover/readme.md` — the six hard rules
4. `docs/workstreams/001-interface-design-handover/design-system.md` §12.1 — the token export you are transcribing
5. `CLAUDE.md` (repo root) and `~/.claude/CLAUDE.md`

## Correctness target

A bun-workspace monorepo that installs, typechecks and dev-serves, with every package skeleton in place so no later lane ever edits shared config; the design system's tokens live in one package as the single source of colour, type, spacing, radius, duration and easing; and the repo's agent instructions carry the new standing laws.

## Slices

### W0.1 — Monorepo scaffold
- bun workspaces via root `package.json` `"workspaces"`. **No pnpm, no turbo** (H-4). `~/code/agentic-context/ui/templates/start-monorepo` is a **layout reference only** — read it, do not copy it; it is pnpm+turbo.
- TanStack Start app at `apps/web`, grounded in `~/code/agentic-context/tanstack/router/examples/react/start-basic` and the Start docs. **`.validator(…)`, never `.inputValidator(…)`.**
- Tailwind v4 with `@theme`, per `~/code/agentic-context/ui/apps/v4/app/globals.css`. shadcn per `ui/apps/v4/components.json`. **No `tailwind.config.js`** — v3 muscle memory produces one that does nothing.
- Create **every** package skeleton — `package.json`, `tsconfig.json`, `src/index.ts` stub, and nothing more: `packages/{tokens,ui,state,providers,panel,device,tools,server-core}`. This is the conflict-avoidance mechanism for four concurrent lanes; do not skip a package because it is empty in 002.
- Root `tsconfig` base with strict settings. Per-package tsconfig extends it. The gate is per-package: `bunx tsc --noEmit -p <pkg>/tsconfig.json`.
- Scripts: `dev`, `build`, `typecheck` (loops packages), `lint`, `test`, and a `gates` placeholder that exits non-zero with "not implemented" until W5a lands.

**Verification:** `bun install` clean · `bun run typecheck` clean for all 9 packages · `bun dev` serves a route · `bun test` runs (zero tests is fine).
**Evidence:** `evidence/w0-install.txt`, `evidence/w0-typecheck.txt`.

### W0.2 — Repo hygiene and the standing laws (H-1, non-destructive half)
- `git mv CLAUDE.md AGENTS.md`. Create `CLAUDE.md` as a **symlink** to `AGENTS.md` (`ln -s AGENTS.md CLAUDE.md`) and add `CLAUDE.md` to `.gitignore`.
- Write `.gitignore`: `node_modules/`, `dist/`, `.output/`, `.vinxi/`, `.tanstack/`, `*.log`, `.DS_Store`, `.env*`, `.claude/`, `CLAUDE.md`.
- `git rm -r --cached .claude` so it stops being tracked going forward.
- Extend `AGENTS.md` with a **Repo law** section containing, verbatim in substance:
  - **No commit trailers.** No `Co-Authored-By`, no `Claude-Session`, no "Generated with" footer. Commit messages state intent and affected surface, nothing else.
  - **No agent ever force-pushes.** `git push --force`, `--force-with-lease`, `filter-repo`/`filter-branch` against a pushed branch are **owner-only, always**. An agent may prepare a rewrite and print the commands; the owner runs them. This is standing law, not a grantable per-task permission.
  - **`design.pen` is encrypted** — pencil MCP tools only, never `Read`/`Grep`/edit. *(already present; keep it)*
  - **Ground library work in `~/code/agentic-context/`**, not recall. *(already present; keep it)*
  - **Workstreams live in `docs/workstreams/NNN-name/`** and are the initiative tracker for this repo. There is no Kanban board and no `neuve` shell — do not ask for tickets.
  - **`bun`/`bunx` only.** Never `npm`, `npx`, `pnpm`, `yarn`.
  - Keep the file constitutional: repo-wide facts only, no per-task detail.
- **Then stop.** Do **not** run any history rewrite. Instead write `evidence/w0-history-rewrite-plan.md` containing the exact `git filter-repo` invocation to strip `.claude/` and rename `CLAUDE.md`→`AGENTS.md` across all 4 commits, the trailer-stripping `--message-callback`, the expected before/after `git log --stat`, and a one-line note that `origin/main` is already at `2305f4b` so this requires a force-push **the owner performs**.

**Verification:** `AGENTS.md` tracked, `CLAUDE.md` an untracked symlink resolving to it, `git ls-files | grep -i claude` returns `AGENTS.md` only, `git status` clean of `.claude`.
**Evidence:** `evidence/w0-hygiene.txt`, `evidence/w0-history-rewrite-plan.md`.

### W0.3 — `packages/tokens`
- Transcribe design-system §12.1's `globals.css` **exactly**. It is the canvas-reconciled export (§12.0: "canvas wins") — if a number looks wrong, log it in your decision file and ask; do not correct it.
- Export the numeric geometry constants from §12.0/§14.2 as typed TS so the device and panel lanes consume one source: `HALO`, `TRAIL`, `wheelR: 115`, body `330×552`, Select `r42`/lip `46`, label band `r77–79`, panel `272×204`.
- Both colourways defined at the token layer. Light is an inversion of **polarity, not hue**.
- shadcn semantic mapping per design-system §12.2.

**Verification:** unit test asserting the geometry constants match the §12.0 table exactly (`wheelR/bodyW === 0.697` to 3dp); `bunx tsc --noEmit -p packages/tokens/tsconfig.json`.
**Evidence:** `evidence/w0-tokens-test.txt`.

## Guardrails

**In scope:** root config, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, all package skeletons, `packages/tokens/**`, `apps/web` scaffold, `package.json` scripts.
**Out of bounds:** any `src/` beyond the one-line stub in packages you do not own · `docs/workstreams/001-*` (read-only) · `design.pen` · `~/code/agentic-context/**` (read-only reference clones) · **any history rewrite or push of any kind**.
**Forbidden commands:** `npm`, `npx`, `pnpm`, `yarn`, git worktrees, any `git push`, any `filter-repo`/`filter-branch`.

## Type / lint / doc gates
No `any`, no unchecked casts, no non-null assertion without a named guard, no lint disable without a logged invariant. TSDoc on every exported token helper — say what the number *is* and where it came from (cite the §), not what its name already says.

## Decision rules
- **Decide freely:** file names within your packages, script naming, test-case names.
- **Proceed but log** in `decisions/w0.md`: any deviation from a §12.1 value, any place a clone disagreed with 001, any dependency version pinned differently than the clone's inventory.
- **Stop and ask the lead:** anything requiring a `useState`, a canvas in the panel, a change to the package layout, or any git operation touching history or the remote.

## Commit plan
1. `chore: bun workspace scaffold`
2. `chore: repo hygiene and agent instruction law`
3. `feat(tokens): design system tokens`

Each typechecks on its own. **No trailers of any kind.**

## Artifacts you must write
- Diary: `docs/workstreams/002-implementation-spine/diary/w0.md`
- Decisions: `docs/workstreams/002-implementation-spine/decisions/w0.md`
- Evidence: `docs/workstreams/002-implementation-spine/evidence/w0-*`

## Definition of done
`bun install`, `bun run typecheck` (all 9 packages), `bun dev`, `bun test` all pass · hygiene verified · tokens test green · diary, decisions and evidence written · **you stay running for the review loop; do not consider yourself finished at APPROVE-time until the lead says so.**

## Review
Lane L-A. Reviewer loads `review-system-prompt.md` and will independently re-run every command above. Sharpest question aimed at you: *does a planted violation actually make the gate go red?*
