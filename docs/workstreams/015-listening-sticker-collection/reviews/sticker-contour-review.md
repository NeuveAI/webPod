# Independent contour sticker review

## Verdict: APPROVE — scoped contour implementation independently verified

Final source: **27f7eea4bdb525c292ea0b3b502cdc802d9f9864b56fdf9d9aefb21777783b9b / 398 files**. No remaining Major or Critical findings in the reviewed contour scope. This is independent engineering/product review, not owner aesthetic approval. Commit and clean-worktree closure remain pending the lead's final verification.

| Requirement | Independent verdict and evidence |
| --- | --- |
| Actual contour and four corner rotation grips | PASS: Soundcheck concavities and Pulse notch follow the alpha boundary. Desktop/375px actual gestures exercise all four grips, visible-marker hit containment and unchanged size. No rectangular contour fallback. |
| Frosted controls and top wear | PASS: white rounded grips, slim upper scrub rail and compact lower actions. Actual reduced-transparency/contrast capture becomes opaque with no blur. |
| Semi-bounce and direct movement | PASS: actual press/held/release-mid/exit frames inspected; bounded compression/overshoot and grip return, direct pointer geometry, reduced-motion suppression. No selection dock/reframe. |
| Every interaction has a tooltip | PASS: four corners, wear, return/reset and retry have hover/focus explanations. Native Escape, hover transfer, stationary underlying-control suppression, away/reentry and deliberate focus checks pass. |
| Peel/reset and durable customization | PASS: actual lifted adhesive, body carry, own-sheet return, re-stick/reload preserve wear. Reset preserves center/size and safely straightens with bound feedback. Failure/retry/conflict/cancellation remain guarded. |
| Varied scratches and frayed edges | PASS at tested owner scale: independently inspected Night Shift 385px and angled Pulse 475px at 0/.5/1, selected/unselected and broad underside. Rejected coarse blocks were replaced with fine stable damage. Final Soundcheck front/back also inspected. |

### Final independent checks and limits

Corrected native route run: **1 test / 219 assertions PASS, 29.92s test / 30.11s suite**, real Start fixture/SQLite, actual painted artwork and shader-console gate. Evidence is `evidence/sticker-contour/reviewer/corrected/` and `reviewer/corrected-native.log`. App/device typecheck and scoped ESLint passed. Editor/HUD/layout/runtime/return tests: **24 tests / 1,494 assertions PASS**. Earlier refined material checks: **7 tests / 10,939 assertions PASS**. Current per-file manifest independently recomputed with zero mismatches in `reviewer/final-provenance.json`; diff check clean.

The first independent final native completed interaction gates but failed its final identity assertion because an extra trailing blank EOF line was removed during the run (0daa…→27f7…). That failure is preserved in `reviewer/final-native.log`, not counted as passing. One corrected-identity run passed including cleanup. This whitespace-only delta did not require a product rebuild.

Positive WebGL draw control: 539→1097 during rotation. One fully present settled HUD stayed **1841→1841 draws for 3001.7ms**, recorded in `corrected/settled-hud-idle.json`. This proves settling during the observed interval, not universal performance or memory freedom. Owned fixture/browser/server resources closed and reviewer released the slot to the lead.

At approximately 20px minimum print size, four separate 44px targets expand outward. The tiny-art capture has more space between art and grips than normal prints; I accept that explicit reachability tradeoff, with no square outline or spokes, rather than claim equally tight attachment at every size. Normal-size grips stay close to the silhouette. Glass preferences were emulated in Chromium; physical iOS/Safari was not tested. Motion judgment combines recorded sequence frames with bounded source behavior, not compositor latency measurements. Damage retains finite 1024-grid resolution and bounded per-art memory, documented below. Reset removes added wear, not baked PNG distress.

Historical findings and rejected checkpoints follow chronologically; their pending language describes those earlier states.

### Concurrent-work boundary after final validation

