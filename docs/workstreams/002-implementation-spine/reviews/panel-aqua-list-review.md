# Independent antagonistic review — panel Aqua list correction

**Reviewed commits:** `8ed97f4`, `da038da`, `c32fa3d`  
**Review posture:** strict-critique, production-browser evidence, visual inspection, and mutation plants  
**Verdict:** **REQUEST_CHANGES** — 4 Major, 2 Minor

The visual direction is materially better than a flat cyan treatment: the selected row is layered, the scrollbar well and thumb are separate objects, the track groove remains visible, and the black and white authored variants are distinct. Those strengths do not clear the slice. The production viewport and thumb geometry are wrong in owner-visible states, two binding material invariants have green plants, and the dark selected metadata misses the contrast claim made by the evidence.

## Major findings

### Major 1 — the declared 8-row album viewport only fits seven rows, so the selected end row is clipped offscreen

`AlbumTracks` renders `frame.visibleRows` rows and passes that same value to the indicator (`packages/panel/src/Panel.tsx:298-312`), but `.wp-track-list` is 183 px tall while every `.wp-track-row` is 26 px tall (`packages/panel/src/panel.css:137`, `packages/panel/src/panel.css:147`). Eight rows require 208 px. The contract, thumb ratio, and actual viewport therefore disagree.

On the production route at 2× raster scale, after opening the 11-row album and moving to row 11, I measured:

```text
listTop=218, listBottom=584
selectedTop=582, selectedBottom=634
selectedHeight=52, intersection=2
visibleRows=8, windowStart=3, thumbSize=72.727%
```

Only 2 of 52 rendered pixels of the current row intersect the list. The committed `black-selected-end.png` and `white-selected-end.png` visibly show rows 4–10 with no Aqua selection at all. The end-state browser test only finds the offscreen DOM node and reads its computed style (`apps/web/tests/list-scroll-indicator.e2e.ts:147-163`); it never asserts that the selected row is visible or contained by the list viewport. Consequently, the claims that the evidence covers the selected end row (`docs/workstreams/002-implementation-spine/evidence/panel-aqua-list/README.md:15`, `docs/workstreams/002-implementation-spine/evidence/panel-aqua-list/README.md:24`) are false as visual claims.

This is not a screenshot nicety. The indicator says 8/11 while the owner can see only seven complete rows, and wheel navigation leaves the current item outside the usable viewport.

### Major 2 — the minimum thumb size is absent from the travel equation, so very long reusable lists lose the thumb at the end

`listScrollGeometry` computes both size and offset entirely in percentages (`packages/panel/src/list-scroll-indicator.tsx:21-24`), while CSS independently imposes `min-block-size: 5px` (`packages/panel/src/panel.css:130`). Once the ratio-produced thumb is smaller than 5 px, the offset still travels as though the thumb had its sub-pixel proportional size. The real thumb then overflows and is clipped by the well at the end.

Using the production CSS with `totalRows=10_000`, `visibleRows=8`, and an authored 175 px well produced:

```text
requested size = 0.080%
requested offset = 99.920%
rendered track height = 350px at 2×
rendered thumb height = 10px
rendered thumb top = 349.71875px
visible thumb at end = 0.28125px
```

The pure-function length sweep stops at 120 and never mounts the CSS-constrained thumb (`packages/panel/src/list-scroll-indicator.test.tsx:36-47`). This fails the stated reuse requirement for future artist, playlist, album, track, and search result lists. A minimum-size thumb must participate in the same geometry that determines its travel; a CSS-only minimum and ratio-only offset cannot remain independent.

### Major 3 — the stationary-groove and selected-row-rim gates are not load-bearing

Two distinct owner-requirement violations survive both the focused suite and the production browser evidence:

1. I added a later `.wp-list-scroll__well::after` layer over the rightmost 4 px of the 6 px well and made its stripe `background-position` consume `--wp-list-scroll-thumb-offset`. The focused 28 tests and exact production Playwright run both stayed green. The static test parses only the base well rule (`packages/panel/src/aqua-material.test.ts:139-149`). The browser proof hides the thumb and captures the full well, but hashes only the first third of its width (`apps/web/tests/list-scroll-indicator.e2e.ts:167-227`). Moving pixels in the unoccluded remainder are therefore unproved. This directly contradicts the evidence claim that track pixels are fixed outside thumb occlusion (`docs/workstreams/002-implementation-spine/evidence/panel-aqua-list/README.md:17-23`).

