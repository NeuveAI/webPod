"""Padded cartoon skin built around the anatomy study. Blender review only."""
import bpy, math, json
from mathutils import Vector, Matrix, Euler
from mathutils.kdtree import KDTree
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/hand/review-v3'; OUT.mkdir(parents=True,exist_ok=True)
EV=ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/review-v3'; EV.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/hand/anatomy-study/anatomy-study.blend'))
bpy.context.preferences.filepaths.save_version=0
rig=bpy.data.objects['Anatomy • articulation study']; rig.name='HandRig_v3'
rig.animation_data_clear()
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
# Widen the thumb in bind pose to preserve a real thumb/index web when skinning.
rig.pose.bones['thumb.01.L'].rotation_euler.x=-.45
bpy.context.view_layer.update()
rest={pb.name:(pb.matrix.copy(),pb.length) for pb in rig.pose.bones}
for o in list(bpy.data.objects):
    if o!=rig and o.type not in {'LIGHT','CAMERA'}: bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for b in list(rig.data.edit_bones):
    if b.name.startswith(('f_ring.','palm.03.')): rig.data.edit_bones.remove(b)
for b in rig.data.edit_bones:
    m,l=rest[b.name]; b.head=m.translation; b.tail=b.head+m.to_3x3().col[1]*l; b.align_roll(m.to_3x3().col[2])
    if b.name.startswith(('palm.02.','f_middle.')): b.head.x+=.23; b.tail.x+=.23
# Cartoon proportions: compact palm while preserving phalanx lengths and hinge axes.
for prefix,palm_name in (('f_index','palm.01.L'),('f_middle','palm.02.L'),('f_pinky','palm.04.L')):
    shift=rig.data.edit_bones[palm_name].tail.y*.20
    for j in range(1,4):
        b=rig.data.edit_bones[f'{prefix}.0{j}.L'];b.head.y-=shift;b.tail.y-=shift
thumb_shift=rig.data.edit_bones['thumb.01.L'].head.y*.20
for j in range(1,4):
    b=rig.data.edit_bones[f'thumb.0{j}.L'];b.head.y-=thumb_shift;b.tail.y-=thumb_shift
for b in rig.data.edit_bones:
    if b.name.startswith('palm.') or b.name=='hand.L':b.head.y*=.8;b.tail.y*=.8
bpy.ops.object.mode_set(mode='OBJECT')
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
rig['Status']='Draft padded skin; owner design and rig approval pending'
rig.pose.bones['thumb.01.L'].rotation_mode='YXZ'
rig['Digit count']='Three fingers plus thumb; pending owner preference'
rig['Coordinates']='+Z palmar; -Z dorsal'
rig['Controls']='Direct local FK; PIP/DIP hinge axes locked. Production control layer pending.'

def mat(name,c,rough=.48):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1);s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=rough;return m
ivory=mat('Ivory padded glove',(.83,.77,.65)); ivory.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.045
cuffmat=mat('Soft folded cuff',(.88,.82,.71));seammat=mat('Dorsal thread',(.45,.39,.30),.7)
vol=[]
def uv(name,p,sc):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=18,location=p);o=bpy.context.object;o.name=name;o.scale=sc;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);vol.append(o);return o
# Cross-sections give a flatter back, broader palm and narrower wrist than spheres.
verts=[];faces=[];N=40
sections=[(.02,.49,.28),(.16,.56,.30),(.46,.73,.34),(.95,.9,.38),(1.5,.96,.39),(1.92,.89,.35),(2.17,.76,.27),(2.29,.61,.18)]
for y,rx,rz in sections:
 y*=.8;rz*=1.1
 for i in range(N):
  a=2*math.pi*i/N; x=.20+rx*math.copysign(abs(math.cos(a))**.84,math.cos(a)); z=.12+rz*math.sin(a);verts.append((x,y,z))
