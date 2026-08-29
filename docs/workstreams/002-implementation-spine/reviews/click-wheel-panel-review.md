# Review: W7 panel companion — direct visible-row selection (`7d170dd`)

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: loaded `AGENTS.md`, 002 `scope.md`, `decision-log.md`, `hitl-decisions.md`, dependency graph, W3 dispatch/diary/decisions, review lanes, and the binding review prompt; checked 001 pm-spec §4.5/§15 and design-system §11.2. The primaries conflict on whether panel rows may be touch targets, and no decision-log entry resolves it.
- Kanban ticket: not applicable. `AGENTS.md` states that this repo has no Kanban board and no Neuve shell; the repo-local workstream tracker is authoritative.
- Correctness target: a tap on a visible row moves the singleton-store highlight and descends after exactly 80 ms, without turning scroll/drag into activation or weakening keyboard, wheel, focus, virtualization, or accessibility behavior.
- Dispatch scope: commit changes only the four declared panel files. No device/composite/token work was swept in.
- Dependency/HITL status: W2 singleton state is used correctly, but the unresolved pm-spec §4.5 versus design-system §11.2/U6 conflict required escalation before implementation. H-5/U14 and H-6 remain owner-only and are not cleared here.
- DoD checklist: typecheck, scoped lint, package tests, package Playwright, and repository tests are green. The full gate remains red on the pre-existing credential-signature false positive in `reviews/w5a-review.md`; U14/U15 remain manual.
- Review lanes: L-D interface lane applied with strict critique. Modern web guidance was queried through `bunx` (repo law forbids `npx`), and the current Vercel interface rules were fetched. Neuve is unavailable by explicit repo law.
- Type/lint/doc gates: no `useState`, `any`, broad `unknown`, non-null assertion, new lint disable, canvas, or separate Jotai store in the commit. The delayed driver has lifecycle documentation.
- Git history/staging: `7d170dd` is one coherent behavior-plus-tests commit with no attribution trailer. Working-tree changes outside `packages/panel` were not touched. Temporary plants were reverted; `packages/panel` is clean.
- Verification evidence: grounded React event/ref/effect behavior in `/Users/vinicius/code/agentic-context/react.dev`, Jotai Provider/store behavior in `/Users/vinicius/code/agentic-context/jotai`, and virtualization identity/scrolling in `/Users/vinicius/code/agentic-context/tanstack/virtual`.
- Decision-log status: D-050, D-058, D-064, and D-066 apply to the timing and mutation evidence. There is no decision authorizing the §11.2/U6 deviation.

### Findings

- [MAJOR] The slice silently chooses one of two contradictory primary contracts and violates U6 (`packages/panel/src/Panel.tsx:250`, `packages/panel/src/panel.css:72`) — pm-spec §4.5 requires “Tap a visible row,” but design-system §11.2 says panel rows are deliberately **not** touch targets because 21/26 panel px cannot satisfy the 44 px minimum, and tapping the panel only focuses the wheel. The workstream says source conflicts must be escalated, not selected by an implementer. This is not theoretical: the new S03 target is 21 panel px and measured 42 CSS px in the actual route, while U6 requires 44. A binding ruling and a geometry/interaction design that satisfies it are required.

- [MAJOR] `onClick` treats a drag as the specified tap (`packages/panel/src/Panel.tsx:250`, `packages/panel/src/Panel.tsx:395`) — there is no pointer-down coordinate, movement threshold, cancellation, or click-detail policy. In the real browser, pressing Albums, moving 70 CSS px while held, and releasing on the same row descended to S08. A list scroll, selection drag, or future screen-swipe can therefore activate content accidentally. The source permits a tap, not any pointer sequence that ends in a synthetic click.

- [MAJOR] The delayed action is not bound to the user's latest row intent (`packages/panel/src/Panel.tsx:132`, `packages/panel/src/visible-row-selection.ts:35`) — `schedule()` rejects every second tap while one timer is pending, and the callback later selects whatever `currentScreenAtom` happens to contain rather than the row/screen transaction that armed it. Browser proof: Albums followed by Songs 20 ms later left Albums highlighted and descended into S08. With the two colourway panels mounted against the required singleton store, two Albums taps on the two panels descended twice to S13; Albums then Songs could cancel descent accidentally. A newer tap must replace/cancel the pending transaction, and a stale timer must never act on a different screen.

