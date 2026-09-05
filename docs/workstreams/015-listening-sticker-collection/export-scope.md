# PLAYWORN asset export

Export the current sixty designs as individual PNGs, grouped by the twelve genre collections. Preserve the adopted artwork, including Heavy Rotation, the cassette version of Mixtape Kid, and the corrected lettering and equipment geometry. Approval boards and rejected variants are not app assets.

Deliverables:

- `assets/stickers/playworn/<genre>/<catalogue-id>-<name>.png` — illustration bases.
- A manifest with stable catalogue IDs, names, collection, source node, dimensions, alpha status and provenance.
- A handover grounded in the current app renderer for a shared laminate texture and reflective finish layered over the bases.
- An independent export audit and a scoped git commit, leaving unrelated staged work intact.

Check all files for nonempty artwork, complete silhouettes, transparent surroundings, and absence of adjacent motifs or proof-board labels. Source resolution and any remaining limitations must be recorded honestly; larger exports do not add detail to raster originals.

The print grain belongs to the base artwork. Moving light, laminate roughness and specular response belong to the app material. This task exports assets and documents that implementation; it does not implement unlocking, placement, or runtime materials.
