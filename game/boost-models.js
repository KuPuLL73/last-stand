import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Gameplay values are unchanged. World props and UI exports share these meshes.
export const BOOSTS = Object.freeze({
 heal:{name:'ЛЕЧЕНИЕ',colour:'#ff5c65',face:'#aa284b',detail:'+25 здоровья',duration:0},
 haste:{name:'УСКОРЕНИЕ',colour:'#58e6ed',face:'#15735b',detail:'+35% скорости · 10 с',duration:10},
 rapid:{name:'БЫСТРАЯ АТАКА',colour:'#ffc448',face:'#a95817',detail:'Темп атаки ×1,67 · 8 с',duration:8},
 shield:{name:'НЕУЯЗВИМОСТЬ',shortName:'ЩИТ',colour:'#6ef0ff',face:'#255ba6',detail:'Без урона · 6 с',duration:6},
 magnet:{name:'МАГНИТ ОПЫТА',colour:'#8ff16b',face:'#7044a8',detail:'Собирает весь опыт',duration:0},
});
export const BOOST_POSES={heal:{yaw:-.25},haste:{yaw:-.36},rapid:{yaw:-.10},shield:{yaw:-.22},magnet:{yaw:.10}};

// Separated glass panels leave clear gaps around the central shield. Their
// edges are part of the opaque prop; their faces use one optional batch.
function shieldPanels(){
 const panels=[],radius=.65;
 const point=(phi,theta)=>new THREE.Vector3(Math.sin(theta)*Math.sin(phi)*radius,Math.cos(theta)*radius,Math.sin(theta)*Math.cos(phi)*radius);
 for(let i=0;i<6;i++)for(const[top,bottom]of[[.34,1.43],[1.71,2.75]]){
  const a=i*Math.PI/3+.075,b=(i+1)*Math.PI/3-.075;
  panels.push([point(a,top),point(b,top),point(b,bottom),point(a,bottom)]);
 }
 return panels;
}

