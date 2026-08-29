# Review: S2 — Apple empirical read-only probe

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: `AGENTS.md`; `scope.md`; `dispatch/S2-apple-empirical-probe.md`; `decision-log.md` decisions D-017, D-022, D-024, D-025, D-028, D-029 and D-041; `hitl-decisions.md` H-11; `decisions/s2.md`; and `evidence/apple-empirical-probe.md`.
- Kanban ticket: not applicable. `AGENTS.md` and `scope.md` explicitly say this repository has no Neuve shell or board; `tracker.md` is the operational queue.
- Correctness target: a developer-token-only, GET-only catalog probe that discriminates row 20, calibrates row 21 with positive and negative controls, preserves credential boundaries, and changes no unsupported provider capability.
- Dispatch scope: the four allowed S2 files exist. No package or app implementation was changed by the slice itself, although its eventual commit boundary is defective (Major 5).
- Dependency/HITL status: H-11 is closed. D-018 was not invoked. No user token, library write, or `/v1/me/` request appears in the current source.
- Neuve HITL gate: not applicable by explicit repository convention.
- DoD checklist: TypeScript and scoped ESLint pass. Provider capability/evidence-label tests pass (58/58). Evidence and decision artifacts exist. Review fails on boundary enforcement, evidence reproducibility, credential documentation, and git-history requirements.
- Review lanes: L-B data/services. Loaded `team-orchestration`, `strict-critique`, the workstream review system prompt, scope, dispatch, decisions, HITL register, review lanes and tracker. No Apple SDK/library implementation claim depended on model recall; the relevant runtime claim was checked safely against Bun WebCrypto with an in-memory generated P-256 key (`signatureBytes: 64`). No credential or `cert/` path was read.
- Type/lint/doc gates: `bunx tsc --noEmit -p scripts/tsconfig.json` clean; scoped ESLint clean. Security-sensitive TSDoc is not accurate (Major 4).
- Git history/staging: no prohibited trailers found, but S2 was committed inside an unrelated state/S1 commit (Major 5).
- Verification evidence: the station fixture and relationship oracle are logically discriminating. Static scans find one fetch site, a literal `GET`, no current `/v1/me/` request, no `authorize()` call, and no JWT/PEM-shaped secret in the S2 scripts/evidence/decision artifacts. Existing evidence does not reproduce the current instrument exactly (Majors 2–3).
- Decision-log status: D-024, D-028 and D-029 are reflected correctly in the provider matrix. D-041 independently replicated the central oracle through a separate instrument, which strengthens the conclusions but does not repair S2's own evidence artifact.

### Findings

- [MAJOR] The read-only method guard is disconnected from the method actually sent (`scripts/spikes/probe-apple.ts:134-140`). `get()` always calls `assertReadOnly("GET", path)` and separately hardcodes `method: "GET"` in `fetch`. Changing only the latter to `POST`, `PUT`, `PATCH` or `DELETE` leaves the guard green. The file and evidence repeatedly claim that a future write “throws” and that read-only behavior is enforced at the sole request boundary; that claim is false. Pass one method value to both the assertion and `fetch`, or remove method variability entirely and gate the resulting request object. Also reject `/v1/me` at the segment boundary, not only the substring `/v1/me/`, so the exact endpoint cannot bypass the user-library guard. This is a dispatch boundary, not defensive polish.

- [MAJOR] The evidence's request count and reproduction command do not match the current instrument (`docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md:33-37,217-225`; `scripts/spikes/probe-apple.ts:172-185,192-227,233-247,253-299,303-333`). One current run performs 36 GETs: five anonymous preflight calls, one credential sanity call, nine row-20 calls, four row-21 calls, four invalid-parameter/resource calls, and thirteen relationship-oracle calls. The report says 22 across two runs and labels the reproduction command “~22”. Because the dispatch requires exact request provenance and polite bounded traffic, this is not a cosmetic count drift; the durable evidence no longer describes the code readers are told to rerun.

