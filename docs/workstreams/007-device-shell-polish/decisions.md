# Decisions

- Direct procedural repair selected: identified decal overhang and geometry normal discontinuity; replacing entire model in Blender would add unnecessary asset complexity before addressing proven causes.
- Remove full-body, double-sided rear composition and fake settings inlay. Real settings are an explicitly opened menu/dialog, closed initially. Keep Reset view outside for convenient rotation recovery.
- Settings may move existing configuration controls inside the dialog. Preserve capabilities and adapt existing browser callers, rather than preserve permanent toolbar layout. Include real appearance, sound and account controls only.
- Existing uncommitted changes at start: apps/web/src/routes/[_]spike.device.tsx; apps/web/tests/deterministic-apple-music.ts; packages/panel/src/{Panel.tsx,aqua-material.test.ts,overflow-marquee.tsx,panel.css}; workstream 006 documents; untracked player-direct-manipulation.e2e.ts, .neuve*, test-results. Preserve all. Only route receives scoped edits over its existing state.
- No Kanban/Neuve per repo law. Scope document is tracker since task tracking tools unavailable.
- Lead in-app browser showed surrounding UI but blank canvas; Chromium-based repository browser checks own visual proof. No model failure inferred from this browser alone.
