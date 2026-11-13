"""Copy pinned original item pixels from the locally cached Minecraft client."""
from hashlib import sha1, sha256
from io import BytesIO
import json
from pathlib import Path
import zipfile
from PIL import Image

archive = Path('minecraft-1.21.9-client.jar')
target = Path(__file__).resolve().parents[1] / 'assets' / 'extra-weapons'
expected = 'ce92fd8d1b2460c41ceda07ae7b3fe863a80d045'
assert sha1(archive.read_bytes()).hexdigest() == expected, 'Unexpected source archive'
target.mkdir(parents=True, exist_ok=True)
items, pixels = [], {}
with zipfile.ZipFile(archive) as source:
    for key, name in [('snowball', 'snowball'), ('thrown-trident', 'trident')]:
        archive_path = f'assets/minecraft/textures/item/{name}.png'
        data = source.read(archive_path)
        (target / f'{name}.png').write_bytes(data)
        im = Image.open(BytesIO(data)).convert('RGBA')
        pixels[key] = {'width': im.width, 'height': im.height, 'pixels': list(im.getdata())}
        items.append({'file': f'{name}.png', 'archivePath': archive_path, 'sha256': sha256(data).hexdigest()})
    for name in ['trident_in_hand', 'trident_throwing']:
        archive_path = f'assets/minecraft/models/item/{name}.json'
        data = source.read(archive_path)
        (target / f'{name}.json').write_bytes(data)
        items.append({'file': f'{name}.json', 'archivePath': archive_path, 'sha256': sha256(data).hexdigest()})
(target / 'item-pixels.js').write_text('export default ' + json.dumps(pixels, separators=(',', ':')) + ';\n', encoding='utf-8')
(target / 'sources.json').write_text(json.dumps({
    'version': '1.21.9', 'archive': str(archive), 'clientSha1': expected, 'items': items,
    'notes': 'Unmodified Mojang snowball/trident item art and original held/throw transforms. Game meshes are authored voxel extrusions of these item pixels; no claim that the generated-item extrusion is the Java entity mesh. Infinite slowing snowballs and a thrown piercing trident are this game\'s weapon roles.'
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Extracted {len(items)} original resources to {target}')
