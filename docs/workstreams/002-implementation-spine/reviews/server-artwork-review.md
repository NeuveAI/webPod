# Review: W6.3a — same-origin artwork proxy

## Verdict: REQUEST_CHANGES

One Critical and three Major findings block approval. The route is genuinely
closed to the two provider host families, rejects redirects, keeps credentials
out of the client, and enforces the default byte/time bounds. Those positives do
not compensate for a public, cross-site-triggerable, unbounded outbound-fetch
surface or for accepting arbitrary bytes on the strength of an upstream MIME
header.

### Correctness Check

- **Source of truth:** `AGENTS.md` credential law; `scope.md` targets C and the
  type/lint/documentation gates; `dispatch/W6-composite.md` W6.3; provider
  `artworkUrl()`/`ARTWORK_PROXY_PATH`; `dependency-graph.md`; `hitl-decisions.md`;
  `review-system-prompt.md`; the server diary, SA-1…SA-7 decisions, and all four
  server-artwork evidence files.
- **Canonical runtime sources:** Effect clone
  `f356bc2da6abb4dee05b8c22fb597af3823e2ef7` (`Context.Service`,
  `Effect.tryPromise`, `provideService`, `match`, `runPromise`, and
  `unstable/http/FetchHttpClient.ts`); Bun clone
  `65362b53bb13317156aab6c35fb798702de88286` (manual redirects and active-body
  abort); TanStack Router clone
  `0dbb77f7260b4919786c2c3d594b8c262de43a9e` (file-route server handlers and raw
  `Response` returns). All were read under
  `/Users/vinicius/code/agentic-context/`, not the stale `agent-context` path.
- **Skills loaded:** strict-critique, browser-security, effect-services,
  modern-web-guidance (security guide searched/retrieved with `bunx`), and
  tanstack-router. The strict-critique companion review protocol and workstream
  framing were also consumed.
- **Correctness target:** fixture, Apple, and Spotify artwork must become
  same-origin and paintable without turning `/artwork` into a general fetch or
  resource-exhaustion proxy.
- **Dispatch scope:** the four commits change `packages/server-core`, the
  `/artwork` server route, package metadata, generated route metadata, lockfile,
  and the named server-artwork bookkeeping artifacts. No panel/device/composite
  implementation is included in the reviewed range.
- **Dependency/HITL status:** W1 owns the URL contract and is present. This
  server-only slice cannot clear U14 or the owner-only both-colourway aesthetic
  call. Neither is treated as approved here.
- **Kanban/Neuve:** not applicable by `AGENTS.md` and `scope.md:198-200`; this repo
  deliberately uses `tracker.md` and has no Neuve board or shell.
- **Credentials:** no reviewed implementation reads an environment variable,
  cookie, authorization header, token, key path, or `cert/`. I did not inspect or
  enumerate `cert/`. The production client bundle contains none of the proxy
  error/service identifiers checked. The artwork route does not touch the
  signing-key path, so the AGENTS Critical credential condition is not present.
- **Git history:** `d30e6f0`, `496234e`, `311be7a`, and `f10dd1e` are coherent,
  trailer-free commits. The reviewed implementation is unchanged between
  `f10dd1e` and the current tip.

### Findings

1. **[CRITICAL] The public route is an unbounded cross-site fetch, socket, memory,
   and egress amplifier**
   (`apps/web/src/routes/artwork.ts:8-12`,
   `packages/server-core/src/artwork-proxy.ts:192-226`,
   `packages/server-core/src/artwork-proxy.ts:229-271`,
   `packages/server-core/src/artwork-proxy.ts:303-350`). The route has no
   same-origin Fetch-Metadata check, rate limit, concurrency semaphore,
   in-flight request coalescing, or server-side bounded cache. CORP prevents a
   foreign page from reading the result; it does not prevent that page from
   causing the request. A live request carrying
   `Sec-Fetch-Site: cross-site`, `Sec-Fetch-Mode: no-cors`, and
   `Sec-Fetch-Dest: image` received `200` and ran the handler. An injected
   transport probe started **128/128 upstream fetches concurrently**. Each
   successful remote request may retain chunk arrays up to 8 MiB, allocate the
   final 8 MiB array, and then clone it again through `Uint8Array.from()` before
   constructing the response (`artwork-proxy.ts:203-225,274-276`). Attackers can
   bypass browser caching with unique allowed provider paths or query strings.
   This permits trivial process-memory, connection, provider-egress, and CPU
   exhaustion from another origin. The endpoint needs a reject-before-fetch
   same-origin policy where deployment permits it, plus bounded concurrency and
   request/cache coalescing or an equivalent server abuse budget; those controls
   need deterministic saturation and release-on-error/abort tests.

