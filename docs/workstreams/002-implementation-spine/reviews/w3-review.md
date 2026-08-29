# Review: W3 — Panel DOM

## Verdict: REQUEST_CHANGES

Fourteen Major findings block approval. The three commits prove that a 272×204 DOM surface can render and that two `Provider`s can observe the same imported Jotai store. They do not implement or verify the W3 correctness target: the system states are mostly labels over a ready screen, S08 is not TanStack Virtual, S13 is not the specified art-forward panel, the fixture provider is neither commanded nor subscribed, Dynamic Type is unreachable, and the required accessibility/browser evidence does not exist.

U14 and H-6 remain owner-only. This review does not claim either passed or failed.

### Correctness Check

- **Source of truth loaded:** 002 `scope.md`, `dependency-graph.md`, `decision-log.md`, `hitl-decisions.md`, `review-system-prompt.md`, `review-lanes.md`, W3 dispatch, W3 diary/decisions/evidence; 001 `pm-spec.md` §§3.1, 10.0–10.9, 15.1 and `design-system.md` §§4.7, 5.11, 6.3–6.4, 7.4, 9.4, 11.1–11.5, 13.2–13.4, 14.0–14.2.
- **Design source loaded through Pencil MCP only:** native captures and resolved node geometry for `A76Ib`, `DLqSo`, `H4QpB`, `HYNXu`, and `mObBW`. `design.pen` was never read from the filesystem.
- **Framework sources loaded from the required clone:** `/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`, `jotai/src/react/Provider.ts`, `jotai/src/react/useAtomValue.ts`, `react.dev/src/content/reference/rules/components-and-hooks-must-be-pure.md`, `react.dev/src/content/reference/eslint-plugin-react-hooks/lints/globals.md`, `tanstack/router/packages/router-core/src/searchParams.ts`, `tanstack/router/e2e/react-router/scroll-restoration-sandbox-vite/src/routes/index.tsx`, and `tanstack/virtual/packages/react-virtual/src/index.tsx`.
- **Requested skills loaded:** strict-critique and its review protocol; Interface Craft design critique; Web Interface Guidelines (fresh upstream rules fetched 2026-08-28); Interface Design Guardrails and all four resources; Modern Web Guidance (searched via `bunx`, in compliance with repo law); Neuve Motion; Jotai State; TanStack Router; Vercel React Best Practices. Repo-specific primary design requirements supersede generic Neuve-specific visual preferences where they conflict.
- **Kanban / Neuve:** not applicable. `AGENTS.md` states that this repo has no Kanban board and no `neuve` shell; workstreams are the initiative tracker. No Neuve command was run.
- **Commits reviewed:** `b16e61b`, `4a372b5`, `6f8b41a`. No trailers; `git show --check` clean.
- **Independent gates:** panel tsc pass; web tsc pass; scoped ESLint pass; panel tests 8/8 pass; forbidden `canvas|useFrame|useState` grep clean. `bun run gates` fails with `bun run gates: not implemented`.
- **Runtime:** real `/` route inspected in a browser. Keyboard S03→S08→S13 and shared-store synchronization reproduce, but S08 Enter only changes the screen frame; it does not play through the provider. `?scale=2` redirects to `?scale=1&state=ready`.
- **Mutation check:** in a clean archive, the base panel font was changed from 11px to 5px and loading rows from eight to seven. The edit was confirmed with `rg`; all 8 tests still passed. The suite therefore does not gate the two requirements it claims to lock.
- **Worktree discipline:** only this review file was added by the reviewer. Existing W4 and shared scoping changes were not staged, reset, or modified.

### Findings

1. **[MAJOR] S13 is not the art-forward Now Playing screen specified by the primary design source.** [`packages/panel/src/Panel.tsx:253`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:253), [`packages/panel/src/panel.css:72`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:72), [`packages/panel/src/panel.css:90`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:90) — The implementation renders an 88px CSS radial-gradient placeholder beside a conventional metadata column. It never renders the provider artwork URL, never computes the 3×3/8×8 samples, actor-hue exclusion, luminance guards, fixed text plate, dark `screen` bloom, light `multiply` bloom, or reduced-transparency flat substitute from design-system §5.11. Pencil `HYNXu` shows actual artwork dominating the left region and the authored status/meta hierarchy; `A76Ib`/`DLqSo` prove both device modes. The screenshot pair uses the same synthetic orange fallback in both modes and therefore cannot prove the pale-art/dark-art matrix required by S13 DoD item 2.

