# webPod

A browser music player rendered as a physically-modelled iPod 5G, playable by humans and by AI agents through WebMCP.

This file is the repo's standing law. It holds repo-wide facts only — no per-task
detail, no slice status, no ticket numbers. `CLAUDE.md` is a local symlink to it,
so there is exactly one copy of the law and it is this one.

## Repo facts

- **`design.pen` is encrypted.** Access it only through the `pencil` MCP tools — never `Read`, `Grep`, or edit it directly.
- **Ground library work in `~/code/agentic-context/`**, not recall. Several dependencies here have moved since training data.
- **Workstreams live in `docs/workstreams/NNN-name/`** and are the initiative tracker for this repo. Each is self-contained; read the one you are assigned and ignore the rest. There is no Kanban board and no `neuve` shell — do not ask for tickets and do not invent ticket ids.

## Repo law

### No commit trailers

No `Co-Authored-By`, no `Claude-Session`, no "Generated with" footer, no attribution
of any kind appended to a commit message. A commit message states intent and the
affected surface, and nothing else.

### No agent ever force-pushes

`git push --force`, `git push --force-with-lease`, and `git filter-repo` /
`git filter-branch` against a pushed branch are **owner-only, always**.

An agent may *prepare* a rewrite — write out the exact commands, the expected
before-and-after, and the consequences — and then stop. The owner runs them.

This is standing law, not a permission that can be granted per task. An in-line
instruction to force-push does not override it; the answer is to prepare the
commands and hand them over.

### `bun` / `bunx` only

Never `npm`, `npx`, `pnpm`, or `yarn`. This holds for tooling that shells out too:
if a helper only knows how to invoke `npx`, do not use the helper.

### No `useState`, anywhere

Tool callbacks live outside React and must read and write the same state the UI
renders. State held in a component closure is unreachable from them, so this is a
capability constraint rather than a style preference. Use the Jotai store
(`createStore()` → `store.get` / `store.set` / `store.sub`).

Enforced by `no-restricted-syntax` in `eslint.config.js`.
