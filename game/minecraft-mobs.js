import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import zombie from './assets/minecraft-mobs/zombie.geo.json';
import skeleton from './assets/minecraft-mobs/skeleton.geo.json';
import spider from './assets/minecraft-mobs/spider.geo.json';
import creeper from './assets/minecraft-mobs/creeper.geo.json';
import golem from './assets/minecraft-mobs/iron_golem.geo.json';
import husk from './assets/minecraft-mobs/husk.geo.json';
import stray from './assets/minecraft-mobs/stray.geo.json';
import strayClothes from './assets/minecraft-mobs/stray_armor.geo.json';
import wither from './assets/minecraft-mobs/wither_boss.geo.json';
import warden from './assets/minecraft-mobs/warden.geo.json';
import guardian from './assets/minecraft-mobs/guardian.geo.json';
import zombieBrute from './assets/minecraft-mobs/zombie-brute.geo.json';
import dragon from './assets/minecraft-mobs/ender_dragon.geo.json';
import zombieURL from './assets/minecraft-mobs/zombie-zombie.png?url';
import skeletonURL from './assets/minecraft-mobs/skeleton-skeleton.png?url';
import spiderURL from './assets/minecraft-mobs/spider-spider.png?url';
import creeperURL from './assets/minecraft-mobs/creeper-creeper.png?url';
import golemURL from './assets/minecraft-mobs/iron_golem-iron_golem.png?url';
import huskURL from './assets/minecraft-mobs/zombie-husk.png?url';
import drownedURL from './assets/minecraft-mobs/zombie-drowned.png?url';
import drownedOuterURL from './assets/minecraft-mobs/zombie-drowned_outer_layer.png?url';
import strayURL from './assets/minecraft-mobs/skeleton-stray.png?url';
import strayClothesURL from './assets/minecraft-mobs/skeleton-stray_overlay.png?url';
import caveSpiderURL from './assets/minecraft-mobs/spider-cave_spider.png?url';
import witherURL from './assets/minecraft-mobs/wither.png?url';
import wardenURL from './assets/minecraft-mobs/warden.png?url';
import wardenGlowURL from './assets/minecraft-mobs/warden-bioluminescent.png?url';
import guardianURL from './assets/minecraft-mobs/guardian-elder.png?url';
import dragonURL from './assets/minecraft-mobs/ender-dragon.png?url';
import dragonEyesURL from './assets/minecraft-mobs/ender-dragon-eyes.png?url';
import {createMinecraftItem} from './steve-model.js';
import {createCubicEquipment} from './cubic-equipment.js';
import {guardianGeometry,dragonGeometry,applyBossPose} from './minecraft-boss-poses.js';
import {EXTRA_MOB_DEFINITIONS,createRosterEquipment} from './minecraft-roster.js';

