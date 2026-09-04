# Review: W005 Lane B — visual/material fidelity

## Verdict

**APPROVE**

Counts: **0 Critical · 0 Major · 0 Minor**.

The rendered panel itself is materially closer to the physical iPod than the
rejected baseline: its canonical Now Playing geometry is exact, its standard
screen has no queue count or status shelf, its pending treatment is confined to
the progress track, and its list, rail, skeleton, marquee, and reduced-motion
states all match the scoped structure. Both required browser evidence paths now
pass against immutable served snapshots, including the production composite at
mobile and desktop camera scales.

## Correctness check

Reviewed repo law; the entire W005 scope, dispatch, material, review, dependency,
tracker, and HITL record (including D005-01 through D005-06); every supplied
physical-device photograph under `/Users/vinicius/code/tmp/ipod-reference`; and
the supplied anti-reference screenshots. The HEIC photographs were converted and
perspective-normalized only in a temporary directory. No credential or `cert/`
content was read. No implementation source was edited.

The measurement basis is the authored 272×204 LCD coordinate system. Physical
photo values are necessarily ranges because the panel was photographed with
perspective and lens distortion. The owner-adapted target removes the photographed
queue count under D005-01 and uses the explicitly required eight-row list rhythm;
the physical lists themselves expose nine rows at roughly 20.3 px each. D005-06
permits the explicit Dynamic Type override to reduce row count, but not visual or
camera scaling at the production 100% setting.

## Reference geometry

| Element | Physical observation, normalized to 272×204 | Owner-adapted target | Current canonical build | Delta |
| --- | ---: | ---: | ---: | ---: |
| LCD / titlebar | `0,0,272,204`; titlebar `0,0,272,20–21` | `0,0,272,204`; `0,0,272,21` | `0,0,272,204`; `0,0,272,21` | `0` |
| Now Playing body insets | content begins near `x17–19`; right edge near `x253–255` | `18` left/right | `18` left/right | `0` |
| Artwork | about `17–18,57–59,86–88,86–88` | `18,58,86,86` | `18,58,86,86` | `0` to target |
| Metadata block | about `x116–118`, title top `y69–72` | block `x116`; title `y69`; artist/album 11/13 with 11 px interline margins | block `x116`; title `y69`; title `14/16`; artist `y96,11/13`; album `y120,11/13` | `0` |
| Artwork → metadata gap | about `11–13` | `12` | `12` | `0` |
| Progress track | about `18–20,157–160,234–237,4–5` | `18,157,236,5` | `18,157,236,5` | `0` |
| Time labels | about `x18–20`, top `183–186`; glyph bottom near `198–201` | `18,183,236,13`; 8 px terminal box space | `18,183,236,13`; 8 px terminal box space | `0` |
| List body / rows | physical: nine × about `20.3`; owner anti-reference: eight × about `22.9` | `0,21,272,183`; eight × `22.875` | `0,21,272,183`; eight × `22.875` (browser rounds painted rows to alternating 22/23 px) | `0` |
| List text inset | about `7–10` | `8` start, `6` end | `8` start, `6` end | `0` |
| Divider / chevron | about `1`; chevron about `11–12` square | `1`; `12×12` | `1`; `12×12` | `0` |
| Overflow rail | outer slot about `9–11`; well about `4–5`, separately inset from content | `9` slot; `5` well; `2` side margins | body columns `263+9`; well `x265,y25,5×175`; thumb `5×127.266` for 11 rows | `0` |

The rejected baseline was count `8,21,256,22`, track `8,46,256,108`,
artwork `8,56,88,88`, metadata `108,68.5,156,63`, progress
`8,157,256,5`, and times `8,181,256,13`. The candidate therefore removes the
22 px count band, adds 10 px to the horizontal content inset, moves metadata 8 px
right, reduces artwork by 2 px, and retains the reference progress vertical anchor
while narrowing it by 20 px. This is a measurable correction, not a subjective
“looks close” judgment.

