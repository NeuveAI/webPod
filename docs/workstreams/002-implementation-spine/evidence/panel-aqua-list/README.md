# Panel Aqua list evidence

This evidence was generated from immutable source commit
`da038dab6b5bdc696e7dd64f9d2002b8270ea32d`, tree
`af0a323bdf3d1b20e537c29e06a240b44eefbad9`, on the production
`/_spike/device` route. The browser source fingerprint was
`d17d1401bf60daee0394673a3a6139869c0bdfb726dc8a5a1a501849cba8c829`
across 211 served files.

## Result

- The 8-row main menu has 8 visible rows and no scroll indicator.
- The 11-track album has one indicator, owned by the list pane. The preview
  pane has none.
- The thumb is 8/11 of the authored track and follows the authoritative
  `windowStart` after real wheel events.
- The recessed track and glossy thumb are separate DOM/CSS layers. The track
  uses a fixed `0 0` stripe phase; only the thumb consumes the offset variable.
- The fixed-coordinate stripe sample has the same SHA-256 at start, middle,
  and end:
  `1a76b45b74248681718d3328875b4e16ff9407d1cb0b3d5f418dec31f4dcfaa8`.
  The three complete indicator hashes differ, proving the thumb moved while
  the sampled track pixels did not.
- Black and white selected rows were captured at rows 1, 6, and 11. Black uses
  a deep graphite/aqua material with white content; white uses a separately
  authored pale ice/aqua material with slate content.
- Every authored selection foreground clears 4.5:1 against all three base
  material stops. Metadata, row numbers, and chevrons inherit that foreground.
- Three executable plants reject a flat one-color selection, removal of the
  1px top rim, and a shared unsuitable foreground.

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
- byte-compared stripe samples: [`start`](./indicator-track-stripes-start.png),
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

An exact detached Git worktree at `da038da` produced:

- `bun run typecheck`: 11/11 projects clean
- `bun run lint`: clean
- `bun test`: 1,152 pass, 0 fail
- `bun run build`: client and SSR builds clean
- `bun run gates`: 16 automated pass, 0 fail; the standing U14/U15 manual
  checks remain unrelated to this panel slice
- focused panel unit/material tests: 28 pass, 0 fail
- focused panel wheel-navigation browser test: 1 pass, 0 fail
- immutable production-route Aqua evidence test: 1 pass, 0 fail

No owner visual acceptance is claimed here.
