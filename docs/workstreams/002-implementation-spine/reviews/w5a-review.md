# Review: W5a — Static correctness gate harness

## Verdict: REQUEST_CHANGES

### Correctness Check

- **Source of truth:** loaded `scope.md`, `dependency-graph.md`, `hitl-decisions.md`, `decision-log.md` through D-066, `review-system-prompt.md`, `review-lanes.md`, `dispatch/W5-gates.md`, 001 `pm-spec.md` §15.0–15.3, `AGENTS.md`, and the W5a diary, decisions, and evidence.
- **Correctness target:** one root command must mechanically reject real U8/U9/U10 and §15.2 violations without making valid source, required state names, or truthful documentation illegal. D-064 requires every mutation to prove it landed before measuring the gate.
- **Bun ground truth:** read `/Users/vinicius/code/agentic-context/bun/AGENTS.md`, `docs/guides/process/spawn*.mdx`, `docs/guides/test/run-tests.mdx`, `docs/test/{index,discovery,writing-tests}.mdx`, `docs/runtime/glob.mdx`, and `docs/snippets/cli/run.mdx`. Bun 1.4.0 recursively discovers both `*.test.*` and `*.spec.*`; the earlier Playwright collision was therefore a real foreign test-layout violation, not a W5a false positive.
- **Skills:** loaded `/strict-critique`, `/team-orchestration`, its review protocol, `/workstream-scoping`, and `/global-patterns`. The latter still points at stale `~/code/agent-context/global.md`; per repo law and W5a-D6 I used only `/Users/vinicius/code/agentic-context`.
- **Kanban / Neuve:** not applicable by the explicit owner ruling in `scope.md`; this repo uses `tracker.md` and has no Neuve shell or board.
- **Dispatch scope:** commits `2d65f7a`, `826316e`, and `97fba65` contain only the three owned scripts and W5a diary/decision/evidence artifacts. No W4 file, root manifest, lockfile, or foreign implementation was swept.
- **Dependency/HITL:** W5a was ready on W0. U14 remains owner-only and U15 reviewer-only; neither can be represented as cleared merely because all automated predicates pass.
- **Type/lint/doc gates:** the scripts project typechecks at `2d65f7a`; current repo typecheck is 11/11 and lint is clean. Exported gate functions have useful comments, but several comments claim stronger behavior than the implementation provides.
- **Git history:** all three commits are coherent, `git diff --check` is clean, and no prohibited trailers occur in the reviewed range. Current foreign modifications were left untouched.
- **Verification evidence:** `bun test scripts/gates.test.ts` reproduces 19/19 green with 150 assertions. An archive of `2d65f7a` also typechecks and runs the same 19 tests green. Those tests prove only the exact planted spellings; thirteen independently planted executable violations below remained green.
- **D-038 questions:** the method contradicts itself in two places. W5a-D5 adopts AST inspection specifically to avoid prose false positives, while W5a-D2 deliberately makes three other gates fail on prose. D-064 is obeyed mechanically by every shipped plant, but the evidence then treats one planted spelling per gate as proof of the broader invariant. The plants landed; the unsupported inference comes afterward.

### Findings

- **[CRITICAL] The credential gate can report PASS with tracked private-key material in a documentation/evidence-shaped file, and its failure formatter can echo a secret-bearing source line** (`scripts/gate-core.ts:19`, `scripts/gate-core.ts:93`, `scripts/gate-core.ts:239`) — `credentialFindings` rejects suspicious *paths* from `git ls-files`, but scans private-key markers only in `SOURCE_GLOB`, which excludes Markdown, text evidence, env examples, and other tracked artifacts. I force-added a synthetic `docs/leak.txt` containing the standard PEM private-key begin-boundary marker; the CREDENTIALS gate stayed PASS. This directly misses the repo law that key material must never enter a diary, evidence file, review, or transcript. For matching source files, `formatLine` includes the complete line in the report, so a one-line embedded credential would be copied into gate output. A credential gate must inspect every tracked blob safely and report only path/line metadata, never matched content; it must continue to avoid enumerating or opening the real `cert/` directory.

