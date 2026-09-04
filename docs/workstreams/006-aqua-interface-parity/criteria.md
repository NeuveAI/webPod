# Aqua interface parity criteria

## Reference reading

The nine owner photographs are the geometric authority for the iPod 5G LCD. `IMG_2270`, `IMG_2271`, `IMG_2272`, and `IMG_2277` establish list typography, density, selection, chevrons, and the narrow right scroll rail. `IMG_2273`, `IMG_2274`, `IMG_2275`, `IMG_2280`, and `IMG_2281` establish the Now Playing modes: standard metadata and timeline, full artwork, rating, and volume. The attached Now Playing recreation is a secondary dark-theme composition reference. The attached Aqua control sheet is the material reference for blue fills, recessed wells, hard one-pixel rims, cylindrical highlights, and restrained cast shadows.

The existing 272 × 204 authored LCD raster and 21 px title bar remain product constraints. The photographed screen is the visual authority inside that grid: it shows nine complete menu rows in the 183 px content area, so inherited eight-row behavior does not override the reference. Current source is the interaction and state-contract baseline, not the visual baseline.

## First impression of the current UI

The current panel reads as a modern dark dashboard miniaturized into an iPod aperture. The broad navy palette, low-contrast dividers, thin 11 px typography, art-color bloom, rounded scroll geometry, and shadowed album cards conflict with the bright, hard-edged, dense Aqua interface in every major visual layer. The current Now Playing page omits the photographed track-count line, starts content too low, makes title more prominent than the three peer metadata lines, and uses a decorative background bloom absent from the device. The foundations are strong—native raster dimensions, semantic navigation, eight-row behavior, progress states—but the styling needs a system-level rewrite rather than isolated polish.

## Measured acceptance criteria

Measurements below target the authored 272 × 204 CSS-pixel raster. One-pixel details remain one authored pixel before device compositing.

### Global LCD and typography

- Preserve the exact 272 × 204 raster, 21 px header, and 183 px content area on every product surface.
- Light mode is the primary fidelity target: content background reads white or near-white (`#f7f7f4`–`#ffffff`), primary text reads near-black, and structural gray is neutral rather than blue-gray.
- Use a period-appropriate Helvetica/Arial sans stack. At native scale, menu/list labels should render at approximately 13–14 px with medium or semibold weight; the centered header should render at 13–14 px bold. The current 11 px list/header text is visibly undersized.
- Text edges, borders, and gradients must remain legible at 1×. Avoid hairline detail below one authored pixel and avoid blur as a substitute for an edge.
- Dark mode may use a charcoal/blue-black palette, but it must preserve identical geometry, type scale, edge hierarchy, Aqua focus color, and material depth.

### Header/status bar

- Keep the 21 px height. The header should have a subtle vertical light-gray Aqua/metal gradient, a crisp one-pixel lower rule, and only restrained inner highlight—no broad shadow or dark modern toolbar treatment in light mode.
- Center the title optically and use the full 13–14 px bold scale seen in the photos. The left play/pause glyph and right battery must occupy dedicated side zones so title centering does not shift.
- Transport glyph uses saturated cyan/blue. Battery should visually match the photographed beveled capsule: dark outer edge, pale highlight, green charge fill in light mode. It must not read as a generic outline icon.

### Lists and navigation

- Preserve nine fully visible rows below the 21 px header. Rows target approximately 20.33 px each across the 183 px content area and must not be clipped at the bottom. The shared compact viewport constant must also be nine so wheel, keyboard, UI, and WebMCP expose the same visible window.
- Increase label size to approximately 13–14 px while retaining one-line truncation. Primary labels begin 7–8 px from the left edge. Unselected labels are near-black on a bright surface in light mode.
- Remove visible horizontal row separators from ordinary lists or reduce them to effectively imperceptible tonal changes; the hardware photographs read as a continuous white sheet.
- The selected row is a saturated Aqua blue band spanning the full usable list width. It needs a pale top rim, bright cyan upper highlight, a blue mid-band, and darker blue lower edge. Selected text and chevrons are white. The band should be rectangular at list edges, without card radius.
- Chevron geometry is a compact, heavy right-pointing mark aligned approximately 6–8 px from the right content edge. It must have materially more weight than the current thin stroke icon.
- When overflow exists, reserve a narrow 7–9 px right rail. The well is light gray with a crisp dark inner edge; the thumb is saturated blue with a hard edge and minimal rounding. The photographed scroll thumb reads as an Aqua bar, not a pill.
- Preserve the current wheel, ArrowUp/ArrowDown, Enter/select, Escape/Backspace/menu behavior and listbox semantics. Long selected labels may marquee; reduced motion must fall back to stable truncation.

