import * as THREE from 'three';
import {MAP} from './logic.js';
import {createCubicShaders} from './cubic-shaders.js';
import atlasURL from './assets/cubic/block-atlas.png?url';
import grassURL from './assets/cubic/grass.png?url';
import pathURL from './assets/cubic/path.png?url';
import waterURL from './assets/cubic/water.png?url';
import grassPlantURL from './assets/cubic/short_grass.png?url';
import dandelionURL from './assets/cubic/dandelion.png?url';
import poppyURL from './assets/cubic/poppy.png?url';
import mushroomURL from './assets/cubic/red_mushroom.png?url';

// Every solid landmark in the playable clearing has a matching collision box.
export const CUBIC_OBSTACLES=[
 {x:-4.5,z:2.5,w:2,d:1},{x:4.5,z:1.5,w:1,d:2},
 {x:.5,z:-3.5,w:2,d:1},{x:-6.5,z:-5.5,w:1,d:2},
 {x:6.5,z:-5.5,w:2,d:1},
 {x:-9.5,z:3.5,w:1,d:1},{x:9.5,z:3.5,w:1,d:1},
];
const T={grassTop:0,grassSide:1,dirt:2,path:3,log:4,logTop:5,leaves:6,stone:7,cobble:8,mossy:9,planks:10,diamond:11,coal:12,water:13,glass:14,sand:15};
const loader=new THREE.TextureLoader();
function texture(url,{repeat=1,atlas=false}={}){const t=loader.load(url);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=atlas?THREE.NearestFilter:THREE.NearestMipmapLinearFilter;t.generateMipmaps=!atlas;if(repeat!==1){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);}t.anisotropy=4;return t;}
function cubeGeometry(faces){const g=new THREE.BoxGeometry(1,1,1),uv=g.attributes.uv;for(let face=0;face<6;face++){const i=faces[face],x=(i%4)*32+8,y=Math.floor(i/4)*32+8;for(let n=face*4;n<face*4+4;n++)uv.setXY(n,(x+uv.getX(n)*16)/128,1-(y+(1-uv.getY(n))*16)/128);}uv.needsUpdate=true;return g;}

