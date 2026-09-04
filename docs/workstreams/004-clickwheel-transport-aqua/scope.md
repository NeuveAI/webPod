# 004 — Click-wheel transport and Aqua correction

**Opened:** 2026-09-04
**Target:** owner demo on 2026-09-05
**Status:** Complete — implementation and independent review approved; U14 remains an owner phone-in-hand check.

## Outcome

Make playback and Now Playing operate as one provider-owned click-wheel system:

1. Previous and next control the provider's live queue whenever a playback context exists, including shuffled, playlist, album, library, and ad-hoc queues. With no playback context they retain list paging.
2. Play/Pause remains a transport action from every route. When playback exists it returns to Now Playing and reflects the resulting provider state.
3. Root navigation pauses audible playback, as explicitly requested in the prior repair round, while preserving the current item and provider queue. Transport actions remain context-aware after navigating away.
4. Center on Now Playing cycles through real, reference-backed content states: the standard metadata/progress view, scrub, full artwork, provider queue, and only genuinely implemented rating or lyrics views. Decorative or non-functional shuffle, repeat, heart, star, and queue icon strips are removed.
5. Wheel detents operate the active Now Playing view through shared Jotai state: the standard view adjusts volume, scrub seeks, queue scrolls, and a real writable rating view may adjust rating when the provider truthfully supports it.
6. Overflowing active titles use a restrained iPod-style marquee while remaining clipped with an ellipsis at rest and under reduced motion.
7. Aqua list scrollbars occupy a reserved column beside row content and never overlay the rows.

## Source of truth

- Owner requests and screenshots supplied 2026-09-04, including `image-1.png` at `/Users/vinicius/.codex/attachments/fe734857-db58-4b30-ba34-f572bd2506e5/image-1.png`.
- Provider and interaction contracts in the current repository.
- `docs/workstreams/002-implementation-spine/handover-current.md` and current PM spec only where they do not conflict with the owner's newer request.
- Repository law in `/AGENTS.md`.

## Resolved assumptions

- A playback context exists when the selected provider has a current item or an active loading/playing/paused playback lifecycle. Root navigation pauses it but preserves that authoritative context while browsing elsewhere.
- Previous restarts the current item when playback time is greater than three seconds; at or before three seconds it asks the provider for the previous queue item. Next always asks the provider for the next queue item. The app never reconstructs queue order from the visible source list.
- The center cycle starts at the standard Now Playing view and moves through `scrub -> artwork -> queue`, with `rating` or `lyrics` included only when the active provider truthfully implements them. The standard view owns wheel volume; volume is not a labeled screen. A label-only rate state is not a real control.
- Queue mode is a provider-backed read/browse view. Queue mutation/reordering is outside this deadline slice because no desired wheel gesture was specified.
- Only the click wheel and mapped physical/keyboard actions operate the device. No direct clickable controls are added inside the LCD.
- The repository explicitly says there is no Neuve shell. That repo law overrides the generic orchestration skill's Kanban/Neuve expectation; this workstream is the canonical tracker.

## Guardrails

- No private MusicKit APIs, direct media/license requests, queue reconstruction, autoplay hacks, or simulated playback state.
- No credential contents are read or logged. No changes under `cert/`.
- No `useState`; shared input and rendered state live in the singleton Jotai store.
- No direct `design.pen` access.
- No new animation dependency. Marquee uses transform-based CSS, measured safely, and honors `prefers-reduced-motion`.
- No mode label, instruction chip, or bottom slab such as `Scrub / Use the wheel to adjust`. The active mode must be evident from its reference-backed content or control.
- Preserve user activation and accepted-input feedback semantics. Do not make a rejected or failed provider action look accepted.
- Do not commit in the shared tree.

## Correctness contract

### Transport

- Every next/previous request is delegated to the active provider exactly once.
- The UI uses provider playback/queue results as truth and reopens Now Playing after a successful transport action.
- Previous-at-time behavior is explicit and consistent across fixture and Apple providers.
- Switching provider clears or transfers no stale playback/queue state across providers.
- Rapid or overlapping transport operations cannot let stale completion overwrite a newer provider or selection.

### Now Playing controls

- Center visibly changes the substantive view, not only a mode label or explanatory bar.
- The standard view and scrub consume accepted wheel detents and invoke volume or seek with bounded values.
- Queue is read from `queueRead()` and highlights the authoritative current position. Wheel navigation remains bounded.
- Mode availability derives from the active provider's implemented capabilities.

### Presentation

- No passive action-icon strip, mode chip, or labeled instructional slab appears on Now Playing.
- Standard Now Playing follows the measured geometry of `IMG_2273`: a dedicated count band below the titlebar; non-overlapping art and metadata with reference-like breathing room; and progress/times placed near the bottom without an abandoned lower-third gap.
- Scrollbar track and thumb are structurally beside the list viewport, including split-pane lists.
- Only an active/selected overflowing title marquees. Other rows remain stable. Marquee distance is based on measured overflow, uses compositor-friendly transforms, and becomes static ellipsis for reduced motion.

## Definition of done

- Deterministic tests cover transport routing with and without playback context, previous restart threshold, provider-owned playlist/ad-hoc/shuffle order, mode cycle, wheel volume/scrub/queue behavior, stale async queue reads, adjacent scrollbar layout, marquee overflow/reduced-motion behavior, and Now Playing geometry invariants (counter/title non-overlap, minimum gaps, and vertical use of the LCD).
- Affected TypeScript projects, lint, client/SSR builds, full test suite, and repository gates pass.
- Authenticated Chrome DevTools evidence proves real Apple Music next, previous/restart, pause/resume away from Now Playing, and provider queue metadata without recording user titles, identifiers, tokens, or media/license URLs.
- Browser visual evidence covers each mode against `/Users/vinicius/code/tmp/ipod-reference`, long-title marquee, reduced motion, and overflowing split/non-split lists at canonical LCD dimensions.
- Independent review returns zero Critical and zero Major findings; all confirmed findings are resolved or explicitly accepted by the owner.
