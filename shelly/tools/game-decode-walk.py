from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
converter=root/'tools/flat-converter'
sys.path.insert(0,str(converter))
from lib.glTF import glTF
from lib.odin import SupercellOdinGLTF
g=glTF();g.read((root/'game/source-walk.glb').read_bytes())
for c in g.chunks:c.deserialize_json()
g=SupercellOdinGLTF(g).process()
(root/'game/walk-decoded.glb').write_bytes(g.write())
print('Decoded walk', (root/'game/walk-decoded.glb').stat().st_size)
