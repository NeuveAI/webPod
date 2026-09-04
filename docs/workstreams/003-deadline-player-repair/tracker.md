# 003 — Initiative tracker

Repository law uses this file as the operational queue; no external Kanban or invented ticket IDs are used.

**Status vocabulary:** `unblocked` · `dispatched` · `in-progress` · `in-review` · `changes-requested` · `approved` · `owner-validation` · `done` · `blocked`

| id | Slice | Priority | Status | Implementer | Reviewer | Blocked by | Evidence |
|---|---|---:|---|---|---|---|---|
| **D0** | Portable server-side MusicKit key-path/runtime fix | P0 | approved · 0 Critical / 0 Major / 0 Minor | `/root/d0_cert_corrections` | `/root/d0_cert_review` | — | `reviews/d0-cert-review.md`, `evidence/d0-corrections.md` |
| **D1** | Playback identity, artwork/data truth, 700 ms dwell prefetch and idle preparation | P0 | approved · 0 Critical / 0 Major / 0 Minor | `/root/d1_playback_truth` | `/root/d1_playback_review` | — | `reviews/d1-playback-review.md`, `diary/d1.md`, `evidence/d1-*` |
| **D2** | Compact period iPod/Aqua list and scrollbar repair | P0 | approved · 0 Critical / 0 Major / 1 Minor | `/root/d2_aqua_visual` | `/root/d2_visual_review` | — | `reviews/d2-visual-review.md`, `diary/d2.md`, `evidence/d2-*` |
| **D3** | Integration/browser validation across real Apple success and failure paths | P0 | done · authorized library, playback, progress, pause, and fallback paths proved live | lead + owner | D1/D6/D7 reviewers | — | `evidence/d3-integration.md`, `evidence/d3-*.png`, `evidence/d6-*`, `evidence/d7-*`, `evidence/d8-performance-playback.md` |
| **D4** | `THREE.Clock` deprecation warning removal | P1 | blocked · upstream stable release | `/root/d4_three_clock` | n/a (diagnosis only) | stable Fiber scheduler release | `diary/d4.md`, `evidence/d4-three-clock-diagnosis.md` |
| **D5** | Restore static gate 16/16 without weakening diagnostics | P1 | approved · 0 Critical / 0 Major / 0 Minor | `/root/d5_static_gate` | `/root/d5_gate_review` | — | `reviews/d5-static-gate-review.md`, `diary/d5.md`, `evidence/d5-static-gate.md` |
| **D6** | Compact LCD failure shelf + causal developer diagnostics | P0 | approved · 0 Critical / 0 Major / 0 Minor | `/root/d2_aqua_visual` | `/root/d6_error_review` | — | `reviews/d6-playback-error-review.md`, `diary/d6.md`, `evidence/d6-*` |
| **D7** | Complete Apple library pagination beyond the MusicKit v1 default page | P0 | approved · 0 Critical / 0 Major / 0 Minor | `/root/d7_library_pagination` | `/root/d7_library_review` | — | `reviews/d7-library-pagination-review.md`, `diary/d7.md`, `evidence/d7-*` |
| **D8** | Progressive Apple hydration + MusicKit v3 protected playback repair | P0 | done · live protected playback, progress, pause, resume, and provider switch proved | lead | lead evidence review | — | `dispatch/D8-progressive-v3-playback.md`, `diary/d8.md`, `evidence/d8-performance-playback.md` |

## Owner gates

| id | Gate | Status |
|---|---|---|
| **H-1** | Sign in to Apple Music and validate real library/artwork/playback | done · authorized live replay proves metadata, artwork, protected playback, and progress |
| **H-2** | Approve compact LCD/Aqua direction in black and white device colourways | ready · owner-validation |
| **H-3** | Complete the foreground MusicKit v3 approval and verify advancing playback time in Chrome | done · MusicKit and LCD time advanced together |
