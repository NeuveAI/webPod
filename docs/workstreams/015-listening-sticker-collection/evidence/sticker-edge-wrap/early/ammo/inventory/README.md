# Authored collider inventory

The native fixture contains203,743triangles:22,166cutrear,169,367front,50glass,6,144wheel and6,016Select. This is the existing fixture, not every rendered assemblyresource: Device also constructs wheel/select gapfloor meshes and hardware that this fixture does not import. No surface exclusion or replay was applied.

Instrumentation carries the original pre-crown extrusion triangle ID through the unchanged tessellator. Its output positions match the existing front geometry exactly (maximum coordinate difference0). Cap identity comes from original extrusion depth, and side identity from disjoint authored outline/hole bands and layer depth. The128-segment wheel's bevel miter is accounted for as bevel/cos(pi/128), not classified by guessed output normals.

| Authored front region | Triangles | Exterior conclusion |
|---|---:|---|
| Front-facing cap |30,475|Exposed opaque face; retain.|
| Rear-facing cap at assembly seam |30,475|Authored internal underside; candidate for exclusion from exterior contact after review. Keep original oracle.|
| Outer rear bevel |35,025|Exterior rolled transition above steel seam, despite rear-facing slopes; retain.|
| Outer core wall |2,140|Exterior side band; retain.|
| Outer front bevel |35,026|Exterior front roll; retain.|
| Wheel aperture rear bevel |17,589|Partly covered by wheel assembly; cannot remove whole category without coverage proof.|
| Wheel aperture core wall |1,048|Under/at wheel assembly, coverage-dependent; retain pending proof.|
| Wheel aperture front bevel |17,589|Includes exposed annular transition and covered region; retain pending exact overlay proof.|

The rear's392return-liptriangles cannot all be called hidden: the authored flat return spans the visible steel seam and the portion underneath the front bevel. Removing the whole ring would remove exposed support. Subdivision/coverage classification would be necessary; none was attempted.

Removing only the authored internal front underside would remove14.96%of the complete fixture. It would not directly change current attraction support, which already excludes this cap. Existing penetrating-node witnesses refer to actual rear or exposed front facets, so this exclusion does not repair their classification. Cost reduction is unmeasured.

Display aperture walls were explicitly removed by removeOpaqueApertureWalls before crown tessellation; the clear cover/glass is a separate resource. Wheel gap floors are authored by createWheelGapFloorGeometries and are absent from this old fixture. Treat claims of a fully exhaustive assembly oracle accordingly. Keep the original full fixture unchanged for comparisons, and require explicit resource provenance for future procedural support.

This closes the bounded inventory. It does not authorize deleting geometry, changing apertures or restarting physics optimization.
