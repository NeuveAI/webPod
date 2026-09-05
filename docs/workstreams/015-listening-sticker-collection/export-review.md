# PLAYWORN final PNG export review

2026-09-06 — independent reviewer. **Ready for asset delivery and the separate app laminate implementation.** Sixty PNGs represent the sixty selected designs, grouped as twelve collections of five. This verdict covers export identity, visual isolation and manifest integrity; it does not claim the app finish, unlocking or placement behavior is implemented.

## Final evidence

- `evidence/export-brand-final-audit.png`: all thirty brand-lane files composited on dark slate, inspected for lost artwork, neighboring designs and proof-mask bars.
- `evidence/export-designer-final-audit.png`: all thirty designer-lane files composited on the same dark slate, updated after the final Heart Stereo correction.
- `evidence/export-heart-stereo-final.png`: final isolated closeup verifies the right-side fragment is absent and the approved main silhouette survives.
- `assets/stickers/playworn/manifest.json`: independently decoded all sixty RGBA PNGs and matched dimensions, SHA256 and threshold-16 visible bounds. Twelve genre groups each contain five entries. After Heart Stereo changed, its replacement hash and exclusive bounds `[88,70,703,583]` were checked again.

The chosen PW-A05 Heavy Rotation record-and-chain illustration is present, with no rejected Riff Ritual substituted. PW-B05 Mixtape Kid retains the compact cassette/J-card composition; PW-D02 Beat Tape retains separate cassette and drum-machine objects. Electronic's five silhouettes now have transparent surroundings without losing the distinctive equipment, ticket, loop or wristband artwork. Revised Demo Days, Room Tone and Echo Chamber retain their approved music identities and cable geometry.

## Findings resolved during export

Country Radio Miles, Steel Line, Back Porch and Last Verse, plus reggae Version and Low End, initially contained exported opaque proof-mask rectangles. Those six bars were removed through export-specific native clipping; final dark-background images show intact artwork without the rectangles. Small source-sheet fragments below First Movement and Hidden Track were also removed.

Heart Stereo initially contained a detached 51-pixel fragment at alpha >=20, x705–707/y434–453, outside the main design. The final export makes x703 onward fully transparent while preserving the main art. The initially captured `export-brand-audit.png` is historical failure evidence, not the final delivery preview.

## Honest limitations and integration implications

PNG dimensions vary intentionally. Native exports often measure 796×600 or 796×620, while isolated source images use their own dimensions. Larger exports and resampling do not add original detail, and these are not newly editable vector masters. Preserve aspect ratio and use manifest `alpha.visibleBounds` for visual-size normalization rather than stretching every file into equal boxes.

Some native sheet sources retain near-zero alpha speckle in transparent margins. This is visually different from an opaque proof rectangle. Manifest bounds use threshold 16/255 to avoid treating faint residue as substantial artwork; preserve genuine antialiased edges when rendering. The runtime laminate must use the same silhouette and cannot turn faint source residue into a reflecting image rectangle.

Demo Days and Room Tone final transparency comes from background-only image-generation derivatives, visually checked against the selected motifs. Their pixels are not asserted identical to the original opaque proofs. Electronic isolation similarly remains raster work; provenance is recorded in the manifest/export records. Existing ink grain and illustrated highlights are part of the selected base art; no moving reflection or runtime clearcoat was baked into this export task.

`app-sticker-handover.md` records the current Three/R3F production integration points, Jotai state law, asset-serving requirement and shared satin material brief. The next agent must verify runtime alpha/specular behavior, orientation, GPU ownership and production loading before claiming the physical finish is ready.
