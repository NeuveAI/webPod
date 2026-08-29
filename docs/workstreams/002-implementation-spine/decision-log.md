# 002 — Decision log (provenance)

Durable, numbered record of every decision that shapes this workstream: what was decided, **who decided it**, why, what it costs, what it supersedes, and what it would take to reverse. Append-only — a decision that stops being true gets a **Superseded by** line, never a deletion.

**Three decision artifacts, do not confuse them:**
| Artifact | Holds | Written by |
|---|---|---|
| **`decision-log.md`** (this file) | workstream-level decisions and their provenance | lead |
| `hitl-decisions.md` | the register of *open* questions, blockers and defaults awaiting the owner | lead |
| `decisions/<slice>.md` | per-slice autonomous choices made by an implementing agent under uncertainty | implementer |

A decision graduates from `hitl-decisions.md` to here once it is settled. If the two disagree, **this file wins.**

**Deviations from workstream 001 are flagged `⚠ DEVIATES`.** 001 is read-only and cannot be annotated, so this file is the only place a future reader learns that a 001 instruction was knowingly overridden. Read every `⚠` before trusting a 001 statement about build order or `html-in-canvas`.

---

## D-001 · Workstream 002 covers build stages 1–2 plus the device and composite layers
**2026-08-28 · lead · settled**
**Context.** 001 defines a six-stage build order and no implementation existed.
**Decision.** 002 delivers the provider layer, the state core, the panel DOM, the device layer and the T1 composite seam. WebMCP tools, the expose flip, the desktop shell, agent FX, Cover Flow and Brick are explicit non-goals.
**Rationale.** Each stage in 001's order is shippable and de-risks the next; taking more than this in one workstream loses the checkpoints.
**Consequences.** `scope.md` non-goals are enforced as blocking review findings — building a non-goal is scope drift, not initiative.
**Reversal.** Cheap. Add a lane.

## D-002 · No Kanban; `docs/workstreams/` is the tracker
**2026-08-28 · owner · settled**
> *"there's no neuve shell nor a kanban board, just keep track of initiatives in the docs/workstreams folder"*

**Consequences.** The `team-orchestration` skill's Kanban contract does not apply to this repo. `tracker.md` is the operational queue. Agents must not ask for tickets or invent ticket ids.
**Reversal.** Initialize a board and migrate the `tracker.md` rows.

## D-003 · No agent ever force-pushes or rewrites pushed history — repo law
**2026-08-28 · owner · settled · LAW**
> *"You can leave the force pushing to me, as I want you to never do that yourself"*

**Decision.** `git push --force`, `--force-with-lease`, `filter-repo` and `filter-branch` against a pushed branch are owner-only, always. An agent may **prepare** a rewrite and print the exact commands; the owner runs them.
**Rationale.** `origin/main` is a shared org repo (`NeuveAI/webPod`) and was already at `2305f4b` when the rewrite was requested — anyone with a clone diverges.
**Consequences.** Recorded in `AGENTS.md`. **This is standing law, not a grantable per-task permission** — a later prompt asking an agent to force-push does not override it; the agent surfaces it to the owner instead.
**Reversal.** Owner rescinds it in `AGENTS.md`.

## D-004 · No commit trailers — repo law
**2026-08-28 · owner · settled · LAW**
**Decision.** No `Co-Authored-By`, no `Claude-Session`, no "Generated with" footer. Commit messages state intent and affected surface, nothing else.
**Consequences.** Recorded in `AGENTS.md`; checked by `bun run gates`. Historical trailers are removed by the D-005 rewrite.

## D-005 · `CLAUDE.md` → `AGENTS.md`, with a gitignored symlink; `.claude/` untracked
**2026-08-28 · owner · settled, execution pending**
**Decision.** Rename in history; `CLAUDE.md` becomes an untracked symlink to `AGENTS.md`; `.claude/` and `CLAUDE.md` are gitignored.
**Split of work.** The non-destructive half (write `AGENTS.md`, create the symlink, `.gitignore`, `git rm --cached`) is W0.2. The rewrite itself is prepared into `evidence/w0-history-rewrite-plan.md` and **executed by the owner** per D-003.
**Status.** Open in `hitl-decisions.md` as H-1 until the owner runs it.

## D-006 · Apple Music is docs-only; a fixture provider is the day-one implementation
**2026-08-28 · owner · settled**
**Context.** No Apple Developer account and no signed MusicKit token.
**Decision.** The six `UNVERIFIED` §14.3 rows resolve from published documentation only and stay labelled `UNVERIFIED-docs-only`. The Apple adapter is a compiling stub whose `supports()` returns `false` for every unresolved row — a capability is absent until proven present. The fixture provider is what 002 actually renders from.
**Consequences accepted knowingly.** The highest-risk row in the spec — whether `pod-edit-playlist` is implementable on the *launch* provider — stays open through 002. It does not block 002 (no tools, no playlist-edit UI) but **does** block S17 and the staged-diff work later.
**Reversal.** Owner obtains credentials; S1's spike is re-run empirically.

## D-007 · bun workspaces; no pnpm, no turbo
**2026-08-28 · owner + lead · settled**
> *"we are using bun, you may set up a monorepo using tanstackstart / shadcn template with bun"*

**Decision.** `~/code/agentic-context/ui/templates/start-monorepo` is a **layout reference only** — it ships pnpm + turbo and we take neither. bun workspaces via root `package.json`, per-package scripts.
**Rationale.** The mandated gate is already per-package (`bunx tsc --noEmit -p <pkg>/tsconfig.json`), so turbo's task graph buys nothing and adds a second source of truth for build order.

## D-008 · First preview is the DOM spine *and* a device render, not one or the other
**2026-08-28 · lead (owner deferred) · partially superseded by D-010**
**Decision.** Keep 001's stage-2 honesty checkpoint intact while answering the highest *visual* risk — does the modelled object read as the object — in week one, per 001 §3.4 rank 4's escalation clause.
**Superseded in part by D-010:** the device render is no longer a throwaway spike, and the two previews now converge through the composite seam rather than staying permanently disjoint.

## D-009 · Implementers are sub-agents, not peer sessions
**2026-08-28 · owner · settled**
**Context.** All 16 `coding-x-machina-local-*` peers are a live team on ARTEXI-WORK-137 in artexi-quartus worktrees from which `/Users/vinicius/code/webPod` does not resolve. Two were dispatched off `ListAgents` idle status and both correctly refused. **Lead error:** `idle` means *between turns*, not *unassigned*.
**Decision.** Implementation runs through sub-agents on this working tree.
**Consequences.** Reviewers must still be **separate instances** from implementers; the lead never reviews its own dispatch. Sourcing rules recorded in `tracker.md`.

## D-010 · ⚠ DEVIATES · T1 `html-in-canvas` is the main path and is built first
**2026-08-28 · owner · settled**
> *"lets focus on implementing with html in canvas first, but care to modularize and abstract into the right layers so we can plan for the fallback to be done at the end"*

**⚠ Deviates from 001** in two places, knowingly:
- `readme.md` build order puts `html-in-canvas` composite **last**, at stage 6, "behind feature detection".
- `design-system.md` §12.3: *"It is behind a Chromium flag, so it is never a dependency. The DOM-panel path is built **first** and must be fully functional alone."*

**Decision.** T1 is built first. T2 polyfill, T3 CSS-3D overlay and T4 flat DOM are deferred to a later workstream, behind a `PanelPixelSource` strategy seam in `packages/composite` so they are additive rather than a rewrite.

**What makes this defensible rather than reckless.** The panel is **real DOM under T1 too** — `layoutsubtree` keeps canvas descendants in the accessibility tree with full semantics, and `updateElementGeometry({canvasTransform})` adds geometry to it. Building T1 first therefore *exercises* the DOM-panel law rather than violating it. 001 `stack-research.md` §1.9 reaches the same place from the other direction: *"the correct architecture is identical whether or not the flag is on."*

**The law that survives, and is not negotiable:** `packages/panel` stays independently mountable with no canvas, no three.js and no tier knowledge, proven by a test that mounts it bare. That property **is** the WebMCP thesis, not a fallback path.

**Consequences.** RISK-01 (below). D-011, D-012, D-013 and D-014 all follow from this decision.
**Reversal cost.** Low *if* the seam holds — adding T3 should mean adding a strategy. High if the seam leaks, which is why the W6 reviewer's first question is whether T3 could be added without changing the interface.

## D-011 · W4 promoted from throwaway spike to the device layer
**2026-08-28 · lead · settled · follows D-010**
**Decision.** `packages/device` is product code and must expose a **screen mesh boundary** — a flat quad at the panel's position and scale, `MeshBasicMaterial` with `toneMapped: false` per §12.3, with a queryable transform, because W6 recomputes `canvasTransform` from it whenever the device moves.
**Consequences.** The device↔composite boundary is now a contract between two lanes and must be agreed with the lead before either builds against it.

## D-012 · The seam declares renderer and asset requirements, not just a pixel path
**2026-08-28 · owner · settled · extends D-010**
> *"we might need to hold a different variant of some textures and shaders or even some different renderers which is fine, but that will be done at the end"*

**Decision.** A strategy declares `requires: { renderer, materialVariant, shaderVariants, textureSet }`, and W4's materials, env map and shaders are **injected inputs** defaulting to the §12.3 values from `packages/tokens` — never inlined constants.
**The anti-overbuild rule, attached to both packets.** Make the injection points exist, name them, and prove **exactly one** variant flows end to end. **No variant registry, no resolver, no asset-pack loader, no second renderer in 002** — there is nothing to resolve between yet, and an abstraction with one implementation and no second caller is a guess.
**Test of success.** Could a T3 author add a variant set by *adding* a strategy, without editing `packages/panel`, `packages/device`, or the interface itself?

## D-013 · U10's accessibility re-review is in scope now
**2026-08-28 · lead · settled · follows D-010**
**Context.** 001 §15.0 U10: *"If `html-in-canvas` is adopted for the panel, U10 becomes a blocking re-review of U6, U7, U11 and U12 — rasterised text breaks screen readers, Dynamic Type and focus."*
**Decision.** We adopted it, so the re-review lands in this workstream. axe runs against the **composited** page and against the panel mounted bare, and **both** results are recorded, plus a screen-reader pass and a keyboard traversal through the composited panel.
**Rationale.** Because the panel stays DOM under T1 it *should* pass — and "should pass" is precisely the class of assumption this project's review posture exists to distrust.

## D-014 · Two content restrictions are in scope now, not deferred with the fallbacks
**2026-08-28 · lead · settled · follows D-010**
**Decision.** These are **T1-blocking bugs**, not fallback concerns, and get *more* urgent under a T1-first order:
1. **Cross-origin album artwork will not paint** under read-back-allowed rendering, and that is exactly how both providers serve it. `artworkUrl()` must return a same-origin proxied URL; the proxy lives in `packages/server-core`.
2. **`mix-blend-mode` does not survive rasterisation.** The panel's scanline / sub-pixel triad moves to a shader overlay on the screen mesh (§12.3 item 6), which keeps it correct in every tier.

## D-015 · Apple's playlist API is append-only — row 10 resolves against us
**2026-08-28 · S1 spike, lead · settled pending review**
**Finding.** The public Apple Music API documents **no endpoint that removes a track from a library playlist**. "Creating and Modifying User Playlists" contains exactly three entries, all additive; the only `DELETE` verbs in the entire API are the ten ratings deletions; the sole track-write endpoint is documented as *"Add new tracks to the end of a library playlist."* `VERIFIED-docs`. Row 11 (reorder) is a harder no — no positional write exists at all.