## Rendered evidence

- Canonical ready Now Playing, dark and light: exact measured bounds above; no
  `.wp-now-count`, `.wp-status-shelf`, control slab, card, or chip.
- Canonical 11-track list, dark and light: eight rows are visible; row content ends
  at `x263`; one dedicated Aqua rail occupies `x263–272`; selection and rail do not
  overlap.
- Relationship-loading list, dark and light: exactly eight skeleton rows at
  `22.875` px; each placeholder starts at `8,8` within its row and is 7 px high.
- Pending Now Playing, dark and light: metadata and times remain stable while the
  existing 5 px progress track alone becomes the blue Aqua stripe. It has no
  determinate ARIA value and no additional visible loading copy.
- Reduced motion: shimmer and marquee animations become `none`; the selected
  overflowing row returns to its ellipsized resting label; the indeterminate stripe
  remains visible and is frozen at a deterministic transform.
- Overflow behavior: only the selected overflowing label sets
  `data-overflow=true` and runs the six-second crawl; an inactive overflowing label
  remains a single-line ellipsis.
- Dark/light parity: all measured bounds are identical. Only material/color values
  differ.
- Explicit `?scale=2` is the D005-06 Dynamic Type override, not production camera
  scale. Its four-row result is allowed by the recorded HITL decision. The Now
  Playing authored coordinates remain invariant after normalizing the 1.25 raster
  transform.

The final independent panel run wrote its state, colourway, geometry, Dynamic
Type, preference, Axe, provider-artwork, and raster-compatibility evidence under
`${TMPDIR}webpod-panel-playwright/evidence/` with the
`w005-final-review-` prefix. The final production-composite run wrote:

- `/tmp/webpod-w005-final.7mSp1P/production-device-list-mobile-390x844.png`
- `/tmp/webpod-w005-final.7mSp1P/production-device-list-desktop-1440x900.png`
- `/tmp/webpod-w005-final.7mSp1P/production-device-now-playing-pending-mobile-390x844.png`
- `/tmp/webpod-w005-final.7mSp1P/production-device-now-playing-pending-desktop-1440x900.png`

The production captures show the same authored LCD geometry at both camera
scales. Their deterministic Apple facade is installed only from the Playwright
test, uses no public fixture route, and its marker strings are absent from the
fresh production client and SSR bundles.

## Findings

No Critical, Major, or Minor findings remain.

The two earlier Major evidence defects are resolved. Panel geometry is normalized
by the measured preview scale before comparison, and stale count/status assertions
now test the current contract. The production proof uses Playwright's ESM entry,
targets the canonical `/_spike/device` route, asserts native LCD and list geometry,
and captures resolved list plus true indeterminate Now Playing states at mobile and
desktop sizes.

## Verification

- Panel Playwright: **17 passed, 0 failed**, source fingerprint
  `7e5d4d6bbd0915701f4edc4c0072ed54281839b767ba38c73e296b3aa3112807`.
- Production LCD-fidelity Playwright: **4 passed, 0 failed**, source fingerprint
  `8f19bb6ea14ab7881fe92dc95dd1d0b2bebcb6665ee263e4a16f73e05c959613`.
- Fresh client and SSR `bun run build`: pass. The only build diagnostic is the
  existing advisory chunk-size warning.
- Production-bundle scan: no deterministic test-facade or panel-fixture markers.
- `bun run gates`: **11/11 TypeScript projects**, repo lint, **1,313 tests / 78,752
  assertions**, and **16 automated gates passed / 0 failed**. U14 and U15 remain
  explicitly manual; this lane visually confirmed unsupported controls absent,
  while physical thumb occlusion remains an owner phone-in-hand check.
- `git diff --check`: pass.

## Neuve dogfood feedback

Neuve shell commands were intentionally not run. Repository law says no Neuve
shell exists for this project, and D005-05 explicitly records that constraint.
