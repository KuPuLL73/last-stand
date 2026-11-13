import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'model/native-import.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.data.objects if o.type=='MESH']
image=bpy.data.images.load(str(root/'model/shelly_redux.png'));image.pack()
for mat in bpy.data.materials:
 mat.use_nodes=True
 nt=mat.node_tree;nt.nodes.clear()
 out=nt.nodes.new('ShaderNodeOutputMaterial');bs=nt.nodes.new('ShaderNodeBsdfPrincipled');tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image
 bs.inputs['Roughness'].default_value=.52 if 'metal' in mat.name else .7
 bs.inputs['Metallic'].default_value=.22 if 'metal' in mat.name else 0
 nt.links.new(tex.outputs['Color'],bs.inputs['Base Color']);nt.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
for ob in meshes:
 for p in ob.data.polygons:p.use_smooth=True
 if ob.data.uv_layers:
  for uv in ob.data.uv_layers.active.data:
   uv.uv.x/=4096
   uv.uv.y=1-(1-uv.uv.y)/4096
bpy.context.scene.frame_set(0)
for ob in list(bpy.data.objects):
 if ob.name=='Icosphere':bpy.data.objects.remove(ob,do_unlink=True)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
print('HEAD',list(map(list,arm.pose.bones['head_s'].matrix)))
print('HEAD_REST',list(map(list,arm.data.bones['head_s'].matrix_local)))
# The game overlays animated facial sprites. Build real, lit eye geometry
# and attach it to the existing head joint for portable GLB rendering.
def solid(name,color,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;return m
white=solid('Eye whites',(.95,.96,1));iris=solid('Warm brown iris',(.13,.055,.025));black=solid('Pupil',(.008,.004,.015));shine=solid('Catchlights',(1,1,1),.2)
head_delta=arm.pose.bones['head_s'].matrix@arm.data.bones['head_s'].matrix_local.inverted()
def eye_part(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc)
 ob=bpy.context.object;ob.name=name;ob.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 # Place in the same bind coordinate system as the body and skin to head.
 bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
 ob.data.materials.append(material)
 for p in ob.data.polygons:p.use_smooth=True
 vg=ob.vertex_groups.new(name='head_s');vg.add(list(range(len(ob.data.vertices))),1,'REPLACE');mod=ob.modifiers.new('Head deformation','ARMATURE');mod.object=arm;ob.parent=arm
 meshes.append(ob)
for side in [-1,1]:
 x=.60*side
 eye_part('Eye white '+str(side),(x,-1.50,8.99),(.47,.19,.64),white)
 eye_part('Iris '+str(side),(x-.045,-1.675,8.95),(.23,.075,.36),iris)
 eye_part('Pupil '+str(side),(x-.045,-1.737,8.95),(.145,.032,.275),black)
 eye_part('Eye highlight '+str(side),(x-.105,-1.773,9.10),(.065,.025,.10),shine)
# Normalize to a 3.5-unit character, preserving hierarchy and animation.
bpy.ops.object.empty_add(type='PLAIN_AXES');wrapper=bpy.context.object;wrapper.name='Shelly'
roots=[o for o in list(bpy.data.objects) if o!=wrapper and o.parent is None]
for ob in roots:ob.parent=wrapper
wrapper.scale=(.30,)*3
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
points=[ob.evaluated_get(deps).matrix_world@Vector(c) for ob in meshes for c in ob.evaluated_get(deps).bound_box]
lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
print('BOUNDS',tuple(lo),tuple(hi))
wrapper.location.z=-lo.z+.12
model_objects=list(bpy.data.objects)
bpy.ops.object.select_all(action='DESELECT')
for ob in model_objects:ob.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(root/'model/shelly.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False)
for ob in meshes:ob.data.calc_loop_triangles()
info={'triangles':sum(len(o.data.loop_triangles) for o in meshes),'bones':len(arm.data.bones),'source':'tailsjs/brawl-stars-assets/54.243/sc3d/shelly_redux_geo.glb','animation_source':'tailsjs/brawl-stars-assets/69.230/sc3d/shelly_idle.glb'}
(root/'model/model-info.json').write_text(json.dumps(info,indent=2))
def mat(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=1.7,depth=.16,location=(0,0,.01));stage=bpy.context.object;stage.name='Display plinth';stage.data.materials.append(mat('Obsidian plum',(.04,.025,.09),.45,.32));bevel=stage.modifiers.new('Soft rim','BEVEL');bevel.width=.07;bevel.segments=4
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.location.z=-.08;floor.data.materials.append(mat('Studio floor',(.017,.012,.04),.1,.45))
def aim(ob,target):ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
def light(name,power,color,loc,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1.9))
light('Warm key',650,(1,.86,.72),(3,-5,7),5)
light('Soft fill',450,(.62,.77,1),(-4,-3,4),4)
light('Purple rim',850,(.72,.38,1),(1,4,6),3)
bpy.ops.object.camera_add(location=(5,-10,5.2));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=5.2;aim(camera,(0,0,1.9));scene=bpy.context.scene;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='CUDA'
 scene.cycles.device='GPU'
except Exception:pass
scene.world.color=(.07,.07,.07);scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'renders/shelly-hero.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'model/shelly.blend'))
bpy.ops.render.render(write_still=True)
