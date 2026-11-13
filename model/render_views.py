import bpy, os, math
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,'model','spike.blend'))
scene=bpy.context.scene
scene.cycles.samples=64
scene.render.resolution_x=1000;scene.render.resolution_y=1000
target=Vector((0,0,1.72));camera=scene.camera
camera.data.ortho_scale=5.0
for label,pos in [('front',(0,-10,3.1)),('side',(10,0,3.1)),('back',(0,10,3.1))]:
    camera.location=pos;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(root,'renders','spike-'+label+'.png')
    bpy.ops.render.render(write_still=True)