2. **[MAJOR] “MIME validation” trusts only the untrusted header and accepts
   arbitrary bytes as cacheable same-origin artwork**
   (`packages/server-core/src/artwork-proxy.ts:179-181`,
   `packages/server-core/src/artwork-proxy.ts:256-261`,
   `packages/server-core/src/artwork-proxy.ts:274-286`,
   `docs/workstreams/002-implementation-spine/diary/server-artwork.md:83-88`).
   The implementation checks `Content-Type` membership but never verifies an
   AVIF/JPEG/PNG/WebP signature, decodability, or dimensions. An independent
   transport returned the bytes `<script>alert(1)</script>` with
   `Content-Type: image/jpeg`; the proxy answered **200**, preserved
   `image/jpeg`, and marked the response publicly cacheable. `nosniff`, CORP,
   and the sandbox CSP reduce browser execution risk, but they do not turn those
   bytes into an image or prove the `px`/image-size contract. The diary's
   conclusion is therefore supported by a different, weaker reason than the
   one it states. Validate magic bytes and bounded image metadata (including
   dimensions) before emitting a successful cacheable response, and add
   lying-header/truncated/polyglot/dimension-mismatch tests.

3. **[MAJOR] The exported options can silently disable both security bounds**
   (`packages/server-core/src/artwork-proxy.ts:50-53`,
   `packages/server-core/src/artwork-proxy.ts:303-305`,
   `packages/server-core/src/artwork-proxy.ts:323-330`,
   `packages/server-core/src/artwork-proxy.ts:341-350`). `maxBytes` and
   `timeoutMs` accept every JavaScript number without a finite-positive upper
   bound. The nullish defaults do not protect explicit `Infinity`, `NaN`, zero,
   or negative values. A probe using the public `handleArtworkRequest` with
   `maxBytes: Infinity` successfully returned **9 MiB**, above the declared 8 MiB
   ceiling. Today the route passes no options, but the package exports this as a
   supported security-sensitive configuration boundary; a future caller or
   test harness can remove the guard without a type or runtime failure. Make
   unsafe configuration unrepresentable or validate it before any fetch, and
   prove invalid values cannot weaken the defaults.

4. **[MAJOR] The security-sensitive public API fails the workstream's mandatory
   documentation gate**
   (`packages/server-core/src/artwork-proxy.ts:139-156`,
   `packages/server-core/src/artwork-proxy.ts:303-339`,
   `packages/server-core/src/artwork-proxy.ts:341-350`,
   `packages/server-core/src/index.ts:1-15`, `scope.md:128-130`). The package
   exports `parseArtworkRequest`, `artworkProxyEffect`, and
   `handleArtworkRequest`, but none has TSDoc stating the closed-host invariant,
   redirect policy, buffering/resource behavior, cancellation semantics,
   failure mapping, or the security preconditions on `options`. This is not a
   cosmetic request: the unsafe options in Finding 3 are exactly the kind of
   footgun the mandatory major-function documentation rule exists to expose.
   Either reduce the public surface to what consumers need or document each
   exported boundary to the required behavior/invariant/error/lifecycle bar.

### Verified protections and non-findings

