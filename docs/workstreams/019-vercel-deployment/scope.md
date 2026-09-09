# Vercel deployment preparation

Status: Ready for packaging; guarded for production deployment (2026-09-09).

Follow-up scope: the user requested fixing the failed deployment. Public SSR
must return 200 when integrations are absent; sticker operations must retain
their explicit 503 failure and ephemeral-storage rejection. Remove the launcher's
eager storage validation, test this in an isolated production process, redeploy,
and verify actual HTTP responses. Do not claim playback or persistence works
without configuring and verifying those integrations.

## Correctness and scope

Prepare a reproducible Bun 1.4 container build that runs the existing TanStack
Start handler, includes generated sticker assets, listens on Vercel's port, and
excludes credentials and local state from uploads and image layers. Preserve
all player and sticker behavior. Do not publish or provision paid infrastructure.

The user explicitly requested deployment preparation and current research,
including native Bun and container support. Routine packaging is authorized.
Database provider preference has been requested asynchronously. No storage
migration or disabling of stickers is implied by packaging.

## Sources and decisions

- Primary: user request and root AGENTS.md.
- Primary: current Vercel Bun, container-image, and TanStack Start documentation;
  exact links and findings belong in `research.md` beside this file.
- Current behavior: `apps/web/scripts/start.ts`, `apps/web/vite.config.ts`,
  `packages/server-core/src/stickers/{database,repository,sessions}.ts`.
- Installed canonical boundary: `@tanstack/react-start` 1.168.49 server entry;
  local Bun 1.4.0. Reuse existing fetch handler and Bun transport.
- Supporting: `/Users/vinicius/code/agentic-context/bun/docs/guides/ecosystem/docker.mdx`
  and the TanStack router hosting guide in that same reference root.
- Missing: the AGENTS.md reference root `.better-coding-agents/resources` and
  global-patterns' `~/code/agent-context/global.md` are absent. The available
  reference root above and installed packages supply library evidence.
- Anti-source: cached search snippets claiming Bun.serve is unsupported or that
  `1.x` is the only native Bun selector. Direct current docs supersede them.

## Decomposition and verification

| Slice | Write scope | Proof | Suggested commit |
| --- | --- | --- | --- |
| Research and runbook | This workstream, docs/deployment.md | Compare direct primary docs with installed app | Document Vercel deployment constraints |
| Container packaging | Dockerfile.vercel, ignore files | Frozen install, production build, image smoke if Docker works | Package webPod for Bun container hosting |
| Stateless-storage guard | Sticker runtime and its tests | Reject Vercel local SQLite, retain private local paths | Prevent ephemeral sticker storage on Vercel |

Sequential dependency: research → packaging → build → production HTTP test.
No independent agents are being dispatched. Review lanes: deployment packaging,
credential exclusion, state durability. Evidence and review outcome go in
`verification.md`; implementation decisions and handover go in `research.md`
and `docs/deployment.md`. No commits are required in this preparation turn.

## Gates and definition of done

- Run `bun run build`, `bun run typecheck`, targeted ESLint, and production
  transport/runtime tests. No UI changes; visual proof is not applicable.
- Validate Docker build and HTTP smoke when the local daemon is available;
  record any missing infrastructure verification explicitly.
- Use existing canonical types; no new schema wrappers, unsafe casts or ignores.
- Runtime secrets never enter image context, logs, browser files, or artifacts.
- Production readiness requires an external database migration and runtime key
  provisioning. A built image alone is not evidence of durable operation.
- Actual Vercel preview, MusicKit domain setup, production promotion, account
  selection and secret provisioning remain owner setup steps.

## Open decisions

Database provider is open; recommend only after examining transaction semantics.
The existing repository uses synchronous transactions, so remote SQLite is not
a drop-in URL change. Credentials must continue to be read through an absolute
runtime path; do not embed the local key or fabricate a secret mount feature.
Never inspect `cert/`, encrypted design.pen, or unrelated workstream contents.