2. **[MAJOR] S08 substitutes a hand-written slice for the explicitly required TanStack Virtual implementation.** [`packages/panel/src/Panel.tsx:213`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:213), [`docs/workstreams/002-implementation-spine/decisions/w3.md:15`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/decisions/w3.md:15) — `VirtualTrackList` merely slices eight rows around the highlight; it has no scroll element, virtualizer, total-size spacer, measurement, or `useVirtualizer`. The decision says this avoids a dependency mutation, but the dispatch and S08 DoD item 6 mandate TanStack Virtual for >100 rows. The canonical clone’s `tanstack/virtual/packages/react-virtual/src/index.tsx` exposes the required `useVirtualizer` boundary. Avoiding a dependency is not an allowed substitute for the correctness target, and no 100+ fixture or mid-tier Android 60fps proof exists.

3. **[MAJOR] The fixture provider is displayed as a snapshot but is neither commanded nor subscribed, so the panel is not fixture-driven.** [`packages/panel/src/Panel.tsx:113`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:113), [`packages/panel/src/Panel.tsx:253`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:253) — Enter on S08 calls only `push(nowPlayingFrame())`; it never invokes a provider playback method. S13 then reads mutable `fixtureProvider.playback` during render without `onPlaybackChange` or `onProgress`, so provider ticks and playback changes cannot trigger a render. The default queue happens to contain the same first track as the first fixture album, masking the missing command. The route copy says Enter “plays a track,” but runtime and source show only a screen transition. Hard-coded `1:47`/`-2:12` can simultaneously disagree with the computed progress, which starts from the provider’s 0ms snapshot.

4. **[MAJOR] The eight-state matrix is represented by a string union, not implemented behavior.** [`packages/panel/src/model.ts:11`](/Users/vinicius/code/webPod/packages/panel/src/model.ts:11), [`packages/panel/src/Panel.tsx:143`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:143), [`packages/panel/src/Panel.tsx:175`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:175), [`packages/panel/src/Panel.tsx:253`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:253) — S03 loading leaves real counts instead of count skeletons; empty leaves populated rows and omits the final footer; offline does not insert Downloads at position 2 or dim catalogue-only rows; permission-denied does not dim/lock provider-only rows or render its footer; agent-active lacks the required right-pane border; success-confirmation does not pulse the affected row. S08 and S13 similarly collapse most state rows to a note, opacity, or generic error. `curl -L` across all eight query states confirms no Downloads row and no empty-state footer. This fails W3’s “all prescribed states” diary claim and 001 §10/§15.1.

5. **[MAJOR] Success confirmation cannot satisfy the actor contract because the model has no actor and changes no object.** [`packages/panel/src/model.ts:11`](/Users/vinicius/code/webPod/packages/panel/src/model.ts:11), [`packages/panel/src/Panel.tsx:190`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:190), [`packages/panel/src/Panel.tsx:285`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:285), [`packages/panel/src/panel.css:107`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:107) — `success-confirmation` carries no `human|agent` origin, no operation result, and no changed target. The UI always says `Volume changed.` and always runs the same body filter; it cannot choose the mandated sky-human or green-agent 200ms pulse, and there is no underlying volume/rating/playback mutation to confirm. S13 DoD item 6 explicitly requires object change + one actor pulse + conditional in-raster receipt, not a decorative animation over unchanged state.

6. **[MAJOR] Dynamic Type is unreachable from the route and incomplete inside the panel.** [`apps/web/src/routes/index.tsx:15`](/Users/vinicius/code/webPod/apps/web/src/routes/index.tsx:15), [`packages/panel/src/Panel.tsx:40`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:40), [`packages/panel/src/Panel.tsx:143`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:143) — TanStack Router’s default parser JSON-parses `?scale=2` to the number `2` (`agentic-context/tanstack/router/packages/router-core/src/searchParams.ts`), but validation compares it to the string `'2'`; the server demonstrably redirects to `?scale=1&state=ready`. Even if called directly, the store switches to airy density while S03 maps every row and CSS keeps every row at 21px, so the 8/6/4 density contract is not reflected. There is no 130% or 200% browser evidence, no no-clipping assertion, and no proof that the whole raster scales coherently.

7. **[MAJOR] The component mutates a global external store during module evaluation and every render.** [`packages/panel/src/Panel.tsx:31`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:31), [`packages/panel/src/Panel.tsx:46`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:46) — `resetStackActionAtom` runs when the module is imported, and `setDynamicTypeScaleActionAtom` runs in `Panel()` before the Provider renders. React’s canonical purity rule in `/Users/vinicius/code/agentic-context/react.dev/src/content/reference/rules/components-and-hooks-must-be-pure.md` explicitly forbids modifying non-local values during render because render may be repeated, interrupted, or abandoned. Two panels with different scales race on one global density while each paints its own local transform. Because `/` SSRs the panel, the module singleton is also shared by server requests rather than “one per document,” creating cross-request navigation state and hydration risk. D-051 required the singleton observed by the document, not uncontrolled server-global mutations in render.

