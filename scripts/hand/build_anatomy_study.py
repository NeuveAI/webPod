"""Blender structural study using the installed Rigify human rest skeleton.
Not an approved glove or browser asset. Uses Rigify through its public create API.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/hand/anatomy-study'
EVIDENCE=ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/anatomy-study'
for p in (OUT,EVIDENCE): p.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.preferences.addon_enable(module='rigify')
from rigify.metarigs import human
source=bpy.data.objects.new('Rigify source',bpy.data.armatures.new('Rigify source'))
bpy.context.collection.objects.link(source); bpy.context.view_layer.objects.active=source; source.select_set(True)
human.create(source); bpy.ops.object.mode_set(mode='OBJECT')
w=source.data.bones['hand.L'].head_local
v=(source.data.bones['f_middle.01.L'].head_local-w).normalized()
x=source.data.bones['palm.04.L'].tail_local-source.data.bones['palm.01.L'].tail_local
x=(x-v*x.dot(v)).normalized(); z=x.cross(v).normalized(); rot=Matrix((x,v,z))
# Right-handed coordinate frame; +Z is PALMAR in this source, -Z is DORSAL.
records={}
for b in source.data.bones:
    if b.name.endswith('.L') and b.name.startswith(('hand.','palm.','thumb.','f_')):
        m=(rot@b.matrix_local.to_3x3()).to_4x4(); m.translation=rot@(b.head_local-w)*20
        records[b.name]=(m,b.length*20,b.parent.name if b.parent else None)
bpy.data.objects.remove(source,do_unlink=True)
rig=bpy.data.objects.new('Anatomy • articulation study',bpy.data.armatures.new('Anatomy structure'))
bpy.context.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(mat,length,parent) in records.items():
    b=rig.data.edit_bones.new(name)
    b.head=mat.translation
    b.tail=b.head+mat.to_3x3().col[1]*length
    b.align_roll(mat.to_3x3().col[2])
for name,(mat,length,parent) in records.items():
    if parent in records: rig.data.edit_bones[name].parent=rig.data.edit_bones[parent]
# Thumb metacarpal articulates at its own proximal base, independently of index.
rig.data.edit_bones['thumb.01.L'].parent=rig.data.edit_bones['hand.L']
bpy.ops.object.mode_set(mode='OBJECT'); rig.show_in_front=True
for pb in rig.pose.bones:
    pb.rotation_mode='XYZ'
    if pb.name.startswith('f_'):
        pb.lock_rotation=(False,True,not '.01.' in pb.name)
    if pb.name.startswith('thumb.') and not '.01.' in pb.name:
        pb.lock_rotation=(False,True,True)
rig['Status']='Structural study; anatomy and design not approved'
rig['Coordinates']='+Z palmar; -Z dorsal. Source is left human hand.'
rig['Source']='Installed Blender Rigify human.create; rest lengths and orientations retained'
rig['Thumb semantics']='thumb.01 = metacarpal; thumb.02 = proximal; thumb.03 = distal'
rig['Finger semantics']='.01 = proximal; .02 = middle; .03 = distal; palm bones = metacarpals'

def mat(name,color,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    s=m.node_tree.nodes.get('Principled BSDF'); s.inputs['Base Color'].default_value=(*color,1); s.inputs['Roughness'].default_value=.38; s.inputs['Metallic'].default_value=metal
    return m
ivory=mat('Phalanges • ivory',(.77,.70,.54))
blue=mat('Metacarpals • blue',(.13,.39,.53))
thumbmat=mat('Thumb chain • coral',(.8,.26,.13))
axis=mat('Flexion axis • turquoise',(.09,.8,.66))
dark=mat('Joint hubs',(.085,.12,.15),.25)
white=mat('Labels',(.75,.84,.87))

def bind(obj,bone):
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    vg=obj.vertex_groups.new(name=bone); vg.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Follow anatomical segment','ARMATURE'); mod.object=rig
    obj.select_set(False)

def sphere(p,r,m,bone,name):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=r,location=p)
    o=bpy.context.object; o.name=name; o.data.materials.append(m)
    for f in o.data.polygons: f.use_smooth=True
    bind(o,bone)

def rod(a,b,r,m,bone,name):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=r,radius2=r*.75,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.name=name; o.rotation_mode='QUATERNION'; o.rotation_quaternion=Vector((0,0,1)).rotation_difference((b-a).normalized()); o.data.materials.append(m)
    for f in o.data.polygons: f.use_smooth=True
    bind(o,bone)
for name,b in rig.data.bones.items():
    if name=='hand.L': continue
    a,bp=b.head_local,b.tail_local; d=(bp-a).normalized()
    isthumb=name.startswith('thumb.'); ispalm=name.startswith('palm.')
    color=thumbmat if isthumb else blue if ispalm else ivory
    radius=.083 if ispalm else .1 if isthumb else .085
    rod(a+d*.07,bp-d*.06,radius,color,name,name+' • segment')
    sphere(a,.104,dark,name,name+' • joint')
    if '.03.' in name and not ispalm: sphere(bp,.075,color,name,name+' • tip')
    if not ispalm:
        hinge=b.matrix_local.to_3x3().col[0]
        rod(a-hinge*.18,a+hinge*.18,.019,axis,name,name+' • X hinge')
# Wrist anchor, a visual marker only, not a claim to model all carpal bones.
sphere((0,0,0),.15,blue,'hand.L','Wrist anchor (carpal bones omitted)')

# Preserve local hinge rotations; never solve finger contact by sideways PIP/DIP.
poses={
 'neutral':{},
 'pinch':{'f_index.01.L':(.35,0,0),'f_index.02.L':(.65,0,0),'f_index.03.L':(.3,0,0),
          'f_middle.01.L':(.36,0,0),'f_middle.02.L':(.56,0,0),'f_middle.03.L':(.25,0,0),
          'f_ring.01.L':(.4,0,0),'f_ring.02.L':(.61,0,0),'f_ring.03.L':(.25,0,0),
          'f_pinky.01.L':(.35,0,0),'f_pinky.02.L':(.5,0,0),'f_pinky.03.L':(.25,0,0)}
}
def apply(p):
    for pb in rig.pose.bones: pb.rotation_euler=p.get(pb.name,(0,0,0))
    bpy.context.view_layer.update()
apply(poses['pinch'])
# Fit opposing pad landmarks using thumb opposition and index hinge flexion only.
# Markers describe contact orientation; they are not a substitute for skin review.
params=[.2,-.2,0.,.15,.15,.55,.8,.25]
preferred=params[:]
bounds=[(-.6,1.0),(-.8,.8),(-.8,.8),(0,.7),(0,.65),(.15,1.1),(.3,1.4),(.1,.75)]
def pad(name):
    pb=rig.pose.bones[name]
    normal=pb.matrix.to_3x3().col[2].normalized()
    return pb.tail-pb.matrix.to_3x3().col[1]*.12+normal*.14,normal
def score(vals):
    rig.pose.bones['thumb.01.L'].rotation_euler=vals[:3]
    rig.pose.bones['thumb.02.L'].rotation_euler=(vals[3],0,0)
    rig.pose.bones['thumb.03.L'].rotation_euler=(vals[4],0,0)
    for j in range(3): rig.pose.bones[f'f_index.0{j+1}.L'].rotation_euler=(vals[5+j],0,0)
    bpy.context.view_layer.update()
    a,an=pad('thumb.03.L'); b,bn=pad('f_index.03.L')
    return (a-b).length_squared+.15*(1+an.dot(bn))**2+sum((v-p)**2 for v,p in zip(vals,preferred))*.002
for step in (.2,.08,.03,.01,.003):
    for iteration in range(40):
        changed=False
        for j in range(8):
            best=score(params); chosen=params[:]
            for sign in (-1,1):
                test=params[:]; test[j]=max(bounds[j][0],min(bounds[j][1],test[j]+sign*step))
                result=score(test)
                if result<best: best=result; chosen=test; changed=True
            params=chosen
        if not changed: break
poses['pinch'].update({'thumb.01.L':tuple(params[:3]),'thumb.02.L':(params[3],0,0),'thumb.03.L':(params[4],0,0)})
for j in range(3): poses['pinch'][f'f_index.0{j+1}.L']=(params[5+j],0,0)
apply(poses['pinch'])
pad_a,normal_a=pad('thumb.03.L'); pad_b,normal_b=pad('f_index.03.L')
report={'source':rig['Source'],'coordinates':rig['Coordinates'],'thumb_semantics':rig['Thumb semantics'],
        'thumb_and_index_fit_radians':params,'pad_landmark_distance':(pad_a-pad_b).length,'pad_normal_dot':normal_a.dot(normal_b),
        'poses':poses,'limitations':['Not a glove mesh','Not all carpal bones modeled','Fitting tip proximity does not prove pad opposition','Not approved for integration']}
(EVIDENCE/'structure.json').write_text(json.dumps(report,indent=2))
# Rest-space pad normal markers articulate with the distal bones.
apply(poses['neutral'])
for name in ('thumb.03.L','f_index.03.L'):
    p,n=pad(name); sphere(p,.055,axis,name,name+' • pad contact landmark')
    rod(p,p+n*.18,.012,axis,name,name+' • pad normal')
# Animation of real local bone rotations, no smear or surface hiding the joints.
for frame,p in ((1,poses['neutral']),(25,poses['neutral']),(55,poses['pinch']),(85,poses['pinch']),(115,poses['neutral'])):
    apply(p)
    for pb in rig.pose.bones: pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=pb.name)
scene=bpy.context.scene; scene.frame_start=1; scene.frame_end=115
max_joint_gap=0.0
max_lateral_hinge_rotation=0.0
for frame in range(1,116):
    scene.frame_set(frame)
    for pb in rig.pose.bones:
        if pb.name.startswith('f_'):
            max_joint_gap=max(max_joint_gap,(pb.head-pb.parent.tail).length)
            if '.01.' not in pb.name:
                max_lateral_hinge_rotation=max(max_lateral_hinge_rotation,abs(pb.rotation_euler.y),abs(pb.rotation_euler.z))
report['animation_audit']={'frames_inspected':115,'max_finger_joint_gap':max_joint_gap,'max_PIP_DIP_lateral_rotation_radians':max_lateral_hinge_rotation}
(EVIDENCE/'structure.json').write_text(json.dumps(report,indent=2))
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=1100; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.world.color=(.08,.08,.08)
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.022,.03,.043,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45

def aim(o,p):
    forward=(Vector(p)-o.location).normalized()
    right=forward.cross(Vector((0,1,0))).normalized(); up=right.cross(forward)
    o.rotation_euler=Matrix((right,up,-forward)).transposed().to_euler()
bpy.ops.object.camera_add(location=(4,-4,-11)); cam=bpy.context.object; cam.name='Dorsal review camera'; cam.data.type='ORTHO'; cam.data.ortho_scale=5.7; aim(cam,(.1,1.8,.45)); scene.camera=cam
for pos,power,size in (((-3,1,-6),650,5),((4,4,-3),450,4),((0,2,5),700,3)):
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; aim(o,(0,2,.3))
# Save editable anatomy rig plus neutral/posed render evidence.
for title,frame,loc in [('neutral-dorsal',1,(2,-3,-12)),('pinch-dorsal',55,(2,-3,-12)),('pinch-side',55,(-10,1,-2))]:
    scene.frame_set(frame); cam.location=loc; aim(cam,(.1,1.8,.45)); scene.render.filepath=str(EVIDENCE/(title+'.png')); bpy.ops.render.render(write_still=True)
scene.frame_set(55); cam.location=(2,-3,-12); aim(cam,(.1,1.8,.45))
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'anatomy-study.blend'))
print('ANATOMY_STUDY_COMPLETE',json.dumps(report))
