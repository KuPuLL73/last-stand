from pathlib import Path
import struct
import texture2ddecoder
from PIL import Image
root=Path(__file__).resolve().parents[1]
p=(root/'source/shelly_v2_01.ktx').read_bytes()
h=struct.unpack('<13I',p[12:64])
w,he=h[6:8]
off=64+h[12]
size=struct.unpack('<I',p[off:off+4])[0]
rgba=texture2ddecoder.decode_etc1(p[off+4:off+4+size],w,he)
Image.frombytes('RGBA',(w,he),rgba,'raw','BGRA').save(root/'model/shelly_v2_01.png')
print(w,he,size)
