# Tactile collection design brief

**Status: post-delivery consolidation, 2026-09-06.** This designer-authored brief records the authority, construction and experience implemented in commits 2780f87, 18f440b and ee059c5. It was not written before that implementation. Earlier design direction lived in the owner’s messages, [scope](tactile-collection-scope.md), Pencil explorations and [design diary](diaries/tactile-collection.md). The current completion audit requested this briefing before deciding whether further implementation is necessary. This document introduces no new product scope and does not imply owner taste approval. The completion audit identified one outstanding literal material requirement: protective laminate on the packet itself, in addition to the stickers. The final section defines that bounded correction before implementation.

## Intent and authority

Customizing the back of the iPod should feel like taking a real collectible print from a genre pack and adhering it to a personal object. Listening builds a collection, not a toolbar of selectable pictures. The device and approved artwork lead; controls explain and support their physical actions. The owner’s rejection of the flat wrapper and subsequent request for palpable materials outrank generic interface conventions.

Authority is the latest owner direction, repository AGENTS.md, the [tactile scope](tactile-collection-scope.md), [approved art handover](app-sticker-handover.md), [backend contract](backend-contract.md) and existing shared catalogue. The [final handover](tactile-collection-handover.md) records delivery and verification; the independent [collection review](reviews/tactile-collection-review.md) and [runtime review](reviews/tactile-runtime-review.md) determine engineering acceptance. Subjective enjoyment remains the owner’s judgment.

## Physical relatives and chosen construction

Pencil exploration **mDLRC** compared a pull-out liner, fold-out booklet and fanned envelopes. A booklet adds a hinge action and consumes phone width; a sleeve keeps all five seats together and lets a print leave directly toward the device. Material board **I3j07** then compared a folded paper pocket with a frosted resealable retail pouch. The paper pocket was selected for repeated browsing and customization without reopening a zip closure. A shallow fan suggests neighboring collections; it is not a separate pile-management game.

| Object | Real-world relative and material behavior | Observable design requirement |
| --- | --- | --- |
| Outer sleeve | Printed record-store paper pocket with a restrained matte protective exterior laminate; stiffer than its contents, glued side/bottom folds and raw paper edges | Fixed dimensions, thumb notch, visible rim and fold depth. Exterior coat must respond separately from the raw interior/edge. It must not shrink to reveal contents. |
| Release liner | Thin paper with silicone release coating; smooth waxy face, rougher exposed paper edge | Liner slides through the mouth, retaining overlap. Bow, thin perimeter and a smooth lifted corner separate it from a flat card. Inserted material stays behind the pocket until clear. |
| Sticker front | Printed vinyl with protective laminate | Immutable transparent die-cut artwork; coat catches the existing studio light independently of ink. No rectangular shine outside the alpha mask. |
| Adhesive underside | Unprinted backing of the flexible vinyl | Leading edge curls to expose a warm unprinted surface while the remaining contact stays seated. Free material relaxes; contact with the rear flattens it. |
| Rejected pouch | Flexible clear/frosted film with header/backer and zip mouth | Would require film folds and an opening action before liner access. Those cues are not mixed into the chosen paper construction. |