for j in range(len(sections)-1):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
faces.extend([tuple(reversed(range(N))),tuple((len(sections)-1)*N+i for i in range(N))])
mesh=bpy.data.meshes.new('Palm cross sections');mesh.from_pydata(verts,[],faces);mesh.update();palm=bpy.data.objects.new('Palm volume',mesh);bpy.context.collection.objects.link(palm);vol.append(palm)
uv('Thenar mass',(-.36,.64,.31),(.51,.54,.40))
uv('Hypothenar pad',(.80,.91,.26),(.37,.72,.34))
# Rounded, padded segments with continuous volume through the anatomical hinges.
radii={'f_index':.285,'f_middle':.30,'f_pinky':.27,'thumb':.30}
for prefix,r in radii.items():
 for j in range(1,4):
  b=rig.data.bones[f'{prefix}.0{j}.L'];a,bp=b.head_local,b.tail_local
  if prefix=='thumb' and j==1: rr=.34
  else: rr=r*(1-.045*(j-1))
  # A continuous tube with rounded joints avoids repeated sphere-union banding.
  bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=rr,depth=(bp-a).length,location=(a+bp)/2)
  o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference((bp-a).normalized());vol.append(o)
  for center in (a,bp):uv(prefix+' joint padding',center,(rr,rr,rr))
# Join voxel volume, then use diffusion weights rather than nearest-finger cutoffs.
bpy.ops.object.select_all(action='DESELECT')
for o in vol:o.select_set(True)
bpy.context.view_layer.objects.active=palm;bpy.ops.object.join();glove=bpy.context.object;glove.name='PaddedGlove_v3'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
rem=glove.modifiers.new('Continuous glove volume','REMESH');rem.mode='VOXEL';rem.voxel_size=.032;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=glove.modifiers.new('Soften construction','SMOOTH');sm.factor=.65;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
glove.data.materials.append(ivory)
for p in glove.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');glove.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bpy.context.view_layer.objects.active=glove;bpy.ops.object.vertex_group_normalize_all(lock_active=False)
for m in glove.modifiers:
 if m.type=='ARMATURE':m.use_deform_preserve_volume=True
sm=glove.modifiers.new('Joint volume correction','CORRECTIVE_SMOOTH');sm.factor=.3;sm.iterations=4
sub=glove.modifiers.new('Surface finish','SUBSURF');sub.levels=1

def rigid(o):
 g=o.vertex_groups.new(name='hand.L');g.add(list(range(len(o.data.vertices))),1,'REPLACE');m=o.modifiers.new('Reusable skeleton','ARMATURE');m.object=rig
# Open cuff, with rounded edges and visible thickness.
verts=[];faces=[];N=64
profiles=[(-.22,.60,.38),(-.19,.68,.44),(-.1,.71,.46),(.18,.71,.46),(.25,.66,.41),(.23,.55,.30),(.15,.53,.29),(-.13,.53,.29),(-.21,.55,.31)]
for y,rx,rz in profiles:
 for i in range(N):
  a=2*math.pi*i/N;verts.append((.08+rx*math.copysign(abs(math.cos(a))**.68,math.cos(a)),y,.1+rz*math.copysign(abs(math.sin(a))**.72,math.sin(a))))
for j in range(len(profiles)):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,((j+1)%len(profiles))*N+(i+1)%N,((j+1)%len(profiles))*N+i))
me=bpy.data.meshes.new('Cuff topology');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Open folded cuff',me);bpy.context.collection.objects.link(o);me.materials.append(cuffmat)
for p in me.polygons:p.use_smooth=True
s=o.modifiers.new('Rounded cloth edge','SUBSURF');s.levels=2;rigid(o)
# Dorsal is -Z. Place three glove points on that surface and transfer skin weights.
tree=KDTree(len(glove.data.vertices))
for v in glove.data.vertices:tree.insert(v.co,v.index)
tree.balance()
for x in (-.26,.17,.60):
 c=bpy.data.curves.new('Back stitching','CURVE');c.dimensions='3D';c.bevel_depth=.011;c.bevel_resolution=3;sp=c.splines.new('POLY');sp.points.add(16)
 for j,p in enumerate(sp.points):
  y=.80+j*.034;hit,loc,n,_=glove.ray_cast(Vector((x,y,-3)),Vector((0,0,1)))
  if not hit:raise RuntimeError('Dorsal ray missed')
  p.co=(*(loc+n*.003),1);p.radius=.25+.75*math.sin(math.pi*j/16)**.55
 o=bpy.data.objects.new('Dorsal glove point',c);bpy.context.collection.objects.link(o);c.materials.append(seammat)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object
 for g in glove.vertex_groups:o.vertex_groups.new(name=g.name)
 for v in o.data.vertices:
  _,idx,_=tree.find(v.co)
  for g in glove.data.vertices[idx].groups:o.vertex_groups[g.group].add([v.index],g.weight,'REPLACE')
 m=o.modifiers.new('Follow dorsal skin','ARMATURE');m.object=rig;m.use_deform_preserve_volume=True