- [MAJOR] The target-size proof measures the wrong element (`packages/panel/e2e/panel.e2e.ts:72`, `packages/panel/src/Panel.test.tsx:44`) — the E2E asserts that the containing list is at least 44×44, while the independently selectable row is the hit target. The unit gate still checks only `.wp-actions button`, which this commit did not make interactive. Both tests remain green over 21 px menu rows. This is the exact “right assertion, wrong reason” class in D-058 and conceals the primary-source/U6 conflict instead of detecting it.

- [MAJOR] S08 exposes a listbox whose selected option is not associated with the focused widget (`packages/panel/src/Panel.tsx:192`, `packages/panel/src/Panel.tsx:331`, `packages/panel/src/Panel.tsx:345`) — activation focuses the outer `role="application"`, but `aria-activedescendant` is emitted only for S03. Browser inspection on S08 showed focus on the application with `activeDescendant: null`; the listbox and options were not focusable. The new direct-manipulation path therefore changes visual selection without preserving the programmatic focus relationship that makes a listbox usable to assistive technology.

- [MAJOR] The new tests do not enforce the timing and lifecycle claims they name (`packages/panel/src/visible-row-selection.test.ts:10`, `packages/panel/src/visible-row-selection.test.ts:40`, `packages/panel/playwright.config.ts:9`) — changing the required 80 ms literal to 79 ms left both the unit test and the relevant E2E green because the unit derives expected from the mutated symbol and the E2E sleeps 100 ms. Removing wheel cancellation entirely left all 25 unit tests and all three relevant E2Es green. Removing the unmount cleanup effect did the same. Each plant was confirmed applied before execution and then reverted. The Playwright config also reuses any server on port 3000 and carries no source fingerprint, so its output does not prove which committed source it exercised. D-050/D-064/D-066 require literal, deterministic timing; integration tests must independently make wheel cancellation and unmount cleanup go red; browser evidence must verify its source digest.

### Suggestions (non-blocking)

- Once the source conflict is ruled, prefer a renderer-independent pointer transaction with explicit start/move/end and replace-latest timer semantics. That makes “tap”, cancellation, and stale-screen identity representable rather than inferred after `click`.
- Keep the stable `row.index` key used by TanStack Virtual. The inspected virtualized path does not reuse DOM identity as the activation identity, which is the correct direction.

### Neuve Dogfood Feedback

- Commands run: none; `AGENTS.md` explicitly states there is no Neuve shell or Kanban board in this repo.
- Artifact refs: not applicable.
- Kanban updates: not applicable; disposition is recorded in this review artifact and the 002 tracker remains the lead's queue.
- HITL gate: unresolved primary-source conflict must be routed through the workstream decision process. U14/H-5 and the both-colourway aesthetic call/H-6 remain owner-only.
- Signal value: not applicable.
- Sticking points: none beyond explicit unavailability.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: this section records unavailability as required by the strict-review protocol.

### Gates I ran myself

- `bunx tsc --noEmit -p packages/panel/tsconfig.json` → clean.
- `bunx eslint packages/panel/src packages/panel/e2e` → clean.
- `bun test packages/panel/src` → 25 pass, 0 fail.
- `bun run --cwd packages/panel test:e2e` → 14 pass, 0 fail, but source-fingerprint limitation above remains.
- `bun run gates` → 11/11 typechecks, lint clean, 900 tests pass; 15 automated gates pass, CREDENTIALS fails on the pre-existing `reviews/w5a-review.md` prose; U14/U15 remain manual.
- Browser rapid-tap probe → Albums then Songs at +20 ms produced S08 with Albums retained: fail.
- Browser drag probe → 70 CSS px movement while held on Albums produced S08: fail.
- Browser dual-colourway probe → one Albums tap per mounted panel produced S13: fail.
- Browser accessibility inspection on S08 → focused `role="application"`, `aria-activedescendant=null`: fail.
- Browser geometry inspection → S03 row height 42 CSS px (21 panel px), below U6's 44 px: fail.
- Plant `VISIBLE_ROW_SELECTION_DELAY_MS: 80 → 79` → 2/2 unit and 1/1 relevant E2E still pass: gate hole.
- Plant removal of wheel cancellation → 25/25 unit and 3/3 relevant E2E still pass: gate hole.
- Plant removal of unmount disposal → 25/25 unit and 3/3 relevant E2E still pass: gate hole.
- `git show --format=fuller 7d170dd` and trailer audit → four scoped panel files, no trailer.

