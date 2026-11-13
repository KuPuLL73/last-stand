"""Editable, original mesh construction of a Spike fan-model. Blender 4.5 LTS."""
import bpy, math, os, json, random
from mathutils import Vector
from math import sin, cos, pi, sqrt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'model')
RENDERS = os.path.join(ROOT, 'renders')
os.makedirs(OUT, exist_ok=True); os.makedirs(RENDERS, exist_ok=True)
random.seed(17)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection.name != 'Collection' and collection.users == 0: bpy.data.collections.remove(collection)
parts = {}

def rgb(h):
    values=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)

def material(name, color, rough=.5, metallic=0, texture=False):
    m=bpy.data.materials.new(name); m.use_nodes=True; m.diffuse_color=rgb(color)
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=rgb(color)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metallic
    bs.inputs['Specular IOR Level'].default_value=.32
    if texture:
        noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=145
        noise.inputs['Detail'].default_value=2
        bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16
        bump.inputs['Distance'].default_value=.012
        m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    return m

green=material('Cactus • lime wax', '85CF32', .48, texture=True)
green.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.045
dark=material('Carved face • forest interior','173913',.78)
spine=material('Thorns • jade','287B2C',.5)
areole=material('Areoles • muted sage','679D35',.72)
purple=material('Vest • royal purple canvas','7428BC',.72,texture=True)
purple_edge=material('Vest • rolled piping','9A43DC',.52)
purple_shadow=material('Vest • back panel','6022A2',.7)
brown=material('Shorts • warm leather','8C471E',.66,texture=True)
brown_edge=material('Shorts • hem and belt','B16A28',.56)
stitch=material('Seams • warm thread','D79350',.75)
gold=material('Buttons • satin brass','FFC448',.29,.65)
red=material('Flower • scarlet','F83E45',.43)
red2=material('Flower • coral','FF6153',.47)
red3=material('Flower • crimson folds','C92B45',.48)
for m in [red,red2,red3]: m.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.07

def register(obj, group):
    parts.setdefault(group,[]).append(obj); return obj

def smooth(obj):
    if obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    return obj

def apply(obj,mod):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

def uvball(name,loc,scale,mat,group=None,segments=40,rings=28):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);smooth(o)
    return register(o,group) if group else o

