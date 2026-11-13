import bpy,json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=r'E:/Projects/YANDEX GAME/projects/brawl-zombies/game/assets/pudge/source/base/pudge_econ.fbx')
for o in bpy.data.objects:
 if o.type=='MESH' and 'weapon' in o.name:
  p=[o.matrix_world@Vector(v) for v in o.bound_box];print(o.name,'min',[min(x[i]for x in p)for i in range(3)],'max',[max(x[i]for x in p)for i in range(3)],'groups',[g.name for g in o.vertex_groups])
