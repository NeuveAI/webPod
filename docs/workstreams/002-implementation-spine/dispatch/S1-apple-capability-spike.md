# Dispatch packet — S1 · Apple Music capability spike (docs-only)

**Status:** `Ready` · **Lane:** L-B · **Blocks:** nothing in 002; **gates S17, S08 staged-diff and `pod-edit-playlist` in a later workstream** · **Blocked by:** nothing

This is **research, not code.** You write exactly one markdown file. You touch no source.

## Why this is first

`docs/workstreams/001-interface-design-handover/readme.md` names it the first open risk:

> **Can Apple Music remove or reorder playlist tracks?** Unverified. If not, `pod-edit-playlist` is broken on the *launch* provider and the staged-diff screen loses half its purpose. **Spike this first.**

pm-spec §14.3 row 10 calls it "the single highest-risk row in this table" and notes it **inverts the usual assumption** — the belief is that Apple's public playlist API is append-only.

## Constraint you must respect

The owner has **no Apple Developer account and no signed MusicKit developer token** (H-2). So this is **docs-only**. You may not make an authenticated API call, and you must not pretend you did.

Every finding is labelled with one of exactly three confidence values, and 001 §14.0 is explicit that **an honest `UNVERIFIED` is worth more to an engineer than a confident guess**:
- `VERIFIED-docs` — Apple's published documentation states it plainly; quote it and link it.
- `LIKELY` — strongly implied but not stated; say what implies it.
- `UNVERIFIED` — could not be established from docs. **This is a perfectly good answer.** Say what would settle it.

## The six rows

Read pm-spec §14.3 for the full context of each, then answer:

| Row | Question |
|---|---|
| **10** | Can the Apple Music API **remove tracks from a library playlist**? |
| **11** | Can it **reorder** tracks in a library playlist? |
| **18** | Does MusicKit JS v3's queue object support arbitrary **splice / remove / reorder**? |
| **20** | Is there a public API for **starting a station seeded from a specific track**? |
| **21** | Is there a **lyrics** endpoint, and what entitlement does third-party *display* require? Are lyrics **time-synced**? |
| **30** | Is **offline audio** — download-for-offline — available to a browser client at all? |

## Sources
Apple's own developer documentation is primary: the Apple Music API reference and the MusicKit JS v3 reference. `~/code/agentic-context/` has no Apple clone, so the web is your source here — that is expected and is the one lane where it is correct. Prefer Apple's own pages; treat blog posts and Stack Overflow as `LIKELY` at best and name them.

## Deliverable

`docs/workstreams/002-implementation-spine/evidence/apple-capability-spike.md`:

- **Line one must be the answer to row 10**, in one sentence, with its confidence label. Everything downstream hangs off it.
- One section per row: the question, the finding, the confidence label, the exact doc URL and a short quote, and — if `UNVERIFIED` — precisely what would settle it (which endpoint to call with which token).
- A **consequences** section naming, per row, which 001 surface changes if it resolves the unfavourable way. Row 10/11 → `pod-edit-playlist`'s `remove`/`reorder` fields unimplementable on the launch provider, S08's staged diff shows `+` only, drag handles do not render. Row 21 → S16, and Now Playing's centre-cycle drops from four stops to three. Row 30 → copy on five screens, and `DISCONNECTED` becomes browse-cached-metadata-only.
- A closing table ready to paste into `packages/providers`' Apple `supports()` matrix, with every unresolved row **`false`** — a capability is absent until proven present.

## Guardrails
Write that one file and nothing else. No source files, no `package.json`, no edits to 001 docs. Do not install anything. Do not sign up for anything, do not create an Apple account, do not use the owner's email anywhere.

## Decision rules
- **Proceed but log** in `decisions/s1.md`: any judgment call between two contradictory sources.
- **Stop and ask the lead:** if row 10 resolves as *supported* — that is good news that changes later scope, and the lead wants to know immediately rather than at report time.

## Review
Lane L-B. The reviewer's job here is to check that **no confidence label is inflated** — that every `VERIFIED-docs` carries a quotable source, and that nothing was upgraded from `UNVERIFIED` to `LIKELY` on vibes. 001 §15.3 failure mode 14 is exactly this: *an `UNVERIFIED` row treated as a fact.*