8. **[MAJOR] The authored typography violates the primary ≥11px final-size law in many places.** [`packages/panel/src/panel.css:31`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:31), [`packages/panel/src/panel.css:61`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:61), [`packages/panel/src/panel.css:62`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:62), [`packages/panel/src/panel.css:70`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:70), [`packages/panel/src/panel.css:77`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:77), [`packages/panel/src/panel.css:95`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:95), [`packages/panel/src/panel.css:97`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:97), [`packages/panel/src/panel.css:104`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:104) — Status, battery, preview, row metadata, album, mode chip, and state-note text are authored from 8px to 10.5px. Design-system §6.3 says no text may render below 11px at final composited size and requires sub-13px text to be weight ≥500. The route’s `[zoom:2]` makes screenshots readable but is preview chrome, not the final T1 composite, so it cannot legalize undersized panel text. A mutation to 5px left all tests green.

9. **[MAJOR] Required browser accessibility verification is absent, and the authored semantics are not enough to infer a pass.** [`packages/panel/src/Panel.tsx:94`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:94), [`packages/panel/src/Panel.test.tsx:7`](/Users/vinicius/code/webPod/packages/panel/src/Panel.test.tsx:7), [`docs/workstreams/002-implementation-spine/evidence/w3-keyboard.txt:1`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/evidence/w3-keyboard.txt:1) — The dispatch requires Playwright keyboard traversal and axe target/contrast in both colourways plus reduced-motion, reduced-transparency, contrast-more, and Dynamic Type browser runs. Evidence is eight prose lines with no trace, axe output, contrast results, emulation, focus order, or accessible-name assertions. The whole panel is one `role="application"` focus target; list rows expose no option semantics or selected accessible value, and battery glyph text is not hidden. The browser accessibility snapshot reports generic row contents under a list, not an adjustable value or selected label. Presence tests for three media-query strings are not behavior proof.

10. **[MAJOR] The required visual evidence matrix is missing and the existing comparison is materially weaker than claimed.** [`docs/workstreams/002-implementation-spine/evidence/w3-visual.md:1`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/evidence/w3-visual.md:1), [`docs/workstreams/002-implementation-spine/diary/w3.md:1`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/diary/w3.md:1) — The packet requires screenshot pairs per state and S13 pale-art/dark-art in both modes. The commit contains only three ready-screen pairs, all with the same synthetic art. There are no captures for loading, empty, error, offline, permission-denied, agent-active, success-confirmation, reduced preferences, or Dynamic Type. Native Pencil comparison shows HYNXu’s real artwork, typography, status row, and spacing differ substantially from the implementation. “Compared through Pencil MCP” records an activity, not a parity result.

11. **[MAJOR] The tests are token-presence checks and do not gate the behavior their names claim.** [`packages/panel/src/Panel.test.tsx:20`](/Users/vinicius/code/webPod/packages/panel/src/Panel.test.tsx:20), [`packages/panel/src/Panel.test.tsx:27`](/Users/vinicius/code/webPod/packages/panel/src/Panel.test.tsx:27), [`packages/panel/src/model.test.ts:12`](/Users/vinicius/code/webPod/packages/panel/src/model.test.ts:12) — The geometry test checks that three substrings exist somewhere in CSS; it does not inspect computed geometry, count eight rows, or bind selectors to literals. The preference test only searches media-query names. In an isolated archive I confirmed the mutation landed (`font-size: 5px`, loading `length: 7`) and all 8 tests still passed. There are no deterministic tests for navigation side effects, shared-store subscriptions, all state rows, light/dark deltas, >100 virtualization, URL validation, or announcements. Under D-050/D-064, these are not gates.

12. **[MAJOR] The required universal gate command is red and omitted from the evidence.** [`docs/workstreams/002-implementation-spine/evidence/w3-gates.txt:1`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/evidence/w3-gates.txt:1) — The artifact lists tsc, lint, tests, grep, and diff-check but not `bun run gates`, despite both scope DoD and W3 dispatch requiring it. Independent execution exits 1 with `bun run gates: not implemented`. W5 may own implementing the runner, but that makes W3 not independently complete; it does not permit the evidence file to omit the required red command while calling itself “final.”

13. **[MAJOR] The app bypasses the workspace package boundary instead of declaring `@webpod/panel`.** [`apps/web/src/routes/index.tsx:2`](/Users/vinicius/code/webPod/apps/web/src/routes/index.tsx:2), [`docs/workstreams/002-implementation-spine/decisions/w3.md:17`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/decisions/w3.md:17) — The route reaches four directories into `packages/panel/src`, while `@webpod/panel` has a real package export. The decision says W3 lacked authority to mutate a shared manifest, but the dispatch’s required route integration cannot be made package-canonical without that dependency. The correct response to an ownership conflict is escalation or a coordinated manifest edit, not making source layout part of the app API. This bypass also lets web tsc pass without proving the package is consumable through its declared export.

