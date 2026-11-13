import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {guardianGeometry} from './minecraft-boss-poses.js';
import itemPixels from './assets/minecraft-roster/item-pixels.json';
import g_zombie_villager_v2 from './assets/minecraft-roster/zombie_villager_v2.geo.json';
import g_wither_skeleton from './assets/minecraft-roster/wither_skeleton.geo.json';
import g_bogged from './assets/minecraft-roster/bogged.geo.json';
import g_bogged_armor from './assets/minecraft-roster/bogged_armor.geo.json';
import g_pillager from './assets/minecraft-roster/pillager.geo.json';
import g_vindicator from './assets/minecraft-roster/vindicator.geo.json';
import g_evoker from './assets/minecraft-roster/evoker.geo.json';
import g_witch from './assets/minecraft-roster/witch.geo.json';
import g_villager from './assets/minecraft-roster/villager.geo.json';
import g_enderman from './assets/minecraft-roster/enderman.geo.json';
import g_slime from './assets/minecraft-roster/slime.geo.json';
import g_slime_armor from './assets/minecraft-roster/slime_armor.geo.json';
import g_magma_cube_v2 from './assets/minecraft-roster/magma_cube_v2.geo.json';
import g_blaze from './assets/minecraft-roster/blaze.geo.json';
import g_breeze from './assets/minecraft-roster/breeze.geo.json';
import g_ghast from './assets/minecraft-roster/ghast.geo.json';
import g_phantom from './assets/minecraft-roster/phantom.geo.json';
import g_silverfish from './assets/minecraft-roster/silverfish.geo.json';
import g_endermite from './assets/minecraft-roster/endermite.geo.json';
import g_guardian from './assets/minecraft-roster/guardian.geo.json';
import g_shulker from './assets/minecraft-roster/shulker.geo.json';
import g_vex from './assets/minecraft-roster/vex.geo.json';
import g_hoglin from './assets/minecraft-roster/hoglin.geo.json';
import g_piglin from './assets/minecraft-roster/piglin.geo.json';
import g_ravager from './assets/minecraft-roster/ravager.geo.json';
import g_creaking from './assets/minecraft-roster/creaking.geo.json';
import t0 from './assets/minecraft-roster/zombie-villager.png?url';
import t1 from './assets/minecraft-roster/zombie-villager-plains.png?url';
import t2 from './assets/minecraft-roster/wither-skeleton.png?url';
import t3 from './assets/minecraft-roster/bogged.png?url';
import t4 from './assets/minecraft-roster/bogged-overlay.png?url';
import t5 from './assets/minecraft-roster/pillager.png?url';
import t6 from './assets/minecraft-roster/vindicator.png?url';
import t7 from './assets/minecraft-roster/evoker.png?url';
import t8 from './assets/minecraft-roster/witch.png?url';
import t9 from './assets/minecraft-roster/enderman.png?url';
import t10 from './assets/minecraft-roster/enderman-eyes.png?url';
import t11 from './assets/minecraft-roster/slime.png?url';
import t12 from './assets/minecraft-roster/magma-cube.png?url';
import t13 from './assets/minecraft-roster/blaze.png?url';
import t14 from './assets/minecraft-roster/breeze.png?url';
import t15 from './assets/minecraft-roster/breeze-eyes.png?url';
import t16 from './assets/minecraft-roster/breeze-wind.png?url';
import t17 from './assets/minecraft-roster/ghast.png?url';
import t18 from './assets/minecraft-roster/phantom.png?url';
import t19 from './assets/minecraft-roster/phantom-eyes.png?url';
import t20 from './assets/minecraft-roster/silverfish.png?url';
import t21 from './assets/minecraft-roster/endermite.png?url';
import t22 from './assets/minecraft-roster/guardian.png?url';
import t23 from './assets/minecraft-roster/shulker.png?url';
import t24 from './assets/minecraft-roster/vex.png?url';
import t25 from './assets/minecraft-roster/hoglin.png?url';
import t26 from './assets/minecraft-roster/zoglin.png?url';
import t27 from './assets/minecraft-roster/piglin.png?url';
import t28 from './assets/minecraft-roster/piglin-brute.png?url';
import t29 from './assets/minecraft-roster/zombified-piglin.png?url';
import t30 from './assets/minecraft-roster/ravager.png?url';
import t31 from './assets/minecraft-roster/creaking.png?url';
import t32 from './assets/minecraft-roster/creaking-eyes.png?url';

