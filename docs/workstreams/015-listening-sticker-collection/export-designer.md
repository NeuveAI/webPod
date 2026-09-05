# Designer export handover

Thirty approved individual PNG bases exported to `assets/stickers/playworn/` across metal, pop, rock, hip-hop, rnb and electronic. No Pencil canvas writes, app changes or git operations. Current approved MetalA05 is Heavy Rotation; Mixtape Kid is the cassette revision. Rejected Riff Ritual proposals are not exported.

## Verification

All thirty files viewed individually for nonblank content, correct current artwork and absence of external board captions. Read-only Pillow inspection verifies alpha channel, bounds and dimensions. Twenty-five are exact native Pencil export_nodes scale2 files, 796×620. Electronic five originally included opaque release-liner squares; built-in imagegen isolated their backgrounds with exact-art-preservation prompt. Those output dimensions are retained per supervisor instruction instead of modifying the canvas or resampling by CLI.

Prompt: “Remove background, transparent PNG alpha, preserve exact sticker including cream diecut. No shadow/glow. Preserve every printed letter, color and geometry exactly; only background removal.” References were the five native exports after viewing them. New versioned sources live in docs/design/images.

Native exports preserve near-transparent antialiasing speckles (often alpha1/255) and original tight source crops. Consumers should composite with alpha and may choose an alpha cutoff for shader use; do not interpret hidden RGB as an opaque fringe. All Electronic exteriors now have real transparency; some retain colored RGB under alpha0, which certain preview tools display as a glow. Background isolation is generative, so subtle pixel/color variation exists despite preserved lettering/motifs. No matte square accepted.

Machine-readable dimensions, exact paths, source nodes, method, alpha ranges, alpha bounds and limitations: `export-designer.json`. All30 status exported. Root owns final integration/commit.

| Catalogue | Name | Node | Pixels | Method |
|---|---|---|---|---|
| PW-A01 | Night Shift | Nx17B | 796×620 | Native2x |
| PW-A02 | Deep Cut | eUpct | 796×620 | Native2x |
| PW-A03 | Full Volume | p8Fxq | 796×620 | Native2x |
| PW-A04 | No Skip | xlmKZ | 796×620 | Native2x |
| PW-A05 | Heavy Rotation | Wm3Tb | 796×620 | Native2x |
| PW-B01 | On Repeat | teb9K | 796×620 | Native2x |
| PW-B02 | Heart Stereo | i7NTHN | 796×620 | Native2x |
| PW-B03 | Side Quest | g57EZH | 796×620 | Native2x |
| PW-B04 | Sing It Back | v4UW7A | 796×620 | Native2x |
| PW-B05 | Mixtape Kid | ZKUor | 796×620 | Native2x |
| PW-C01 | Soundcheck | vEs72 | 796×620 | Native2x |
| PW-C02 | Riff Rider | wdCid | 796×620 | Native2x |
| PW-C03 | Last Encore | JlK2l | 796×620 | Native2x |
| PW-C04 | Feedback | I6K46 | 796×620 | Native2x |
| PW-C05 | Stage Dive | pnBhr | 796×620 | Native2x |
| PW-D01 | Crate Find | ly8rA | 796×620 | Native2x |
| PW-D02 | Beat Tape | Ziy6f | 796×620 | Native2x |
| PW-D03 | Mic Check | FSbtQ | 796×620 | Native2x |
| PW-D04 | Break Loop | x8SYZt | 796×620 | Native2x |
| PW-D05 | Street Cut | WDQq9 | 796×620 | Native2x |
| PW-E01 | Slow Jam | ZwSB8 | 796×620 | Native2x |
| PW-E02 | Soul Side | Sw4Ka | 796×620 | Native2x |
| PW-E03 | Afterglow | m2Tbl | 796×620 | Native2x |
| PW-E04 | Warm Voice | g4BqO | 796×620 | Native2x |
| PW-E05 | Love Letter | vqNDq | 796×620 | Native2x |
| PW-F01 | Pulse Code | D1QyDl | 1448×1086 | Alpha isolation |
| PW-F02 | Night Bus | e28R9a | 1536×1024 | Alpha isolation |
| PW-F03 | Bass Line | e7RTup | 1536×1024 | Alpha isolation |
| PW-F04 | Loop State | Y76MnD | 1448×1086 | Alpha isolation |
| PW-F05 | Future Club | Ph7O2 | 1536×1024 | Alpha isolation |

Final reviewer correction: Heart Stereo export-only crop ends at x703, removing detached neighbour sliver at705–707. Temporary Pencil crop oD1tk width307.5 used for export, then restored to310. Final PNG remains796×620 and retains main silhouette. No raster pixel editing.
