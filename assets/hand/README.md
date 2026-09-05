# Cartoon glove / hand rig v1

Original webPod asset, authored with Blender 5.2.1 LTS. No third-party mesh.

- `classic-glove.blend`: editable glove, separate rig/skin collections, studio camera and lights.
- `hand-rig.blend`: reusable armature and pose actions, without glove geometry.
- `rig-contract.json`: skeleton names, hierarchy, contacts and pose clip names.
- `../../apps/web/public/hand/classic-glove.glb`: production skin with bound rig and pose clips.

## Rebuild

From the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/hand/build_glove.py
```

This regenerates source assets, the browser GLB and the four pose renders in
`docs/workstreams/013-cartoon-hand-cursor/evidence/`. It does not require add-ons.
The script uses Blender Python because Blender's authoring API is Python.

## Author another skin

1. Append `HandRig` from `hand-rig.blend`, or duplicate the classic source and
   replace the objects in the **Skin** collection.
2. Preserve bone names and rest transforms. Bind new mesh geometry through an
   Armature modifier and matching vertex groups. The topology/materials may differ.
3. Preserve the two contact bones: `contact_index` follows the fingertip;
   `contact_thumb` follows the thumb tip. Adjust these for a differently padded skin.
4. Keep actions named `idle`, `pinch`, `grab`, `press`. The classic source stores
   them as muted NLA tracks so they remain available without mixing in the editor.
   Select one as the active action to edit/preview; constant one-second pose clips
   blend continuously in the browser. Clear the active action before exporting.
5. Export selected rig and bound meshes to GLB with **Animations → Actions**,
   sampling enabled, and **Deformation Bones Only** disabled (contact bones must
   export). Export an embedded/self-contained GLB; studio lights/camera stay out.
6. Set the shared `handSkinAtom` in `apps/web/src/hand-cursor/state.ts` to the new
   asset URL through `handStore.set`. Loading validates contacts and clip names.
   Invalid/loading assets keep the native pointer; the prior GPU assets are disposed.

Browser coordinates are glTF X-right/Y-up/Z-forward. The model's actual contact
is translated onto the pointer each frame after pose blending and stretching.
Pinch/grab blend toward the midpoint between index and thumb. The motion engine
knows no finger lengths, mesh vertices, materials or skin-specific shapes.

## Motion tuning

`motion.ts` contains time-based acceleration/speed thresholds, smear hold/decay,
pose blend and wrist follow constants. `runtime.ts` contains cursor display scale
and lighting. Ordinary movement follows exactly; fingers blend in roughly 85 ms.
Smears hold for 48 ms and decay over 65 ms after the last qualifying input.
Touch does not load this renderer. Reduced motion switches poses directly and
disables smear/follow-through. Rendering sleeps 450 ms after the last interaction.

The runtime reads existing `data-orientation-grab` and
`data-wp-cursor-control` attributes; skins must not duplicate gesture handling.
