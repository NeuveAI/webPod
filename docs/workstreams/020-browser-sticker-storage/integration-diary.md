# Browser integration diary

## Implementation

- Replaced production cookie/session sticker fetches with the typed local worker
  transport. Library import and catalog enrichment use stateless, same-origin
  `/api/apple/stickers` POST; server signing stays in server-core and request-local
  Apple credentials never reach the worker.
- Restores OPFS collection before MusicKit configuration, including unauthorized
  visits and transient SDK failures. Apple logout, rejection, or passive session
  loss disposes old work, aborts metadata requests, and starts a fresh local read.
  Late HTTP completion cannot enqueue a write. Generation guards reject queued
  writes/publications; already committed local transactions remain durable.
- Existing placement revision reconciliation, listening sequence/seek/bounded
  queue behavior, and Jotai publication remain. Imported/enriched tracks are
  projected to the three permitted fields before worker submission.
- Added browser-local export/import controls on the rear collection surface,
  including empty collections. Backup replacement needs a second user gesture;
  files are size-checked before reading and engine validates before transaction.
  Invalid backups retain the collection; controls report errors explicitly.
- Apple import failures set collection importStatus=failed, distinct from OPFS
  storage errors. Retry recreates failed worker transport.
- Updated deployment docs: Vercel no longer requires remote sticker storage;
  ownership is browser/origin-local with manual backups and no server migration.

## Sources and review

Read scope.md and modern-web-guidance/Jotai/React best-practice skills. Guidance
search gave no relevant storage guide. The referenced Jotai context file was
missing; existing explicit createStore patterns and installed sources govern.
Review feedback fixed byte-limit equality, failed-worker retry, independent Apple
failure status, and cold-read cancellation across auth changes.

## Verification so far

- Runtime + stateless metadata tests: 17 pass, 46 assertions. Cover unauthorized
  restore, all cold-read auth interruption paths, late Apple result cannot mutate,
  typed metadata transport, explicit OPFS failure, conflicts, generation queues,
  listening/enrichment/seek/teardown, read/write ordering, retry, backup dispatch.
- Web typecheck and scoped ESLint passed prior to final sibling test migration;
  repeat after final edits.
- Actual built `/webpod` restoration browser test passed: OPFS reload without
  Apple authorization, fresh browser-context backup import through controls,
  invalid backup retention, zero old cookie API requests. Screenshot visually
  inspected: controls fit, error readable, saved pack remains available.
- Existing 800-line tactile browser suite migrated from cookie HTTP operations
  to genuine worker/OPFS commands and test-owned placement fault instrumentation.
  This keeps real pointer, keyboard, artwork, revisions and failed-save scenarios.
  Its second-print fixture uses validated semantic backup; earning policy remains
  covered by engine tests. Old root-route and lip-coordinate assumptions updated
  to current `/webpod` and bottom-of-viewport behavior. Final run in progress.

No deployment or commit performed. Existing private server SQLite untouched.

## Final production verification

Reviewer reran latest built restoration/backup UI and production assets successfully.
The successful backup UI image is `evidence/browser-local-backup-success.png`;
visually checked alongside invalid-file error case. Web typecheck and owned-file
ESLint pass after final source changes. Production source is stable.

Supplemental tactile fixture diagnosis: old `flipRear` pressed Home and immediately
sent fifteen rotation keys. Home starts a spring, so after a previous rear gesture
those keys interrupted reset near 180 degrees and produced the *front* at ~360.
Screenshot `evidence/tactile-browser/before-roundtrip-pixel-check.png` exposed the
false test setup. The helper now waits for front orientation after Reset view,
then sends native keys and asserts rear orientation. No renderer change was made.
The initial root URL assumption also predated the landing/player split. New
supplemental artifacts go under this workstream; old015 evidence was restored.

## Completed supplemental verification

Final tactile browser suite passes: 1 test, 56 direct Bun assertions plus its
Playwright visibility, pixels, native pointer/touch and keyboard assertions,
74.1 seconds. `evidence/tactile-browser/browser-verification.json` records the
current source fingerprint and built client/server hashes. It covers pack opening,
real artwork, placement/reload, revision conflict, delayed/failed worker writes,
mobile relocation and return/retry, keyboard placement, intentional logout landing
navigation, reconnect, separate browser storage, and partial/failed import retry.

All final scenario corrections were test setup updates to existing product rules:
- Wait for reset spring to reach front before rotating rear (the current checkpoint
  image now shows the corrected rear rather than the original failed front view).
- Reduced motion already selects T4/no physical device; assert durable data remains,
  restore normal preference, then test native mobile interactions.
- Wait for measured projection/liner stability and open/tease lifecycle before new
  source grabs, while retaining assertions of intermediate peel/carry motion.
- Logout intentionally navigates to landing; assert this and reopen `/webpod` for
  reconnection rather than waiting for settings controls on the landing page.

Final app typecheck and scoped fixture lint pass. Inspected successful backup,
invalid-backup, and library-failure screenshots; controls remain readable and
retry works. No source edits remain planned, no commit or deployment performed.

## Follow-up: move backup controls out of the scene

The user requested removal of the persistent export/import banner while preserving
backups. Controls now live in the existing native Settings dialog, inside a
collapsed **Sticker backups** disclosure. The scene no longer mounts backup UI;
removing its wrapper also removes double positioning of empty-collection errors.
Backup validation, download, confirmation and worker functions are unchanged.

Updated the targeted restoration browser test to open Settings for backups and
assert exports are hidden when the dialog is closed. Web typecheck and scoped
ESLint pass. Runtime/session troubleshooting is a separate parallel slice.

Follow-up verification complete: failed library sync now offers **Sign in to Apple
Music** when the live provider session is unauthorized, using the existing direct
user-gesture authorization callback. Authorized sessions retain **Try again**;
pending authorization disables duplicate gestures. A successful local storage read
that reports `music_authorization_required` does not trigger edit-failure copy or
return animation. This preserves the usable collection while its sync action is
shown.

Fresh build passed. Runtime + presentation checks: 23 tests / 65 assertions. App
typecheck and scoped ESLint passed. Targeted built `/webpod` browser check passed
in 4.4s: Settings export/import, invalid-backup preservation, hidden scene banner,
and a signed-out imported failed-sync state recovers through the visible sign-in
button without losing its pack. Settings and clean-scene screenshots were visually
inspected; evidence includes `browser-stickers-without-backup-banner.png`, updated
`browser-local-backup-success.png`, and `browser-paused-sync-reconnected.png`.
No commit or deployment.