2. I added a later cascade override, `.wp-panel { --wp-selection-top-rim: transparent; }`. Again, all 28 focused tests and the production browser test stayed green. The static test sees the earlier token declaration and the browser assertion merely counts gradient functions; neither verifies the computed/effective rim. This disproves the statement that the executable plant rejects top-rim removal (`docs/workstreams/002-implementation-spine/evidence/panel-aqua-list/README.md:29-30`).

Both are central to the binding requirement that Aqua be layered rather than color-only. A proof that samples a cherry-picked strip or checks an overridden declaration is not evidence of the rendered material.

### Major 4 — dark selected metadata does not meet the evidence's AA contrast claim

The selected row foreground itself is white in the dark variant, but `.wp-row-meta` applies `opacity: .84` even when it inherits that foreground (`packages/panel/src/panel.css:135`). The contrast test checks the opaque token value against the base stops and only asserts that metadata contains `currentColor` (`packages/panel/src/aqua-material.test.ts:116-129`). It never alpha-composites the metadata as rendered.

For the dark Aqua layers, the relevant contrast changes are:

```text
white vs #247f9b: 4.581:1 opaque, 3.734:1 at 0.84 opacity
white vs #0d7393: 5.397:1 opaque, 4.310:1 at 0.84 opacity
```

The 11 px duration/count metadata is normal-sized text, so those portions fail 4.5:1. The evidence statement that every authored selection foreground clears 4.5 and that metadata inherits it (`docs/workstreams/002-implementation-spine/evidence/panel-aqua-list/README.md:27-28`) omits the opacity that changes the rendered color. This is visible-interface correctness, not a theoretical token objection.

## Minor findings

### Minor 1 — “dynamic length changes” are not exercised as dynamic changes

The test calls the pure geometry function independently with `[0, 4, 8, 9, 120]` (`packages/panel/src/list-scroll-indicator.test.tsx:36-47`). It does not rerender one mounted indicator across changing totals/window starts or replay a production transition. The component is currently stateless, so this is not evidence of a present stale-state bug, but the proof does not establish the claimed runtime behavior.

### Minor 2 — the new exported component lacks the required API documentation

`ListScrollIndicator` is exported without TSDoc (`packages/panel/src/list-scroll-indicator.tsx:29`). The workstream contract requires exported functions to document their reusable contract. That matters here because the component is explicitly intended for future list surfaces.

## Mutation ledger

| Plant | Result | Disposition |
|---|---:|---|
| Render the indicator when `totalRows <= visibleRows` | 3 failures | Gate is load-bearing for 8/8 and underflow absence. |
| Move the indicator into the preview pane | 1 failure | Ownership gate is load-bearing. |
| Make thumb size a flat 50% | 2 failures | Basic proportionality gate is load-bearing. |
| Flatten the thumb to a cyan fill | 1 failure | Thumb material gate is load-bearing. |
| Flatten the selected row with a later cascade | Unit test stayed green; production browser failed | End-to-end computed-gradient check catches this variant. |
| Move a right-side well stripe layer with thumb offset | **28/28 focused pass; 1/1 browser pass** | **Green; Major 3.** |
| Remove the effective top rim with a later cascade | **28/28 focused pass; 1/1 browser pass** | **Green; Major 3.** |
| Use one wrong foreground for both variants | Fails the existing mutation and production computed-color comparison | Variant foreground gate is load-bearing at token level. |
| One-row list | Indicator correctly absent | Correct. |
| 10,000-row list at end | Only 0.28125 rendered px of the 10 px thumb remains visible | **Production geometry defect; Major 2.** |

## What reproduced and remains clean