- URL parsing rejects userinfo, custom ports, fragments, schemes other than
  HTTPS, host suffix tricks, loopback/private/metadata literals, malformed
  fixture paths, duplicate parameters, and encoded traversal probes before the
  transport. URL normalization plus the exact fixed provider hostname checks
  leave no attacker-selected DNS hostname; DNS rebinding is therefore not an
  ordinary input bypass here. A compromise of an allowed provider's DNS/TLS is
  outside the route's attacker-controlled URL surface.
- `redirect: "manual"` is both implemented and observed by tests; every non-200
  response is rejected and its body cancelled. A private redirect target is not
  followed.
- The 8 MiB default is enforced while reading decompressed response chunks, not
  only from `Content-Length`. Overflow cancels the reader.
- A real local Bun fetch whose body stalled after headers returned the expected
  `504/upstream_timeout` in 34 ms under a 30 ms configured timeout, confirming
  the abort covers active body consumption rather than only connection setup.
- Request abort listeners and timeout handles are removed in `finally`; rejected
  upstream response bodies are cancelled.
- Error JSON does not reflect the source URL or underlying exception. Successful
  response header values are constants or validated MIME members, so no response
  header injection path was found.
- Fixture paths are parsed completely and generate in-memory SVG; no filesystem
  access, traversal, or symlink-following surface exists in that branch.
- The TanStack server handler returns the raw server response through the
  canonical route shape. Production client-bundle search found none of
  `source_not_allowed`, `ArtworkTransport`, `upstream_timeout`, proxy error copy,
  Effect HTTP identifiers, or credential markers.

### D-038 method audit

1. **Does a finding contradict the method used elsewhere?** No. I do not infer
   payload integrity from the same allowlist/header evidence I accept for host
   and response-type classification; the lying-header probe directly falsifies
   that broader inference. Likewise, passing default-bound tests is not used to
   endorse the unvalidated exported options.
2. **Does each endorsed conclusion's reason support it?** Yes, within its stated
   axis. Fixed normalized hostnames support resistance to attacker-selected-host
   SSRF; they do not support resource-abuse safety. Manual redirect behavior was
   measured through Bun. Active-body timeout behavior was measured through a
   real local Bun fetch. Credential isolation was established by dependency and
   bundle inspection without reading credential storage.
3. **Inconsistent cautions:** the implementation is strict about URL authority,
   redirects, byte count, and timeout, but treats content authenticity and
   admission/concurrency as trusted. No principle in SA-1…SA-7 justifies that
   asymmetry; Findings 1 and 2 are the inconsistency.

### Gates and probes run independently

- `bun test packages/server-core` → 36 passed, 0 failed.
- `bunx tsc --noEmit -p packages/server-core/tsconfig.json` → exit 0.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → exit 0.
- `bunx --bun eslint packages/server-core apps/web/src/routes/artwork.ts` → exit 0.
- `bun run --cwd apps/web build` → client and server builds passed; 207/370
  modules transformed.
- `bun run gates` → 11/11 projects, lint clean, 781 tests passed, all 16
  automated gates passed; U14/U15 remain manual.
- Live route on an isolated local dev server → fixture 200 with expected headers;
  encoded traversal/userinfo/trailing-dot/duplicate-param probes rejected;
  cross-site Fetch-Metadata request incorrectly accepted (Finding 1).
- Injected adversarial transport probes → 128 concurrent upstream calls admitted;
  fake JPEG body accepted; `maxBytes: Infinity` returned 9 MiB.
- Local real-Bun stalled-body probe → timeout aborted body consumption and
  returned 504.
- Commit messages for all four reviewed commits → no attribution trailers.

### Suggestions (non-blocking)

- Keep the fixed-host/manual-redirect model. It is substantially easier to
  reason about than a generic URL proxy plus an IP denylist, and the adversarial
  URL probes did not find a parser bypass.

---

# Re-review: W6.3a — same-origin artwork proxy fixes

## Verdict: REQUEST_CHANGES

The original Critical and three Majors are materially addressed, but two new
Major correctness defects remain in the exact seams introduced by the fixes.
The slice is not ready for approval.

### Correctness Check