export function createBoostGeometry(type){
 if(!BOOSTS[type])throw new Error(`Unknown boost: ${type}`);
 const parts=[],matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),euler=new THREE.Euler(),colour=new THREE.Color();
 function add(geometry,hex,p=[0,0,0],r=[0,0,0]){
  if(geometry.index){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
  matrix.compose(position.fromArray(p),quaternion.setFromEuler(euler.set(...r)),new THREE.Vector3(1,1,1));geometry.applyMatrix4(matrix);
  colour.set(hex);const colours=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<colours.length;i+=3)colour.toArray(colours,i);
  geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));geometry.deleteAttribute('uv');parts.push(geometry);
 }
 function box(hex,p,size,bevel=.014,r=[0,0,0]){
  const g=bevel>0?new RoundedBoxGeometry(...size,1,Math.min(bevel,...size.map(n=>n*.20))):new THREE.BoxGeometry(...size);
  add(g,hex,p,r);
 }
 function shape(points,hex,p=[0,0,0],depth=.1,bevel=.012,r=[0,0,0],bow=0){
  const outline=new THREE.Shape(points.map(a=>new THREE.Vector2(...a)));
  const g=new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-depth/2);
  if(bow){const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,a.getZ(i)+bow*(1-Math.min(1,(a.getX(i)/.46)**2)));g.computeVertexNormals();}
  add(g,hex,p,r);
 }
 function bar(hex,a,b,width=.012){
  const direction=b.clone().sub(a),g=new THREE.BoxGeometry(width,direction.length(),width);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
  add(g,hex,a.clone().add(b).multiplyScalar(.5).toArray());
 }
 if(type==='heal'){
  box('#14394c',[0,-.29,0],[.94,.14,.70],.012);
  box('#f0f6ed',[0,-.015,0],[.88,.50,.64],.018);
  box('#ce2539',[0,.24,0],[.95,.17,.70],.014);
  box('#fa4d50',[0,.327,0],[.91,.025,.65],.008);
  // A genuinely open handle, two large crosses and readable gold clasps.
  for(const x of[-.18,.18])box('#1b3c4c',[x,.435,-.17],[.085,.22,.10],.009);
  box('#214557',[0,.558,-.17],[.445,.09,.10],.010);
  box('#f8fff1',[0,.35,.045],[.37,.032,.12],.006);box('#f8fff1',[0,.351,.045],[.12,.032,.37],.006);
  box('#e82f42',[0,-.005,.337],[.35,.11,.038],.006);box('#e82f42',[0,-.005,.339],[.115,.35,.040],.006);
  for(const x of[-.31,.31]){
   box('#ac782d',[x,.17,.366],[.11,.225,.055],.005);box('#ffe08b',[x,.185,.401],[.08,.18,.025],.005);
   box('#163a4b',[x,-.225,.338],[.15,.15,.06],.008);
  }
  for(const x of[-.31,.31])box('#243f4c',[x,.20,-.35],[.10,.10,.04],.005);
 }else if(type==='haste'){
  const upper=[[-.39,-.22],[-.39,.33],[-.30,.40],[-.08,.40],[-.035,.11],[.14,.02],[.34,-.065],[.47,-.13],[.49,-.23],[.40,-.27]];
  const sole=[[-.43,-.26],[.47,-.26],[.52,-.31],[.48,-.39],[-.43,-.39],[-.46,-.34]];
  shape(sole,'#153c50',[0,0,0],.50,.012);shape(sole.map(([x,y])=>[x,y+.055]),'#f1ffff',[0,0,0],.52,.010);
  shape(upper,'#13aabd',[0,0,0],.44,.013);
  shape([[-.37,-.22],[-.37,.32],[-.23,.32],[-.17,-.20]],'#136293',[0,0,.235],.025,.006);
  box('#61e6e8',[-.21,.39,0],[.36,.10,.47],.009);box('#123d59',[-.21,.447,0],[.235,.025,.32],.004);
  box('#bafff7',[.34,-.105,0],[.25,.065,.47],.006);
  for(const[x,y]of[[-.035,.17],[.075,.092],[.18,.014]])box('#f1ffff',[x,y,.006],[.065,.05,.39],.006,[0,0,-.45]);
  // Three broad feathers on each side preserve a clear winged silhouette.
  const feathers=[
   [[-.30,.025],[-.45,-.04],[-.82,.55],[-.73,.64]],
   [[-.32,-.015],[-.46,-.10],[-.98,.30],[-.91,.41]],
   [[-.35,-.065],[-.46,-.16],[-1.00,.04],[-.98,.16]],
  ];
  for(const z of[-.275,.275]){
   feathers.forEach((feather,i)=>shape(feather,i===0?'#edfff2':i===1?'#d9f6ef':'#b9e6e4',[0,0,z],.060,.006));
   shape([[-.29,.025],[-.35,-.115],[-.57,.02],[-.51,.12]],'#e8c96f',[0,0,z+(z>0?.04:-.04)],.026,.003);
  }
 }else if(type==='rapid'){
  // Radial brass burst replaces the old three-round magazine.
  function cartridge(angle,index,large=false){
   const radius=large?0:.27,z=large?.17:(index%2?.015:-.055),s=large?1.15:1;
   const place=(x,y)=>[Math.cos(angle)*x+Math.sin(angle)*(y+radius),-Math.sin(angle)*x+Math.cos(angle)*(y+radius),z];
   const turn=[0,0,-angle];
   add(new THREE.CylinderGeometry(.071*s,.071*s,.37*s,8,1),'#ec9d20',place(0,0),turn);
   add(new THREE.CylinderGeometry(.087*s,.087*s,.06*s,8,1),'#ffd86c',place(0,-.20*s),turn);
   add(new THREE.CylinderGeometry(.067*s,.067*s,.055*s,8,1),'#ffe9a0',place(0,.20*s),turn);
   add(new THREE.ConeGeometry(.066*s,.15*s,8,1),'#ffe589',place(0,.295*s),turn);
   box('#ffdb56',place(-.038*s,-.005*s),[.022*s,.23*s,.025],.002,turn);
  }
  for(let i=0;i<7;i++)cartridge(i*Math.PI*2/7,i);
  add(new THREE.OctahedronGeometry(.21,0),'#ffdc4e',[0,0,.035],[0,.2,.12]);cartridge(Math.PI/4,0,true);
  for(const a of[-.5,1.2,2.9,4.6])box('#ffb525',[Math.sin(a)*.56,Math.cos(a)*.56,-.10],[.025,.19,.025],0,[0,0,-a]);
 }else if(type==='shield'){
  const outline=[[-.38,.39],[.38,.39],[.38,.10],[.31,-.17],[.20,-.34],[0,-.51],[-.20,-.34],[-.31,-.17],[-.38,.10]],tilt=[-.28,0,0];
  shape(outline,'#93641d',[0,0,-.025],.13,.012,tilt,.025);
  shape(outline.map(([x,y])=>[x*.98,y*.98]),'#f7ce5a',[0,.012,.045],.12,.010,tilt,.035);
  shape(outline.map(([x,y])=>[x*.83,y*.85]),'#146a9e',[0,.019,.12],.085,.009,tilt,.04);
  shape(outline.map(([x,y])=>[x*.69,y*.72]),'#24dce3',[0,.035,.175],.045,.008,tilt,.045);
  shape([[-.06,.21],[.06,.21],[.06,-.19],[0,-.29],[-.06,-.19]],'#d6fbea',[0,.039,.225],.024,.005,tilt,.01);
  shape([[0,.15],[.13,.02],[.10,-.13],[0,-.22],[-.10,-.13],[-.13,.02]],'#ffe17c',[0,.055,.258],.035,.006,tilt);
  box('#74532b',[0,-.025,-.17],[.12,.33,.085],.008,tilt);
  for(const panel of shieldPanels())for(let i=0;i<4;i++)bar('#5bdcea',panel[i],panel[(i+1)%4],.008);
 }else if(type==='magnet'){
  const half=[[-.40,.38],[-.19,.38],[-.19,-.03],[-.14,-.18],[0,-.24],[0,-.44],[-.15,-.44],[-.30,-.32],[-.40,-.065]],tilt=[-.26,0,.02];
  shape(half,'#df3042',[0,0,0],.32,.014,tilt);shape(half.map(([x,y])=>[-x,y]).reverse(),'#2869db',[0,0,0],.32,.014,tilt);
  shape(half.map(([x,y])=>[x*.92,y*.92]),'#ff5361',[0,.012,.175],.028,.005,tilt);
  shape(half.map(([x,y])=>[-x*.92,y*.92]).reverse(),'#4d98f6',[0,.012,.175],.028,.005,tilt);
  for(const side of[-1,1]){
   box('#c5deea',[side*.295,.31,.028],[.225,.19,.35],.010,tilt);
   box('#f3ffff',[side*.295,.416,.006],[.228,.045,.35],.006,tilt);
   box(side<0?'#ff7782':'#69c4ff',[side*.295,.255,.215],[.17,.042,.025],.003,tilt);
  }
  add(new THREE.OctahedronGeometry(.115,0),'#8bff69',[0,.23,.15],[.12,.3,.12]);
  add(new THREE.OctahedronGeometry(.064,0),'#4eea75',[.12,.50,.025],[.1,-.3,.2]);
  add(new THREE.OctahedronGeometry(.045,0),'#b7ff8e',[-.13,.58,.07],[.2,.4,.3]);
 }
 const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
 geometry.computeBoundingBox();const size=new THREE.Vector3(),center=new THREE.Vector3();geometry.boundingBox.getSize(size);geometry.boundingBox.getCenter(center);
 const scale=1.08/Math.max(size.x,size.y,size.z);geometry.translate(-center.x,-center.y,-center.z);geometry.scale(scale,scale,scale);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name=`Gemini concept boost · ${type}`;geometry.userData.boostTransform={center:center.toArray(),scale};return geometry;
}

export function createBoostAuraGeometry(type,baseGeometry=null){
 if(type!=='shield')return null;
 const positions=[];for(const panel of shieldPanels())for(const i of[0,1,2,0,2,3])positions.push(...panel[i].toArray());
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
 const own=!baseGeometry,base=baseGeometry||createBoostGeometry(type),{center,scale}=base.userData.boostTransform;
 g.translate(-center[0],-center[1],-center[2]);g.scale(scale,scale,scale);g.computeBoundingBox();g.computeBoundingSphere();g.name='Segmented protective sphere glass';if(own)base.dispose();return g;
}
export function createBoostMaterial(){return new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.18,flatShading:true});}
export function createBoostAuraMaterial(){return new THREE.MeshBasicMaterial({color:'#8ceeff',transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});}