- Exact production-evidence replay passed 1/1 and generated byte-identical PNGs and summaries from immutable source commit `c32fa3d`; the defect in Major 1 is present in both the committed and fresh evidence, not an attribution mismatch.
- The 8/8 main menu has no custom indicator. The 11/8 album list owns it inside the list pane, not the preview pane.
- The well and thumb are separate DOM/material layers; the authored base well stripe position is fixed and does not consume the thumb offset.
- Start, middle, and end movement is driven by actual wheel detents in the production route. There is no native scrollbar exposed.
- The inspected black and white first/middle selected states are crisp and visibly layered rather than flat cyan. Both colorways are intentionally authored. The older both-colourway aesthetic call remains owner-only and is not waived by this review.
- The changed production code adds no timer, animation loop, or idle frame work. Existing reduced-motion, pointer lifecycle, SFX, and detent paths are untouched.
- `bun run typecheck` passed 11/11, repo lint passed, `bun test` passed 1152/1152, client and SSR builds passed, and automated gates passed 16/16. Manual U14/U15 gates remain manual.
- The reviewed commits are trailer-free and `git show --check` is clean.
- The live `rasterScaleMultiplier` change in `packages/panel/src/Panel.tsx` is a separate dirty hunk. None of the three reviewed commits contains or overlaps it; this review does not disposition that work.

## Final disposition

**REQUEST_CHANGES.** Major 1 and Major 2 are owner-visible production geometry failures. Major 3 shows that two binding appearance claims can regress while every stated gate remains green. Major 4 invalidates the rendered contrast claim in the dark variant. All four require correction and new falsifiable evidence before this slice can be approved.

# Correction response — Aqua list review

**Implementation under response:** `7bb9906ef40388ebbb5ebc4de2edc4f666e1980d`

The original review above is retained unchanged. Each finding is addressed as
follows:

1. **Major 1 — closed.** Album row height is now derived from the fixed 183px
   list viewport and the authoritative visible-row count. Compact remains the
   state-owned eight-row viewport; each row is 22.875px and all eight fit.
   Static and virtual lists use the same equation. The production browser test
   measures list and selected-row bounds at first, middle, and end in both
   colourways and requires complete containment. Replanting 26px rows fails at
   the final-row containment assertion.
2. **Major 2 — closed.** `listScrollGeometry` computes effective thumb size in
   the authored 175px track, applies the 5px minimum before calculating travel,
   and publishes pixel size/offset from that one result. At 10,000/8/end the
   mounted component emits 5px/170px, and real CSS places the thumb bottom
   exactly at the track bottom. Removing the clamp makes two focused tests red.
3. **Major 3 — closed.** The selection rim is a structural one-pixel child,
   no longer a custom-property stop inside the background. Browser evidence
   verifies the effective computed rim color and size. Well pseudo-elements are
   structurally disabled, a static gate rejects any second offset consumer, and
   the browser proof hashes the complete isolated 6×175px well. The three full
   hashes are identical. Replaying an effective moving overlay and an effective
   transparent rim makes the production browser test red at the computed layer
   assertions.
4. **Major 4 — closed.** Selected metadata now renders at opacity 1. The unit
   gate alpha-composites the effective text color against each authored material
   stop and the browser asserts computed opacity. Replanting `.84` fails both
   forms of proof.
5. **Minor 1 — closed.** One mounted component is rerendered through totals
   120 → 4 → 10,000 and changing window starts. It transitions from proportional
   geometry to absence to minimum-clamped end geometry without remounting.
6. **Minor 2 — closed.** `ListScrollIndicator` now has TSDoc immediately at its
   export; a focused source gate protects that placement.

## Replayed plants

- Combined 26px-row / moving-overlay / transparent-rim / `.84`-metadata plant:
  focused result **4 fail, 21 pass**.
- Unclamped 10,000-row thumb plant: focused result **2 fail, 5 pass**.
- 26px-row plant in production browser: **1 fail**, at selected-row containment.
- Moving right-side overlay in production browser: **1 fail**, at computed
  `::after` content/display.
- Transparent structural rim in production browser: **1 fail**, at computed
  rim color.
- `.84` selected metadata in production browser: **1 fail**, at computed
  metadata opacity.

After every replay the source was restored. The immutable-source production
evidence pass and corrected captures live in
`evidence/panel-aqua-list/`; no owner aesthetic approval is claimed.