- **Source of truth:** `AGENTS.md`; `scope.md` targets C and its type/lint/doc
  gates; `dispatch/W6-composite.md` W6.3; `dependency-graph.md`;
  `hitl-decisions.md`; D-014 and D-038 in `decision-log.md`; SA-8 through SA-10
  in `decisions/server-artwork.md`; the implementation diary and server-artwork
  evidence files.
- **Canonical sources:** Effect `f356bc2da6abb4dee05b8c22fb597af3823e2ef7`,
  Bun `65362b53bb13317156aab6c35fb798702de88286`, and TanStack Router
  `0dbb77f7260b4919786c2c3d594b8c262de43a9e` under
  `/Users/vinicius/code/agentic-context/`. The stale `agent-context` path named
  by `global-patterns` was not used because it conflicts with repo law.
- **Kanban/Neuve:** not applicable by `AGENTS.md` and `scope.md`; this repo uses
  `tracker.md` and has no board or Neuve shell.
- **Correctness target:** a same-origin fixture/Apple/Spotify artwork path that
  cannot become a general fetch or process-exhaustion proxy and that returns
  only validated image payloads with truthful request-cancellation behavior.
- **Dispatch scope:** all nine requested commits were inspected. Their code
  surface remains limited to `packages/server-core`, the TanStack `/artwork`
  route and required package/route metadata; documentation stays in the named
  workstream artifacts.
- **Dependency/HITL status:** W1's artwork URL contract is present. U14 and the
  both-colourway aesthetic judgment remain owner-only and are not claimed here.
- **DoD/review lane:** ordinary HTTP correctness and resilience were replayed
  independently. The server-only lane cannot clear the two manual product gates.
- **Type/lint/doc gates:** both affected TypeScript projects typecheck; scoped
  ESLint is clean; exported proxy boundaries now have useful lifecycle,
  admission, validation and error TSDoc. No unjustified implementation type
  escape, lint disable or initiative-name leak was found.
- **Git history/staging:** `d30e6f0`, `496234e`, `311be7a`, `f10dd1e`,
  `81adc14`, `73b896b`, `ccd642f`, `28ef25e` and `e4d7edf` are coherent and
  trailer-free. Unrelated live W4 working-tree edits were not touched.
- **Verification evidence:** `bun test packages/server-core` is 56/56;
  server-core and app typechecks pass; scoped lint passes; the app client and SSR
  builds pass; `bun run gates` passes 11/11 projects and all automated gates.
  The two independent boundary probes below fail outside the current suite.
- **Decision-log status:** SA-8 and SA-10 are implemented as stated. SA-9's
  terminal-structure claim is contradicted by Finding 2. D-038's reason audit is
  applied: matching a MIME and extracting dimensions is not evidence that the
  payload has the claimed image structure.

### Findings

1. **[MAJOR] Coalescing gives every waiter the first request's abort lifecycle**
   (`packages/server-core/src/artwork-proxy.ts:414-450`,
   `packages/server-core/src/artwork-proxy.ts:461-475`,
   `packages/server-core/src/artwork-proxy.test.ts:344-379`). The shared promise
   is created by `fetchRemoteArtwork(request, ...)`, where `request` is only the
   first caller. Later identical callers return that promise directly and their
   signals are never observed. Conversely, aborting the first caller aborts the
   one upstream operation and returns `502/upstream_failure` to every still-live
   waiter. An independent two-request probe started one fetch; aborting the
   second produced zero upstream aborts, and aborting the first then produced
   statuses `[502, 502]` for both callers. This makes one browser consumer able
   to poison another and makes a cancelled non-owner keep consuming the shared
   slot until the owner completes or times out. Coalescing needs waiter-aware
   cancellation: each caller must be able to stop awaiting independently, while
   the shared upstream is cancelled only when no live waiters remain (or the
   implementation must document and test another semantics that does not let one
   caller control unrelated callers). Add tests for both owner-aborts-first and
   follower-aborts-first, not only a single unshared request.