- **[MAJOR] U8 can be bypassed both by ordinary authorization vocabulary and by smuggling banned copy onto an allowlisted line** (`scripts/gate-core.ts:37`, `scripts/gate-core.ts:64`, `scripts/gate-core.ts:101`) — the word boundary after the partial alternatives `authoris|authoriz` means `authorized`, `authorization`, and `authorised` do not match. Separately, a clearance suppresses the whole line when *any* clearance regex matches: `packages/panel/src/model.ts` containing `permission-denied; waiting for approval` passed U8. These are executable reproductions of the project’s highest-risk historical failure mode. The implementation also claims stale clearances fail, but no predicate verifies that each clearance still matches exactly one intended occurrence; the stale `panel.spec.ts` clearance now produces a false failure on the renamed required state fixture. W5a-D2’s “explicit and narrow” conclusion is disproven by the mechanism.

- **[MAJOR] Four syntax-sensitive gates certify only one spelling and miss straightforward executable violations** (`scripts/gate-core.ts:118`, `scripts/gate-core.ts:138`, `scripts/gate-core.ts:161`, `scripts/gate-core.ts:195`, `scripts/gate-core.ts:263`) — independently confirmed green plants include `switch (provider.id)`, `provider.id !== "apple"`, destructuring `const { id } = provider`, an unsupported tool result assigned to a variable before return, `onError={() => flipDevice()}`, a rejection callback passed as the second argument to `.then`, `tier === Tier.T1`, and `tier.startsWith("t1")`. These are not exotic obfuscations: they are normal TypeScript forms of the forbidden behaviors. The shipped mutations cover only `provider.id ===`, an inline returned literal, a catch clause, and literal tier equality/switch. Because the diary calls these structural predicates, the false PASS is more dangerous than a missing check.

- **[MAJOR] U10 misses the canonical React/R3F canvas spelling** (`scripts/gate-core.ts:21`, `scripts/gate-core.ts:267`) — the line scan is case-sensitive. A panel file containing `export const Raster = () => <Canvas />` passed U10, even though the dispatch’s invariant is “panel remains DOM-only” and R3F’s component is named `Canvas`. The mutation tests plant lowercase `<canvas />` only. This gate does not protect the layer boundary it is named after.

- **[MAJOR] The scanner exempts its own executable files while failing valid comments and required identifiers elsewhere** (`scripts/gate-core.ts:24`, `scripts/gate-core.ts:67`, `scripts/gate-core.ts:266`, `scripts/gate-core.ts:269`, `scripts/gate-core.ts:270`, `scripts/gate-core.ts:275`) — `scripts/gate-core.ts`, `scripts/gates.ts`, and `scripts/gates.test.ts` are skipped by every source predicate, so a planted `useState` call in `scripts/gates.ts` passed U9. Meanwhile the current U9, HAPTICS, and HALO failures are comments or ordinary English, and U8 rejects the required `permission-denied` fixture only because its filename changed. This violates the requested quality boundary in both directions: executable violations escape, while truthful documentation is made illegal. W5a-D5 already states the correct principle—syntax-sensitive checks should parse syntax—but applies it inconsistently.

- **[MAJOR] Manual gates are counted as “clear” and cannot prevent a zero exit** (`scripts/gate-core.ts:278`, `scripts/gate-core.ts:290`, `scripts/gates.ts:33`) — `gatesPassed` treats `manual` exactly like `pass`, and the summary computes `results.length - failed.length`. With no automated failures, output would say `18/18 gates clear` and exit 0 even though U14 and U15 remain unresolved. That contradicts H-5/the scope’s unwaivable owner validation posture and the dispatch instruction to report manual gates rather than silently omit them. The command may legitimately exit 0 for the mechanized subset, but the summary must say that only machine gates passed and list manual gates as outstanding—not cleared.

