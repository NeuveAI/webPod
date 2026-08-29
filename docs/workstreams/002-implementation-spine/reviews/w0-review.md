# Review: W0 — bun monorepo scaffold, repo hygiene law, `packages/tokens`

**Commits reviewed:** `9e65a48`, `8f27b02`, `48b3b90` · plus `diary/w0.md`, `decisions/w0.md`, `evidence/w0-*`
**Contracts loaded:** `review-system-prompt.md`, `dispatch/W0-scaffold.md`, `decision-log.md` (D-003, D-004, D-005, D-007, D-017, D-020, D-021), `scope.md`, `001/design-system.md` §12.0 / §12.1 / §12.2 / §14.2 / §7.3 / §7.4.

## Verdict: REQUEST_CHANGES

Five Major findings. The slice is unusually well-built — the §12.1 transcription is genuinely byte-identical, every §12.0 geometry number is correct, the commits are trailer-free and each typechecks standalone, and the evidence files reproduce exactly when re-run. The blockers are all *holes in the enforcement*, not wrong numbers: a ruling that was never applied, two attribution-critical constants that no test locks, a gate that does not cover its own runner, and shadcn wiring that cannot resolve.

---

### Findings

- **[MAJOR] D-020's `@theme static` ruling is not applied, and as written it would not have been sufficient** (`packages/tokens/src/globals.css:12`, `:81`, `:235`) — The file on disk is byte-identical to §12.1 (`md5 b565cf88a51605433feb641ddcac8753` for both), so `@theme` is still plain `@theme`. I rebuilt and grepped the output CSS: `--fx-wheel-r`, `--fx-halo-blur`, `--fx-agent-blur`, `--fx-halo-c`, `--fx-trail-c`, `--panel-w`, `--panel-h`, `--dur-tick`, `--ease-agent`, `--radius-device` are **all still absent** (0 occurrences each). The engineer correctly raised this rather than acting unilaterally and the lead ruled; the ruling then never landed in code, so W3 and W4 will inherit exactly the trap D-020 exists to prevent.
  **And the one-word fix is incomplete.** I applied `@theme static` to line 12 alone and rebuilt: the FX block came back, but 36 further variables were still shaken out — the entire `--color-human-100…900` and `--color-agent-100…900` actor ramps, `--color-brand-am*`, and every §12.2 shadcn semantic (`--color-primary`, `--color-accent`, `--color-background`, `--color-border`, `--color-input`, `--color-ring`, `--color-ui-text-1..3`, …), because they live in the two `@theme inline` blocks at `:81` and `:235`. Any hand-written `var(--color-agent-500)` in W3/W4 resolves to nothing — and that is the agent attribution colour. I then applied `@theme static inline` to both blocks and rebuilt: **all 146 declared variables present, zero missing.** The correct application of D-020 is three edits, not one.

- **[MAJOR] The two blur values — the numbers §12.0 and §14.2 both say must be guarded in review — are not locked to their exact values** (`packages/tokens/src/geometry.test.ts:92-108`) — The suite asserts the *relationships* (`HALO.blur >= 0.5 × stepArc`, `TRAIL.blur < 0.5 × stepArc`, ratio `0.218`, `HALO.blur / TRAIL.blur > 2`) but never `expect(HALO.blur).toBe(4.25)` / `expect(TRAIL.blur).toBe(1.8)`, while every other §12.0 table value *is* asserted by equality at `:27-38`. I planted `HALO.blur: 4.25 → 4.06` — a value §12.0 explicitly rejects ("*4.0 is 0.494× — a hair under; raise it*") — and **15 pass, 0 fail**. The dispatch packet's verification line is "a unit test asserting the geometry constants match the §12.0 table exactly"; for the two constants that carry LAW 3 channel 2 it does not. (The trail side is better guarded: planting `TRAIL.blur: 1.8 → 4.13` correctly produced 2 failures and exit 1.)

- **[MAJOR] The gate runner is outside the gate: no tsconfig covers `scripts/`** (`scripts/typecheck.ts:16`) — `WORKSPACE_ROOTS = ['apps', 'packages']`, and there is no `tsconfig.json` at the repo root or under `scripts/`. I appended `const bogus: number = "definitely not a number"` to `scripts/typecheck.ts` itself and ran the full gate set: `bun run typecheck` **exit 0, "10/10 packages clean"**; `bun run lint` did not flag the file (eslint here is not type-aware); `bun test` exit 0. So the file that decides whether the repo typechecks is the one file the repo never typechecks, and the same hole covers `scripts/gates.ts` — which W5a is about to fill with the whole static gate set. Add a `scripts/tsconfig.json` (or a root one covering `scripts/**`) and include it in `findPackages()`'s sweep.