### D-038 consistency questions

1. The method contradicts the conclusion in the target-size test: it calls the list the pointer target while the event handler resolves and activates an individual row. The list measurement cannot support the row-target conclusion.
2. The green suite supports only that one authored scenario passes. It does not support “wheel cancellation,” “unmount cancellation,” “exactly 80 ms,” or “safe double-click/rapid retargeting”; the confirmed plants and browser probes distinguish those claims.
3. The caution is applied inconsistently: keyboard cancellation has an integration test, while wheel and unmount share a unit call to the same generic `cancel()` and are treated as independently proven.
4. Evidence classes: the rapid-tap, drag, dual-panel, focus, and geometry findings are live browser measurements; the source conflict is structural documentary evidence from two binding primaries; the source-fingerprint gap means the package E2E provenance is unverified.

# Re-review — D-068 reversal (`9fa899d`)

## Verdict: REQUEST_CHANGES — 2 Major, 0 Minor

The product reversal is correct. D-068 resolves the former primary-source conflict in favour of authentic non-touchscreen behaviour, and `9fa899d` removes the row-selection feature rather than leaving a disabled or partially reachable variant. Five of the six prior Major findings are eliminated by that removal: there is no row activation transaction, drag/tap ambiguity, delayed/stale timer, row-sized pointer target, or S08 listbox focus contract. The 80 ms policy no longer exists and therefore needs no timing justification, cleanup, or cancellation test.

### Findings

- [MAJOR] The package browser suite still cannot prove that it exercised `9fa899d` (`packages/panel/playwright.config.ts:9`). It has no source fingerprint and sets `reuseExistingServer: true` against the shared fixed port 3000. This is now demonstrated, not inferred: I removed `onClick={onClick}` from the panel, confirmed the mutation was present, and ran the focused committed regression. It still passed 1/1 because Playwright reused the already-running server rather than the mutated source. The mutation was then reverted and `packages/panel/src/Panel.tsx` is byte-clean. The repository already has the required source-fingerprint mechanism in `apps/web/tests/playwright.config.ts` and `apps/web/tests/browser-gates.e2e.ts`; the panel suite does not use it. A green run is therefore not evidence for this commit, so the provenance portion of prior Major 6 remains open.

- [MAJOR] D-068 explicitly requires a browser regression proving that native actions such as Love remain native and are not swallowed by the panel's focus-only handler, but the committed regression never clicks a native action (`packages/panel/e2e/panel.e2e.ts:53`, `packages/panel/e2e/panel.e2e.ts:311`). The first test clicks only menu/track rows. The later accessibility test proves that Love is an `HTMLButtonElement`, measures its target, and runs axe, but never dispatches the action or checks post-click focus/behavior. My independent fresh-port browser probe shows the implementation is currently correct: Love is a native button, renders 88×88 CSS px at the 2× preview, receives the click, retains focus, and does not transfer focus to the application. That live observation does not replace the binding regression D-068 calls for. Add a committed browser assertion that clicks Love, verifies its mutation/effect, and verifies focus remains on the button; it must go red if the interactive-descendant guard is removed or the button action is swallowed.

### Verified behavior

- Fresh server on port 3011, loaded from the current worktree: clicking Albums focused the application, retained S03, and retained the same `aria-activedescendant`.
- A press/move/release gesture moving 55 CSS px across the Albums row retained S03 and the same highlight.
- Enter traversed S03 → S08 → S13 exactly as before. The existing keyboard traversal test also verifies ArrowDown/ArrowUp, playback, Backspace, and the live region path.
- Clicking the second S08 track focused the application, retained S08, and Enter then activated the selected track.
- Rows have no click handlers, button role, `data-row-index`, delayed driver, or row-selection timer. S08 no longer authors the removed listbox/option semantics. S03 retains its pre-existing application/active-descendant keyboard model.
- The 44 px contract is now truthful: display rows are not pointer targets. The only inspected panel action is a native Love button whose authored minimum is 44×44 panel px and whose actual preview box is 88×88 CSS px with all four corner hit probes landing on the button.
- No `useState`, new store, timer, or lifecycle surface remains in the reversal. The component continues to use the shared singleton store.
- `9fa899d` changes only the decision/tracker records and six panel reversal files, and its commit message has no trailer.