/** Original Minecraft block pixels on new efficient, collision-aware geometry. */
export function createCubicArena(scene,{mobile=false,reducedMotion=false}={}){
 const effects=createCubicShaders(scene,{mobile,reducedMotion});
 scene.background=new THREE.Color('#aecdd5');scene.fog=new THREE.Fog('#aecdd5',31,67);
 scene.add(new THREE.HemisphereLight('#d8edff','#52604c',1.65));
 const sun=new THREE.DirectionalLight('#fff0cc',2.45);sun.position.set(-12,19,9);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:58});sun.shadow.normalBias=.018;sun.shadow.bias=-.00012;sun.shadow.radius=mobile?1.4:2.1;scene.add(sun);
 const atlas=texture(atlasURL,{atlas:true}),material=effects.decorate(new THREE.MeshStandardMaterial({map:atlas,roughness:1,alphaTest:.45}));
 const buckets=new Map(),dummy=new THREE.Object3D();
 function block(kind,x,y,z,w=1,h=1,d=1,ry=0){const faces=kind==='grass'?[T.grassSide,T.grassSide,T.grassTop,T.dirt,T.grassSide,T.grassSide]:kind==='log'?[T.log,T.log,T.logTop,T.logTop,T.log,T.log]:Array(6).fill(T[kind==='clearingLeaves'?'leaves':kind]);const key=faces.join(',')+(kind==='clearingLeaves'?':clearing':'');if(!buckets.has(key))buckets.set(key,{faces,items:[],clearing:kind==='clearingLeaves'});buckets.get(key).items.push({x,y,z,w,h,d,ry});}
 const floorTexture=texture(grassURL,{repeat:80}),floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),effects.decorate(new THREE.MeshStandardMaterial({map:floorTexture,roughness:1})));floor.rotation.x=-Math.PI/2;floor.position.y=0;floor.receiveShadow=true;floor.name='Continuous grass — no checkerboard';scene.add(floor);
 const pathTexture=texture(pathURL),pathMaterial=effects.decorate(new THREE.MeshStandardMaterial({map:pathTexture,roughness:1})),paths=[];
 for(let z=-13;z<=5;z++)for(let x=-1;x<=1;x++)if(!(z>0&&z<3&&x===-1))paths.push([x,z]);
 for(let x=-10;x<=10;x++)for(let z of [4,5])if(!(Math.abs(x)>8&&z===5))paths.push([x,z]);
 const pathGeo=new THREE.PlaneGeometry(1,1);pathGeo.rotateX(-Math.PI/2);const pathBatch=new THREE.InstancedMesh(pathGeo,pathMaterial,paths.length);paths.forEach(([x,z],i)=>{dummy.position.set(x,.007,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();pathBatch.setMatrixAt(i,dummy.matrix);});pathBatch.receiveShadow=true;pathBatch.name='Dirt paths';scene.add(pathBatch);
 let seed=371;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function tree(x,z,h=4,clearing=false){for(let y=0;y<h;y++)block('log',x,y+.5,z);for(let y=h-2;y<=h+1;y++){const radius=y>=h?1:2;for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){if(Math.abs(dx)===radius&&Math.abs(dz)===radius&&(y===h+1||rand()<.65))continue;if(dx===0&&dz===0&&y<h)continue;block(clearing?'clearingLeaves':'leaves',x+dx,y+.5,z+dz);}}}
 tree(-9.5,3.5,4,true);tree(9.5,3.5,4,true);
 for(const[x,z,h]of [[-13.5,-9.5,5],[-14.5,-2.5,4],[-17.5,7.5,4],[-12.5,12.5,5],[13.5,-10.5,5],[14.5,-2.5,4],[14.5,7.5,5],[12.5,13.5,4],[-8.5,-15.5,4],[7.5,-16.5,5],[-6.5,16.5,4],[5.5,16.5,5]])tree(x,z,h);
 for(const[x,z]of [[-5,2.5],[-4,2.5],[4.5,1],[4.5,2],[0,-3.5],[1,-3.5],[-6.5,-5],[-6.5,-6],[6,-5.5],[7,-5.5]])block(rand()<.55?'mossy':'cobble',x,.5,z);
 block('mossy',-4,1.5,2.5);block('cobble',4.5,1.5,2);block('mossy',-6.5,1.5,-6);
 // The mine is a carved volume, not a black card in front of the hill.
 for(let x=-12;x<=12;x++)for(let z=-18;z<=-14;z++){
  const nearMine=x>=-3&&x<=4,height=Math.max(nearMine?4:1,1+Math.floor((Math.abs(x)+Math.abs(z+14))*.12));
  for(let y=0;y<height;y++){
   if(x>=-1&&x<=2&&z>=-17&&y<3)continue;
   block(y===height-1?'grass':nearMine&&y<3?'stone':'dirt',x,y+.5,z);
  }
 }
 for(const z of[-13.15,-15.15,-17.15]){
  for(const x of[-1.5,2.5])for(let y=0;y<3;y++)block('log',x,y+.5,z,.42,1,.42);
  for(let x=-1;x<=2;x++)block('planks',x,2.85,z,1,.38,.45);
 }
 for(let z=-13;z>=-17;z--)block('stone',.5,.015,z,3.4,.03,1);
 for(const x of[0,1])block('coal',x,1.5,-17.95,1,1,.15);
 const plain=new Map();function solid(hex,x,y,z,w,h,d){if(!plain.has(hex))plain.set(hex,[]);plain.get(hex).push({x,y,z,w,h,d});}
 for(let z=-17.5;z<-8;z+=.65){solid('#81694a',.5,.035,z,1.5,.07,.14);for(const x of [.05,.95])solid('#b2b4a6',x,.09,z,.07,.07,.65);}
 function torch(x,z,y=1.4){block('log',x,y-.15,z,.11,.55,.11);solid('#ffc35c',x,y+.18,z,.19,.23,.19);solid('#fff4a5',x,y+.30,z,.10,.12,.10);}
 torch(-1.4,-12.65,1.8);torch(2.4,-12.65,1.8);torch(-1.25,-15.0,1.7);torch(2.25,-16.6,1.7);
 // Complete cabin shell with recessed, framed windows and a solid door.
 block('planks',9.5,.045,-14.75,4.5,.09,3.8);
 for(let x=8;x<=11;x++)for(let y=0;y<3;y++)block('planks',x,y+.5,-16.5);
 for(const x of[7.5,11.5])for(let z=-16;z<=-13;z++)for(let y=0;y<3;y++)block('planks',x,y+.5,z,.35,1,1);
 for(const x of[7.5,11.5])for(const z of[-16.5,-13])for(let y=0;y<3;y++)block('log',x,y+.5,z,.55,1,.55);
 for(const x of[8.25,10.75]){
  block('planks',x,.40,-13,1.5,.80,.32);block('planks',x,2.65,-13,1.5,.70,.32);
  for(const side of[-1,1])block('planks',x+side*.55,1.55,-13,.40,1.5,.32);
  block('glass',x,1.7,-12.815,.68,1.10,.04);
  for(const side of[-1,1])solid('#ba9b61',x+side*.365,1.7,-12.775,.065,1.24,.065);
  for(const y of[1.10,1.70,2.30])solid('#cbb47c',x,y,-12.765,.78,.055,.075);
 }
 for(const x of[9,10])block('log',x,1.1,-12.94,.16,2.2,.32);
 block('planks',9.5,2.6,-13,1,.8,.32);block('planks',9.5,1.05,-12.80,.86,2.1,.12);
 for(const y of[.48,1.48])solid('#765333',9.5,y,-12.727,.64,.70,.03);
 solid('#e9c76d',9.77,1.0,-12.68,.10,.11,.065);
 block('planks',9.5,.045,-12.2,1.3,.09,.9);
 for(let x=7;x<=12;x++)for(let z=-17;z<=-13;z++)block('planks',x,3.2+Math.min(x-7,12-x)*.30,z,1,.45,1);
 for(const x of[7,12])block('log',x,3.15,-15, .18,.35,5.3);
 torch(11.5,-12.55,1.65);
 const waterTexture=texture(waterURL,{repeat:5}),water=new THREE.Mesh(new THREE.PlaneGeometry(5,6),effects.decorate(new THREE.MeshStandardMaterial({map:waterTexture,color:'#83b5cf',roughness:.42,metalness:.08}),{kind:'water'}));water.rotation.x=-Math.PI/2;water.position.set(-14,.018,8);water.name='Forest pond';scene.add(water);for(let z=5;z<=11;z++)block('sand',-11.9,.025,z,.65,.05,1);
 for(const[x,z]of [[-11,-8],[11,9],[-10,11]]){block('diamond',x,.5,z);block('stone',x+1,.5,z);}
 const plantURLs=[grassPlantURL,grassPlantURL,grassPlantURL,dandelionURL,poppyURL,mushroomURL],plantGeo=new THREE.PlaneGeometry(.6,.6);plantGeo.translate(0,.3,0);
 for(let kind=0;kind<plantURLs.length;kind++){const mat=effects.decorate(new THREE.MeshStandardMaterial({map:texture(plantURLs[kind]),alphaTest:.5,side:THREE.DoubleSide,roughness:1}),{wind:kind===5?null:'plant'}),count=kind<3?18:7,batch=new THREE.InstancedMesh(plantGeo,mat,count*2);for(let i=0;i<count;i++){const side=i%2?-1:1,x=side*(8+rand()*3),z=-10+rand()*21;for(let j=0;j<2;j++){dummy.position.set(x,.02,z);dummy.rotation.set(0,j*Math.PI/2,0);dummy.scale.setScalar(kind===5?.65:1);dummy.updateMatrix();batch.setMatrixAt(i*2+j,dummy.matrix);}}batch.name='Pixel forest plants';scene.add(batch);}
 const clearingLeaves=effects.decorate(material.clone(),{wind:'leaves'});clearingLeaves.transparent=true;
 const leavesMaterial=effects.decorate(material.clone(),{wind:'leaves'});
 for(const{faces,items,clearing}of buckets.values()){const mesh=new THREE.InstancedMesh(cubeGeometry(faces),clearing?clearingLeaves:faces.every(face=>face===T.leaves)?leavesMaterial:material,items.length);items.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.ry,0);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=clearing?'Clearing canopies':'Minecraft blocks';mesh.computeBoundingSphere();scene.add(mesh);}
 const plainGeo=new THREE.BoxGeometry(1,1,1);for(const[hex,items]of plain){const mesh=new THREE.InstancedMesh(plainGeo,effects.decorate(new THREE.MeshStandardMaterial({color:hex,roughness:1,...(['#ffc35c','#fff4a5'].includes(hex)?{emissive:hex,emissiveIntensity:.45}:{})})),items.length);items.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,0,0);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
 return{obstacles:CUBIC_OBSTACLES.map(o=>({...o})),bounds:MAP,get effectsState(){return effects.state;},effects,update(player,options={}){effects.update(options);const fade=Math.abs(player.x)>7.1&&player.z>-.3&&player.z<8;clearingLeaves.opacity=fade?.26:1;clearingLeaves.alphaTest=fade?.08:.45;clearingLeaves.depthWrite=!fade;}};
}