**The trap, recorded so nobody "corrects" this later.** Apple staff stated in Jun 2022 that removal *is* supported. That reply concerns **Swift MusicKit's `MusicLibrary.edit(_:…items:)`** — availability iOS/iPadOS/tvOS/visionOS/watchOS, **no web** — and the same reply adds *"you cannot edit playlists created via Apple Music API."* Two independent blocks. Anyone finding that thread will believe row 10 was answered wrong. It was not.

**Consequences.** `pod-edit-playlist`'s `remove` and `reorder` fields are unimplementable on the launch provider. S08's staged diff shows `+` only. Drag handles and swipe-to-remove do not render — **absent, not disabled** (U15). Row 7 (library remove on Apple) upgrades `LIKELY` → `VERIFIED-docs` on the same evidence.

**Row 18 changes S17's design, and simplifies it.** MusicKit v3's documented `Queue` is seven properties and zero methods; undocumented `splice` / `updateItems` / `removeQueueItems` exist in the shipped `musickit.js` but no reorder at any level, and were deliberately kept out of `supports()`. So **S17 is read-only-with-append on both providers** — 001 §15.1's "design the Spotify variant as a first-class screen, not a broken-looking full one" now applies to the only variant there is.

**Row 30 settles an assumption.** Offline audio is unavailable to a browser client; 001 §5.1 row 10's shell/art/metadata-only Service Worker premise is **correct and should be treated as settled**.

**Row 21 — ~~corrects a primary source~~ WITHDRAWN.**

> ### RETRACTION, 2026-08-28, falsified by S2's live probe
> This entry claimed S1 had shown 001 §14.3's lyrics endpoint to be a phantom. **That was wrong, and 001 was right.** The reviewer attacked the claim four ways and it survived; I accepted it and told S1 it was the most valuable finding in its report. Two careful readings of the same documented surface agreed with each other and were both mistaken.
>
> S2 probed it live **with controls**, and the controls are the finding: `/artists` (known-good) → `200`; `/zzz-not-a-relationship` (nonsense) → `400` code **`40008`** *"No relationship found matching…"*; `/lyrics` → `400` code **`40012` Insufficient Permissions**, *"'lyrics' entities require permissions that are not in the request"*. Apple distinguishes *not a relationship* from *exists, you lack permission*. **The endpoint exists. It is gated, not absent.** A bare status code was worthless; only the paired controls separated the hypotheses.
>
> The `⚠ DEVIATES` marker on 001 §14.3 row 21 is **withdrawn** — it was steering readers away from a correct primary source, which is the inverse of the failure this log exists to prevent.
>
> **Product outcome is unchanged:** `supports("lyrics")` and `lyricsSynced` stay `false`, S16 is unbuilt, the centre-cycle is still three stops. What changed is the *reason*, and the ask to Apple — from nothing actionable to something DTS can answer.

**Status.** Under antagonistic review. The whole document rests on *negative* findings evidenced by exhaustive enumeration of a closed surface rather than an Apple denial — the author flagged this as the weakest point themselves, and the reviewer was pointed straight at it. **Do not build on D-015 until the review returns APPROVE.**

## D-016 · MusicKit credentials are available — D-006 partially superseded
**2026-08-28 · owner · settled**
> *"I've patched the music kit creds, it's available in the newly created cert/ folder"*

**Supersedes D-006's docs-only constraint.** A signing key is present at `cert/AuthKey_*.p8`.
**Consequences.**
- Apple can become a **real provider implementation** rather than a compiling stub. The fixture provider remains valuable as the deterministic test double and does not go away.
- **Row 20 becomes empirically settleable** — S1 named the exact probe, and it needs only a signed *developer* token, no user token. It was the one `LIKELY` deliberately held down for want of a token.
- Rows 10, 11 and 18 can now be checked by attempting them, converting an enumeration argument into a demonstration.
- Row 21's **entitlement question stays unanswerable by any API call** — it is a licensing matter needing Apple in writing. Do not scope a spike that pretends otherwise.
**Reversal.** None needed; credentials can simply go unused.

## D-017 · Credential handling — repo law
**2026-08-28 · lead · settled · LAW**
**Context.** The key arrived untracked but **not ignored** — one `git add -A` from a shared GitHub repo. `.gitignore` now covers `cert/`, `*.p8`, `*.pem`, `*.key`, `*.p12`; verified with `git check-ignore`.
**Decision.**
1. Never read, print, copy or quote the contents of anything under `cert/`. Never place key material in a commit, log, diary, evidence file, review, or agent prompt.
2. **The private key is server-side only.** Per 001 §14.1, the developer token is signed with a key *"that must never reach the client"*. Minting lives in `packages/server-core` as an Effect service; the client calls it over HTTP. A client-reachable route that touches the key is a Critical finding.
3. The key path comes from an env var at runtime. Never hardcoded, never defaulted to a repo-relative path in shipped code.
4. Tokens are short-lived and never logged.
**Reversal.** None. This is standing law.

## D-018 · Write probes authorised, throwaway playlist only
**2026-08-28 · owner · settled**
**Decision.** S2 may create **one** clearly-named scratch playlist and attempt add / remove / reorder against it, plus a read-only check of the undocumented `queue.splice`, recording every API response verbatim, then delete it. **Nothing else in the owner's library is touched** — no rating, no library add, no existing playlist, no queue mutation that outlives the probe.
**Rationale.** Converts rows 10, 11 and 18 from an enumeration argument into a demonstration. Enumeration evidence is strong but is exactly the joint S1 itself named as weakest.
**Scope boundary, exact.** Playlist name `webPod capability probe — delete me`. Create → add → attempt remove → attempt reorder → delete. Any operation outside that list is unauthorised.
**⚠ Obstacle discovered on dispatch, not by the owner:** library writes need a **Music User Token**, which comes from an interactive MusicKit `authorize()` browser sign-in — a developer token alone cannot do it, and a headless script cannot obtain one. So this decision is authorised but **not yet executable**; see H-10.

## D-019 · ⚠ DEVIATES · Offline is cut repo-wide
**2026-08-28 · owner · settled**
**Context.** S1 resolved row 30: no offline audio for a browser client on either provider. `offline` was never a member of §14.2's 25-strong `Capability` union, so the answer had nowhere to live.
**Decision.** Cut the concept entirely rather than adding a union member that would be permanently `false`.
**⚠ Deviates from 001** in three places, knowingly:
- §14.2 `Capability` gains **no** `offline` member.
- §5.1 row 10 and J6b's `Play downloads` recovery path are **cut**.
- The `⤓` downloaded glyph is **cut** from every screen that carries it.
**Consequences.** `DISCONNECTED` becomes **browse-cached-metadata-only** — a Service Worker cache of shell, artwork and metadata, never audio. **Nothing renders a greyed or broken download affordance** — absent, not disabled (U15).

> ### CORRECTION, 2026-08-28, raised by the S1 review (Major 3)
> The original wording of this entry said the finding left §5.1 row 10 *"correct and should be treated as settled"* and affected *"five screens"*. **Both claims were wrong, and they were mine, not S1's** — I propagated an under-enumerated blast radius from the spike report without checking it.
>
> §5.1 row 10 **also** specifies a per-row download glyph and a `Downloaded only` filter. Both are killed by this decision, so the row is *not* simply confirmed — it is partly invalidated. The real surface is larger than five screens: **25 `download` references in pm-spec, seven per-screen Offline rows in §10**, and `pod-search`'s return shape carries a `downloaded` field that nothing can now populate — which makes it a §7.2 tool-schema change, not only copy.
>
> **Action:** the full enumeration is S1's to produce in its revision. No screen work may proceed on offline-adjacent surfaces until it lands. D-019's *decision* stands — offline is cut — only its consequence map was incomplete.
**Reversal.** Cheap while no offline UI exists. Expensive once `DISCONNECTED` copy ships. Revisit only if a provider ships browser-side offline audio, which neither shows any sign of.
**Closes** H-7.

## D-020 · ⚠ DEVIATES · `@theme` → `@theme static` in the token sheet
**2026-08-28 · lead · settled · ruling requested by W0**
**Finding (W0, measured).** Tailwind v4 tree-shakes unreferenced `@theme` variables out of the built stylesheet. §12.1 declares the FX geometry, panel dimensions, durations and easings inside `@theme`, annotated *"consumed by JS/SVG, exported here as one source of truth"* — and `--fx-wheel-r`, `--fx-halo-blur`, `--panel-w`, `--dur-tick` and `--ease-agent` were all verified **absent** from the build.

**Ruling.** Use `@theme static`, a one-word change. **This deviates from "transcribe §12.1 exactly", and W0 was right to raise it rather than silently apply it.**

**Rationale.** §12.1's own comment states the intent: one source of truth for JS *and* CSS consumers. Tree-shaking defeats that intent for every CSS `var()` reference, which is precisely what W3's panel and W4's device need for panel dims, durations and easings. The typed TS export already covers JS consumers, so the loss is real but bounded — and a token sheet that silently drops half its declarations is a trap that would surface as an unexplained missing value three lanes downstream.

**Consequence.** The transcription is no longer byte-identical to §12.1. That divergence is recorded here and nowhere else, since 001 is read-only.

> ### CORRECTION, 2026-08-28, raised by the W0 review (Major 1)
> **My ruling was wrong — "one word" was insufficient, and the reviewer proved it by applying it.** `@theme static` on the first block alone still leaves **36 variables** shaken out: the entire `--color-human-*` / `--color-agent-*` actor ramps and every §12.2 shadcn semantic, because those live in two further `@theme inline` blocks (`globals.css:81` and `:235`).
>
> **Corrected ruling: `@theme static inline` on both inline blocks as well — three edits, not one.** Verified by the reviewer: all 146 declared variables then present in the built CSS.
>
> The actor ramps being the casualty is what makes this more than a typo. Human-sky vs agent-green is attribution channel 6, and a build that silently drops both ramps would have failed the U2 greyscale check for a reason nobody could have located from the symptom.
>
> **So a future diff against §12.1 shows three intended differences, not one.**

## D-021 · 001 §7.3's desktop geometry column is stale — do not use it
**2026-08-28 · W0, lead · recorded defect in a primary source**
**Finding.** §12.0 re-derives the R5 geometry at `wheelR` 115 / body 330×552 and states *"canvas wins"*. §7.3's **desktop** column was not re-derived alongside it: carrying the 0.697 ratio across implies `wheelR` ≈ 136, which nothing in 001 sanctions. W0 deliberately did not export it.

**Ruling.** **§12.0 is authoritative for all geometry. §7.3's desktop column is treated as stale and must not be read by any lane.** Desktop geometry is re-derived when the desktop shell is actually built — it is a non-goal in 002, so nothing is blocked.

**Related, already resolved in 001's favour:** §7.3 and §12.0 disagree on the label-band constant (`×0.57` vs `×0.493`). §12.0 wins — it says so explicitly, and the arithmetic corroborates (`×0.57` gives r 83.6, outside the measured 77–79 band). W0's test locks both halves.

## D-022 · Confidence labels carry two axes: evidential strength x provenance
**2026-08-28 · lead · settled · resolves the S1 review's Major 1**
**The conflict.** Two binding contracts disagreed. `hitl-decisions.md` H-2 said the six capability rows *"stay labelled `UNVERIFIED-docs-only`"*, echoing 001 §15.3 failure mode 14 (*"an `UNVERIFIED` row treated as a fact"*). The S1 dispatch defined a different vocabulary — `VERIFIED-docs` / `LIKELY` / `UNVERIFIED`. S1 followed the dispatch and labelled five rows `VERIFIED-docs`. The reviewer correctly flagged that this **disarmed the §15.3 #14 tripwire**.

**Ruling: both were half right, and the fix is to stop conflating two different questions.**

| Axis | Values | Answers |
|---|---|---|
| **Evidential strength** | `VERIFIED` · `LIKELY` · `UNVERIFIED` | How good is the evidence? |
| **Provenance** | `docs` · `live` | Was this *demonstrated against the running API*, or read? |

