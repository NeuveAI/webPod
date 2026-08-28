# 002 — Initiative tracker

The operational queue for this workstream. There is no Kanban board and no `neuve` shell in this repo (owner ruling, 2026-08-28) — **this file is the queue.** The lead updates it at every state change; teammates report against their slice id.

**Status vocabulary:** `unblocked` · `dispatched` · `in-progress` · `in-review` · `changes-requested` · `approved` · `owner-validation` · `done` · `blocked`

---

## Slices

| id | Slice | Lane | Status | Teammate | Reviewer | Blocked by | Evidence |
|---|---|---|---|---|---|---|---|
| **S1** | Apple Music capability docs spike (§14.3 rows 10, 11, 18, 20, 21, 30) | L-B | `in-review` | sub-agent (Opus) | sub-agent (Opus) | — | `evidence/apple-capability-spike.md` |
| **S2** | Apple empirical probe — developer token, **read-only** | L-B | `dispatched` | sub-agent (Opus) | — | — | `evidence/apple-empirical-probe.md` |
| **W0** | bun monorepo scaffold + tokens + repo hygiene | L-A | `in-progress` — 2 of 3 commits landed | sub-agent (Opus) | — | — | `evidence/w0-*` |
| **W5a** | Static gate harness (`bun run gates`) | L-A | `blocked` | — | — | W0 | `evidence/w5a-*` |
| **W1** | Provider contract + fixture + apple/spotify stubs | L-B | `blocked` | — | — | W0 | `evidence/w1-*` |
| **W2** | Jotai store, detent reducer, screen state machine | L-C | `blocked` | — | — | W0 | `evidence/w2-*` |
| **W3** | Panel DOM — shell, list primitives, S03 / S08 / S13 | L-D | `blocked` | — | — | W0, W2 contract | `evidence/w3-*` |
| **W4** | Device layer — materials, geometry, screen mesh boundary | L-E | `blocked` | — | — | W0 | `evidence/w4-*` |
| **W6.0** | Capability probe (`_probe.capabilities`) — **jumps the queue** | L-E | `blocked` | — | — | W0 | `evidence/w6-capability-probe.txt` |
| **W6** | Composite seam, T1 html-in-canvas | L-E | `blocked` | — | — | W3, W4 | `evidence/w6-*` |
| **W5b** | Browser checks — Playwright, axe, greyscale, colourway pairs | L-A | `blocked` | — | — | W3, **W6** | `evidence/w5b-*` |

> Full provenance for every ruling below — rationale, consequences, reversal cost, and which 001 instructions were knowingly overridden — is in **`decision-log.md`**. The `Log` table at the foot of this file is a timeline; `decision-log.md` is the record.

## Open risks

| id | Risk | Opened | Owner | State |
|---|---|---|---|---|
| **RISK-01** | T3 CSS-3D overlay is the eventual shipping default and is **not built**. Until it lands webPod runs only in a flagged Canary. Not self-correcting: `HTMLTexture` degrading to a plain `Texture` gives a blank screen mesh, not T3. **Release gate: no user-facing release until T2–T4 land and §15 is signed off flag-off.** Re-read at the start of every subsequent workstream. | 2026-08-28 | lead | open, accepted |
| **RISK-02** | The `html-in-canvas` WebGL entry point is mid-rename (`texElementImage2D` ↔ `texElementSubImage2D`). Mitigated by routing through three.js `HTMLTexture` rather than the raw API; a direct call in our source is a blocking finding. | 2026-08-28 | W6 | open, mitigated |

## Owner-only gates outstanding

| id | Gate | Waits on | Status |
|---|---|---|---|
| **H-10** | Interactive MusicKit sign-in, to mint a Music User Token so D-018's write probes can actually run | S2 delivering the auth page + probe script | `not ready` |
| **H-1** | History rewrite + force-push (`.claude/`, `CLAUDE.md`→`AGENTS.md`, trailer removal) | lead prepares commands; **owner executes** — agents never force-push | `prepared? no` |
| **H-5** | **U14** thumb-occlusion check, on a phone, in hand | W3 wheel interactive | `not ready` |
| **H-6** | Aesthetic sign-off: does the device read as the object; both-colourway polarity; panel legibility at 272×204 | W3 + W4 previews | `not ready` |

## Teammate roster

Peer sessions addressed by name via `SendMessage`. Recorded here so the lead can re-attach after a context compaction.

| Slice | Session name | Role | Dismissed? |
|---|---|---|---|
| — | — | — | — |

