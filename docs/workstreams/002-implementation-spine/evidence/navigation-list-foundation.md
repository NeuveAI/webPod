# Canonical list-view evidence

Owner review status: pending.

The screenshot set in this folder is captured from the existing
`/_spike/device` product route at the same rendered device scale and 272×204
authored panel raster.
It covers Playlists, Artists, Albums, Songs, one nested track list, and an
explicit 42-row overflow case.

The five sibling captures use a 1280×633 browser viewport. The explicit
overflow capture uses 800×638; its device and panel remain at the same product
scale. All captures use the unchanged black device presentation:

- `navigation-list-playlists.png`
- `navigation-list-artists.png`
- `navigation-list-albums.png`
- `navigation-list-songs.png`
- `navigation-list-nested-tracks.png`
- `navigation-list-overflow-9-plus.png` (Songs fixture, 42 rows; eight visible
  rows plus the striped Aqua rail)

Reproduction from the initial Albums-highlighted root uses the focused panel:

- Albums: `Enter`
- Playlists: `Escape`, `ArrowUp`, `ArrowUp`, `Enter`
- Artists: `Escape`, `ArrowDown`, `Enter`
- Songs: `Escape`, `ArrowDown`, `ArrowDown`, `Enter`
- Nested tracks: `Escape`, `ArrowUp`, `Enter`, `Enter`
- Overflow: from the initial Albums-highlighted root, `ArrowDown`, `Enter`

The screenshots were captured from Chromium with the existing
`CanvasDrawElement` product flag. They are owner-review evidence, not an
aesthetic approval claim.

Deterministic proof lives in `packages/panel/src/list-view.test.tsx`:

- an explicit named matrix covers every root collection, Search entry/results,
  artist and genre descendants, and both album/playlist nested track families
  through the same semantic `ListRow` and current state;
- one direct wheel detent moves the current row for every scrollable family;
- eight rows fit without a rail and row nine activates the shared Aqua rail;
- only the canonical component authors list `<li>` markup;
- long primary/secondary text truncates inside fixed tail columns;
- split-preview content follows the highlighted row.
