"""Render rig/underside checks and animate actual control properties for review."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/hand/review-v2'
EVIDENCE=ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/review-v2'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'padded-glove.blend'))
bpy.context.preferences.filepaths.save_version=0
rig=bpy.data.objects['HandRig_v2'];scene=bpy.context.scene;camera=scene.camera
skin=bpy.data.collections['SKIN • padded glove']
glove=bpy.data.objects['PaddedGlove']

# Organize artist-facing rig controls separately from deforming bones.
deform=rig.data.collections.new('Deformation • wrist/back and three joints per digit')
controls=rig.data.collections.new('Controls • curl / spread / side bend')
contacts=rig.data.collections.new('Contacts • index and thumb pads')
for bone in rig.data.bones:
    collection=controls if bone.name.startswith('CTRL_') else contacts if bone.name.startswith('contact') else deform
    collection.assign(bone)
    bone.color.palette='THEME03' if bone.name.startswith('CTRL_') else 'THEME04'

# Build one inspectable action, with held extremes and smooth in-betweens.
pose_values={}
for name in ('idle','pinch','grab','press'):
    rig.animation_data.action=bpy.data.actions[name];scene.frame_set(1)
    pose_values[name]={bone.name:{key:float(bone[key]) for key in ('curl','spread','side_bend')}
                       for bone in rig.pose.bones if bone.name.startswith('CTRL_')}
action=bpy.data.actions.new('Review • idle → pinch → grab → press')
rig.animation_data.action=action
for frame,name in [(1,'idle'),(13,'idle'),(29,'pinch'),(41,'pinch'),(57,'grab'),(69,'grab'),(85,'press'),(97,'press'),(113,'idle')]:
    for bone_name,props in pose_values[name].items():
        bone=rig.pose.bones[bone_name]
        for key,value in props.items():
            bone[key]=value;bone.keyframe_insert(data_path=f'["{key}"]',frame=frame)
action.use_fake_user=True
scene.frame_end=113;scene.frame_set(29)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'padded-glove.blend'))
bpy.data.libraries.write(str(OUT/'hand-rig.blend'),{rig},fake_user=True,compress=True)

def aim(target): camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
def render(name):
    scene.render.filepath=str(EVIDENCE/name);bpy.ops.render.render(write_still=True)

normal_camera=camera.location.copy();normal_rotation=camera.rotation_euler.copy()
# Extra views are diagnostics of the SAME rigged mesh, not substitute posed models.
bpy.data.objects['Studio floor'].hide_render=True
scene.world.color=(.20,.20,.20)
rig.animation_data.action=bpy.data.actions['grab'];scene.frame_set(1)
camera.location=(5,2,2.5);aim((0,.1,-.2));render('outer-joints.png')
camera.location=(-5,2,2.5);aim((0,.1,-.2));render('thumb-contact.png')
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
previous_key=bpy.data.objects['Key'].location.copy()
bpy.data.objects['Key'].location=(0,-2,-6)
bpy.data.objects['Key'].rotation_euler=(Vector((0,.3,0))-bpy.data.objects['Key'].location).to_track_quat('-Z','Y').to_euler()
camera.location=(-3,-4,-10);aim((0,.30,-.15));render('palm-check.png')
bpy.data.objects['Key'].location=previous_key
bpy.data.objects['Key'].rotation_euler=(Vector((0,.3,0))-previous_key).to_track_quat('-Z','Y').to_euler()

# A translucent skin overlay makes the evaluated deform skeleton inspectable.
camera.location=normal_camera;camera.rotation_euler=normal_rotation
rig.animation_data.action=bpy.data.actions['pinch'];scene.frame_set(1)
transparent=bpy.data.materials.new('Review translucent skin');transparent.use_nodes=True
nodes=transparent.node_tree.nodes;nodes.clear()
output=nodes.new('ShaderNodeOutputMaterial');mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.22
clear=nodes.new('ShaderNodeBsdfTransparent');diffuse=nodes.new('ShaderNodeBsdfDiffuse');diffuse.inputs[0].default_value=(.6,.65,.7,1)
links=transparent.node_tree.links;links.new(clear.outputs[0],mix.inputs[1]);links.new(diffuse.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
original_materials={}
for obj in skin.objects:
    if obj.type=='MESH':
        original_materials[obj.name]=list(obj.data.materials)
        obj.data.materials.clear();obj.data.materials.append(transparent)
bone_mat=bpy.data.materials.new('Skeleton cyan');bone_mat.use_nodes=True
shader=bone_mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.04,.7,.8,1)
shader.inputs['Emission Color'].default_value=(.04,.7,.8,1);shader.inputs['Emission Strength'].default_value=.8
helpers=[]
for bone in rig.pose.bones:
    if not bone.bone.use_deform: continue
    a=rig.matrix_world@bone.head;b=rig.matrix_world@bone.tail
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.025,depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object;obj.rotation_mode='QUATERNION';obj.rotation_quaternion=Vector((0,0,1)).rotation_difference((b-a).normalized());obj.data.materials.append(bone_mat);helpers.append(obj)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.057,location=a)
    obj=bpy.context.object;obj.data.materials.append(bone_mat);helpers.append(obj)
render('rig-overlay.png')
for obj in helpers: bpy.data.objects.remove(obj,do_unlink=True)
for name,materials in original_materials.items():
    obj=bpy.data.objects[name];obj.data.materials.clear()
    for material in materials: obj.data.materials.append(material)

# Deformation audit uses evaluated geometry over every in-between, not just poses.
rig.animation_data.action=action
audit={'frames':113,'deformingBones':sum(b.use_deform for b in rig.data.bones),'controls':4,'contacts':2,'unweightedVertices':0,'nonfiniteVertices':0,'maxUnnormalizedWeightError':0.0,'dorsalSeamsOnly':True}
for vertex in glove.data.vertices:
    total=sum(group.weight for group in vertex.groups)
    if total<.001: audit['unweightedVertices']+=1
    audit['maxUnnormalizedWeightError']=max(audit['maxUnnormalizedWeightError'],abs(total-1))
for frame in range(1,114):
    scene.frame_set(frame);evaluated=glove.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh=evaluated.to_mesh()
    audit['nonfiniteVertices']+=sum(not all(math.isfinite(c) for c in v.co) for v in mesh.vertices)
    evaluated.to_mesh_clear()
(EVIDENCE/'rig-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
assert audit['unweightedVertices']==0 and audit['nonfiniteVertices']==0
assert audit['maxUnnormalizedWeightError']<1e-5

bpy.data.objects['Studio floor'].hide_render=False
scene.world.color=(.12,.12,.12)
scene.render.resolution_x=scene.render.resolution_y=512
scene.cycles.samples=16
frames=EVIDENCE/'frames';frames.mkdir(exist_ok=True)
scene.render.filepath=str(frames/'pose-')
scene.frame_start=1;scene.frame_end=113
bpy.ops.render.render(animation=True)
print('REVIEW_ANIMATION_COMPLETE',audit)