- **[MAJOR] The mutation evidence overclaims completeness and lacks adversarial controls for every semantic predicate** (`scripts/gates.test.ts:74`, `scripts/gates.test.ts:88`, `docs/workstreams/002-implementation-spine/diary/w5a.md:51`, `docs/workstreams/002-implementation-spine/evidence/w5a-planted-failures.txt:14`) — every shipped mutation does correctly assert its edit landed, satisfying D-064. However, each gate receives one favorable spelling and no semantically equivalent control expected to stay red. Thirteen independently landed variants stayed green: two U8, three provider, one tools, two flip, two tier, one credential, one harness U9, and one CSS agent flag; uppercase `<Canvas>` is a fourteenth. “Exercises all thirteen static gates” is literally true but does not support the diary’s broader claim that the static contracts are covered. D-058 applies: the suite is green for the wrong reason—because it asks only questions the implementation was written to answer.

- **[MINOR] The committed live evidence is not anchored to the tree it measured and is already unreproducible from either the commits or the current worktree** (`docs/workstreams/002-implementation-spine/evidence/w5a-live-gates.txt:1`, `docs/workstreams/002-implementation-spine/evidence/w5a-live-gates.txt:12`) — it records neither HEAD nor a tree fingerprint and includes foreign uncommitted paths that were not in `97fba65`. The current root suite passes 697 tests because the Playwright file has since been renamed to `.e2e.ts`, while current U8 now fails that renamed file. A live shared-tree artifact should record the exact `git rev-parse HEAD`, dirty-path list or diff fingerprint, command, and Bun version so “final tip” means something reproducible.

### Current Five-Failure Classification

| Current gate | Classification | Evidence |
|---|---|---|
| U8 | **W5a false positive** | `packages/panel/e2e/panel.e2e.ts:7` is the required `permission-denied` account-state fixture; its stale path clearance no longer applies. |
| U9 | **W5a false positives** | All three hits are comments explaining compliance with the no-`useState` law; no call/import is present. |
| HAPTICS | **W5a false positive** | `packages/state/src/silence.ts:88` documents why the actuator is absent; there is no call expression. |
| HALO | **W5a false positives** | All eleven hits are ordinary English uses of “handed,” not a handedness setting, stored hand, or branch. |
| NAMING | **True foreign violation** | `scripts/spikes/mint-apple-dev-token.ts:8` embeds the initiative bookkeeping path in an implementation-source comment, which the scope explicitly forbids outside bookkeeping artifacts. |

The earlier Playwright `*.spec.ts` TESTS failure in the committed evidence was also a **true foreign violation at the time**: Bun’s checked-in discovery docs explicitly recurse over `*.spec.*`. Renaming it to `.e2e.ts` has closed that collision in the current tree; root `bun test` now passes 697/697.

### Suggestions (non-blocking)

- Model each gate around the forbidden semantic shape, then keep paired mutations: one canonical violation and at least one syntactically different equivalent. For literal wording policies, tokenize strings/comments deliberately rather than conflating them accidentally.
- Keep the useful isolated-fixture architecture and D-064 landing assertions; they are solid foundations once the predicates and control matrix are widened.

### Gates I Ran Myself

- `bun run gates` → exit 1; TYPES 11/11, LINT pass, TESTS 697/697, five static failures classified above.
- `bun test scripts/gates.test.ts` → 19 pass, 0 fail, 150 assertions.
- Archived `2d65f7a`: `bunx tsc --noEmit -p scripts/tsconfig.json` → clean; mutation suite → 19 pass.
- `git diff --check 2d65f7a^..97fba65` → clean.
- Trailer scan over `2d65f7a^..97fba65` → zero prohibited trailers.
- Thirteen isolated adversarial fixtures plus uppercase `<Canvas>` → every planted edit was read back exactly; all fourteen target gates incorrectly reported PASS.
- Credential checks used synthetic temporary repositories only. I did not enumerate, open, hash, or print any path under the real `cert/` directory.