### Gates and mutations run

- `bunx tsc -p packages/panel` → clean.
- `bunx eslint packages/panel` → clean.
- `bun test packages/panel` → 23 pass, 0 fail.
- `bun run --cwd packages/panel test:e2e` → 12 pass, 0 fail; not accepted as committed-source evidence because of the reproduced provenance defect above.
- Fresh-port direct browser probe → row click/drag focus-only; Enter unchanged; native Love clickable and focus-preserving.
- Plant: remove `onClick={onClick}` from committed source, then run the focused `panel rows focus` E2E → incorrectly 1 pass, proving stale-server reuse. Plant reverted and diff checked clean.

### Disposition of the six prior Majors

1. Primary conflict: closed by binding D-068 and implemented by removal.
2. Drag interpreted as tap: closed; rows have no activation path.
3. Delayed stale/dual-panel activation: closed; driver and timer are deleted.
4. False row target-size proof: closed; rows are display semantics and the 44 px assertion is limited to native controls.
5. S08 listbox focus mismatch: closed; the newly introduced S08 listbox/option semantics were removed.
6. Timing/lifecycle/provenance: timing, wheel cancellation, and cleanup concerns are closed by deletion; source provenance remains Major and was reproduced with a planted mutation.

# Final re-review — fresh-source and native-action proof (`0b61f5f`, `819a6d8`)

## Verdict: REQUEST_CHANGES — 1 Major, 0 Minor

The native-action and focus regressions are now real, source-loaded browser gates. The remaining blocker is narrower: `819a6d8` deliberately stopped comparing the current fingerprint with the run-start fingerprint, so the suite cannot make the requested claim that concurrent source changes are unambiguous.

### Finding

- [MAJOR] An in-run change to fingerprinted browser source is accepted as a green, source-proven run (`packages/panel/e2e/panel.e2e.ts:24`, `packages/panel/e2e/panel.e2e.ts:37`). Commit `0b61f5f` correctly required `health.expected === worker expected`, `health.current === worker expected`, and exact file-count equality. Commit `819a6d8` removed all three comparisons and now checks only that `expected` and `current` look like SHA-256 strings and that `fileCount > 0`. I started the full isolated suite, waited until its parent and worker printed the same run-start digest, then changed the fingerprinted runtime file `packages/panel/src/model.ts` while the server and tests were live. Tests 2–13 subsequently ran against the changed checkout and the suite still finished **13 passed**. The plant was restored and panel source is clean. A dedicated port and `reuseExistingServer: false` eliminate stale-process reuse, but they do not isolate a mutable shared checkout or prove what bytes later HMR requests served. Restore equality/file-count checks and serialize against runtime-source writers, run from an immutable snapshot/worktree, or otherwise make a concurrent source change deterministically abort the run. Valid hash syntax is diagnostic metadata, not source identity.

### Prior findings and requested checks

- Focus-handler removal: **RED** independently. Removing `onClick={onClick}` and running the focused row test failed at `expect(panel).toBeFocused()`; the server and worker printed the mutation's same fresh digest.
- Love action: **GREEN normally and RED when removed**. A real click changes `aria-pressed` from `false` to `true`, proving provider completion reaches the Jotai-backed rendered state. Removing the button action left it `false` and failed the test.
- Native focus guard: **RED independently**. Removing the interactive-descendant guard allowed the provider action to complete but moved focus to the panel; the test failed at `expect(love).toBeFocused()`.
- Native semantics and target: Love is verified as an `HTMLButtonElement`; computed minimum and rendered width/height are each at least 44 px. The normal click retains button focus and S13.
- Fresh/stale process: closed. The suite uses dedicated `127.0.0.1:4318`, `--strictPort`, and `reuseExistingServer: false`; it cannot attach to the user's port-3000 process. Focus-handler mutation confirms the new process loaded mutated source.
- Concurrent fingerprint ambiguity: **open**, demonstrated by the green in-run source mutation above.
- All behavior findings from the original `7d170dd` review remain closed under D-068. Rows are display-only, keyboard/Enter behavior is unchanged, and no delayed row-selection surface returned.

### Gates run