Every row carries one of each: `VERIFIED · docs`, `LIKELY · docs`, `VERIFIED · live`, and so on.

**Why this is not bureaucracy.** H-2's real intent was never to force an honest, strongly-evidenced negative to be mislabelled as unverified — that would be its own dishonesty, and 001 §14.0 says an honest label beats a confident guess in *both* directions. Its intent was a **tripwire: nothing is settled until it has been demonstrated.** Separating the axes keeps the tripwire armed while letting S1's genuinely exhaustive enumerations be described accurately.

**The operative rule:** **`docs` provenance is never "settled".** No screen, tool schema or `supports()` value may be treated as final on `docs` alone — it may be *built on* provisionally, but it stays visible as unconfirmed. Only `live` closes a row. This is precisely what S2 exists to convert.

**Supersedes** H-2's `UNVERIFIED-docs-only` wording. **Retains** its intent. S1's five `VERIFIED-docs` rows become `VERIFIED · docs` — same evidence, honest provenance, tripwire re-armed.

## D-023 · `ratingStars` is not a provider capability
**2026-08-28 · lead · settled · resolves the S1 review's Major 2**
**Finding.** S1's paste-ready matrix carried `ratingStars: false`, contradicting §14.3 row 22 and §5.1 row 13 — **and row 22 was never examined by the spike**, yet appeared in its "resolved FALSE" block unflagged.

**Ruling.** `ratingStars` must not appear in the provider `supports()` matrix at all. Stars are a **local-only device rating**, emulated in our layer on *both* providers, stored in IndexedDB, synced nowhere, influencing no recommendations. A `supports()` key implies a provider question; there is no provider question.

> ### CORRECTION, 2026-08-28, raised by S1 revision 2
> **My justification was half wrong.** I wrote that "§14.2 deliberately omits stars from the `MusicProvider` interface". §14.2 omits the *method* — `ratingSet` takes `{ love }` only, and 001's note "Stars are absent from this interface on purpose" refers to that. But the **`Capability` union does contain `ratingStars`**, as its 22nd of **26** members. So the ruling stands and the reason I gave for it did not.
>
> **001 is internally inconsistent here:** the union offers a `ratingStars` capability, the interface provides no method that could implement it, and §14.3 row 22 says stars are emulated locally on both providers. Three parts of one document, three different answers. See D-026 for the resolution.

**Consequence.** S15 and B06 must carry `Star ratings stay on this device.` `pod-rate-track`'s `stars` field is local; only `love` touches a provider. **Love is never mapped to Save** (§14.3 row 23).

## D-024 · Row 20's original probe design was non-discriminating
**2026-08-28 · S2, lead · settled · methodological finding against S1**
**Finding.** S1 specified the row-20 probe as *three songs by three different artists*, comparing returned station ids. That fixture **cannot separate the two hypotheses it exists to separate**: "seeded per track" and "it is just the artist's station" both predict three distinct ids, because the artists differ too. S1's own stated failure condition — *"if the same artist's songs all return one identical `ra.*` id"* — is **unobservable in a fixture that never puts two songs by one artist side by side.**

**Why this matters more than the individual row.** Run as dispatched, three distinct ids would have upgraded row 20 to `VERIFIED · live` **supported**, on evidence that does not support it. The design and the decision rule were not the same experiment. That is exactly 001 §15.3's *"each was internally coherent, and each was fiction"* — reappearing in a probe rather than a design.

**Corrected design (S2).** 3 artists × 2 songs each — within-artist comparison is the decisive measurement — plus the control S1 named as *"the live reason to doubt"* and then never measured: `GET /v1/catalog/us/artists/{id}/station`, compared against each song's station id. Cross-artist distinctness is still recorded, but **labelled non-discriminating in the script's own output** so a later reader cannot misuse it.

**Standing rule this establishes.** Before any probe runs, state what each possible observation would prove. **If two hypotheses predict the same observation, the fixture is not an experiment.** S1's conclusions are otherwise unchanged — no `supports()` value moved.

## D-025 · Write probes: authorised but NOT recommended, and not run
**2026-08-28 · S2 recommendation, lead endorses, owner to decide · open**
The owner authorised write probes on a throwaway playlist (D-018). **S2 declined to ask for them and argued against, and the lead endorses that argument.**

**The reasoning.** There is no dry run on this API: a `DELETE` that turns out to work **has already deleted**. The most informative outcome is the one that does the damage. And the asymmetry is entirely one-sided — `supports()` is already `false` for rows 10, 11 and 18, so a **failed** probe changes nothing and a **successful** one causes harm in order to learn it. The documented surface is unambiguous and Apple staff have corroborated it across 2019, 2020, 2022 and 2025.

**Enforced in code, not intention.** `assertReadOnly()` in `probe-apple.ts` throws on any non-`GET` method and any path containing `/v1/me/`, so a later edit cannot casually add one.

**Standing recommendation:** leave rows 10/11/18 where S1 left them. D-018 remains the owner's to invoke; it is simply not worth invoking.

## D-026 · ⚠ DEVIATES · `ratingStars` is dropped from the `Capability` union
**2026-08-28 · lead · settled · follows D-023**
**The problem S1 hit while applying D-023.** §14.2's union has 26 members including `ratingStars`, so a plain `Record<Capability, boolean>` will not compile without answering a question that has no provider-side answer. S1's interim was `Record<Exclude<Capability, "ratingStars">, boolean>` — which compiles, honours D-023, and makes the deviation visible at the type level. Good instinct for an implementer who could not change the union.

**Ruling: drop `ratingStars` from the union in `packages/providers`.** 25 members, and a plain `Record<Capability, boolean>` again.

**Rationale.** A capability emulated identically on every provider is not a *provider* capability — it is a product feature. Keeping it forces every implementation, present and future, to answer a question whose answer can only ever be the same constant, and the `Exclude<>` workaround propagates that awkwardness into every consumer's type. The honest model is that stars never enter the provider layer at all.

**⚠ Deviates from 001 §14.2.** Recorded here because 001 is read-only. Anyone diffing our union against §14.2 will find exactly one missing member, by design.

**Consequence.** S15 and B06 carry `Star ratings stay on this device.` `pod-rate-track`'s `stars` field is local-only; only `love` reaches a provider. **Love is never mapped to Save** (§14.3 row 23).

## D-027 · `pod-queue-insert`'s REVIEW escalation is dead code on the launch provider
**2026-08-28 · S1 revision 2 · recorded for the WebMCP workstream, not actionable in 002**
**Finding, AS ORIGINALLY RECORDED.** §7.2 escalates `pod-queue-insert` to staged REVIEW when `> 10` items or **`displacedCount > 3`**. On Apple, `playNext`/`playLater` cannot displace anything, so `displacedCount` can only ever be 0 and the second trigger is unreachable.

> ### CORRECTION, 2026-08-28, raised by the S1 re-review (Major 2)
> **I recorded this as settled and it is not.** `displacedCount` is **undefined in 001** — two occurrences, both on line 774, neither a definition. There is a competing reading: items *pushed back* by an insert, which is supported by that same cell's own reasoning about additive inserts and would make the gate **fire constantly** on Apple via `playNext` rather than never.
>
> The two readings are opposite in consequence and I picked one without noticing there was a choice.
>
> **It is also the last claim in the document still resting on the falsified inference rule** (D-029) — with `splice(start, deleteCount, items)` sitting forty lines above it in the same source. And it is **wrong in the dangerous direction**: if my reading were right it would retire half the staged-REVIEW net for agent queue inserts on the launch provider, and that is an agent-safety control.
>
> **Status: `UNVERIFIED · docs`, competing readings, not actionable.** Whoever builds the WebMCP surface must resolve what `displacedCount` means before relying on either trigger. Do not cite this entry as a reason to relax the `> 3` gate.

**Why this is recorded rather than deferred silently.** It is an **agent-safety estimate**, not a UI detail. 001 justified the threshold on the grounds that "a 60-track insert *is* a queue rewrite even when it is technically additive". Half that safety net does not exist on Apple, so the `> 10` item count is carrying the entire load, and whoever builds the WebMCP surface needs to know that before deciding it is sufficient.

**Related correction from the same revision:** `pod-start-station` **narrows rather than disappears** — `artist`, `genre` and `station` seeds survive; only `track` leaves the enum. Revision 1 implied the whole action-sheet item went, which was wrong.

## D-028 · Row 20 is SUPPORTED — `VERIFIED · live`
**2026-08-28 · S2 · settled**
**Finding.** A song's `station` relationship **is** genuinely seeded from that song. `supports("stationSeedFromTrack")` flips `false` → **`true`** — the only value that moved in the whole matrix.

Nine calls, all `200`. The station id is `ra.` + **the song's own catalog id**, every time — structural, not correlational. Within-artist ids were distinct for all three artists tested, killing the artist-station hypothesis; the artist's own station is a separate resource under a visibly different name (`Fleetwood Mac & Similar Artists Station`). `playParams.kind` is `"radioStation"` with the `ra.*` id that `setQueue({station})` accepts, so the two-call path is demonstrated end to end.

**Consequence.** `Start Station` returns to the action sheet on Apple; `pod-start-station` keeps its `track` seed. This is the first row in the project closed at `live` provenance.

**Vindicates D-024.** S1's fixture would have produced the same "supported" answer on evidence that could not support it. The corrected design got the right answer *for the right reason*, which is the only version that is worth anything.

## D-029 · The documented surface is strictly smaller than the real one — rows 10/11/18/7 downgrade to `LIKELY · docs`
**2026-08-28 · S2 finding, lead ruling · settled**
**The falsification.** S2 built a four-state existence oracle out of the relationship path form — `200` / `40403` exists-no-data / `40012` exists-gated / `40008` not-a-relationship — and ran it against `Songs`. **Three relationship names outside S1's "exactly seven documented" set exist live:** `lyrics`, `syllable-lyrics`, and `credits` (`40403`, recognised, no data, notably *not* gated). Negative controls `similar-songs` / `radio` / `videos` all returned `40008`, proving the oracle discriminates.

**Therefore: "Apple documents no endpoint for X" no longer entails "no endpoint exists."** That inference rule was one of the two legs under rows 10, 11, 18 and 7.

**Ruling.** Those four rows downgrade `VERIFIED · docs` → **`LIKELY · docs`**. They stay `LIKELY` rather than dropping further because the *second* leg is untouched: six years of Apple staff statements (2019, 2020, 2022, and a DTS engineer in Oct 2025) saying playlist removal is unavailable. **No `supports()` value moves**, so nothing is blocked and no screen changes.

**Why relabel at all, when nothing moves.** Because someone will later reopen `pod-edit-playlist` and say *"we verified this."* They must find `LIKELY`, not `VERIFIED`. That sentence is the entire value of the change.

**A second, quieter hazard S2 surfaced.** Apple **silently ignores** invalid `include` / `views` / `extend` parameters and returns `200`. A typo'd `include=station` therefore fails with a success code and a response merely missing the relationship. **The provider adapter must not treat `200` as proof a requested relationship was honoured** — check for the relationship's presence, not the status. This is a live adapter hazard for W1, not a research footnote.

## D-030 · ⚠ `updateElementGeometry` does not exist — W6.2 respecified against `getElementTransform`
**2026-08-28 · W6.0 · settled · BLOCKING finding, resolved by respecification**
**What the W6 packet said.** That `updateElementGeometry({canvasTransform})` is *mandatory for 3D contexts* and *"the difference between the thesis holding and not"*. I wrote that from `~/code/agentic-context/html-in-canvas`'s IDL, and 001 `stack-research.md` §1.3 says the same. **It is not implemented in any shipping browser.**

**What Chrome 151 actually ships**, by exhaustive `Object.getOwnPropertyNames()` enumeration over four prototypes plus `window`:
`layoutSubtree` · `onpaint` · `captureElementImage` · `getElementTransform` · `requestPaint` · `texElementImage2D` · `drawElementImage` · `ElementImage`