### Neuve Dogfood Feedback

- **Commands run:** none; `scope.md` records the owner ruling that this repository has no Neuve shell or Kanban board.
- **Artifact refs / Kanban updates / HITL gate:** not applicable. `tracker.md` is the operational queue.
- **Signal value:** not applicable.
- **Sticking point:** the installed `/global-patterns` skill still points at stale `~/code/agent-context/global.md`; repo law correctly redirects reviewers to `/Users/vinicius/code/agentic-context`.
- **Feedback artifact:** this review records the unavailability explicitly as required by `/strict-critique`.

---

# Re-review — commits `11ff1ad`, `fd84e2c`, `ff9bd9d`

## Verdict: REQUEST_CHANGES

The remediation closes the exact fourteen adversarial examples from the first review, fixes the comment/prose false positives, catches uppercase `<Canvas>`, removes the harness exemption, separates manual counts, and anchors the live evidence more clearly. It does **not** close the credential Critical, and the new claim that provider/tool/flip/tier checks are semantic remains too strong.

### Findings

- **[CRITICAL] The credential gate now opens `design.pen` directly and can follow a tracked symlink into an ignored credential directory** (`scripts/gate-core.ts:445`, `scripts/gate-core.ts:458`, `scripts/gate-core.ts:464`) — `git ls-files --stage -- design.pen` proves the encrypted Pencil document is a regular tracked blob. The loop opens every tracked working-tree path with `Bun.file(...).arrayBuffer()`, so every `bun run gates` invocation reads `design.pen` outside the Pencil MCP, directly violating the first repo fact in `AGENTS.md`. The only skip is a *path string* beginning `cert/`; filesystem resolution is not checked. In a synthetic temporary repository, I tracked `apps/web/src/reference.ts` as a symlink to an ignored synthetic secret file; CREDENTIALS followed the link and detected the target marker. I did not touch the real `cert/`. This leaves the prior credential-safety Critical open in a different form: output disclosure is fixed, but the scanner itself crosses two forbidden read boundaries. Inspect index blobs/modes through Git metadata and skip the encrypted Pencil blob; never resolve tracked paths through the working tree.

- **[MAJOR] U8 blanket-excludes the provider layer, including user-facing provider copy** (`scripts/gate-core.ts:153`) — a synthetic `packages/providers/src/copy.ts` containing `export const reason = "Waiting for approval"` passed U8. Provider `unsupportedReason()` strings are product copy rendered by the panel, not inert implementation diagnostics, so excluding the whole package recreates the exact invented-permission escape this gate exists to prevent. The two original U8 attacks now go red, but W5a-D2’s content-aware claim does not justify removing an entire product-copy source from the audit.

- **[MAJOR] The new “semantic correctness predicates” still stop at the exact data-flow forms added by the remediation tests** (`scripts/gate-core.ts:237`, `scripts/gate-core.ts:279`, `scripts/gate-core.ts:326`, `scripts/gate-core.ts:373`) — four independently landed, ordinary TypeScript variants stayed green: `const selected = provider; if (selected.id === "apple")`, a tool result assigned after declaration and then returned, `addEventListener("error", () => flipDevice())`, and `const mode = tier; if (mode === "t1")`. These are one-step aliases/assignments and a standard error callback, not deliberate obfuscation. All eight previously demonstrated provider/tool/flip/tier variants now turn red, but the implementation and W5a-D5 overstate syntax matching as enforcement of the behavioral law. Either constrain the claimed contract to mechanically exact forms and add a separate architectural gate, or perform enough symbol/control-flow analysis that ordinary refactors cannot silently disable it.

