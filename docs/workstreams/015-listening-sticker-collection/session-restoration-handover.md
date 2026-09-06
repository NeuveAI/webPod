# Session restoration handover

Status: implemented and independently approved; final evidence commit and clean-state check close delivery.

The registered session now restores earned stickers and saved placements from our database before MusicKit setup or another Apple import can delay them. Startup previously waited for both. It now uses the existing authenticated GET inventory endpoint, preserving server session validation and avoiding any new identity or authentication mechanism.

Apple ingestion runs in the background: one deduplicated initial/retry import, then every 15 minutes while visible and when an overdue tab returns. Existing measured-listening updates continue. Import failure keeps the validated collection available; successful enrichment adds access without replacing newer placement or opened-pack state. Late inventory responses trigger a bounded fresh database reconciliation when another publication intervened.

The early restoration and later authorized attachment share one provider lifecycle. Explicit logout, replacement, confirmed unauthorized setup and permission denial cancel pending restoration and clear content. A transient MusicKit configuration failure preserves a still-valid native session's restored collection. Teardown cancels fetches, timers and listeners. New registrations still authenticate through the existing server flow.

## Validation

Frozen source: `57a57f92119dae7590598c619cd550c35cb81cfc0d32083da0b8623060046743` /381 files. Implementer reports build, app types and scoped lint passing; 19 deterministic tests/65 assertions and one native test/85 assertions passing. Independent review passed 85 native assertions, 49 runtime/music/service tests with 219 assertions, app types and scoped lint. The lead root typecheck passed 12/12 projects. See [review](reviews/session-restoration-review.md).

The native test uses the real product route, Start handlers, cookies and temporary SQLite with synthetic trusted upstream/signing dependencies. It restores and pixel-checks a saved rear sticker while MusicKit configuration is held, then while Apple import is held. It verifies subsequent earned access, preserved placement, failed import, retry and transient versus definitive authorization outcomes. The test does not alter the owner's live localhost:3000 session.

Necessary session-read latency and artwork decoding/rendering still apply. No live Apple account or physical Safari certification is claimed. This change removes the ingestion dependency; it does not eliminate all startup rendering cost.

[Scope](session-restoration-scope.md), [engineer diary](diaries/session-restoration.md), and evidence/session-restoration/ hold decisions, commands and captures. Final independent startup validation passed three tests with 2,051 assertions. Earlier runs exposed a Vite restart navigation race, corrected in the test with one bounded retry for ERR_ABORTED only. Separate intermittent pre-readiness timeouts did not reproduce in the final run and remain unexplained; this delivery does not claim to have fixed those startup stalls. Failed and passing evidence is retained.

Final fingerprint: `c11bd0eee34d0f42feba78e3a37b558a7184f40168011100d4e7dfefe9b2fde4` /381 files. The reviewer’s per-file manifest proves only the startup test changed after the native restoration captures; product sources stayed identical. Lead recomputation matches.

Commits: `e6b8383` restores saved stickers before background ingestion; `fbfc14d` handles the startup-test navigation interruption. Documentation and evidence are committed separately. Owned test resources were cleaned, and the owner’s live authenticated tab was preserved. Final clean-state verification follows the evidence commit.
