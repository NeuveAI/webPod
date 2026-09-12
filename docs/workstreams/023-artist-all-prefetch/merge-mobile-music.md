# Music merge resolution

Status: production code frozen for independent review and lead browser smoke. No staging or commits performed by this lane.

Read current AGENTS.md and merge-mobile-scope.md, compared the merge-base → origin/main changes for the three conflicts and adjacent list-view.tsx, and inspected the incoming GPU worker, feature-complete results and panel measurement contracts. Those contracts retain worker/render ownership, exact native panel dimensions, hidden-document cancellation and existing quality/resource limits; this lane changes none of those owners. Consulted global-patterns and React performance guidance; modern-web-guidance search ran via bunx and returned related generic rendering guidance plus a stale-skill notice. No new library API or dependency was introduced; existing canonical state/provider contracts remain authoritative.

Resolutions:

- packages/music-management/src/library.ts keeps paged Relationships ownership, 48/16 MiB metadata retention, root continuous loading, artist All ordered flattening, request-local oversized child completion and retries. Incoming main only adds a duplicate identical-snapshot guard to the previous artist album onPage bridge. The current Relationships implementation already publishes once per fetched page and does not publish again on promise completion or cache hits; restoring the legacy bridge would recreate superseded unbounded maps. The current implementation therefore preserves the incoming optimization's behavior without restoring its old architecture.
- packages/panel/src/Panel.tsx formats only the visible rows for root/browser/nested track lists and Up Next. Each ListViewport receives the absolute rowsStart and full totalRows, preserving scroll rail and selected absolute index. Retained current-branch loading semantics: an available progressive prefix renders immediately, while an empty destination shows skeletons. Song/nested track rows remain title-only. Existing shared manager observation, intent claim and stable panel lifecycle code remains untouched.
- packages/providers/src/apple/apple-provider.ts returns its last published immutable relationship snapshot at completion, avoiding duplicate publication identities. The merged normalization still passes parentArtistName, which is required for actual Apple library album payloads that omit artistName. Paged provider methods, opaque continuation validation and playback recovery are unchanged.

Semantic regression checks:

- Extended the existing Apple progressive artist albums test to require final return identity to equal the last onPage snapshot.
- Added a nonzero-window partially loaded track-list case: absolute index12, visible rows10–18, scroll rail retained, no double slicing or skeleton replacement, and artist subtitle remains absent.
- Existing AC/DC payload, bounded metadata/pinning/oversized eviction, progressive All, continuous library loading and playback recovery tests run in the focused suite.

Verification:

- `bun test packages/music-management packages/providers packages/panel packages/state packages/tools`: 909 pass, 0 fail, 4344 assertions across45files. Bounded output at /tmp/webpod-merge-music-tests.log.
- Scoped ESLint for the three resolved files plus the two changed tests: pass.
- Music-management, panel and providers package TypeScript checks: pass. The newly added snapshot assertion initially needed a defined-value guard for TypeScript; corrected in the test only and provider typecheck/lint rerun passed.
- No conflict markers remain in the three lane-owned files. Git's unmerged index remains for lead to stage after independent review.

Lead owns whole-project checks, production build/smoke and merge commit. Unit tests establish behavior, not statistical mobile performance or GPU throughput. No root bun test, historical evidence regeneration, credentials, design.pen access or live browser mutation was performed here.