- **[MINOR] The shared-tree evidence anchor fingerprints only status names, not dirty content** (`docs/workstreams/002-implementation-spine/evidence/w5a-live-gates.txt:4`, `docs/workstreams/002-implementation-spine/diary/w5a.md:60`) — the recorded SHA-256 is over `git status --porcelain=v1 -z`. Two different edits to the same 34 paths produce the same hash, so the source measured by the evidence still cannot be reconstructed or even distinguished. `ff9bd9d` improves the diary wording, but the first review requested a dirty-path list **or diff fingerprint**; this is only the former with a hash around it. Record a content/diff fingerprint while continuing to avoid credential contents and `design.pen` reads.

### Prior Finding Disposition

| Original finding | Re-review disposition |
|---|---|
| Credential coverage and non-disclosure | **OPEN — Critical.** Tracked docs and metadata-only output are fixed; forbidden file/symlink reads are not. |
| U8 authorization morphology and allowlist smuggling | **PARTIAL.** Both exact attacks are fixed; blanket provider exclusion is a new Major escape. |
| Provider/tool/flip/tier semantic escapes | **PARTIAL — Major remains.** All eight original variants are caught; ordinary one-step aliases/assignments still pass. |
| Uppercase React `<Canvas>` | **CLOSED.** Independent plant turns U10 red. |
| Harness self-exemption and prose false positives | **CLOSED.** Harness `useState` and CSS agent-flag plants turn red; truthful comments plus `permission-denied` remain green. |
| Manual gates counted clear | **CLOSED.** Summary reports `13 automated passed; 0 automated failed; 2 manual outstanding`; manual checks no longer increment passed. |
| Mutation evidence sampled only favorable spellings | **CLOSED for the original fourteen.** All fourteen are now shipped tests and independently reproduced; the broader “semantic” claim is addressed separately above. |
| Unanchored live evidence | **PARTIAL — Minor remains.** HEAD, Bun and dirty-path status are recorded, but dirty contents are not fingerprinted. |

### Current Shared-Tree Classification

- **TYPES — active W4 transient breakage, correctly detected:** `packages/device/src/Device.tsx:317` passes `Texture | null` where `Texture` is required. Because device is consumed by composite and web, the same W4 edit makes `apps/web`, `packages/composite`, and `packages/device` fail; 8/11 projects remain clean. This is not a W5a defect or a stale foreign false positive.
- **LINT — pass.**
- **TESTS — pass:** 766 tests, 0 failures, 4961 assertions across 32 files.
- **All thirteen W5a static predicates — pass on the current tree.** The former U8 server-copy and naming findings are no longer present in the current shared state.
- **U14/U15 — correctly reported as two manual outstanding checks.** They remain unresolved and are not counted as automated success.

### Independent Gates and Plants

- `bun test scripts/gates.test.ts` → 35 pass, 0 fail, 269 assertions.
- Archived `ff9bd9d`: scripts TypeScript clean; the same 35 tests pass.
- Independent recreation of all fourteen first-review mutations → 14/14 turned the intended gate red; credential output contained neither synthetic marker nor payload.
- Independent false-positive control → truthful `useState`/`navigator.vibrate`/“handed” comments and the required `permission-denied` identifier remain green.
- Independent manual-summary control → 13 automated pass, 0 automated fail, 2 manual outstanding.
- Additional controls → provider alias, later tool assignment, event-listener error callback, tier alias, and provider-layer permission copy all incorrectly passed.
- Synthetic tracked-symlink control → credential scan followed an ignored synthetic target. No real credential or path under the real `cert/` directory was opened, enumerated, hashed, or printed.
- `bunx tsc --noEmit -p scripts/tsconfig.json` → clean.
- scoped ESLint on the three W5a scripts → clean.
- `git diff --check 11ff1ad^..ff9bd9d` → clean.
- reviewed-range trailer scan → zero prohibited trailers.
- Commit ownership is clean: only the three W5a scripts and W5a diary/decision/evidence files changed; active W4/W6/shared-tree edits were not swept.

---

# Final re-review — commits `ba4deff`, `1a84379`

