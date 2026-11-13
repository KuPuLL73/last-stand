import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original voxel equipment authored for this game. Positions/sizes use the
// same 1/32-character units as the Mojang bone meshes, relative to each joint.
// All pieces belonging to a joint merge into a single instanced geometry.
const UNIT=1.85/32;
const iron={dark:'#344c5b',edge:'#d6e5e7',main:'#8fa8b4',inset:'#567380',gem:'#78e4e6'};
const archer={dark:'#282c46',edge:'#e8c97d',main:'#59667c',inset:'#394559',gem:'#e5a85d'};

function builder(){
 const pieces=[],colour=new THREE.Color(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),euler=new THREE.Euler();
 function box(hex,p,s,r=[0,0,0]){
  const geometry=new THREE.BoxGeometry(1,1,1);
  matrix.compose(position.set(...p).multiplyScalar(UNIT),rotation.setFromEuler(euler.set(...r)),scale.set(...s).multiplyScalar(UNIT));geometry.applyMatrix4(matrix);geometry.deleteAttribute('uv');
  colour.set(hex);const colours=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<colours.length;i+=3)colour.toArray(colours,i);geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));pieces.push(geometry);
 }
 return{box,finish(){if(!pieces.length)return null;const merged=mergeGeometries(pieces,false);for(const p of pieces)p.dispose();merged.computeBoundingSphere();return merged;}};
}

function helmet(b,palette,{crown=false}={}){
 const {box}=b;
 box(palette.dark,[0,8.2,0],[9.6,1.6,9.5]);
 box(palette.main,[0,8.9,0],[9.3,1.2,9.2]);
 box(palette.edge,[0,9.6,0],[8.7,.55,8.6]);
 for(const side of [-1,1]){
  box(palette.main,[side*4.55,4.9,0],[1.25,6.0,9.3]);
  box(palette.edge,[side*4.55,5.9,4.82],[1.3,2.2,.5]);
  box(palette.dark,[side*4.45,1.7,1.2],[1.3,1.1,5.8]);
 }
 box(palette.edge,[0,6.9,4.72],[8.6,1.0,.8]);
 // An open face keeps zombie/skeleton identity visible beneath real armour.
 if(crown){
  for(const side of [-1,1]){
   box(palette.edge,[side*4.5,11.2,3.5],[1.25,5.3,1.4]);
   box(palette.gem,[side*4.5,13.9,3.5],[.75,1.2,.9]);
   box(palette.main,[side*4.5,10.7,-3.5],[1.3,4.2,1.4]);
  }
  box(palette.edge,[0,11.1,4.4],[1.5,5.0,1.3]);
  box(palette.gem,[0,13.8,4.4],[.8,1.2,.9]);
  box(palette.gem,[0,8.7,4.95],[2.2,2.2,1],[0,0,Math.PI/4]);
 }else{
  box(palette.dark,[0,10.0,-.3],[2.8,1.0,7.1]);
  box(palette.edge,[0,10.5,-.3],[1.4,.65,6.4]);
 }
}

function chest(b,palette,{frost=false}={}){
 const {box}=b;
 box(palette.dark,[0,-6.2,0],[9.5,11.9,6.1]);
 box(palette.main,[0,-5.6,3.25],[8.5,8.4,1.3]);
 box(palette.edge,[0,-1.1,3.3],[9.0,1.0,1.5]);
 for(const side of [-1,1])box(palette.edge,[side*4.2,-5.7,3.2],[.85,8.3,1.4]);
 box(palette.inset,[0,-5.8,4.0],[5.4,3.6,.5]);
 box(palette.gem,[0,-5.7,4.45],[1.6,1.6,.75],[0,0,Math.PI/4]);
 box(palette.edge,[0,-11.4,.1],[9.6,1.0,6.5]);
 if(frost){
  // Three stepped panels form a real, thick cloak behind the ribs.
  box('#3b628f',[0,-8.1,-3.8],[8.7,16.2,1.1]);
  box('#6dacc9',[-3.0,-14.3,-4.0],[2.6,7.4,.9]);
  box('#4d86ac',[0,-15.0,-4.0],[2.6,8.8,.9]);
  box('#6dacc9',[3.0,-13.8,-4.0],[2.6,6.4,.9]);
 }
}

function arm(b,palette,{thin=false,crown=false}={}){
 const {box}=b,w=thin?4.6:6.1;
 box(palette.dark,[0,-1.2,0],[w,4.5,w]);
 box(palette.main,[0,-.1,0],[w+.6,2.4,w+.6]);
 box(palette.edge,[0,1.2,0],[w+.8,.65,w+.8]);
 box(palette.edge,[0,-8.4,.2],[thin?3.5:5.2,2.5,thin?3.6:5.1]);
 box(palette.inset,[0,-8.3,thin?2.0:2.8],[thin?2.5:4.1,1.4,.55]);
 if(crown){
  box(palette.main,[0,3.2,-.2],[2.5,3.8,2.4],[0,0,.28]);
  box(palette.gem,[0,5.0,-.2],[1.3,1.4,1.3],[0,0,.28]);
 }
}

function leg(b,palette,{thin=false}={}){
 const {box}=b,w=thin?3.2:4.7;
 box(palette.dark,[0,-9.8,.5],[w,4.2,thin?4.1:5.7]);
 box(palette.main,[0,-10.2,1.4],[w+.25,3.2,thin?4.2:5.7]);
 box(palette.edge,[0,-8.1,.4],[w+.3,.65,thin?4.3:5.9]);
 box(palette.inset,[0,-11.8,.6],[w+.4,.5,thin?4.5:6.0]);
}

/** Bone-local, merged geometry; the renderer supplies the original animations. */
export function createCubicEquipment(kind){
 const pieces={};
 function bone(name,fn){const b=builder();fn(b);const g=b.finish();if(g)pieces[name]=g;}
 if(kind==='armored-zombie'||kind==='armored-skeleton'){
  const frost=false,thin=kind!=='armored-zombie',palette=thin?archer:iron;
  bone('head',b=>helmet(b,palette,{crown:frost}));
  bone('body',b=>{chest(b,palette,{frost});if(kind==='armored-skeleton'){
   b.box('#584737',[-2,-4,-4.2],[3.4,12,2.5]);
   for(const x of [-3,-2,-1]){b.box('#a4875c',[x,3,-4.3],[.5,6,.5]);b.box('#e9ead7',[x,5.8,-4.3],[.9,1.7,.5]);}
  }});
  for(const name of ['rightArm','leftArm'])bone(name,b=>arm(b,palette,{thin,crown:frost}));
  for(const name of ['rightLeg','leftLeg'])bone(name,b=>leg(b,palette,{thin}));
 }else if(kind==='zombie-brute'){
  bone('body',b=>{
   for(const[y,w]of [[-1.4,13],[-3.2,11],[-5,8],[-6.8,5],[-8.1,2.5]])b.box('#466935',[0,y,6.13],[w,1.9,.23]);
   b.box('#557c3d',[-9,-7.2,6.14],[3.1,2.0,.25]);b.box('#395b2e',[8.7,-3.2,6.14],[2.3,1.6,.25]);
   b.box('#426532',[3.0,-10.2,6.14],[2.2,1.3,.25]);
  });
  for(const name of ['rightLeg','leftLeg'])bone(name,b=>{
   b.box('#486a34',[0,-5.0,4.1],[5.7,3.6,.23]);b.box('#5a7c40',[-1.8,-3.2,4.1],[1.9,1.8,.23]);
   b.box('#365b2e',[1.5,-6.8,4.1],[2.2,1.7,.23]);
  });

 }
 return pieces;
}
