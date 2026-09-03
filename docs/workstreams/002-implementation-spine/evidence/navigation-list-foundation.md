# Canonical list-view evidence

Owner review status: pending.

The screenshot set in this folder is captured from the existing
`/_spike/device` product route at one unchanged device scale and panel size.
It covers Playlists, Artists, Albums, Songs and one nested track list.

All captures use the same 800×638 browser viewport, unchanged black device,
unchanged camera pose, 272×204 authored panel raster and product scale:

- `navigation-list-playlists.png`
- `navigation-list-artists.png`
- `navigation-list-albums.png`
- `navigation-list-songs.png`
- `navigation-list-nested-tracks.png`

Reproduction from the initial Albums-highlighted root uses the focused panel:

- Albums: `Enter`
- Playlists: `Escape`, `ArrowUp`, `ArrowUp`, `Enter`
- Artists: `Escape`, `ArrowDown`, `Enter`
- Songs: `Escape`, `ArrowDown`, `ArrowDown`, `Enter`
- Nested tracks: `Escape`, `ArrowUp`, `Enter`, `Enter`

The screenshots were captured from Chromium with the existing
`CanvasDrawElement` product flag. They are owner-review evidence, not an
aesthetic approval claim.

Deterministic proof lives in `packages/panel/src/list-view.test.tsx`:

- all collection families render the same semantic `ListRow` and current state;
- one direct wheel detent moves the current row for each family;
- eight rows fit without a rail and row nine activates the shared Aqua rail;
- only the canonical component authors list `<li>` markup;
- long primary/secondary text truncates inside fixed tail columns;
- split-preview content follows the highlighted row.
