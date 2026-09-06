# Apple radio request repair

The reported `GET /v1/catalog/se/stations` 400 matches an invalid request shape in `stationsList`. The provider was asking for the unfiltered station collection. Apple's multiple-station lookup requires identifiers; its documented live-radio discovery uses `filter[featured]=apple-music-live-radio`.

Choice: retain Radio and request the supported live Apple Music stations for the authorized storefront. The provider now passes the required filter through both the current MusicKit v3 `api.music` path and its existing legacy `stations` facade. No station IDs or storefronts are hardcoded. Station normalization and playback remain unchanged. There is no unsupported retry or fallback to the invalid unfiltered request. No UI, capability gate, animation or library-loading production code changed.

Official references:
- [Get the Apple Music Live Radio Stations](https://developer.apple.com/documentation/applemusicapi/get-the-apple-music-live-radio-stations), including its official Markdown representation: `/documentation/applemusicapi/get-the-apple-music-live-radio-stations.md`.
- [Get Multiple Catalog Stations](https://developer.apple.com/documentation/applemusicapi/get-multiple-catalog-stations).

Local grounding: `/Users/vinicius/code/.better-coding-agents/resources/bun/docs/guides/test/run-tests.mdx`; repo MusicKit v3 adapter contracts and fallback dispatch in `packages/providers/src/apple/apple-provider.ts`. No Apple/MusicKit reference checkout was found in the shared resources catalog, so Apple endpoint facts come directly from official documentation. Modern Web Guidance search for optional music catalogue loading found no sufficiently relevant implementation guide. Global Patterns and repository Bun/Jotai rules apply; there is no visual work in this repair.

Verification:
- `bun test packages/providers/src/apple/apple-provider.test.ts apps/web/src/music-runtime.test.ts`: **72 passed, 257 assertions**.
- Regression assertions require `/v1/catalog/se/stations` with the exact featured filter, normalize the documented `stations`/`isLive` shape, preserve stable station identity, verify legacy filter forwarding, and preserve empty responses and rejected errors without unfiltered retries.
- Runtime regressions verify optional empty, rejected and still-pending station loading does not prevent the existing library from completing.
- Provider and app TypeScript checks passed. Scoped ESLint passed for all four changed TypeScript files.

This reproduces the request-shape defect from source and prevents it deterministically. No live Apple account, credential, key, existing user database or user's running server was accessed. Live station availability and playback for the user's storefront remain unverified; Apple can return no stations or an upstream error, which retains the existing optional-library behavior.