**Absent:** `updateElementGeometry`, `clearElementGeometry`, `getCanvasTransform`, `onelementgeometryupdate`, `texElementSubImage2D`, `PaintEvent`, `ElementGeometryUpdateEvent`.

**The respecification.** What ships is the previous generation of the same idea: `getElementTransform(element, screenSpaceTransform)` → write the result to `element.style.transform`. That makes the panel **genuinely transformed DOM**, so hit-testing, focus, selection and a11y geometry are all native — which is the property we actually needed. And it is exactly what three.js's own `InteractionManager` already does; **it never calls `updateElementGeometry`.**

**So the thesis holds, but not for the reason the packet gave.** W6.2 is respecified against `getElementTransform`. W6.4's a11y re-review must confirm the *thesis*, not this reasoning — the packet was confidently wrong once already.

**The lesson, which is the project's own.** The IDL in the explainer is not the API in the browser. 001 warned that this spec is churning; the packet still quoted its IDL as though it were shipped. **W6.0 reported rather than patched, which was correct** — respecifying a slice is the lead's call.

## D-031 · RISK-02 resolves in our favour, and its evidence was about the wrong axis
**2026-08-28 · W6.0 · settled**
**Finding.** The WebGL entry point in Chrome 151 is **`texElementImage2D`, arity 3** — exactly three.js's `// Chrome 150+` branch at `WebGLTextures.js:1298`. **`HTMLTexture` works unmodified.** The README's IDL name `texElementSubImage2D` **exists in no shipping browser**: code written from the explainer would have failed.

**Correction to RISK-02's own wording.** I described the churn as a *rename* and cited the try/catch in `Examples/webGL.html:59-72` as evidence. That try/catch actually spans **two signatures of `texElementImage2D`**, not two names. Both axes of churn are real — a name axis (IDL vs shipped) and a signature axis (3-arg vs 6-arg) — but the evidence I cited belongs to the signature axis. The mitigation was right for both reasons; the reasoning named only one.

**Standing rule unchanged and now vindicated:** go through three.js `HTMLTexture`, never the raw entry point. A direct `texElementSubImage2D` call would have targeted a method that does not exist anywhere.

## D-032 · Dev routes must be explicitly namespaced — `_` is a pathless layout in TanStack Router
**2026-08-28 · W6.0 finding, lead ruling · settled**
**Finding.** `apps/web/src/routes/_probe.capabilities.tsx` serves at **`/capabilities`**, not `/_probe/capabilities`: a `_` prefix marks a *pathless layout route* and is stripped from the URL. Confirmed in `routeTree.gen.ts` (id `/_probe/capabilities`, path `/capabilities`).

**Ruling: escape the underscore — `[_]probe.capabilities.tsx`, and `[_]spike.device.tsx` for W4.** A diagnostic that sits at a bare top-level product-looking URL is one refactor away from shipping unnoticed. Namespacing keeps dev surfaces visibly separate and trivially excludable from a production build.

**W4 is affected identically** and has not started, so it costs nothing to fix in the packet rather than in review.

## D-033 · Hazard: a capability probe that crashes only when the capability is present
**2026-08-28 · W6.0 · recorded as a standing hazard**
**What happened.** The first flag-on run rendered `Illegal invocation` and nothing else. Reading a member off `HTMLCanvasElement.prototype` to measure its arity **invokes the IDL getter** behind `layoutSubtree` / `onpaint` with the prototype as `this`.

**Why it is worth a decision entry.** It is unreachable flag-off — with the feature absent the members do not exist and the probe is perfectly green. **A detection function that crashes exactly when the feature is present is worse than no detection at all**, and nothing but a real flagged browser can find it. Fixed by walking the prototype chain with `Object.getOwnPropertyDescriptor` instead of reading the member.

**Standing rule:** feature detection must never *invoke* what it is detecting. Use `in`, `hasOwnProperty`, or a property descriptor — never a read that can trigger a getter.

**Corollary for the whole tiering:** every tier must be exercised in a browser where it is genuinely live. W6.0 found `--enable-blink-features=CanvasDrawElement` turns the feature on in **Chrome 151 stable**, so **Canary is not required** and both states are reproducible on this machine. That materially lowers the cost of the flag-off baseline discipline in `preview-validation.md`.

## D-034 · Explicit `git add` pathspecs are not sufficient in a shared tree
**2026-08-28 · W6.0 · settled · process law for this workstream**
**What happened.** W6.0's first commit swept in another lane's `apps/web/package.json` / `bun.lock` edits and S1/S2's staged files, because **their work was already in the shared index**. It rebuilt the commit surgically with `commit-tree` / `update-ref`, touching neither the index nor the working tree, so no other lane lost anything.

**The trap, as originally stated:** `git add <pathspec>` is scoped, but `git commit --amend` re-reads the entire index.

> ### CORRECTION, 2026-08-28 — the law was too narrow and an incident proved it
> **The hazard is not limited to `--amend`.** W2 used `git add <pathspec>` followed by a **plain `git commit`** — and commit `55b34dd` swept in **six of S1's files**, because a plain commit writes the *whole index*, not the paths you added. It found this in its own final audit rather than being caught.
>
> **The correct rule is `git commit --only -- <paths>`.** That commits exactly those paths regardless of what else is staged. W2's last four commits use it and it verified S1's staging survived each one. The lead's own `design.pen` commit used the equivalent `git commit -- <path>` form and was clean for the same reason.
>
> **Standing rule, corrected:**
> 1. **Always `git commit --only -- <your paths>`** while any other lane is live. Never a bare `git commit`, never `--amend`.
> 2. Still run `git diff --cached --name-only` first — but treat it as diagnosis, not protection.
>
> **Disposition of the incident:** left as-is. The content is correct and nothing was lost — S1's files are committed verbatim, merely under W2's message, and S1 still holds newer uncommitted edits. No credential leaked; the single key-shaped match was a regex stripping a PEM header, and nothing under `cert/` was read. Rewriting to tidy a commit message, with four lanes live, risks far more than the untidiness costs. Owner-only rebase commands are recorded in `decisions/w2.md` §5 if it is ever wanted.

## D-035 · The counterexample was already in hand and went unspent
**2026-08-28 · S1 self-analysis, lead endorses · recorded as method, not blame**
**The finding, in S1's own framing.** Revision 1's row-18 sub-finding — undocumented `splice`, `updateItems`, `removeQueueItems` in Apple's shipped runtime — **was a counterexample to S1's own inference rule, found by S1, sitting forty lines from four findings that depended on that rule holding.** It was labelled correctly, kept out of `supports()`, and praised for exactly that restraint. Then treated as a local curiosity rather than as evidence about how completely Apple documents anything.

**Why it happened:** the runtime methods arrived as *a risk to be contained*. The question in front of the author was "does this flip `supports()` to true?", the answer was no, and having disposed of it nobody asked what it implied about the method. **A finding that is correctly handled locally can still be evidence you have not spent.**

**The sharper inversion.** Rows 10/11/18/7 had a second leg — six years of Apple staff statements — so they survive at `LIKELY`. **Row 21 had only the enumeration leg, and that is the one labelled `VERIFIED` and made the headline correction of a primary spec.** The thinnest evidence carried the strongest claim, because absence felt more total there.

**Why this is in the decision log and not just a diary.** No amount of provenance discipline would have caught it — the evidence was already in hand. D-022's two-axis labelling fixes *how we describe* evidence; it does nothing about *failing to spend* evidence we already hold. The standing question this adds to review: **"does any finding in this document contradict the method used to produce the rest of it?"**

**The reviewer had the same evidence in round 1 and did not spend it either.** That is the point: two careful, independent passes over the same documented surface agreed with each other and were both wrong.

## D-036 · Write probes: recommendation REVERSED — now the highest-value open experiment
**2026-08-28 · lead · supersedes D-025's recommendation**
**I endorsed S2's argument against write probes. I am withdrawing that endorsement.** Three things changed:

1. **The inference rule those rows rest on is falsified** (D-029). When S2 argued "the documented surface is unambiguous", that was true. It is no longer — the same probe run proved Apple's real surface is strictly larger than its documented one, and rows 10/11 are exactly where that matters most.
2. **The lyrics result proves this API answers the existence question when asked properly** — with paired controls, not a bare status code. Rows 10/11 have never been asked that way.
3. **The harm is bounded, and always was.** S2's argument — *"a DELETE that turns out to work has already deleted"* — is decisive for the general case and does not hold on a **scratch playlist the probe itself creates and deletes** (D-018's exact scope). The thing destroyed is the thing created for the purpose.

**What stands from D-025:** `assertReadOnly()` stays in `probe-apple.ts`. A write probe is a **separate, explicitly-scoped script**, never a relaxation of the read-only one.

**Blocked on H-10** — needs a Music User Token via interactive `authorize()`, which only the owner can perform. **This is now the highest-value unrun experiment in the workstream**, ahead of the DTS lyrics ticket and ahead of sweeping the oracle across `Albums` / `Artists` / `Playlists` (which `Songs` alone showed hides three).

## D-037 · Shared tsconfig flags — one accepted, one deferred
**2026-08-28 · lead · settled · raised by W0**
**`allowImportingTsExtensions: true` — accepted, kept in the shared base.** W0 turned it on to bring `scripts/spikes/` under the type gate without editing another lane's file, which was the right instinct: getting a directory *under* a gate beats leaving it ungated. It only permits, never requires, and the repo is bun-only by law — Bun resolves `.ts` specifiers natively. Consistent with the stack rather than a workaround for it.

**`exactOptionalPropertyTypes` — stays off, deferred to its own slice.** It is desirable and this project's type posture argues for it. Turning it on now would surface failures across four live lanes caused by no lane's own work, which is how a strictness flag gets reverted instead of satisfied. **Tracked as a follow-up slice once the wave lands**; whoever takes it owns every resulting failure in one commit.

## D-038 · "Right remedy, wrong reason" is a recurring failure here — promoted to standing review law
**2026-08-28 · S1 reviewer's self-analysis, lead promotes · LAW**
**The reviewer's own words, given when asked for the uncomfortable answer:**

> *"I had that evidence in round 1. I downloaded the bundle and counted the methods myself, and at `s1-review.md:267` I wrote — in my own words, as praise — 'it finds Apple's shipped code contradicting Apple's docs.' Seventy lines earlier I had certified the opposite premise: 'the enumeration is genuinely exhaustive.' I re-derived the counterexample independently and spent it on a compliance tick."*

**Three instances of one shape, across three different agents, in one workstream:**

| # | Who | Right remedy | Wrong reason |
|---|---|---|---|
| D-024 | S1 | named `Artists.station` as the confound | designed a fixture that never measured it |
| D-031 | **the lead** | route through `HTMLTexture`, never the raw entry point | cited evidence belonging to the *signature* axis while describing a *name* axis |
| this | the reviewer | called the `VERIFIED` labels unsafe | on contract-conflict grounds, not evidential ones — while holding the evidential counterexample |

Every one landed on a defensible action for a reason that did not support it. None was caught by ordinary review, because **a correct conclusion does not look like a defect.**

**Promoted to standing law in `review-system-prompt.md`. Two questions every reviewer must answer explicitly:**
1. **Does any finding in this document contradict the method used to produce the rest of it?**
2. **For each conclusion I am endorsing: does the reason given actually support it, or does it merely arrive at the same place?**

**Why this earns its place next to the §15.3 list.** Those fourteen failure modes are things that *look wrong*. This one looks right — it is the fully-general version of 001's own diagnosis, *"each was internally coherent, and each was fiction."* The lead is not exempt: one of the three instances is mine, and it was caught by an implementing agent rather than by me.

