# Implementation dispatch

Read `scope.md`, `dependency-graph.md`, `hitl-decisions.md`, and
`research/material-sources.md` in full before editing.

## Assignment

Own the complete P1–P5 implementation. Start from tests that reproduce the two
observed regressions: delayed first navigation and playback loading/progress races.
Then implement bounded prefetch, Apple-only entry, honest SFX readiness, and the
reference-measured visual pass.

## Required method

1. Preserve the shared dirty tree and distinguish existing edits from your work.
2. Inspect every `prepare`, `setQueue`, `play`, `pause`, navigation selection, and
   playback-attempt transition before changing orchestration.
3. Measure the HEIC references and write target logical bounds into implementation
   evidence before final CSS. Do not eyeball spacing.
4. Use immediate typed loading frames, stale-request guards, and a separately tested
   bounded LRU/TTL abstraction. Avoid unbounded module maps.
5. The pending playback UI is the progress track, not a status shelf.
6. Do not claim exact Apple Music seconds buffered; prove the public preparation
   boundary and real cold/warm timings.
7. Exercise the authenticated route with Chrome DevTools MCP if attachable. If the
   shared profile is locked, finish deterministic fixture/browser coverage and flag
   the exact authenticated replay packet for the lead.
8. Write `diary/implementation.md` while working and
   `evidence/implementation-verification.md` before handing off.

## Skill posture

Use the project conventions plus Modern Web Guidance, Interface Craft, Neuve Motion,
and Web Interface Guidelines. Apply modern guidance to behavior/accessibility only;
the supplied iPod evidence owns visual style.

Do not stop at green unit tests. Completion requires measured screenshots, bounded
cache proof, race-order tests, performance timings, and full gates.
