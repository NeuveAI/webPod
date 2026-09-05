# Aqua implementation handover

The LCD now follows the supplied hardware references: neutral bright light palette, slate dark palette, larger period type, nine compact rows, saturated edge-to-edge blue selection, hard Aqua rail, green beveled battery, authoritative queue count, square artwork, peer metadata and a recessed progress channel. Physical device shell and provider/security behavior are unchanged.

The renderer's HTMLTexture sRGB bug was fixed on the LCD material only. Shared viewport capacity and heights remain aligned with keyboard/wheel/WebMCP semantics; Now Playing queue active-option IDs now resolve to the rendered instance-scoped option.

Evidence: `before-{desktop,mobile}-{white,black}-{list,now}.png`; final `after-*` matrix and `after-*-lcd-now.png`. `capture.ts` is a reproducible local evidence script using existing product route and test MusicKit provider. Final artwork is a centered 220px square crop of the repository's existing illustration, routed only inside Playwright. Real authenticated Apple playback was not available; timing/queue/playback-state UI checks use the deterministic provider seam. Default Chrome without the experimental flag still cannot render this application's existing HTMLTexture path.

All changes are uncommitted. Initial .neuve-artifact/, .neuve/ and test-results/ were preserved. No signing material, commits, pushes or deployment.

Final implementer gates: `bun run typecheck` passes 11/11 projects; `bun run lint` passes; `bun run build` passes with the existing bundle-size warning; `bun test packages/panel/src packages/state/src packages/composite/src` passes 423 tests. Product browser suites `lcd-fidelity.e2e.ts` and `production-view-parity.e2e.ts` pass 7/7. Scoped panel browser checks for standard Now Playing geometry, wheel navigation, Dynamic Type, and axe/preference behavior pass 4/4. Complete outputs live in evidence. Independent Sol PM review APPROVE is recorded in reviews/aqua-review.md. No unresolved major findings.

## Owner revision handover

All five requested follow-ups are implemented: softer translucent progress/volume edges, actual 2s marquee onset, no accidental selection outside editable controls, immediate aligned optimistic scrub presentation, and subtle unstriped scroll rails. A stale seek-rejection race found during verification is also fixed. No provider/auth changes or dependencies were added.

Revised source is uncommitted above the lead's committed baseline e1a6995. Evidence and full logs are under evidence/revisions. Native channel/volume crops are `channel-{white,black}.png` and `volume-{white,black}.png`; scrollbar top/middle/bottom crops are `scroll-{white,black}-{top,middle,bottom}.png`. `scrub-delayed-samples.json` records delayed-provider presentation consistency. These use the same explicit deterministic MusicKit boundary on the actual product route; the artwork placeholder is intentional in these focused control checks.

Implementer gates: 422 scoped tests, 6 new browser checks, 2 existing density/wheel checks, typecheck 11/11, lint and build pass. Independent Sol revision review APPROVE is recorded in reviews/revisions-review.md, with no Critical/Major findings.
