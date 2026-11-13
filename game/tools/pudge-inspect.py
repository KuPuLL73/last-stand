import bpy,json,os
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
source=Path(r'E:/Projects/YANDEX GAME/projects/brawl-zombies/game/assets/pudge/source/base')
bpy.ops.import_scene.fbx(filepath=str(source/'pudge_econ.fbx'))
info={'objects':[],'actions':list(bpy.data.actions.keys()),'materials':[]}
for o in bpy.data.objects:
 info['objects'].append({'name':o.name,'type':o.type,'dim':list(o.dimensions),'rot':list(o.rotation_euler),'loc':list(o.location),'bones':[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local)} for b in o.data.bones] if o.type=='ARMATURE' else [],'mats':[s.name for s in o.data.materials] if o.type=='MESH' else []})
for m in bpy.data.materials:info['materials'].append({'name':m.name,'nodes':[{'name':n.name,'type':n.type,'image':n.image.filepath if n.type=='TEX_IMAGE' and n.image else None}for n in m.node_tree.nodes]if m.use_nodes else []})
Path('E:/Projects/YANDEX GAME/projects/brawl-zombies/game/artifacts/pudge-inspect.json').write_text(json.dumps(info,indent=2))
print(json.dumps({'objects':[(o['name'],o['type'],o['dim'],o['mats'])for o in info['objects']],'actions':info['actions'],'materials':[m['name']for m in info['materials']]}))
