import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'model/shelly.blend'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
brows=[o for o in bpy.data.objects if o.name.startswith('Stable eyebrow')]
assert len(brows)==2
baseline={};error=0
for frame in [0,8,16,24,32,40]:
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
 inv=(arm.matrix_world@arm.pose.bones['head_s'].matrix).inverted()
 deps=bpy.context.evaluated_depsgraph_get()
 for ob in brows:
  ev=ob.evaluated_get(deps);mesh=ev.to_mesh()
  points=[inv@ev.matrix_world@v.co for v in mesh.vertices]
  if ob.name in baseline:error=max(error,max((a-b).length for a,b in zip(points,baseline[ob.name])))
  else:baseline[ob.name]=points
  ev.to_mesh_clear()
assert error<.0001,error
result={'frames':[0,8,16,24,32,40],'max_drift_relative_to_head':error,'passed':True}
(root/'renders/face-motion-check.json').write_text(json.dumps(result,indent=2))
print(result)
