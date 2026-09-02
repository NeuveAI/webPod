# Navigation browser evidence

Route: `http://127.0.0.1:4319/_spike/device`, Chrome with the existing
`CanvasDrawElement` T1 flag.

- `navigation-artists-now-playing.png`: Music → Artists → The Fray → album → Syndicate → Now Playing.
- `navigation-playlist-tracks.png`: Music → Playlists → Late shift → provider-owned track membership.
- `navigation-back-restoration.png`: Menu from Now Playing restored the originating track frame and row.
- `navigation-long-menu-root.png`: a 650 ms keyboard-equivalent Menu hold returned from the 42-song list to the original root frame without a second pop.
- `navigation-overflow-scrollbar.png`: Songs row 9 of 42, eight visible rows and the Aqua thumb displaced from the top.
- `navigation-a11y.json`: scoped accessibility audit output for the composited `role=application` surface.

The accessibility snapshot exposed each generic list as a named listbox with
the highlighted row selected. The typed integration tests separately cover
unsupported Radio omission and empty relationship frames.

