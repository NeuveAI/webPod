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