## Verdict: REQUEST_CHANGES

The former Critical and the dirty-content fingerprint Minor are closed. Provider-layer U8 coverage and the exact alias/later-assignment/`addEventListener` plants are also fixed. Two behavioral gates still admit ordinary executable violations, however, and U8's context-free token allowlist admits the exact prohibited words as visible UI copy. These are Major false-PASS defects, so the slice is not approvable.

### Findings

- **[MAJOR] U8 allows prohibited user-facing copy whenever the whole string equals a provider state token** (`scripts/gate-core.ts:188`) — the provider-layer exclusion is gone, but the replacement allowlist is context-free. In an independent product fixture, both `<p>Authorized</p>` and `<p>Pending</p>` passed U8. Those words are allowed as machine/account-state identifiers, not as invented permission-language copy. The shipped control proves an API token passes but never proves the same token in JSX fails. The gate must distinguish executable state values from authored user-visible strings rather than exempting a spelling everywhere.

- **[MAJOR] Tool and flip enforcement still misses standard later-property and browser-event forms** (`scripts/gate-core.ts:347`, `scripts/gate-core.ts:394`) — `const r = { error: "" }; r.error = "unsupported"; return r` passed TOOLS because taint collection handles identifier assignments but not property writes. `window.onerror = () => flipDevice()` passed FLIP because error contexts include named handlers, JSX, promise callbacks, and `addEventListener`, but not the browser's standard `onerror` callback property. Commit `1a84379` closes method-form `target.addEventListener`, and the requested alias/later-identifier/event-listener plants all turn red; it does not close the behavioral invariant under ordinary neighboring syntax.

### Remaining-Finding Disposition

| Prior finding | Final disposition |
|---|---|
| Credential scanner reads `design.pen` / follows symlinks | **CLOSED.** Both credential scanning and fingerprinting skip `design.pen` and `cert/` before any filesystem/content operation, then use `lstat` and read only regular files. Synthetic dirty-content controls proved design, cert, and symlink-target bytes do not affect the fingerprint; a tracked FIFO completed without blocking. No real protected content was accessed. |
| U8 excludes provider copy | **CLOSED as reported; new Major above.** Provider product copy is scanned and the prior provider mutation turns red. Exact-token UI copy remains an escape. |
| Alias/later assignment/event callback escapes | **PARTIAL — Major remains.** Provider and tier fixed-point aliases, later identifier assignment for tool results, and global/method `addEventListener` error callbacks are caught. Later property mutation and `window.onerror` still pass. |
| Dirty fingerprint hashes only path metadata | **CLOSED.** Safe regular-file bytes now participate; changing content at one already-dirty path changes the digest. Protected and non-regular paths remain metadata-only. |

### Protected-Read Proof

I used synthetic temporary repositories only. I did not read, enumerate, hash, copy, or print the real `design.pen` or anything under the real `cert/` directory.

- Synthetic tracked `design.pen`: after making it dirty, changing marker A to marker B left the fingerprint identical.
- Synthetic ignored `cert/key.p8`: changing marker A to marker B left the fingerprint identical.
- Synthetic dirty symlink to an ignored target: changing target bytes left the fingerprint identical; credential scanning did not follow it.
- Synthetic tracked path replaced by a FIFO: fingerprint plus all static gates returned in 88 ms rather than opening the special file.
- Code order independently matches the behavior: explicit protected-path checks occur at `gate-core.ts:42` and `:536`; `lstat`/`isFile()` precede every content read at `:46-51` and `:541-547`.

### Gates and Mutation Results

