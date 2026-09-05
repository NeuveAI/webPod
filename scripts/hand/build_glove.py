"""Original glove and reusable rig. Run with Blender --background --python this file.

The mesh is a skin, not the pose definition. Replace Skin collection geometry,
preserve HandRig bone names/actions and contact markers, then export again.
Blender's coordinates are converted from browser X-right/Y-up/Z-forward below.
"""
import bpy
import math
import json
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/hand'
PUBLIC = ROOT / 'apps/web/public/hand'
EVIDENCE = ROOT / 'docs/workstreams/013-cartoon-hand-cursor/evidence'
for folder in (OUT, PUBLIC, EVIDENCE):
    folder.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def xyz(p):
    return Vector((p[0], -p[2], p[1]))

def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

white = material('Glove • warm porcelain', (.89, .86, .78), .44)
cuff_mat = material('Cuff • ivory cotton', (.98, .96, .89), .6)
ink = material('Stitch • charcoal', (.10, .12, .15), .7)
skin_collection = bpy.data.collections.new('Skin • Classic glove')
bpy.context.scene.collection.children.link(skin_collection)
rig_collection = bpy.data.collections.new('Rig • skin independent')
bpy.context.scene.collection.children.link(rig_collection)

def move_collection(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)

def ellipsoid(name, center, scale, mat=white):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=xyz(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    move_collection(obj, skin_collection)
    return obj

# Three fingers plus thumb. Segment endpoints are also the binding contract.
chains = {
    'index': [(-.49, .53, 0), (-.58, 1.23, 0), (-.60, 1.90, .025)],
    'middle': [(0, .61, -.025), (.045, 1.36, -.04), (.08, 2.10, 0)],
    'outer': [(.46, .49, -.015), (.64, 1.10, -.015), (.77, 1.62, .015)],
    'thumb': [(-.49, -.31, .05), (-1.03, .02, .11), (-1.30, .51, .16)],
}
radii = {'index': .225, 'middle': .24, 'outer': .235, 'thumb': .27}
parts = [ellipsoid('Palm', (0, -.05, 0), (.79, .91, .32)),
         ellipsoid('Wrist', (.08, -.90, -.015), (.47, .50, .265))]
for name, points in chains.items():
    radius = radii[name]
    for index, (start, end) in enumerate(zip(points, points[1:])):
        a, b = xyz(start), xyz(end)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, location=(a+b)/2)
        obj = bpy.context.object
        obj.name = f'{name} volume {index}'
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((b-a).normalized())
        obj.scale = (radius, radius * .92, (b-a).length/2 + radius*.8)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        move_collection(obj, skin_collection)
        parts.append(obj)

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
glove = bpy.context.object
glove.name = 'ClassicGlove'
remesh = glove.modifiers.new('Continuous glove surface', 'REMESH')
remesh.mode = 'VOXEL'
remesh.voxel_size = .047
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth = glove.modifiers.new('Soft sewn transitions', 'SMOOTH')
smooth.factor = 1.1
smooth.iterations = 7
bpy.ops.object.modifier_apply(modifier=smooth.name)
decimate = glove.modifiers.new('Web silhouette budget', 'DECIMATE')
decimate.ratio = .38
bpy.ops.object.modifier_apply(modifier=decimate.name)
for polygon in glove.data.polygons:
    polygon.use_smooth = True

armature = bpy.data.armatures.new('HandSkeleton_v1')
rig = bpy.data.objects.new('HandRig', armature)
rig_collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
segments = {'wrist': ((.08, -1.38, 0), (.04, -.65, 0)),
            'palm': ((.04, -.65, 0), (0, .49, 0))}
for name, points in chains.items():
    for i in range(2):
        segments[f'{name}_{i+1}'] = (points[i], points[i+1])
for name, (head, tail) in segments.items():
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = xyz(head), xyz(tail)
    if name == 'palm':
        bone.parent = armature.edit_bones['wrist']
    elif '_' in name:
        prefix, number = name.split('_')
        bone.parent = armature.edit_bones['palm' if number == '1' else f'{prefix}_1']
for name, finger in [('contact_index', 'index'), ('contact_thumb', 'thumb')]:
    bone = armature.edit_bones.new(name)
    tip = xyz(chains[finger][-1])
    tip += (tip - xyz(chains[finger][-2])).normalized() * .16
    bone.head = tip
    bone.tail = tip + xyz((0, .16, 0))
    bone.parent = armature.edit_bones[f'{finger}_2']
    bone.use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True
rig['contract'] = 'webpod.hand.v1'
rig['description'] = 'Skin-independent wrist, palm, four two-joint digits and contact bones'

def distance_to_segment(p, a, b):
    d = b-a
    t = max(0, min(1, (p-a).dot(d)/d.length_squared))
    return (p-(a+d*t)).length