2. **[MAJOR] AVIF validation accepts a fabricated box and arbitrary trailing
   bytes as publicly cacheable artwork**
   (`packages/server-core/src/artwork-proxy.ts:327-349`,
   `packages/server-core/src/artwork-proxy.test.ts:180-205`,
   `docs/workstreams/002-implementation-spine/decisions/server-artwork.md:58-66`).
   `avifMetadata` validates one top-level `ftyp` length, then scans every byte for
   the four characters `ispe`; it neither walks ISO-BMFF box boundaries nor
   establishes a terminal structure or media payload. It returns immediately
   after reading two integers, ignoring every remaining byte. A 64-byte probe
   containing only a minimal `ftyp`, a fabricated 20-byte `ispe`, dimensions
   300×300, and the literal trailing payload `TRAILING-POLYGLOT` returned HTTP
   200 as `image/avif`. This directly falsifies SA-9 and the diary's claim that
   supported structures terminate without trailing polyglot bytes. The existing
   truncated/trailing test covers PNG only. Parse AVIF through bounded BMFF box
   structure (including declared box extents and required image-item/media
   structure), or use a maintained bounded decoder/parser; add malformed-box,
   fake-`ispe`, missing-media and trailing-data cases. Apply the same
   structure-versus-dimensions audit to JPEG and WebP before claiming the broad
   four-format invariant.

### Verified fixes and non-findings

- Fetch Metadata rejects an explicit cross-site browser request before transport;
  requests without browser Fetch Metadata remain usable by server clients.
- The process admits at most eight distinct operations, coalesces identical work,
  returns structured 503 at saturation, and releases its slot/map entry in the
  owning promise's `finally` after success, transport failure, timeout, and an
  unshared client abort.
- `Infinity`, `NaN`, zero, negative/non-integer values, and values above all three
  hard ceilings are rejected before transport. Configuration can only tighten.
- PNG signature, chunk extents, CRCs, terminal IEND and dimensions are checked;
  lying headers, truncated PNG, bytes after IEND and dimension mismatch are
  rejected with no-store structured failures.
- The fixed-host HTTPS allowlist, clean authority check, manual redirect refusal,
  byte/time bounds, non-reflective errors, and credential isolation remain intact.
- The route and public proxy API documentation now meet the scoped collaboration
  bar for the behavior they actually implement.

### Suggestions (non-blocking)

- Model an in-flight entry explicitly (`promise`, waiter count, upstream abort
  controller) instead of storing a bare promise. That gives cancellation and
  cleanup one auditable owner and makes the intended semantics testable.

### Neuve Dogfood Feedback

- **Commands/artifacts/Kanban/HITL:** not run and no feedback artifact created;
  `AGENTS.md` expressly states this repo has no Neuve shell or Kanban board.
- **Signal value/sticking points:** not applicable. The repo-local workstream
  tracker and bounded review artifact are the prescribed process surface.

---

# Final re-review: W6.3a — waiter isolation and AVIF boxes

## Verdict: REQUEST_CHANGES

The coalesced-waiter Major is closed, including the stronger exactly-once
admission check requested for this round. The AVIF Major is not closed: the new
box walk proves extents and finds one `ispe`, but it still does not prove that
the media payload is an AVIF image or that the selected dimensions are the
decoded image dimensions. One Major remains, so approval is prohibited.

### Correctness Check

- **Source of truth:** `AGENTS.md`; `scope.md` target C and its static/doc gates;
  `dispatch/W6-composite.md` W6.3; D-014 and D-038; SA-8 through SA-12; current
  server diary and appended evidence; prior two rounds in this review.
- **Canonical sources:** the same pinned Effect, Bun and TanStack Router sources
  were rechecked under `/Users/vinicius/code/agentic-context/` at
  `f356bc2da6abb4dee05b8c22fb597af3823e2ef7`,
  `65362b53bb13317156aab6c35fb798702de88286`, and
  `0dbb77f7260b4919786c2c3d594b8c262de43a9e`. No stale
  `agent-context` source was used.
- **Kanban/Neuve:** inapplicable by standing repo law; `tracker.md` is the queue.
- **Reviewed range:** implementation fix `fbe6ea2` and evidence/decision update
  `9dbd15e`, read in full against the current implementation and tests.