def mesh(name,verts,faces,mat,group=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    smooth(o)
    return register(o,group) if group else o

def bevel(obj,width=.04,segments=3):
    mod=obj.modifiers.new('Soft manufactured edges','BEVEL');mod.width=width;mod.segments=segments
    apply(obj,mod);smooth(obj)

def curve(name,points,radius,mat,group='body',closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=3
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    return register(o,group)

def cone(name,a,b,radius,mat,group='body'):
    a,b=Vector(a),Vector(b);delta=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=radius,radius2=.004,depth=delta.length,location=(a+b)/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
    bevel(o,.007,2);return register(o,group)

def body_pos(theta,z,offset=0):
    q=(z-2.02)/1.40;r=sqrt(max(.0001,1-q*q));rib=1+.016*cos(theta*8)
    return Vector(((1.10*r*rib+offset)*sin(theta),-(.74*r*rib+offset)*cos(theta),z))

# A continuous cactus silhouette, with actual longitudinal rib geometry.
verts=[];faces=[];nx=96;nz=64
for i in range(nz+1):
    p=pi*i/nz;z=2.02+1.4*cos(p)
    for j in range(nx):
        t=j*2*pi/nx;r=sin(p)*(1+.016*cos(t*8))
        verts.append((1.10*r*sin(t),-.74*r*cos(t),z))
for i in range(nz):
    for j in range(nx):
        a=i*nx+j;b=i*nx+(j+1)%nx;c=(i+1)*nx+(j+1)%nx;d=(i+1)*nx+j
        faces.append((a,d,c,b))
body=mesh('Spike | continuous cactus body',verts,faces,green,'body')
bpy.context.view_layer.objects.active=body;body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.0001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');body.select_set(False)
body.data.materials.append(dark)

def carve(cutter):
    cutter.data.materials.clear();cutter.data.materials.append(green);cutter.data.materials.append(dark)
    for f in cutter.data.polygons:f.material_index=1
    mod=body.modifiers.new('Carved facial cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    apply(body,mod);bpy.data.objects.remove(cutter,do_unlink=True)

for side in [-1,1]:
    cutter=uvball('Eye carving tool',(side*.435,-.687,2.58),(.258,.295,.305),dark,segments=48,rings=32)
    carve(cutter)

# A rounded open smile carved into the same body, never a painted-on decal.
c=bpy.data.curves.new('Smile profile','CURVE');c.dimensions='2D';c.resolution_u=20;c.fill_mode='BOTH';c.extrude=.28;c.bevel_depth=.045;c.bevel_resolution=4
s=c.splines.new('BEZIER');points=[(-.43,2.10),(-.24,2.13),(0,2.07),(.24,2.13),(.43,2.10),(.40,1.88),(.22,1.73),(0,1.70),(-.22,1.73),(-.40,1.88)]
s.bezier_points.add(len(points)-1)
for p,co in zip(s.bezier_points,points):p.co=(co[0],co[1],0);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
s.use_cyclic_u=True
o=bpy.data.objects.new('Smile carving tool',c);bpy.context.collection.objects.link(o);o.location.y=-.75;o.rotation_euler.x=pi/2
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);carve(o)
bevel(body,.016,3)

# Side/back cactus areoles and rounded, readable thorns.
for i,(t,z) in enumerate([(1.2,2.88),(-1.35,2.72),(1.65,2.45),(-1.65,2.25),(2.2,2.9),(-2.15,3.02),(pi,2.75),(2.75,2.27),(-2.6,2.0),(2.3,1.68),(-2.3,1.60),(.92,3.13),(-.90,3.13)]):
    pos=body_pos(t,z,.004)
    normal=Vector((sin(t)*.85,-cos(t),((z-2.02)/1.4)*.35)).normalized()
    a=uvball('Areole %02d'%i,pos,(.055,.024,.055),areole,'body',24,12)
    a.rotation_euler=normal.to_track_quat('Y','Z').to_euler()
    length=.11 if i>3 else .20
    cone('Soft cactus thorn %02d'%i,pos,pos+normal*length,.042,spine)
    if i>3:
        cone('Areole small prickle %02d'%i,pos,pos+(normal+Vector((.15,0,.12))).normalized()*.085,.017,spine)

# Open purple vest wraps around the sides and back, with a real thick edge.
v=[];f=[];nt=64;nr=14
for row in range(nr+1):
    r=row/nr
    for j in range(nt+1):
        t=math.radians(64)+(2*pi-2*math.radians(64))*j/nt
        top=2.46-.12*(1-cos(t))/2;bottom=1.12
        z=bottom+(top-bottom)*r
        v.append(tuple(body_pos(t,z,.055)))
for row in range(nr):
    for j in range(nt):
        a=row*(nt+1)+j;f.append((a,a+1,a+nt+2,a+nt+1))
vest=mesh('Purple vest | open wrap',v,f,purple,'body')
mod=vest.modifiers.new('Canvas thickness','SOLIDIFY');mod.thickness=.085;apply(vest,mod);bevel(vest,.035,3)
for t in [math.radians(64),2*pi-math.radians(64)]:
    edge=[tuple(body_pos(t,z,.11)) for z in [1.14,1.4,1.7,2.0,2.25,2.43]]
    curve('Rolled vest front edge',edge,.042,purple_edge)
    for z in [1.34,1.47]:
        p=body_pos(t,z,.15)
        button=uvball('Vest brass snap',p,(.071,.026,.071),gold,'body',28,16)
        button.rotation_euler=Vector((sin(t),-cos(t),0)).to_track_quat('Y','Z').to_euler()
# Rear seam and padded fabric panel, deliberately visible in the 360-degree model.
curve('Vest back seam',[tuple(body_pos(pi,z,.155)) for z in [1.18,1.5,1.8,2.12,2.32]],.012,purple_edge)
for t in [2.15,4.13]:
    for z in [1.28+i*.095 for i in range(10)]:
        curve('Vest stitch',[tuple(body_pos(t,z,.15)),tuple(body_pos(t,z+.038,.15))],.006,stitch)

# Shorts with two separate leg openings, rolled cuffs and a notched waistband.
hips=uvball('Shorts | soft leather hips',(0,.015,.95),(.90,.59,.31),brown,'body',48,24)
for side in [-1,1]:
    cuff=uvball('Shorts leg cuff',(side*.45,-.015,.73),(.44,.555,.255),brown,'body',40,24)
    # Separate green leg/foot geometry keeps the silhouette away from a ball-stack.
    foot=uvball('Cactus foot '+str(side),(side*.45,-.07,.36),(.36,.44,.34),green,'leg.L' if side<0 else 'leg.R',48,28)
    # Flatten the soles to make the character stand on the ground.
    for vert in foot.data.vertices:
        worldz=vert.co.z+foot.location.z
        if worldz<.085:vert.co.z=.085-foot.location.z
    hem=[(side*.45+.426*sin(t),-.015-.542*cos(t),.65+.015*cos(t)) for t in [j*2*pi/64 for j in range(64)]]
    curve('Rolled shorts hem',hem,.026,brown_edge,closed=True)
    # Three small toe creases, actual curved geometry following the foot.
    group='leg.L' if side<0 else 'leg.R'
    for dx in [-.12,.12]:
        curve('Toe crease',[(side*.45+dx,-.455,.28),(side*.45+dx,-.468,.36),(side*.45+dx,-.442,.43)],.007,spine,group)

# The belt follows the waist including the characteristic front notch.
v=[];f=[];n=128
for k in range(2):
    for j in range(n):
        t=2*pi*j/n;front=math.exp(-((min(t,2*pi-t))/.17)**2)
        z=(1.20 if k else 1.02)-.095*front
        v.append((.89*sin(t),-.602*cos(t),z))
for j in range(n):f.append((j,(j+1)%n,(j+1)%n+n,j+n))
belt=mesh('Notched leather waistband',v,f,brown_edge,'body')
mod=belt.modifiers.new('Belt thickness','SOLIDIFY');mod.thickness=.035;apply(belt,mod);bevel(belt,.018,3)
for side in [-1,1]:
    for z in [.80,.88,.96]:curve('Shorts center stitch',[(side*.11,-.575,z),(side*.11,-.586,z+.034)],.005,stitch)

# Sculpt-like fused arms and fists. Finger relief remains real geometry.
for side in [-1,1]:
    group='arm.L' if side<0 else 'arm.R';shift=.08 if side<0 else -.025
    blobs=[]
    blobs.append(uvball('Shoulder',(side*1.02,0,2.0+shift),(.35,.35,.40),green))
    blobs.append(uvball('Bent cactus elbow',(side*1.29,-.015,1.65+shift),(.35,.35,.38),green))
    blobs.append(uvball('Forearm',(side*1.46,-.18,1.79+shift),(.35,.36,.42),green))
    blobs.append(uvball('Fist palm',(side*1.49,-.27,1.87+shift),(.35,.34,.42),green))
    for index in range(3):
        blobs.append(uvball('Finger pad',(side*1.52,-.47,2.06-index*.17+shift),(.29,.19,.145),green,segments=32,rings=20))
    blobs.append(uvball('Curled thumb',(side*1.28,-.44,2.16+shift),(.18,.22,.20),green,segments=32,rings=20))
    bpy.ops.object.select_all(action='DESELECT')
    for o in blobs:o.select_set(True)
    bpy.context.view_layer.objects.active=blobs[0];bpy.ops.object.join();arm=bpy.context.object;arm.name='Sculpted fist and cactus arm '+str(side)
    mod=arm.modifiers.new('Fuse organic arm','REMESH');mod.mode='VOXEL';mod.voxel_size=.032;mod.use_smooth_shade=True;apply(arm,mod)
    mod=arm.modifiers.new('Smooth organic joins','SMOOTH');mod.factor=.65;mod.iterations=4;apply(arm,mod)
    mod=arm.modifiers.new('Game mesh reduction','DECIMATE');mod.ratio=.48;apply(arm,mod);smooth(arm);register(arm,group)
    for z in [1.84,2.01]:
        curve('Finger crease',[(side*1.28,-.576,z+shift),(side*1.48,-.62,z+shift),(side*1.67,-.555,z+.015+shift)],.009,spine,group)
    cone('Arm cactus thorn',(side*1.60,.06,1.76+shift),(side*1.78,.10,1.80+shift),.045,spine,group)

# Fleshy red flower with six separate curved petals and a recessed core.
for j in range(6):
    t=2*pi*j/6
    petal=uvball('Flower petal %d'%j,(.22*sin(t),.17*cos(t),3.61+.04*cos(t)),(.235,.17,.43),[red,red2,red3][j%3],'flower',40,28)
    petal.rotation_euler=(math.radians(18)*cos(t),-math.radians(18)*sin(t),-t*.25)
    # Pinch the root of every petal; preserve rounded tips.
    for vert in petal.data.vertices:
        h=(vert.co.z/.43+1)/2;factor=.60+.40*min(1,h*2)
        vert.co.x*=factor;vert.co.y*=factor
uvball('Flower deep center',(0,0,3.55),(.19,.19,.22),red3,'flower',32,20)
for j in range(5):
    t=2*pi*j/5
    leaf=uvball('Flower green calyx',(sin(t)*.14,cos(t)*.13,3.36),(.14,.12,.18),spine,'flower',24,16)

# Join by animation group and clean names. All materials remain separately editable.
joined={}
for group,objects in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='Spike | '+group
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    joined[group]=obj

# A small real armature, with rigid organic limbs and breathing idle animation.
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Spike_Rig';rig.show_in_front=True
bpy.ops.object.mode_set(mode='EDIT');root=rig.data.edit_bones[0];root.name='root';root.head=(0,0,.1);root.tail=(0,0,.6)
spec={'body':((0,0,1.0),(0,0,2.7),'root'),'arm.L':((-1.0,0,2.08),(-1.6,-.1,2.08),'body'),'arm.R':((1,0,1.975),(1.6,-.1,1.975),'body'),'leg.L':((-.45,0,.65),(-.45,0,.12),'root'),'leg.R':((.45,0,.65),(.45,0,.12),'root'),'flower':((0,0,3.32),(0,0,3.95),'body')}
for name,(a,b,parent) in spec.items():
    bone=rig.data.edit_bones.new(name);bone.head=a;bone.tail=b;bone.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for name,obj in joined.items():
    group=obj.vertex_groups.new(name=name);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Spike skeletal deformation','ARMATURE');mod.object=rig;obj.parent=rig
for p in rig.pose.bones:p.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=72
for clip in ['Idle','Attack']:
    rig.animation_data_create();action=bpy.data.actions.new(clip);rig.animation_data.action=action
    for p in rig.pose.bones:p.location=(0,0,0);p.rotation_euler=(0,0,0);p.scale=(1,1,1)
    frames=[1,18,36,54,72] if clip=='Idle' else [1,8,14,22,36]
    for frame in frames:
        phase=2*pi*(frame-1)/71
        if clip=='Idle':
            rig.pose.bones['body'].location.z=.025*sin(phase)
            rig.pose.bones['body'].scale=(1+.009*sin(phase),1+.009*sin(phase),1+.012*sin(phase))
            rig.pose.bones['arm.L'].rotation_euler.x=.045*sin(phase+.4)
            rig.pose.bones['arm.R'].rotation_euler.x=-.045*sin(phase+.4)
            rig.pose.bones['flower'].rotation_euler.y=.045*sin(phase+.8)
        else:
            amount={1:0,8:-.40,14:.65,22:.16,36:0}[frame]
            rig.pose.bones['arm.R'].rotation_euler.x=amount
            rig.pose.bones['body'].rotation_euler.z=amount*.14
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=frame);p.keyframe_insert('rotation_euler',frame=frame);p.keyframe_insert('scale',frame=frame)
    track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action)
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
scene.frame_set(1)