const TEX={"zombie-villager": t0, "zombie-villager-plains": t1, "wither-skeleton": t2, "bogged": t3, "bogged-overlay": t4, "pillager": t5, "vindicator": t6, "evoker": t7, "witch": t8, "enderman": t9, "enderman-eyes": t10, "slime": t11, "magma-cube": t12, "blaze": t13, "breeze": t14, "breeze-eyes": t15, "breeze-wind": t16, "ghast": t17, "phantom": t18, "phantom-eyes": t19, "silverfish": t20, "endermite": t21, "guardian": t22, "shulker": t23, "vex": t24, "hoglin": t25, "zoglin": t26, "piglin": t27, "piglin-brute": t28, "zombified-piglin": t29, "ravager": t30, "creaking": t31, "creaking-eyes": t32};

// Measured Mojang geometries retain their own silhouettes and UV rectangles.
// Only rig naming, inherited geometry and arena size are normalized here.
const UNIT=1.85/32;
const sourceOf=(json,index=0)=>json['minecraft:geometry']?.[index]||Object.values(json).find(v=>v?.bones);
const rename={rightarm:'rightArm',leftarm:'leftArm',rightleg:'rightLeg',leftleg:'leftLeg'};
function model(json,{index=0,hideFolded=false,inflate=0}={}){
 const source=sourceOf(json,index),bones=structuredClone(source.bones);
 for(const bone of bones){
  bone.name=rename[bone.name]||bone.name;if(bone.parent)bone.parent=rename[bone.parent]||bone.parent;
  if(hideFolded&&bone.name==='arms')bone.cubes=[];
  if(inflate)for(const cube of bone.cubes||[])cube.inflate=(cube.inflate??bone.inflate??0)+inflate;
 }
 return {'minecraft:geometry':[{description:source.description,bones}]};
}
function inheritedWitch(){
 const base=structuredClone(sourceOf(g_villager).bones),overrides=sourceOf(g_witch).bones;
 for(const bone of overrides){const existing=base.find(b=>b.name===bone.name);if(existing){existing.cubes=[...(existing.cubes||[]),...(structuredClone(bone.cubes)||[])];Object.assign(existing,Object.fromEntries(Object.entries(bone).filter(([k])=>k!=='cubes')));}else base.push(structuredClone(bone));}
 return {'minecraft:geometry':[{bones:base}]};
}
function standingEnderman(){
 const json=model(g_enderman),bones=json['minecraft:geometry'][0].bones;
 // Resolve the source rest pose: one tall head over the torso, long thin
 // arms outside the chest, and both thirty-pixel legs ending on the floor.
 for(const b of bones){
  if(b.pivot)b.pivot[1]+=4;
  for(const c of b.cubes||[])c.origin[1]+=4;
  if(b.name==='head'){b.pivot[1]+=14;for(const c of b.cubes||[])c.origin[1]+=14;}
  if(b.name==='rightArm'){b.pivot[0]-=2;for(const c of b.cubes||[])c.origin[0]-=2;}
 }
 return json;
}
function quadrupedRest(json){
 const result=model(json);
 // These authored rest angles are clockwise in the Bedrock model. Resolve
 // them independently of our right-handed animation deltas: otherwise the
 // hoglin snout points upward and the ravager torso folds below its legs.
 // Cube proportions, pivots and original texture rectangles stay intact.
 for(const bone of sourceOf(result).bones)if(bone.rotation)bone.rotation[0]*=-1;
 return result;
}
const h={zombie:model(g_zombie_villager_v2),skeleton:model(g_wither_skeleton),bogged:model(g_bogged),boggedShell:model(g_bogged_armor),pillager:model(g_pillager),vindicator:model(g_vindicator,{hideFolded:true}),evoker:model(g_evoker,{hideFolded:true}),witch:inheritedWitch(),enderman:standingEnderman(),slime:model(g_slime),slimeShell:model(g_slime_armor),magma:model(g_magma_cube_v2),blaze:model(g_blaze),breeze:model(g_breeze),ghast:model(g_ghast),phantom:model(g_phantom),silverfish:model(g_silverfish),endermite:model(g_endermite),guardian:model(guardianGeometry(g_guardian)),shulker:model(g_shulker),vex:model(g_vex),hoglin:quadrupedRest(g_hoglin),piglin:model(g_piglin),ravager:quadrupedRest(g_ravager),creaking:model(g_creaking)};
const breezeWind={'minecraft:geometry':[{bones:sourceOf(g_breeze,2).bones.map(b=>{const result=structuredClone(b);for(const index of[3,4]){const other=sourceOf(g_breeze,index).bones.find(n=>n.name===b.name);if(other?.cubes?.length)result.cubes=[...(result.cubes||[]),...structuredClone(other.cubes)];}return result;})}]};
const layer=(g,texture,w=64,height=64)=>[g,TEX[texture],w,height];
const gear=new Set(['wither-skeleton','pillager','vindicator','witch','vex','piglin','piglin-brute','zombified-piglin']);
function define(id,type,geometry,texture,scale,animation,options={}){
 const result={type,layers:[layer(geometry,texture,...(options.textureSize||[64,64]))],scale,animation:'roster-'+animation,bow:id==='bogged',healthHeight:options.healthHeight||2.1,shadowScale:options.shadowScale||1,...options};
 if(gear.has(id))result.equipment='roster:'+id;
 result.animate=(name,pivot,time,stride,walk,entity)=>applyRosterPose(result.animation,name,pivot,time,stride,walk,entity);
 return result;
}
export const EXTRA_MOB_DEFINITIONS={
 'zombie-villager':define('zombie-villager','walker',h.zombie,'zombie-villager',1,'humanoid',{layers:[layer(h.zombie,'zombie-villager'),layer(model(g_zombie_villager_v2,{inflate:.12}),'zombie-villager-plains')]}),
 'wither-skeleton':define('wither-skeleton','walker',h.skeleton,'wither-skeleton',1.12,'humanoid',{textureSize:[64,32],healthHeight:2.4}),
 bogged:define('bogged','spitter',h.bogged,'bogged',1,'humanoid',{layers:[layer(h.bogged,'bogged',64,32),layer(h.boggedShell,'bogged-overlay',64,32)]}),
 pillager:define('pillager','spitter',h.pillager,'pillager',1,'humanoid'),
 vindicator:define('vindicator','walker',h.vindicator,'vindicator',1,'humanoid'),
 evoker:define('evoker','spitter',h.evoker,'evoker',1,'humanoid'),
 witch:define('witch','spitter',h.witch,'witch',.94,'witch',{textureSize:[64,128],healthHeight:2.6}),
 enderman:define('enderman','walker',h.enderman,'enderman',1,'enderman',{textureSize:[64,32],layers:[layer(h.enderman,'enderman',64,32),layer(h.enderman,'enderman-eyes',64,32)],layerMaterials:[{}, {unlit:true,transparent:true,alphaTest:.05,depthWrite:false}],healthHeight:3.25}),
 slime:define('slime','runner',h.slime,'slime',1.75,'slime',{textureSize:[64,32],layers:[layer(h.slime,'slime',64,32),layer(h.slimeShell,'slime',64,32)],layerMaterials:[{}, {transparent:true,opacity:.55,alphaTest:.03,depthWrite:false}],healthHeight:1.1,shadowScale:1.1}),
 'magma-cube':define('magma-cube','runner',h.magma,'magma-cube',1.75,'magma',{healthHeight:1.2,shadowScale:1.1}),
 blaze:define('blaze','spitter',h.blaze,'blaze',.95,'blaze',{textureSize:[64,32],bob:.05,healthHeight:2.4}),
 breeze:define('breeze','spitter',h.breeze,'breeze',1,'breeze',{layers:[layer(h.breeze,'breeze',32,32),layer(breezeWind,'breeze-wind',128,128),layer(model(g_breeze,{index:1,inflate:.01}),'breeze-eyes',32,32)],layerMaterials:[{},{transparent:true,opacity:.7,alphaTest:.025,depthWrite:false},{unlit:true,transparent:true,alphaTest:.05,depthWrite:false}],doubleSide:true,healthHeight:2.0}),
 ghast:define('ghast','spitter',h.ghast,'ghast',.42,'ghast',{textureSize:[64,32],yOffset:1.5,bob:.08,healthHeight:3.0,shadowScale:1.7}),
 phantom:define('phantom','runner',h.phantom,'phantom',1.5,'phantom',{layers:[layer(h.phantom,'phantom'),layer(model(g_phantom,{inflate:.01}),'phantom-eyes')],layerMaterials:[{}, {unlit:true,transparent:true,alphaTest:.05,depthWrite:false}],doubleSide:true,yOffset:-.7,bob:.05,healthHeight:1.8,shadowScale:1.3}),
 silverfish:define('silverfish','runner',h.silverfish,'silverfish',1.3,'silverfish',{textureSize:[64,32],healthHeight:.6,shadowScale:.55,doubleSide:true}),
 endermite:define('endermite','runner',h.endermite,'endermite',1.6,'endermite',{textureSize:[64,32],healthHeight:.7,shadowScale:.55}),
 guardian:define('guardian','spitter',h.guardian,'guardian',.95,'guardian',{yOffset:.4,bob:.04,healthHeight:1.7,shadowScale:1.1}),
 shulker:define('shulker','spitter',h.shulker,'shulker',1.15,'shulker',{healthHeight:1.6,shadowScale:1.15}),
 vex:define('vex','runner',h.vex,'vex',1.05,'vex',{textureSize:[32,32],doubleSide:true,yOffset:.65,bob:.07,healthHeight:1.7,shadowScale:.6}),
 hoglin:define('hoglin','walker',h.hoglin,'hoglin',.9,'quadruped',{textureSize:[128,64],healthHeight:1.9,shadowScale:1.4}),
 zoglin:define('zoglin','walker',h.hoglin,'zoglin',.9,'quadruped',{textureSize:[128,64],healthHeight:1.9,shadowScale:1.4}),
 piglin:define('piglin','spitter',h.piglin,'piglin',1,'humanoid'),
 'piglin-brute':define('piglin-brute','walker',h.piglin,'piglin-brute',1.1,'humanoid',{healthHeight:2.3}),
 'zombified-piglin':define('zombified-piglin','walker',h.piglin,'zombified-piglin',1,'humanoid'),
 ravager:define('ravager','walker',h.ravager,'ravager',.85,'quadruped',{textureSize:[128,128],healthHeight:2.3,shadowScale:1.7}),
 creaking:define('creaking','walker',h.creaking,'creaking',1,'creaking',{layers:[layer(h.creaking,'creaking'),layer(model(g_creaking,{inflate:.01}),'creaking-eyes')],layerMaterials:[{}, {unlit:true,transparent:true,alphaTest:.05,depthWrite:false}],healthHeight:2.9,shadowScale:1.15}),
};
export const EXTRA_MOB_IDS=Object.freeze(Object.keys(EXTRA_MOB_DEFINITIONS));
export const EXTRA_MOB_NAMES=Object.freeze({'zombie-villager':'Зомби-житель','wither-skeleton':'Скелет-визер',bogged:'Болотник',pillager:'Разбойник',vindicator:'Поборник',evoker:'Заклинатель',witch:'Ведьма',enderman:'Эндермен',slime:'Слизень','magma-cube':'Магмовый куб',blaze:'Ифрит',breeze:'Вихрь',ghast:'Гаст',phantom:'Фантом',silverfish:'Чешуйница',endermite:'Эндермит',guardian:'Страж',shulker:'Шалкер',vex:'Досаждатель',hoglin:'Хоглин',zoglin:'Зоглин',piglin:'Пиглин','piglin-brute':'Жестокий пиглин','zombified-piglin':'Зомбифицированный пиглин',ravager:'Разоритель',creaking:'Скрипун'});

