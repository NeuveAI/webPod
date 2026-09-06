# Contour sticker controls — implementation brief

Design phase before this replacement implementation. The owner's latest contour request supersedes the square HUD; prior reviewed persistence and gesture safeguards remain. Reference screenshot in the scope is a rejection reference, not a visual specification to reproduce.

## Chosen physical relationship

A thin highlight follows the actual die-cut vinyl edge, including irregular contours and holes. Four small rounded crop-shaped white grips sit just outside the art-local corner sectors. They are separate objects, never connected into a rectangular frame. All four rotate the sticker; the sticker body still lifts and moves through the existing peel interaction. A horizontal wear scrubber floats above the selected sticker. A separate compact pair of actions, Peel / return and Reset, sits below or on the nearest clear side. No default panel, resize corner, wear popover or selection-driven device reframe.

A full glass plate was rejected because it obscures the print; an enclosing crop rectangle was rejected because it misrepresents the cut shape. The chosen controls borrow frosted camera/editor controls: white translucent material, restrained blur on grouped surfaces, a readable white edge and soft contact shadow. The vinyl and existing laminated packet remain physical content, not glass. Grips use the same white material language without creating four expensive independent blur layers.

## Geometry and reach

Agreed device contract: `contour(placement)` returns actual projected boundary `paths` (including holes), four boundary `anchors` ordered art-local TL/TR/BR/BL, and the conformed print `center`. Geometry and material ownership stays with the material engineer; app scene glue consumes the frozen helper. Existing `quad` and `beginTransform` remain mathematical inputs only; the quad is never painted.

Each corner retains its own 44 × 44 px target. At small sizes, move the four targets outward from their respective contour sectors, then separate the upper wear track and lower actions. Preserve a clear body-drag region. During a gesture, freeze the chosen side/offset policy; the active grip follows the actual pointer. Visible crop marks remain near their contour sector and contained inside their expanded targets; no connecting stems are painted. Do not silently remove grips or substitute a bounding-box outline if contour data is absent. An unprepared contour temporarily withholds editing affordances while preserving the actual sticker. Test all four targets at width .08 on 375 px, edge placements and rotated art; an actually infeasible layout must be shown to the lead before shipping.

## Movement storyboard

1. **Select:** the actual contour fades in; four grips and the wear/actions group arrive with a short, interruptible spring. No movement of the iPod or sticker.
2. **Hover / focus:** only the relevant control gains emphasis; its real tooltip names the action. Tooltip remains while hovered or focused and can be dismissed with Escape. Touch does not depend on hover.
3. **Press corner:** a small spring compression and rebound gives the requested semi-bounce. The pointer owns rotation immediately, using the captured inverse rear plane and physical width/height angle math. No spring lag in pointer tracking; no hidden resize.
4. **Rotate:** every corner produces the same rotation operation, including continuous crossing of ±180°. Actual contour follows the draft. Existing safe bounds constrain motion without translating the center.
5. **Release:** commit once through the existing expected-source guard at serialized dispatch. The released grip settles continuously to its resting contour offset; a different selection cancels that old visual owner. Pending same-ID lock survives dismissal/reselection.
6. **Wear:** the top native range tracks continuously and previews deterministic scuffs and fraying. Commit once at pointer release or keyboard completion. Escape cancels an active gesture before tooltip dismissal and suppresses any later write from that pointer. Pointercancel ends its lane so subsequent keyboard editing works.
7. **Peel / return:** preserve the current physical lift, adhesive underside, flight and own-seat return sequence, including wear persistence. This is not a delete shortcut.
8. **Reset:** preserve center, size and ownership; set added wear to zero and request upright rotation. Use the existing safe rotation constraint if upright cannot fit at the current center. Tooltip: “Reset wear and straighten”; bound feedback explains “Straightened as far as this position allows.” Never silently move or resize the sticker. Reset is one guarded, undoable edit; the baked-in print distress remains.
9. **Exit / cancellation:** coherent contour and control fade/spring out, interruptible on reselection. Resize, model-pose change, visibility loss and session change cancel the frozen transform. No settled animation loop.

