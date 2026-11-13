"""Build a self-contained game GLB without changing the approved Shelly model.

Run with regular Python 3.12. Geometry, face and packed textures are copied from
model/shelly.glb. Walk and Attack come from the public game-asset reference repo.
Static joint transforms are explicitly keyed as well as animated channels: the
original optimized clips store the fingers and weapon grip in static node TRS.
Leaving these out makes Blender/glTF rest transforms open the hands incorrectly.
"""
from pathlib import Path
import copy,json,struct

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game'
OUT.mkdir(exist_ok=True)

def read_glb(path):
    data=path.read_bytes()
    assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
    pos=12;document=None;binary=b''
    while pos<len(data):
        length,kind=struct.unpack_from('<I4s',data,pos);chunk=data[pos+8:pos+8+length]
        if kind==b'JSON':document=json.loads(chunk)
        elif kind==b'BIN\x00':binary=chunk
        pos+=8+length
    return document,binary

def write_glb(path,document,binary):
    document['buffers']=[{'byteLength':len(binary)}]
    j=json.dumps(document,separators=(',',':')).encode()
    j+=b' '*(-len(j)%4);binary+=b'\0'*(-len(binary)%4)
    data=(struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+
          struct.pack('<I4s',len(j),b'JSON')+j+
          struct.pack('<I4s',len(binary),b'BIN\0')+binary)
    path.write_bytes(data)

def accessor_values(doc,binary,index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    components={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    count=a['count']*components
    return struct.unpack_from('<'+'f'*count,binary,v.get('byteOffset',0)+a.get('byteOffset',0))

base,binary=read_glb(ROOT/'model/shelly.glb')
binary=bytearray(binary[:base['buffers'][0]['byteLength']])
names={n.get('name'):i for i,n in enumerate(base['nodes'])}
joints={i for skin in base['skins'] for i in skin['joints']}
base['animations'][0]['name']='Idle'
metadata={'animations':{'Idle':{'duration':max(max(accessor_values(base,binary,s['input'])) for s in base['animations'][0]['samplers'])}},
          'geometry_source':'model/shelly.glb',
          'animation_source':'https://github.com/tailsjs/brawl-stars-assets/tree/master/69.230/sc3d',
          'static_grip_transforms':True,
          'up_axis':'+Y','forward_axis':'+Z',
          'idle_height':3.9676995277404785,'idle_floor_y':0.11999988555908203,
          'root_motion':False}

def append_accessor(values,kind):
    while len(binary)%4:binary.append(0)
    offset=len(binary);binary.extend(struct.pack('<'+'f'*len(values),*values))
    view=len(base['bufferViews']);base['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4})
    count=len(values)//{'SCALAR':1,'VEC3':3,'VEC4':4}[kind]
    acc={'bufferView':view,'componentType':5126,'count':count,'type':kind}
    if kind=='SCALAR':acc['min']=[min(values)];acc['max']=[max(values)]
    index=len(base['accessors']);base['accessors'].append(acc)
    return index

for label,source in [('Walk',OUT/'walk-decoded.glb'),('Attack',ROOT/'tools/flat-converter/Out-glTF/shelly_attack.glb')]:
    doc,blob=read_glb(source);animation=copy.deepcopy(doc['animations'][0])
    duration=max(max(accessor_values(doc,blob,s['input'])) for s in animation['samplers'])
    while len(binary)%4:binary.append(0)
    offset=len(binary);view_offset=len(base['bufferViews']);acc_offset=len(base['accessors'])
    binary.extend(blob[:doc['buffers'][0]['byteLength']])
    for v in copy.deepcopy(doc['bufferViews']):
        v['byteOffset']=v.get('byteOffset',0)+offset
        base['bufferViews'].append(v)
    for a in copy.deepcopy(doc['accessors']):
        if 'bufferView' in a:a['bufferView']+=view_offset
        base['accessors'].append(a)
    for sampler in animation['samplers']:
        sampler['input']+=acc_offset;sampler['output']+=acc_offset
        sampler.setdefault('interpolation','LINEAR')
    channels=[];animated=set()
    for channel in animation['channels']:
        name=doc['nodes'][channel['target']['node']].get('name')
        if name not in names or names[name] not in joints:continue
        channel['target']['node']=names[name];channels.append(channel)
        animated.add((name,channel['target']['path']))
    static_count=0
    time_accessor=append_accessor([0,duration],'SCALAR')
    for node in doc['nodes']:
        name=node.get('name')
        if name not in names or names[name] not in joints:continue
        for path,default,kind in [('translation',[0,0,0],'VEC3'),('rotation',[0,0,0,1],'VEC4'),('scale',[1,1,1],'VEC3')]:
            if (name,path) in animated:continue
            values=node.get(path,default)
            accessor=append_accessor(values+values,kind)
            sampler=len(animation['samplers'])
            animation['samplers'].append({'input':time_accessor,'output':accessor,'interpolation':'LINEAR'})
            channels.append({'sampler':sampler,'target':{'node':names[name],'path':path}})
            static_count+=1
    animation['name']=label;animation['channels']=channels
    base['animations'].append(animation)
    metadata['animations'][label]={'duration':duration,'channels':len(channels),'static_channels':static_count}

base.setdefault('asset',{}).setdefault('extras',{})['game_character']='Approved Shelly geometry and stable face, Idle/Walk/Attack with complete static grip transforms'
write_glb(OUT/'shelly-game.glb',base,binary)
(OUT/'character-info.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata,indent=2))
print('OUTPUT',OUT/'shelly-game.glb',(OUT/'shelly-game.glb').stat().st_size)