14. **[MAJOR] Public behavior is undocumented and implementation naming leaks the workstream ID.** [`packages/panel/src/Panel.tsx:33`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:33), [`packages/panel/src/model.ts:32`](/Users/vinicius/code/webPod/packages/panel/src/model.ts:32), [`packages/panel/src/model.test.ts:12`](/Users/vinicius/code/webPod/packages/panel/src/model.test.ts:12) — `Panel` and every exported model function lack the required TSDoc describing lifecycle, store mutation, capability filtering, return semantics, and footguns. The test suite is named `W3 panel models`, and commit `6f8b41a` is titled `docs(002): record W3 panel evidence`; both violate the workstream’s naming law that IDs stay in bookkeeping paths rather than implementation/test names and commit messages. This matters here because the most dangerous lifecycle behavior—global store writes during import/render—is precisely what the missing documentation should have surfaced.

15. **[MINOR] Files named `.png` contain JPEG data.** [`docs/workstreams/002-implementation-spine/evidence/w3-visual.md:8`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/evidence/w3-visual.md:8) — `file` identifies all nine `w3-*.png` artifacts as JFIF JPEG. The pixel dimensions are correct (272×204 crops and 1280×720 overviews), but the extension misstates the format and weakens evidence reproducibility.

16. **[MINOR] The route’s search validator uses unchecked casts where a closed parser would make invalid state unrepresentable.** [`apps/web/src/routes/index.tsx:15`](/Users/vinicius/code/webPod/apps/web/src/routes/index.tsx:15) — `search['state'] as PanelState` is evaluated twice and trusts a cast before `includes`; `scale` then demonstrates why ad-hoc primitive checks are brittle under TanStack’s JSON-aware parser. A schema or explicit type predicate would preserve the closed union without unchecked assertions.

### Suggestions (non-blocking)

- Keep the useful accomplishments: the package is real DOM, forbidden canvas/useFrame/useState surfaces are absent, both colourways share one imported client store, keyboard detents synchronize both Providers, Radio filtering is model-driven, and `actualPx` clamping is implemented in the model.
- Preserve the current exact 272×204 browser captures as regression inputs, but add computed-style and accessibility assertions rather than more screenshot-only proof.
- Do not treat generic Interface Design Guardrails’ “no gradients” rule as binding here; the project’s primary panel token/spec explicitly requires status and selection gradients.

### Neuve Dogfood Feedback

- **Commands run:** none.
- **Artifact refs:** none.
- **Kanban updates:** none.
- **HITL gate:** not applicable; no Neuve routing occurred.
- **Signal value:** not applicable.
- **Sticking points:** repo law states there is no Neuve shell or Kanban board.
- **Format feedback:** workstream-local dispatch/evidence/review artifacts provided sufficient review routing.
- **Backlog signals:** none for Neuve.
- **Feedback artifact:** not applicable; unavailability is recorded here as required by strict-critique.

## Re-review Entry Criteria

Re-review should start only after the implementation demonstrates, not merely states:

1. real provider playback and progress subscriptions;
2. TanStack Virtual on a >100-row fixture;
3. complete §10 behavior for every in-scope state and both colourways;
4. the §5.11 S13 adaptive artwork path with pale/dark fixtures;
5. reachable Dynamic Type at 130% and 200% with 8/6/4 density and no clipping;
6. no store writes during render and no server-global per-document state;
7. Playwright + axe + preference-emulation artifacts;
8. mutation-gated tests that fail for seven skeleton rows and sub-11px final text;
9. `bun run gates` green or an explicit owner waiver/dependency ruling recorded in the W3 packet; and
10. canonical `@webpod/panel` consumption from the app.

# Re-review — correction commits through `d897d63`

## Verdict: REQUEST_CHANGES

Five Major findings remain. The correction set is materially stronger: TanStack Virtual is real, the package boundary is canonical, Dynamic Type reaches the ruled 8/6/4 densities, store initialization moved out of render, typography and skeleton mutations now fail, the evidence files are real PNGs, and the W6 raster seam no longer depends on filters or blend modes. It still does not meet the W3 correctness target because the shipped S13 path replaces provider art with test gradients, the fixture playback clock stops after one tick, D-019's forbidden download UI has been reintroduced, success receipts can describe an operation that never occurred, and the accessibility proof is partly vacuous.

U14 and H-6 remain owner-only. This re-review does not clear either.

### Re-review setup and independent checks