## D-039 · W0 accepted, with two Minors held open as blocking-for-acceptance
**2026-08-28 · lead · settled**
**Verdict APPROVE** from the antagonistic reviewer, which re-planted every gate itself — using a *different* plant from the engineer's wherever asked, plus five nobody had tried. `globals.css` differs from §12.1 by exactly three lines and nothing else (§12.1 re-extracted and diffed independently: 3 hunks, all `@theme`→`static`); 146 declared, 146 in the build, 0 missing; both actor ramps present. Parity plants — TS-only, CSS-only, unbound new token, deleted bound token, D-020 regression — **all five red**. It went past the shadcn claim to prove the `./components/*` map is genuinely right by creating, resolving and deleting a temp component. Zero type escapes across the four commits.

**I am holding two Minors as blocking anyway.** The verdict stands; acceptance waits.

**(a) The `useState` law is still escapable, and `AGENTS.md` states it absolutely.** `R['useState'](0)` and `const { useState: mk } = R; mk(0)` both lint clean. The reviewer rated them Minor on sound grounds — every shape anyone writes *by habit* is now caught, and you only reach these two by trying to get around the rule. **But the repo law claims enforcement without qualification**, and a stated law with a known hole is worse than an unstated convention: it buys false confidence in exactly the constraint the WebMCP architecture rests on. Two more selectors close it. Cheap, so there is no reason to carry the gap.

**(b) The rewrite plan's §4 recovery block is not tip-independent.** The rest of the file got that pass; §4 did not. It still calls `8f27b02` "the tip commit", its recovery would take `HEAD~1` — now the wrong commit — and its fallback names a hash that will not exist inside the rewritten clone. Low blast radius and **the one place left that can hand the owner a wrong tree**, on a path the owner walks alone under D-003 with no agent to catch a bad result. Recovery instructions that are wrong only when you need them are not recovery instructions.

**INFO blessed.** `packages/ui/src/lib/utils.ts` is real code in a package W0 does not own. Flagged as a deliberate logged exception and verified load-bearing — the widened `exports` map alone does not make the alias resolve. **Accepted:** the alternative was leaving shadcn wiring broken (Major 4) or opening a lane for one file. It is recorded here so it is not later mistaken for an ownership breach.

**Still uncleared, and unclearable by any agent:** U14 thumb occlusion and the both-colourway aesthetic call (H-5, H-6). The reviewer stated this rather than passing over it.

## D-040 · Naming a bias is not clearing it — extends D-038
**2026-08-28 · S1 self-analysis, lead promotes · LAW, appended to D-038**
S1 wrote the analysis that became D-038, had it promoted to standing review law, and **in the same revision was found still holding one unswept instance of the exact pattern it describes** — with the counterexample forty lines above the claim, in its own document.

**The sharper half is the inconsistency, not the miss.** S1 had already given two neighbouring findings the correct treatment: `offline` and `ratingStars` were both flagged as *"an observation, not a decision I was entitled to make."* `displacedCount` was asserted flatly. In its own words: *"I flagged the two that were about **capabilities** and asserted the one that was about **semantics**, which is a distinction with no principle behind it."*

So the author had the right instinct, applied it twice, and did not notice it failed to fire a third time. **Naming a bias is not the same as clearing it; you have to go and look.**

**Appended to D-038's standing questions as a third:**
3. **Where a document applies a caution inconsistently, the inconsistency is the finding.** Two hedged claims beside one asserted claim is not two-thirds rigour — it is evidence the hedging was reflexive rather than reasoned. Ask what principle separates them, and reject "it felt more certain".

**Note for whoever reads this later:** D-038 was promoted between revision 3 and revision 4, and did not prevent revision 4's Major. That is not an argument against the law — it is the law's own subject matter, and it is why the check has to be performed rather than merely known.

## D-041 · The lyrics oracle has exactly one source
**2026-08-28 · reviewer disclosure, S1 concurs, lead records · open**
**The single most consequential correction in this slice rests on one measurement.** The reviewer disclosed that it cannot reproduce the `40012` / `40008` oracle — unauthenticated, all three paths return an identical `401` — and is accepting the row-21 retraction on the lead's authority and S2's evidence rather than its own. **Surfacing that was correct and it is the right call**, but it leaves the retraction unreplicated.

Recall what that one measurement overturned: a finding two independent readers had already validated, which had been stamped `⚠ DEVIATES` against a primary spec, and which I had called the most valuable thing in S1's report. **A conclusion that strong, resting on one run, is exactly the shape this workstream keeps getting wrong.**

**What the reviewer *could* check independently holds:** zero `credits` across 608 nodes, `Songs` documenting exactly seven relationships.

**Action, and it is cheap now:** `APPLE_TEAM_ID` is available (H-11 closed) and `scripts/spikes/probe-apple.ts` exists. A second, independent run of the `/lyrics` vs `/zzz-not-a-relationship` vs `/artists` control set costs three GETs. **Folded into S1's final review pass** — the reviewer runs it itself rather than accepting on authority.

## D-042 · ⚠ DEVIATES · `Shift+Arrow` pages by density, not a flat 7
**2026-08-28 · W2 finding, lead ruling · settled**
**The conflict inside 001.** §4.4 specifies `Shift+Arrow` as a flat **7 rows**. §4.3 and §4.6 both specify **one full viewport**. Viewport height is density-dependent: `compact` 8 visible rows, `medium` 6, `airy` 4.

**Ruling: page by density — 8 / 6 / 4. W2's choice stands.**

**Rationale beyond two-against-one.** A flat 7 breaks the counting model the entire wheel rests on. In `compact` it leaves an orphan row on every page; in `airy` it overshoots by three, skipping content the user never saw. 001's own accessibility case is that movement must be **deterministic and countable** — *"one keypress equals one row, always"* — and a page that does not equal the visible page makes "page down and read the next screenful" unpredictable in exactly the mode where counting matters most.

Reversible in one line if the PM disagrees.

## D-043 · Pin `jotai@2.20.3` exactly — a version skew here fails silently
**2026-08-28 · W2 hazard, lead ruling · settled · W3 must read this**
**The hazard.** `packages/state` is deliberately React-free — which is the strongest available proof of the store-outside-React property, and W2 backed it with a test asserting React is not even *resolvable* from that package. The cost is that the React binding lives in the consumer.

**Two different Jotai versions in the tree means two module instances**, and a `Provider` from one is **invisible** to a hook from the other. The symptom is a component reading a default value forever — **not a type error, not a crash, not anything a gate catches.** On this project that would surface as a panel that renders but never updates, which is a full day of debugging in the wrong layer.

**Ruling:** pin `jotai@2.20.3` exactly — the version verified in the local clone — in every package that depends on it. No carets. **Added to W3's packet.** If it proves fragile in practice, the fallback is for W2 to export the bridge hook, but do not reach for that first: keeping `packages/state` React-free is worth defending.

## D-044 · W0 ACCEPTED — and the rewrite plan's advice changed, not just its hashes
**2026-08-28 · lead · settled · closes D-039**
Both held Minors closed in `4c47531`. **W0 is accepted.** Five Majors, seven Minors, two held Minors, all closed; the five Majors' files are byte-unchanged since the reviewer's APPROVE.

**(a) The `useState` law now holds.** Five selectors. Three plants, all red — `R['useState'](0)`, `const { useState: mk } = R`, and `const { useState } = R` (the shorthand, which **nobody had tried**, 2 errors). Plus a false-positive guard proving an object *literal* with a `useState` key still lints clean, so the `ObjectPattern >` restriction does not over-reach. One imprecision stated rather than buried: `MemberExpression[property.name='useState']` flags any read of a property so named, including on an unrelated object. Narrowing it would reopen the alias hole that was the whole point. **Breadth kept deliberately, logged.** `AGENTS.md`'s absolute claim is now true.

**(b) §4 of the rewrite plan was worse than stale, and this is owner-facing.**
The fix changed the *advice*:
- **Find the commit by message, never by hash.** Every hash from `2305f4b` onward differs inside the rewritten clone — the old fallback named one that **cannot exist there**.
- **Check every commit from the rename onward, not just the tip.** A later commit writing `AGENTS.md` would have masked a hole in the middle.
- **`--amend` is now the wrong tool.** When §4 was written the rename commit *was* the tip and a collision was one amend from repair. It is now buried under many commits, so amend would rewrite the wrong one and leave the hole. Recovery is: discard the clone, redo pass 1 only.
- ⚑ **Recommends skipping pass 2 by default.** The `CLAUDE.md`→`AGENTS.md` rename is **cosmetic** — `git log --follow` traverses it either way — while the `.claude/` removal and the trailer strip are the load-bearing halves. **This is a recommendation to the owner about H-1's scope**, not an agent decision, and it materially lowers the risk of the one operation no agent may perform (D-003).

**Why this mattered more than its severity.** Under D-003 the owner runs the rewrite alone, with no agent watching. Recovery instructions that are wrong only at the moment you need them are not recovery instructions — and these would have handed back a wrong tree.

**Index discipline held.** W0 used `git commit -- <pathspec>` throughout; S1's two files were staged in the shared index the entire time and are **still staged and uncommitted**. This is D-034-corrected working as intended, on the same day the incident that corrected it occurred.

## D-045 · Structural evidence outranks testimonial evidence — the principle my rulings were missing
**2026-08-28 · S1 reviewer, lead adopts · LAW**
**The finding is against me.** Rows 10/11/18/7 and row 30 share the same falsified enumeration leg and each has a surviving affirmative leg — yet I ruled them to different labels (`LIKELY · docs` vs `VERIFIED · docs`) and the only justification in the document was *"per the lead's ruling"*. The reviewer's words: **"the label is fine, the justification is a citation rather than a reason."** That is D-038's second question turned on the lead, and it is correct.

**The principle that does divide them, supplied by the reviewer and adopted:**

| Evidence class | What it is | Why it holds or fails |
|---|---|---|
| **Structural** | A mechanism that makes the thing impossible — DRM gating, an absent positional write, a closed type | Cannot go stale without the mechanism itself changing, which is observable |
| **Testimonial** | Someone with authority saying so — staff statements, forum replies, docs prose | Can go stale silently; the world changes and the statement does not |

**Row 30's affirmative leg is structural** — offline audio is EME/Widevine-gated, and that is a mechanism. **Rows 10/11's affirmative leg is testimonial** — six years of Apple staff statements, which is strong and is exactly the kind of evidence that expires without notice.

So row 30 stays `VERIFIED · docs` and rows 10/11/18/7 stay `LIKELY · docs`, **for a reason rather than by fiat.**

**Promoted to standing law:** when two findings rest on evidence of different classes, say which class each is. **Structural evidence may carry `VERIFIED`; testimonial evidence alone may not.** This is a sharper tool than the provenance axis alone — D-022 asks *where did you look*, D-045 asks *what kind of thing did you find*.

## D-046 · S1 ACCEPTED
**2026-08-28 · lead · settled**
**APPROVE, 0 Major, 2 Minor** — after four revisions, three of which were forced by findings that overturned the previous one.

**D-041 is closed, and closed properly.** The reviewer did **not** re-run `probe-apple.ts`; it imported only `mintDeveloperToken` and issued the GETs itself, **so the measurement is independent of the instrument under review**. Eleven read-only paths. `/lyrics` and `/syllable-lyrics` → `400/40012`; `/zzz-not-a-relationship` → `400/40008`; **all three negative controls (`similar-songs`, `radio`, `videos`) → `40008`** — so the oracle discriminates rather than saying "exists" to everything, which was the way this finding could have been worthless. `/station` → `ra.651880159`, re-confirming D-028 at the API layer from a third independent source.

**The sharpest replication:** `credits` → `404/40403`, **undocumented *and* ungated**. The documentation gap is therefore not merely "Apple hides entitled endpoints" — **ordinary relationships are missing too**, and that is what actually kills the enumeration inference. D-029 is now better-founded than when I ruled it.

