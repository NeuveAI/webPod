# PLAYWORN sticker bases

Sixty individual PNG illustrations, organized into twelve genre collections. Start with `manifest.json` for the exact catalogue IDs, filenames, dimensions, source design nodes and checksums. These are application source assets, not automatically served browser URLs.

The current metal replay sticker is **PW-A05 Heavy Rotation**. Mixtape Kid depicts a cassette. Rejected alternatives and approval-board images live under `docs/design/`; do not import those as additional stickers.

## Material boundary

The PNG contains the printed ink, existing print grain and ivory die-cut stock. Add the laminate as a separate shared runtime finish, using the same silhouette alpha as the printed layer. A subtle roughness texture and light-dependent satin reflection should respond to device orientation. Keep highlights out of these base files.

See [the implementation handover](../../../docs/workstreams/015-listening-sticker-collection/app-sticker-handover.md) for renderer integration, asset serving, resource ownership, proposed material values and verification. See [the export audit](../../../docs/workstreams/015-listening-sticker-collection/export-review.md) for readiness and source limitations.

## Source fidelity

The editable design document is `docs/design/stickers.pen`, accessible only through Pencil tools. Most illustrations originate as raster references; larger PNG dimensions do not imply more original detail. A small amount of near-zero alpha residue exists in some source sheets. Consult the manifest and audit rather than treating an RGBA file extension as sufficient evidence of a clean silhouette.

Catalogue IDs are stable identity. Preserve aspect ratio and use manifest bounds when normalizing placement size. The design-board listening captions do not define approved runtime unlock thresholds.