- **Commits reviewed:** `06e0d7e`, `3be4792`, `0702640`, `383c1e7`, `d748b27`, `bedd4ca`, `8bce03b`, `d897d63`. `git show --check` is clean and none carries a trailer.
- **Binding sources reloaded:** W3 dispatch; complete 002 scope, dependency, decision, HITL, review-prompt and review-lane bundle; W3 diary/decisions/evidence; 001 PM and design-system sections named by the dispatch. D-019 is binding and postdates the 001 offline rows.
- **Framework sources rechecked:** `/Users/vinicius/code/agentic-context/jotai/docs/core/store.mdx`, Jotai `Provider.ts`/`useAtomValue.ts`, React purity guidance, TanStack Virtual's React adapter, and TanStack Router's search parser. The requested strict/design/web/motion/Jotai/Router/React skills were reloaded. Repo law says there is no Neuve board or shell.
- **Design source:** `design.pen` was accessed only through Pencil MCP. `A76Ib`, `DLqSo`, `H4QpB`, `HYNXu`, and `mObBW` were re-read; native captures of the first three were compared with the committed crops. No aesthetic acceptance is inferred from that comparison.
- **Scoped gates:** panel tsc pass; web tsc pass; scoped ESLint pass; panel unit tests 16/16 pass. With the dev server running, Playwright passes 10/10 in 9.8s. Invoking `bun run --cwd packages/panel test:e2e` by itself fails because the config has no `webServer`; see Minor 1.
- **Mutations:** five independently confirmed plants all turned the panel suite red: skeleton 8→7 (2 failures), 11px→10px (2), progress subscription duplication (2), raster `filter` insertion (2), and virtual threshold 100→1000 (2).
- **Current aggregate:** typecheck is 11/11, lint passes, and root Bun tests pass (725/725 on the first run; 726/726 inside the current gate run). `bun run gates` is red only on foreign surfaces: U8 in W6/server-core artwork-proxy work and NAMING in the Apple probe. At the evidence snapshot, the reported `jotai/vanilla` resolution error came from concurrent W6 composite edits; `packages/composite` was the importer and lacked its dependency. The current uncommitted W6 package-manifest correction makes TYPES green. This is a **foreign W6 integration defect, not a W3 finding**, and it is not used to excuse any W3 defect below.

### Findings

1. **[MAJOR] The production S13 path still does not render or sample provider artwork.** [`packages/panel/src/Panel.tsx:65`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:65), [`packages/panel/src/Panel.tsx:341`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:341), [`packages/panel/src/Panel.tsx:362`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:362), [`packages/panel/src/Panel.tsx:390`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:390) — `artworkTone` defaults to `dark`, the route always supplies `pale|dark`, and `Artwork` gives either value a synthetic CSS gradient which overrides `sharpArtwork(...).url`. The same enum selects a constant 3×3/8×8 sample fixture. Consequently the default user route can neither display the fixture provider's actual cover nor derive treatment from it; it demonstrates two test vectors while bypassing the real input. The committed ready crop is a blank purple square, unlike the actual-art S13 structure in Pencil `HYNXu`/`A76Ib`/`DLqSo`. Finding 1 and entry criterion 4 remain open.

2. **[MAJOR] The fixture-driven playback screen does not keep time.** [`packages/panel/src/Panel.tsx:333`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:333), [`packages/panel/src/Panel.tsx:337`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:337), [`packages/panel/e2e/panel.e2e.ts:23`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:23) — the subscriptions are now wired and S08 commands `play`, but the fixture provider deliberately owns no timer. W3 calls `tick(1000)` only when position is exactly zero, after which the condition permanently becomes false. In an independent browser run, `data-position-ms` was `4000` before and after a 1.7s wait. The Playwright assertion only asks for a non-zero snapshot, so it certifies the one-shot tick as progress. W1 explicitly handed consumers responsibility for driving `tick(deltaMs)`; W3 has not done so. Finding 3 and entry criterion 1 are only partially closed.

3. **[MAJOR] The state matrix contradicts settled D-019 by restoring the download product that was cut repo-wide.** [`packages/panel/src/model.ts:11`](/Users/vinicius/code/webPod/packages/panel/src/model.ts:11), [`packages/panel/src/Panel.tsx:198`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:198), [`packages/panel/src/Panel.tsx:247`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:247), [`packages/panel/src/Panel.tsx:317`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:317), [`packages/panel/src/Panel.tsx:378`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:378), [`packages/panel/e2e/panel.e2e.ts:60`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:60) — the correction adds a Downloads menu, downloaded counts, per-row `⤓`, downloaded-only playback copy, and `Play downloads`, then tests all of them. D-019 explicitly cuts the glyph and recovery path and says disconnected mode is cached shell/art/metadata only, with no greyed or broken download affordance. Implementing stale 001 rows cannot satisfy the later binding decision. Finding 4 and entry criterion 3 remain open until the matrix is reconciled to D-019.

4. **[MAJOR] `success-confirmation` can state a library mutation while changing only volume.** [`packages/panel/src/Panel.tsx:78`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:78), [`packages/panel/src/Panel.tsx:262`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:262), [`packages/panel/src/Panel.tsx:380`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:380), [`packages/panel/e2e/panel.e2e.ts:81`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:81) — mounting any screen in that state calls `setVolume`; S13 truthfully says “Volume changed,” but S08 says “Added to your library” and shows a check without calling `saveToggle`/`libraryAdd`. S03 has no operation-specific object at all. The state and actor are global props rather than an operation result, so the receipt can lie while the test verifies only its words. The claimed “object changes” fix closes the narrow S13 demo but not original finding 5 or the complete-state criterion.

