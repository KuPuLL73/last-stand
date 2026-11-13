from pathlib import Path
import json,struct
root=Path(__file__).resolve().parents[1]
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
for p in [root/'model/shelly.glb',root/'tools/flat-converter/Out-glTF/shelly_idle.glb',root/'game/walk-decoded.glb']:
 g,b=read(p);print('\nFILE',p)
 for name in ['Root','hips_s','L_upperLeg_s','R_wrist_s','R_index_01_s','L_gunbone_01_s','head_s']:
  for n in g['nodes']:
   if n.get('name')==name:print(name, {k:v for k,v in n.items() if k not in ['children']})
 print('ANIMS',[(x.get('name'),len(x['channels'])) for x in g.get('animations',[])])
 for ch in g['animations'][0]['channels']:
  name=g['nodes'][ch['target']['node']].get('name')
  if name in ['head_s','R_index_01_s','L_gunbone_01_s']:
   a=g['accessors'][g['animations'][0]['samplers'][ch['sampler']]['output']];v=g['bufferViews'][a['bufferView']];n={'VEC3':3,'VEC4':4}[a['type']]
   print('FIRST',name,ch['target']['path'],struct.unpack_from('<'+'f'*n,b,v.get('byteOffset',0)+a.get('byteOffset',0)))