### Now Playing: standard mode

- The composition follows the photographs: header; a queue position line such as `6 of 66`; then a two-column art/metadata block; then progress; then elapsed and remaining time. Restore the count when real queue data supports it rather than inventing data.
- Queue count begins about 8 px from the left and occupies a compact 20–25 px-high band below the header.
- Album art is square, approximately 72–84 px per side in standard mode, aligned left with a light one-pixel outline. Remove the current pronounced drop shadow and art-color radial bloom in light mode.
- Track title, artist, and album are three left-aligned one-line peers, approximately 13–14 px, with 17–21 px baselines. Title may be semibold; artist and album should remain strong enough to match the hardware rather than recede to caption gray.
- The progress channel spans nearly the full content width with 8–14 px side insets and sits below the art/metadata block. Use the Aqua control reference: one-pixel beveled lip, recessed light-gray well, cyan/blue cylindrical fill, crisp highlight, and dark lower seam. The fill must represent the existing playback value exactly.
- Elapsed and negative remaining time use tabular numerals, approximately 12–13 px, and sit directly below the progress channel at opposing edges.
- Scrub mode keeps the same channel material and adds a small cyan triangular position marker. Volume mode uses the photographed left/right speaker glyphs around the same recessed channel.
- Loading preserves the Aqua indeterminate stripe material and `prefers-reduced-motion` fallback. Failure feedback must remain legible without displacing or corrupting the standard geometry.

### Now Playing: secondary modes

- Full-art mode keeps the same header and uses a centered square artwork area sized to the available content, with a crisp edge and no floating-card treatment.
- Queue mode reuses the canonical list styling and nine-row density.
- Existing mode cycling, scrub, volume feedback, queue selection, playback ARIA progress values, and provider-driven artwork behavior must remain functional.

### Other existing surfaces

- Search, settings/account, loading, empty, offline, permission, and error surfaces must use the same Aqua header, bright/dark surface tokens, typography, borders, and focus language. They need not mimic a nonexistent photographed screen, but they must look authored by the same interface system.
- Search inputs and any web controls need a visible label, visible `:focus-visible` treatment, keyboard operation, and sufficient contrast. Preserve the application-level focus ring; `outline: none` is acceptable only with the existing explicit `:focus-visible` replacement.
- Decorative icons remain hidden from assistive technology or live inside correctly labelled status containers. Provider artwork remains decorative where adjacent metadata names the track.

## Highest-priority defects to remove

1. Light mode currently resembles a cool modern theme rather than the iPod's white Aqua LCD: correct the global palette, header, selection, and type first.
2. Header and list labels are set at 11 px, making the interface too delicate and sparse relative to the photographed hardware.
3. Now Playing lacks the queue-count hierarchy and uses art bloom, low-contrast metadata, excess top offset, and a shadowed card treatment that are absent from the reference.
4. The selection and scroll components are rounded, dark, and glassy in a contemporary way; rebuild them with saturated blue, hard one-pixel edges, and Aqua cylindrical shading.
5. Battery and chevron icons are generic thin-line symbols; they need heavier, period-specific optical treatment at the native raster.

## Product routes and evidence

- Canonical product route: `/_spike/device`; `/` redirects there.
- `/_probe/composite` is an existing parity alias and may support regression comparison, but it must not become a separate designed product.
- Before/after evidence must come from the actual device route at desktop 1440 × 900 and mobile 390 × 844. Capture light and dark list states plus light and dark Now Playing states. Also inspect the native `.wp-panel` raster or an equivalent lossless crop so the device scale cannot hide weak pixel work.
- The unauthenticated route exposes real sign-in and status surfaces but not deterministic library/Now Playing content. Use the repository's existing deterministic Playwright MusicKit seam for visual regression evidence where needed; record that provenance. Do not add a proof-only route or synthetic screen.
- Browser inspection in a default automation browser did not render the composited device because the route depends on the Canvas DrawElement browser capability. Use the existing Chrome launch flags in the Playwright suites (`--enable-blink-features=CanvasDrawElement`) for authoritative captures.

## Review gates

- Compare the nine-row list, standard Now Playing, full artwork, volume, scrub/loading, and at least one error/empty state against these criteria at native raster.
- Verify keyboard and wheel navigation, select/back, theme controls, focus visibility, touch/click-wheel continuity, reduced motion, and progress ARIA values.
- Run `bun run typecheck`, `bun run lint`, `bun run build`, and scoped existing panel/composite/browser tests after implementation.
- Reject for any unresolved major mismatch in global palette, header/list density, selection material, Now Playing hierarchy, evidence provenance, or input/accessibility behavior. Minor pixel/color deviations may be disclosed if structure and material language are coherent.