5. **[MAJOR] The browser accessibility evidence does not prove selected-option or target-size behavior.** [`packages/panel/src/Panel.tsx:137`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:137), [`packages/panel/src/Panel.tsx:206`](/Users/vinicius/code/webPod/packages/panel/src/Panel.tsx:206), [`packages/panel/e2e/panel.e2e.ts:203`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:203), [`docs/workstreams/002-implementation-spine/evidence/w3-axe.json:1`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/evidence/w3-axe.json:1) — keyboard focus remains on the outer `role="application"`, while `aria-activedescendant` is placed on the nested, unfocused listbox. Querying `getByRole('option', {selected:true})` proves an attribute exists, not that the focused accessibility object exposes the changing active option. The axe artifact is also vacuous for U6: both colourways report `targetSizePasses: []`, so zero targets were evaluated, yet the response says the rule passed explicitly. The ordinary axe and preference runs are useful and clean, but finding 9 and entry criterion 7 are not closed by this evidence.

### Finding-by-finding disposition

| Original | Disposition |
|---|---|
| 1 adaptive S13 | **OPEN · Major 1** — deterministic vectors exist; the real artwork path is bypassed. |
| 2 TanStack Virtual | **CLOSED** — real 120-row `useVirtualizer` path, bounded DOM, keyboard-coupled scroll, and throttled measurement reproduce. |
| 3 provider command/subscriptions | **OPEN · Major 2** — command/subscriptions exist; progress freezes after one tick. |
| 4 eight states | **OPEN · Majors 3–4** — richer behavior exists, but offline violates D-019 and success can lie. |
| 5 success actor/object | **OPEN · Major 4**. |
| 6 Dynamic Type | **CLOSED** — URL parsing, 8/6/4, 1.25 raster cap, and no-clipping checks reproduce. The 130% and 200% crops are byte-identical by design because both resolve to the ruled cap; that is not a defect. |
| 7 store purity/SSR | **CLOSED** — writes moved to effects, SSR render is mutation-free, and the route is client-only. The imported singleton satisfies D-051. |
| 8 typography | **CLOSED** — all authored final sizes are ≥11px and the mutation goes red. |
| 9 accessibility | **OPEN · Major 5**. |
| 10 visual matrix | **CLOSED mechanically** — all 48 PNG crops and preference/art variants exist and reproduce. H-6 remains owner-only. |
| 11 mutation resistance | **CLOSED** for the challenged requirements; five independent plants went red. |
| 12 aggregate gates | **FOREIGN RED, not charged to W3** — W3 scoped gates pass; current aggregate failures are outside W3 ownership. No claim that the branch gate is green. |
| 13 package boundary | **CLOSED** — app consumes declared `@webpod/panel`. |
| 14 docs/naming | **CLOSED** — public exports are documented and implementation/test naming is clean. Bookkeeping paths may name the workstream. |
| 15 evidence encoding | **CLOSED** — inspected files are actual PNGs at the claimed dimensions. |
| 16 search casts | **CLOSED** — closed parsers return explicit unions without unchecked casts. |

### Entry-criterion disposition

1. **FAIL** — playback commands/subscriptions exist, but fixture progress is not driven continuously.
2. **PASS** — TanStack Virtual renders 120 rows with bounded mounted rows.
3. **FAIL** — state behavior conflicts with D-019 and success semantics are not operation-bound.
4. **FAIL** — pale/dark fixtures exercise the math, but production provider art is never displayed or sampled.
5. **PASS** — 100/130/200 routes, 8/6/4 densities, cap, and no clipping reproduce.
6. **PASS** — no render-time store writes; client-only route; SSR mutation test passes.
7. **FAIL** — Playwright/axe/preferences run, but active-option semantics and target-size evidence do not establish the required behavior.
8. **PASS** — seven skeleton rows and sub-11px type both turn tests red.
9. **FOREIGN RED / NON-W3** — the reported W6 Jotai failure is correctly owned by W6; present W3-scoped gates pass. This does not make the branch gate green.
10. **PASS** — canonical package import and manifest boundary are in place.

### W6 raster-compatibility disposition

**CLOSED for W3.** The panel package has no authored `filter`, `backdrop-filter`, or `mix-blend-mode`; the pseudo-element computes to `filter:none` and `mix-blend-mode:normal` in both colourways; reduced transparency removes it; a planted filter turns tests red. The remaining radial gradient and custom properties are browser-painted into the DOM source before W6 samples it and require no tier branch or composite import. This closes the raster-seam finding, but does not cure Major 1's missing real-art input. During the shared-tree run, W6's composite route separately logged `texElementImage2D: No cached paint record for element`; that is a foreign W6 runtime blocker and prevents claiming end-to-end composite success, but it does not falsify the narrower W3 CSS compatibility result.

### Minor findings