- [MAJOR] Several live claims are not backed by an inspectable raw result and cannot be produced by the current probe (`docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md:43-65,174-180`; `scripts/spikes/probe-apple.ts:125-147`). The dispatch requires each finding's request, exact status and response body. F1 preserves one response but only a summary table for the other eight calls. F4 asserts `content-length: 0` and absence of `WWW-Authenticate`, but `Probe` stores only status and body—no headers—and there is no token-scrubbed raw run artifact from which to audit those header claims. Preserve a sanitized, deterministic transcript or narrow the claims to fields the instrument actually captures. D-041 independently confirms the central row-20/21/oracle results, but it does not make these S2 evidence statements reproducible.

- [MAJOR] The credential-handling TSDoc promises memory zeroing that the implementation does not perform (`scripts/spikes/mint-apple-dev-token.ts:82-109`). Only the mutable DER `Buffer` is zeroed. `pem` and `body` are immutable JavaScript strings containing the full private key text/base64 and remain live until garbage collection; they cannot be zeroed “on the way out.” The evidence correctly limits its claim to DER, but the security-sensitive function documentation says both PEM text and DER bytes are zeroed. Correct the contract and avoid claiming a property JavaScript strings cannot provide; collaboration-grade security documentation must describe the actual boundary.

- [MAJOR] S2 has no coherent commit boundary (`55b34dd`, `feat(state): screen state machine`). That commit mixes both S2 scripts and both S2 artifacts with S1 revisions and 1,200+ lines of W2 state behavior. The commit title does not mention S2 at all. This violates the workstream's granular history plan and strict-review requirement that unrelated behavior remain independently replayable/reviewable. Prepare a non-destructive history-rewrite plan for the owner that separates S2 research from S1 and W2; do not force-push or execute an owner-only rewrite.

- [MINOR] Row 21c's confidence label attaches the weaker label to the wrong proposition (`docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md:114-116,184-196`). `40012` verifies that the `syllable-lyrics` relationship exists; what remains merely likely from its name is syllable timing, and its response format is unverified. The current table says `LIKELY · live (existence)`, contradicting D-022's two-axis semantics and the already-corrected S1 analysis. Split existence, inferred timing semantics and unseen format explicitly.

### Suggestions (non-blocking)

- Add credential-free unit tests around the request constructor/guard, redactor, TTL validation and raw 64-byte ES256 signature using an in-memory generated P-256 key. The static checks pass today, but none of the safety properties goes red under a planted regression.
- Consider replacing `firstResource()`'s unchecked JSON casts with a narrow parser before the throwaway spike is reused. It does not invalidate the recorded responses, but malformed API data currently collapses to an empty resource and can produce a persuasive-looking analysis line.

### Neuve Dogfood Feedback

- Commands run: none. The repository law and `scope.md` explicitly state there is no Neuve shell or Kanban board.
- Artifact refs: not applicable.
- Review effect: no Neuve signal was used; findings come from source tracing, decision/dispatch comparison, static checks, provider tests and git-history inspection.

### Confirmed Correct

- Every current network call is a literal GET to `api.music.apple.com`; there is no current `/v1/me/` path, user token or `authorize()` call.
- Row 20 is discriminating: two songs per artist distinguish per-track from per-artist stations, and direct artist-station controls close the named confound. Cross-artist distinctness is correctly labelled non-discriminating.
- Row 21 and S2.4 use the controls correctly: `200` known-good, `40008` known-negative controls, `40012` gated relationships and `40403` recognized/no-data are distinct outcomes. D-041 independently replicated them with a separate instrument.
- Static credential scans found no JWT-shaped token or PEM key block in the reviewed scripts and artifacts. The CLI withholds the token, and probe output passes response bodies through both exact-token and JWT-shape redaction.
- No unsupported provider capability escaped: `stationSeedFromTrack` is `true`; `lyrics` and `lyricsSynced` remain `false`; rows 7/10/11/18 remain `false` with `LIKELY · docs` provenance. The scoped provider tests pass 58/58.

