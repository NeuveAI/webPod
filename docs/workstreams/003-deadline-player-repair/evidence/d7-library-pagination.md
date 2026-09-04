# D7 evidence — Apple library pagination

**Captured:** 2026-09-04
**Scope:** provider-owned pagination only; no private library metadata

## Exact MusicKit v1 facade

`bun scripts/verify-musickit-diagnostic-contract.ts` fetched the public SDK and
matched the repository's pinned SHA-256:

```text
0ccb2ab37cedaef2eab9c7044c99afdb8c73a122a29ad8b7344af644a15bd14b
```

Bounded inspection of that same artifact established:

- `Library.albums`, `artists`, `playlists`, and `songs` delegate to the v1
  library collection request path;
- a plain object in the collection method's first argument position is treated
  as request parameters;
- the v1 parameter transform carries `limit` and `offset` and caps the library
  limit at 100.

No token, account, authorization, media, or private API surface was involved.
The repo-requested local dependency context directory was not present, so the
pinned verifier and exact artifact were the available authoritative fallback.

## Deterministic provider proof

Command:

```text
bun test packages/providers/src/apple/apple-provider.test.ts
```

Result:

```text
41 pass
0 fail
144 expect() calls
```

The D7 cases prove:

1. all four supported collection methods receive `limit=100, offset=0`;
2. 205 ordered items traverse offsets 0, 100, and 200;
3. a short page terminates without inventing a total;
4. a 200-item exact multiple makes one empty request at offset 200;
5. cursors are opaque, collection-scoped, and single-use;
6. duplicate catalog occurrences remain present and ordered;
7. structured `next` and reported totals still traverse correctly;
8. a facade that repeats its first full page at offset 100 fails immediately,
   and the consumed cursor cannot be replayed;
9. a full 100-record raw page containing one incomplete resource returns its 99
   truthful entities, advances to offset 100, terminates on the later short
   page, retains authorized session state, and emits no console output.

## Build and static proof

```text
bun run --cwd packages/providers typecheck   PASS
bun run --cwd apps/web typecheck             PASS
bunx --bun eslint <D7 provider paths>         PASS
bun run build                                PASS (client and SSR)
git diff --check -- <D7 provider paths>       PASS
```

The final `bun run gates` acceptance runner passed 11/11 TypeScript projects,
repository lint, 1,257/1,257 tests (78,548 assertions), and all 16 automated
gates. The two intentional manual gates remain outstanding.

## Authenticated count-only replay

The first replay after the pagination change reached an incomplete later-page
album and fell back to the demo source; its 2/4/4/42 counts were therefore
discarded as invalid evidence. The failure was all-or-nothing item
normalization, not authentication: the session remained live while the Apple
library load rejected.

After isolating malformed resources per item and basing continuation on raw
page length, the already-authorized `webpod-auth` session was reloaded and
navigated to the root. A DOM probe reduced the result to phase, failure state,
and collection counts before any output was returned:

```json
{
  "authorizedPhase": true,
  "libraryLoadFailed": false,
  "playlists": 112,
  "artists": 271,
  "albums": 461,
  "songs": 2726
}
```

The result directly proves multi-page traversal for all four collections while
the Apple source remains authorized. No screenshot was taken because it would
have recorded private titles; no title, identifier, URL, token, or media datum
appears in this evidence.