**The row-21 retraction is confirmed by two instruments.** 001 was right.

**Two Minors, both instances of D-038's second question**, both dispatched for a final touch because W1 is building from this matrix right now: row 30's label needed the D-045 principle rather than a citation, and `libraryRemove`'s shipped comment gives only the falsified leg while its sibling gives both — dropping the Dec 2020 staff quote that is the most explicit affirmative evidence in the document.

**Standing recommendation carried forward:** rows 10, 11, 18 and 7 **stay open** until the playlist write probe runs (D-036, blocked on H-10). In the reviewer's words: *"the gap between 'I re-fetched every source and they agree' and 'I asked the API' was the whole distance between right and wrong here."* Three GETs closed it. The write probe is the same shape.

## D-047 · S1 DONE — and the asymmetry worth carrying past this slice
**2026-08-28 · lead · settled · closes S1**
Committed as `cc09d52`. Both Minors applied; index handed back byte-identical to the working tree; matrix re-verified at 25 keys with `ratingStars` absent. **First research slice complete.**

**The author's closing observation, which is the most transferable thing produced here:**

> *"I was never wrong about what the documents said — the reviewer independently confirmed every quote and every count — and I was wrong four times about what that meant. Rigour on the `docs` axis is cheap to demonstrate and easy to mistake for the other kind. Three GETs beat two agents doing careful reading, and they'd have beaten four."*

**Why this outranks the individual capability rows.** Every quote was verbatim. Every count was exact — 25 / 30 / 45 / 2, seven Offline rows, 30 citations matching 30 actuals in both directions. Two independent readers agreed. **And the conclusion was wrong.** Demonstrable care on the reading axis produced a confident, well-evidenced, internally coherent falsehood — which is 001's own diagnosis of its three failed drafts, arriving in a different discipline.

**Operational consequence, not just a moral:** when a question is *empirically answerable at low cost*, answering it beats any amount of careful reading, and the reading should not be labelled `VERIFIED` while the cheap experiment goes unrun. That is D-022's provenance axis, D-045's evidence classes, and D-036's write probe all pointing the same way.

## D-048 · Flagging a tension is not resolving it — extends D-040
**2026-08-28 · S1 self-analysis, lead promotes · LAW**
S1's own account of why it did not catch D-045's Minor itself: its earlier decision log **recorded the labelling inconsistency in as many words** and then discharged it by deferring to the lead's ruling.

> *"Flagging a tension and treating the flag as the resolution is a way of not doing the work while appearing to."*

The distinction between structural and testimonial evidence took **one paragraph** once someone finally asked for it. It was cheap the whole time; the flag made it feel handled.

**Appended to the standing questions:** a recorded caveat, an open question, or a "noted for the lead" is **not** a resolution. Ask whether the thing flagged is actually cheap to settle — and if it is, settle it. This is the near-twin of D-040: there, a caution was applied inconsistently; here, a caution was applied *instead of* thinking.

**Compressed, for the reviewer prompt:** *a statement about a system ages; a property of the system does not* (D-045), and *a flag is not an answer* (D-048).

## D-049 · Enforce the invariants you own where you own them
**2026-08-28 · W2 reviewer, lead promotes · LAW**
**The reviewer's framing, which is what makes four scattered findings one finding:** W2 enforces `silenced` and `actor` **inside `detent()`**, so no call site can forget them — correct, and exactly what 001 §15.2 demands. It then **pushes three other invariants it equally owns out to a consumer that does not exist yet**, with no gate and no documentation. *"There is no principle separating them."*

That is D-038's second question applied at the architecture level: the right pattern was used, and the reason for using it there and not elsewhere does not survive being asked for.

**The law:** if your module is the one that knows a rule, enforce it at your boundary. Exporting a rule to a future consumer is not delegation — it is an unowned invariant, and the consumer that would have honoured it does not exist yet to disagree.

**Concretely, in this slice:** `detentActionAtom` forwards the caller's `pageRows` untouched **while holding the atom that knows the correct number**. A flat-7 page on an 8-row viewport goes straight through — the exact value I ruled against in D-042.

## D-050 · A test that computes both sides from the symbol under test is not a gate
**2026-08-28 · W2 reviewer, lead promotes · LAW**
**How it was found.** The reviewer planted `VISIBLE_ROWS = {7,7,7}` — the precise flat 7 that D-042 rejects — and got **93 pass, 0 fail, tsc exit 0**. Same for `ANNOUNCE_DEBOUNCE_MS: 350 → 50`. Both survive because every assertion derives *both sides* from the symbol, so the test moves with the bug.

**What makes this a principled finding rather than a style note:** in the same package, the arc geometry **is** gated — falsifying it turns seven tests red. So the codebase demonstrates both patterns, and only one of them is a test.

**The law:** a constant is gated only if **falsifying it turns a test red**. Assert against a **literal** drawn from the spec, and cite the §. Where a value is a ruling rather than a derivation — D-042's 8/6/4, U13's 350ms, §12.0's geometry — the literal *is* the requirement, and computing it from the symbol tests only that arithmetic is self-consistent.

**Standing check, added to the reviewer prompt:** for every spec constant, plant a wrong value and confirm red. This is the generalisation of W0's "a gate that has never gone red is not a gate", moved from gate scripts to unit tests.

## D-051 · The store-outside-React proof proves the wrong half — W3 must not create a second store
**2026-08-28 · W2 reviewer, lead ruling · settled · BINDING ON W3**
**The downgrade.** W2 proved React is not even *resolvable* from `packages/state`, which is strong — and the reviewer recorded it as a **Minor rather than as praise**, correctly: it proves the package does not *need* React. **The dispatch's actual requirement is that tool callbacks reach the same state the UI renders**, and *"nothing stops W3 handing its `Provider` a fresh `createDeviceStore()`."*

Two stores, both valid, both React-free, and the WebMCP thesis quietly dead — a tool call mutating state no one is rendering.

**Ruling, binding on W3 and every later consumer:** there is **exactly one** device store per document. W3 imports the singleton; it does **not** call `createDeviceStore()`. `createDeviceStore` exists for tests and must be named and documented so that is obvious. **W2 owns enforcing this** — per D-049, it is W2's invariant — via a module-level singleton and a gate that fails if a second store is constructed outside a test.

**Added to W3's packet.** Note the shape: like D-043's Jotai version skew, the failure mode is a component rendering a default forever — no type error, no crash, nothing a gate catches unless someone builds the gate.

## D-052 · ⚠ DEVIATES · `setShuffle` / `setRepeat` added to `MusicProvider` — §14.2 omits them
**2026-08-28 · W1 finding, lead ruling · settled**
**The gap.** §14.2's interface supplies **no way to set shuffle or repeat**. Three other parts of 001 require the capability:
- **§14.3 row 27** rates both at full parity, `VERIFIED`, naming the endpoints — MusicKit modes on Apple, `PUT /me/player/shuffle` and `/repeat` on Spotify.
- **§11.1's B02** lists both as user-changeable settings.
- **§7.2's `pod-set-setting`** includes `shuffle` and `repeat` in its `key` enum.

**Ruling: add `setShuffle` and `setRepeat` to the interface.** This is an **omission in §14.2's method list, not a decision** — three sections require what a fourth forgot to provide.

**They must go through the provider, not `packages/state`.** Both providers expose real endpoints and playback is provider-hosted: a device-local shuffle flag would not change MusicKit's queue behaviour, so it would be a control that appears to work and does not. That is worse than the gap.

**W1 was right to refuse to invent them.** Its packet said transcribe, do not redesign; it held them `const` in the fixture with a comment and escalated. That is the behaviour the packet asked for, and it is why this surfaced as a ruling instead of a silent widening.

**Unblocks** B02 and part of S13 — both out of scope for 002, which is why this is cheap to fix now and expensive to discover later.

> ### CORRECTION, 2026-08-28, raised by the W1 review (Major 1) — LEAD FAILURE
> **I recorded this ruling as `settled` and never relayed it to the implementer.** `setShuffle`/`setRepeat` are absent from `MusicProvider`; the fixture still holds `const shuffle` / `const repeat` behind a comment reading *"logged as a question for the lead"* — **the pre-ruling state verbatim** — and `capability-matrix.test.ts:57` now hard-codes the pre-ruling justification into the row-27 case.
>
> The ruling existed only in this file. W1 had escalated correctly and was waiting; I answered the question in the log and dispatched a reviewer instead of the answer. **Reopened.** See D-061.

## D-053 · `LocalKey` is branded, and `ProviderId` includes `"fixture"` — both accepted
**2026-08-28 · W1, lead ruling · settled**
**(a) ⚠ DEVIATES — `LocalKey` is `string & {brand}`, where §14.2 writes `type LocalKey = string`.**
**Accepted, and it is the more faithful reading.** The packet required *"no internal structure holds a provider ID as a key — verify by TYPE, not convention"*. Against a bare alias that requirement is **unachievable**: a `catalogId` typechecks in every key slot. The brand is what makes §14.5's guarantee real rather than aspirational.

Proven with `@ts-expect-error` assertions, which are the strongest available form since those directives **fail the build if the brand ever stops working**. One line to revert, and the guarantee leaves with it.

> ### CORRECTION, 2026-08-28, raised by the W1 review — I recorded three proofs where two were load-bearing
> This entry claimed three `@ts-expect-error` assertions — bare `string`, `catalogId`, `libraryId` — all proved the brand. **Only two were.** The `libraryId` directive passed because that field is *optional*, not because it is branded, so it would have stayed green with the brand removed. I recorded W1's count without checking what each directive actually suppressed: **D-061(b), again.**
>
> **Now: seven of seven load-bearing.** Verified by removing the brand and confirming all seven directives report unused.

W1 flagged this as its one knowing non-transcription rather than burying it. Correct handling.

**(b) `ProviderId` widened to include `"fixture"`. Accepted.** The fixture is what 002 renders from, so its `TrackRef`s must say truthfully where they came from. Letting the fixture claim `"apple"` would put a lie in **the exact field §14.5 exists to protect** — provider identity across a switch — and would make the migration card's "matched / unmatched" counts meaningless in every test that uses it.

## D-054 · Prefer unrepresentable over forbidden — two lanes converged on it independently
**2026-08-28 · W1 and W2, lead promotes · LAW**
**Two lanes, no contact, same move.** Both were handed a rule to obey and both responded by **deleting the slot in which the rule could be broken**, rather than by documenting or asserting the rule:

