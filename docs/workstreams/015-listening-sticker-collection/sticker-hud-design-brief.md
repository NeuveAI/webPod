# Sticker transform HUD — replacement brief

2026-09-06. Designer phase, before the replacement implementation. The owner rejected the previous contextual panel; its visual acceptance is superseded. This brief replaces the panel, property tabs, Move button, Apply/Revert workflow and mobile dock in `sticker-editor-design-brief.md`. It retains durable owned wear, guarded writes, quiet routine feedback and the existing physical peel/press/return experience. Scope: `sticker-hud-scope.md`.

## Critique and choice

The owner's c4fb6b49 screenshot shows controls as a large separate destination: a title, three tabs, repeated property label, range and text actions compete with the print. The interface asks the user to translate a spatial adjustment into a form. Merely shrinking that panel would preserve the wrong interaction.

Three arrangements were considered: a radial tool wheel (compact but hides the print and obscures resize/rotation meaning); a miniature floating inspector (still the rejected form); and a projected transform frame with a few outboard controls. Choose the transform frame. The sticker remains the working surface. Corners communicate size, an external curved-arrow grip communicates rotation, and its opaque body remains directly draggable. A small neutral icon group offers wear, return and one Undo. No title block, persistent instructions or selection-induced camera movement.

## Geometry and reachable controls

The frame follows the actual visible-art quadrilateral, including sticker rotation, rear curvature and current camera/model pose. Use `projection.quad(placement)` with UV-ordered TL/TR/BR/BL, center and edge midpoints; an axis-aligned bounding rectangle is insufficient. A thin light outline with a dark contrasting under-stroke stays legible over both ink and polished metal. Small grips sit outside the ink. This is functional transform geometry, not an ornamental card around the object.

At generous sizes, expose corner resize grips and one outside rotation grip connected to the nearest usable edge by a short stem. Pointer cursors and curved-arrow/diagonal-grip symbols distinguish the operations. Edge-adjacent rotation is a visible target, not an invisible arbitrary hot zone. The opaque body stays available for movement; transparent corners retain blank-rear flick behavior outside explicit HUD controls.

Every handle/control has a distinct 44×44 CSS-pixel hit region. For a small print, do not stack four overlapping corner targets: show one resize grip and one rotation grip, displaced outward on different sides with thin connector stems back to their true corner/edge. Choose the pair and icon-group side using measured viewport clearance and pairwise rectangle exclusion, preserving a clear body-drag area. Additional corners are decorative only when their targets cannot fit. The projected outline never expands to misrepresent the print. At an edge, choose a different corner/edge before moving controls farther outboard; clamp controls inside the safe viewport and retain connectors. This is the same HUD on desktop and 375px, never a bottom dock or a second panel. Layout stays fixed for the duration of an active gesture.

The icon group sits on a free side outside both print and handles. Wear opens only a short, labelled Original–Worn native range near that icon. A small precision disclosure provides labelled angle/size values for keyboard and touch users who prefer exact adjustment; it is closed initially and never becomes a permanent three-property inspector. Tooltips appear on hover/focus; all icons have accessible names. Return uses the existing physical trip to the owning sheet. Undo is available only after a completed editable customization with a valid guarded inverse. Dismiss through blank space/Escape; a close icon may appear with the expanded precision control, not as a permanent extra row.

## Gesture and persistence statechart

`idle → press candidate → selected → transforming → saving → selected`

Alternates: `press candidate/selected → carried → pressing/returning`; `transforming → cancel → selected`; `saving → recoverable failure`; any state → session invalidation → idle.

- Tap opaque art selects without lifting or writing. Existing deliberate body-drag threshold begins physical pickup from the original grab point. Selecting an already selected sticker does not reopen a form. Handle pointer capture owns its gesture and cannot trigger body pickup or device flick.
- On handle down, capture canonical source, revision, pointer, physical center and a frozen `projection.beginTransform(placement)` mapping from client pixels to the selected rear plane. It must work beyond the physical rear, where outside handles live. Direct input updates the draft and projected frame on the next render; no spring trails the pointer.
- Rotation uses BODY_W/BODY_H physical units, incremental unwrapped atan2 deltas across ±180°, and rejects degenerate zero-radius input. Resize uses a uniform radial ratio at fixed center and preserved aspect ratio. Neither silently translates the sticker to fit. Existing rotated safe-zone/width validators constrain the requested change; retain the last valid boundary pose and briefly show the current numeric value beside the active grip. No repeated error paragraph at a bound.
- Pointer up commits one complete guarded mutation if the pose changed. Native range input previews continuously and commits on release; keyboard repeat previews as one gesture and commits on keyup/focus completion. Enter commits a typed precise value. No explicit Apply button. Escape/capture loss cancels an unsent gesture and restores its captured source without a write. Viewport/model pose changes, flip, visibility loss and teardown cancel the frozen mapping rather than reusing stale geometry.
- During a sent write, retain the one visible draft until acknowledgement and show a small local pending mark. Do not admit another edit to that same sticker until its authoritative outcome is known; selection elsewhere and dismissal remain usable. Success rebases the local source to the canonical response and enables one Undo. No success banner or checkmark ceremony.
- Save dispatch must compare expected source inside the existing serialized write, not only before enqueue. Session/generation changes prevent stale continuations reopening selection. An already sent outcome still reconciles canonical inventory even after dismissal.
- Ordinary failure restores the authoritative visible placement and retains the attempted pose privately for a compact `Couldn't save · Retry` recovery beside the sticker. Retry is another guarded intent, not an automatic overwrite. A 409 displays the reconciled placement and `Changed elsewhere` with deliberate re-edit; no automatic retry. Dismissed failure remains reachable as a small local recovery affordance.
- One Undo captures the previous complete placement/owned wear and the successful canonical result it reverses. Undo is itself guarded against that exact current source at actual dispatch. A newer remote/source change invalidates it. It cannot silently overwrite later work. Return/re-stick continues to preserve owned wear; placement rotation/size semantics remain unchanged.