- **Dispatch/dependency/HITL:** implementation remains inside server-core and its
  tests; W1's URL contract is unchanged. U14 and both-colourway aesthetic
  acceptance remain owner-only and are not claimed by this server review.
- **Type/lint/doc gates:** server-core and app TypeScript pass; scoped ESLint
  passes; app client/SSR build passes; public proxy documentation remains
  adequate. The `unknown` at the Promise rejection boundary is correctly kept
  at the external edge and immediately forwarded to Effect's typed mapper.
- **Git history:** both commits are coherent and trailer-free. No implementation
  file was edited by this review.
- **Scoped deterministic tests:** `bun test packages/server-core` is 62/62 with
  188 assertions. The suite's submitted AVIF positive expectation passes, but
  independent decoder and fabricated-media probes below show that its reason
  does not prove the claimed invariant.
- **Decision status:** SA-11 is independently supported. SA-12 is contradicted:
  box-boundary traversal is real, but “image-item/media structure” and dimensions
  are not established by the checks currently performed.

### Findings

1. **[MAJOR] The AVIF validator still authenticates box names and an unrelated
   `ispe`, not a decodable primary image or its rendered dimensions**
   (`packages/server-core/src/artwork-proxy.ts:369-389`,
   `packages/server-core/src/artwork-proxy.test.ts:57-60`,
   `packages/server-core/src/artwork-proxy.test.ts:222-260`,
   `docs/workstreams/002-implementation-spine/decisions/server-artwork.md:92-101`).
   The parser requires named empty `hdlr`, `pitm`, `iloc`, and `iinf` boxes, one
   `iprp/ipco/ispe`, and a non-empty `mdat`; it never parses the item records,
   binds `pitm` to `iloc`/`iinf`, applies `ipma` property associations, or
   validates the AV1 item payload. An independent box-complete fixture with all
   required names, a 300×300 `ispe`, and `mdat` containing only
   `NOT-AN-AVIF-BITSTREAM` returned **200 image/avif**. More sharply, macOS
   ImageIO (`sips`) identifies the submitted positive fixture as a real AVIF
   whose decoded `pixelWidth` and `pixelHeight` are **1×1**, while this proxy
   accepts the same bytes for `px=2` because it reads an unassociated 2×2
   `ispe`. The fixture includes clean-aperture/property data the parser ignores.
   This violates the provider-owned exact-dimensions contract and still allows
   arbitrary bytes to receive public image caching. Either use a maintained,
   bounded AVIF decoder/metadata parser that resolves the primary item and its
   applied transforms, or fully parse and associate the relevant HEIF item and
   property tables plus validate the AV1 item payload. Tests must independently
   verify decoded dimensions, reject a box-complete arbitrary `mdat`, and cover
   primary-item/property association rather than only box presence.

### Closed findings and independent replay

- **Owner abort:** one upstream start, zero upstream aborts before release,
  statuses `[499, 200]`.
- **Follower abort:** one upstream start, zero upstream aborts before release,
  statuses `[200, 499]`.
- **All waiters abort:** both callers returned 499 and upstream aborted exactly
  once.
- **Admission cleanup exactly once:** after all-waiters abort under
  `maxConcurrent: 1`, two distinct later stalled requests produced exactly one
  upstream start and statuses `[200, 503]`. This proves neither a leaked slot nor
  a double decrement/over-admission in the exercised lifecycle.
- **Malformed/trailing AVIF:** the prior 64-byte fake, malformed extent, absent
  `mdat`, and undeclared trailing bytes now return 502 as claimed.
- **Real AVIF:** the ImageIO fixture is accepted as AVIF; however, its decoder
  dimensions expose Finding 1 rather than closing it.
- Fetch Metadata, global saturation, finite tighten-only options, fixed hosts,
  redirect refusal, byte/time bounds, PNG integrity, structured failures and
  credential isolation remain intact.

### Suggestions (non-blocking)

- Rename the current test from “accepts a box-bounded AVIF item structure” only
  after its expected `px` is derived from an independent decoder. As written,
  the name and expected value encode the parser's own mistaken interpretation.

