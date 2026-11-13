import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'model/shelly.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
print('ARM',arm.name,'scale',list(arm.scale),'parent',arm.parent.name if arm.parent else None)
print('ANIM',arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else None)
for act in bpy.data.actions:
 print('ACTION',act.name,tuple(act.frame_range),len(act.slots))
 try:
  for curve in act.fcurves: print('F',curve.data_path,curve.array_index,len(curve.keyframe_points))
 except Exception as e:print('FC',e)
for bone in arm.pose.bones:
 print('BONE',bone.name,tuple(bone.location),tuple(bone.rotation_quaternion),tuple(bone.scale))
print('OBJECTS',[(o.name,o.type,o.parent.name if o.parent else None) for o in bpy.data.objects])
