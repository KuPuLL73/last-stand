import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'game/shelly-game.glb'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
print('BOUND_MESHES',[(o.name,len(o.data.vertices),o.hide_render) for o in meshes])
actions={a.name:a for a in bpy.data.actions}
print('ACTIONS',[(a.name,tuple(a.frame_range),len(a.slots)) for a in actions.values()])
arm.animation_data_clear();arm.animation_data_create()
scene=bpy.context.scene;scene.render.fps=24
report={}
for name in ['Idle','Walk','Attack']:
 action=next(a for a in actions.values() if a.name==name or a.name.endswith('|'+name))
 arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 samples=[]
 for frame in [0,(action.frame_range.y-action.frame_range.x)*.25,(action.frame_range.y-action.frame_range.x)*.5,action.frame_range.y]:
  scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
  deps=bpy.context.evaluated_depsgraph_get()
  points=[]
  for o in meshes:
   eo=o.evaluated_get(deps);em=eo.to_mesh()
   points.extend(eo.matrix_world@v.co for v in em.vertices)
   eo.to_mesh_clear()
  lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
  samples.append({'frame':frame,'min':list(lo),'max':list(hi),'hips':list(arm.matrix_world@arm.pose.bones['hips_s'].head),'root':list(arm.matrix_world@arm.pose.bones['Root'].head)})
 report[name]=samples
print('REPORT',json.dumps(report))
(ROOT/'game/animation-validation.json').write_text(json.dumps(report,indent=2))
if '--metrics-only' in sys.argv:sys.exit(0)
# A small, actual render verifies hand grip, weapon placement and face in motion.
floor_mat=bpy.data.materials.new('Floor');floor_mat.diffuse_color=(.035,.05,.065,1)
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.location.z=.02;floor.data.materials.append(floor_mat)
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((4,-6,7),850,5),((-5,-3,5),600,4),((2,4,6),950,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;aim(l,(0,0,2))
bpy.ops.object.camera_add(location=(5,-11,5));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=4.8;aim(camera,(0,0,1.85));scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='CUDA'
 scene.cycles.device='GPU'
except Exception:pass
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.12,.16,1)
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
for name,frame in [('Idle',0),('Walk',6),('Walk',18),('Attack',4),('Attack',12)]:
 action=next(a for a in actions.values() if a.name==name or a.name.endswith('|'+name))
 arm.animation_data.action=action
 if action.slots:arm.animation_data.action_slot=action.slots[0]
 scene.frame_set(frame);scene.render.filepath=str(ROOT/'game'/f'verify-{name.lower()}-{frame}.png')
 bpy.ops.render.render(write_still=True)