/** Called against one reusable joint object; no allocations in the horde loop. */
export function applyRosterPose(animation,name,pivot,time,stride,walk,entity){
 if(!animation.startsWith('roster-'))return false;
 const kind=animation.slice(7),n=name.toLowerCase(),variant=entity.variant||'',casting=Number(entity.castUntil||0)>time;
 if(kind==='humanoid'||kind==='creaking'||kind==='enderman'||kind==='witch'){
  if(n==='rightleg'||n==='leg0')pivot.rotation.x+=walk*(kind==='enderman'?.65:1);
  else if(n==='leftleg'||n==='leg1')pivot.rotation.x-=walk*(kind==='enderman'?.65:1);
  else if(n==='rightarm'||n==='leftarm'){
   const side=n==='rightarm'?1:-1;
   if(['zombie-villager','zombified-piglin'].includes(variant))pivot.rotation.x+=-1.40+walk*.08*side;
   else if(['pillager','piglin','bogged'].includes(variant)){pivot.rotation.x+=-1.42;pivot.rotation.y+=side<0?-.40:-.10;}
   else if(variant==='evoker'){pivot.rotation.x+=-1.1;pivot.rotation.z+=side*.52+Math.sin(time*2.2)*.05;}
   else pivot.rotation.x+=side*walk*.45-(entity.charge||casting?.65:0);
  }
 }else if(kind==='slime'){
  if(name==='cube'){const squash=1+Math.sin(stride*.7)*.075;pivot.scale.set(1/Math.sqrt(squash),squash,1/Math.sqrt(squash));pivot.position.y+=24*UNIT*(squash-1)+Math.max(0,Math.sin(stride*.7))*.17;}
 }else if(kind==='magma'){
  if(name==='insideCube')pivot.position.y+=Math.max(0,Math.sin(stride*.6))*.20;
  else if(name.startsWith('bodyCube_'))pivot.position.y+=(7-Number(name.slice(9)))*Math.max(0,Math.sin(stride*.6))*.018;
 }else if(kind==='blaze'){
  if(name.startsWith('upperBodyParts')){
   const i=Number(name.slice(14)),ring=Math.floor(i/4),angle=time*(ring===0?-Math.PI*2:ring===1?Math.PI*.6:-Math.PI)+(i%4)*Math.PI/2+(ring===1?Math.PI/4:ring===2?.15*Math.PI:0),radius=[9,7,5][ring],height=[2,-2,-11][ring]+Math.cos((i*(ring===2?1.5:2)+time*20)*14.32*Math.PI/180);
   pivot.position.set((Math.cos(angle)*radius-1)*UNIT,(24+height)*UNIT,(-Math.sin(angle)*radius+1)*UNIT);
  }
  else if(name==='head')pivot.position.y+=Math.sin(time*1.5)*.04;
 }else if(kind==='breeze'){
  if(name==='rods')pivot.rotation.y+=time*.9;
  else if(name.startsWith('tornado_'))pivot.rotation.y+=time*(name.endsWith('top')?-.45:name.endsWith('mid')?.6:-.8);
 }else if(kind==='ghast'){
  if(name.startsWith('tentacles_'))pivot.rotation.x+=.15+Math.sin(time*1.8+Number(name.slice(10)))*.22;
 }else if(kind==='phantom'){
  if(name.startsWith('wing'))pivot.rotation.z+=(name.endsWith('0')?1:-1)*(.15+Math.sin(stride*.7)*.55);
  else if(name.startsWith('tail'))pivot.rotation.y+=Math.sin(time*2.2)*.13;
 }else if(kind==='silverfish'||kind==='endermite'){
  const i=Number(n.split('_').at(-1))||0;pivot.rotation.y+=Math.sin(stride*.8+i*.8)*.10;pivot.position.x+=Math.sin(stride*.8+i*.8)*.025;
 }else if(kind==='guardian'){
  if(name.startsWith('tailpart'))pivot.rotation.y+=Math.sin(time*2.3+Number(name.slice(8)))*.25;

 }else if(kind==='shulker'){
  if(name==='lid'){pivot.position.y+=.18+.09*Math.sin(time*1.5);pivot.rotation.y+=Math.sin(time*.75)*.10;}
 }else if(kind==='vex'){
  if(n==='rightwing'||n==='leftwing')pivot.rotation.y+=(n==='leftwing'?1:-1)*(.6+Math.sin(time*9)*.3);
  else if(n==='rightarm')pivot.rotation.x-=.6;
 }else if(kind==='quadruped'){
  if(n.startsWith('leg')){const right=n.includes('right')||n==='leg0'||n==='leg3',front=n.includes('front')||n==='leg0'||n==='leg1';pivot.rotation.x+=(right===front?1:-1)*walk*.7;}
  else if(name==='head'&&entity.charge)pivot.rotation.x+=.23;
 }
 return true;
}

