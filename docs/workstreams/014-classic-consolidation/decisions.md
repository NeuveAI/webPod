# Decisions

- Choose the aluminum Classic family, specifically the owner's thin 120GB reference (A1238), to match Cover Flow. The owner authorized either direction. The photo reference is a later Classic revision within the requested Classic design family.
- Share immutable aluminum parameters between the faceplate and Select: opaque metal, no plastic clearcoat, no sheen or subsurface scattering. Both use the same fine directional roughness map at the same model-unit scale. Keep the wheel matte plastic.
- The persisted `white` identifier remains compatible; its visible label is Silver. Both finishes use the existing light Classic LCD theme. Panel layout, Cover Flow, resolution, opening, clear cover, and stack offsets stay unchanged.
- Reduce the overall shell from 11 to 10.5mm following Apple's 120GB specification. Reduce front thickness from 14 to 8 model units (about 2.6 to 1.5mm). The latter is a photo-guided estimate; the existing wheel/screen XY layout is explicitly retained rather than falsely attributed to a new Classic raster measurement.
- Stabilize the standalone LCD material across finish changes. Previously, changing `isBlack` recreated it and overwrote the compositor-installed material, producing a blank screen. Before/after visual capture confirmed this behavior and the correction without touching the screen geometry.
- Retain the existing three-light studio and steel back finish. Update the engraved model badge to CLASSIC.
- Existing tests with assertions for 5G plastic are migrated to the metal/plastic relationships. Existing browser tests are updated for Silver naming, shared light LCD, and the current Settings dialog. Orientation's 18-degree roll now uses a 0.00005-degree tolerance for browser pointer-coordinate rounding. Its old label-selection assertion conflicted with the existing non-selectable device stage; it now agrees with the direct-manipulation suite. No production input behavior changed.
- Repository-wide lint has 55 pre-existing errors in older evidence scripts (008/009/012). Leave those unrelated workstreams untouched. Changed files pass targeted lint.

## Sources
- Owner photos: /Users/vinicius/code/tmp/ipod-reference/IMG_2284.HEIC through IMG_2290.HEIC; inspected as temporary JPEG previews, originals unchanged.
- Apple overall dimensions: https://support.apple.com/en-us/112321.
- Canonical PBR properties: installed packages/device/node_modules/three/src/materials/{MeshPhysicalMaterial,MeshStandardMaterial}.js and https://threejs.org/docs/pages/MeshPhysicalMaterial.html.
- Legacy retained screen/wheel raster: https://cdsassets.apple.com/live/7WUAS350/images/ipod/ipod-classic/ipod-5th-gen.png. It is an inherited placement source, not evidence of Classic material construction.

- Fast-flick browser verification: 120px of synthetic pointer travel arrived at 330–337 degrees/second under local event latency, below the unchanged 340 threshold. Increase test travel to 180px; isolated check passes and proves the same multi-frame opposite-face behavior.