After the corrected run and source check, separate work initially changed `device-preview-orientation.ts`, its test, and `packages/tools/src/index.ts`, and added `packages/tools/src/native.ts`. Independent comparison at that checkpoint found those three existing-file differences and every contour-owned file identical. Narrow orientation inspection showed opt-in rotate/flick APIs and motion-generation/disposal guards, with human thresholds and the spring integrator unchanged. The lead subsequently reported further ongoing external composite/device/state/audio edits. These later integration changes were not chased or approved by this review. The scoped contour result remains tied to 27f7; the later aggregate checkout is not the tested identity. Other workstream documents were not read; their changes must remain unmodified. Lead should commit only this scope and report unrelated dirty work honestly rather than claim an entirely clean checkout.

Read `sticker-contour-scope.md` in full. Prior square HUD visual approval is superseded; its durable wear/session/write/cancellation evidence is reusable only for unchanged behavior. Four contour-aligned rounded frosted corner controls must all rotate, with top-side continuous wear and compact peel/reset actions. A box, rounded box or convex hull around irregular artwork is not the requested contour.

Reused Interface Craft critique/storyboard, Guardrails and all four resources, Neuve Motion, iOS HIG visual/motion/accessibility and prior runtime/domain references. Newly read iOS HIG `liquid-glass.md`; executed Modern Web Guidance with Bun for frosted controls/tooltips and retrieved interest-triggered tooltip guidance. Browser-dependent interest invoker/popover hints require feature detection or a manual accessible fallback; no assumption that newer attributes work across supported browsers. Glass belongs to controls, with real reduced-transparency/contrast fallback, not the printed vinyl itself.

## Independent preimplementation contract risks

- Existing `sticker-hit.ts` stores prepared raw alpha in a texture-keyed WeakMap and uses the same16/255 cutoff as the print. Reuse preparation/cache ownership; avoid per-pointer image readback or contour extraction. New contour projection must map actual UV boundary points through conformed geometry, preserving concavities and bounded visible error.
- Existing wear changes only front ink/roughness/coat; underside and hit testing still use raw alpha. New torn/frayed alpha must agree across front, peeled backing, shadows, CPU hits and displayed contour. Otherwise the backing fills eroded holes or invisible torn regions remain clickable. Stable deterministic damage must not reshuffle during drag/reload, and increasing wear must not restore torn pixels.
- Four44px rotation regions plus top wear and peel/reset actions need actual minimum-size375px geometry. Do not replace four corners with two or use a square frame to simplify layout. Outward contour-sector offsets must remain visibly tied to actual silhouette.
- Reset at a fixed existing position can make catalogue defaults invalid near safe rear bounds. The brief must resolve this honestly through a valid constrained default or clear refusal, without silent translation, ownership loss or an unguarded write.
- Tooltip hover/focus/Escape must coexist with active pointer cancellation and native wear range ownership. Cancel cannot leave a live pointer that submits on release. Unsupported tooltip primitives need a working fallback, not title-only semantics.

These constraints were sent to the material and UI engineers before integration. Designer brief and contour/erosion authority contract remain pending. Reviewer does not edit implementation and does not compete for active browser/build ownership.

## Brief and shared helper checkpoint

Read `sticker-contour-design-brief.md` in full and current `sticker-alpha.ts`/`sticker-contour.ts`. **Accepted for bounded early rendering**, not final approval: actual paths include holes/concavities, four separate art-sector rotation grips, top horizontal wear and compact peel/reset, no square fallback. Tooltip Escape and native range ownership are specified; glass fallbacks are explicit.

Reset semantics were called out to lead to avoid ambiguity: preserve center/size/ownership, reset added wear to zero and request the safest attainable upright angle, with “Reset wear and straighten” naming and bound feedback. Lead confirms this is the intended authorized refinement and will make scope wording exact. It does not erase baked PNG distress.

