import * as THREE from 'three';
import pixels from './assets/steve-pixel-data.js';
import weaponPixels from './assets/steve-weapons/weapon-pixels.js';
import rangedPixels from './assets/steve-ranged/item-pixels.js';
import extraPixels from './assets/extra-weapons/item-pixels.js';
import {createExtraProjectileGeometry} from './extra-projectiles.js';
import {getSteveWeapon,STEVE_START_WEAPON} from './steve-weapons.js';

// Original Mojang default Steve pixels, with a new lightweight articulated mesh.
// Source and asset paths: assets/steve-sources.json.
const U = 1.85 / 32;
const DOWN = new THREE.Vector3(0,-1,0);
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const lerp=(a,b,n)=>a+(b-a)*n;

function skinTexture(){
 const s=pixels.skin,t=new THREE.DataTexture(new Uint8Array(s.pixels.flat()),s.width,s.height,THREE.RGBAFormat);
 t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.flipY=true;t.needsUpdate=true;return t;
}
function cuboidUV(w,h,d,rects){
 const g=new THREE.BoxGeometry(w*U,h*U,d*U),uv=g.attributes.uv;
 for(let face=0;face<6;face++){
  const [x,y,rw,rh]=rects[face];
  for(let i=0;i<4;i++){const n=face*4+i;uv.setXY(n,(x+uv.getX(n)*rw)/64,1-(y+(1-uv.getY(n))*rh)/64);}
 }
 uv.needsUpdate=true;return g;
}
function skinRects(x,y,w,h,d){
 return [[x+d+w,y+d,d,h],[x,y+d,d,h],[x+d,y,w,d],[x+d+w,y,w,d],[x+d,y+d,w,h],[x+d+w+d,y+d,w,h]];
}
function slicedArmRects(x,y,start,length){
 const full=skinRects(x,y,4,12,4);
 return full.map((r,i)=> i===2?[x+4,y,4,4]:i===3?[x+8,y,4,4]:[r[0],r[1]+start,r[2],length]);
}
function voxelItem(key,{pixel=.06,grip=[8,8],excludeGrey=false,depth=.065}={}){
 const p=weaponPixels[key]||rangedPixels[key]||extraPixels[key]||pixels[key],positions=[],normals=[],colours=[];
 const opaque=(x,y)=>{if(x<0||y<0||x>=p.width||y>=p.height)return false;const c=p.pixels[y*p.width+x];return c[3]>127&&(!excludeGrey||!(c[0]===68&&c[1]===68&&c[2]===68));};
 const faces=[{n:[0,0,1],q:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:1},{n:[0,0,-1],q:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.88},{n:[1,0,0],q:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.72,near:[1,0]},{n:[-1,0,0],q:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.8,near:[-1,0]},{n:[0,1,0],q:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1.07,near:[0,-1]},{n:[0,-1,0],q:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.65,near:[0,1]}];
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(opaque(x,y)){
  const rgba=p.pixels[y*p.width+x],c=new THREE.Color().setRGB(rgba[0]/255,rgba[1]/255,rgba[2]/255,THREE.SRGBColorSpace);
  for(const f of faces){if(f.near&&opaque(x+f.near[0],y+f.near[1]))continue;
   for(const i of [0,1,2,0,2,3]){const q=f.q[i];positions.push((x+q[0]-grip[0])*pixel,(grip[1]-y-1+q[1])*pixel,(q[2]-.5)*depth);normals.push(...f.n);colours.push(c.r*f.shade,c.g*f.shade,c.b*f.shade);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.computeBoundingSphere();
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.57,metalness:key==='diamond-sword'?.18:0}));mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function segment(material){const m=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,1,5),material);m.castShadow=false;return m;}
function between(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);const v=b.clone().sub(a);mesh.scale.y=v.length();mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());}

