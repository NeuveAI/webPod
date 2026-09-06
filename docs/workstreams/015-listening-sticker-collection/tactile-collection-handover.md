# Tactile sticker collections

Latest material correction: the designer's [consolidated briefing](tactile-design-brief.md) and [independent goal audit](reviews/goal-completion-audit.md) identified the packet exterior as still lacking the originally requested laminate. That correction is now implemented: coated printed exterior and folds, raw paper interior/cut edges. Actual desktop/phone sealed/open views and native production interactions independently pass on source fingerprint `78f9687938df885fef966c105f25b3a8c6498b5bf1c8fcec2a232598ea6c511e` (376 files). Evidence is in evidence/tactile-pack-laminate/. Earlier source counts and screenshots below remain attributed to their original checkpoint; the collection mechanisms are unchanged.

The rejected text toolbar and single-art wrapper are replaced by genre-specific PLAYWORN paper sleeves and five-sticker release liners. The same sixty approved artwork files and server earning/ownership rules remain authoritative. Mixed starter grants appear in their respective genre collections; future stickers show the actual listening milestones, while placed stickers leave die-cut seats.

Flip the iPod to its back, pull a collection into view and slide its liner out. Browse collections with the adjacent arrows. Hover, focus or tap a sticker for its meaning and earning progress. Peel an earned sticker directly from its seat and drag it onto the backplate. On a phone, the packet lowers after separation to expose the lower rear while the device stays still. Keyboard placement and cancellation remain available.

## Physical construction

The chosen relative is a folded printed paper sleeve, holding a silicone-coated release liner and laminated vinyl. Pencil material study I3j07 compares this with a retail pouch. The sleeve retains its dimensions while the liner moves; matte folded edges, a formed thumb notch, a smooth thin rolled liner corner, separate underside and vinyl coat express different materials. The inserted corner remains flat until it clears the pocket. Partial peeling retains its adhesive contact region, then releases into pointer following; missed and cancelled drops return continuously.

The study and runtime storyboard qinMA are saved in docs/design/stickers.pen. Generated construction illustrations are explicitly labeled illustrations, not manufacturer photographs; referenced images are stored relatively under docs/design/images. Approved printed artwork was not regenerated. Material values are tuned visual analogies, not measured manufacturing simulation.

## Correctness and review history

Independent review caught and corrected tiny reversed flicks borrowing old travel, idle-blur pose changes, stale keyboard sticker identity, return/cancel jumps, misplaced pointer capture, a liner left exposed after closing, interrupted lowered-workspace state, hidden lower-rear placement, premature mobile artwork capture, shrinking sleeve geometry and inserted-corner penetration. Named regressions, actual pointer/touch input, image-pixel checks and independent rendered inspection cover those failures.

All three final independent reviews approve, with no unresolved Major or Critical findings. Flick repair passed 44 unit/source tests and an independent twelve-case actual dev browser suite. The frozen final source passed the native production browser flow with 138 assertions, actual root/app development startup with 3 tests and 2,025 assertions, 22 targeted source tests with 152,111 assertions, root typecheck across 12 projects, scoped lint and diff checks. Browser fixtures use synthetic Apple/signing inputs and temporary SQLite; they do not certify live Apple service availability or physical Safari devices.

Source commits: 2780f87 (flick), 18f440b (physical collections), ee059c5 (Vite runner startup). Final independent source fingerprint: `5ee3af207b4b7f13d1829b88f7936ce6a99ec45e875bf435574b5b023ee298ab` across 374 files. Reviews and credential-free diagnostic evidence accompany this handover. All owned validation processes were closed.

## Development startup

The normal root launch remains Bun with the existing root environment loading and app working directory. During final validation, the bundled Vite config path intermittently stalled before listening. Owned process samples and isolated comparisons are preserved in evidence/tactile-collection. Native loading was rejected because the pinned Bun/Vite combination cached configuration changes. The app dev script now selects Vite's supported `--configLoader runner`. Eight fresh readiness probes, six complete root/app browser launches and an independent root/app run passed. App CSS HMR, main config restart and imported config-helper restart all work in those actual tests. No timeout increase or automatic retry conceals the original failure; production commands remain unchanged.

The startup test now consumes its HTTP probe bodies and waits for SSR after HMR before testing restart. This corrects test-owned response/lifecycle sequencing without dropping assertions. See diaries/startup-runtime.md and evidence/tactile-collection/startup-runtime-verification.json for attribution, rejected alternatives and exact commands.

## Evidence and limits

See diaries/tactile-collection.md, diaries/tactile-material.md, diaries/tactile-flick.md and reviews/tactile-collection-review.md, tactile-runtime-review.md, tactile-flick-review.md. Final browser captures live under evidence/tactile-collection/browser; material and runtime board exports under evidence/tactile-collection/design.

Independent critique accepts physical construction and direct manipulation separately from subjective polish. Paper grain and finish separation remain restrained at normal size, locked art is subdued, and compact captions/navigation have remaining optical refinements. This is not a photorealism claim or an assertion of owner taste approval. Existing browser-specific identity and bounded Apple import behavior are unchanged.