# Anatomical pose controls. Thumb's new bind-base needs a local compensation.
study=json.loads((ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/anatomy-study/structure.json').read_text())
pinch={k:tuple(v) for k,v in study['poses']['pinch'].items() if k in rig.pose.bones}
old=Euler(pinch['thumb.01.L']).to_matrix();pinch['thumb.01.L']=tuple((Matrix.Rotation(.45,3,'X')@old).to_euler())
# Reference-led authored pose: base sweep + axial turn carries the thumb pad
# toward the index; index MCP and PIP flex simultaneously. Values are artistic
# choices, not anatomical measurements from the drawings. No contact optimizer.
pinch.update({
 'thumb.01.L':(math.radians(35),math.radians(-40),math.radians(3)),
 'thumb.02.L':(math.radians(-10),0,0),
 'thumb.03.L':(math.radians(-5),0,0),
 'f_index.01.L':(math.radians(30),0,0),
 'f_index.02.L':(math.radians(40),0,0),
 'f_index.03.L':(math.radians(20),0,0),
})
poses={'idle':{},'pinch':pinch,'grab':{},'press':{}}
poses['idle'].update({'f_pinky.01.L':(-.35,0,0),'f_pinky.02.L':(-.10,0,0),'f_pinky.03.L':(-.1,0,0)})
for prefix in ('f_index','f_middle','f_pinky'):
 for j,v in enumerate((.65,.92,.43),1):poses['grab'][f'{prefix}.0{j}.L']=(v,0,0)
 for j,v in enumerate((-.27,-.17,-.15) if prefix=='f_index' else (.55,.8,.3),1):poses['press'][f'{prefix}.0{j}.L']=(v,0,0)
poses['grab'].update({'thumb.01.L':(.78,-.5,-.38),'thumb.02.L':(.48,0,0),'thumb.03.L':(.30,0,0)})
poses['press'].update({'thumb.01.L':(.38,-.2,-.1),'thumb.02.L':(.18,0,0)})
def pose(p):
 for pb in rig.pose.bones:pb.rotation_euler=p.get(pb.name,(0,0,0))
 bpy.context.view_layer.update()
scene=bpy.context.scene;cam=scene.camera;cam.data.ortho_scale=5.9
# Back of hand viewed at approximately 65 degrees above the hand plane.
def aim(pos):
 cam.location=pos;f=(Vector((.05,1.7,.3))-cam.location).normalized();r=f.cross(Vector((0,1,0))).normalized();u=r.cross(f);cam.rotation_euler=Matrix((r,u,-f)).transposed().to_euler()
aim((-3,-2,-10))
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.cycles.samples=32
for name,p in poses.items():
 pose(p);scene.render.filepath=str(EV/(name+'.png'));bpy.ops.render.render(write_still=True)
# Extra side/palm inspection, never the default presentation.
pose(poses['pinch']);aim((-8,1,-3));scene.render.filepath=str(EV/'pinch-side.png');bpy.ops.render.render(write_still=True)
aim((-3,-2,-10));pose(poses['idle'])
rig.animation_data_clear()
for frame,name in ((1,'idle'),(17,'idle'),(37,'pinch'),(53,'pinch'),(73,'grab'),(89,'grab'),(109,'press'),(125,'press'),(145,'idle')):
 pose(poses[name])
 for pb in rig.pose.bones:pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=pb.name)
scene.frame_start=1;scene.frame_end=145;scene.frame_set(37)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'padded-glove.blend'))
(EV/'poses.json').write_text(json.dumps(poses,indent=2))
print('GLOVE_V3_COMPLETE',len(glove.data.vertices))