// Exact Java Edition generated-item transforms, extracted from the Mojang
// 1.21.9 client: item/handheld.json and item/bow.json. Item canvas is centered
// 16x16 pixels; C converts Minecraft model axes (Y down, front -Z) to ours.
export function createMinecraftItem(kind='bow',{pull=-1}={}){
 const item=new THREE.Group();item.name=kind==='bow'?'MinecraftBow':`MinecraftWeapon:${kind}`;
 const bowItem=kind==='bow'||kind==='hunting-bow';
 const key=bowItem?(pull>=0?`bow-pulling-${Math.min(2,pull)}`:'bow'):kind==='crossbow'?'crossbow-arrow':kind==='ember-staff'?'blaze-rod':kind==='snow-caster'?'snowball':kind==='tide-trident'?'thrown-trident':(weaponPixels[kind]?kind:STEVE_START_WEAPON);
 const mesh=kind==='snow-caster'?new THREE.Mesh(createExtraProjectileGeometry('snowball'),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85})):voxelItem(key,{pixel:U,grip:[8,8],depth:U});mesh.name='OriginalItemPixels';mesh.castShadow=mesh.receiveShadow=true;item.add(mesh);
 if(kind==='crossbow')for(const [index,frame]of ['crossbow-standby','crossbow-pulling-0','crossbow-pulling-1','crossbow-pulling-2'].entries()){const stage=voxelItem(frame,{pixel:U,grip:[8,8],depth:U});stage.name=`CrossbowFrame${index}`;stage.visible=false;item.add(stage);}
 if(kind==='ember-staff'){mesh.material.emissive.set('#ff6507');mesh.material.emissiveIntensity=.28;}
 const display=bowItem?{rotation:[-80,260,-40],translation:[-1,-2,2.5],scale:.9}:kind==='crossbow'?{rotation:[-90,0,-60],translation:[2,.1,-3],scale:.9}:kind==='snow-caster'?{rotation:[0,0,0],translation:[0,3,1],scale:.7}:kind==='tide-trident'?{rotation:[0,-90,45],translation:[0,5,.5],scale:1.2}:{rotation:[0,-90,55],translation:[0,4,.5],scale:.85};
 const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...display.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
 const m=new THREE.Matrix4().makeRotationX(Math.PI)
  .multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2))
  .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
  .multiply(new THREE.Matrix4().makeTranslation(U,2*U,-10*U))
  .multiply(new THREE.Matrix4().makeTranslation(...display.translation.map(n=>n*U)))
  .multiply(rotation).multiply(new THREE.Matrix4().makeScale(display.scale,display.scale,display.scale));
 m.decompose(item.position,item.quaternion,item.scale);item.userData.minecraftDisplay=display;item.userData.pixelSize=U;item.userData.itemPixelKey=key;
 if(kind==='tide-trident'){
  // A spear stays upright in the ready hand. The generated-item icon is
  // diagonal; cancelling only its mount rotation exposes the actual three
  // prongs instead of presenting the original thin sprite edge to the camera.
  const inverse=item.quaternion.clone().invert();mesh.quaternion.copy(inverse).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/4));
  mesh.position.copy(new THREE.Vector3(0,3*U,0).applyQuaternion(inverse));
 }
 return item;
}

