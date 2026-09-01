# W8 physical-geometry source record

## Declared target

webPod models one housing: the **thin 30GB iPod Video, model A1136, 5th/5.5th
generation**. Its physical envelope is 103.5 × 61.8 × 11mm. The 60/80GB
housing is approximately 14mm / 0.55in deep and is a different rear shell; no
dimension from that variant is used here.

## Sources and what each source is allowed to establish

| Source | Class | Used for |
|---|---|---|
| [Apple model identification](https://support.apple.com/en-ie/103823) and its [linked 5G product image](https://cdsassets.apple.com/live/7WUAS350/images/ipod/ipod-classic/ipod-5th-gen.png) | Primary | A1136/5G identity and straight-on front proportions |
| [Apple launch release](https://www.apple.com/newsroom/2005/10/12Apple-Unveils-the-New-iPod/) | Primary | 30/60GB launch family and 2.5-inch colour display |
| [iFixit front-panel replacement guide](https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Front+Panel+Replacement/610) | Credible repair photography | Plastic-front / steel-rear assembly, seam, clips, and separated-shell construction |
| [iMods 30GB replacement backplate](https://imods.com/products/apple-ipod-video-5th-generation-backplate-30gb-replacement-parts-and-service) | Replacement-part vendor | Thin 0.43in versus thick 0.55in backplate incompatibility |
| [MobileTechReview review](https://www.mobiletechreview.com/iPod/iPod-video.htm) and [side image](https://www.mobiletechreview.com/iPod/images/ipod_5G/side.jpg) | Contemporary review photography/specification | Thin-player envelope and side crown/taper silhouette |
| [Retrospekt refurbished 5G listing](https://retrospekt.com/products/apple-ipod-5th-generation-mp3-player) | Secondary product photography | Front, rear, three-quarter, and edge consistency check |
| `design.pen`, inspected only through Pencil MCP | Repo design authority | 330 × 552 enclosure, 26px corner, 272 × 204 active LCD, and historical stylised front layout |

The following third-party model sources were inspected for provenance but no
geometry, textures, or files were imported: 3DCADBrowser's account-gated
royalty-free model, TurboSquid's proprietary/editorial models, Sketchfab's
generic Classic models, and Wikimedia's CC BY-SA front-view SVG. Their licence
or variant identity was not suitable for silent inclusion in this repository.

## Straight-on measurements and normalized ratios

Apple's linked product image contains a 377 × 629px white-body silhouette. The
anti-aliased boundary makes each measurement uncertain by approximately ±2
source pixels. Measurements are stored as source pixels in
`packages/device/src/physical-spec.ts`, then rounded once onto webPod's 330 ×
552 body grid.

| Feature | Source measurement | Normalized | webPod result |
|---|---:|---:|---:|
| Body W:H | 377:629 | 0.5994 | 330:552 = 0.5978 |
| Active LCD | physical 50.8 × 38.1mm | 4:3 | 272 × 204; 320 × 240 semantic raster |
| Screen top | 27px / 629px | 4.29% body H | 24px / 552px = 4.35% |
| Wheel diameter | 235px / 377px | 62.33% body W | 206px / 330px = 62.42% |
| Wheel centre from top | 444px / 629px | 70.59% body H | 390px / 552px = 70.65% |
| Select diameter | 84px / 377px | 22.28% body W | 74px / 330px = 22.42% |

The final vertical chain is `24 + 204 + 59 + 206 + 59 = 552`: forehead,
active LCD, LCD-to-wheel gap, wheel, and lower margin. The LCD maps to 50.95 ×
38.20mm at the body scale, within 0.15mm of the physical 2.5-inch 4:3 aperture.
The surrounding geometry is deliberately restrained: mask +0.5px per side,
glass +1px, and well +2px. None of those layers resamples or enlarges the live
HTML-in-canvas surface.

## Side profile and explicit uncertainty

The 11mm product depth becomes 58.74 model units. Side/teardown photography
bounds the current profile to a 2.6mm / 14-unit polycarbonate front, a formed
steel rear that occupies the remaining 8.4mm, a 1.6mm maximum rear plan inset,
and a 0.3mm Select recess. Those three profile estimates are labelled
`photoDerivedProfileMm`; they are not represented as OEM drawing dimensions.
The owner's direct correction settles the Select direction and flatness, but
not the exact 0.3mm amount.

No reliable public dimensioned source was found for the exact front/rear depth
split or Select-button recess. The owner was told this immediately and invited
to supply a caliper profile or macro side photograph. The implementation may
be refined from that evidence without changing the declared 30GB envelope or
front ratios.

## Pencil reconciliation

Pencil MCP reported the mobile device component `VWaJS` at 330 × 552, the
screen slot at 272 × 204, and the earlier stylised wheel at 230px. The body,
corner, and exact 4:3 LCD remain authoritative. The owner's later explicit
request for real-product proportions supersedes Pencil only for the front
forehead, trim, wheel diameter/placement, and Select diameter/recess.

## Owner correction and wheel graphics

The owner's profile capture is authoritative for the Select relationship: one
separate, visually flat part slightly below the click-wheel face, with a narrow
physical seam. The old 1.0mm proud estimate is withdrawn. Pencil MCP reports
the authored skip frames at 17×17 on a 230px wheel and separate 15×15 play and
pause frames with a 3px frame gap. Apple's physical straight-on image measures
the skip ink at roughly 22×14px on a 235px wheel. Production therefore uses a
20×13 box on the 206px physical wheel, keeps MENU at 13px, and draws play and
pause separately with a 3.5-unit optical gap.
