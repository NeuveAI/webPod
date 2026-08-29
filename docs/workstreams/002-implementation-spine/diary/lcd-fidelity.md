# LCD fidelity diary

The rejected screen had the right content but the wrong visual model: a loose
dashboard rendered inside an iPod silhouette. Pencil inspection made the
differences measurable. The menu preview had title/count hierarchy reversed,
Now Playing used a 104px cover and an oversized artist line, text characters
stood in for icons, and the fixture cover was a synthetic monogram.

I rebuilt those details against the reusable Pencil screen components rather
than the screenshot alone. The panel now uses the exact title/row/split/artwork
geometry, compact metadata hierarchy, a single SVG icon family, stronger dark
LCD contrast, and the authored artwork exported from Pencil at four times its
display size.

The first flagged-browser capture was important because it separated two
problems that looked like one. The bare panel became crisp and recognizably
iPod-like, while the composited copy remained visibly softened by the screen
mesh. I preserved that evidence rather than compensating with distorted source
typography or crossing the package boundary.

No device material, composite implementation, token, history, responsive
route, or `design.pen` content was changed.