export function createSteve({weapon=STEVE_START_WEAPON}={}){
 const root=new THREE.Group();root.name='Steve';
 const upper=new THREE.Group();upper.name='UpperBody';root.add(upper);
 const texture=skinTexture(),skin=new THREE.MeshStandardMaterial({map:texture,roughness:.94,alphaTest:.5});
 const layers=new THREE.MeshStandardMaterial({map:texture,roughness:.94,alphaTest:.5,side:THREE.DoubleSide});
 const all=[];
 function box(name,w,h,d,rects,position,parent=upper,mat=skin){const m=new THREE.Mesh(cuboidUV(w,h,d,rects),mat);m.name=name;m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);all.push(m);return m;}
 const body=box('Torso',8,12,4,skinRects(16,16,8,12,4),[0,18*U,0]);
 box('Jacket',8.16,12.12,4.16,skinRects(16,32,8,12,4),[0,18*U,0],upper,layers);
 const head=new THREE.Group();head.name='Head';head.position.y=24*U;upper.add(head);
 box('HeadSkin',8,8,8,skinRects(0,0,8,8,8),[0,4*U,0],head);
 box('HairLayer',8.24,8.24,8.24,skinRects(32,0,8,8,8),[0,4*U,0],head,layers);
 const arms={};
 for(const [side,x,tx,ty,ox,oy]of [['right',-5,40,16,40,32],['left',5,32,48,48,48]]){
  const arm=new THREE.Group();arm.name=side==='right'?'RightArm':'LeftArm';arm.position.set(x*U,22*U,0);upper.add(arm);
  const cx=(side==='right'?-1:1)*U;
  box(arm.name+'Upper',4,6,4,slicedArmRects(tx,ty,0,6),[cx,-1*U,0],arm);
  box(arm.name+'Sleeve',4.12,6.08,4.12,slicedArmRects(ox,oy,0,6),[cx,-1*U,0],arm,layers);
  const elbow=new THREE.Group();elbow.name=arm.name+'Elbow';elbow.position.y=-4*U;arm.add(elbow);
  box(arm.name+'Forearm',4,6,4,slicedArmRects(tx,ty,6,6),[cx,-3*U,0],elbow);
  box(arm.name+'Cuff',4.12,6.08,4.12,slicedArmRects(ox,oy,6,6),[cx,-3*U,0],elbow,layers);
  arms[side]={arm,elbow,hand:new THREE.Vector3()};
 }
 const legs={};
 for(const [side,x,tx,ty,ox,oy]of [['right',-2,0,16,0,32],['left',2,16,48,0,48]]){
  const leg=new THREE.Group();leg.name=side==='right'?'RightLeg':'LeftLeg';leg.position.set(x*U,12*U,0);root.add(leg);
  box(leg.name+'Skin',4,12,4,skinRects(tx,ty,4,12,4),[0,-6*U,0],leg);
  box(leg.name+'Pants',4.1,12.1,4.1,skinRects(ox,oy,4,12,4),[0,-6*U,0],leg,layers);legs[side]=leg;
 }
 let weaponId=getSteveWeapon(weapon).id,sword=createMinecraftItem(weaponId);sword.name='Sword';arms.right.arm.add(sword);const weaponCache=new Map([[weaponId,sword]]);
 function setWeapon(id){const next=getSteveWeapon(id).id;if(next===weaponId)return;sword.removeFromParent();if(!weaponCache.has(next)){const item=createMinecraftItem(next);item.name='Sword';weaponCache.set(next,item);}weaponId=next;sword=weaponCache.get(next);arms.right.arm.add(sword);root.userData.weaponId=next;sword.visible=!isBow;}
 root.userData.weaponId=weaponId;
 const rightGrip=new THREE.Object3D();rightGrip.name='RightGrip';rightGrip.position.set(-U,-8.57*U,.67*U);arms.right.arm.add(rightGrip);
 const bow=new THREE.Group();bow.name='Bow';arms.right.arm.add(bow);bow.visible=false;
 const bowStages=[-1,0,1,2].map(pull=>{const item=createMinecraftItem('bow',{pull});item.name=`BowStage${pull+1}`;bow.add(item);return item;});
 // Vanilla pulled-bow textures already include the aligned nocked arrow and
 // string. Reusing those pixels avoids a second, incorrectly rotated arrow.
 const arrow=new THREE.Group();arrow.name='NockedArrow';arrow.visible=false;root.add(arrow);
 // A narrow cyan crescent follows the sword only during the contact portion.
 const trailGeo=new THREE.RingGeometry(.62,.96,24,1,-.93,1.9);trailGeo.rotateX(-Math.PI/2);
 const trail=new THREE.Mesh(trailGeo,new THREE.MeshBasicMaterial({color:'#75fff0',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));trail.name='SwordTrail';trail.visible=false;root.add(trail);
 let time=0,attackAge=99,attackKind='melee',isBow=false,moveBlend=0,swingDuration=.43,swingDirection=1,shotInterval=.75;
 let startPose={x:-Math.PI/10,y:0,z:0,body:0};
 function pose(dt,options={}){
  if(dt>0){time+=dt;attackAge+=dt;moveBlend=lerp(moveBlend,options.moving?1:0,1-Math.exp(-dt*12));}
  const equipped=getSteveWeapon(weaponId),skillBow=!!options.bowActive,inLobby=options.phase==='ready';
  isBow=skillBow||equipped.kind==='bow';sword.visible=!isBow;bow.visible=isBow;arrow.visible=false;
  const stride=Math.sin(time*9.3)*.62*moveBlend;
  // Vanilla limbs remain whole cuboids. Shoulder pivots match HumanoidModel,
  // with the mesh two pixels above the joint and ten pixels below it.
  upper.rotation.y=0;body.position.y=18*U;head.position.y=24*U;
  head.rotation.set(Math.sin(time*1.7)*.012*(1-moveBlend),0,0);
  legs.right.rotation.x=stride;legs.left.rotation.x=-stride;
  for(const side of ['right','left']){const a=arms[side];a.arm.position.y=22*U;a.arm.position.z=0;a.arm.rotation.set((side==='right'?-1:1)*stride*.65,0,0,'ZYX');a.elbow.rotation.set(0,0,0);}
  if(isBow){
   // Mojang player.animation.json bow_equipped. Conjugating by Rx(PI)
   // keeps X and reverses Y/Z when changing the model coordinate system.
   arms.right.arm.rotation.set(-Math.PI/2,THREE.MathUtils.degToRad(5),0,'ZYX');
   arms.left.arm.rotation.set(-Math.PI/2,THREE.MathUtils.degToRad(-27.5),0,'ZYX');
   // Fire is a release event. The original generated item progresses back
   // through its three draw stages between arrows, exactly like Minecraft.
   const draw=attackAge/Math.max(.4,shotInterval),released=['bow','ranged','arrow'].includes(attackKind);
   const stage=inLobby?0:released&&draw<.8?(draw<.08?0:draw<.30?1:draw<.55?2:3):3;
   bowStages.forEach((item,i)=>item.visible=i===stage);trail.visible=false;
   if(inLobby){arms.right.arm.rotation.set(-.22,0,0,'ZYX');arms.left.arm.rotation.set(.12,0,0,'ZYX');}
  }else if(equipped.kind==='crossbow'){
   const reloading=['ranged','bolt'].includes(attackKind)&&attackAge<shotInterval;
   const progress=attackAge/Math.max(.4,shotInterval),recoil=Math.max(0,1-attackAge/.18);
   const frame=inLobby?1:!reloading?0:progress<.12?1:progress<.38?2:progress<.65?3:progress<.9?4:0;
   sword.children.forEach((mesh,i)=>mesh.visible=i===frame);
   arms.right.arm.rotation.set(inLobby?-.35:-Math.PI/2-recoil*.13,.08,0,'ZYX');
   arms.left.arm.rotation.set(inLobby?-.28:-1.24,-.43,.05,'ZYX');
   if(reloading&&!inLobby){arms.left.arm.rotation.x+=Math.sin(Math.PI*progress)*.32;arms.left.arm.rotation.y-=Math.sin(Math.PI*progress)*.15;}
   head.rotation.y=.04;trail.visible=false;
  }else if(equipped.kind==='staff'){
   const recoil=Math.max(0,1-attackAge/.32),active=['ranged','ember'].includes(attackKind)&&recoil>0;
   arms.right.arm.rotation.set(inLobby?-.22:active?-1.18-recoil*.22:-.55,.08,active?-.08:0,'ZYX');
   sword.children[0].material.emissiveIntensity=inLobby?.25:.4+(active?recoil*.7:Math.sin(time*3)*.08);
   head.rotation.y=active?-.04:0;trail.visible=false;
  }else if(equipped.kind==='snowball'||equipped.kind==='throwing-trident'){
   const throwing=equipped.kind==='throwing-trident',duration=Math.min(throwing?.62:.38,shotInterval*.9),active=['ranged','snowball','trident'].includes(attackKind)&&attackAge<duration;
   const f=clamp(attackAge/duration),release=smooth(f/.38),recover=smooth((f-.42)/.58),rest=inLobby?-.22:throwing?-.62:-.38;
   // A shoulder-led overhand release: it is visibly a throw, never the old
   // sword sweep. The spare snowball/trident reappears during recovery.
   arms.right.arm.rotation.x=active?lerp(lerp(-2.35,-.70,release),rest,recover):rest;
   arms.right.arm.rotation.y=active?lerp(-.18,.10,release)*(1-recover):0;
   arms.right.elbow.rotation.x=active?-.32*(1-release):0;
   arms.left.arm.rotation.x=active?-.24-Math.sin(f*Math.PI)*.18:-stride*.5;
   upper.rotation.y=active?Math.sin(f*Math.PI)*.11:0;head.rotation.y=-upper.rotation.y;
   sword.visible=inLobby||!active||f<.09||f>.65;
   trail.visible=false;
  }else{
   const a=arms.right,active=attackKind==='melee'&&attackAge<swingDuration,idleX=-THREE.MathUtils.degToRad(18)-stride*.25;
   a.arm.rotation.x=idleX;
   if(active){
    // Broad, horizontal cleave. The exact vanilla item mount stays fixed;
    // shoulder and a restrained torso turn carry the blade through the arc.
    const age=attackAge*.43/swingDuration,wind=smooth(age/.07),cut=smooth((age-.07)/.13),recover=smooth((age-.25)/.18),d=swingDirection;
    const windYaw=-.91*d,finishYaw=1.00*d;
    const cutYaw=lerp(windYaw,finishYaw,cut),cutBody=lerp(-.13*d,.13*d,cut);
    a.arm.rotation.y=lerp(lerp(startPose.y,cutYaw,wind),0,recover);
    a.arm.rotation.x=lerp(lerp(startPose.x,-.36,wind),idleX,recover);
    a.arm.rotation.z=lerp(lerp(startPose.z,-.04*d,wind),0,recover);
    upper.rotation.y=lerp(lerp(startPose.body,cutBody,wind),0,recover);
    const style=getSteveWeapon(weaponId).kind;
    if(style==='axe'||style==='mace'){
     const lift=style==='mace'?-2.2:-1.8,drop=.32;
     a.arm.rotation.x=lerp(lerp(startPose.x,lerp(lift,drop,cut),wind),idleX,recover);
     a.arm.rotation.y=lerp(-.15,.28,cut)*(1-recover);upper.rotation.y=lerp(-.07,.10,cut)*(1-recover);
    }else if(style==='trident'){
     a.arm.rotation.x=lerp(idleX,-1.05,wind)*(1-recover)+idleX*recover;
     a.arm.rotation.y=.10*(1-recover);a.arm.position.z=Math.sin(Math.PI*cut)*.19*(1-recover);upper.rotation.y=.05*(1-recover);
    }
    head.rotation.y=-upper.rotation.y;
   }
   trail.visible=false;
  }
  root.userData.bowActive=skillBow;root.userData.rangedActive=equipped.attackMode==='ranged';root.userData.heldWeapon=skillBow?'bow':weaponId;root.userData.attackAge=attackAge;root.userData.attackKind=attackKind;
 }
 function attack({kind='melee',interval=.72,duration}={}){
  if(['ranged','bow','arrow','bolt','ember','snowball','trident'].includes(kind))shotInterval=Math.max(.15,interval);
  if(kind==='melee'){const chaining=attackKind==='melee'&&attackAge<swingDuration+.03;swingDirection=chaining?-swingDirection:1;startPose={x:arms.right.arm.rotation.x,y:arms.right.arm.rotation.y,z:arms.right.arm.rotation.z,body:upper.rotation.y};swingDuration=Math.min(.43,Math.max(.14,Number.isFinite(duration)?duration:interval*.9));}
  attackKind=kind;attackAge=0;
 }
 function reset(){time=0;attackAge=99;attackKind='melee';moveBlend=0;swingDuration=.43;swingDirection=1;pose(0,{moving:false,bowActive:false});}
 reset();
 return {root,update:pose,attack,super(){attackKind='bow';attackAge=99;},reset,head,get sword(){return sword;},setWeapon,get weaponId(){return weaponId;},bow,arrow,rightGrip,
  dispose(){const geometries=new Set(),materials=new Set();for(const item of weaponCache.values())item.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();texture.dispose();}
 };
}