---

# Re-review — correction commit `6b54b46`

## Verdict: REQUEST_CHANGES

Two Major findings remain. Findings 2, 4, 5 and the original Minor are closed; Finding 1 is closed for ordinary and singly encoded paths but still has a double-encoding bypass; Finding 3 is narrowed but not closed because the advertised rerunnable transcript still omits thirteen response bodies.

### Correctness Check

- Reviewed range: `6b54b46^..6b54b46`, plus the resulting current S2 source and evidence.
- Credentials/network: no credential, environment value or `cert/` file was read; no Apple request was made.
- Credential-free commands: `bun run scripts/spikes/probe-apple.ts --request-plan` reports 5 + 1 + 9 + 4 + 17 = **36**; `bun test scripts/spikes/probe-apple.test.ts` passes **12/12**; `bunx tsc --noEmit -p scripts/tsconfig.json` passes; scoped ESLint passes; `git diff --check` passes; no prohibited trailer is present on `6b54b46`.
- Transport trace: the production probe has one call to `sendReadOnly()` and `sendReadOnly()` invokes the injected/default transport immediately after validating the same concrete `Request`. The former parallel method/path guard is gone.
- History: `s2-history-rewrite-amendment.md` accurately identifies the mixed commit and prepares a recoverable split in a disposable clone. It explicitly leaves execution and publication to the owner and contains no force-push command. The current commit does not rewrite history.

### Findings

- [MAJOR] Full-transcript mode still does not emit every response body as promised (`scripts/spikes/probe-apple.ts:185-190,318-335`; `docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md:53-59,251-289`; `docs/workstreams/002-implementation-spine/evidence/s2-review-corrections.md:44-48`). `APPLE_PROBE_FULL_TRANSCRIPT=1` only changes `report()`. The thirteen relationship-oracle requests in `p3Enumeration()` never call `report()`; they parse each body and log only status/name/code/detail. Therefore the rerun cannot emit “each request, exact status, and complete redacted response body,” and the correction artifact repeats a claim the instrument cannot satisfy. This is the remaining half of original Major 3 and directly fails the requested historical-versus-rerunnable evidence check. Route every oracle response through the same transcript sink (without duplicating requests), then add a credential-free fake-transport test proving all 36 planned requests produce 36 complete-body transcript entries when enabled.

- [MAJOR] Repeatedly encoded `/v1/me` reaches the transport (`scripts/spikes/probe-apple.ts:139-150`; `scripts/spikes/probe-apple.test.ts:51-61`). The gate decodes the pathname exactly once. Independent fake-transport probes show `/v1/%6d%65`, `/v1/%6D%65/library`, `/v1%2fme/library`, and `/v1/me%2flibrary` are rejected with zero transport calls, but `/v1/%256de/library` is accepted and calls the transport once because one decode leaves `/v1/%6de/library`. The current fixture covers only one encoded spelling and does not establish the broader encoded-variant claim. Since this is the credential boundary protecting the owner's library, reject ambiguous/residual percent encoding or canonicalize to a fixed point with a bounded decode count, and gate both single- and double-encoded segment/separator variants through `sendReadOnly()` while asserting zero transport calls.

### Closed Findings

- Original Major 1, ordinary case: the actual `Request` is validated immediately before the sole transport. All non-GET methods are structurally rejected, and exact/descendant `/v1/me` paths plus common singly encoded variants stop before transport. The repeated-encoding case above prevents full closure.
- Original Major 2: the request plan is derived from fixtures, runnable without credentials/network, asserted at runtime, and locked to exactly 36 by test. Historical “22” language is withdrawn.
- Original Major 3, historical half: the report now truthfully calls its tables redacted historical extractions, identifies which bodies were not retained, and withdraws uncaptured header claims. The rerunnable-transcript half remains open above.
- Original Major 4: memory claims are exact. Only mutable DER is described as zeroed; immutable PEM/base64 strings are explicitly described as garbage-collected and not zeroable.
- Original Major 5: the mixed history is disclosed and an owner-only, tree-preserving, backup-first amendment is prepared. No rewrite or force push was executed or delegated to a teammate.
- Original Minor: row 21c now separates relationship existence (`VERIFIED · live`), timing semantics (`LIKELY · live`) and response format (`UNVERIFIED`).

