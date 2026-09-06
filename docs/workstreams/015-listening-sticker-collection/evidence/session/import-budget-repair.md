# Import sampling deadline repair

Status: implemented, frozen for independent review. No live credentials or existing user database inspected.

## Confirmed cause and policy

The owner's new safe diagnostics identify the occurrence: the30-second import budget expired after24 validated pages /2400 received rows /2026 accepted unique tracks /343 skipped rows. Reload then reached the25-page cap. The former all-or-nothing timeout rule discarded that valid prefix and marked the import failed. This supersedes the uncertainty about that occurrence in the earlier sync-repair evidence; it does not imply every sync failure has this cause.

The fixed30-second budget is now an intentional sampling bound, alongside the unchanged25-page /2500-track limits. Expiry of that specific budget can return `partial` with finite reason `sample_time_limit` if at least one usable track exists in fully validated pages. A usable track has a verified catalogue ID and valid duration; genre may be unknown and can be enriched later. A starter still requires a supported genre. The synthetic reproduction uses Rock and proves the starter is granted in the initial session without reload.

Each page stages normalized rows locally. Only after validating its envelope, row bound and next URL does it commit rows and diagnostic counters to the sample. A malformed later page contributes neither tracks nor counts. Unsupported library-only rows remain skipped; duplicates remain deduplicated; no listening credit is created by membership. No budget or page limit was increased, and this is still a bounded taste sample rather than a resumable full-library import.

Own-budget expiry before a new request stops immediately. In-flight timeout qualifies only when the caught failure is the exact own deadline signal reason; native fetch and its reader keep the original cancellation signal. There is no broad aborted-flag conversion or race that overrides an observable response error. A real Bun HTTP streaming test verifies own deadline identity through native fetch body cancellation.

External request/logout/runtime cancellation wins over own sampling expiry at admission, page commit, import return and existing live-session activation checks. Authorization, upstream status/network failures and malformed responses remain failures even if the deadline has also expired. They never return a prefix for import. With no usable fully validated sample, own timeout remains `apple_timeout` failure. Previous grants/placements remain protected by the existing transaction policy.

Diagnostics retain only finite status/reason and bounded page/row counts. No cursor, token, owner/catalog identifier, upstream body or exception is emitted. Successful deadline-limited samples have `partial/sample_time_limit`; page-cap samples retain `partial/sample_limit`.

## Reference and scope record

Read the full import-budget-repair dispatch, standing repository law and prior session/sync contracts. Applied global-patterns, effect-services and database-drizzle guidance; used local canonical references plus installed Bun/Effect sources where pinned versions differ. The official Apple library-song/catalogue relationship and opaque string-offset contracts established in sync-repair.md remain unchanged. No UI/routing changes, dependency upgrades or patch changes are part of this lane.

## Verification

`packages/server-core/src/stickers/import-budget.test.ts` provides deterministic controlled deadline tests, without waiting30seconds:

- Exact24-page owner-count fixture, including343 unusable rows and31 duplicate rows, reaches a real live-session activation and SQLite starter grant on the first response.
- Expiry after validating a page stops before another network request.
- Expiry during the first streamed page, or after a prefix containing no usable tracks, remains failure.
- Malformed JSON/next path,401/429/500 and an independent network failure concurrently with deadline expiry all reject; staged malformed-page rows/counters never enter the sample.
- Simultaneous external cancellation rejects without repository import or grants.
- Native Bun HTTP streamed response timeout retains the own reason and returns only the previously validated page.

Budget tests:6 passed /46 assertions. All importer/domain/live suites:40 passed /244 assertions. Server-core typecheck and scoped lint pass. Existing strict cancellation patch is unchanged. Final normal-dev and production verification is coordinated with the independently owned not-found route change; final independent verdict lives in reviews/import-budget-review.md.

Failed-before replay: copied a credential-free source snapshot, replaced only its importer with the committed pre-repair HEAD version, installed the frozen lock and ran the new budget tests. Result:2 passed /4 failed /18 assertions. The first-session starter, pre-next budget stop and native streamed timeout cases reproduce the old failure. The temporary snapshot was removed.

Final combined production build passes. Independent core+patch suite passes41 tests /252 assertions; actual shipped root/app dev plus native POST cancellation/recovery passes3 tests /2014 assertions. Independent root typecheck passes12/12 projects and scoped lint passes. Production transport and built not-found checks are recorded by the reviewer.
