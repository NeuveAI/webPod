# Display border and UI fidelity

Owner asks wider gap between front frame and screen based on reference photos, and says x-of-y does not exist / keep UI strictly iPod. Lead inspected /tmp/webpod-front-reference/IMG_2270.png, IMG_2274.png, IMG_2280.png (decoded originals outside repo). References clearly have wider black LCD surround than current thin hairline. IMPORTANT: IMG_2280 visibly has '1 of 947' on Now Playing, contradicting premise that counter absent. User clarification pending; do not delete counter until answer. Follow latest answer. No invention/unsupported broad UI redesign.

Geometry engineer owns packages/device/** display surround/aperture/layout changes only and directly related tests. Measure approximate border-to-active-screen ratio from references, preserve active320x240 aspect and native UI mapping, stable flat border/corner shape at front and quarter. Do not crop displayed content, create occluding bevel, distort texture, or change accepted lights/backplate/materials/hardware. Capture before/after same-state integrated UI at front/quarter and both finishes.

UI investigator settings agent read-only initially: inspect remaining reference images for NowPlaying/menu spec and compare current UI, report supported discrepancies relevant to shown surfaces. No code until counter clarification. If counter removal requested own packages/panel narrow change/tests, preserve unrelated dirty changes. Lead handles ambiguity; no unrelated feature removal.

Reviewer independently verifies visual border and UI response, no repeat009 warp, geometry/hit mapping/disposal/size contracts. Meaningful affected tests, package/app typecheck/scopedlint, bounded native panel interaction check if layout mapping changes. No broad unrelated suite absent cause. Evidence/docs here only, preserve all prior dirty work; bun only, no cert/design.pen, no useState, no commits.

## Confirmed UI scope addition
Read-only investigation of all9photos corroborates queue counter in IMG_2273/2275 (6of66) and IMG_2280/2281 (1of947); full artwork IMG_2274 correctly omits it. Removal remains pending owner clarification. Two reference-supported mismatches authorized for settings engineer: Artists/Songs browsing titlebars should retain current transport play/pause indicator (IMG_2270/71/72/77); global Songs rows should be title-only (IMG_2277), not artist secondary lines. Do not remove secondary information globally or extrapolate root category counts/dark theme without reference. Preserve playback state semantics and other row layouts.

## Authorized narrow UI fidelity update

Lead authorized browse headers retaining actual play/pause state (IMG_2270/2271/2272/2277) and global Songs title-only rows (IMG_2277). Settings engineer owns Panel.tsx and related focused tests. Preserve album/search sublabels, Now Playing count pending owner answer, queue and playback behavior. Investigation and conditional counter plan in ui-investigation.md.
