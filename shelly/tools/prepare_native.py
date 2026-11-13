from pathlib import Path
import json,struct,texture2ddecoder
from PIL import Image
root=Path(__file__).resolve().parents[1]
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
g,gb=read(root/'source/shelly_redux_geo.glb');a,ab=read(root/'tools/flat-converter/Out-glTF/shelly_idle.glb')
p=(root/'source/shelly_redux_tex.ktx').read_bytes();h=struct.unpack('<13I',p[12:64]);off=64+h[12];size=struct.unpack_from('<I',p,off)[0]
Image.frombytes('RGBA',(h[6],h[7]),texture2ddecoder.decode_etc1(p[off+4:off+4+size],h[6],h[7]),'raw','BGRA').save(root/'model/shelly_redux.png')
gb=gb[:g['buffers'][0]['byteLength']];gb+=b'\0'*((-len(gb))%4)
offset=len(gb);vb=len(g.get('bufferViews',[]));acc=len(g.get('accessors',[]))
for v in a.get('bufferViews',[]):v['byteOffset']=v.get('byteOffset',0)+offset
for x in a.get('accessors',[]):
 if 'bufferView'in x:x['bufferView']+=vb
g.setdefault('bufferViews',[]).extend(a.get('bufferViews',[]));g.setdefault('accessors',[]).extend(a.get('accessors',[]))
names={n.get('name'):i for i,n in enumerate(g['nodes'])}
for node in a['nodes']:
 if node.get('name') in names:
  target=g['nodes'][names[node['name']]]
  for key in ['translation','rotation','scale']:
   if key in node:target[key]=node[key]
g['animations']=[]
for anim in a.get('animations',[]):
 for s in anim['samplers']:s['input']+=acc;s['output']+=acc
 anim['channels']=[c for c in anim['channels'] if a['nodes'][c['target']['node']].get('name') in names]
 for c in anim['channels']:c['target']['node']=names[a['nodes'][c['target']['node']]['name']]
 anim['name']='Shelly_Idle';g['animations'].append(anim)
g['images']=[];g['textures']=[];g.pop('extensionsRequired',None);g.pop('extensionsUsed',None)
for m in g['materials']:m.pop('extensions',None);m['name']='Shelly surface'
binary=gb+ab;g['buffers']=[{'byteLength':len(binary)}]
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
out=struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(root/'model/shelly-native.glb').write_bytes(out)
print('Native GLB prepared',len(g['nodes']),len(g['animations'][0]['channels']))