## Dynamic storyboard and material rationale

The HUD is a temporary precision tool hovering over laminated vinyl, not another paper object. Preserve the existing satin packet, release liner and scuffed vinyl renderer. Restrained neutral control material, a slight shadow and one grouped translucent surface distinguish tools from the print; opaque and increased-contrast variants remain fully usable. No new sound, haptics, shader effects or perpetual ornament.

| Stage | Visible cause and response | Ownership |
| --- | --- | --- |
| Select / enter | Frame resolves from a slight inward offset to the true quad; grips spread outward a few pixels and icon group lifts/fades into its local position. Art and iPod remain stationary. | One interruptible HUD presence spring, Neuve responsive 300/25 starting point. |
| Rest | Thin frame and grips settle; no idle RAF, pulse or floating animation. | Exact current projection. |
| Handle down | Active grip compresses slightly, other tools recede, brief angle/size readout appears. | Neuve snappy 400/30 for grip feedback only. |
| Transform | Art, outline and active grip follow the actual pointer immediately; no easing on manipulated coordinates. | Captured transform map and Jotai draft. |
| Release | Grip relaxes, readout recedes and tools return while the final draft awaits guarded save. No pose bounce. | Short interruptible responsive/snappy settle. |
| Body pickup | HUD withdraws as the real print lifts from the rear; approved adhesive curl and press remain continuous. | Existing physical carry owner. |
| Dismiss / switch | Frame contracts slightly toward the old print and fades promptly; new selection can enter immediately without waiting for old exit. | Retarget from current animated values, no queued entrance delay. |

Reduced motion removes autonomous spread/scale/lift and uses immediate presence or a brief opacity-only change. Direct pointer feedback, selection contrast, focus and errors remain. Central named motion constants and an Interface Craft storyboard comment must match implementation. These tokens are starting points, not evidence: actual enter/interact/release/exit frames and interruption sequences determine whether it feels dynamic and precise.

## Keyboard and equivalence

Enter/Space selects the focused placed sticker. Tab reaches resize, rotate, wear, return and enabled Undo in a stable order. Focused transform handles support arrow adjustment with accessible value feedback; Escape restores the active adjustment. A progressively disclosed precise native input/range remains available without dragging. The focused sticker body supports the existing arrow-based move/Enter-to-place/Escape-to-return flow without a visible Move button. No HUD key reaches shell flick handlers. Focus returns to the selected sticker on dismissal; session loss removes stale targets. Handle symbols, readable tooltip labels and focus rings convey meaning without color alone.

## Acceptance before delivery

First render review precedes long test expansion: show actual selected normal-size rotated art at desktop and 375px, with no panel/dock and no model movement on selection. Then inspect enter, active rotation, release and exit frames, not just a final rectangle. Verify minimum-width .08 stickers and edge positions: pairwise hit-region exclusion, reachable rotation/resize, unclipped icon group and usable body drag. Real touch/mouse must hit the visible grips and rotate through ±180 without jump, resize at bounds without center drift, and cancel cleanly on capture/viewport changes.

Native route/cookie/SQLite proof must cover automatic single write per gesture, keyboard equivalents, one-copy preview, wear/Undo/return/re-stick/reload, delayed write/dismiss/409/session replacement and local failure recovery. Preserve actual colored-ink and shader-error checks. Re-run restoration and diagnose the outstanding old collection-regression timeout; its previous run timed out after the mobile-keyboard-stuck artifact, and the exact blocking await is not yet proven. Do not erase it or raise timeouts to claim a pass. Previous material evidence is reusable only when its source remains unchanged; old panel screenshots are explicitly rejected UI history.

## References and ownership

Modern Web Guidance was executed first for this replacement with `bunx modern-web-guidance@latest search 'Direct manipulation image editor resize rotate handles accessible pointer capture touch targets' --skill-version 2026_05_16-c5e78707`, then `retrieve forms`. Applied semantic native controls, labels, focus and input/commit distinction; direct manipulation is not converted into a conventional form merely because that search returned form guidance. Scope's 44px minimum is supplemented by actual non-overlap testing.

Reused fully read Interface Craft SKILL, design-critique and storyboard-animation; Interface Design Guardrails SKILL and all four resources (craft-principles, quality-framework, industry-standards, anti-patterns); Neuve Motion SKILL, principles, tokens, reduced-motion and storyboard-integration; global-patterns/Jotai skills and referenced agent-context global/Jotai guidance. Newly read `/Users/vinicius/code/neuve_effect/.claude/skills/ios-hig/SKILL.md`, motion-animation.md, visual-design.md, components-patterns.md, accessibility.md and `/Users/vinicius/code/neuve_effect/agent-context/ios-hig.md`. Repo/user authority overrides foreign branding, iOS-only assumptions, mandatory unrelated components, useState examples and sound/haptics suggestions.

App owner: replacement sticker-editor UI/model, collection arbitration, production scene glue, removal of obsolete dock/reframe code and tests; narrow scene glue only after geometry handoff. Geometry engineer: actual quad/frozen inverse-plane contract/helper and deterministic math tests. Existing guarded runtime and durable owned-appearance contracts remain authoritative; no server/schema redesign. Canonical local Three/R3F/Motion/Jotai sources must ground changed APIs. Lead owns scope/handover/commits; independent reviewer gates the brief, first actual HUD and final behavior. No product source changed during this brief phase.