- **[MAJOR] The shadcn wiring cannot resolve — three ways** (`apps/web/components.json:8`, `:18-19`; `packages/ui/package.json:6-8`) — `components.json` declares `"utils": "@webpod/ui/lib/utils"` and `"ui": "@webpod/ui/components"`, but (a) `@webpod/ui` is **not** a dependency of `apps/web` — `Bun.resolveSync('@webpod/ui', 'apps/web')` fails with *Cannot find module*, and the diary itself explains why (Bun 1.4's isolated linker hoists nothing); (b) even once added, `packages/ui`'s `exports` map exposes only `"."`, so the `/lib/utils` and `/components` subpaths would still fail — `Bun.resolveSync('@webpod/ui/lib/utils', …)` fails too; and (c) `"css": "../../packages/tokens/src/globals.css"` points shadcn's writer at the file whose entire value is being byte-identical to §12.1 — the first `shadcn add` will silently mutate the one artefact this slice's correctness rests on. W0.1's "shadcn per `ui/apps/v4/components.json`" is therefore declared but dead; the first lane to add a component discovers it. Point `css` at `apps/web/src/styles/app.css`, add `@webpod/ui` to `apps/web` dependencies, and widen `packages/ui`'s `exports` (or drop the aliases until the package has that shape).

- **[MAJOR] `globals.css` and `geometry.ts`/`fx.ts` are two unreconciled copies of the same numbers, with no test binding them** (`packages/tokens/src/globals.css:56-76` vs `packages/tokens/src/fx.ts:68-100`, `geometry.ts:21-83`) — Both copies are currently correct; I checked every one (`--fx-wheel-r 115` / `WHEEL_R 115`, `--fx-halo-blur 4.25` / `HALO.blur 4.25`, `--fx-agent-blur 1.8` / `TRAIL.blur 1.8`, `--panel-w/h 272/204`, `--fx-repeater-r 143`, `--fx-agent-alpha-persist-max 0.18`, `--fx-rt-scale-* 0.558/0.30`, `--fx-taper-gamma-* 1.6/2.0`). Nothing keeps them that way. The slice's stated correctness target is "the design system's tokens live in one package as the **single** source"; there are two sources inside that package, and the D-020 fix is about to require editing the CSS one. A test that parses `globals.css` and asserts each `--fx-*` / `--panel-*` equals its TS counterpart closes this in one file and would also have caught the blur gap above.

- **[MINOR] Blanket lint suppression over a committed source file, with no logged invariant** (`eslint.config.js:13`; `apps/web/src/routeTree.gen.ts:1,18`) — `**/routeTree.gen.ts` is ignored repo-wide, and that file carries both `/* eslint-disable */` and `} as any)`. The packet's gate is "no lint disable without a logged invariant"; `decisions/w0.md` logs none for it. It is generated code and the diary explains why it is committed, so the fix is a logged invariant naming the generator, not a code change.

- **[MINOR] The `useState` ban escapes a non-`React` namespace alias** (`eslint.config.js:28-43`; `AGENTS.md:47`) — `AGENTS.md` states the law is "Enforced by `no-restricted-syntax`". I planted `import * as R from 'react'` + `R.useState(0)` in a route: **zero errors reported on that file**. The three selectors cover the bare call, the literal `React.useState` member form (which is what shadcn ships, so the common case is caught) and the import specifier — but not an arbitrary alias. One extra selector (`MemberExpression[property.name='useState']`) closes it. I confirmed the covered forms do go red: the direct-import plant produced three errors and exit 1.

- **[MINOR] `LABEL_BAND_INNER_R`'s TSDoc describes a value the constant does not hold** (`packages/tokens/src/geometry.ts:51-55`) — "Derived as `SELECT_R + (WHEEL_R - SELECT_R) x 0.493`, which lands at 77.99" sits directly above `= 77`. The constant is right (§12.0's measured band is r 77–79) but the doc reads as if 77 is the derived figure. Say that 77 is the measured inner edge and that the ×0.493 derivation lands at 77.99 inside it.

- **[MINOR] D-017 is a `LAW` but is not in `AGENTS.md`** (`AGENTS.md:15-47`) — `AGENTS.md` opens by declaring itself "the repo's standing law", and D-003 and D-004 are both recorded there as instructed. D-017 (never read/print/copy anything under `cert/`; key is server-side only; path from env, never hardcoded) is recorded only in `decision-log.md`, so an agent that reads `AGENTS.md` and nothing else has no instruction about the live signing key sitting in the tree. D-017 postdates the dispatch packet, so this is a follow-up rather than a W0 defect — but it is the cheapest gap on this list to close.

- **[MINOR] `evidence/w0-history-rewrite-plan.md` is stale against the current tip** (`evidence/w0-history-rewrite-plan.md:75-83`, `:170-196`, `:238-242`) — It was written at HEAD `8f27b02`; `main` is now `c3cae15`. Step 3.0 tells the owner to confirm a six-line log that no longer matches, §5's before/after omits `48b3b90` and `c3cae15`, and §6's `git show-ref` block is out of date. The rewrite itself is path- and message-based so it still does the right thing, but the owner's first verification step will disagree with reality, which is the worst place for a document like this to be wrong.

