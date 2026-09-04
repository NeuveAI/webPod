# Review lanes

## R1 — Playback and queue correctness

- Provider-authoritative next/previous across playlist, album, shuffled, and ad-hoc queues.
- Explicit previous restart threshold.
- Global transport from browsing/root and fallback list paging without playback.
- Concurrency, provider switching, and accepted-input feedback.

## R2 — Shared state and interaction architecture

- No `useState` or component-closure authority.
- Wheel modes use singleton Jotai state and one physical-input path.
- Async queue reads cannot publish stale state.
- Capability-driven mode cycle and real UI changes.

## R3 — Visual and accessibility behavior

- No invented/passive action strip, mode-label chip, instructional slab, or direct LCD controls. Any `Scrub / Use the wheel to adjust`-style treatment is a Major finding.
- Center-cycle content follows the real-device references in `/Users/vinicius/code/tmp/ipod-reference`: standard metadata/progress, subtle scrub control, full artwork, queue, and only truthful provider-backed optional states.
- Standard Now Playing must be measured against `IMG_2273`: reject counter/title collisions, crushed metadata, and the abandoned lower-third gap. Require DOM-bound assertions at the canonical 272x204 LCD size in addition to screenshot judgment.
- Scrollbar beside content at canonical and zoomed sizes.
- Marquee only on active overflowing titles; correct clipping, timing, resize behavior, and reduced motion.
- Keyboard/click-wheel parity, focus visibility, and no pointer-only operation.

## Merge policy

Critical or Major findings block completion. Minor findings must be fixed or explicitly accepted by the owner. The reviewer must reproduce behavior in Chrome DevTools and attach sanitized evidence.