def bind(obj, rigid=None):
    obj.parent = rig
    modifier = obj.modifiers.new('Hand skeleton', 'ARMATURE')
    modifier.object = rig
    if rigid:
        group = obj.vertex_groups.new(name=rigid)
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        return
    groups = {name: obj.vertex_groups.new(name=name) for name in segments}
    for vertex in obj.data.vertices:
        p = obj.matrix_world @ vertex.co
        distances = sorted((distance_to_segment(p, xyz(a), xyz(b)), name)
                           for name, (a, b) in segments.items())
        # Blend only adjacent joints of the closest chain to prevent finger webbing.
        nearest = distances[0][1]
        prefix = nearest.split('_')[0]
        allowed = [item for item in distances
                   if item[1].split('_')[0] == prefix or item[1] == 'palm'][:3]
        weights = [(1 / max(.04, d)**6, name) for d, name in allowed]
        total = sum(w for w, _ in weights)
        for w, name in weights:
            groups[name].add([vertex.index], w/total, 'REPLACE')

bind(glove)
cuff = ellipsoid('RolledCuff', (.08, -1.22, .015), (.64, .22, .39), cuff_mat)
bind(cuff, 'wrist')
opening = ellipsoid('CuffOpening', (.08, -1.37, .01), (.47, .085, .27), ink)
bind(opening, 'wrist')
for x in (-.28, .04, .35):
    seam = ellipsoid('PalmStitch', (x, .13, .317), (.024, .24, .022), ink)
    bind(seam, 'palm')

# Angles in degrees: proximal curl, distal curl, spread. Local X curls toward palm.
poses = {
    'idle': {'index': (7, 9, -4), 'middle': (30, 32, 0), 'outer': (38, 36, 7), 'thumb': (8, 8, -8)},
    'pinch': {'index': (5, 5, 35), 'middle': (65, 83, 0), 'outer': (72, 88, 7), 'thumb': (8, 8, -8)},
    'grab': {'index': (78, 94, 0), 'middle': (83, 100, 0), 'outer': (85, 98, 0), 'thumb': (46, 45, -27)},
    'press': {'index': (3, 12, 0), 'middle': (79, 100, 0), 'outer': (83, 98, 5), 'thumb': (32, 35, -17)},
}
for name, pose in poses.items():
    rig.animation_data_create()
    rig.animation_data.action = bpy.data.actions.new(name)
    for bone in rig.pose.bones:
        bone.rotation_mode = 'XYZ'
        bone.rotation_euler = (0, 0, 0)
    for finger, (curl, tip, spread) in pose.items():
        rig.pose.bones[f'{finger}_1'].rotation_euler = tuple(math.radians(a) for a in (curl, 0, spread))
        rig.pose.bones[f'{finger}_2'].rotation_euler.x = math.radians(tip)
    if name == 'pinch':
        rig.pose.bones['index_2'].rotation_euler.z = math.radians(95)
    # Constant pose clips blend continuously in the browser, independently of skin.
    for frame in (1, 25):
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_euler', frame=frame, group=bone.name)
    action = rig.animation_data.action
    action.use_fake_user = True
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.rotation_euler = (0, 0, 0)
bpy.data.libraries.write(str(OUT / 'hand-rig.blend'), {rig}, fake_user=True, compress=True)
(OUT / 'rig-contract.json').write_text(json.dumps({
    'version': 'webpod.hand.v1',
    'rig': 'HandRig',
    'poses': list(poses),
    'contacts': ['contact_index', 'contact_thumb'],
    'exportAxes': 'glTF: X right, Y up, Z toward viewer',
    'bones': [{'name': bone.name, 'parent': bone.parent.name if bone.parent else None,
               'deform': bone.use_deform} for bone in armature.bones],
}, indent=2) + '\n')

scene = bpy.context.scene
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 25
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for obj in skin_collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(PUBLIC / 'classic-glove.glb'),
    export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='ACTIONS', export_force_sampling=True,
    export_all_influences=False, export_def_bones=False, export_extras=True)

# Studio for editable source and contact-sheet renders; excluded from web export.
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.world.color = (.3, .3, .3)
bpy.ops.object.camera_add(location=xyz((0, .4, 9)))
camera = bpy.context.object
camera.rotation_euler = (xyz((0, .3, 0))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.8
scene.camera = camera
for pos, energy, size in [((-3, 5, 6), 650, 4), ((4, 2, 3), 280, 3), ((1, 4, -2), 400, 3)]:
    bpy.ops.object.light_add(type='AREA', location=xyz(pos))
    light = bpy.context.object
    light.data.energy, light.data.shape, light.data.size = energy, 'DISK', size
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'classic-glove.blend'))
for name in poses:
    rig.animation_data.action = bpy.data.actions[name]
    scene.frame_set(1)
    scene.render.filepath = str(EVIDENCE / f'glove-{name}.png')
    bpy.ops.render.render(write_still=True)
print('HAND_ASSET_COMPLETE', len(glove.data.vertices), 'vertices', PUBLIC / 'classic-glove.glb')
