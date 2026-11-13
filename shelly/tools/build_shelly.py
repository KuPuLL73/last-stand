import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'model/native-import.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.data.objects if o.type=='MESH']
# The imported eyebrows have separate animation joints. Replace their mesh
# with brows attached exclusively to head_s, so idle motion cannot bounce them.
for ob in list(meshes):
 if ob.name.startswith('eyebrows_GEO'):
  meshes.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
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
white=solid('Eye whites',(.95,.96,1),.68)
black=solid('Deep plum pupils',(.012,.005,.022),.58)
liner=solid('Warm dark eyelids',(.095,.025,.018),.8)
lip=solid('Soft lower lip',(.43,.16,.075),.9)
shine=solid('Small catchlights',(1,1,1),.5)
brow_material=solid('Purple eyebrows',(.32,.028,.62),.72)
# Sample the actual skin surface in bind pose. The facial pieces follow its
# curvature with a tiny offset, rather than protruding as eyeball spheres.
arm.data.pose_position='REST';bpy.context.view_layer.update()
body=next(o for o in meshes if o.name.startswith('body_GEO'))
evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());skin=evaluated.to_mesh()
skin_bvh=BVHTree.FromPolygons([evaluated.matrix_world@v.co for v in skin.vertices],[list(p.vertices) for p in skin.polygons],all_triangles=False)
evaluated.to_mesh_clear()
def surface(x,z,offset=.022):
 hit,normal,idx,dist=skin_bvh.ray_cast(Vector((x,-7,z)),Vector((0,1,0)),15)
 return (x,(hit.y if hit else -1.5)-offset,z)
def face_mesh(name,verts,faces,material):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(material)
 for p in mesh.polygons:p.use_smooth=True
 vg=ob.vertex_groups.new(name='head_s');vg.add(list(range(len(mesh.vertices))),1,'REPLACE');mod=ob.modifiers.new('Head deformation','ARMATURE');mod.object=arm;ob.parent=arm
 meshes.append(ob);return ob
def oval(name,cx,cz,rx,rz,material,offset=.03,tilt=0,bump=0):
 # Concentric rings make the small curved patch conform to skin everywhere.
 verts=[surface(cx,cz,offset+bump)];faces=[];segments=48;rings=5
 for ring in range(1,rings+1):
  r=ring/rings
  for i in range(segments):
   t=2*math.pi*i/segments;x=rx*r*math.cos(t);z=rz*r*math.sin(t)+tilt*x
   verts.append(surface(cx+x,cz+z,offset+bump*math.sqrt(max(0,1-r*r))))
 for i in range(segments):faces.append((0,1+i,1+(i+1)%segments))
 for ring in range(1,rings):
  a=1+(ring-1)*segments;b=1+ring*segments
  for i in range(segments):j=(i+1)%segments;faces.append((a+i,b+i,b+j,a+j))
 return face_mesh(name,verts,faces,material)
def stroke(name,points,width,material,offset=.045):
 verts=[];faces=[]
 for i,p in enumerate(points):
  prev=Vector(points[max(0,i-1)]);nxt=Vector(points[min(len(points)-1,i+1)]);d=(nxt-prev).normalized();n=Vector((-d.y,d.x))*width/2
  verts.extend([surface(p[0]+n.x,p[1]+n.y,offset),surface(p[0]-n.x,p[1]-n.y,offset)])
 for i in range(len(points)-1):faces.append((2*i,2*i+1,2*i+3,2*i+2))
 return face_mesh(name,verts,faces,material)
for side in [-1,1]:
 x=.60*side;z=8.95
 oval('Eye white '+str(side),x,z,.435,.46,white,.028,side*.10)
 # Tall dark pupils sit slightly high, matching Shelly's graphic face.
 oval('Pupil '+str(side),x-.025,z+.025,.19,.31,black,.047)
 oval('Eye glint '+str(side),x-.075,z+.19,.035,.052,shine,.058)
 oval('Stable eyebrow '+str(side),side*.64,9.70,.47,.135,brow_material,.047,side*.22,.045)
 upper=[]
 for i in range(33):
  t=.30+(math.pi-.60)*i/32;dx=.435*math.cos(t)
  upper.append((x+dx,z+.46*math.sin(t)+side*.10*dx))
 stroke('Upper eyelid '+str(side),upper,.044,liner,.05)
 # One broad outward lash and one short lash, as in the reference render.
 for k in range(2):
  bx=x+side*(.34+.055*k);bz=z+.28-.055*k
  face_mesh('Outer eyelash '+str(side)+' '+str(k),[surface(bx,bz,.058),surface(bx+side*.13,bz+.13-.04*k,.058),surface(bx+side*.065,bz-.04,.058)],[(0,1,2)],liner)
# The small brown triangle in the original atlas is the nose. Add the missing
# mouth separately, with a slight asymmetric rise at the corner.
smile=[]
for i in range(41):
 t=-1+2*i/40;smile.append((.42*t,7.68+.075*t*t+.025*t))
stroke('Confident smile',smile,.029,liner,.034)
arm.data.pose_position='POSE';bpy.context.view_layer.update()
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
