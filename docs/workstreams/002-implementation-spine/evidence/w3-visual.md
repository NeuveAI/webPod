# W3 visual evidence

Route: `http://localhost:3000/` (or the port printed by `bun dev`). Query `?state=<state>` selects any required state. Other evidence controls are `art=pale|dark`, `scale=1|1.3|2`, `density=compact|medium|airy`, `long=1`, `actor=human|agent`, and `downloaded=1`.

Reference comparisons were made through Pencil MCP against `A76Ib`, `DLqSo`, `H4QpB`, `HYNXu`, and `mObBW`. The panel raster is 272×204 with a 21px title bar; S03 uses the 168/104 split and S08 loading uses eight 26px rows.

Paired overview captures:

- `w3-s03-both.png`
- `w3-s08-both.png`
- `w3-s13-both.png`

Chrome-free panel crops are 544×408, an exact 2× integer scale of the 272×204 panel. The complete matrix is named `w3-<screen>-<state>-<colourway>.png` for S03/S08/S13 × ready/loading/empty/error/offline/permission-denied/agent-active/success-confirmation × dark/light (48 files).

Additional focused evidence:

- adaptive art: `w3-s13-art-{pale,dark}-{dark,light}.png`
- Dynamic Type/density: `w3-dynamic-{compact,medium,130,200}.png`
- preferences: `w3-pref-{reduced-motion,reduced-transparency,contrast-more}-{dark,light}.png`
- accessibility: `w3-axe.json`
- keyboard/provider traversal: `w3-keyboard.json`
- 120-row runtime: `w3-virtual-performance.json`
- raster-compatible package seam: `w3-raster-compatible-{dark,light}.png` and `w3-raster-compatibility.json`

The route presents both panels at 2× integer zoom for owner inspection. U14 and H-6 remain owner-only and are not asserted here.
