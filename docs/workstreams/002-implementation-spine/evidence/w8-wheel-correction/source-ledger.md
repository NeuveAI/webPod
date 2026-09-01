# W8 click-wheel correction — external source ledger

This ledger was completed before the correction touched model geometry or
materials. It distinguishes observed OEM hardware from repaired, refurbished,
and provenance-unknown parts. Third-party images are evidence only; no source
asset is shipped by webPod.

| ID | Source | Claimed model / variant | Angle | OEM confidence | Lens / processing caveat | Property supported |
|---|---|---|---|---|---|---|
| A | [Apple archived 5G image](https://cdsassets.apple.com/live/7WUAS350/images/ipod/ipod-classic/ipod-5th-gen.png) | iPod 5G, official black and white product image; front geometry common to thin and thick cases | Straight-on front | **Official Apple render** | Studio/composited product image; anti-aliased boundary; not a material spectrophotograph | Wheel/body and Select/body ratios; absence of decorative center annulus; upper bound on visible wheel and Select seams; black/white material relationships and glyph polarity |
| B | [Stahlkocher, November 2005](https://commons.wikimedia.org/wiki/File:Ipod_5th_Generation_white.jpg) | White iPod 5G; author describes it as own photograph | Shallow front three-quarter | **Contemporary owner photo; likely OEM, not teardown-verified** | Perspective; clipped highlights; unknown white balance | White wheel is cool pale gray, Select remains white, glyphs are light neutral; wheel and Select are nearly coplanar with only narrow seams |
| C | [ATPM 12.05 review](https://atpm.com/12.05/ipod.shtml), [front](https://atpm.com/12.05/images/ipod-video.jpg), [angle](https://atpm.com/12.05/images/ipod-angle.jpg) | Black iPod 5G; article discusses the 60GB unit at the angle | Front and extreme shallow side | **Contemporary review hardware; likely OEM** | Low resolution; direct flash; angle is not orthographic; thick model, so not valid for target body depth | Black wheel, faceplate and Select are three separately readable surfaces; installed wheel and Select are qualitatively near-flush. Not used for the thin rear envelope |
| D | [MobileTechReview 5G review](https://www.mobiletechreview.com/iPod/iPod-video.htm), [side](https://www.mobiletechreview.com/iPod/images/ipod_5G/side.jpg), [rear](https://www.mobiletechreview.com/iPod/images/ipod_5G/back_in_hand.jpg) | Black **30GB** iPod 5G, stated in the review/caption | True-ish side; handheld rear | **Contemporary review hardware; likely OEM** | Very low resolution; hand-held; side has mild perspective | Thin-model flat-front / rounded-steel profile, seam location, rear roll and bottom-corner continuity. Not precise enough for wheel/button millimetre depth |
| E | [iFixit wheel guide 614](https://www.ifixit.com/Guide/iPod%2B5th%2BGeneration%2B%28Video%29%2BClick%2BWheel%2B%2BReplacement/614), [step image 1](https://guide-images.cdn.ifixit.com/igi/u1finrHkgGAZcUDu.full), [step image 2](https://guide-images.cdn.ifixit.com/igi/rBjhmARL3YtLXsmc.full), [step image 3](https://guide-images.cdn.ifixit.com/igi/PSnbgEs4JjiYWbs3.full) | Black iPod Video 5G click-wheel assembly | Detached top and oblique | **Repair-guide device; OEM origin likely but not guaranteed by the guide** | Detached part does not establish installed depth; strong work light | Wheel is one thin annular part with a clean center opening; glyph geometry and black surface response; no decorative center ring is part of the wheel |
| F | [iFixit button guide 611](https://www.ifixit.com/Guide/iPod%2B5th%2BGeneration%2B%28Video%29%2BClick%2BWheel%2BButton%2BReplacement/611), [step image](https://guide-images.cdn.ifixit.com/igi/4ZBsQrNdvmFLNKTB.full) | Black iPod Video 5G center button | Detached oblique | **Repair-guide device; OEM origin likely but not guaranteed by the guide** | Detached part; finger occludes its full edge | Center button is a physically separate flat-faced piece with its own material response; it does not justify a decorative annular bezel |
| G | [Retrospekt refurbished listing](https://retrospekt.com/products/apple-ipod-5th-generation-mp3-player), [black front](https://retrospekt.com/cdn/shop/files/MP-VR-1003_4.jpg?v=1694116778&width=2400) | Refurbished A1136 advertised with 128GB flash storage | Front, front three-quarter, rear three-quarter | **Refurbished; replacement faceplate/wheel/rear provenance unknown** | Studio retouching; modified capacity proves non-original internals/rear marking | Visual cross-check only. Excluded from dimensional and material calibration |
| H | [eBay white A1136 image](https://i.ebayimg.com/images/g/fAUAAOSwYoZnKk0C/s-l960.jpg) | Listing claims white A1136 | Front macro | **Unknown; aftermarket/part mixing cannot be excluded** | Wear, scratches, uncontrolled light and unknown seller processing | Exclusion/control image only. It may show authentic aging but is not calibration truth |
| I | [iFixit replacement-faceplate guide 159192](https://www.ifixit.com/Guide/iPod%2B5th%2BGeneration%2B%28Video%29%2BFront%2BFaceplate%2BReplacement/159192) | 5G receiving a replacement frontplate | Repair process | **Explicit replacement part** | Part supplier and tolerances unspecified | Documents the aftermarket flushness trap; excluded from OEM dimensional truth |

## Cross-source constraints

Measurements are normalized before they reach the model:

- Apple front: wheel diameter `235 / 377 = 62.33%` of body width; Select
  diameter `84 / 377 = 22.28%`. Those dimensions remain unchanged.
- The apparent installed wheel boundary in Apple A and both contemporary
  front photographs C/D is at most a two-source-pixel transition on the 235px
  Apple wheel: `<= 0.85%` of wheel diameter. On webPod's 206-unit wheel, the
  visible radial assembly gap is therefore capped at `1.75` units; production
  targets `1.0` unit.
- The apparent Select boundary in Apple A is at most two source pixels across
  the 84px Select: `<= 2.38%` of Select diameter. On webPod's 74-unit Select,
  the radial gap is capped at `1.76` units; production targets `1.0` unit.
- Apple A, Wikimedia B and ATPM C independently show no broad dark annulus
  around Select. iFixit E/F establishes that wheel and button are separate
  pieces, so the boundary must be empty assembly space—not ring geometry.
- Wikimedia B and ATPM C show the wheel and button near the faceplate plane,
  but their unknown camera angles cannot establish an exact millimetre depth.
  They support bounded relations only: wheel below faceplate, Select below
  wheel, and each offset materially smaller than its visible radial gap.
- Apple A and Wikimedia B agree on the white hierarchy: glossy warm-white
  body, cool pale-gray wheel and white Select. The owner's nine original OEM
  white-5G photographs now outrank both for that colorway and establish that
  the legends are light/white, not medium dark grey. Their uncontrolled warm
  illumination supports relative neutral relationships, not numeric pixel
  sampling. Apple A and ATPM C agree that black is not a simple inversion: the
  wheel is a textured charcoal distinct from both glossy black faceplate and
  darker Select.

## Pencil cross-check

`design.pen` was inspected only through Pencil MCP. Component `VWaJS`
(`Device / Mobile`) currently authors a 330×552 body, 230px wheel, 84px Select,
and `#64748B` white-product legends. It also paints a shadowed Select and wheel
rim as 2D effects. The 330×552 body and 84px Select corroborate existing layout
facts; the OEM Apple ratio supersedes the stylised 230px wheel, and none of the
painted shadows is treated as physical depth or topology.

## Resulting model decisions

- Wheel and front opening retain one 103-unit radius. There is no radial outer
  border mesh; only a 1-unit axial inset creates contact shading.
- The Select opening is radius 38 around a radius-37 separate part. The
  resulting 1-unit empty seam is below the 1.76-unit multi-source cap.
- Select sits 0.5 model unit below the wheel's inner face. This is a visual
  target inside the observed near-flush bound, not an OEM millimetre claim.
- No Select torus, bezel, lip or annular material mesh exists. The Select's
  closed cylindrical side is physically necessary and shares its own material.
- Black uses charcoal wheel `#24292F`, darker Select `#11151A`, and pale ink
  `#B9BFC7`. The white values recorded here were superseded after the owner
  supplied nine originals of their known OEM white 5G; see
  [`owner-primary/source-ledger.md`](./owner-primary/source-ledger.md). The
  colorways remain independently specified rather than inverted.

The matched comparison is
[`reference-current-corrected.png`](./reference-current-corrected.png); its
HTML source names each reference and caveat.

## Explicit uncertainty

No reliable public image in this set is a calibrated macro cross-section of an
assembled OEM 5G wheel. The correction may enforce the observed ordering and
upper bounds, but must not label a sub-millimetre wheel or Select offset as an
OEM dimension. To close that uncertainty, the owner should provide a sharply
focused, near-orthographic macro side photograph of a known-original assembled
5G/5.5G with a ruler or feeler gauge in the same focal plane, covering the
faceplate, wheel edge and center-button edge in one frame.