The helper uses a bounded256-resolution deterministic erosion threshold field with explicit bottom-up DataTexture copy, immutable texture ownership/disposal and four-entry wear contour LRU. Occupied cell-edge tracing retains loops and removes only collinear vertices; anchors use external loops, then project through production conformed triangles. Full-resolution source alpha is retained for hits. Coarse contour occupancy versus full-resolution rendered alpha remains a bounded approximation whose visible error must be checked at normal and maximum print size. Source inspection does not approve edge texture, glass, four-target usability or actual peel fidelity before the first render.

## Independent material/helper source checkpoint

Read frozen alpha/damage, contour projection, hit test, wear shader and StickerSurface integration. The threshold map explicitly reverses typed rows once with flipY=false/nearest filtering; front and clean adhesive back apply the same erosion cutoff, CPU hit uses full source alpha plus the same erosion field. Per-ID seeds are stable; wear only changes retained uniforms. Source texture lifetime owns the derived map and one disposal listener; material clones borrow it. Production conformed grid triangle interpolation matches the actual indexed diagonal. Existing prints did not cast a separate shadow geometry, so no old square shadow was left behind by this change.

Independently ran `bun test packages/device/src/sticker-alpha.test.ts packages/device/src/sticker-wear.test.ts`: **6 tests /11,023 assertions PASS,268ms**, logged at `evidence/sticker-contour/reviewer/material-tests.log`. Tests cover seed variation/monotonic edge erosion/reset, hole winding/concavity/cache reuse, actual rear projection/external anchors, readback-once/retry/disposal, explicit GPU rows and shared retained shader uniforms. No concrete source blocker identified at this bounded checkpoint. Real GPU compilation, fraying appearance and256-grid contour approximation remain unapproved until actual render evidence; source tests do not establish visual fidelity.

## First actual contour renders — fidelity correction required

Independently viewed `early/desktop-selected.png`, `desktop-pulse-contour.png`, `mobile-soundcheck-contour.png` and `mobile-pulse-contour.png`. The thin cut-line follows Soundcheck's irregular perimeter and Pulse Code's notch; all four white crop grips are present. This establishes a real contour implementation but does not yet accept the control composition.

Visible grips sit roughly45–65px away from a100px desktop print, connected by diagonal stems, creating a large implied rectangular crop frame. The requested physical relationship is actual contour corners. Refine visible bracket placement near contour independently of outward44px hit-target expansion where feasible, instead of using remote spokes by default. The top wear still reads as a conventional native slider inside a pill; refine it into a related horizontal scrub surface while retaining native accessible range behavior. Early white blocks look mostly flat; actual frosted edge/translucency over dark/light metal must be assessed. Mobile Pulse wear also overlaps Soundcheck, already acknowledged by the implementer. These concrete fidelity issues were sent to designer and lead before broad expansion; early visual approval remains withheld. Frayed wear and preserved peel are not yet visible in these clean static captures.

## Revised close-grip visual checkpoint

Viewed `early/close-grips/desktop-selected.png`, both mobile contour images and `desktop-pulse-wear-high.png`. **Concept accepted to proceed with broader native validation**: close rounded corner marks now follow the real cut shape without long spokes, the thin horizontal scrub rail is visually related, and mobile wear no longer covers Soundcheck. This replaces the rejected first composition rather than approving it retrospectively.

A source containment risk remains for final proof: visible marker centers sit5px outside the contour, while44px button centers may use32/42/56px offsets or fallback seats. The translated28px SVG can extend outside its nominal button and create unmeasured overflow hit geometry. Measure actual painted bracket containment/effective targets at minimum and edge positions, not only button rectangles. Four controls and a usable body region remain mandatory. The high-wear screenshot includes the selection contour, which visually amplifies erosion; material judgment requires no-HUD zero/mid/high wear and the peeled adhesive side.

## Early unobscured material assessment

