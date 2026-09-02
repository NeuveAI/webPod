# Panel Aqua list evidence

This corrected evidence was generated from immutable source commit
`7bb9906ef40388ebbb5ebc4de2edc4f666e1980d`, tree
`a9394e66c9ce33d422d8fea4cf412c350d99ff53`, on the production
`/_spike/device` route. The browser source fingerprint was
`4d570e7d2d1783b0fe034aa50bf65bcdbfc686eee68ecca9ace51fee8e9b57d0`
across 211 served files.

## Result

- The 8-row main menu has 8 visible rows and no scroll indicator.
- The 11-track album has one indicator, owned by the list pane. The preview
  pane has none.
- The thumb is 8/11 of the authored track and follows the authoritative
  `windowStart` after real wheel events.
- All eight declared album rows fit the 183px list viewport. The selected
  first, middle, and final rows report `contained: true` in both colourways;
  the final row bottom and list bottom agree within the browser's subpixel
  precision.
- A 10,000-row end-state mounts an effective 5px thumb at 170px on the 175px
  track. Its bottom is exactly the track bottom, so the CSS minimum and travel
  equation cannot diverge.
- The recessed track and glossy thumb are separate DOM/CSS layers. The track
  uses a fixed `0 0` stripe phase; pseudo overlays are disabled; only the thumb
  consumes the offset variable.
- The full fixed-coordinate 6×175px track—not a sampled strip—has the same
  SHA-256 at start, middle, and end:
  `c8b2ad542d8191cb293e795d5a24d0b212c357d4e4b2934bc70caa2e0e78d79c`.
  The three complete indicator hashes differ, proving the thumb moved while
  every track pixel stayed fixed.
- Black and white selected rows were captured at rows 1, 6, and 11. Black uses
  a deep graphite/aqua material with white content; white uses a separately
  authored pale ice/aqua material with slate content.
- The Aqua rim is a separate one-pixel DOM layer. The production browser reads
  its effective color as `rgb(169, 239, 255)` in black and `rgb(255, 255, 255)`
  in white.
- Selected metadata renders at opacity 1. Its effective foreground therefore
  preserves the tested 4.5:1 minimum against all three base material stops.
- Executable plants reject flat selection, an effectively transparent rim,
  a moving right-side track overlay, shared foregrounds, `.84` selected
  metadata, 26px clipped rows, and unclamped 10,000-row thumb geometry.

[`summary.json`](./summary.json) records the computed materials, geometry,
selected labels, source observations, and hashes.

## Captures

Production selected-row sequence:

- black: [`first`](./black-selected-first.png),
  [`middle`](./black-selected-middle.png), [`end`](./black-selected-end.png)
- white: [`first`](./white-selected-first.png),
  [`middle`](./white-selected-middle.png), [`end`](./white-selected-end.png)

Indicator movement:

- complete indicator: [`start`](./indicator-start.png),
  [`middle`](./indicator-middle.png), [`end`](./indicator-end.png)
- isolated fixed track: [`start`](./indicator-track-start.png),
  [`middle`](./indicator-track-middle.png), [`end`](./indicator-track-end.png)
- byte-compared full-track aliases: [`start`](./indicator-track-stripes-start.png),
  [`middle`](./indicator-track-stripes-middle.png),
  [`end`](./indicator-track-stripes-end.png)

The non-overflowing production main menu is
[`production-main-menu.png`](./production-main-menu.png).

## Period references

The material direction is grounded in contemporary Aqua descriptions and
captures rather than a generic modern cyan treatment:

- [Macworld Expo 2000 Aqua report and control imagery](https://ascii.jp/elem/000/000/306/306941/)
- [Making It Aqua: Adopting the Mac OS X User Experience (2001)](https://preserve.mactech.com/articles/mactech/Vol.17/17.08/Aug01ADCDirect/index.html)
- [Mac OS X 10.2 Jaguar Aqua widget comparison](https://arstechnica.com/gadgets/2002/09/macosx-10-2/)
- [Apple Human Interface Guidelines archive](https://acko.net/files/zoomer/apple-hig-2008.pdf)

Those references establish the relevant visual vocabulary: color and depth,
glass/gel construction, crisp high-contrast highlights, and a less blurry,
sharper later-Aqua treatment. They do not supply the iPod LCD's exact colors;
the committed tokens are authored for legibility at the fixed 272×204 raster.

## Verification

An exact detached source snapshot at `7bb9906` produced:

- `bun run typecheck`: 11/11 projects clean
- `bun run lint`: clean
- `bun test`: 1,185 pass, 0 fail
- `bun run build`: client and SSR builds clean
- `bun run gates`: 16 automated pass, 0 fail; the standing U14/U15 manual
  checks remain unrelated to this panel slice
- focused panel unit/material tests: 43 pass, 0 fail
- focused panel wheel-navigation browser test: 1 pass, 0 fail
- immutable production-route Aqua evidence test: 1 pass, 0 fail

No owner visual acceptance is claimed here.