| Lane | The rule | What it did instead of obeying it |
|---|---|---|
| **W1** | "check the payload, not the status code" (D-029's include hazard) | `readSongRelationship(resource, name)` **takes no status parameter** — there is no slot in which a `200` could be relied upon. Plus a test asserting the *arity*, so the enforcement survives a rewrite. |
| **W2** | "use one clock" (Major 1) | Removed `AnnouncerDriverOptions.now` entirely — *"a second injection point is how the halves came apart"*. No caller-supplied timestamp reaches any comparison. |
| **W2** | "don't forward a wrong `pageRows`" (Major 2) | **Deleted `pageRows` from `DetentInput`.** Page size is a reducer parameter the store supplies; a caller cannot pass a wrong one. |

W2's own phrase for it: **the mismatch is unconstructible rather than discouraged.**

**The law.** When a review finding can be answered either by adding a check or by removing the possibility, **remove the possibility.** A check must be remembered, can be deleted by a later refactor, and only fires on paths someone thought to test. A missing parameter cannot be misused by anyone, ever, including agents who never read the finding.

**How to review against it:** given a fix that adds an assertion, ask whether the shape could have been changed instead. Given a fix that changes the shape, check the *arity or the type* is what enforces it — not a comment claiming it does.

**Why it earns a place beside D-049.** D-049 says enforce invariants where you own them; this says *how*. Together: own the rule, and then make breaking it unrepresentable at your boundary.

## D-055 · Jotai footgun — `atom(fn)` creates a derived atom, not an atom holding a function
**2026-08-28 · W2 · recorded hazard, binding on every lane using Jotai**
`atom(someFunction)` is read by Jotai as a **derived** atom — the function is treated as the *read* computation, not as the value. W2 hit it storing a clock: `get(clockAtom)()` threw until the function was boxed.

**Worth recording rather than leaving in one diary** because `packages/state` is the spine, W3 and W6 both consume it, and the symptom is a runtime throw with no type error. Jotai's own outside-React documentation is `published: false` and therefore largely absent from training data (001 readme), so recall will not save anyone here.

**Rule:** to store a function in an atom, box it — `atom({ fn })` or `atom(() => fn)` deliberately, never `atom(fn)`.

## D-056 · `ScreenMeshHandle` — the device↔composite boundary, approved as proposed
**2026-08-28 · W4 proposal, lead approves · settled · BINDING ON W4 AND W6**
`packages/device` exports one type and hands one instance to `<Device onScreenMeshReady={...}>`. No registry, no module singleton. **Approved unchanged**, and it is the best application of D-054 so far — three separate slots where staleness could exist were removed rather than documented:

1. **No `mesh` field.** Handing W6 the `THREE.Mesh` is exactly the slot in which a stale `matrixWorld` can be read, since `matrixWorld` is only current after the renderer updates it. Every read is a method that calls `updateWorldMatrix(true, false)` first, **so a stale answer is not representable.**
2. **`onTransformChange` delivers the `ScreenTransform`, not the handle.** Delivering the handle would put "call this after the device moves" back as documentation rather than structure.
3. **`viewport.corners` computed device-side.** W6 needs screen space for `getElementTransform` (D-030); handing out only world space would make W6 reimplement the projection and get the y-flip or DPR wrong **with no error**. The handle lives inside the Canvas and projects against the live camera.

**The §14.1 half is right too.** Notification hangs off the mesh's `onBeforeRender` — once per *rendered* frame, so under `frameloop="demand"` an idle device costs zero and there is no `useFrame` anywhere in `packages/device`. The listener fires only when the world matrix actually differs, so a render caused by a texture upload does not trigger a geometry recompute in W6.

**Two conditions on acceptance:**
- **No raw `Object3D` accessor for now.** W4 offered one if W6 needs a layer; the answer is not yet. If W6 asks, it gets a narrow accessor for that stated purpose, never the mesh generally.
- **Pin the corner convention with a test at the seam.** Corner ordering (TL, TR, BR, BL) and y-down canvas CSS px must be asserted by **both** lanes against the same literals. An untested convention shared between two packages is the classic integration bug, and it is invisible until the panel renders upside down or half-scaled. W4 owns the producing test, W6 the consuming one.

**Note on sufficiency:** four corners determine the panel→canvas mapping exactly, and for a flat quad under perspective that is a homography — strictly more general than an affine matrix and correct through the expose flip. W6 adapts it to whatever form `getElementTransform` wants; that adaptation is W6's knowledge, not W4's.

## D-057 · ⚠ DEVIATES · Per-surface `envMapIntensity` — §4.2 and §4.4 are not simultaneously satisfiable
**2026-08-28 · W4 finding, lead ruling · settled**
**The conflict, with arithmetic.** At the row where both faces' normals point at the camera, §4.4's steel `#7C858F` pins the room's radiance at ≈0.39 linear. §4.2's black poly `#0C0D0F`, whose total specular response under §12.3's `reflectivity 0.55` + `clearcoat 1.0` is ≈0.09, then reads **≈44 units against a target of 13**. Factor ≈11. **No light rig can remove it, because the two surfaces reflect the same direction.**

**Ruling: per-surface `envMapIntensity`, which §12.3 does not state.** W4's physical justification is the right one and I am adopting it: **001 describes the two tables differently.** §4.2's stops are described as *light* — "reflected key light", "floor bounce", "bottom edge caustic". §4.4's are described as *reflections of the room*. So the polycarbonate is **light-driven** and the steel is **env-driven**, and giving them the same room radiance was the error.

**Why this is not cheating the acceptance criterion.** §12.3 says to tune the light rig and env map until a vertical luminance sample matches the stop table within ±4. **The tables are the criterion; the rig is free.** `envMapIntensity` is a rig parameter. What would be cheating is painting a gradient onto a material — the §10.4 "chrome reads as grey plastic" failure — and this ruling does the opposite: it *preserves* the steel's non-monotonic horizon band as a genuine reflection while letting the poly be lit.

**The deeper thing this reveals, recorded for whoever reads a stop table next.** §4.2 appears to have been authored as a **2D paint spec** — the pixel values a designer wants — rather than as a physical measurement of a surface in the same room as §4.4. Both are legitimate and they are not interchangeable. **When a stop table and a material recipe disagree, ask which one is describing light and which is describing paint before assuming either is wrong.**

## D-058 · A test that passes for the wrong reason is not a passing test
**2026-08-28 · W2 reviewer, lead promotes · LAW**
**How it was found.** D-051's singleton guard is **off by one**: `deviceStore` is built via `buildDeviceStore`, which does not increment `devicesBuilt` — so the **first** production `createDeviceStore()` succeeds. The reviewer ran it outside a test runner: no throw, second store, different object. D-051's own worked example — `<Provider store={createDeviceStore()}>` — is exactly one call, so the guard fails on the only case it exists to stop.

**The part that makes this a law.** The test at `store.test.ts:283` is **green** — and green only because **25 earlier calls in the same file had already pushed the counter past 1**. The reviewer's phrase: **right assertion, wrong reason.**

**The law.** An assertion that depends on prior state, execution order, or accumulated side effects within a file is not testing what it claims. Every test must be able to run alone and still mean what it says. Where a gate protects a *first*-occurrence invariant, the test must exercise the first occurrence — not the twenty-sixth.

**Relationship to D-050.** D-050 catches a test that moves with the bug because both sides derive from the symbol. D-058 catches a test that passes *around* the bug because the fixture had already violated the precondition. Both produce green suites over broken code; check for both.

## D-059 · When a fix batch claims to be interlocked, check the symbol graph
**2026-08-28 · W2 reviewer, lead promotes · LAW**
W2 landed four Majors as one commit, arguing they interlock through a single published contract file and a split would produce states that do not typecheck. **The reviewer checked rather than accepted**, walking the symbol graph: the coast references no clock, density or page symbol and vice versa; `silence.ts` references none of them. **The only genuine interlock is page-size × density.** A four-way split was available and each part typechecks alone.

**Sharing a file is not interlocking.** Two changes in one file are coupled by editing distance, not by dependency.

**Why it is worth a law rather than a style note** — the reviewer's own framing: `a16c48f` is **+1800/−363 across four unrelated defects, and the off-by-one counter bug (D-058) is exactly what gets missed in a commit that size.** The commit-size argument is not aesthetic; it names the class of defect that survives review, and it predicted the one that did.

**Standing check:** when an engineer justifies a large commit by interlocking, verify it by dependency rather than by co-location, and say which pairs are genuinely coupled.

## D-060 · The wheel coast must be frame-rate independent
**2026-08-28 · W2 reviewer finding, lead ruling · settled**
**The defect.** The coast decays **per call** while travel accumulates **per second**: the same flick gives 30fps → 32 detents / 492°, 120fps → 8 detents / 123°. **A 4× difference in how far the wheel travels, decided by the user's display.** All six coast tests use `1/60`, so it is entirely ungated — D-050 again, in new code written to close D-050.

**Ruling: decay is a function of elapsed time, not of call count.**

> ### CORRECTION, 2026-08-28 — §9.4 already said it, and I ruled without reading it
> I called this *"a clarification of an under-specified constant"*. **The constant was never under-specified.** design-system §9.4 states the normalisation verbatim: *"`ω *= 0.940` at 60fps (**normalised to `ω *= 0.940^(dt/16.67ms)`**)"*.
>
> The ruling and the source agree, which is luck rather than method. **I ruled that a spec was silent without reading the section whose subject it is** — D-061(b) again, three entries later. W2 had the same gap: it built the coast from pm-spec §4.4's Release cell and treated one line in an *input-paths* table as the whole spec of a *motion* behaviour.
>
> **The coast floor changes as a result:** §9.4 says stop at `|ω| < 0.35°/frame (≈21°/s)`, not §4.4's `60°/s`. §9.4 is corroborated by design-system §14.1's frame-budget table, which independently states *"stops when inertia ‖ω‖ < 0.35°/frame"*. **Two design-system sections agree against pm-spec.** Use 21°/s.

**Gate it per D-050:** assert the same gesture produces the same total travel at 30, 60 and 120fps, within a stated tolerance. That test is the requirement; the decay constant is an implementation of it.

**Why this matters beyond correctness.** 001's whole accessibility case rests on movement being **deterministic and countable** — *"three clicks down is countable without looking"*. A coast whose distance depends on the display makes the device behave differently on a 120Hz phone than on a 60Hz laptop, for the same physical gesture. That is the counting model breaking silently, on hardware rather than on input.

## D-061 · A ruling is not settled until it lands in code — and the lead must verify, not record
**2026-08-28 · W1 reviewer, lead accepts against itself · LAW**
**Two of the six Majors in W1's review trace to me, and they are the same failure twice.**

**(a) D-052 was recorded `settled` and never relayed.** W1 escalated the shuffle/repeat gap correctly and waited. I ruled, wrote the ruling into `decision-log.md`, and dispatched the reviewer — **without ever sending the ruling to the implementer.** The fixture still carries the pre-ruling comment word for word. A decision that exists only in the log is not a decision; it is a note about one.

**(b) I propagated an unverified claim as a fact.** `tracker.md:88` records the D-029 include hazard as *"enforced structurally … so it survives a rewrite"*. I wrote that from W1's report without checking it. **It is not true** — see D-062 — and my writing it down is what would have let it stand.

**The law, in two parts:**
1. **Relay every ruling to the lane that must implement it**, in the same turn it is recorded. The log is the record, not the channel. Before marking a decision `settled`, name the lane that will land it.
2. **The lead may record a claim as a claim, or verify it and record it as a fact — never the second on the strength of the first.** Where a tracker or log entry asserts a property holds, it must cite who checked it and how, or it must be worded as a report.

**This is D-038's second question turned on the lead's own artifacts:** both entries reached a defensible statement for a reason that did not support it. The decision log is the most load-bearing document in this workstream precisely because everyone downstream treats it as settled — which makes an unverified claim in it more dangerous than the same claim in a diary.

## D-062 · `Function.length` is not an arity guard
**2026-08-28 · W1 reviewer · settled · technical, and it invalidates a claimed structural enforcement**
**`Function.length` stops counting at the first defaulted parameter.** So a guard asserting `fn.length === 2` is satisfied by `readSongRelationship(resource, name, status = 0)` — and the reviewer planted exactly that, with `if (status === 200) return …data ?? []` inside, **the precise mistake D-029 rules against**, and got `tsc` 0, 230 pass, 0 fail.

**So the D-029 enforcement is not structural.** The intent was right and is still right (D-054: remove the slot rather than forbid its misuse) — the *mechanism* was wrong, and a runtime arity check was never going to carry it.

**Enforce it by type, not by runtime introspection.** The parameter object should have no member in which a status could be passed, so that adding one is a compile error at every call site rather than a silently-satisfied assertion. A test may then assert the *type*, not the length.

**General form:** a structural guarantee must be enforced by something the compiler checks. Runtime introspection of a function's shape is a description of the implementation, not a constraint on it.

## D-063 · ⚑ The specialist section wins over the summary table — and §9.4 governs wheel motion
**2026-08-28 · W2 finding, lead ruling after reading both sources · settled · AFFECTS W2 AND W3**
**W2 read design-system §9.4 and found three conflicts with pm-spec §4.4. It changed nothing and escalated** — correctly, because picking one on its own reading would be redesign under cover of transcription, and it would silently invalidate the arc-geometry gates.

**I read both sections before ruling.** Here is what they say and how it resolves.

| # | pm-spec §4.4 | design-system §9.4 | Ruling |
|---|---|---|---|
| 1 | **Fast-scroll:** `<240°/s` ×1 · 240–540 ×3 · `>540` ×7, smoothed over 3 detents | `<720°/s` ×1 · 720–1080 **×4** · `>1080` **×12**, **and only when the list exceeds 40 items**; ω clamped **1440°/s**; hysteresis **±1.8°** | **§9.4** |
| 2 | **Coast floor:** `60°/s` | `0.35°/frame ≈ 21°/s` | **§9.4** |
| 3 | **Haptic above 12/s:** "suppressed (§4.9)" | "only every 3rd vibrates" | **Deferred** — §4.4 *defers to §4.9*, which is the haptics specialist and which I have not read. Haptics are out of scope in 002. Do not implement either. |

**The principle, and it generalises past this case.** When two primaries disagree, **the section whose subject is the thing in dispute wins over the section that mentions it in passing.** §9.4 is *The wheel inertia and detent model*; §4.4 is *Wheel rotation across four input paths*, a table whose columns are trigger, measure, detent size, dead zone, release, FX. Acceleration physics is §9.4's subject and §4.4's aside. This is the same shape as **D-021**, where §12.0's geometry re-derivation beat §7.3's stale column.

**§4.4 does say "This table is the engineering contract"** — and it still is, for **what it uniquely specifies**: which four input paths exist and that all converge on `detent({delta, source})`, per-path measurement, detent sizes, dead zones, per-path FX, the release-vs-keyup distinction, and above all **"arrow keys never accelerate — 1 keydown = 1 row, always"**, which §9.4 does not cover and which is non-negotiable. Nothing in this ruling touches any of that.

**Three substantive things §9.4 has that §4.4 lacks, each of which is a reason to prefer it:**
- **The 40-item precondition.** Without it a 12-row menu can enter fast-scroll, which is nonsense. §4.4 has no such gate.
- **The 1440°/s ω clamp.** §4.4 has no upper bound at all, so its model is incomplete in the direction that hurts — an unclamped spin makes the list unreadable and blows the tick audio budget.
- **±1.8° hysteresis**, which stops a thumb resting on a boundary from chattering.

**The index overlay reconciles rather than conflicting.** §4.4 triggers it at "multiplier ≥ 3", written against its own ×1/×3/×7 tiers — i.e. *second tier or above*. Under §9.4's tiers that is ×4. **Same rule, both readings.** §4.4's separate scroll-path trigger ("≥5 detents/second") is uncontested and stands.

**Consequences, stated plainly:** W2's arc-geometry gates were built to ×1/×3/×7 and must be rebuilt to ×1/×4/×12 with the precondition, clamp and hysteresis. **W3's index overlay** must trigger on the §9.4 tier. This is real rework and it is cheaper now than after the panel renders.

**The implementer-side statement of this rule, from W2, which is sharper than mine:**
> *"§9.4 is titled The wheel inertia and detent model; I built one without opening it. When a spec has a section named after the thing you are building, read it — even when another document already gave you a number. **A summary table containing a value is not evidence that the value is the specification.**"*

Both of us made this mistake on the same constant, from opposite directions: W2 built from §4.4's Release cell, and I ruled §9.4 silent without opening it.

## D-064 · A plant must prove its own edit landed before it proves anything else
**2026-08-28 · W1 finding, lead promotes · LAW**
**The finding, in W1's words: "the verification step failed the same way the code did."**

Two of its re-run plants reported green. **Only one was a measurement.** The other was a `perl` substitution that **silently failed to match a typographic apostrophe** — so the plant never applied, unmodified code passed, and *"unmodified code passing looked like a working gate."*

**This is the most dangerous failure mode in the entire method we have been running.** Every slice in this workstream has been verified by planting violations and confirming red. A plant that does not apply is **indistinguishable in its output** from a plant that a gate correctly caught — both produce a green suite and a satisfied engineer. We have been reading "green" as "the gate held" when it can equally mean "the mutation never happened".

**The law: a plant asserts its own edit landed — by diff, hash or grep — before it measures anything.** A plant that cannot prove it changed the file proves nothing about the gate. Retroactively, any "plant went red" claim in this workstream is sound (red requires the edit to have landed); any **"plant stayed green"** claim needs the edit confirmed before it can be read as a gate hole.

**And the second green plant was real, and it found a hole in the gate W1 had just written:** deleting a row's evidence label let it **silently inherit its neighbour's** — *"worse than none, because a wrong claim reads as a checked one."* That control row is the only one in the table that found anything, which is the argument for keeping controls in a plant table at all.

## D-065 · D-045 made executable — no `false` row may be labelled `VERIFIED · docs`
**2026-08-28 · W1, lead adopts · LAW**
W1 turned D-045 from a principle a reviewer applies into a **gate that runs**, and the reasoning is exactly right:

> **An absence read off a document is testimonial by construction; a measured absence is not.**

So a `supports()` row that is `false` on documentary evidence alone can never be `VERIFIED` — it is precisely the class D-045 says testimony cannot carry. Apple's lyrics rows stay `VERIFIED · live` because they were *measured* (`400/40012`, with controls). Every Spotify `false` becomes `LIKELY · docs`.

**The part that makes it a good gate rather than a good rule: it fires in both directions**, so it cannot be satisfied by flattening every row to `LIKELY`. A gate that can be silenced by weakening every claim is not a gate.

**Generalise it:** where a review principle can be expressed as a predicate over the artifact, write the predicate. D-045 was applied by hand in one review and missed in the next slice; as a test it applies to every row forever, including rows nobody has read.

## D-066 · Environment-dependent green — a test that passes because the machine was quiet
**2026-08-28 · W2 self-finding, lead promotes · LAW**
**W2 found this alone, after its slice had already passed three review rounds.** Re-sweeping the archives, one run reported `161 pass, 1 fail` and passed on re-run. Rather than shrugging at a flake, it chased it.

**The defect was in the assertion, not the code.** Two real-timer tests used a fixed `sleep(350+120)` — *a claim about OS scheduling, not about the code*. Replacing it with polling made the test fail **15 of 16 times under load**, and the failure was genuine: `armed - cleared <= 1` was **never** the number of timers in flight, because **a fired timer is neither outstanding nor cleared.** Under load a timer fires a fraction early against a coarsened `performance.now()`, the flush correctly yields nothing, and the driver re-arms — round 1's Minor 3 working exactly as designed. **The driver was right; the assertion had been wrong since it was written**, and passed only because timers on idle machines rarely fire early. Now `armed - cleared - fired <= 1`, with 16 concurrent suites against 6 CPU hogs and zero failures.

**Why this is a new class rather than another D-058.** D-058 is a test that passes because of *prior state in the file*. This is a test that passes because of *the machine it ran on*. W2's own line is the one that matters:

> **"Three review rounds missed it because reviewers also ran on quiet machines."**

Every antagonistic reviewer we have run has been on the same idle hardware as the implementer. **The adversary and the author shared an environment**, so no amount of reviewer rigour could surface it — which is a limit of the *method*, not of any reviewer.

**The law, in two parts:**
1. **A fixed `sleep` is an assertion about the OS scheduler, not about your code.** Poll for the condition, or drive the clock. Any test whose passing depends on wall-clock timing must be run under contention before it is believed.
2. **When a test is flaky, the flake is the finding.** Do not re-run until green. W2's re-run *did* pass, and stopping there was available and would have hidden a wrong invariant that had shipped through three reviews.

**Standing check added to the reviewer prompt:** for any timing-dependent test, run the suite under CPU contention at least once. Green on an idle machine is not evidence.

## D-067 · The saved Pencil enclosure is authoritative; one geometry drives render, probe, tokens, and tests
**2026-08-29 · owner feedback + lead ruling · settled**

**Conflict.** The current saved Pencil component `VWaJS` is 330×552 with a 26px circular enclosure corner. The older prose/tokens/tests describe a 33px superellipse with exponent 4.2. The owner explicitly rejected the browser render for failing to resemble the saved `.pen` design and supplied Pencil MCP access for that comparison.

**Decision.** For W4's visible enclosure, the current saved Pencil geometry wins: **26px circular corners**. Update the typed layout token, renderer, luminance probe, tests, and deviation record together. There may be only one enclosure definition; a green test for geometry the renderer does not use is prohibited.

**Measurement consequence.** The luminance probe must derive its sample positions from that shared geometry and must fail a sample unless a raycast/ID check confirms it hit the expected mesh with a safe interior margin. The existing 8/43 and former 32/43 reports are invalid evidence because their probe used stale geometry and sampled outside the intended material. Re-run the bounded smooth calibration only after the mapping is corrected.

**Material consequence.** This ruling does not authorize changing the exact §12.3 black-polycarbonate BRDF. Restore `sheen: 0.15` and `sheenColor: #6E4A2E`; use smooth geometry, lighting, environment response, and already-authorized per-surface `envMapIntensity` to solve the appearance. If valid sampling then proves a remaining conflict with the Pencil material identity, escalate the measured contradiction instead of replacing the recipe silently.

**Owner-only gates.** H-6 aesthetic acceptance and U14 phone-in-hand occlusion remain outstanding after the mechanical correction.

## D-068 · Panel rows remain non-touch targets; the click wheel is the single-pointer alternative
**2026-08-29 · binding owner/lead ruling · settled · AFFECTS W3 AND W7**

**Conflict.** pm-spec §4.5 asks a tap on a visible panel row to move the highlight and descend after 80ms. Design-system §11.2/U6 explicitly rejects panel rows as touch targets: at authored scale their 21–26px height cannot meet 44px, and inflating them destroys the eight-row iPod raster. The authentic device also has no touchscreen.

**Decision.** For the MVP, design-system §11.2/U6 and authentic iPod behaviour win. Panel rows are display semantics, never pointer controls. Tapping non-interactive panel content focuses the existing `role="application"` click-wheel control and performs no navigation, playback, or highlight movement. Keyboard operation remains unchanged. The production click-wheel annulus owned by W7 is the accessible single-pointer alternative to its path gesture.

**Implementation consequence.** Commit `7d170dd`, its delayed row-selection driver, row handlers, `data-row-index` plumbing, and direct-activation browser tests are removed by a new revert commit. A browser regression must prove that clicking menu and track rows focuses the panel without changing screens, while Enter still performs the activation. Native actions such as Love remain native buttons and are not swallowed by the focus-only panel handler.

---

## Risks carried by these decisions

| id | Risk | Opened | State |
|---|---|---|---|
| **RISK-01** | T3 is the eventual shipping default and is **not built** (D-010). Until it lands, webPod runs only in a flagged Canary. **Not self-correcting** — `HTMLTexture` degrading to a plain `Texture` yields a blank screen mesh, not T3; T3 needs `InteractionManager`'s `matrix3d` overlay, which is real work. **Release gate: nothing ships to users until T2–T4 land and §15 is signed off in a flag-off profile.** Re-read at the start of every subsequent workstream until closed. | 2026-08-28 | open, accepted by owner |
| ~~RISK-02~~ | **CLOSED 2026-08-28 by D-031.** Chrome 151 ships `texElementImage2D` arity 3, matching three.js's Chrome 150+ branch; `HTMLTexture` works unmodified. The IDL name `texElementSubImage2D` exists in no shipping browser. Mitigation (route through `HTMLTexture`, never the raw entry point) stands and is vindicated. | 2026-08-28 | **closed** |