### Neuve Dogfood Feedback

- **Commands/artifacts/Kanban/HITL:** not applicable; the repo expressly has no
  Neuve shell or board.
- **Signal value/sticking points:** the required independent decoder check added
  decisive signal that the self-derived box fixture could not provide.

# Final re-review — decoded AVIF fixes `5ca36e3` / `c5254fd`

## Verdict: REQUEST_CHANGES — 0 Critical, 1 Major, 1 Minor

The AVIF authenticity and dimension defect from the prior review is closed. The
new Sharp-backed path rejects the box-complete junk-`mdat` fixture, rejects a
real AVIF when the requested dimensions disagree with independently decoded
dimensions, and accepts a separately generated valid 3×3 AVIF only for `px=3`.
The dependency is server-only. A remaining decode-phase cancellation defect,
however, means SA-11 and the public cleanup contract are still false for one
ordinary lifecycle and admission is not released when the response settles.

### Findings

1. **[MAJOR] Abort during native AVIF decode returns 499 before cleanup and
   retains the admission slot until Sharp's timeout**
   (`packages/server-core/src/artwork-proxy.ts:398-429`,
   `packages/server-core/src/artwork-proxy.ts:494-550`,
   `packages/server-core/src/artwork-proxy.ts:590-597`,
   `packages/server-core/src/artwork-proxy.ts:696-697`). `fetchRemoteArtwork`
   passes the shared signal to the upstream fetch controller, but the Sharp
   pipeline has no connection to that signal. I generated a valid 3000×3000
   AVIF, waited until decoding had begun, aborted its only waiter, and immediately
   requested a distinct URL with `maxConcurrent: 1`. The aborted caller returned
   **499**, but the distinct request returned **503** with zero upstream starts;
   a third request 250ms later was still **503**. The process remained alive for
   approximately 6.4 seconds, consistent with the five-second decoder timeout.
   Thus the native work survives its last waiter, the in-flight promise remains
   unsettled, and its admission slot remains occupied after the user-visible
   response has completed. With global `sharp.concurrency(1)`, abandoned decodes
   can also serialize later valid work. Wire the shared cancellation lifecycle
   to cancellable decoder teardown (and prove the native operation actually
   stops), or otherwise isolate the work so last-waiter abort releases both the
   native resource and admission exactly once. Add a deterministic decode-phase
   test: after the sole waiter receives 499 under `maxConcurrent: 1`, a distinct
   request must be admitted without waiting for the decoder timeout.

2. **[MINOR] The native pixel-bound evidence cites stale source lines**
   (`docs/workstreams/002-implementation-spine/evidence/server-artwork-sources.md:24`).
   The installed Sharp 0.34.4 source performs the `limitInputPixels` comparison
   at `src/common.cc:577-578`, not `:600-620`. The implementation and bound are
   present; only the reproducibility pointer is wrong.

### Independent replay and closed findings

- **Box-complete junk `mdat`:** 502.
- **Real AVIF dimension mismatch:** an independently inspected 1×1 AVIF returned
  200 for `px=1` and 502 for `px=2`.
- **Known-dimension valid AVIF:** an independently generated and inspected 3×3
  AVIF returned 200 for `px=3`.
- **Owner-only abort:** statuses `[499, 200]`, one upstream start, zero upstream
  aborts; the surviving waiter completed.
- **Follower-only abort:** statuses `[200, 499]`, one upstream start, zero
  upstream aborts; the owner completed.
- **All waiters abort during fetch:** statuses `[499, 499]`, exactly one upstream
  abort. A subsequent two-request admission probe produced one start and
  `[200, 503]`, confirming exact release for the fetch-phase lifecycle.
- **Timeout and bounds:** upstream timeout returned 504 and aborted once;
  oversized content returned 413 and canceled once; unsafe options returned 400
  without an upstream call.
- **Scoped gates:** `bun test packages/server-core` passed 65 tests / 194
  assertions; server-core and app TypeScript passed; scoped ESLint passed; the
  client and SSR production build passed.