Primary construction references, previously researched during design: [Avery label layers](https://www.avery.com/custom-printing/resources/what-makes-up-a-label), [Avery release liner](https://www.avery.com/help/article/backing-paper-liner-paper-release-liner-info), [Sticker Mule vinyl and laminate](https://www.stickermule.com/uses/weatherproof-stickers), and [packs versus sheets](https://www.stickermule.com/ca/write/stickermule/sticker-packs-vs-sticker-sheets). These establish material roles, not numeric stiffness, thickness or shader measurements. Runtime values are visual analogies. No claim of measured adhesive physics or photographic reproduction is made.

## Collection taxonomy and meaning

Each accessible genre collection contains **five canonical catalogue seats**, in catalogue order, arranged three above two. Existing names, such as LIVE WIRE and PHASE SHIFT, and all sixty approved PNGs are retained. Access requires at least one owned sticker in that genre. A mixed-genre starter grant can populate several collections; a backend grant is not relabeled as a genre sheet.

| Seat state | Appearance and information | Allowed action |
| --- | --- | --- |
| Locked | Identifiable subdued artwork, milestone and remaining measured listening | Hover, focus or tap for meaning/progress; never peel |
| Sealed, already owned | Artwork with new/open indication | Open the real earned grant before peeling |
| Earned and opened | Full printed vinyl, peel indication | Direct peel or keyboard/detail placement |
| Placed | Vacant die-cut impression with “On your iPod” | Read meaning or return the print to its sheet; no duplicate peel |

The five v1 listening milestones are **5, 15, 60, 180 and 600 minutes**, tested against server policy. Inventory ownership takes precedence: a starter-owned first sticker is earned even with zero observed minutes. Meaning explains whether the print marks an imported Apple Music genre or a measured webPod listening milestone; the detail also gives the sticker name and current state. It does not invent a richer narrative for each illustration or pretend imported history proves listening duration.

## Interaction storyboard

| Stage | User intent and physical response | Continuity requirement |
| --- | --- | --- |
| Tease | Flip to the rear; a small packet lip invites a pull from below | Rear rendering and gesture admission agree; front-side interaction cannot seize the pack |
| Pull into view | Drag the packet upward; responsive settling brings its printed cover into reach | Follow current input, preserve release momentum and allow interruption |
| Open | Activate the sheet-opening surface; liner translates out of the fixed paper pocket | Preserve the actual object proportions and overlap; opening honors persisted grant semantics |
| Inspect | Hover, focus or tap any seat | A dismissible meaning slip shows honest progress; locked information stays focusable |
| Partial peel | Pull an earned print in any direction | Initial release travel bends the leading edge while the adhesive tail remains at its seat; no whole-print translation while supposedly attached |
| Separation | Last contact releases; the print catches up smoothly and follows the held point | No permanent pointer lag, discontinuous jump or accidental reattachment when reversing direction |
| Place | Move onto a valid rear position and release | Preview remains visible at the chosen point, final release coordinates are sampled, native persistence succeeds before the sheet claims placement |
| Miss or cancel | Release outside the rear, lose capture or abandon the gesture | Normal motion returns continuously from the currently displayed pose, including blended rear preview; no teleport or orphaned animation |
| Close | Slide away, or dismiss through keyboard controls | Retract the liner first, then lower the packet to its true tease. Reopening and a front/back round trip cannot retain an exposed liner |

Failed save and superseding selection restore the packet and carry state. An interrupted return must not leave the phone workspace lowered without a held print. Device flick and sticker pointer capture remain separate gesture lanes; a new device grab during pack return is an explicit tested transition.

## Desktop, phone and accessible equivalents

On wide screens the open sheet sits beside the rear canvas. At **375 px** the complete browsing object and close action fit the viewport while the device is reframed upward. Once a print detaches, the packet lowers to expose lower rear positions; the device and carried print stay fixed while that backing moves. Placement must offer a visible range of upper and lower positions, not one specially chosen drop pixel. DOM hit regions share the rendered sheet’s pixel layout, and native touch evidence checks this alignment.

Semantic buttons provide at least 44 px targets. Tab focus exposes meaning; arrow keys position an earned print and Enter confirms it. A preview can be reused only for the same sticker ID, including the detail’s “Stick” action. Escape dismisses meaning first, otherwise puts the packet away. Locked and placed seats remain informationally operable. Reduced motion removes autonomous curl/settling but preserves immediate pointer-following, visible preview, placement and cancellation. These alternatives are equivalent access to the collection, not a replacement for proving direct gestures.

## Identity and backend invariants

The existing browser/device identity remains provisional and separate from MusicKit authorization; this design introduces no stable Apple account identifier or new fingerprint collection. Starter packs derive from imported genres, subsequent unlocks from measured listening. Bun, Effect, Drizzle and SQLite remain behind canonical TanStack Start server handlers. Credentials and server-only Bun imports must never enter executable client modules. Existing bounded import/retry behavior, ownership, idempotent opening, placement persistence and session isolation remain authoritative. Presentation cannot grant stickers, fabricate minutes or change authentication/economics.

## Fidelity acceptance and evidence

Acceptance requires the physical mechanism to be visible under the actual studio rig at normal desktop and phone scale: separate fixed pocket and moving liner; smooth thin curled edge without penetrating the sleeve; shaped laminated print with exposed underside and stationary partial contact; recognizable empty die-cut seat; painted locked art and readable meaning. Flat rectangles with roughness constants, a macro illustration, or DOM stage assertions alone cannot satisfy this bar.

The saved [material study I3j07](evidence/tactile-collection/design/I3j07.png) contains **generated construction illustrations**, explicitly not manufacturer photos or runtime screenshots. [Runtime storyboard qinMA](evidence/tactile-collection/design/qinMA.png) assembles actual captures to explain desktop/mobile spatial changes. Both boards remain in `docs/design/stickers.pen`; linked assets are persisted relatively under `docs/design/images`. Early spatial boards mDLRC, S6zdw and CpEOz are exploration, not final material evidence.

Final actual-route evidence includes [sealed pocket](evidence/tactile-collection/browser/desktop-sealed-sleeve.png), [open five-seat liner](evidence/tactile-collection/browser/desktop-open-sheet.png), [adhesive contact during peel](evidence/tactile-collection/browser/desktop-peel-adhesive-contact.png), [detached print](evidence/tactile-collection/browser/desktop-peel-off-device.png), [375 px sheet](evidence/tactile-collection/browser/mobile-open-sheet.png), [locked meaning](evidence/tactile-collection/browser/mobile-locked-meaning.png) and [visible lower-rear preview](evidence/tactile-collection/browser/mobile-lower-rear-preview.png). The final handover/reviews identify source and build provenance, native 138-assertion production flow, repeated canonical development startup and deterministic geometry/interaction coverage. Synthetic Apple inputs and temporary SQLite do not establish live Apple availability or physical Safari-device coverage.

The independent reviewer accepted construction and interaction with these **nonblocking fidelity differences**: paper fibre and wax-versus-vinyl response remain subtler than the macro study; the adhesive underside is a modest light band at small print scale; locked artwork and captions are subdued; the Electronic subtitle is close to its top artwork; phone collection text can overlap placed art; neighboring packs read chiefly as colored corners. Review facets were identity 4/5, legibility 3/5, restraint 4/5, continuity 4/5 and material credibility 3/5. These observations must not be erased by an approval label.

## Applied design references and chronology

The following already-loaded skills and exact resources informed design and this consolidation:

- `/Users/vinicius/.agents/skills/interface-craft/SKILL.md`, `storyboard-animation.md` and `design-critique.md`: staged physical sequence and critique of observable behavior.
- `/Users/vinicius/.agents/skills/interface-design-guardrails/SKILL.md` and all four `resources/` documents: `craft-principles.md`, `quality-framework.md`, `industry-standards.md`, `anti-patterns.md`: structural exploration, deliberate materials, quality facets and semantic targets.
- `/Users/vinicius/.agents/skills/neuve-motion/SKILL.md`, `principles.md`, `tokens.md`, `patterns/storyboard-integration.md`, `patterns/reduced-motion.md`, `reference-sources.md`: interruptible motion and reduced-motion equivalence. Foreign platform/no-gradient prescriptions do not override the owner’s explicit physical laminate and metal direction.
- `/Users/vinicius/.agents/skills/modern-web-guidance/SKILL.md`, executed first through `bunx --bun` during implementation; `guides/user-experience/interest-triggered-tooltips.md` and `interactive-content-in-3d-scenes.md`: accessible meaning and existing DOM/3D capability boundaries. Ordinary focus/pointer/tap controls avoided an unnecessary experimental interest-invoker dependency.
- Canonical `/Users/vinicius/code/.better-coding-agents/resources/jotai/docs/core/atom.mdx`; installed Three 0.185.1 `MeshPhysicalMaterial.js`, `PlaneGeometry`, `BufferGeometry` and `ExtrudeGeometry`; installed R3F 9.7.0 demand invalidation/disposal sources. No Three/R3F reference checkout existed in the canonical resource directory, so the pinned installed implementation was used.

## Packet-laminate correction brief

The original owner request explicitly includes laminate on **both stickers and stickerpack**. The existing vinyl coat satisfies the sticker side; a waxy liner does not satisfy coating on the outer packet. The completion reviewer identified an uncoated paper sleeve exterior. This is an outstanding requirement, not a nonblocking optical refinement, and the earlier approval does not waive it.

Keep the chosen folded paper pocket, existing printed color/art, proportions, notch, seams and silhouette. Add a restrained **matte protective laminate to the exterior printed paper face**. The exterior should catch a broad, soft coat response under the existing studio rig, distinct from raw, rougher paper inside the mouth and along folded/cut edges. It must still read as coated paper packaging, not glossy plastic, foil or metal. Do not coat all paper surfaces uniformly, bake shine into immutable art, add decorative gradients, or change the release liner to substitute for this requirement.

Verification must visibly compare the exterior face with its raw edges/interior at normal desktop and 375 px scale, using the existing rig and actual sealed/open packet views. A material constant or source assertion alone is insufficient: a controlled with/without-coat comparison may demonstrate the finish change, while final normal product captures must show restrained surface separation without washed-out print, changed color identity or masked die cuts. Preserve the existing opening, inserted-corner clearance and peel/contact regressions; rerun the affected renderer and integrated direct-placement checks after the bounded material change. Independent product-design and engineering review must inspect that evidence before closing this requirement.

A standalone pre-implementation brief was missing as a historical process artifact; writing this document cannot retroactively satisfy that sequence. The current follow-up now has this concrete designer brief before the bounded packet-laminate implementation. All other recorded fidelity limitations and subjective owner judgment remain explicit.

### Final disposition

The correction above was subsequently implemented and independently approved. The printed exterior and folds now use the shared restrained protective coat; interior and cut edges remain rough paper. The first iteration was rejected as too subtle; the accepted iteration visibly produces a broad satin response under the unchanged rig without bleaching the artwork. Final [coated phone view](evidence/tactile-pack-laminate/coated/mobile-open-sheet.png) and [uncoated comparison](evidence/tactile-pack-laminate/comparison-no-coat/mobile-open-sheet.png) distinguish actual runtime from the earlier macro illustrations. The comparison deliberately disables only the coat in an isolated calibration build; it is not the shipped version. See [goal completion audit](reviews/goal-completion-audit.md) for final source identity, independent desktop/phone sealed/open inspection and production interaction validation. The outstanding-language above records the briefing before this correction, not a remaining requirement.
