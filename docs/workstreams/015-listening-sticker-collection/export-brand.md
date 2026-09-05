# PLAYWORN brand-lane PNG exports

Thirty individual approved-art bases across Indie, Jazz, Classical, Country, Reggae and Latin. The organized files live under `assets/stickers/playworn/<genre>/`. No captions, proof sheet background, or neighboring stickers are intentionally included.

## Method and transparency

Twenty-eight assets are native Pencil slot exports at 2x, 796 × 600 pixels. Source document: `docs/design/stickers.pen`. Demo Days and Room Tone use background-only imagegen extractions requested by the lead because their approved sources had opaque matte backgrounds; these two preserve native extraction resolution rather than claiming 2x slot dimensions. Their corrected object geometry and lettering were retained visually, though model extraction is not bit-identical.

Versioned extraction sources:

- `docs/design/images/playworn-demo-days-export-alpha-v1.png` (1536 × 1024).
- `docs/design/images/playworn-room-tone-export-alpha-v1.png` (1244 × 1265).

Six native slots had beige rectangles hiding neighboring sheet fragments. Their PNGs were exported through temporary complementary rectangular clipping regions, excluding exactly those proof-mask areas. This preserves the already visible approved silhouette while making the excluded regions truly transparent. Source slots: Radio Miles `fqttR`, Steel Line `VAk6q`, Back Porch `xk0lC`, Last Verse `wrwlh`, Version `MewjM`, Low End `jjLGf`. All original children and enabled states were restored immediately after export.

First Movement `S8fNE` had a disconnected 219-pixel neighboring fragment below the real silhouette at alpha ≥128; Hidden Track `hd5v6` had a 59-pixel fragment. Temporarily reducing their source crop heights to284 and286 respectively removed only those fragments. Original crop heights288 were restored.

All PNGs have real RGBA transparency. Some inherited sheet pixels outside the main cutline have alpha1–4/255, and many ink pixels max at254/255. These near-zero residues can look pronounced in viewers that ignore alpha but are almost invisible when composited correctly; they are documented, not treated as solid backgrounds. A future runtime alpha threshold of ≤4/255 may be considered after visual testing, particularly for hit-testing. No such pixel edits were performed here. Raster grain and tonal variation remain part of the approved reference artwork.

## Inventory

| Catalogue | Sticker | Genre | Source node | PNG dimensions |
|---|---|---|---|---|
| PW-I01 | Demo Days | indie | `hsray` | 1536 × 1024 |
| PW-I02 | Hidden Track | indie | `hd5v6` | 796 × 600 |
| PW-I03 | Room Tone | indie | `FO5QQ` | 1244 × 1265 |
| PW-I04 | Paper Moon | indie | `kbA9s` | 796 × 600 |
| PW-I05 | Local Hero | indie | `LFJ1e` | 796 × 600 |
| PW-J01 | Off Beat | jazz | `LvPvd` | 796 × 600 |
| PW-J02 | Blue Hour | jazz | `tqh80` | 796 × 600 |
| PW-J03 | Take Five | jazz | `DqVwa` | 796 × 600 |
| PW-J04 | Long Solo | jazz | `qULJk` | 796 × 600 |
| PW-J05 | Side Notes | jazz | `p3SwPc` | 796 × 600 |
| PW-H01 | First Movement | classical | `S8fNE` | 796 × 600 |
| PW-H02 | Quiet Power | classical | `jAgbt` | 796 × 600 |
| PW-H03 | Encore | classical | `t7Ouxm` | 796 × 600 |
| PW-H04 | Counterpoint | classical | `KP6pe` | 796 × 600 |
| PW-H05 | Finale | classical | `NnQMq` | 796 × 600 |
| PW-K01 | Six Strings | country | `HuaUI` | 796 × 600 |
| PW-K02 | Radio Miles | country | `fqttR` | 796 × 600 |
| PW-K03 | Steel Line | country | `VAk6q` | 796 × 600 |
| PW-K04 | Back Porch | country | `xk0lC` | 796 × 600 |
| PW-K05 | Last Verse | country | `wrwlh` | 796 × 600 |
| PW-G01 | Version | reggae | `MewjM` | 796 × 600 |
| PW-G02 | Echo Chamber | reggae | `z93rdJ` | 796 × 600 |
| PW-G03 | Low End | reggae | `jjLGf` | 796 × 600 |
| PW-G04 | One Drop | reggae | `PQ7iA` | 796 × 600 |
| PW-G05 | Dub Plate | reggae | `I6gNK` | 796 × 600 |
| PW-L01 | Clave | latin | `xSvga` | 796 × 600 |
| PW-L02 | Otra Vez | latin | `p8kEg` | 796 × 600 |
| PW-L03 | Turn It | latin | `ribrK` | 796 × 600 |
| PW-L04 | Night Ticket | latin | `ImtHM` | 796 × 600 |
| PW-L05 | Percussion | latin | `bPJME` | 796 × 600 |

The accompanying `export-brand.json` records each exact output path, source image node/URL, dimensions, alpha range, transparent-pixel count, significant alpha bounds, export method and limitations.

## Verification and handoff

All30 files were opened by the PNG decoder and inspected for dimensions and nonempty alpha. Native renderer output for newly created preparation frames was blank; the successful final exports used the existing source slot IDs temporarily and then restored them. The unused preparation frame `TrClM` was removed, and blank intermediate evidence files were removed. Successful correction exports remain in `evidence/export-alpha/`.

Independent final visual QA passed for all30, including corrected proof-mask areas, the two crop fragments, Demo Days and Room Tone. See `export-review.md` for the consolidated review. No application code or original sticker artwork was changed. The lead owns the final scoped commit.
