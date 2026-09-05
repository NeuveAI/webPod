"""Prepare the Blender-only motion review and inspect articulation numerically."""
import bpy, math, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/hand/review-v3'; EV=ROOT/'docs/workstreams/013-cartoon-hand-cursor/evidence/review-v3'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'padded-glove.blend'))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;rig=bpy.data.objects['HandRig_v3'];glove=bpy.data.objects['PaddedGlove_v3']
bpy.context.view_layer.objects.active=rig
rig.animation_data_clear()
for pb in rig.pose.bones:pb.rotation_euler=(0,0,0)
bpy.ops.object.mode_set(mode='EDIT')
b=rig.data.edit_bones.new('CTRL_motion');b.head=(0,0,0);b.tail=(0,.4,0);b.use_deform=False
rig.data.edit_bones['hand.L'].parent=b
for j,name in enumerate(('index','middle','pinky','thumb')):
 b=rig.data.edit_bones.new('CTRL_'+name);b.head=(-1.7+j*.55,.2,-.8);b.tail=b.head+__import__('mathutils').Vector((0,.22,0));b.use_deform=False;b.parent=rig.data.edit_bones['CTRL_motion']
bpy.ops.object.mode_set(mode='OBJECT')
bindings=[]
for name in ('index','middle','pinky'):
 for j,label in enumerate(('MCP_flex','PIP_flex','DIP_flex'),1):bindings.append(('CTRL_'+name,label,f'f_{name}.0{j}.L',0))
 bindings.append(('CTRL_'+name,'MCP_spread',f'f_{name}.01.L',2))
bindings.extend([('CTRL_thumb','base_sweep','thumb.01.L',0),('CTRL_thumb','base_turn','thumb.01.L',1),('CTRL_thumb','base_lift','thumb.01.L',2),('CTRL_thumb','MCP_flex','thumb.02.L',0),('CTRL_thumb','IP_flex','thumb.03.L',0)])
for ctrl,prop,bone,axis in bindings:
 pb=rig.pose.bones[ctrl];pb[prop]=0.;pb.id_properties_ui(prop).update(min=-90,max=110,description='Artist control in degrees; see reference drawings and rig contract')
 d=rig.pose.bones[bone].driver_add('rotation_euler',axis).driver;v=d.variables.new();v.name='v';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path=f'pose.bones["{ctrl}"]["{prop}"]';d.expression='v*0.017453292519943295'
poses=json.loads((EV/'poses.json').read_text())
for frame,name in ((1,'idle'),(17,'idle'),(37,'pinch'),(53,'pinch'),(73,'grab'),(89,'grab'),(109,'press'),(125,'press'),(145,'idle'),(177,'idle')):
 for ctrl,prop,bone,axis in bindings:
  pb=rig.pose.bones[ctrl];pb[prop]=math.degrees(poses[name].get(bone,(0,0,0))[axis]);pb.keyframe_insert(data_path=f'["{prop}"]',frame=frame,group=ctrl)
rig['Controls']='CTRL_thumb base_turn rotates the metacarpal longitudinally; base_sweep/base_lift position it. Finger controls expose MCP/PIP/DIP flexion. Angles are artist-authored degrees.'
rig['Anatomy references']='reference/thumb-opposition-drawings.md — eOrthopod opposition drawing and Orthobullets CMC saddle-joint drawing'
root=rig.pose.bones['CTRL_motion'];root.rotation_mode='XYZ';root['smear']=0.
root.id_properties_ui('smear').update(min=0,max=1,description='Transient directional stretch for fast motion; zero restores normal proportions')
for axis,formula in ((0,'1+0.8*s'),(1,'1/sqrt(1+0.8*s)'),(2,'1/sqrt(1+0.8*s)')):
 d=root.driver_add('scale',axis).driver;v=d.variables.new();v.name='s';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='pose.bones["CTRL_motion"]["smear"]';d.expression=formula
for frame,x,smear in ((1,0,0),(145,0,0),(150,-.4,0),(153,-.65,0),(154,-.25,.45),(155,.9,1),(156,1.55,.3),(158,1.65,0),(169,0,0),(177,0,0)):
 root.location=(x,0,0);root['smear']=smear;root.keyframe_insert(data_path='location',frame=frame);root.keyframe_insert(data_path='["smear"]',frame=frame)
scene.frame_end=177;scene.render.fps=24
for frame,name in ((1,'Idle'),(37,'Pinch — thumb + index'),(73,'Grab'),(109,'Press'),(145,'Return'),(155,'Flick smear'),(169,'Recover')):scene.timeline_markers.new(name,frame=frame)
rig['Motion layer']='CTRL_motion: global travel and independent smear stretch, inherited by any bound skin'
rig['Review limitation']='Flick smear is artist-keyed for approval; runtime acceleration triggering has not been integrated'
# Evaluate every transition frame; inspect MCP/PIP participation, hinge axes and weights.
audit={'frames':177,'index_pinch':{},'max_lateral_finger_hinge_radians':0,'nonfinite_vertices':0,'unweighted_vertices':0}
for v in glove.data.vertices:
 if not v.groups or sum(g.weight for g in v.groups)<.999:audit['unweighted_vertices']+=1
for frame in range(1,178):
 scene.frame_set(frame)
 for pb in rig.pose.bones:
  if pb.name.startswith('f_') and '.01.' not in pb.name:audit['max_lateral_finger_hinge_radians']=max(audit['max_lateral_finger_hinge_radians'],abs(pb.rotation_euler.y),abs(pb.rotation_euler.z))
 if frame in (17,22,27,32,37):
  audit['index_pinch'][str(frame)]={'MCP_degrees':math.degrees(rig.pose.bones['f_index.01.L'].rotation_euler.x),'PIP_degrees':math.degrees(rig.pose.bones['f_index.02.L'].rotation_euler.x),'thumb_base_rotation':list(rig.pose.bones['thumb.01.L'].rotation_euler)}
 if frame in (1,27,37,63,73,99,109,155,169):
  evaluated=glove.evaluated_get(bpy.context.evaluated_depsgraph_get());me=evaluated.to_mesh()
  audit['nonfinite_vertices']+=sum(not all(math.isfinite(c) for c in v.co) for v in me.vertices);evaluated.to_mesh_clear()
scene.frame_set(169);audit['smear_recovery_scale']=list(root.scale)
(EV/'rig-audit.json').write_text(json.dumps(audit,indent=2))
# Collection separation makes skin swapping explicit in the source project.
for label,objects in [('RIG • reusable',[rig]),('SKIN • padded glove',[o for o in bpy.data.objects if o.type=='MESH']),('STUDIO • review',[o for o in bpy.data.objects if o.type in {'CAMERA','LIGHT'}])]:
 col=bpy.data.collections.new(label);scene.collection.children.link(col)
 for o in objects:
  for prev in list(o.users_collection):prev.objects.unlink(o)
  col.objects.link(o)
scene.frame_set(37)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'padded-glove.blend'))
bpy.data.libraries.write(str(OUT/'hand-rig.blend'),{rig},fake_user=True)
# Render a compact review clip. These are actual Blender frames, no generated images.
scene.render.resolution_x=480;scene.render.resolution_y=480;scene.cycles.samples=8
frames=EV/'frames';frames.mkdir(exist_ok=True)
scene.render.filepath=str(frames/'frame-');scene.render.image_settings.file_format='PNG'
bpy.ops.render.render(animation=True)
print('REVIEW_V3_COMPLETE',json.dumps(audit))
