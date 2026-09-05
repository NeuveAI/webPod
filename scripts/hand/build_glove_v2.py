"""Blender-only design revision. No browser export or integration.

Primary reference: owner-glove.png. Thick constant-radius digits, dorsal view,
real rolled cuff, continuous surface, heat skinning and reusable control rig.
"""
import bpy
import math
import json
from mathutils import Vector
from mathutils.kdtree import KDTree
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/hand/review-v2'
EVIDENCE = ROOT / 'docs/workstreams/013-cartoon-hand-cursor/evidence/review-v2'
OUT.mkdir(exist_ok=True, parents=True)
EVIDENCE.mkdir(exist_ok=True, parents=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def material(name, color, rough=.48):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    return mat

ivory = material('Warm ivory • padded cotton', (.76, .69, .54))
shader = ivory.node_tree.nodes.get('Principled BSDF')
shader.inputs['Subsurface Weight'].default_value = .045
shader.inputs['Sheen Weight'].default_value = .12
seam_mat = material('Dorsal seams • warm recessed thread', (.39, .33, .25), .72)
cuff_mat = material('Cuff • soft ivory', (.82, .76, .62))
lining_mat = material('Interior lining', (.32, .28, .21), .85)
floor_mat = material('Charcoal studio', (.012, .016, .022), .8)

skin = bpy.data.collections.new('SKIN • padded glove')
rig_col = bpy.data.collections.new('RIG • reusable controls')
studio = bpy.data.collections.new('STUDIO • review only')
for collection in (skin, rig_col, studio):
    bpy.context.scene.collection.children.link(collection)

def move(obj, collection):
    for previous in list(obj.users_collection): previous.objects.unlink(obj)
    collection.objects.link(obj)

def ellipsoid(name, center, scale, mat=ivory):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons: face.use_smooth = True
    move(obj, skin)
    return obj

# Dorsal surface is +Z. Fingers point +Y and bend toward palm (-Z).
CHAINS = {
    'index': [(-.64,.48,0),(-.66,1.06,0),(-.68,1.60,0),(-.68,2.08,0)],
    'middle': [(.07,.55,0),(.08,1.05,0),(.09,1.54,0),(.10,1.92,0)],
    'outer': [(.72,.40,0),(.82,.82,0),(.87,1.19,0),(.91,1.50,0)],
    'thumb': [(-.59,-.44,-.10),(-.94,-.17,-.08),(-1.18,.15,-.06),(-1.32,.48,-.04)],
}
RADII = {'index': .335, 'middle': .35, 'outer': .33, 'thumb': .335}
volumes = [ellipsoid('Padded back', (.02,-.06,.005), (1.02,.92,.44)),
           ellipsoid('Wrist transition', (.08,-.93,0), (.60,.56,.34)),
           ellipsoid('Thumb saddle', (-.62,-.33,-.035), (.52,.55,.38))]

def capsule(a, b, radius):
    """A constant-width capsule avoids the tapered joints of joined ellipsoids."""
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0,0,1)).rotation_difference((b-a).normalized())
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    move(obj, skin)
    volumes.append(obj)

for name, points in CHAINS.items():
    for a, b in zip(points, points[1:]): capsule(a, b, RADII[name])
    for p in points: volumes.append(ellipsoid(name+' padding', p, (RADII[name],)*3))

bpy.ops.object.select_all(action='DESELECT')
for obj in volumes: obj.select_set(True)
bpy.context.view_layer.objects.active = volumes[0]
bpy.ops.object.join()
glove = bpy.context.object
glove.name = 'PaddedGlove'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
remesh = glove.modifiers.new('Continuous sewn volume', 'REMESH')
remesh.mode = 'VOXEL'
remesh.voxel_size = .037
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth = glove.modifiers.new('Round saddle transitions', 'SMOOTH')
smooth.factor = .7
smooth.iterations = 5
bpy.ops.object.modifier_apply(modifier=smooth.name)
for face in glove.data.polygons: face.use_smooth = True

arm = bpy.data.armatures.new('PaddedHandSkeleton_v2')
rig = bpy.data.objects.new('HandRig_v2', arm)
rig_col.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
segments = {'wrist':((.08,-1.48,0),(.08,-.72,0)), 'back':((.08,-.72,0),(.02,.44,0))}
for name, points in CHAINS.items():
    for i in range(3): segments[f'{name}_{i+1}']=(points[i],points[i+1])
