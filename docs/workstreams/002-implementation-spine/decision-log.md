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

**Row 21 corrects a primary source.** ⚠ 001 §14.3 states the lyrics endpoint "exists". S1 found it in **no** Apple documentation — only in third-party private-API repos. Under review; if it holds, 001 §14.3 row 21 is factually wrong and every downstream lyrics decision rests on a phantom.

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
**Consequences.** `DISCONNECTED` becomes **browse-cached-metadata-only** — a Service Worker cache of shell, artwork and metadata, never audio. This was already 001's stated assumption (§5.1 row 10) and S1 confirmed it is the only reachable design, so the copy on the five affected screens simplifies rather than degrades. **Nothing renders a greyed or broken download affordance** — absent, not disabled (U15).
**Reversal.** Cheap while no offline UI exists. Expensive once `DISCONNECTED` copy ships. Revisit only if a provider ships browser-side offline audio, which neither shows any sign of.
**Closes** H-7.

---

## Risks carried by these decisions

| id | Risk | Opened | State |
|---|---|---|---|
| **RISK-01** | T3 is the eventual shipping default and is **not built** (D-010). Until it lands, webPod runs only in a flagged Canary. **Not self-correcting** — `HTMLTexture` degrading to a plain `Texture` yields a blank screen mesh, not T3; T3 needs `InteractionManager`'s `matrix3d` overlay, which is real work. **Release gate: nothing ships to users until T2–T4 land and §15 is signed off in a flag-off profile.** Re-read at the start of every subsequent workstream until closed. | 2026-08-28 | open, accepted by owner |
| **RISK-02** | The `html-in-canvas` WebGL entry point is mid-rename (`texElementImage2D` ↔ `texElementSubImage2D`) — the spec repo's own demo carries a try/catch across both signatures. Mitigated by routing through three.js `HTMLTexture` rather than the raw API; a direct call in our source is a blocking finding. | 2026-08-28 | open, mitigated |
