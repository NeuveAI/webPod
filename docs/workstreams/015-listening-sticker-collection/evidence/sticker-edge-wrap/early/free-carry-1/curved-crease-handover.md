# Curved material-edge outlet probe — not accepted

This evidence-only side32 candidate retains the solved arc, camera ray depth and original UV/index topology from `crease-strip-side32`. Its crease depth falls smoothly to zero at the real right material edge at both ends. There is no artificial end-residual blend. The only source collar is six model units along the crease. No product source was changed and no new browser build was run.

Files: `curved-crease-side32.ts/.json` contain construction and complete positions/UV/index/camera data; `curved-crease-audit.ts/.json` classify triangle contacts and material stretches using original alpha plus the actual wear=1 damage predicate.

- Construction: 6.76 ms in isolated Bun; not a browser frame measurement.
- Grabbed screen error: 0.000076 px. Vertices outside the curved detached region remain exact.
- Core: 3,936 triangles, zero shell contacts, occupied principal stretches .862–1.057.
- Full mesh: 38 conservative triangle-shell contacts. Seventeen lie in triangles whose vertices are unchanged; do not attribute those to this new patch. The modified join/outlet region accounts for 21 contacts (5 boundary-crossing, 5 crease-collar, 11 curved-outlet), with occupied centroids surviving alpha/wear.
- Occupied join/outlet material reaches stretches up to 12.91. This is not confined to transparent source cells. The source collar's unblended correction is at most7.97 model units, down from the previous92.75-unit end mismatch, but closing the shared-frame core still creates steep tangent changes where the crease turns to the material edge.

The coherent core and precise grip are retained as useful evidence. The connected closure is not accepted: it still places occupied material through shell triangles and strongly distorts occupied outlet material. No exact-isometry threshold is imposed, and conservative contact counts are not mislabeled as strict penetration witnesses. The candidate has not received native visual acceptance. Do not expand to57.6 or another parameter sweep from this result.

The latest no-drag-outline and editor performance corrections remain intact and independently native-verified. The overall wrapped partial/free peel remains open. Root requested stopping further geometry iterations after this compact handoff.
