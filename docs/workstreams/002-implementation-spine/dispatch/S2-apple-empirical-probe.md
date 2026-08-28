# Dispatch packet — S2 · Apple Music empirical probe (developer token, READ-ONLY)

**Status:** `Ready` · **Lane:** L-B · **Blocked by:** nothing · **Follows:** S1 (docs-only), D-016 (credentials available)

## Why this exists
S1 answered six capability rows from documentation alone because no token existed. A signing key is now present. This slice converts the **one finding S1 deliberately held down for want of a token** from an inference into a demonstration.

## THE BOUNDARY — read this before anything else

**Read-only, developer token only. No user token. No library writes. None.**

Rows 10, 11 and 18 could in principle be settled by attempting them — but that means **creating and mutating playlists in the owner's real Apple Music library**. That is an irreversible change to someone's personal music library and **it is not authorised**. Do not obtain a user token, do not call `authorize()`, do not create a playlist, do not add or remove a track, do not rate anything.

If you conclude a write probe is the only way to settle something: **say so in your report and stop.** The lead will ask the owner. An unauthorised write here is the worst possible outcome of this slice, worse than learning nothing.

## Credential handling — repo law, D-017
- The key is at `cert/AuthKey_*.p8`, read via an **env var**, never hardcoded.
- **Never `cat`, `echo`, print, log, quote or copy its contents** — not into your report, not into evidence, not into a comment. Read it only inside the signing call.
- The signed token is short-lived and **must not be written to any file or printed**. Not in evidence, not in a diary, not in your report.
- If any key material or token appears in your output, that is a Critical incident — say so immediately rather than continuing.

## Slices

### S2.1 — Token minting spike
`scripts/spikes/mint-apple-dev-token.ts`, run with `bun`. ES256 JWT signed with the `.p8`; `kid` from the filename, `iss` = the Team ID, short `exp`. Key path and Team ID from env. This is a **throwaway spike**, not `packages/server-core` — but write it so the real Effect service can be lifted from it later, and note in your diary what would change.

### S2.2 — Row 20: is a song's `station` relationship actually seeded from that song?
S1 named the exact probe. `GET /v1/catalog/us/songs/{id}/station` for **three songs by three different artists**; compare returned station ids and names. If all three return the same artist-level station, the relationship is not track-seeded and row 20 is `VERIFIED-docs` **not supported**. If each returns a distinct track-seeded station, row 20 upgrades to `VERIFIED-live` supported.

This matters because Apple's own description is only *"The station associated with the song"* — never "seeded from" — and `Artists` carries an identically-named relationship, which is the live reason to doubt.

### S2.3 — Row 21: does a lyrics endpoint exist at all?
S1 claims ⚠ **001 §14.3's premise is wrong** — that no public lyrics endpoint is documented. Probe `GET /v1/catalog/us/songs/{id}/lyrics` with the developer token and record the exact status code and error body. A `401`/`403` means it exists and is gated; a `404` supports S1. **Either result is a good result.** Record it verbatim.
**Do not attempt to settle the entitlement question** — it is a licensing matter that needs Apple in writing and no API call resolves it. Saying so is the correct answer.

### S2.4 — Confirm the negatives are still negative
Enumerate the live catalog and library endpoint surface reachable with a developer token and confirm S1's exhaustive-enumeration claim holds against the running API, not just the docs. This is the weakest joint in S1's argument and the reviewer was pointed at it — an independent check from a different angle is worth more than a second read of the same page.

## Guardrails
Write: `scripts/spikes/mint-apple-dev-token.ts`, `scripts/spikes/probe-apple.ts`, `docs/workstreams/002-implementation-spine/evidence/apple-empirical-probe.md`, `docs/workstreams/002-implementation-spine/decisions/s2.md`. Nothing else.
Do not touch `packages/**`, `apps/**`, `docs/workstreams/001-*`, `design.pen`, or S1's files. Do not edit S1's evidence — if you contradict it, say so in **your** file and let the lead reconcile.
Stage with explicit pathspecs; other lanes are live in this tree. Never `git add -A`.
Be polite to the API: a handful of requests, not a sweep.

## Verification
Every finding carries the request made, the exact status code, and the response body (**redacted of any token**). Labels per 001 §14.0, with one addition: **`VERIFIED-live`** for anything demonstrated against the running API — a stronger label than `VERIFIED-docs`, and the only new one you may introduce.

## Report to the lead
Row 20 first, with its label. Then row 21's status code. Then whether anything contradicts S1. Then, explicitly: **did you need a write probe, and did you refrain?**