- **Bundle isolation:** unique Sharp/libvips/package/runtime markers are absent
  from `apps/web/dist/client` and present in the SSR bundle only. The sole broad
  client match for the English word “sharp” is not a package/runtime marker.
- **Dependency grounding:** the installed package metadata reports Sharp 0.34.4
  with `lib/index.d.ts`; its installed declarations and source expose the used
  metadata, stats, timeout and input-pixel controls. No Sharp source exists in
  `/Users/vinicius/code/agentic-context`, so the checked installed package is the
  authoritative source for Sharp while the existing Effect/Bun/TanStack claims
  remain grounded in their pinned agentic-context clones. The 0.34.4 pin is
  operationally supported by the installed metadata and successful build; the
  claimed 0.35.0 export-map comparison cannot be independently replayed from the
  currently installed tree alone.

Both reviewed commits are coherent and trailer-free. This review changed no
implementation file.

# Final safe-MVP review — `b253a4f` / `fb7a5f6`

## Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

The safe MVP closes the remaining native-decode lifecycle defect by making AVIF
explicitly unsupported. That is within scope: the binding W6.3 dispatch requires
same-origin proxying for provider artwork but specifies no codec, and neither the
workstream scope nor the relevant dispatch packets require AVIF. PNG, JPEG and
WebP retain bounded structural validation and exact requested dimensions.

### Independent verification

- **Negotiation and admission:** `REMOTE_IMAGE_TYPES` contains only
  `image/jpeg`, `image/png`, and `image/webp`; outbound `Accept` is exactly
  `image/webp,image/png,image/jpeg`. There is no AVIF parser or decoder path.
- **AVIF early rejection:** an instrumented `image/avif` response returned
  structured, no-store **502 `upstream_content_type`**. Its body was cancelled
  exactly once and `ReadableStream.getReader()` was never acquired, proving the
  rejection occurs before proxy buffering or decode.
- **Prompt capacity recovery:** under `maxConcurrent: 1`, a distinct PNG request
  started and returned 200 immediately after the AVIF response (about 1ms in the
  independent replay). No native/background operation remained to retain the
  slot.
- **Supported real files:** independently produced/inspected 300×300 PNG and
  JPEG files and an independently fetched/inspected 300×300 WebP each returned
  200 with the matching MIME. Existing malformed, polyglot, MIME-mismatch and
  dimension-mismatch cases remain green.
- **Cancellation and concurrency:** owner/follower isolation remains green;
  aborting all identical waiters produced `[499, 499]`, exactly one upstream
  abort, and an immediate distinct 200 at `maxConcurrent: 1`. Saturation,
  coalescing, timeout, error and exact-release tests pass.
- **Dependencies and bundles:** `sharp`, `@img/sharp-*`, and libvips are absent
  from package manifests, `bun.lock`, `bun pm ls --all`, and both production
  bundles. Broad English uses of “sharp” and “unsharp” in artwork/device code are
  product terms, not package references. Bun's local `.bun` package cache still
  contains orphaned Sharp directories from prior installs; they are outside the
  dependency graph and do not ship.
- **Prior Minor:** closed. The stale Sharp `common.cc` line citation was removed
  with the decoder-source section; the remaining dependency claims are grounded
  in the pinned Bun/Effect/TanStack sources under
  `/Users/vinicius/code/agentic-context`.

### Gates replayed

- `bun test packages/server-core`: **60 pass, 0 fail, 187 assertions**.
- Server-core and app TypeScript: pass; repository typecheck: **11/11**.
- Corrected scoped ESLint and root lint: pass.
- App production build: **207 client / 370 SSR modules**, pass.
- Repository tests on the current shared tree: **834 pass, 0 fail**.
- `bun run gates`: **16 automated passed, 0 failed**; U14 and U15 remain the
  explicitly manual owner/reviewer checks and are outside this server codec
  decision.

The two commits are coherent and trailer-free. No implementation file was
changed by this review. The workstream tracker still carries the prior
`changes-requested` wording; the coordinator should update that process state
after ingesting this approval.