- **[MINOR] The light colourway is not reachable in the running app, under a comment asserting it is** (`apps/web/src/routes/__root.tsx:22-29`) — The docblock says "both modes must remain reachable without changing the OS setting", then hardcodes `data-mode="dark"` with no switch anywhere. W0.3's actual requirement — both colourways defined at the token layer — **is** met, and I verified both blocks survive to the built CSS. This is the comment overclaiming, and a note for whichever lane owns the switch.

- **[MINOR] The diary's "loose end" is stale** (`diary/w0.md:84-88`) — "the `.gitignore` security fix is uncommitted" was true when written; it landed in `c3cae15`. `git check-ignore -v cert` now returns `.gitignore:18:cert/`.

- **[INFO] `bun run lint` is red on the working tree right now, and not because of W0** — `scripts/spikes/mint-apple-dev-token.ts:72` (untracked, S2's lane) trips `@typescript-eslint/no-non-null-assertion`. None of W0's committed files produce a single lint error. Flagging it because the repo's lint gate does not currently pass, and whoever owns that spike needs to know.

- **[INFO] Two gates I cannot clear, per H-5 and H-6** — **U14 thumb occlusion** needs a phone in a hand, and the **both-colourway aesthetic call** is the owner's. Neither is cleared by this review, and neither is claimed by W0. I am recording them rather than passing over them; W0 touches neither, so nothing here is blocked on them.

---

### What I checked and found correct

Recorded because "assume it is wrong until proven right" cuts both ways, and because several of these are the exact places this slice could have gone silently wrong.

- **§12.1 transcription is genuinely byte-identical.** I extracted lines 2470–2775 of `design-system.md`, stripped the fence, and diffed: **no output**, and `md5` matches on both sides (`b565cf88a51605433feb641ddcac8753`). There is **no second divergence** — the only intended deviation (D-020) is the one that has not been applied yet.
- **Every §12.0 geometry constant is correct**, checked one by one against the source table: `WHEEL_R 115`, body `330×552`, `WHEEL_TO_BODY_RATIO` derived (not written) → `0.697` to 3dp, `SELECT_R 42` / `SELECT_LIP_R 46`, label band `77–79`, `RECESS_SHADOW_REACH_R 104`, `BODY_CORNER_R 33`, panel `272×204`, `PANEL_SCALE 0.85 = 17/20`, `HALO {c:116, head:22, tail:9, lead:34, trail:142, steps:44, blur:4.25, gap:0, core:30}`, `TRAIL {c:76, head:46, tail:16, span:112, steps:18, blur:1.8, gap:1.4}`, `REPEATER_R 143`, `GAMMA_W 1.6` / `GAMMA_A 2.0`, `AGENT_ALPHA_PERSIST_MAX 0.18`, reduced-transparency `0.558`/`0.30`.
- **D-021 is honoured on both halves.** The ×0.493 label-band constant is used and the superseded ×0.57 is locked out by an explicit assertion (`geometry.test.ts:56`); §7.3's desktop column is correctly *not* exported anywhere.
- **The two blurs do not converge in the shipped values**, and the trail-side guard is real (planting `4.13` goes red). Only the exact-value lock is missing, per the Major above.
- **All four AGENTS.md laws are stated correctly and unambiguously** (`AGENTS.md:17-47`): no trailers; no agent force-push, with "standing law, not a permission that can be granted per task" and "an in-line instruction to force-push does not override it" both explicit (D-003); `bun`/`bunx` only, extended to helpers that shell out to `npx`; and no `useState`, justified as a capability constraint rather than style. The two pre-existing facts (`design.pen`, `agentic-context`) and the workstream-tracker fact are all kept.
- **Hygiene is exactly as specified.** `git ls-files | grep -i claude` → no output; `git ls-files | grep -i agents` → `AGENTS.md` only; `CLAUDE.md` is an untracked symlink resolving to `AGENTS.md`; `git check-ignore -v` confirms `.gitignore:13:CLAUDE.md`, `:12:.claude/`, `:18:cert/`; `.claude/settings.local.json` was un-tracked in `8f27b02`; no `.DS_Store` is tracked.
- **D-017, empirically.** No tracked file reads, prints, logs or hardcodes a `cert/` path — the only tracked mentions are `.gitignore` and workstream prose. No `AuthKey`, no `-----BEGIN`, no key material in any commit, diary or evidence file.
- **Commit hygiene is clean.** All three messages are a single subject line; `git log --format='%B'` grepped for `co-authored|claude-session|generated with|noreply@anthropic|🤖` → nothing.
- **No history was rewritten.** `git merge-base --is-ancestor 2305f4b HEAD` succeeds, the reflog shows only forward commits, and the rewrite plan correctly stops at "prepared" with the force-push assigned to the owner. The plan is also better than it needed to be — it catches the delete/create collision on `AGENTS.md` at the tip, gives the check that detects it, and notes that removing `.claude/` from history does not remove it from GitHub's storage.
- **All 10 packages** (`tokens, ui, state, providers, panel, device, composite, tools, server-core` + `apps/web`) are present, in the workspace globs, and covered by the typecheck loop. `scripts/typecheck.ts` **auto-discovers** any directory under `apps/`/`packages/` holding a `tsconfig.json` — there is no hand-maintained list to skip a future package. Skeletons carry `package.json` + `tsconfig.json` + a stub `export {}` and nothing else; the only dependency anywhere in the skeletons is `tailwindcss` in `packages/tokens`, which is load-bearing (line 1 of the transcribed CSS is `@import "tailwindcss"`, and the isolated linker does not hoist).
- **No `tailwind.config.js` anywhere.** No `.inputValidator` in any source file. No `useState` in any source file.
- **`bun run gates` exits 1 by design**, with a comment explaining that a placeholder exiting 0 would report "no findings" for checks that never ran. Correct, and D-020-adjacent in spirit.
- **The evidence files are honest.** I re-ran what they claim and got the same numbers, including the planted-violation outputs in `w0-gates-go-red.txt`.

---

### Suggestions (non-blocking)

- The dispatch DoD says "all 9 packages"; there are 10 after the `composite` amendment. Worth correcting in the packet so a later reader does not go looking for the missing one.
- `scripts/typecheck.ts:36` spawns `bunx tsc` per package — ten cold `bunx` resolutions. `Bun.spawn(['./node_modules/.bin/tsc', …])` would do the same work without the resolution, though only if the gate's runtime starts to matter.
- `decisions/w0.md §7` notes `exactOptionalPropertyTypes` is off and offers to reverse it in one line. Worth an explicit lead ruling now rather than after four lanes have written code against the looser setting.
- Sections 8 of both the diary and the decisions file report that `/global-patterns` and `/bun-http` point at a non-existent `~/code/agent-context/` and that `/shadcn` shells out to `npx`. That is a repo-wide agent-tooling defect affecting every lane, and it is currently recorded only inside W0's artefacts.

---

### Gates I ran myself

Every command below was run by me in `/Users/vinicius/code/webPod`, not read from an evidence file.

| Command | Result |
|---|---|
| `bun install` | `Checked 228 installs across 276 packages (no changes)`; `bun.lock` md5 identical before/after (`ad88f02d316105bde53b92c5f78e72d2`) |
| `bun run typecheck` | **10/10 packages clean**, exit 0 |
| `bun run lint` | exit 1 — **one error, in untracked `scripts/spikes/mint-apple-dev-token.ts:72` (not W0)**; zero errors in any W0 file |
| `bun test` | 15 pass, 0 fail, 34 expect() calls, exit 0 |
| `bun run build` | client (`app-*.css` 15.23 kB, `index-*.js` 312.41 kB) + SSR (`server.js` 219.78 kB) bundles, exit 0, no nitro |
| `bun run dev` + `curl -i localhost:3000/` | `HTTP/1.1 200 OK`, SSR markup, `data-mode="dark"` on `<html>`, `<title>webPod</title>` |
| `bun run gates` | `bun run gates: not implemented`, **exit 1** — correct |
| `git archive <c> \| tar -x` + `bun install` + `bun run typecheck`, for each of `9e65a48`, `8f27b02`, `48b3b90` | **10/10 clean at all three** — each commit typechecks standalone, confirmed independently |
| `diff <§12.1 extracted from design-system.md> packages/tokens/src/globals.css` | **no output**; `md5` identical on both sides |
| `grep -c` for `--fx-wheel-r --fx-halo-blur --fx-agent-blur --fx-halo-c --fx-trail-c --panel-w --panel-h --dur-tick --ease-agent --radius-device` in built CSS | **0 for every one** → D-020 not applied (Major 1) |
| Applied `@theme static` (line 12 only), rebuilt, re-grepped | FX block returns (1 each), but **36 vars still missing** — all `--color-human-*`, `--color-agent-*`, `--color-brand-am*` and every §12.2 shadcn semantic |
| Applied `@theme static` + `@theme static inline` (lines 12, 81, 235), rebuilt, diffed 146 declared vars against output | **zero missing** → the correct fix is three edits |
| **PLANT A** `HALO.blur 4.25 → 4.06` → `bun test` | **15 pass, 0 fail** — NOT CAUGHT (Major 2) |
| **PLANT B** `TRAIL.blur 1.8 → 4.13` → `bun test` | 13 pass, **2 fail**, exit 1 — caught (`the two blurs must not converge`, ratio `1.029`) |
| **PLANT C** `import * as R from 'react'; R.useState(0)` in a route → `bun run lint` | **0 occurrences of "useState is banned"** — NOT CAUGHT (Minor) |
| **PLANT D** `import { useState } from 'react'` + `useState<any>(0)` → `bun run lint` | 3 errors, exit 1 — caught (2× `no-restricted-syntax`, 1× `no-explicit-any`) |
| **PLANT E** type error in `packages/state/src/index.ts` → `bun run typecheck` | `error TS2322`, `FAIL packages/state`, **9/10 clean**, exit 1 — caught |
| **PLANT F** type error in `scripts/typecheck.ts` itself → typecheck / lint / test | typecheck **exit 0, "10/10 packages clean"**; lint 0 hits on the file; test exit 0 — NOT CAUGHT by anything (Major 3) |
| **PLANT G** rogue `tailwind.config.js` + a file naming `inputValidator` → typecheck / lint | typecheck exit 0; nothing structurally forbids either — expected, that is W5a's job, recorded so it is not forgotten |
| `Bun.resolveSync('@webpod/ui', 'apps/web')` | *Cannot find module* (Major 4) |
| `Bun.resolveSync('@webpod/ui/lib/utils', 'apps/web')` | *Cannot find module* (Major 4) |
| `Bun.resolveSync('@webpod/tokens', 'apps/web')` | resolves → `packages/tokens/src/index.ts` |
| `git log --format=%B 9e65a48^..48b3b90 \| grep -iE 'co-authored\|claude-session\|generated with\|noreply@anthropic\|🤖'` | no matches |
| `git ls-files \| grep -i claude` / `grep -i agents` | no output / `AGENTS.md` |
| `git check-ignore -v CLAUDE.md .claude cert cert/foo` | all four ignored, from `.gitignore` lines 13, 12, 18, 18 |
| `git merge-base --is-ancestor 2305f4b HEAD` | succeeds — history intact, no rewrite |
| `git grep -n` for `cert/ \| .p8 \| AuthKey \| PRIVATE KEY` outside 001 and `bun.lock` | only `.gitignore` and workstream prose — no key material, no hardcoded path in code |
| `git grep -n inputValidator -- '*.ts' '*.tsx'` / `useState` | none / none |
| `ls tailwind.config.*` (root, `apps/web`, `packages/*`) | no matches |

All planted files were removed and every mutated file restored; `packages/tokens/src/globals.css` and `src/fx.ts` were verified back to their committed md5 afterwards. The `bun.lock`, `packages/state/package.json` and `docs/` modifications present in `git status` at the end of this review belong to other lanes running concurrently, not to me.

---
---

# Re-review — W0 patch

**Commits reviewed:** `206742e` fix(tokens) · `66db5b0` fix(scaffold) · `4cfd539` feat(ui) · `5ec0be6` docs
**Reviewed at HEAD `4fce0f1`.** Nothing was staged or committed; every file I mutated to plant a violation was restored from a byte-backup and verified by md5, and `git status` for `packages/ scripts/ apps/ eslint.config.js tsconfig.base.json AGENTS.md .gitignore` is **empty** at the end of this pass.

## Verdict: APPROVE

All five Majors and all seven Minors are closed. I re-planted every violation myself rather than reading the engineer's evidence, used a different plant from theirs wherever the coordinator asked for one, and added five plants nobody had tried. Every one goes red. Two new items are recorded below; both are Minor/Info and neither blocks.

The revision is honest in the way that matters most here: it did not paper over the two things that would have been easy to hide. The race that produced a spurious `failed: packages/state` is recorded in the evidence rather than re-run until green, and the history-rewrite plan was made *tip-independent* instead of re-pinned to a hash that would go stale again — which is the correct structural answer, not the cheap one.

---

### Round-1 findings — verified closed

**[MAJOR 1 · D-020] CLOSED.** `globals.css` now differs from §12.1 by **exactly three lines and nothing else** — I re-extracted §12.1 from `design-system.md` and diffed: `@theme` → `@theme static` at `:12`, `@theme inline` → `@theme static inline` at `:81` and `:235`. Six changed lines total (3 `-`, 3 `+`), zero other hunks. **There is no second divergence hiding behind the authorised one.** I rebuilt and enumerated: **146 declared custom properties in the sheet, 146 present in the built CSS, 0 missing.** Both actor ramps are there (`--color-human-500`, `--color-agent-500`), as are `--color-primary`, `--color-accent`, `--color-brand-am`, every `--fx-*`, `--panel-w/h`, `--dur-tick`, `--ease-agent`, `--radius-device`. The corrected three-block ruling was applied, not the original one-word version.

**[MAJOR 2 · blur lock] CLOSED.** `geometry.test.ts:96-99` pins both by equality. Re-planted the exact value round 1 missed, `HALO.blur 4.25 → 4.06`: **exit 1, 2 failures** (`--fx-halo-blur equals its TS constant`, `both blur values are exactly what §12.0 ships`) where I previously got 15 pass / 0 fail. Also planted the trail side with a value the engineer did *not* test — `TRAIL.blur 1.8 → 1.75`, a plausible "visual tweak" rather than the obvious `4.13`: **exit 1, 3 failures.** Both blurs now fail through two independent tests, which is the right redundancy for the one constant §14.2 says to guard in review.

**[MAJOR 3 · gate runner] CLOSED.** `scripts/tsconfig.json` exists, `scripts/typecheck.ts:26` adds a `STANDALONE_ROOTS` sweep, and the gate reports **11/11 projects**. Per the coordinator's ask I planted in a *different* file from the engineer's — a type error in `scripts/gates.ts`: **`FAIL scripts (exit 2)`, `10/11 projects clean`, `failed: scripts`, exit 1.** I then repeated round 1's exact plant in `scripts/typecheck.ts` itself: same red. The runner now catches errors in itself and in its sibling, which is the property that was missing.

**[MAJOR 4 · shadcn wiring] CLOSED, all three sub-defects.** `Bun.resolveSync` from `apps/web` now succeeds for `@webpod/ui` → `packages/ui/src/index.ts`, `@webpod/ui/lib/utils` → `packages/ui/src/lib/utils.ts`, `@webpod/tokens`, `@webpod/tokens/globals.css` (and `@webpod/composite`). I went further than the claim and verified the `./components/*` export map is genuinely correct rather than merely present: it fails only for want of a file, so I created `packages/ui/src/components/button.tsx`, resolved `@webpod/ui/components/button` successfully, and deleted it. And the writer target really moved — `components.json:8` is now `"css": "src/styles/app.css"`, so `shadcn add` can no longer mutate the §12.1 transcription.

**[MAJOR 5 · CSS↔TS parity] CLOSED, and it holds in both directions.** `tokens-parity.test.ts` binds 28 properties. I planted four divergences, two of which the engineer did not:
- **TS-only** (`HALO.core 30 → 31`, CSS untouched) → exit 1, `--fx-halo-core equals its TS constant` fails.
- **CSS-only** (`--fx-halo-blur: 4.25px → 4.30px`, TS untouched) → exit 1, same test fails from the other side.
- **A new unbound token** added to the sheet (`--fx-thumb-r: 21px`) → exit 1, the completeness test fails. So a token cannot be added with only one home.
- **A bound token deleted** from the sheet (`--panel-h`) → exit 1, **two** failures, including the reverse-completeness guard at `:115`. So the suite cannot be made to pass by having nothing left to check.
I also planted a **D-020 regression** (`@theme static inline` → `@theme inline` at `:81`) → exit 1, `every @theme block is static` fails. And I checked the parity helper's one structural risk myself: `cssNumber` takes the *first* declaration, so a token redeclared later with a different value would be read from the wrong place — I verified **all 28 bound tokens are declared exactly once** in the sheet, so the blind spot is not reachable today.

**[MINOR ×7] All closed and verified:** the `routeTree.gen.ts` lint-ignore invariant is logged (`decisions/w0.md:196-203`, and it names the right escape hatch — edit the route source, not the generated file); the `useState` alias escape is closed (below); `LABEL_BAND_INNER_R`'s TSDoc now says 77/79 are measured and the ×0.493 construction is the *check* rather than the source (`geometry.ts:49-60`); D-017 is in `AGENTS.md`; the rewrite plan is tip-independent; the `__root.tsx` docblock no longer overclaims and now names what the owning lane must do; the diary's stale `.gitignore` "loose end" is gone.

---

### Rulings — compliance checked, not relitigated

- **D-037.** `allowImportingTsExtensions: true` is present at `tsconfig.base.json:11`, paired with the `noEmit: true` that TypeScript requires alongside it. It permits a pattern rather than requiring one, exactly as ruled. `exactOptionalPropertyTypes` remains absent from the base and is carried as an open item in `decisions/w0.md:257`. Compliant; not reopened.
- **D-017.** `AGENTS.md:40-56` carries all four numbered points of the decision-log entry, unambiguously and without softening: never read/print/copy/quote anything under `cert/`; never place key material in a commit, log, diary, evidence file, review **or agent prompt**; private key server-side only with minting in `packages/server-core` and *"a client-reachable route that touches the key is a Critical finding"*; path from an environment variable, never hardcoded and never defaulted to a repo-relative path; tokens short-lived and never logged. It also adds a fact the decision log only implies — *"A live signing key sits in `cert/`, ignored but present"* — which is the sentence that makes an agent take the rest seriously. Correct as written.

### The engineer's two honest notes — both confirmed

- **The `packages/state` race is recorded, not buried.** `evidence/w0-dev-and-test.txt:30-34` states it verbatim: an earlier sweep reported `failed: packages/state`, it was a race with W2 mid-write, a re-run seconds later was 11/11, and *"No file under packages/state is mine, and I did not touch one to make this pass."* Independently checkable and true — none of the four commits touches `packages/state`.
- **The rewrite plan is genuinely tip-independent.** Step 3.0 records `BEFORE_TIP=$(git rev-parse HEAD)` instead of quoting a hash, and replaces the old stale log with three invariants verified at run time (`2305f4b` is still the earliest commit carrying `.claude`/`CLAUDE.md`; still the only one with a banned trailer; still an ancestor of HEAD). §6 re-derives the force-push requirement from a live `git fetch origin` rather than the old hard-coded `show-ref` block. §5 adds what must *not* change — three hashes, `design.pen` byte-identical, commit count unchanged. The only hashes it still names are ones that genuinely cannot drift.

---

### New findings

- **[MINOR] The broadened `useState` selector still misses two evasion shapes** (`eslint.config.js:34-41`) — The coordinator asked me to hunt for one, and there are two. `MemberExpression[property.name='useState']` closes the round-1 escape (I confirmed: `import * as R from 'react'; R.useState(0)` → **exactly 1 error, exit 1**), but `property.name` is undefined for a computed access and absent for a destructure:
  - `R['useState'](0)` → **lint exit 0, zero errors.**
  - `const { useState: mk } = R; mk(0)` → **lint exit 0, zero errors.**

  I am rating this Minor rather than Major deliberately: every shape anyone writes *by habit* is now caught — the bare import, the `React.useState` member form that shadcn ships, any aliased namespace, and the import specifier. What remains are shapes you only reach by trying to get around the rule, and review still catches those. Closing them is two more selectors: `MemberExpression[computed=true][property.value='useState']` and `Property[key.name='useState']`.

- **[MINOR] The rewrite plan's §4 recovery block did not get the tip-independence treatment the rest of the file did** (`evidence/w0-history-rewrite-plan.md:143`, `:165`) — §4 still opens *"The tip commit `8f27b02`"*; `8f27b02` has not been the tip since round 1 and now has six commits after it. The warning's substance is still correct — `8f27b02` really is the commit holding both the `CLAUDE.md` delete and the `AGENTS.md` create — but the recovery snippet is written as if it were HEAD: `git checkout HEAD~1 -- AGENTS.md 2>/dev/null || git show 8f27b02:AGENTS.md` would take `AGENTS.md` from the wrong commit, and its fallback names a hash that **will not exist inside the rewritten clone**, since `8f27b02` is downstream of `2305f4b` and gets a new hash. Rephrase §4 to say "the commit that renames `CLAUDE.md`" and recover by locating it in the rewritten history (`git log --format='%H %s' | grep 'repo hygiene'`), or lean on §4's own stated alternative and skip pass 2 entirely. Low blast radius — it is a fallback for a failure mode that may not occur, in a document the owner runs interactively — but it is the one place the plan can still hand the owner a wrong tree.

- **[INFO] `packages/ui/src/lib/utils.ts` is real code in a package W0 does not own — logged, justified, and for the lead to confirm** (`decisions/w0.md:236-249`) — The packet's guardrail is "any `src/` beyond the one-line stub in packages you do not own" is out of bounds. The engineer flagged this itself as *"a deliberate, logged exception"* rather than slipping it in, and it is load-bearing: I verified that the widened `exports` map alone does **not** make `@webpod/ui/lib/utils` resolve — without the file, Major 4 stays open. It is the canonical shadcn `cn()`, three lines of body, and the cheapest possible thing for the owning lane to replace. Recording it for the lead's explicit blessing rather than treating it as a defect.

- **[INFO] Two gates I still cannot clear, unchanged from round 1** — **U14** thumb occlusion (H-5) needs a phone in a hand, and the **both-colourway aesthetic call** (H-6) is the owner's. W0 touches neither and claims neither. Worth restating that light is defined at the token layer and survives to the build (I verified both `:root` and `[data-mode="dark"]` blocks ship) but is **not reachable in the running app** — `__root.tsx` hardcodes `data-mode="dark"` and now says so explicitly. That is a real gap in the §15.3 item-11 sense, correctly documented and correctly assigned to the lane that owns the mode control.

### Suggestions (non-blocking)

- `tokens-parity.test.ts:46`'s regex reads the first declaration of a property. That is right today because all 28 bound tokens are declared exactly once — a fact worth asserting in the test rather than leaving as an ambient property of the sheet, since the day someone adds a media-query override is the day the helper starts reading the wrong one silently.
- `CSS_ONLY` at `:89` currently holds two entries with prose reasons. When a third arrives, the reason is the thing that stops it becoming a dumping ground; keep requiring one.

---

### Gates I ran myself — re-review

All run by me at HEAD `4fce0f1`.

| Command | Result |
|---|---|
| `diff <§12.1 re-extracted> packages/tokens/src/globals.css` | **exactly 3 changed lines** (`:12`, `:81`, `:235`), all `@theme` → `static`; **no other hunk** |
| `bun run build` + enumerate all declared vars vs built CSS | **146 declared, 0 missing** — full list empty |
| built-CSS spot checks | `--fx-wheel-r --fx-halo-blur --fx-agent-blur --panel-w --panel-h --dur-tick --ease-agent --radius-device --color-human-500 --color-agent-500 --color-primary --color-accent --color-brand-am` → **1 each** |
| `bun run typecheck` | **11/11 projects clean**, exit 0 |
| `bun run lint` | exit **0**, no output (the S2 spike error from round 1 is gone) |
| `bun test` | **140 pass, 0 fail**, 365 expect() calls, exit 0 |
| `bun run gates` | `not implemented`, exit **1** — still correct |
| `bun run dev` + `curl` | **HTTP 200** |
| **PLANT 1** `HALO.blur 4.25 → 4.06` (round 1's miss) | exit 1, **2 fail** — CLOSED |
| **PLANT 2** `TRAIL.blur 1.8 → 1.75` (not the engineer's 4.13) | exit 1, **3 fail** |
| **PLANT 3** `HALO.core 30 → 31` (TS-only divergence) | exit 1, **1 fail** — `--fx-halo-core` parity |
| **PLANT 4** `--fx-halo-blur: 4.30px` in CSS (CSS-only divergence) | exit 1, **1 fail** — same test, other direction |
| **PLANT 5** new `--fx-thumb-r: 21px` with no TS counterpart | exit 1 — completeness test |
| **PLANT 6** delete `--panel-h` from the sheet | exit 1, **2 fail** — incl. the reverse-completeness guard |
| **PLANT 7** `@theme static inline` → `@theme inline` at `:81` | exit 1 — D-020 regression guard |
| **PLANT 8** type error in `scripts/gates.ts` (different file from the engineer's) | `FAIL scripts (exit 2)`, **10/11 clean**, `failed: scripts`, exit 1 |
| **PLANT 8b** type error in `scripts/typecheck.ts` (round-1 repeat) | `FAIL scripts`, **10/11**, exit 1 |
| **PLANT 9a** `import * as R from 'react'; R.useState(0)` | **1 error, exit 1** — CLOSED |
| **PLANT 9b** `R['useState'](0)` | **exit 0, 0 errors** — still escapes (new Minor) |
| **PLANT 9c** `const { useState: mk } = R; mk(0)` | **exit 0, 0 errors** — still escapes (new Minor) |
| `Bun.resolveSync` ×5 from `apps/web` | `@webpod/ui`, `@webpod/ui/lib/utils`, `@webpod/tokens`, `@webpod/tokens/globals.css`, `@webpod/composite` — **all resolve** |
| `Bun.resolveSync('@webpod/ui/components/button')` with a temp file created | **resolves** → the `./components/*` map is correct, not just present; temp file deleted |
| `grep '"css"' apps/web/components.json` | `"css": "src/styles/app.css"` — writer target moved off the transcription |
| `git archive` + `bun install` + `bun run typecheck`, each of the four commits | `206742e` 10/10 (pre-`scripts/`), `66db5b0` 11/11, `4cfd539` 11/11, `5ec0be6` 11/11 — **all exit 0** |
| `bun test packages/tokens` at `206742e` | 47 pass, 0 fail |
| `git log --format=%B 206742e^..5ec0be6 \| grep -iE 'co-authored\|claude-session\|generated with\|noreply@anthropic\|🤖'` | **no matches** |
| `git merge-base --is-ancestor 2305f4b HEAD` | succeeds — no history rewritten |
| `git ls-files \| grep -i claude` / `ls -l CLAUDE.md` | none / untracked symlink → `AGENTS.md` |
| `git check-ignore -v cert CLAUDE.md .claude` | all three ignored (`.gitignore` :18, :13, :12) |
| `git grep -E 'BEGIN [A-Z ]*PRIVATE KEY'` | **no key material anywhere** |
| `git grep 'cert/' -- '*.ts' '*.tsx' '*.json' '*.js'` | **none in code** (only `.gitignore` and workstream prose) |
| `find . -name 'tailwind.config.*'` | **none** |
| `git grep inputValidator -- '*.ts' '*.tsx'` | **none** |
| `git grep useState -- '*.ts' '*.tsx'` | one hit, a prose comment in another lane's `_probe.capabilities.tsx` — no call site |
| type-escape audit over the four commits' changed source | **zero** — no `any`, no `as unknown`, no non-null assertion, no `@ts-expect-error`, no `eslint-disable` |
| duplicate-declaration check on all 28 bound tokens | each declared **exactly once** — the parity helper's first-match rule has no blind spot today |
| `git status --porcelain packages scripts apps eslint.config.js tsconfig.base.json AGENTS.md .gitignore` | **empty** — every plant restored, nothing staged, nothing committed |