Viewed actual `early/material/desktop-pulse-wear-0-close.png`, `0.5-close.png`, `1-close.png`, normal-size high wear and held peel. Zero retains the original smooth rim; increasing wear adds varied scratches and irregular rim nicks while preserving title/keys. At roughly100px it reads as weathered/chipped laminated vinyl, not long fibrous paper strands. This is a reasonable material interpretation, with fine granular detail more visible in crops than normal scale. The selected outline had amplified the earlier white-edge impression.

The held peel image is nearly edge-on: upper artwork folds away, but too little adhesive faces the camera to prove backing silhouette consistency. Requested actual oblique/later lift exposing the underside, plus irregular Soundcheck variation and maximum-size contour/fray aliasing proof. No additional shader polish was requested from these captures; final material approval still awaits those concrete views.

## App lifecycle source review — mutable candidate

Reviewed current contour editor, layout, tooltip, continuous range and reset source without competing with native ownership. Existing handle/range cancellation, guarded reset/Undo and release identity cleanup remain present. Reset preserves position/size, requests safely constrained upright and zero added wear, and reports a bounded result locally.

Two concrete gaps were sent directly to UI and lead. Hover-only tooltip activation leaves keyboard focus on canvas/body; the collection's document-capture Escape handler then dismisses the entire selected editor before the HUD's local tooltip priority can run. Add shared synchronous tooltip consumption before global selection dismissal, with active gesture cancellation still first, and exercise hover-only/outside-focus Escape natively. Both Retry recovery buttons also lack the real hover/focus tooltip required for every interactive part. These remain pending corrections, not hypothetical checklist items. Visible SVG translation is now bounded to6px from its button and SVG pointer events are disabled; final actual rotated/pressed containment tests remain necessary.

## Owner-scale material rejection

Independently inspected owner screenshots `codex-clipboard-6318f54c-4d77-4b24-9522-d8bbf08e1a01.png` and `codex-clipboard-83fa5f75-5e6c-4c2d-9c22-0571b8a95de7.png`. At this intended scale, Pulse Code and Night Shift show regular square border bites and rectangular interior abrasion stamps. **Material fidelity is rejected at owner scale.** The earlier conditional100px assessment does not approve this result; maximum-size proof was explicitly outstanding.

Requested correction of both erosion/contour quantization and block-cell interior abrasion. Increasing threshold resolution alone is insufficient if repeated square stamps remain in the shader. Preserve shared front/back/hit/contour alpha authority, stable identity seeds, monotonic wear and bounded resources. New actual owner-size selected/unselected and angled Night Shift/Pulse renders must show fine irregular vinyl nicks/scratches without square blocks before material acceptance. No final source freeze while this correction is active.

## Refined owner-scale material source checkpoint

Independently read the1024-field refinement, smooth multiscale edge depth, interpolated abrasion shader and static boundary-candidate traversal. Maximum erosion depth is4.75×resolution; candidate band includes its next boundary neighbor, preserving topology completeness while avoiding full-image scans on each wear change. Stable shared cutoff, explicit row order, front/back/hit authority and source-owned disposal remain intact. No new source blocker found.

Independent alpha/wear suite: **7 tests /10,939 assertions PASS,135ms**, `reviewer/refined-material-tests.log`. Corrected memory-accounting caveat sent to material engineer: retained CPU includes2MiB field alpha/onset at1024², an additional1MiB flipped DataTexture upload buffer, original full-resolution alpha, candidate indices and bounded contour caches; GPU threshold storage is another1MiB. Transient distance/readback buffers are separate. These are bounded per prepared art, not per pointer move. Source tests do not approve owner-scale smoothness; actual400px selected/unselected angled Night Shift and Pulse Code remain mandatory.

## Refined Night Shift at owner scale

Viewed `early/owner-scale/pass-3/PW-A01-large-wear-{0,0.5,1}-close.png` and high-wear selected view. At approximately385CSSpx, fine irregular rim erosion and varied scratches replace the prior square chips/stamps; the moth and title remain readable. **Conditional visual pass for Night Shift at this scale**, with Pulse Code angled and exposed adhesive still pending. No universal material approval from one artwork.

