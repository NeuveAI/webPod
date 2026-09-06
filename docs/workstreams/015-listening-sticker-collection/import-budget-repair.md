# Library sampling deadline and missing-route repair

Status: REPAIRED and independently approved. Owner's new diagnostic establishes a real cause: apple_timeout after 24 complete pages/2400 rows, then successful partial sample_limit after reload at25 pages/2500 rows. Earlier uncertainty about this occurrence is resolved. The missing-route configuration warning is also repaired; the user's exact missing URL remains unknown. Repository law and existing identity/earning/cancellation/security contracts remain in force.

## Correctness and decision

The bounded starter sample must not discard an otherwise valid nearly complete sample solely because its own sampling time budget expires. Treat the intentional time budget as another bounded sampling stop, with truthful partial diagnostics/UI. Do not merely increase timeout/page limits. Keep only fully validated pages; never turn malformed pages, authorization/upstream errors, first-page failure or an external logout/request/runtime cancellation into successful import. Define and test precedence at time/cancellation races. Preserve older inventory/grants and all membership/earning invariants. A timeout with no usable validated sample remains a failure. Record the exact policy change from the former timeout all-or-nothing rule; no resumable full-library project is required.

Configure a real not-found experience through canonical TanStack routing. Trace likely missing requests using test evidence; do not claim their exact user URLs from a warning that omits them. Unknown routes retain404, a useful return-to-player link and no root configuration warning. No catch-all200, warning suppression or unrelated redesign.

## Ownership

- Backend engineer: importer deadline policy, safe diagnostics and meaningful deterministic boundary tests, relevant service/native tests; evidence/session/import-budget-repair.md. No UI/root route edits.
- UI/routing engineer: root notFoundComponent, meaningful missing-route tests, required skill/reference record in evidence/session/not-found-repair.md. Modern Web Guidance first, Interface Craft, Interface Design Guardrails and Neuve Motion as applicable; preserve existing design and no useState. No importer/package/lock edits.
- Independent reviewer: read-only policy/security/routing tracing and independently executed tests; reviews/import-budget-review.md. Require APPROVE with no unresolved Critical/Major before commits. Lead owns this dispatch, final handover and commits.

## Acceptance and gates

Reproduce the24-successful-pages plus sampling-deadline case with deterministic time, then prove partial valid sample reaches repository/starter generation without reload. Cover time-budget stop before next request, in-flight own-budget timeout, no completed usable sample, malformed/upstream/auth failure after valid prefix, and simultaneous external cancellation with no writes. Counts/reasons must remain finite and credential-free. Existing partial cap and complete-library tests remain valid. Use realistic catalogue relationships/opaque cursors. No user data/keys/environment files or existing SQLite reads.

Independently verify actual shipped dev route/session transport and production checks after source freeze. Missing URL must return404 with usable navigation and no notFoundComponent configuration warning; valid root/device remain usable. Preserve existing expected-abort patch and error classification. Source types/lint, precise diagnostics and independent review required. Tests must exercise the former failures rather than only assert new constants. No user server stopped, no push/deployment. User already authorized tests, implementation, commits and cleanup. Final evidence should distinguish reproduced diagnostics from live-account verification.

## Final evidence and commits

Independent APPROVE in reviews/import-budget-review.md, with no unresolved Critical/Major findings. A regression reproduces the owner's exact 24-page/2400-row/2026-accepted/343-skipped counts and creates a starter in the initial SQLite-backed session when the importer's own budget ends. The isolated pre-fix replay fails four new regressions; the repaired six budget tests pass. External cancellation, independent error precedence, incomplete/invalid page exclusion and zero-usable-sample failure remain covered. The timeout limit is unchanged.

Independent core plus cancellation patch suite: 41 tests/252 assertions. Actual shipped root/app dev and native POST/cancellation: 3 tests/2014 assertions. Missing-route dev: 1 test/11 assertions plus mobile visual and keyboard recovery; built missing-route: 1 test/15 assertions. Production native/browser/static: 3 tests/260 assertions. Reviewer and lead root typechecks pass all 12 projects; scoped lint and diff checks are clean.

Source commits: bc59853 (`Retain validated sticker samples when the import budget ends`) and 41a40f0 (`Provide accessible recovery for missing webPod routes`). Exact evidence is in evidence/session/import-budget-repair.md, not-found-repair.md, not-found-mobile.png and the budget-browser rerun artifacts. No live-account request, existing user database or credentials were accessed, and no user server was stopped. No push/deployment performed.