/** Exact source item pixels extruded once, merged and attached to a hand. */
export function createRosterEquipment(id){
 const item=id==='pillager'||id==='piglin'?'crossbow':id==='vindicator'?'iron-axe':id==='piglin-brute'?'golden-axe':id==='zombified-piglin'?'golden-sword':id==='wither-skeleton'?'stone-sword':id==='vex'?'iron-sword':id==='witch'?'potion':null;
 if(!item)return{};
 const data=itemPixels[item],width=data.width,height=data.height,pixel=id==='vex'?.027:id==='witch'?.028:.047,depth=.045,positions=[],normals=[],colors=[],colour=new THREE.Color();
 const opaque=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&data.pixels[y*width+x][3]>127;
 const faces=[{n:[0,0,1],q:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:1},{n:[0,0,-1],q:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.85},{n:[1,0,0],q:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.73,near:[1,0]},{n:[-1,0,0],q:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.78,near:[-1,0]},{n:[0,1,0],q:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1.05,near:[0,-1]},{n:[0,-1,0],q:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.65,near:[0,1]}];
 const grip=item==='crossbow'?[8,9]:item==='potion'?[8,6]:[6,13];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(opaque(x,y)){
  const rgba=data.pixels[y*width+x];colour.setRGB(rgba[0]/255,rgba[1]/255,rgba[2]/255,THREE.SRGBColorSpace);
  for(const face of faces){if(face.near&&opaque(x+face.near[0],y+face.near[1]))continue;for(const i of[0,1,2,0,2,3]){const q=face.q[i];positions.push((x+q[0]-grip[0])*pixel,(grip[1]-y-1+q[1])*pixel,(q[2]-.5)*depth);normals.push(...face.n);colors.push(colour.r*face.shade,colour.g*face.shade,colour.b*face.shade);}}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 if(id==='witch')g.translate(.21,-.12,.30);else g.translate(0,id==='vex'?-.20:-.57,.04);
 g.computeBoundingSphere();return{[id==='witch'?'arms':'rightArm']:g};
}
