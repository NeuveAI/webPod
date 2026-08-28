# Server artwork proxy decisions

## SA-1 — closed source set, not a URL proxy

`/artwork` accepts only the URL forms currently emitted by the provider
contract: Apple `mzstatic` image-thumb paths, Spotify `scdn` image paths, and the
fixture provider's exact local source shape. Private-address detection is not
the primary defense because arbitrary hosts never reach DNS. Redirects are
manual and rejected, closing the route from an external allowlisted host to a
private target.

## SA-2 — fixture art is generated inside the proxy

The fixture catalogue emits `/artwork-source/...` but no source route or asset
exists. Fetching that path from the server would create a recursive same-origin
HTTP dependency and widen SSRF handling. Server-core instead validates the
complete local path, derives a deterministic palette from the validated slug,
and returns a self-contained SVG. This makes W3/W6 previews display art without
inventing a second public endpoint.

## SA-3 — Effect owns composition; Bun fetch owns transport

The proxy is an `Effect` program requiring `ArtworkTransport`, with the live
transport and test transport supplied through `Context.Service`. `Effect` owns
typed failure, service injection, and handler composition. Bun's standards-based
fetch performs the actual request because the exact Bun source proves the two
security-sensitive behaviors needed here: manual redirects and abort-driven
body termination. This keeps tests deterministic without monkey-patching a
module global.

## SA-4 — buffer only after a streaming bound

HTMLTexture needs an ordinary browser image response, not an open-ended upstream
stream. The service checks `Content-Length` first, then reads chunks while
enforcing the same 8 MiB limit. It cancels immediately on overflow and only
allocates the final contiguous response after the bounded read completes.

## SA-5 — provider constant and TanStack literal are mechanically tied

TanStack's route generator rejects a variable passed to `createFileRoute`, even
when that variable is a literal constant. The route therefore uses the required
literal and assigns the imported provider constant to the same literal type.
Changing either side without the other is a compile error.

## SA-6 — security responses do not become product permission copy

The HTTP status is 403 for a source outside the closed set, but the visible
message names a malformed host/path rather than saying a user or agent lacks a
grant. This preserves both accurate HTTP behavior and U8's product-language law.

## SA-7 — no credentials in the route

The artwork service reads no environment variables, tokens, cookies, request
authorization headers, or key paths. The route imports only the server-core
handler. This is intentionally separate from future MusicKit token minting even
though both live under `packages/server-core`.

## SA-8 — reject cross-site triggers and cap process-wide remote work

CORP is response isolation, not admission. Browser requests carrying Fetch
Metadata are accepted only for `same-origin`; other values fail before fetch.
Independently, at most eight distinct remote artwork operations may run in the
process. Identical in-flight operations share one bounded payload promise and a
full budget produces an immediate structured 503. Admission is released in a
`finally` block so timeout, client abort, validation failure, and transport
failure cannot leak capacity.

## SA-9 — bytes, MIME, and dimensions must agree

An allowlisted provider is still an untrusted byte source. MIME membership is
necessary but insufficient: the buffered bytes are structurally parsed as the
declared supported format, terminal structure forbids trailing polyglot bytes,
and encoded width/height must equal the provider-owned `px` contract. Invalid
bytes are no-store structured failures and never enter the public cache.

## SA-10 — configuration may tighten but never weaken ceilings

The exported test/deployment options are checked before transport admission.
Byte, timeout, and concurrency values must be positive safe integers no greater
than their exported hard ceilings. This keeps injection useful for deterministic
tests without making `Infinity` or an oversized limit a security bypass.

## SA-11 — shared work owns transport; callers own only their wait

An in-flight entry owns the upstream controller, promise, settled flag and live
waiter count. Each request observes its own abort signal and releases exactly
one waiter without controlling another. The shared upstream is aborted only
when the live waiter count reaches zero; the entry's owning completion path
removes the map entry and process admission slot exactly once. Thus either the
first or later caller may cancel without poisoning a still-live consumer.

## SA-12 — AVIF is explicitly unsupported until decode is killable

AVIF is absent from both the outbound `Accept` header and inbound MIME allowlist.
An AVIF response is cancelled before body buffering or native decode and returns
a structured no-store 502. Bun can terminate a subprocess, but adding a bundled
decoder child entrypoint, IPC protocol, process resource policy and deployment
lifecycle is not a bounded MVP change. In-process Sharp cannot terminate an
active native decode when the last waiter aborts, so keeping it would violate
SA-11. PNG, JPEG and WebP remain the only accepted remote formats.