The updated monochrome paint detector counts adjacent horizontal luminance edges over25 inside a70px center crop, requiring more than70 edges. This is more appropriate than saturation for grayscale artwork, but a logo or simple high-contrast silhouette may also meet that count. Requested a same-pose/crop blank-backplate negative control before claiming the automatic gate specifically excludes absent artwork. Actual inspected captures independently show the print; no numerical weakening can substitute for that evidence.

## Owner-scale Pulse and underside correction accepted

Independently viewed `early/owner-scale/pass-5/PW-F01-large-wear-{0,0.5,1}-close.png` and `large-pulse-adhesive.png`. At roughly475CSSpx and35° rotation, fine irregular nicks and varied scratches replace the rejected square stamps/stairs while preserving title/keys. The exposed adhesive is visibly unprinted and carries the nicked outer boundary without raw backing filling the damage. Together with the Night Shift385px series, **the owner-scale material correction passes visual review at this checkpoint**. Final frozen native provenance and full interaction review remain required; this is not owner aesthetic approval.

The grayscale negative control now removes Night Shift through actual peel/return and measures the same crop/pose:0 edges against the required greater-than70 painted threshold. This is meaningful specificity evidence. The stalled sequential keyboard test identified real focus loss from native disabled controls during save, not a harmless fixture race. Current aria-disabled guards preserve focus; pending native range pointer/keyboard defaults are blocked and change restores the canonical controlled value. Thirty-five sequential saved keyboard edits are recorded by the native candidate. No new blocker found in those source guards; final pending-write/cancellation regressions remain part of the integrated gate.

## Tooltip teardown diagnosis

The narrow corner0 hover→tooltip-hover→focus→Escape trace succeeded: tooltip absent by keyup. This disproved a universal failure and was reported before recommending a patch. The expanded `early/tooltip-diagnosis/all-controls/` trace identifies the actual cases: after corner1 Escape removes the tooltip, the stationary pointer enters the newly exposed wear control and opens “Adjust wear”; Return exposes a rotation control similarly. Other corners remain negative controls.

A dismissal-position hover latch is therefore justified, rather than blanket suppression or per-trigger-ID suppression. Requested one shared local/global Escape helper, intentional focus bypass, real pointer movement within the revealed control re-admitting hover without requiring leave/reentry, keyboard-only safety and cleanup on selection/unmount. Source correction and full native tooltip proof remain pending; no competing browser was launched by the reviewer.

## Tooltip reentry refinement review

Read the fixed all-seven-control outcomes and source latch. A bounded window pointermove listener now clears dismissal after movement outside controls, allowing away-and-back to the same coordinate; it is removed on cleanup. Focus bypass and inside-control movement admission remain explicit.

Reported one remaining tracking hole before freeze: control pointermove only updates the stored last pointer when a dismissal latch already exists. Moving within a trigger while its tooltip is open can therefore make Escape record stale entry coordinates, allowing stationary teardown reentry at the actual current position. Track latest coordinates independently of suppression state. Also explicitly clear module pointer/latch values on unmount, not only on selected-ID change. No new browser or broad test run by reviewer during the implementer's active slot.

## Proof plan

At coherent checkpoints inspect source, then actual irregular Sound Check and Pulse Code silhouettes under rotation/perspective, all four corner rotations, body drag, tooltip focus/hover, continuous wear and reset failure/concurrency. Final native evidence must include375px target exclusions, partial/full wear at normal size and close-up, frayed transparent edge/backing agreement, seed stability, preserved peel/return/re-stick/reload, glass fallbacks, reduced motion and press/drag/release/exit frames. Independently run relevant helper/material/runtime tests and final native routes on a recorded fingerprint, verify positive draw control plus3-second idle, changed types/lint and cleanup. No old square-HUD images constitute new visual approval. No owner aesthetic approval or physical Safari certification inferred from Chromium fixtures.