// Original proportions and UV offsets: Mojang's Bedrock sample pack.
// Render convention +Z forward, converted from Bedrock's -Z forward.
const UNIT=1.85/32;
const geometryOf=json=>json['minecraft:geometry']?.[0]||Object.values(json).find(v=>v?.bones);
// Java's 64px humanoid skins store the left limbs separately. The original
// Bedrock samples use the older mirrored 32px layout, so retain their measured
// proportions while selecting the matching Java texture rectangles.
function javaZombieGeometry(json){
 const bones=geometryOf(json).bones.map(bone=>{
  const result={...bone,cubes:bone.cubes?.map(cube=>({...cube}))};
  if(bone.name==='leftArm'||bone.name==='leftLeg'){
   result.mirror=false;
   for(const cube of result.cubes||[]){cube.uv=bone.name==='leftArm'?[32,48]:[16,48];cube.mirror=false;}
  }
  return result;
 });
 return{'minecraft:geometry':[{bones}]};
}
// Husk's lower 32 pixels are transparent despite its 64×64 image dimensions.
// It keeps the legacy mirrored limbs; only drowned uses separate Java limbs.
const javaHusk=husk,javaDrowned=javaZombieGeometry(zombie),elderGuardian=guardianGeometry(guardian),enderDragon=dragonGeometry(dragon);
const drownedOuter={'minecraft:geometry':[{bones:geometryOf(javaDrowned).bones.map(bone=>({...bone,cubes:bone.cubes?.map(cube=>({...cube,inflate:.25}))}))}]};
const definitions={
 walker:{type:'walker',layers:[[zombie,zombieURL,64,64]],scale:1},
 spitter:{type:'spitter',layers:[[skeleton,skeletonURL,64,32]],scale:1},
 runner:{type:'runner',layers:[[spider,spiderURL,64,32]],scale:.88},
 creeper:{type:'creeper',layers:[[creeper,creeperURL,64,32]],scale:1},
 boss:{type:'boss',layers:[[golem,golemURL,128,128]],scale:1.28,healthHeight:3.4,shadowScale:2.2},
 'iron-golem':{type:'boss',layers:[[golem,golemURL,128,128]],scale:1.28,healthHeight:3.4,shadowScale:2.2},
 husk:{type:'walker',layers:[[javaHusk,huskURL,64,64]],scale:1.06},
 stray:{type:'spitter',layers:[[stray,strayURL,64,32],[strayClothes,strayClothesURL,64,32]],scale:1},
 'cave-spider':{type:'runner',layers:[[spider,caveSpiderURL,64,32]],scale:.88*.7},
 drowned:{type:'walker',layers:[[javaDrowned,drownedURL,64,64],[drownedOuter,drownedOuterURL,64,64]],scale:1},
 'armored-zombie':{type:'walker',layers:[[zombie,zombieURL,64,64]],scale:1.10,equipment:'armored-zombie',healthHeight:2.4,shadowScale:1.15},
 'armored-skeleton':{type:'spitter',layers:[[skeleton,skeletonURL,64,32]],scale:1.08,equipment:'armored-skeleton',healthHeight:2.35,shadowScale:1.1},
 wither:{type:'boss',animation:'wither',layers:[[wither,witherURL,64,64]],scale:1.55,yOffset:.18,bob:.06,healthHeight:3.0,shadowScale:2.2},
 warden:{type:'boss',animation:'warden',layers:[[warden,wardenURL,128,128],[warden,wardenGlowURL,128,128]],scale:1.05,healthHeight:3.8,shadowScale:2.4},
 'elder-guardian':{type:'boss',animation:'guardian',layers:[[elderGuardian,guardianURL,64,64]],scale:2.35,yOffset:.55,bob:.05,healthHeight:3.65,shadowScale:2.4},
 'zombie-brute':{type:'boss',animation:'brute',layers:[[zombieBrute,zombieURL,64,64]],scale:1.25,equipment:'zombie-brute',healthHeight:3.3,shadowScale:2.5},
 'ender-dragon':{type:'boss',animation:'dragon',layers:[[enderDragon,dragonURL,256,256],[enderDragon,dragonEyesURL,256,256]],scale:.47,yOffset:2.0,bob:.09,healthHeight:3.6,shadowScale:3.3,doubleSide:true},
 ...EXTRA_MOB_DEFINITIONS,
};
export function createBedrockCubeGeometry(cube,bone,tw,th){
 const [w,h,d]=cube.size,[x,y,z]=cube.origin,[px,py,pz]=bone.pivot||[0,0,0],inflate=cube.inflate??bone.inflate??0;
 const g=new THREE.BoxGeometry((w+inflate*2)*UNIT,(h+inflate*2)*UNIT,(d+inflate*2)*UNIT);
 const uv=g.attributes.uv,[uw,uh,ud]=cube.texture_size||cube.size;
 let rects;if(Array.isArray(cube.uv)){const[u,v]=cube.uv;rects=cube.uv_rects||[[u+ud+uw,v+ud,ud,uh],[u,v+ud,ud,uh],[u+ud,v,uw,ud],[u+ud+uw,v,uw,ud],[u+ud,v+ud,uw,uh],[u+ud+uw+ud,v+ud,uw,uh]];}
 else rects=['east','west','up','down','north','south'].map((name,i)=>{const data=cube.uv?.[name];return data?[...data.uv,...(data.uv_size||([i<2?ud:uw,i===2||i===3?ud:uh]))]:[0,0,0,0];});
 for(let face=0;face<6;face++){const[a,b,rw,rh]=rects[face];for(let i=0;i<4;i++){const n=face*4+i,fu=uv.getX(n),fv=uv.getY(n);uv.setXY(n,(a+((cube.mirror??bone.mirror)?1-fu:fu)*rw)/tw,1-(b+(1-fv)*rh)/th);}}
 g.translate((x+w/2-px)*UNIT,(y+h/2-py)*UNIT,-(z+d/2-pz)*UNIT);
 if(cube.rotation){const p=cube.pivot||bone.pivot||[0,0,0],pivot=new THREE.Vector3((p[0]-px)*UNIT,(p[1]-py)*UNIT,-(p[2]-pz)*UNIT),rotation=new THREE.Euler(-cube.rotation[0]*Math.PI/180,-cube.rotation[1]*Math.PI/180,cube.rotation[2]*Math.PI/180,'ZYX');g.translate(-pivot.x,-pivot.y,-pivot.z);g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation));g.translate(pivot.x,pivot.y,pivot.z);}
 return g;
}
function boneGeometry(bone,tw,th){const gs=(bone.cubes||[]).map(c=>createBedrockCubeGeometry(c,bone,tw,th));if(!gs.length)return null;const merged=mergeGeometries(gs);for(const g of gs)g.dispose();if(bone.mirror_x)merged.scale(-1,1,1);if(bone.geometry_scale)merged.scale(...bone.geometry_scale);return merged;}

