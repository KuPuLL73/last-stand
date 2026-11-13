import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(r'E:/Projects/YANDEX GAME/projects/brawl-zombies')
src=root/'game/assets/pudge/source/base';out=root/'game/assets/pudge';tex=out/'textures';tex.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(src/'pudge_econ.fbx'))
meshes=[o for o in bpy.data.objects if o.type=='MESH'];rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for material in bpy.data.materials:
 images=[n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]if material.use_nodes else []
 color=next((i for i in images if '_color' in i.filepath),None)
 if not color:continue
 basename=Path(color.filepath.replace('\\','/')).name;path=next(src.rglob(basename));image=bpy.data.images.load(str(path),check_existing=True)
 if max(image.size)>1024:image.scale(round(image.size[0]*1024/max(image.size)),round(image.size[1]*1024/max(image.size)))
 image.file_format='PNG';image.filepath_raw=str(tex/(path.stem+'.png'));image.save();image.pack()
 material.use_nodes=True;nodes=material.node_tree.nodes;nodes.clear();shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.88;shader.inputs['Specular IOR Level'].default_value=.2;texture=nodes.new('ShaderNodeTexImage');texture.image=image;output=nodes.new('ShaderNodeOutputMaterial');material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color']);material.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
for o in meshes:
 for poly in o.data.polygons:poly.use_smooth=True
# Keep original rig and skin weights; runtime controls a small set of joints.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes+[rig]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'pudge.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_image_format='AUTO')
points=[o.matrix_world@Vector(c)for o in meshes for c in o.bound_box];lo=Vector(tuple(min(p[i]for p in points)for i in range(3)));hi=Vector(tuple(max(p[i]for p in points)for i in range(3)))
print('BOUNDS',tuple(lo),tuple(hi));print('TRIANGLES',sum(len(o.data.polygons)for o in meshes));
# Source-pose proof image, for inspecting the actual asset before runtime posing.
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.20,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size in [('Key',(3,-4,5),600,5),('Fill',(-3,-2,3),350,4),('Rim',(1,3,4),500,3)]:
 light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(camera);camera.location=(3,-5,2.6);camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.2;scene.camera=camera;scene.render.filepath=str(root/'game/artifacts/pudge-source-pose.png');bpy.ops.render.render(write_still=True)