1. **[MINOR] The browser suite is not self-starting.** [`packages/panel/playwright.config.ts:1`](/Users/vinicius/code/webPod/packages/panel/playwright.config.ts:1) — the package command immediately produced ten `ERR_CONNECTION_REFUSED` failures until `bun dev` was started separately. Add a Playwright `webServer` entry or make the documented evidence command include the server lifecycle so a clean reviewer can reproduce the claimed run with one command.

# Final re-review — commits `014ccfa`, `ba7592b`, `6f7580d`

## Verdict: REQUEST_CHANGES — 1 Major, 0 Minor

Five remaining Majors and the remaining Minor from the prior review are closed. One accessibility Major remains: the target-size proof measures the preview after its deliberate 2× zoom and therefore passes controls whose native size is below the binding 44×44 minimum. U14 and H-6 remain owner-only and are not cleared here.

### Remaining finding

1. **[MAJOR] U6 is still neither implemented nor substantively tested.** The primary requirement is 44×44 on every interactive element ([`pm-spec.md:2006`](/Users/vinicius/code/webPod/docs/workstreams/001-interface-design-handover/pm-spec.md:2006)). The Now Playing action remains only 24×24 in authored panel geometry ([`panel.css:117`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:117)), while the browser test explicitly lowers the assertion to 24×24 ([`panel.e2e.ts:286`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:286)). Both preview panels are wrapped in `zoom:2` ([`index.tsx:55`](/Users/vinicius/code/webPod/apps/web/src/routes/index.tsx:55)), so axe and `boundingBox()` see the transformed 48×48 box rather than the native 24×24 control. I independently changed the native minimum from 24px to 20px: the isolated Playwright run still passed and axe still reported no target-size violation because it measured 40×40 after zoom. That is a live false-negative, not merely weak evidence. It also does not satisfy this workstream's requirement that axe run on the composited page rather than only the bare preview ([`scope.md:85`](/Users/vinicius/code/webPod/docs/workstreams/002-implementation-spine/scope.md:85)). Make the final interactive target genuinely satisfy the resolved requirement and assert its final/composited geometry without preview magnification masking undersizing. If 44×44 cannot coexist with the 272×204 panel design, that conflict needs an explicit owner ruling; the test may not silently redefine U6 as 24×24.

### Prior-finding disposition

1. **Real provider artwork and sampling — CLOSED.** The default route now supplies provider artwork, the panel displays the provider URL, and the sampling path decodes and samples that same resource without canvas. The fresh independent S13 capture was byte-identical to the committed provider capture; browser evidence reports the same URL and natural dimensions for the displayed and sampled source. Pale/dark query fixtures remain explicit test overrides rather than the production default.
2. **Continuous progress lifecycle — CLOSED.** The reference-counted document clock continuously advances the fixture provider from elapsed `performance.now()` time and clears only after the final lease releases. Unit coverage proves two leases, continued advancement, and final cleanup; the browser observation advanced by approximately 750ms over an 800ms window. Replacing the elapsed tick with `tick(0)` makes the unit suite fail.
3. **D-019 offline/download contradiction — CLOSED.** Download controls, downloaded filters, and download receipts are absent. The remaining offline state truthfully describes cached metadata with playback unavailable. Reintroducing a Downloads receipt makes the contract test fail.
4. **S08 library mutation — CLOSED.** S08 now performs `playlistCreate`, reads the playlist library back, and renders a receipt tied to the created object and resulting library count. S13 retains the separate volume mutation. Replacing the creation receipt with the old volume claim makes isolated Playwright fail.
5. **Active-option semantics — CLOSED.** Focus remains on the keyboard application while its unique `aria-activedescendant` follows the highlighted S03 option. Removing the attribute makes isolated Playwright fail. This closes the active-option half of the prior accessibility finding; the target-size half remains open above.
6. **Self-starting browser suite — CLOSED.** Playwright now owns the development-server lifecycle. A cold run with a fresh evidence directory completed 11/11 without a separately started server.
7. **Hook dependency — VERIFIED.** The artwork sampling effect includes `artUrl` with its other inputs and scoped lint is clean. Removing `artUrl` produces the expected `react-hooks/exhaustive-deps` warning and fails when lint is run with `--max-warnings=0`.

### Independent verification

- `bunx tsc -p packages/panel --noEmit` — pass.
- `bunx tsc -p apps/web --noEmit` — pass.
- `bunx eslint packages/panel apps/web/src/routes/index.tsx` — pass.
- `bun test packages/panel` — 19 pass, 0 fail.
- Cold `bun run --cwd packages/panel test:e2e` with a fresh evidence directory — 11 pass.
- Root `bun run typecheck` — 11/11 packages clean.
- Root `bun run lint` — pass.
- Root `bun test` — 805 pass, 0 fail.
- Root `bun run gates` — all 16 automated gates pass; manual U14 and U15 remain outstanding.
- The provider captures are real 544×408 PNGs. A freshly generated provider capture matched the committed capture byte-for-byte.
- The three correction commits pass `git show --check` and contain no trailers.