- `bunx tsc -p packages/panel` → clean.
- `bunx eslint packages/panel` → clean.
- `bun test packages/panel` → 23 pass, 0 fail.
- Normal isolated `bun run --cwd packages/panel test:e2e` → 13 pass, 0 fail.
- Focus-handler plant → focused E2E 1 failed as required.
- Interactive-descendant guard plant → Love E2E 1 failed as required.
- Love action plant → Love E2E 1 failed as required.
- Concurrent fingerprinted-source plant during the full run → **13 passed**, blocker reproduced.
- All temporary plants were restored. `packages/panel` has no working-tree diff and the index is empty.
- Both commits are scoped to panel implementation/test/evidence files and contain no commit trailers.

# Final re-review — immutable served snapshot (`fd54d0d`)

## Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

The final provenance blocker is closed. The panel browser gate now serves a copied browser workspace, fingerprints that snapshot rather than the shared checkout, recomputes the served snapshot's digest and file count on every health check, and requires exact equality. The prior row-interaction, focus, native-action, target-size, keyboard, lifecycle, and source-provenance findings are all closed.

### Independent verification

- Snapshot construction: the parent removes and recreates `/var/folders/2g/d89s_3014jjcnqdctjhgvy2w0000gn/T/webpod-panel-playwright/served-snapshot`, copies the workspace with explicit exclusions, fingerprints the snapshot, and installs frozen dependencies inside it. Vite's working directory is the snapshot's `apps/web`, so workspace links resolve to snapshot packages rather than the live checkout.
- Exact identity: the clean run printed the same digest in the parent and Playwright worker, `a579d224…`, with 151 files. `/__webpod_health` publishes expected digest/count and freshly recomputed current digest/count. The browser requires `current === expected`, `fileCount === expectedFileCount`, and a positive count.
- Mid-run mutation: `PANEL_PROVENANCE_PLANT=MIDRUN bun run --cwd packages/panel test:e2e -- --grep "served source identity"` appended only to the temporary snapshot's fingerprinted `packages/panel/src/model.ts`. The second health check failed as required: expected `a579d224…`, current `b6fbe405…`, with the explicit immutable-snapshot failure. No live repository file was changed.
- Restoration: a subsequent ordinary invocation rebuilt the snapshot and passed **14/14**, confirming the plant does not contaminate later runs.
- Dedicated server: Vite binds `127.0.0.1:4318` with `--strictPort`; `reuseExistingServer` is false. The suite neither attaches to port 3000 nor accepts an existing process on its own port.
- Credential/design exclusion: an independent path audit of the post-install snapshot found no `cert/`, `.claude/`, `.env*`, `design.pen`, `.p8`, `.pem`, `.key`, `.p12`, `.npmrc`, or `.netrc`. The live ignored sensitive paths are `.claude/settings.local.json` and `cert/AuthKey_3939B8G298.p8`; both are absent from the snapshot. No credential contents were read. Git metadata and docs are also excluded.
- Snapshot links: excluding dependency links, the only symlink is the expected local `CLAUDE.md` link to `AGENTS.md`; it exposes no credential or design artifact and is outside the served runtime fingerprint set.
- Baseline gates: TypeScript clean; scoped ESLint clean; panel unit suite 23/23; isolated browser suite 14/14.
- Commit audit: `fd54d0d` changes only the shared source-health helper/plugin, panel Playwright harness/test, and D-068 evidence. It has no attribution trailer.

### Closure of all panel findings

1. D-068 resolves the source conflict: panel rows are non-interactive display semantics.
2. Click/drag cannot activate rows; both only focus the application.
3. The delayed 80 ms driver, stale timer, dual-panel race, and cleanup surface remain deleted.
4. The 44 px contract applies truthfully to native controls; Love is a native 44 px minimum button.
5. The introduced S08 listbox mismatch remains removed; S03 retains its established active-descendant keyboard model.
6. Enter, Arrow keys, wheel, Backspace, playback, and live-region behavior remain covered and green.
7. Focus-handler removal, native-guard removal, and Love-action removal independently turn their browser regressions red.
8. Love changes rendered provider-backed state and retains native focus without screen navigation.
9. Stale-server reuse is impossible under the dedicated strict port and no-reuse configuration.
10. Concurrent shared-tree writes cannot alter served bytes; mutation of the served snapshot itself is detected by exact digest/count equality.
