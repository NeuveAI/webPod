# Production device-view parity

This evidence supersedes the rejected density-specific menu treatments and their
four prior screenshots. The correction does not stretch, distribute, or
otherwise restyle rows for the probe. Instead, both `/_probe/composite` and
`/_spike/device` delegate the production LCD and composite device assembly to
`apps/web/src/production-device-view.tsx`.

## Immutable source

- Implementation commit:
  `a6a077746f6c57df2f6bf2343219be7a7108dd38`
- Git tree: `b0cc6ae4083a85176d1c4403492b31ab4b7c1c78`
- Browser-source fingerprint:
  `5a7782dba006fdc747a7a8c5fa48c0833671941f53653986fe2d81aa7a3ccee6`
- Source files: 198

The Playwright runner served a `git archive` of that commit. It did not borrow
the shared checkout's unrelated dirty files.

## One production configuration

The shared production view owns these defaults for both routes:

- state `ready`;
- Dynamic Type scale `1`;
- density override `null`, yielding the screen's compact density;
- actor `human`;
- ordinary fixture list and artwork treatment;
- one document singleton store through the existing `Panel` boundary.

The probe's state and 100/130/200 controls remain explicit diagnostic overrides
of documented product settings. With no query parameters, the probe does not
install an override: it renders the same compact eight-row window as the spike.
Neither route imports or constructs `Panel` or `CompositeDevice` directly.

The static ownership test plants a route-local `Panel` import and goes red. A
second browser plant changes the probe's no-query scale from `1` to `1.3`; the
parity gate reports the rejected divergence exactly as `compact / 8` versus
`airy / 4`.

## Browser parity

Routes:

- probe: `/_probe/composite`
- spike control: `/_spike/device?capture&view=front&colourway=black`

The semantic/layout gate compares independent pages and requires exact equality
for:

- panel actor, colourway, state, screen, density, and visible-row attributes;
- all eight visible labels and source indexes;
- selected row before and after three authoritative keyboard movements;
- 21px row block size and 11px row type;
- 272×204 LCD, 272×21 title, 168×183 list, and 104×183 preview;
- overflow, scroll position, and raster-scale defaults.

Result: **2 browser tests passed**. Both defaults show Cover Flow, Playlists,
Artists, Albums, Songs, Genres, Radio, and Search. After the same three
movements, both highlight Radio while retaining the same full eight-row window.

## Cropped LCD proof

- `probe-default-lcd.png`: 272×204,
  SHA-256 `6d9044256f255bc9d9912c4a643303ce1f7f8c539d56e192033d3520d5947b07`
- `spike-front-lcd.png`: 405×304,
  SHA-256 `43be1b912c79b297656c43e931957449e916c884805ccaf34472254a98a357bc`

The outer stages project the physical screen at different sizes, which is an
allowed camera/stage difference. The gate crops the active LCD from renderer
diagnostics, normalizes both crops to the authored 272×204 pixel grid, hashes
the normalized pixels, and compares every RGB channel:

- probe normalized SHA-256:
  `98fe270a5cf15f1746bf3d9106d3951ed6bd1e0ee537d8a7756c0838cb08180c`
- spike normalized SHA-256:
  `2d46aa64cbeb432923d4fdc93d6d834a9dc907ea6602f6c129932be6625686f7`
- mean channel delta: `3.736604` (gate: at most `5`)
- pixels with any RGB delta above 20: `6.624856%` (gate: at most `10%`)
- maximum localized channel delta: `107`

The hashes intentionally remain distinct because the two WebGL projections
resample from different crop sizes. The bounded pixel comparison is the parity
assertion; the exact semantic and geometry comparison guards the content and
layout independently. `summary.json` contains the machine-readable readings.

## Gates

- focused ownership test: 1 pass, 0 fail;
- immutable production-view browser suite: 2 pass, 0 fail;
- repo typecheck: 11/11 projects clean;
- repo lint: exit 0;
- repo tests in the detached committed worktree: 1,108 pass, 0 fail, 77,544 assertions;
- production build: exit 0;
- static gates: 16 automated pass, 0 fail; standing manual U14/U15 unchanged.