for name,(a,b) in segments.items():
    bone=arm.edit_bones.new(name)
    bone.head, bone.tail = a,b
    bone.align_roll(Vector((0,0,1)))
    if name=='back': bone.parent=arm.edit_bones['wrist']
    elif '_' in name:
        finger, n=name.split('_')
        bone.parent=arm.edit_bones['back' if n=='1' else f'{finger}_{int(n)-1}']
        bone.use_connect=n!='1'
for finger,points in CHAINS.items():
    control=arm.edit_bones.new('CTRL_'+finger)
    control.head=Vector(points[0])+Vector((0,0,1.15))
    control.tail=control.head+Vector((0,.32,0))
    control.use_deform=False
    control.parent=arm.edit_bones['wrist']
for finger in ('index','thumb'):
    contact=arm.edit_bones.new('contact_'+finger)
    points=CHAINS[finger]
    contact.head=Vector(points[-1])+(Vector(points[-1])-Vector(points[-2])).normalized()*RADII[finger]
    contact.tail=contact.head+Vector((0,.15,0))
    contact.parent=arm.edit_bones[finger+'_3']
    contact.use_deform=False
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
rig['reference']='Owner supplied glove. Dorsal +Z, palm -Z, three padded fingers and thumb.'
rig['controls']='CTRL_* custom properties: curl, spread, side_bend. Wrist/back FK.'

# Heat diffusion skinning on the continuous manifold; no nearest-chain cutoff.
bpy.ops.object.select_all(action='DESELECT')
glove.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bpy.context.view_layer.objects.active=glove
for vertex in glove.data.vertices: vertex.select=True
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
for modifier in glove.modifiers:
    if modifier.type=='ARMATURE': modifier.use_deform_preserve_volume=True
corrective=glove.modifiers.new('Joint volume relaxation', 'CORRECTIVE_SMOOTH')
corrective.factor=.35
corrective.iterations=5
subd=glove.modifiers.new('Review surface finish', 'SUBSURF')
subd.levels=1
subd.render_levels=1

def rigid_bind(obj, bone='wrist'):
    obj.parent=rig
    group=obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Skeleton', 'ARMATURE')
    mod.object=rig

# A rounded rectangular open cuff with actual wall thickness and rolled edges.
verts=[]; faces=[]; rings=64
profiles=[(-1.53,.67,.39),(-1.50,.74,.44),(-1.42,.77,.46),(-1.18,.76,.45),
          (-1.10,.71,.41),(-1.11,.61,.33),(-1.18,.59,.31),(-1.43,.60,.31),(-1.51,.61,.33)]
for y,rx,rz in profiles:
    for i in range(rings):
        angle=2*math.pi*i/rings
        x=math.copysign(abs(math.cos(angle))**.64,math.cos(angle))*rx
        z=math.copysign(abs(math.sin(angle))**.72,math.sin(angle))*rz
        verts.append((x+.08,y,z))
for j in range(len(profiles)):
    for i in range(rings):
        k=(j+1)%len(profiles)
        faces.append((j*rings+i,j*rings+(i+1)%rings,k*rings+(i+1)%rings,k*rings+i))
mesh=bpy.data.meshes.new('Rounded cuff topology'); mesh.from_pydata(verts,[],faces); mesh.update()
cuff=bpy.data.objects.new('Rolled open cuff',mesh);skin.objects.link(cuff);mesh.materials.append(cuff_mat)
for face in mesh.polygons: face.use_smooth=True
sub=cuff.modifiers.new('Soft cuff edge', 'SUBSURF');sub.levels=2
rigid_bind(cuff)

# Surface-following thread with the same smooth skin weights as the back beneath.
tree=KDTree(len(glove.data.vertices))
for vertex in glove.data.vertices: tree.insert(vertex.co,vertex.index)
tree.balance()
for x in (-.38,.02,.42):
    curve=bpy.data.curves.new('Dorsal seam path','CURVE');curve.dimensions='3D'
    curve.bevel_depth=.012;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(12)
    for i,point in enumerate(spline.points):
        y=-.22+i*.035
        hit,location,normal,_=glove.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        assert hit
        p=location+normal*.003
        point.co=(*p,1)
        point.radius=.3+.7*math.sin(math.pi*i/12)**.6
    seam=bpy.data.objects.new('Dorsal stitch',curve);skin.objects.link(seam);curve.materials.append(seam_mat)
    bpy.ops.object.select_all(action='DESELECT');seam.select_set(True);bpy.context.view_layer.objects.active=seam
    bpy.ops.object.convert(target='MESH');seam=bpy.context.object
    for group in glove.vertex_groups: seam.vertex_groups.new(name=group.name)
    for vertex in seam.data.vertices:
        nearest=tree.find_n(vertex.co,3);total=sum(1/max(.001,item[2])**2 for item in nearest)
        weights={}
        for _,idx,distance in nearest:
            factor=(1/max(.001,distance)**2)/total
            for g in glove.data.vertices[idx].groups: weights[g.group]=weights.get(g.group,0)+factor*g.weight
        for group,weight in weights.items(): seam.vertex_groups[group].add([vertex.index],weight,'REPLACE')
    seam.parent=rig
    modifier=seam.modifiers.new('Follow dorsal skin','ARMATURE');modifier.object=rig;modifier.use_deform_preserve_volume=True