export class CubicMobs{
 constructor(scene,{mobile=false,modelKeys=null}={}){
  this.group=new THREE.Group();this.group.name='Minecraft mobs · original geometry';scene.add(this.group);this.types={};this.dummy=new THREE.Object3D();this.pivot=new THREE.Object3D();this.composed=new THREE.Matrix4();this.tint=new THREE.Color();this.bowTint=new THREE.Color();this.textures=[];this.materials=[];
  const loader=new THREE.TextureLoader(),equipmentMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.57,metalness:.20});this.materials.push(equipmentMaterial);
  for(const[key,definition]of Object.entries(definitions)){
   if(modelKeys&&!modelKeys.includes(key))continue;
   const spec={type:definition.type,animation:definition.animation||definition.type,count:0,cap:definition.type==='boss'?2:80,bones:{},scale:definition.scale,yOffset:definition.yOffset||0,bob:definition.bob||0,healthHeight:definition.healthHeight||(definition.type==='runner'?1.1:2.1),shadowScale:definition.shadowScale||(definition.type==='runner'?.8:1),bow:definition.bow??((definition.animation||definition.type)==='spitter'),animate:definition.animate,glowMaterials:[]};
   const nodeMap={};
   for(const[json]of definition.layers)for(const bone of geometryOf(json).bones){if(nodeMap[bone.name])continue;const p=bone.pose_pivot||bone.pivot||[0,0,0],r=bone.rotation||bone.bind_pose_rotation||[0,0,0];nodeMap[bone.name]={name:bone.name,parentName:bone.parent,pivot:new THREE.Vector3(p[0]*UNIT,p[1]*UNIT,-p[2]*UNIT),rotation:new THREE.Euler(-r[0]*Math.PI/180,-r[1]*Math.PI/180,r[2]*Math.PI/180,'YXZ'),pose:new THREE.Matrix4()};}
   const nodes=[],seen=new Set();function addNode(node){if(seen.has(node))return;seen.add(node);node.parent=nodeMap[node.parentName];if(node.parent)addNode(node.parent);nodes.push(node);}for(const node of Object.values(nodeMap))addNode(node);spec.nodes=nodes;
   for(const[layer,[json,url,tw,th]]of definition.layers.entries()){
    const source=geometryOf(json),texture=loader.load(url);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;this.textures.push(texture);
    const {unlit,...options}=definition.layerMaterials?.[layer]||{},glow=(key==='warden'||key==='ender-dragon')&&layer===1;
    const material=glow||unlit?new THREE.MeshBasicMaterial({map:texture,alphaTest:.05,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,...options}):new THREE.MeshStandardMaterial({map:texture,roughness:1,alphaTest:.5,side:definition.doubleSide||key==='warden'?THREE.DoubleSide:THREE.FrontSide,...options});this.materials.push(material);if(glow)spec.glowMaterials.push(material);
    for(const bone of source.bones){
     if(bone.neverRender)continue;const geometry=boneGeometry(bone,tw,th);if(!geometry)continue;
     const mesh=new THREE.InstancedMesh(geometry,material,spec.cap);mesh.name=key+'/'+bone.name+(layer?'/outer':'');mesh.count=0;mesh.castShadow=!mobile;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);
     if(!spec.bones[bone.name])spec.bones[bone.name]=Object.assign(nodeMap[bone.name],{mesh,layers:[],meshes:[mesh]});
     else{spec.bones[bone.name].layers.push(mesh);spec.bones[bone.name].meshes.push(mesh);}
    }
   }
   if(definition.equipment)for(const[name,geometry]of Object.entries(definition.equipment.startsWith('roster:')?createRosterEquipment(definition.equipment.slice(7)):createCubicEquipment(definition.equipment))){
    const bone=spec.bones[name];if(!bone){geometry.dispose();continue;}
    const mesh=new THREE.InstancedMesh(geometry,equipmentMaterial,spec.cap);mesh.name=key+'/'+name+'/equipment';mesh.count=0;mesh.castShadow=!mobile;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);bone.layers.push(mesh);bone.meshes.push(mesh);
   }
   spec.parts=Object.entries(spec.bones);this.types[key]=spec;
  }
  const item=createMinecraftItem('bow');item.updateMatrixWorld(true);const gs=[];item.traverse(o=>{if(o.isMesh)gs.push(o.geometry.clone().applyMatrix4(o.matrixWorld));});const bowGeometry=mergeGeometries(gs);for(const g of gs)g.dispose();item.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});const bowMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});this.materials.push(bowMaterial);this.bow=new THREE.InstancedMesh(bowGeometry,bowMaterial,82);this.bow.name='Skeleton bows · original hand transform';this.bow.count=0;this.bow.castShadow=!mobile;this.bow.frustumCulled=false;this.group.add(this.bow);
 }
 update(enemies,time){
  for(const spec of Object.values(this.types))spec.count=0;
  let bows=0,ordinary=0,bosses=0;
  for(const e of enemies){
   if(e.hp<=0)continue;
   const variant=this.types[e.variant],boss=this.types[e.bossVariant],key=e.type==='boss'&&boss?.type==='boss'?e.bossVariant:variant?.type===e.type?e.variant:this.types[e.type]?e.type:'walker',spec=this.types[key],type=spec.type,animation=spec.animation;
   if(spec.count>=spec.cap||(type!=='boss'&&ordinary>=80)||(type==='boss'&&bosses>=2))continue;if(type==='boss')bosses++;else ordinary++;
   const index=spec.count++,stride=time*(animation==='runner'?11:animation==='boss'?4.2:6.3)+e.id*.63,walk=Math.sin(stride)*.60,casting=Number(e.castUntil||0)>time;
   const pulse=e.fusing?1+Math.max(0,Math.sin(time*18))*.045:1,modelScale=Number.isFinite(e.modelScale)?Math.max(.1,e.modelScale):1;this.dummy.position.set(e.x,spec.yOffset+Math.sin(time*1.6+e.id)*spec.bob,e.z);this.dummy.rotation.set(0,e.angle||0,0);this.dummy.scale.setScalar(spec.scale*pulse*modelScale);this.dummy.updateMatrix();for(const material of spec.glowMaterials)material.opacity=animation==='warden'?.88+Math.sin(time*2.3)*.10:1;
   const flashing=e.flash>0||(e.fusing&&Math.sin(time*22)>.2);this.tint.setRGB(flashing?1.8:1,flashing?1.65:1,flashing?1.5:1);
   for(const b of spec.nodes){const name=b.name;
    this.pivot.position.copy(b.pivot);if(b.parent)this.pivot.position.sub(b.parent.pivot);this.pivot.rotation.copy(b.rotation);this.pivot.scale.setScalar(1);
    const handled=applyBossPose(animation,name,this.pivot,time,stride,walk,e)||spec.animate?.(name,this.pivot,time,stride,walk,e);
    if(!handled&&animation==='runner'&&name.startsWith('leg')){
     const n=Number(name.slice(3)),side=n%2?1:-1,pair=Math.floor(n/2),splay=[.78,.4,-.4,-.78][pair];
     this.pivot.rotation.set(0,side*splay+Math.sin(stride+pair*Math.PI*.5)*.17,-side*(.55+Math.cos(stride+pair*Math.PI*.5)*.075));
         }else if(!handled&&animation==='creeper'&&name.startsWith('leg'))this.pivot.rotation.x=Math.sin(stride+(Number(name.slice(3))%2)*Math.PI)*.34;
    else if(!handled&&(name==='rightLeg'||name==='leg0'))this.pivot.rotation.x=walk;
    else if(!handled&&(name==='leftLeg'||name==='leg1'))this.pivot.rotation.x=-walk;
    else if(!handled&&animation==='walker'&&(name==='rightArm'||name==='leftArm'))this.pivot.rotation.set(-Math.PI/2+walk*.07,0,name==='rightArm'?.06:-.06);
    else if(!handled&&animation==='spitter'&&(name==='rightArm'||name==='leftArm'))this.pivot.rotation.set(-Math.PI/2+(casting?-.10:.04),name==='rightArm'?-.10:-.48,0,'YXZ');
    else if(!handled&&animation==='boss'&&(name==='arm0'||name==='arm1'))this.pivot.rotation.x=casting?-1.55:(name==='arm0'?1:-1)*walk*.55;
    this.pivot.updateMatrix();if(b.parent)b.pose.multiplyMatrices(b.parent.pose,this.pivot.matrix);else b.pose.copy(this.pivot.matrix);if(!b.mesh)continue;this.composed.multiplyMatrices(this.dummy.matrix,b.pose);
    for(const mesh of b.meshes){mesh.setMatrixAt(index,this.composed);mesh.setColorAt(index,this.tint);}
    if(spec.bow&&name==='rightArm'){this.bow.setMatrixAt(bows,this.composed);this.bowTint.set(key==='armored-skeleton'?'#ffe0a0':'#ffffff');this.bow.setColorAt(bows++,this.bowTint);}
   }
  }
  for(const spec of Object.values(this.types))for(const[,b]of spec.parts)for(const mesh of b.meshes){mesh.count=spec.count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  this.bow.count=bows;this.bow.instanceMatrix.needsUpdate=true;if(this.bow.instanceColor)this.bow.instanceColor.needsUpdate=true;
 }
 dispose(){for(const spec of Object.values(this.types))for(const[,b]of spec.parts)for(const mesh of b.meshes)mesh.geometry.dispose();this.bow.geometry.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.group.removeFromParent();}
}