### Teammate sourcing — read before dispatching anything

**The 16 `coding-x-machina-local-*` peers on `ListAgents` are NOT available.** They are a live team running ARTEXI-WORK-137 in `/Users/vinicius/code/artexi-quartus`, inside `.claude/worktrees/` checkouts from which `/Users/vinicius/code/webPod` does not resolve. `ListAgents` reports them `idle`, which means *between turns*, **not unassigned**. Two were probed on 2026-08-28 and both correctly refused.

Rules learned, apply them before every dispatch:
1. `idle` on the roster is availability-of-the-moment, never evidence of being unassigned. Probe `pwd` + repo presence + current assignment **before** sending a packet.
2. A teammate must be running **in this repo's working tree**. A peer on the same machine in a foreign worktree cannot take a slice.
3. Owner protocol observed in this environment: **Opus implements, Fable reviews.** Do not hand an implementation slice to a session running a review lane, and never have a reviewer author repo law.
4. Never pull a session off a live audit. A standing reviewer is not spare capacity.

## Log

| Date | Event |
|---|---|
| 2026-08-28 | W0 dispatched to `logical-giraffe` and **withdrawn**; S1 probe to `cosmic-dream` answered and **withdrawn**. Both are committed ARTEXI-WORK-137 reviewers in artexi-quartus worktrees with no webPod tree. Lead error: routed off `ListAgents` idle status without probing assignment. Rules recorded above. Workstream needs fresh sessions started in this repo before any dispatch — the peer sessions report as "a Claude session on another machine, over Remote Control", so shared-filesystem access to `/Users/vinicius/code/webPod` is **unconfirmed**. No further dispatch until a peer reports back with its `pwd` and repo state. |
| 2026-08-28 | Owner rulings: **write probes authorised** on a throwaway playlist only (D-018), and **offline cut repo-wide** (D-019, ⚠ deviates from 001 §14.2/§5.1/J6b — closes H-7). Obstacle surfaced: write probes need a Music User Token from an interactive browser sign-in, which no script can obtain — H-10 opened, S2 amended to deliver the auth page rather than flail at it. |
| 2026-08-28 | **S1 returned: row 10 NOT SUPPORTED (`VERIFIED-docs`)** — Apple's playlist API is append-only, the bad-news branch. Row 18 makes S17 read-only on **both** providers. Row 30 settles the Service-Worker premise. Row 21 ⚠ contradicts 001 §14.3's own premise. Antagonistic review dispatched (separate instance). Findings recorded as D-015; **do not build on them until review returns APPROVE**. |
| 2026-08-28 | **Owner supplied MusicKit credentials** (`cert/`). D-006 partially superseded by D-016. Key arrived untracked but **not gitignored** — closed immediately (`cert/`, `*.p8`, `*.pem`, `*.key`, `*.p12`), verified with `git check-ignore`. D-017 opened as credential-handling law: server-side only, never in git/logs/prompts. S2 dispatched: **read-only probes with a developer token; library writes explicitly unauthorised** because they would mutate the owner's real Apple Music library. |
| 2026-08-28 | Owner amendment: fallback tiers may require **different textures, shaders or even a different renderer**, accepted as end-of-line work. Seam widened — a strategy now declares `requires: {renderer, materialVariant, shaderVariants, textureSet}`, and W4's materials/env-map/shaders become injected inputs defaulting to §12.3 rather than inlined constants. Explicit anti-overbuild rule attached to both packets: injection points only, exactly one variant proven end to end, **no variant registry or second renderer in 002**. |
| 2026-08-28 | **Owner ruling: T1 `html-in-canvas` is the main path, built first; T2/T3/T4 deferred, seam designed now.** W4 promoted from throwaway spike to the device layer proper (it must expose a screen mesh). New lane W6 owns `packages/composite` — tier detection + `PanelPixelSource` strategy. W0 amended mid-flight to scaffold a 10th package. U10's a11y re-review pulled into scope: axe must run on the composited page. RISK-01 and RISK-02 opened. |
| 2026-08-28 | Owner ruling: fall back to sub-agents for implementation, since no session exists in this working tree. W0 and S1 dispatched in parallel (zero file overlap). Reviewers still to be spawned as separate instances before either slice is accepted. |
| 2026-08-28 | Workstream opened. 001 handover ingested. Scoping bundle written. No Kanban (owner ruling). Force-push barred for all agents (owner ruling, now repo law). H-2 answered: Apple Music docs-only. H-3, H-4 defaulted by lead. |
