import bpy
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];EV=ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/review-v3'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/hand/review-v3/padded-glove.blend'))
s=bpy.context.scene;c=s.camera;s.render.resolution_x=480;s.render.resolution_y=480;s.cycles.samples=8
for name,start,end,loc,scale in [('pinch-detail',17,45,(-8,1,-3),5.9),('smear-detail',145,177,(-3,-2,-10),8.5)]:
 p=EV/name;p.mkdir(exist_ok=True);c.location=loc;f=(Vector((.05,1.7,.3))-c.location).normalized();r=f.cross(Vector((0,1,0))).normalized();u=r.cross(f);c.rotation_euler=Matrix((r,u,-f)).transposed().to_euler();c.data.ortho_scale=scale
 s.frame_start=start;s.frame_end=end;s.render.filepath=str(p/'frame-');bpy.ops.render.render(animation=True)
print('DETAIL_REVIEW_COMPLETE')