## Accessibility and failure behavior

Every grip, wear track and action has an accessible name and a real hover/focus tooltip, not a `title` substitute. Grip labels identify corner and rotation. Native range and keyboard rotation offer fine control; precise size may remain progressively disclosed by keyboard, never assigned to corners. Escape first cancels an active gesture; otherwise dismisses a tooltip before dismissing selection. Tooltips are hoverable and viewport-clamped.

Modern guidance's interest-triggered tooltip API was investigated. The implementation chooses a controlled lifecycle to coordinate canvas focus and gesture-first Escape: feature-detected manual Popover supplies the top layer, with explicit tooltip semantics and fixed projected positioning as the fallback. Native interest invokers are not claimed to be used. Do not rely on the guide's stale universal claim about anchor-positioning support. No new dependency is necessary solely for tooltip positioning.

Reduced motion removes bounce and autonomous travel while retaining direct pointer feedback. Reduced transparency uses an opaque light surface with no backdrop blur; increased contrast strengthens edges, focus and text. These are measured browser states, not an assumption based on the previous dark HUD. Four target regions, the wear track and actions must not overlap, clip or cover the selected print at desktop or 375 px.

Save failures remain compact and local with a retry/re-edit path; no success banners return. A 409 uses authoritative state and never blindly replays stale changes. Missing canonical source dismisses that selection. Undo must validate the saved after-state at actual dispatch; it cannot overwrite later remote changes.

## Fidelity and evidence gate

First renders precede broad fixture expansion: Soundcheck and Pulse Code, desktop and 375 px, selected, active rotation and release. Reviewer must see actual cut-line following, four rounded white crop grips, top wear and separate actions before visual direction is accepted. Final proof adds all four corner gestures, branch cut, small/edge layouts, hover/focus/Escape, reduced transparency/contrast/motion, reset near bounds, no-write cancellation and guarded persistence.

Material evidence must show original / intermediate / high wear at normal size plus a close-up of true edge transparency. The deterministic mask must agree across front, adhesive underside, hit test, contour and shadows; no per-move texture generation. Preserve worn lift/return/re-stick/reload. Actual route video and enter/held/release/exit frames prove dynamics. Instrumented positive WebGL draw control followed by a stable three-second settled window proves idle cleanup. No source-only visual approval.

## Sources and ownership

Reused in full from the preceding designer phases: `/Users/vinicius/.agents/skills/interface-craft/SKILL.md` and its design-critique/storyboard-animation references; `/Users/vinicius/.agents/skills/interface-design-guardrails/SKILL.md` and all four resources (craft-principles, quality-framework, industry-standards, anti-patterns); `/Users/vinicius/.agents/skills/neuve-motion/SKILL.md` with tokens, principles, reduced-motion and storyboard-integration; global-patterns and jotai-state skills plus `/Users/vinicius/code/agent-context/global.md` and `jotai-react-query.md`.

Requested HIG authority: `/Users/vinicius/code/neuve_effect/.claude/skills/ios-hig/SKILL.md`, visual-design, motion-animation, accessibility, components-patterns, and agent-context/ios-hig.md reused; `liquid-glass.md` read in full for this phase. Foreign branding, iOS-only implementation examples and non-Bun tooling do not override webPod.

Current retrieval: `bunx modern-web-guidance@latest retrieve accessibility`; the requested shorthand `interest-tooltips` was not an existing topic. Search resolved `interest-triggered-tooltips`, retrieved in full. Canonical library sources remain `/Users/vinicius/code/.better-coding-agents/resources/`; installed Three/R3F/Jotai source is the version authority at integration boundaries.

App owner: sticker editor component/model, HUD layout, native fixture and scene contour glue after helper handoff; diary `diaries/sticker-contour-ui.md`. Material engineer: alpha/erosion/projection helpers and contract, StickerSurface integration; no concurrent scene edits. Lead owns scope/handover; reviewer owns independent acceptance. Evidence: `evidence/sticker-contour/{early,final,reviewer}/`. No commits by implementers.
