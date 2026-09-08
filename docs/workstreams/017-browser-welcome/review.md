# Verification and review

## Larger CTA/device and canonical panel frames

CTA now has a 64px minimum height, 248px minimum width and 18px text. Showcase
height increased from 62svh to 78svh (640–1000px); mobile model height is 480px.
The manually painted screen has been removed. Twelve 816×612 PNG frames are
captured directly from the real 272×204 `Panel` at 3×, using its own CSS and public
fixture provider. They preserve its menu density, Arial typography, Aqua selection,
titlebar, battery, transport, artwork layout, progress material and timing labels.
The bundled sample cover replaces the fixture's unserved artwork URL during
capture. No private account data appears in the exported frames.

Regenerate with `bun scripts/capture-teaser-screens.mjs` while `bun run dev` is
running. This uses an isolated headless Chrome and mounts the existing Panel on
the existing landing document; there is no new test route or shipped DOM replica.
The landing uploads decoded frames via an ordinary CanvasTexture, with mipmaps
and anisotropic filtering. It still works with the actual experiment disabled.
The cache is bounded to twelve decoded images; GPU material/texture resources
are disposed on unmount and late async completion is ignored.

Visual checks: `evidence/parity-menu.png`, `parity-playing.png`, `parity-mobile.png`.
Headless Chrome without the flag rendered both screen states, reported zero page
errors and no mobile horizontal overflow. Paused model captures 1s apart were
identical. Typecheck (12 projects), changed-file lint and production build pass.
Direct inspection of the exported frames confirms production CSS rather than an
approximation. These are prerecorded fixture screens; later Panel changes require
regenerating the assets. The previous hand-drawn demo documentation is superseded.

## Route split

`/` now always renders `LandingPage`; `/webpod` owns `DevicePage`. Supported
landing visits show the animation and an Open webPod link, with no setup banner.
Unsupported direct player visits keep the existing setup fallback. The legacy
composite redirect and 404 return-to-player link now point to `/webpod`.
TanStack regenerated `routeTree.gen.ts`. Connected Chrome verification followed
the actual landing link to `/webpod` and observed the rendered music categories.
All 12 typecheck projects, changed-file lint and 11 policy tests pass.

## Copy and detection follow-up

Owner requested a simpler headline, WebMCP introduction, no surrounding showcase
copy, and a smaller inspiration footnote. Implemented with an icon-only accessible
pause control. `simplified-desktop.png` and `simplified-mobile.png` show the result.
The banner and right footnote now both use the observed `requestPaint` fact;
mount/pageshow refresh the shared report. The 11 policy/storyboard tests pass,
including conflicting/stale presentation-tier cases. Changed-file lint and all
12 typecheck projects pass. Mobile has no horizontal overflow.

Fresh connected Chrome 152 on `/` returned `requestPaint: true`, banner count 0,
and a mounted T1 player. The owner's existing tab was reloaded into real detection.
The earlier false warning was a tab-local test simulation left open for review.
Follow-up missing-API screenshots used a disposable tab, closed in `finally`;
no simulated browser is left open after this follow-up.

- 43 targeted policy/storyboard and mounted player regression tests pass; see
  `evidence/tests.txt`. An additional capability/tier run passed 25 tests (includes
  the same 10 new policy/storyboard tests).
- Typecheck: 12/12 projects pass (`evidence/typecheck.txt`).
- Production client/server build passes (`evidence/build.txt`).
- Changed-file ESLint passes (`evidence/lint.txt`, empty success output).
- Repository-wide lint remains blocked by 309 pre-existing errors in other
  workstreams' evidence scripts. None were changed.
- `git diff --check` passes.

## Browser proof

Used the owner's connected Chrome 152.0.7977.76 through remote debugging and
Computer Use. `/` with its real enabled API showed the live music player.
For the missing-API case, a page-scoped initialization script deleted the
`requestPaint` member before app startup. No browser flags or personal placements
were changed. This simulates the detection gate; other experimental browser APIs
remained available. The preview used zero `canvas[layoutsubtree]` elements and no
mounted player application. Browser page-error collection was empty.

`evidence/browser-results.json` records successful copy, denied-clipboard manual
instructions, accurate recheck status, no horizontal overflow at 390px, and
pixel-identical model screenshots 1+ seconds apart while paused and reduced.
Temporary viewport and media overrides were cleared. A preview tab is left open
for owner inspection; reload restores normal capability detection.

Visual proof: `evidence/front.png`, `back.png`, `mobile.png`, and
`reduced-motion.png`. Front screen and rear stickers stay within the model viewport.
The revised mobile layout shows the device before the headline copy.

## Review disposition

Local code review found no remaining blocker for this scope. Checks covered
resource disposal, hidden-tab cancellation, stationary loop joins, support-first
policy, clipboard errors, context-restoration ownership and mobile overflow.
No independent reviewers were dispatched. Visual taste remains owner-reviewable.
Self-assessment (1–5): setup clarity 4, physical fidelity 4, restrained motion 4,
mobile readability 4. The existing reduced-motion live-player limitation is
documented in `decisions.md`; this work provides a still preview for that path.

## CTA placement and banner copy

Moved the player link out of the masthead to between the showcase and footnote,
renamed it “Lets get playing!”, and centered it at the mobile breakpoint. Removed
the setup eyebrow and changed the experiment heading to “One last pause before
you press play.” Changed-file lint and whitespace checks pass. Chrome confirms
the CTA follows the hero and precedes the footnote, linking to `/webpod`.

## Final owner revisions and verification

The final layout anchors the hero and CTA to the resting model's projected top
and bottom edges. The banner sits above both columns. The teaser uses captures
of the actual Panel with versioned artwork URLs; its straight resting pose uses
a dedicated grazing light rig. Shared rear engraving credits Apple's original
design. Reset uses the existing interruptible orientation spring, while a shared
pack-presence value coordinates DOM and Three.js reveal/dismissal. Reduced motion
now keeps the live player available and snaps physical movement immediately,
superseding the earlier limitation above.

Final validation: 79 focused tests pass across welcome policy, orientation,
sticker presence/lifecycle, engraving, and shader preparation. All 12 TypeScript
projects, changed-file ESLint, whitespace checks, and the production build pass.
Chrome checks covered responsive alignment, front/back preview, Reset settlement,
reduced-motion Reset, and a seeded packet remaining mounted during dismissal then
leaving after settlement. Earlier screenshots document intermediate iterations.

Shader readiness now rejects a disposed captured program before querying it.
Fresh-load/navigation checks did not reproduce the reported invalid-program
warnings. The upstream React Three Fiber Clock deprecation remains visible.
