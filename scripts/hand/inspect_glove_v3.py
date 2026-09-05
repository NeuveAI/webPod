"""Render exposed thumb/index structure from the actual controlled glove rig."""
import bpy, math
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2];EV=ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/review-v3'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/hand/review-v3/padded-glove.blend'))
rig=bpy.data.objects['HandRig_v3'];scene=bpy.context.scene
for o in bpy.data.objects:
 if o.type=='MESH':o.hide_render=True

def material(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;s=m.node_tree.nodes['Principled BSDF'];s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=.4;return m
coral=material('Thumb metacarpal and phalanges',(.8,.24,.09));ivory=material('Index phalanges',(.8,.74,.59));cyan=material('Local flexion axis',(.05,.72,.58));blue=material('Index metacarpal',(.12,.35,.55))
created=[]
def sphere(p,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=r,location=p);o=bpy.context.object;o.data.materials.append(m);created.append(o)
 for f in o.data.polygons:f.use_smooth=True

def rod(a,b,r,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference((b-a).normalized());o.data.materials.append(m);created.append(o)
 for f in o.data.polygons:f.use_smooth=True
cam=scene.camera;cam.location=(-8,-.5,-4)
f=(Vector((-.4,1.5,.6))-cam.location).normalized();right=f.cross(Vector((0,1,0))).normalized();up=right.cross(f);cam.rotation_euler=Matrix((right,up,-f)).transposed().to_euler();cam.data.ortho_scale=4.1
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.cycles.samples=16
for frame,label in ((17,'open'),(27,'half'),(37,'closed')):
 scene.frame_set(frame)
 for o in created:bpy.data.objects.remove(o,do_unlink=True)
 created=[]
 for name in ('palm.01.L','f_index.01.L','f_index.02.L','f_index.03.L','thumb.01.L','thumb.02.L','thumb.03.L'):
  b=rig.pose.bones[name];a,t=b.head.copy(),b.tail.copy();color=coral if name.startswith('thumb') else blue if name.startswith('palm') else ivory
  rod(a,t,.067,color);sphere(a,.082,color);sphere(t,.075,color)
  x=b.matrix.to_3x3().col[0].normalized();z=b.matrix.to_3x3().col[2].normalized()
  rod(a-x*.14,a+x*.14,.014,cyan)
  if name=='thumb.01.L':
   # Off-axis stripe makes longitudinal rotation visible on the metacarpal.
   rod(a+z*.085,t+z*.085,.023,cyan)
  if name.endswith('.03.L'):
   p=t-b.matrix.to_3x3().col[1]*.08+z*.26;sphere(p,.04,cyan);rod(p,p+z*.17,.013,cyan)
 scene.render.filepath=str(EV/('pinch-structure-'+label+'.png'));bpy.ops.render.render(write_still=True)
print('STRUCTURE_REVIEW_COMPLETE')
# Surface checks from the opposite side reveal intersections hidden by dorsal view.
for o in created:bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 if o.type=='MESH':o.hide_render=False
for frame,label,pos in ((37,'pinch-palm',(0,-1,9)),(73,'grab-palm',(0,-1,9)),(109,'press-side',(-8,1,-3))):
 scene.frame_set(frame);cam.location=pos;f=(Vector((.05,1.6,.3))-cam.location).normalized();right=f.cross(Vector((0,1,0))).normalized();up=right.cross(f);cam.rotation_euler=Matrix((right,up,-f)).transposed().to_euler();cam.data.ortho_scale=5.9
 scene.render.filepath=str(EV/(label+'.png'));bpy.ops.render.render(write_still=True)