def driver(bone, channel, prop, expression):
    curve=bone.driver_add('rotation_euler',channel)
    variable=curve.driver.variables.new();variable.name='v';variable.type='SINGLE_PROP'
    variable.targets[0].id=rig
    finger=bone.name.rsplit('_',1)[0]
    variable.targets[0].data_path=f'pose.bones["CTRL_{finger}"]["{prop}"]'
    curve.driver.expression=expression

for finger in CHAINS:
    ctrl=rig.pose.bones['CTRL_'+finger]
    for prop,low,high in [('curl',0,1),('spread',-1,1),('side_bend',-1,1)]:
        ctrl[prop]=0.0
        ctrl.id_properties_ui(prop).update(min=low,max=high,soft_min=low,soft_max=high)
    for i,angle in enumerate((65,85,60),1):
        bone=rig.pose.bones[f'{finger}_{i}'];bone.rotation_mode='XYZ'
        driver(bone,0,'curl',f'-v*{math.radians(angle)}')
        driver(bone,2,'spread' if i==1 else 'side_bend',f'v*{math.radians(45 if i==1 else 55 if i==2 else 70)}')

POSES={
 'idle': {'index':(.09,-.04,0),'middle':(.21,0,0),'outer':(.29,-.06,0),'thumb':(.08,.03,0)},
 'pinch':{'index':(.03,.17,.95),'middle':(.69,0,0),'outer':(.78,-.05,0),'thumb':(.03,-.02,0)},
 'grab': {'index':(.82,0,0),'middle':(.86,0,0),'outer':(.89,-.04,0),'thumb':(.20,-.30,0)},
 'press':{'index':(.025,0,0),'middle':(.79,0,0),'outer':(.86,-.03,0),'thumb':(.31,-.30,0)},
}
rig.animation_data_create()
for name,pose in POSES.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for finger,values in pose.items():
        ctrl=rig.pose.bones['CTRL_'+finger]
        for prop,value in zip(('curl','spread','side_bend'),values):
            ctrl[prop]=float(value)
            for frame in (1,25): ctrl.keyframe_insert(data_path=f'["{prop}"]',frame=frame)
    action.use_fake_user=True
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True

scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(.12,.12,.12)
scene.view_settings.view_transform='AgX'
scene.render.fps=24
scene.frame_start=1;scene.frame_end=25

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.55))
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(floor_mat);move(floor,studio)

def aim(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-3,-4,10))
camera=bpy.context.object;camera.name='Review • dorsal 63° elevation';move(camera,studio)
camera.data.type='ORTHO';camera.data.ortho_scale=5.9
aim(camera,(0,.30,-.15));scene.camera=camera
for name,pos,energy,size,color in [
 ('Key',(-3,1,7),650,5,(1,.91,.76)),
 ('Fill',(5,-1,5),420,4,(.78,.87,1)),
 ('Rim',(-2,5,3),650,3,(1,.91,.77))]:
    bpy.ops.object.light_add(type='AREA',location=pos)
    light=bpy.context.object;light.name=name;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.data.color=color
    aim(light,(0,.3,0));move(light,studio)

rig.animation_data.action=bpy.data.actions['pinch'];scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'padded-glove.blend'))
bpy.data.libraries.write(str(OUT/'hand-rig.blend'),{rig},fake_user=True,compress=True)
for name in POSES:
    rig.animation_data.action=bpy.data.actions[name];scene.frame_set(1);bpy.context.view_layer.update()
    scene.render.filepath=str(EVIDENCE/f'{name}.png');bpy.ops.render.render(write_still=True)
print('REVIEW_V2',len(glove.data.vertices),'vertices; Blender-only; no browser changes')
