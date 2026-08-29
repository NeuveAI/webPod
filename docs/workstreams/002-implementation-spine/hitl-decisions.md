# 002 — HITL decision register

Status values: `Blocking` (no dispatch until resolved) · `Defaulted` (lead chose; owner may overturn) · `Logged assumption` (agent may proceed, must record) · `Owner-only` (never delegable).

---

## H-1 — Repo hygiene and history rewrite · `Blocking` for the rewrite, `Defaulted` for everything else

**Asked by owner, 2026-08-28.** Four things:
1. Remove `.claude/` from committed artifacts — rewrite history.
2. Remove the `Co-Authored-By` trailer from commits, **and make its absence repo law**.
3. Rename `CLAUDE.md` → `AGENTS.md` in history.
4. Add `CLAUDE.md` as a symlink to `AGENTS.md`, gitignored.

**Current state (measured, not assumed):** 4 commits total; exactly one (`2305f4b`) touches `.claude/settings.local.json` and `CLAUDE.md`; exactly one commit carries a `Co-Authored-By` trailer; there is no `.gitignore`; `origin` is `git@github.com:NeuveAI/webPod.git` and `origin/main` is **already at `2305f4b`** — the branch is fully pushed and `0/0` divergent.

**Split of work:**
- **Lead/agent, non-destructive:** author `AGENTS.md` (carrying the new laws), create the `CLAUDE.md` symlink, write `.gitignore`, and write out the exact `git filter-repo` invocation with its expected before/after. Committed normally.
- **Owner-only, never delegated:** running the rewrite and the force-push.

> **Owner ruling, 2026-08-28:** *"You can leave the force pushing to me, as I want you to never do that yourself."*
> This is standing repo law, recorded in `AGENTS.md`, not a per-task permission. It cannot be granted in-line by a later prompt.

**Why the rewrite is genuinely blocking rather than cosmetic:** `origin/main` already carries the commit, so a rewrite is a force-push to a shared org repo. Anyone with a clone diverges. The owner runs it when they are ready to tell collaborators.

---

## H-2 — Apple Music capability rows · `Defaulted`

**Owner answer, 2026-08-28:** no Apple Developer account or signed MusicKit token yet — **docs-only**.

**Label wording superseded by D-022** — the two-axis scheme (evidential strength x provenance) replaces `UNVERIFIED-docs-only` while keeping its tripwire intent. **Default the lead chose:** the six `UNVERIFIED` §14.3 rows (10 playlist remove, 11 playlist reorder, 18 queue remove/reorder, 20 station-from-track, 21 lyrics, 30 offline audio) are resolved from Apple's published API documentation only, and the finding stays labelled `UNVERIFIED-docs-only`. **A fixture provider is the day-one implementation**; the Apple adapter ships as a compiling stub whose `supports()` returns the §14.3 Apple column with every unresolved row set to `false` (conservative — a capability is absent until proven present).

**Consequence to accept knowingly:** the highest-risk row in the whole spec — whether `pod-edit-playlist` is implementable on the launch provider — stays open through 002. It does not block 002, because 002 registers no tools and builds no playlist-edit UI. It **does** block S17 and the staged-diff work in a later workstream, and the spike report must say so in its first line.

---

## H-3 — First-preview composition · `Defaulted`

Owner deferred to the lead. **Default:** stage-2 DOM spine **and** a parallel device render spike on a separate route, disjoint file trees, not composed. Rationale: the 001 build order's honesty checkpoint is preserved intact, while the highest *visual* risk — does the modelled object read as the object — gets answered in week one rather than at stage 5, which is exactly when 001 §3.4 rank 4 says such a call should be made. Cost is one extra lane; the spike is throwaway if it fails.

**Overturn condition:** if the owner wants a single composed preview instead, W3 and W4 must merge into one sequential lane and the preview date moves right.

---

## H-4 — Monorepo shape · `Defaulted`

**Owner instruction, 2026-08-28:** *"we are using bun, you may set up a monorepo using tanstackstart / shadcn template with bun."*

**Default:** `~/code/agentic-context/ui/templates/start-monorepo` is used as a **layout reference only**, not copied. It ships pnpm workspaces + turbo; we take neither. bun workspaces via root `package.json` `"workspaces"`, no turbo, per-package scripts. Rationale: the mandated gate is already per-package (`bunx tsc --noEmit -p <pkg>/tsconfig.json`), so turbo's task graph buys nothing here and adds a dependency plus a second source of truth for build order.

**Logged assumption W0 may proceed on:** `apps/web` is the only app; the Bun+Effect server work lives in `packages/server-core` consumed by TanStack Start server routes, rather than as a second standalone app. Revisit if the artwork proxy needs to outlive the web process.

---

## H-5 — Unwaivable manual gates · `Owner-only`

Two gates in 001 §15 cannot be satisfied by any agent, at any effort level, and no reviewer may approve around them:

1. **U14 — the occlusion rule.** No informational feedback may render under the thumb's contact patch (±33° of the inner ring). 001 says outright: *"the occlusion check must be done on a phone, in hand"* and *"a desktop review cannot pass it."*
2. **§15.2 haptics #4 — the silence check.** Drive a 14-detent agent navigation on a real phone held in the palm: fourteen visible steps, **zero clicks, zero vibrations**. Not applicable in 002 (no tools, no haptics yet), recorded here so it is not lost.

Only (1) is in 002's range, and only once the wheel is interactive. The lead will hand over a numbered checklist and the running URL; the owner performs it.