### Suggestions (non-blocking)

- None beyond the two blocking corrections above.

---

# Final re-review — correction commit `5c7b4ec`

## Verdict: REQUEST_CHANGES

One Major finding remains. The transcript defect is closed, and the bounded decoder safely rejects the tested direct, single-, double-, triple-, malformed and non-convergent forms. Nested encoded dot segments can still canonicalize to a `/v1/me` route after the gate's prefix check.

### Correctness Check

- Reviewed range: `5c7b4ec^..5c7b4ec`, plus the resulting S2 source, tests, decisions and evidence.
- Credentials/network: no credential, environment value or `cert/` file was read; no network request was made. All request execution used injected in-memory transports.
- Credential-free gates: `bun run scripts/spikes/probe-apple.ts --request-plan` reports exactly **36**; `bun test scripts/spikes/probe-apple.test.ts` passes **22/22** with 48 assertions; scripts TypeScript passes; scoped ESLint passes; `git diff --check 5c7b4ec^ 5c7b4ec` passes; no prohibited commit trailer appears on `5c7b4ec`.
- Transcript replay: the real `executeProbePlan()` produced 36 plan steps, exactly 36 transport calls, exactly 36 records, 36 unique IDs (`response-001`…`response-036`), complete bodies longer than the normal 700-character display limit, and an ordered thirteen-record oracle suffix ending in `zzz-not-a-relationship`. Transcript capture adds no duplicate transport call.
- Four-round bound: the loop is statically bounded to four iterations and rejects malformed input or any pathname that has not converged by the end. Plain paths converge immediately; single, double and triple encodings converge within the bound. The bound itself cannot loop indefinitely and fails closed on deeper encodings.

### Findings

- [MAJOR] Nested encoded dot segments bypass the `/v1/me` boundary (`scripts/spikes/probe-apple.ts:141-171`; `scripts/spikes/probe-apple.test.ts:116-153`). The decoder converges percent encoding but does not normalize dot segments after decoding. Independent fake-transport replay of `/v1/%252e%252e/v1/%256de` converges to `/v1/../v1/me`; the anchored regex does not match it, and transport is called once. A downstream URL/router normalization can collapse that path to `/v1/me`, so the credential boundary cannot treat it as a harmless catalog path. Normalize dot segments on the fully decoded pathname before applying the protected-prefix check—or reject decoded `.`/`..` segments outright—and add direct/single/double/triple combinations of encoded dot segments, separators and `me` through `sendReadOnly()`, each proving transport remains zero.

### Closed Findings

- Prior transcript Major: closed. Capture now occurs once in `executeProbeRequest()` after complete response consumption and redaction, before phase-specific parsing. All 36 records—including the 13 relationship-oracle responses—are stable and complete, with one transport invocation per record and no duplicate request.
- Prior repeated-encoding Major, ordinary forms: direct, single-, double- and triple-encoded `me` segments and separators reject with zero transport calls. Malformed `%`, truncated escapes, invalid hex, nested invalid escapes and deeper non-convergent encodings also reject with zero calls. The nested dot-segment composition above prevents complete closure.
- Historical/rerunnable evidence, memory/header wording, row 21c confidence split, request budget and owner-only history amendment remain correct and unchanged.

### Suggestions (non-blocking)

- None beyond the blocking canonical-path correction.

---

# Final re-review — correction commit `44aecec`

## Verdict: APPROVE

Zero Critical, zero Major, zero Minor. The final nested-path blocker is closed, and every original/re-review finding now has independently reproduced evidence.

### Correctness Check

