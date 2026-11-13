"""Repack original Minecraft Java 1.21.9 block pixels for the local 3D stage."""
from pathlib import Path
import io,json,zipfile
from PIL import Image,ImageChops

jar=Path(r'C:\Users\PC\AppData\Local\Temp\minecraft-1.21.9-client.jar')
out=Path('game/assets/cubic');out.mkdir(parents=True,exist_ok=True)
z=zipfile.ZipFile(jar)
def image(name):
    im=Image.open(io.BytesIO(z.read('assets/minecraft/textures/block/'+name+'.png'))).convert('RGBA')
    return im.crop((0,0,16,16))
def tint(im,colour):
    rgb=ImageChops.multiply(im.convert('RGB'),Image.new('RGB',im.size,colour)).convert('RGBA')
    rgb.putalpha(im.getchannel('A'));return rgb

tiles=['grass_block_top','grass_block_side','dirt','dirt_path_top','oak_log','oak_log_top','oak_leaves','stone','cobblestone','mossy_cobblestone','oak_planks','diamond_ore','coal_ore','water_still','glass','sand']
atlas=Image.new('RGBA',(128,128))
for i,name in enumerate(tiles):
    im=image(name)
    if name in ['grass_block_top','oak_leaves']:
        im=tint(im,(126,169,72) if name=='grass_block_top' else (105,146,65))
    if name=='grass_block_side':
        overlay=tint(image('grass_block_side_overlay'),(126,169,72));im.alpha_composite(overlay)
    if name=='water_still':im=tint(im,(65,112,215))
    if name=='grass_block_top':im.save(out/'grass.png')
    if name=='dirt_path_top':im.save(out/'path.png')
    if name=='water_still':im.save(out/'water.png')
    x=(i%4)*32+8;y=(i//4)*32+8
    atlas.paste(im,(x,y))
    # Eight pixel gutters preserve borders when the distant atlas is sampled.
    atlas.paste(im.crop((0,0,1,16)).resize((8,16)),(x-8,y))
    atlas.paste(im.crop((15,0,16,16)).resize((8,16)),(x+16,y))
    atlas.paste(atlas.crop((x-8,y,x+24,y+1)).resize((32,8)),(x-8,y-8))
    atlas.paste(atlas.crop((x-8,y+15,x+24,y+16)).resize((32,8)),(x-8,y+16))
atlas.save(out/'block-atlas.png')
for name in ['short_grass','dandelion','poppy','red_mushroom','brown_mushroom']:
    im=image(name)
    if name=='short_grass':im=tint(im,(126,169,72))
    im.save(out/(name+'.png'))
(out/'sources.json').write_text(json.dumps({'version':'Minecraft Java 1.21.9','source':'https://piston-data.mojang.com/v1/objects/ce92fd8d1b2460c41ceda07ae7b3fe863a80d045/client.jar','tiles':tiles,'processing':'Original 16px pixels, biome tint for grass/leaves/water, padded texture atlas. New stage geometry is authored in cubic-stage.js.'},indent=2),encoding='utf-8')
print('Atlas and nine stage textures saved to',out)