---

## H-6 — Aesthetic sign-off · `Owner-only`

Three judgments no automated gate can make, all from 001 §15:
- Does the device spike **read as the object**, or as a toy? (§3.4 rank 4's escalation clause: if the answer is no, the design needs re-scoping, and week one is when to find out.)
- Is the panel type legible and correctly weighted at 272×204 in **both** colourways?
- Does light mode read as an inverted *polarity*, not an inverted *hue*?

Presented as screenshot pairs alongside the `design.pen` artboards.


---

## H-7 — `offline` has no home in the `Capability` union · **CLOSED 2026-08-28 → D-019: offline cut repo-wide**

**Raised by S1.** 001 §14.3 row 30 asks whether offline audio is supported. It resolved *unsupported* — but **`offline` is not one of the 26 members of §14.2's `Capability` union**, so there is no `supports()` key for the answer to live in and no way for the UI to branch on it.

**Proposed default (lead):** add `offline` to the union in `packages/providers` and log it as a deliberate, additive deviation from §14.2. The alternative — dropping row 30 silently — means the ⤓ glyph and `Play downloads` copy have nothing driving them, which is exactly failure mode 8, a silently dropped state.

**Owner call needed:** is offline a product capability at all, or is it out of scope repo-wide? If out of scope, the ⤓ glyph and `Play downloads` are cut from five screens and no union member is needed.

## H-8 — `pod-get-lyrics` now registers on no provider · `Defaulted`, owner may overturn

Spotify refuses lyrics to third parties (§14.3 row 21, `VERIFIED`). S1 finds no public Apple lyrics endpoint either. So a tool in the 18-tool surface would be **permanently unregistered on every provider we support**.

**Proposed default (lead):** leave the tool specified but unregistered, and revisit when the WebMCP workstream opens rather than amending 001's roster now. Deleting it is tidier; keeping it costs nothing while no tools ship, and row 21 is still under review.

**Consequence either way:** Now Playing's centre-cycle is **three stops, not four**, and S16 does not exist for either provider.

## H-9 — Shipping on undocumented MusicKit queue methods · `Blocking` if anyone wants it

S1 found `splice`, `updateItems`, `removeQueueItems` in Apple's shipped `musickit.js` v3 — undocumented, with `remove()` emitting its own deprecation warning. A runtime probe (`typeof queue.splice === "function"`) could recover S17's swipe-to-remove.

**Lead recommendation: no.** Building a user-facing affordance on an undocumented method of a third-party SDK, on the *launch* provider, is failure mode 7 — "provider parity that does not exist" — with a delayed fuse: it fails silently in production when Apple ships a minor version. The read-only S17 is a first-class design under 001 §15.1 and is now the design on both providers.

**Owner call:** overrule only with eyes open.


---

## H-10 — Write probes need an interactive sign-in the owner must perform · `Blocking` D-018's execution

D-018 authorises write probes against a throwaway playlist. **They cannot be run headlessly.** Apple Music library writes require a **Music User Token**, obtained through MusicKit JS `authorize()` — a browser flow where the owner signs in to their Apple account. The developer token signed from `cert/` authorises *catalog reads only*; it cannot mint a user token.

**Proposed default (lead):** S2 delivers a minimal local page that runs `MusicKit.configure()` + `authorize()` and surfaces the user token, plus the probe script ready to consume it from an env var. The owner signs in once, exports the token, runs one command. Roughly a two-minute task, done once.

**Owner call needed:** are you willing to do the interactive sign-in? If not, D-018 stays authorised-but-unexecuted and rows 10/11/18 rest on S1's enumeration evidence, which is where they are today and is not a blocker for 002.

**Handling note:** a Music User Token is a live credential for the owner's personal account. It falls under D-017 — env var only, never printed, never written to a file, never in a diary or a prompt, and short-lived.


---

## H-11 — `APPLE_TEAM_ID` is missing and is not derivable · **CLOSED 2026-08-28**

S2 wrote both scripts, verified them clean, and **could not run a single authenticated request.** The Team ID exists nowhere: not in env, not in any `.env` (none exists), not in `cert/` (which holds only the `.p8`), not in the repo, and **not derivable from the key** — a PKCS#8 EC key yields the Key ID via its filename and nothing more; the Team ID is a separate account identifier.

S2 confirmed the blocker rather than assuming it: a token with a correct `kid` and a placeholder `iss` is rejected `401` with an empty body. Apple validates the team claim.

**Two things needed from the owner, not one:**
1. The **Apple Developer Team ID** (10 characters, from the membership page).
2. Confirmation that this key has the **MusicKit capability enabled**.

**Why both:** a wrong Team ID, a revoked key, and a key without MusicKit all produce the **identical opaque `401` with no body**. One wrong answer costs a full undiagnosable round trip. Ask once, ask for both.

After that, S2 is one command and roughly 18 GETs.

**Handling:** the Team ID is an account identifier, not a secret on the order of the key, but it goes in an env var alongside the key path — never hardcoded, never committed.

**Resolution, 2026-08-28.** Owner placed `APPLE_TEAM_ID` in `.env.local` and confirmed the key carries the MusicKit capability. Lead verified without printing the value: present, 10 alphanumeric characters, correct format; `.env.local` matched by the existing `.env*` ignore rule; nothing env-shaped tracked. **Consequence worth keeping:** the opaque-401 ambiguity is now gone, so any further 401 is a real finding rather than a configuration problem, and S2 was told to report it as such.
