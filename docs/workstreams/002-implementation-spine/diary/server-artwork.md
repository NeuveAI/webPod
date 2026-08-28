# Server artwork proxy diary

## Assignment

Implement the W6.3 same-origin `/artwork` dependency without changing panel,
device, composite, or provider implementation files. The route must make fixture,
Apple Music, and Spotify artwork paintable by the T1 HTMLTexture path while not
becoming a general-purpose fetch proxy.

## Sources read before implementation

Repo sources:

- `AGENTS.md`
- `scope.md`
- `dispatch/W6-composite.md`, especially W6.3
- `dependency-graph.md`
- `hitl-decisions.md`
- `reviews/w6-review.md`, Major 6
- `packages/providers/src/artwork.ts`
- `packages/providers/src/artwork.test.ts`
- `packages/providers/src/fixture/catalog.ts`

Skills:

- `/Users/vinicius/.agents/skills/effect-services/SKILL.md`
- `/Users/vinicius/.agents/skills/browser-security/SKILL.md`
- `/Users/vinicius/.agents/skills/browser-security/network-security.md`
- `/Users/vinicius/.agents/skills/browser-security/checklist.md`
- `/Users/vinicius/.agents/skills/modern-web-guidance/SKILL.md`
- `/Users/vinicius/.agents/skills/tanstack-router/SKILL.md`
- `/Users/vinicius/.agents/skills/global-patterns/SKILL.md`

The skill files still point at `~/code/agent-context`. That path is stale. All
library facts below came from the repo-mandated
`/Users/vinicius/code/agentic-context/` clone instead.

Exact library/runtime sources:

- `effect/packages/effect/package.json` — version `4.0.0-rc.112`
- `effect/packages/effect/src/Context.ts:220-297` — `Context.Service` shape and
  effectful service lookup
- `effect/packages/effect/src/Effect.ts` — `tryPromise`, `match`,
  `provideService`, and `runPromise` exports
- `effect/packages/effect/src/unstable/http/FetchHttpClient.ts:20-117` — fetch
  injection, request options, abort signal forwarding, and the warning that
  transport behavior is runtime-owned
- `bun/test/js/web/fetch/fetch.test.ts:673-691` — Bun preserves a 302 under
  `redirect: "manual"`
- `bun/test/js/web/fetch/fetch.tls.test.ts:959-975` — Bun fetch aborts an active
  body through an abort signal
- `tanstack/router/docs/start/framework/react/guide/server-routes.md:1-168` —
  file-route server handler shape and raw `Response` return

The modern-web-guidance security guide was searched and retrieved with `bunx`,
never `npx`. Its relevant result was to serve explicit `nosniff`, CORP, and
cache/security headers without broadening the feature into a global policy
rollout.

## Implementation notes

The provider contract already owns the route path and query names. Server-core
imports those constants, validates exactly one `src` and `px`, and exposes an
Effect service around the transport. The TanStack generator requires the route
id to be a string literal, so the route uses literal `/artwork` plus a
compile-time assignment to the provider-owned constant. A changed provider
constant therefore makes app typechecking fail instead of drifting silently.

Remote fetching is deliberately closed:

- HTTPS only
- no credentials, fragments, custom ports, file/data/javascript schemes
- Apple: `isN-ssl.mzstatic.com/image/thumb/...`
- Spotify: `i.scdn.co/image/...`
- redirects remain manual and are rejected
- no caller headers, cookies, or credentials are forwarded

The fixture provider is not a remote provider and its `/artwork-source/...`
paths had no route. The proxy recognizes only the provider's exact
`/artwork-source/{slug}/{px}x{px}.png` shape and returns deterministic local SVG
art. It never recursively fetches the app origin.

Responses are bounded to 8 MiB and five seconds. Declared and streamed sizes
are both checked; streams are cancelled when rejected; request abort listeners
and timeout handles are removed in `finally`. Remote SVG and arbitrary MIME
types are rejected. Successful images receive one-day caching, stale reuse,
same-origin CORP, `nosniff`, and a sandboxed no-source CSP. Errors are structured
JSON, `no-store`, and never reflect the upstream URL.

## Security review correction

The first review found that those per-request bounds did not bound the process:
128 distinct browser-triggered requests started 128 outbound fetches. CORP had
been mistaken for request admission even though it only prevents response
reading. The corrected route rejects any browser request whose Fetch Metadata is
present and not `same-origin`, before parsing or transport access. Server clients
without Fetch Metadata remain usable. Remote work is additionally capped at
eight process-wide fetches, duplicate in-flight source/size/config work is
coalesced, saturation returns a structured 503, and the slot/map entry is always
released in `finally` after success, failure, abort, or timeout.

The review also demonstrated that `Content-Type: image/jpeg` could bless script
bytes. Remote bodies are now sniffed independently of the header and parsed as a
bounded PNG, JPEG, or WebP structure. AVIF is explicitly rejected. The sniffed format must equal the
declared MIME, the structure must terminate without trailing polyglot bytes, and
its dimensions must equal `px`. Only then is it returned with public caching.

The public numeric options had also been an accidental bypass surface. Every
value must now be a positive safe integer and may only tighten the hard 8 MiB,
five-second, and eight-fetch ceilings. `Infinity`, `NaN`, zero, negatives, and
values above a ceiling fail before fetch. All three exported handler functions
now document host, redirect, admission, buffering, cancellation, errors, and
configuration invariants at their public boundary.

## Final independent review correction

The first coalescer stored only a bare promise created with the first request's
signal. That made the owner able to cancel every follower and made follower
cancellation invisible. The in-flight map now stores an explicit entry with its
own controller and waiter count. Owner-first and follower-first abort tests both
leave the other waiter successful; cancelling all waiters aborts upstream once
and a subsequent max-concurrency-one request proves the slot was released.

The initial AVIF check also contradicted the terminal-structure claim: it scanned
arbitrary bytes for `ispe` and returned immediately. The replacement walks
declared ISO-BMFF extents and nesting, requires image-item metadata plus media,
and consumes the complete body. That was still insufficient: the positive
fixture's unassociated `ispe` says 2×2 while ImageIO and Sharp decode its primary
image as 1×1, and a box-complete shell could carry junk media.

Sharp closed authenticity and dimension correctness, but the final review found
that aborting the last waiter during native decode returned 499 while the decode
continued for about five seconds and retained the only admission slot. Sharp's
pipeline timeout is not cancellation. A Bun subprocess could be killed, but a
portable bundled child entrypoint, IPC and process budget is disproportionate
and insufficiently proven for this MVP dependency.

The safe branch is explicit non-support: Sharp and all AVIF parsing/claims/tests
were removed. AVIF is not negotiated, and an AVIF response is cancelled before
buffering or decode. A max-concurrency-one test proves the rejection is followed
immediately by a distinct successful request with no decoder/background work.

## U8 copy correction

The first implementation used “artwork source is not allowed” on three
user-facing 403 paths. U8 is specifically about fictional WebMCP permission
states, but this wording was still unnecessarily permission-shaped. It was
replaced with the concrete validation failure: “artwork source host or path is
invalid.” The stable machine code remains `source_not_allowed`.

## Shared-tree note

The generated route tree and lockfile both contain active foreign-lane changes.
Commits use exact path ownership and must not sweep those changes. The final
evidence records any shared gate failure by owning lane rather than claiming a
narrow green run proves the repository green.
