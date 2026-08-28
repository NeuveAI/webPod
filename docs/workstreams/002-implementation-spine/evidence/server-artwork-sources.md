# Server artwork source record

All library/runtime claims were checked against
`/Users/vinicius/code/agentic-context/`.

| Concern | Exact source | Finding used |
|---|---|---|
| Effect version | `effect/packages/effect/package.json` | `4.0.0-rc.112` |
| Service injection | `effect/packages/effect/src/Context.ts:220-297` | `Context.Service` is effectful and retrieves its implementation from the fiber context |
| Effect composition | `effect/packages/effect/src/Effect.ts` exports at `tryPromise`, `match`, `provideService`, `runPromise` | Typed async boundary, dependency provision, and Promise handler boundary |
| Fetch transport boundary | `effect/packages/effect/src/unstable/http/FetchHttpClient.ts:20-117` | Fetch is injectable; request options and abort signal reach runtime fetch; behavior varies by runtime |
| Manual redirects in Bun | `bun/test/js/web/fetch/fetch.test.ts:673-691` | A 302 remains visible and `redirected` stays false with `redirect: "manual"` |
| Abort in Bun | `bun/test/js/web/fetch/fetch.tls.test.ts:959-975` | An abort signal terminates an active fetch/body read within its bound |
| Start server route | `tanstack/router/docs/start/framework/react/guide/server-routes.md:1-168` | A file route `server.handlers.GET` receives `Request` and returns raw `Response` |

The final decoder review invalidated in-process Sharp for this lifecycle. The
dependency and its source claims were removed, which also closes the review's
stale Sharp line-number Minor. The viability decision was grounded in Bun's
`docs/runtime/child-process.mdx:6-31,131-166,256-331`: `Bun.spawn` subprocesses
are async, killable and IPC-capable, but require a child entrypoint and explicit
lifecycle. No child-process decoder was shipped for this MVP.

Additional instruction sources read completely or to the relevant routed
reference:

- `/Users/vinicius/.agents/skills/effect-services/SKILL.md`
- `/Users/vinicius/.agents/skills/browser-security/SKILL.md`
- `/Users/vinicius/.agents/skills/browser-security/network-security.md`
- `/Users/vinicius/.agents/skills/browser-security/checklist.md`
- `/Users/vinicius/.agents/skills/modern-web-guidance/SKILL.md`
- retrieved modern-web-guidance `security` guide via `bunx`
- `/Users/vinicius/.agents/skills/tanstack-router/SKILL.md`
- `/Users/vinicius/.agents/skills/global-patterns/SKILL.md`

The skill references to `~/code/agent-context` were not followed because that
path is stale and conflicts with repo law. No source under that stale path was
used.