- `bun test scripts/gates.test.ts` → **44 pass, 0 fail, 336 assertions**. This includes the original fourteen adversarial mutations, provider U8 coverage, fixed-point aliases, later identifier assignment, global and method event-listener callbacks, false-positive controls, command propagation, credential safety, and content fingerprint controls. Every shipped mutation asserts its edit landed.
- Independent controls beyond the suite: exact-token JSX U8 copy, `window.onerror`, and later property mutation all landed and incorrectly reported PASS, producing the Majors above.
- `bun run gates` → **exit 0**: TYPES 11/11, LINT pass, TESTS 781/781, all automated static gates pass, and U14/U15 remain correctly reported as two manual outstanding checks.
- **Live W3 lint classification:** there is no current W3 lint failure to classify; repo-wide lint is green. This is separate from the W5a false-PASS findings above. Active W3 files remain dirty, but they did not make the command red in this run.
- `git show --check` is clean for both reviewed commits; neither commit has prohibited trailers. The commits contain W5a scripts/tests/docs only and do not sweep active W3/W4/W6 work.

### Strict conclusion

The dangerous protected-read defect is fixed without weakening credential detection, and the evidence fingerprint is now materially useful. Approval is still blocked because a green root gate can coexist with visible prohibited permission copy, an unsupported tool return, and an automatic error-triggered flip written in standard browser syntax.

---

# Final narrow re-review — commit `dc8d734`

## Verdict: APPROVE

No Critical, Major, or Minor finding remains in the requested narrow scope. The three prior bypass classes are closed, the protected-file ordering is unchanged, all 48 W5a tests pass, command failures propagate, and U14/U15 remain manual rather than being represented as cleared.

### Prior bypasses — independent verification

I planted each prior bypass in a fresh synthetic repository, independently of the committed tests:

- U8: provider-rendered JSX containing exactly `Authorized` → **FAIL**, one finding.
- U8: provider-rendered JSX containing exactly `Pending` → **FAIL**, one finding.
- TOOLS: `const r = { error: "" }; r.error = "unsupported"; return r` → **FAIL**, one finding.
- FLIP: `window.onerror = () => flipDevice()` → **FAIL**, one finding.

The U8 distinction is appropriately syntax-aware for this ruling: exact state-token strings remain permitted in non-visible executable data, while exact JSX text is rejected. The property-write collector participates in the existing fixed-point taint pass, and assigned `onerror`/`error`/`failure`/`failed` function callbacks are recognized without widening the test to arbitrary assignments.

### Safeguards and complete W5a suite

- `bun test scripts/gates.test.ts` → **48 pass, 0 fail, 364 assertions**.
- Synthetic protected-read controls remained green without touching real protected content: changing dirty synthetic `design.pen`, ignored `cert/key.p8`, and a symlink target did not change their safe fingerprints; CREDENTIALS produced zero findings and did not follow the symlink.
- The explicit protected-path checks and `lstat().isFile()` checks still precede every content read. Commit `dc8d734` does not modify that code.
- Scoped ESLint and `bunx tsc --noEmit -p scripts/tsconfig.json` both pass.
- The reviewed commit is coherent, `git diff --check` is clean, and its message has no prohibited trailer. It changes only W5a scripts/tests and W5a bookkeeping/evidence artifacts.

### Root command and manual semantics

`bun run gates` currently exits 1 for active foreign `packages/server-core/src/artwork-proxy.ts` work:

- TYPES: 9/11 projects clean; `apps/web` and `packages/server-core` inherit the same `Uint8Array<ArrayBufferLike>` / `BodyInit` type error at `artwork-proxy.ts:464`.
- TESTS: 782 pass, 3 fail, all three in the artwork proxy's remote-provider cases.
- LINT: pass.
- All thirteen W5a static predicates: pass.
- Summary: **14 automated passed; 2 automated failed; 2 manual outstanding**.

This is correct gate behavior, not a W5a regression: the root command propagates the live foreign type/test failures while keeping U14 and U15 separately visible. On a clean synthetic fixture, `summarizeGates()` independently reports **13 automated passed, 0 automated failed, 2 manual outstanding**.

### Protected-content statement

I used synthetic temporary repositories for protected-file verification. I did not read, enumerate, hash, copy, or print the real `design.pen` or any real path under `cert/`.
