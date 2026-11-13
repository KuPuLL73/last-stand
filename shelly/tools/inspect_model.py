import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.collada_import(filepath=str(root/'model/shelly.dae'))
for ob in bpy.data.objects:
 print('OBJECT',ob.name,ob.type,tuple(ob.dimensions),tuple(ob.location))
 if ob.type=='ARMATURE':
  print('BONES',[(b.name,tuple(b.head_local),tuple(b.tail_local)) for b in ob.data.bones])
bpy.ops.wm.save_as_mainfile(filepath=str(root/'model/imported.blend'))
