# LCD fidelity decisions

## Source of truth

The active Pencil components `Screen / Music Menu` (`mObBW`) and
`Screen / Now Playing` (`HYNXu`), plus their dark-device instances in
`M2 · Music Menu — Human` and `M1 · Now Playing — Human`, are the visual
source of truth for this pass.

The implementation keeps the authored 272×204 raster, 21px title bar, eight
21px menu rows, 168/104 menu split, 88px artwork, and compact status hierarchy.
The previous responsive framing remains unchanged.

## Native character

- Use a Helvetica-family UI stack and compact mono numerals rather than an
  unresolved web font that silently falls back differently by host.
- Keep selection as the iPod's full-row blue lacquer treatment. It is a state
  surface, not a generic dashboard card or edge rail.
- Replace typographic approximations of battery, chevron, shuffle, repeat,
  love, rating, and queue with one coherent inline SVG family.
- Use the authored Pencil artwork in the deterministic preview fixture. The
  product provider artwork path remains intact for non-fixture surfaces.

## Renderer boundary

The source DOM is crisp in bare evidence. The composited evidence still shows
softening and pronounced scanlines introduced after DOM rasterization. This
pass does not tune that shader because `packages/composite`, `packages/device`,
and tokens are explicitly out of scope. The evidence retains both source and
composited captures so a reviewer cannot accidentally attribute renderer loss
to the panel source or declare the end-to-end result complete.