### Foreign-error classification

No active `server-core` failure reproduces now: the current root typecheck, lint, tests, and automated gates are green. The server-core/W6 errors cited during the previous review were concurrent foreign-lane failures, not W3 failures. The present dirty server-core/device/composite work remains outside these three commits and does not change this verdict.

# Final U6 re-review — commits `e49c022`, `9f2f863`, `6145244`, `b92c30e`

## Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

The sole remaining U6 Major is closed. This approval is limited to the W3 implementation and evidence reviewed here; U14 and H-6 remain owner-only and are not cleared.

### Correctness check

- **Source of truth:** 001 §15.0 U6 still requires a native 44×44 minimum ([`pm-spec.md:2006`](/Users/vinicius/code/webPod/docs/workstreams/001-interface-design-handover/pm-spec.md:2006)); the implementation no longer relies on the preview's 2× transform to satisfy it.
- **Dispatch scope:** the behavioral commits touch only W3-owned panel source, CSS, unit tests, and Playwright evidence. The documentation commits update W3 bookkeeping artifacts. No W4-owned `_spike` route is included.
- **Decision/HITL status:** W3 decision 16 now accurately records the native-size, preserved-footprint, and clipping invariants. U14 and H-6 remain outstanding owner decisions.
- **Agentic-context grounding:** I checked `/Users/vinicius/code/agentic-context/html-in-canvas/README.md:124-128`, which explicitly demonstrates that `getBoundingClientRect()` includes the canvas transform, supporting the separation between transformed hit coordinates and native layout dimensions. I also checked `/Users/vinicius/code/agentic-context/react.dev/src/content/reference/eslint-plugin-react-hooks/lints/refs.md:69-80` for the browser-measurement posture. No framework behavior is inferred from recall.
- **Neuve/Kanban:** repo law states this repository has no Neuve board or shell, so no Kanban or Neuve review action is available.
- **Git:** all four commits pass `git show --check`; their boundaries are coherent and their messages contain no trailers.

### U6 verification

1. **Native pre-transform size — PASS.** The authored button has a 44px flex basis and 44px minimum inline/block sizes ([`panel.css:117`](/Users/vinicius/code/webPod/packages/panel/src/panel.css:117)). The independent browser run reports `offsetWidth: 44`, `offsetHeight: 44`, `minInlineSize: 44`, and `minBlockSize: 44` for both dark and light colourways. Those first four values are read before preview magnification rather than inferred from the transformed 88×88 `boundingBox()`.
2. **Clipping and hit coverage — PASS.** Playwright samples one CSS pixel inside all four transformed corners and requires `document.elementFromPoint()` to return the button or its child ([`panel.e2e.ts:298`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:298)). Both colourways independently returned `[true, true, true, true]`. Wrapping the heart in a child preserves correct hit attribution while the two-pixel inward shift keeps the expanded target inside the clipped panel.
3. **Exact 20px mutation — PASS (gate turns red).** In an isolated archive of `b92c30e`, I changed exactly `min-inline-size: 44px` and `min-block-size: 44px` to 20px. `bun test packages/panel/src/Panel.test.tsx` exited 1 at [`Panel.test.tsx:48`](/Users/vinicius/code/webPod/packages/panel/src/Panel.test.tsx:48), reporting the received 20px rule. The browser gate separately asserts computed native minimums ≥44 ([`panel.e2e.ts:311`](/Users/vinicius/code/webPod/packages/panel/e2e/panel.e2e.ts:311)), closing the prior transformed-box false negative.
4. **Provider visual preservation — PASS.** A fresh full Playwright run regenerated both provider captures. Dark SHA-256 remained `27b6f44b…28f` and light remained `bc36c571…078e`, byte-identical to the committed captures. The corresponding evidence blobs are identical before `e49c022` and at `b92c30e`. The captures are 544×408 because the evidence route records the 272×204 panel at exact 2× integer zoom; therefore the underlying 272×204 composition is unchanged, while the native target geometry is now compliant.
5. **Axe — PASS.** Both colourways have zero general and target-size violations. The `target-size` rule appears in `passes` and evaluates one node in each colourway; this is no longer a vacuous zero-node result.

### Independent gates

- `bunx tsc -p packages/panel --noEmit` — pass.
- `bunx tsc -p apps/web --noEmit` — pass.
- `bunx eslint packages/panel apps/web/src/routes/index.tsx` — pass.
- `bun test packages/panel` — 20 pass, 0 fail, 57 assertions.
- Cold `bun run --cwd packages/panel test:e2e` with a fresh evidence directory — 11 pass in 12.6s.
- Fresh axe artifact — both colourways: native 44×44, four corners hittable, one target evaluated, zero violations.

### Findings

None.
