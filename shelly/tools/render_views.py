import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'model/shelly.blend'))
scene=bpy.context.scene;camera=scene.camera;scene.cycles.samples=48
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='CUDA'
 scene.cycles.device='GPU'
except Exception:pass
for name,location in [('front',(0,-12,4)),('side',(12,0,4)),('back',(0,12,4))]:
 camera.location=location;camera.rotation_euler=(Vector((0,0,1.95))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=5.0
 scene.render.filepath=str(root/f'renders/shelly-{name}.png');bpy.ops.render.render(write_still=True)
camera.location=(1,-10,3.4);camera.rotation_euler=(Vector((0,-.15,2.83))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.9
scene.render.filepath=str(root/'renders/shelly-face.png');bpy.ops.render.render(write_still=True)