- Reviewed range: `44aecec^..44aecec`, plus the resulting S2 source, tests, decisions and evidence.
- Credentials/network: no credential, environment value or `cert/` file was read; no network request was made. Every replay used an injected in-memory transport.
- Required gates: the request plan reports exactly **36**; `bun test scripts/spikes/probe-apple.test.ts` passes **31/31** with 66 assertions; `bunx tsc --noEmit -p scripts/tsconfig.json` passes; scoped ESLint passes; `git diff --check 44aecec^ 44aecec` passes; no prohibited trailer appears on `44aecec`.
- Sole transport: `executeProbeRequest()` still passes one concrete `Request` through `sendReadOnly()`, and `sendReadOnly()` validates immediately before its single transport invocation. Transcript capture remains post-response and creates no additional request.
- Four-round bound: the canonicalizer has a fixed four-iteration maximum. A benign triple-encoded catalog segment converges and reaches the fake transport once; a four-deep/non-convergent segment rejects with zero calls. Malformed encodings reject with zero calls. There is no unbounded or data-dependent loop.

### Findings

- None.

### Independent Boundary Replay

- The exact prior bypass `/v1/%252e%252e/v1/%256de` now rejects with **zero** transport calls.
- Raw, single-, double- and triple-encoded dot/slash forms all reject with zero calls.
- Separately encoded single-, double- and triple-slash compositions all reject with zero calls.
- Raw, single-, double- and triple-encoded backslash equivalents all reject with zero calls.
- Malformed, nested-invalid and deeper non-convergent encodings reject with zero calls.
- The implementation fails closed by rejecting fully decoded `.`/`..` segments and every backslash rather than relying on downstream URL/router normalization.

### Closed Findings

- Read-only enforcement is coupled to the actual request at the sole transport.
- Exact, descendant, encoded and structurally ambiguous `/v1/me` paths fail before transport.
- The reproducible request budget is exactly 36.
- Full transcript mode emits exactly 36 stable, complete body records, including the 13 oracle calls, with no duplicate transport requests.
- Historical evidence is labelled as extracted rather than retained raw output; rerunnable evidence claims match the instrument.
- Header and memory-zeroing claims describe only captured/performed behavior.
- Row 21c correctly splits verified existence, likely timing semantics and unverified format.
- The mixed historical commit has a safe, backup-first, owner-only amendment; no teammate executed or was instructed to execute a force push.
- Provider capabilities remain conservative: only `stationSeedFromTrack` moved true; lyrics capabilities and unprobed negatives remain false with accurate provenance.

### Suggestions (non-blocking)

- None.

---

# Independent confirmation — current tree

## Verdict: APPROVE

Zero Critical, zero Major, zero Minor. This confirmation treated the prior review as untrusted evidence and independently replayed the current implementation without credentials, environment inspection, network access, or access to `cert/`.

### Reproduced evidence

- `bun test scripts/spikes/probe-apple.test.ts`: **31/31 passed**, 66 assertions. The exact former bypass `/v1/%252e%252e/v1/%256de`, raw/single/double/triple encoded dot-and-slash forms, and raw/single/double/triple backslash forms all reject before the injected transport; each fixture asserts **zero transport calls**.
- The canonicalizer is structurally bounded to four decode rounds (`scripts/spikes/probe-apple.ts:166-180`). Malformed and non-convergent input fails closed; there is no unbounded loop.
- The real credential-free probe plan records exactly **36** complete bodies with stable IDs `response-001` through `response-036`, invokes the injected transport exactly 36 times, and includes the ordered 13-response relationship-oracle suffix (`scripts/spikes/probe-apple.test.ts:41-96`).
- `bun run scripts/spikes/probe-apple.ts --request-plan` reports 5 anonymous preflight + 1 credential sanity + 9 row-20 + 4 row-21 + 17 enumeration requests = **36 total**.
- `bunx tsc --noEmit -p scripts/tsconfig.json` and scoped ESLint pass.
- `git diff --check` passes independently for `6b54b46`, `5c7b4ec`, and `44aecec`. Their commit messages contain no prohibited trailers.

### Findings

- None.
