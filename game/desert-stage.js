import * as THREE from 'three';
import {MAP} from './logic.js';

export function createDesertArena(scene,{mobile=false}={}) {
const touch=mobile;
const obstacles=[{x:-4.0,z:2.8,w:2.1,d:1.25},{x:4.0,z:2,w:2.1,d:1.25},{x:0,z:-2,w:2.4,d:1.1},{x:-6.5,z:-5,w:1.4,d:2.0},{x:6.6,z:-5.1,w:1.45,d:2.0}];
scene.background=new THREE.Color('#93b9aa');scene.fog=new THREE.Fog('#93b9aa',36,65);

scene.add(new THREE.HemisphereLight(0xe5f2d2,0x815535,2.1));
const sun=new THREE.DirectionalLight(0xffe6b7,3.0);sun.position.set(-9,18,10);sun.castShadow=true;sun.shadow.mapSize.set(touch?1024:2048,touch?1024:2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:55});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
const fill=new THREE.DirectionalLight(0x9eb6ea,.75);fill.position.set(9,8,-9);scene.add(fill);
const mats={};function material(name,color,roughness=1){return mats[name]??=new THREE.MeshStandardMaterial({color,roughness});}
const sand=material('sand','#d5a86a'),sandLight=material('sand-light','#e7bd7c'),wood=material('wood','#956144'),woodLight=material('wood-light','#c49460'),woodDark=material('wood-dark','#644a3c'),metal=material('metal','#365761'),leaf=material('leaf','#377875'),leafLight=material('leaf-light','#4f9981'),rock=material('rock','#9b806d'),yellow=material('yellow','#ffd454'),red=material('red','#dc654c'),cream=material('cream','#fff0c5');
function mesh(geometry,mat,x=0,y=0,z=0,parent=scene,shadows=true){const o=new THREE.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=shadows;o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,mat,x,y,z,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
function cylinder(rt,rb,h,mat,x,y,z,parent=scene,segments=12){return mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat,x,y,z,parent);}
function ball(r,mat,x,y,z,parent=scene,detail=1){return mesh(new THREE.IcosahedronGeometry(r,detail),mat,x,y,z,parent);}
function ring(radius,color,y=.03){const o=new THREE.Mesh(new THREE.RingGeometry(radius-.035,radius,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));o.rotation.x=-Math.PI/2;o.position.y=y;return o;}
const ground=mesh(new THREE.PlaneGeometry(150,150),sand,0,-.06,0,scene,false);ground.rotation.x=-Math.PI/2;
const arenaFloor=box(23.9,.12,25.9,sandLight,0,-.10,0);arenaFloor.castShadow=false;
// Fine sand marks, sparse tufts and scattered stones give the arena scale.
let seed=781;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<95;i++){const o=mesh(new THREE.CircleGeometry(.12+random()*.7,5),i%2?sand:sandLight,(random()-.5)*23,.001,(random()-.5)*25,scene,false);o.rotation.x=-Math.PI/2;o.scale.y=.2+random()*.5;}
const centerMark=ring(2.1,'#b27a4c',.007);centerMark.material.opacity=.27;centerMark.position.z=5.5;scene.add(centerMark);
function crate(spec){const g=new THREE.Group();g.position.set(spec.x,0,spec.z);scene.add(g);const h=1.18;box(spec.w,h,spec.d,woodLight,0,h/2,0,g);for(const z of [-spec.d/2-.012,spec.d/2+.012]){box(spec.w+.06,.14,.07,woodDark,0,.15,z,g);box(spec.w+.06,.14,.07,woodDark,0,h-.15,z,g);for(const x of [-spec.w/2+.15,spec.w/2-.15])box(.12,h,.08,wood,x,h/2,z,g);const diagonal=box(Math.hypot(spec.w-.35,h-.35),.13,.08,wood,0,h/2,z,g);diagonal.rotation.z=Math.atan2(h-.35,spec.w-.35);}box(spec.w+.08,.10,spec.d+.05,wood,.0,h+.04,.0,g);return g;}
obstacles.forEach(crate);
for(const z of [-13.15,13.15])for(let x=-12;x<=12;x+=2){box(.16,1.1,.17,woodDark,x,.5,z);if(x<12){box(2.1,.16,.12,woodLight,x+1,.45,z);box(2.1,.16,.12,woodLight,x+1,.9,z);}}
for(const x of [-12.1,12.1])for(let z=-12;z<=12;z+=2){box(.16,1.1,.16,woodDark,x,.5,z);if(z<12){box(.12,.16,2.1,woodLight,x,.45,z+1);box(.12,.16,2.1,woodLight,x,.9,z+1);}}
function cactus(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);cylinder(.2,.25,1.6,leaf,0,.8,0,g);ball(.21,leaf,0,1.6,0,g);for(const side of [-1,1]){const arm=cylinder(.14,.14,.45,leaf,side*.32,.95+side*.2,0,g);arm.rotation.z=Math.PI/2;cylinder(.14,.14,.5,leaf,side*.53,1.15+side*.2,0,g);ball(.14,leaf,side*.53,1.42+side*.2,0,g);}return g;}
for(const [x,z,s] of [[-13,-9,1.5],[13,8,1.7],[-14,6,1.1],[12.9,-10,1],[-9,-14,1.3],[6,15,1.2]])cactus(x,z,s);
for(let i=0;i<24;i++){const edge=i%2?-1:1,x=edge*(12.8+random()*5),z=(random()-.5)*35;const r=ball(.35+random()*.65,rock,x,.25,z,scene,0);r.scale.set(1.5,.7,1);r.rotation.y=random()*6;}
function bush(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);for(let i=0;i<5;i++){const p=ball((.48+random()*.25)*s,i%2?leaf:leafLight,(random()-.5)*s*1.3,.4*s,(random()-.5)*s*1.3,g,0);p.scale.y=.85;}}
for(const p of [[-9,9],[9,9],[-9,-9],[9,-9],[-2,-11],[2,-11]])bush(...p,1.4);
// Small range buildings outside the walkable boundary.
const shed=box(5,2.8,3.5,material('shed','#768f87'),-7,1.3,-17);const roof=box(5.5,.27,4.0,metal,-7,2.8,-17);roof.rotation.z=-.06;box(1.1,1.9,.10,woodDark,-7,.9,-15.2);box(1.1,.8,.12,cream,-5.5,1.9,-15.18);cylinder(1.15,1.15,3.5,metal,8,1.65,-17,scene,16);cylinder(1.3,1.3,.18,woodDark,8,3.45,-17,scene,16);


return {obstacles,bounds:MAP};
}