# Export only the character: no lights, floor or presentation pedestal in GLB.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for obj in joined.values():obj.select_set(True)
bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'spike.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True,export_apply=False,export_materials='EXPORT')
for track in rig.animation_data.nla_tracks:track.mute=True

triangles=0
for o in joined.values():o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
with open(os.path.join(OUT,'model-info.json'),'w',encoding='utf8') as f:
    json.dump({'character':'Spike fan model','source':'procedural original mesh; reference image only, no downloaded 3D mesh','triangles':triangles,'meshObjects':len(joined),'bones':len(rig.data.bones),'animations':['Idle','Attack'],'materials':len({m.name for o in joined.values() for m in o.data.materials}),'reference':'https://cdn.brawlify.com/brawlers/model/16000005.png'},f,ensure_ascii=False,indent=2)

# Presentation stage and studio lighting, stored in the editable .blend.
stage=material('Stage • blue slate','122F39',.5,.12)
ground=material('Backdrop • midnight teal','0B202A',.74)
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=2.43,depth=.16,location=(0,0,-.025));platform=bpy.context.object;platform.name='Presentation pedestal';platform.data.materials.append(stage);bevel(platform,.075,4)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.12));bpy.context.object.data.materials.append(ground)
scene.world.color=(.07,.07,.07);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.23,.30,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
def area(name,loc,power,color,size,target=(0,0,2)):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Key | large warm softbox',(-4,-5,7),850,(1.0,.90,.75),4.5)
area('Fill | cool front',(4,-3,4.5),650,(.64,.83,1.0),3.0)
area('Rim | warm gold',(1.8,3,6.3),1100,(1.0,.65,.35),3.0)
area('Top flower softbox',(-2,1,7),450,(1,.65,.65),2.5)
bpy.ops.object.camera_add(location=(6,-10,5.1));camera=bpy.context.object;camera.name='Hero camera';camera.data.type='ORTHO';camera.data.ortho_scale=5.6;camera.rotation_euler=(Vector((0,0,1.95))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True;scene.cycles.adaptive_threshold=.025
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='CUDA'
    if any(d.use for d in prefs.devices):scene.cycles.device='GPU'
except Exception as e:print('Cycles CPU fallback:',e)
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.4
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.filepath=os.path.join(RENDERS,'spike-hero.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'spike.blend'))
bpy.ops.render.render(write_still=True)
print('SPIKE_MODEL_COMPLETE',triangles)
