import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import modelURL from './assets/pudge/pudge.glb?url';
export {default as pudgePortraitURL} from './assets/pudge/pudge-portrait.png?url';
const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{n=clamp(n);return n*n*(3-2*n);};

export async function loadPudge(){
 const gltf=await new GLTFLoader().loadAsync(modelURL),model=gltf.scene,root=new THREE.Group();root.name='Pudge';root.add(model);model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const bodyBounds=new THREE.Box3();model.traverse(o=>{if(o.isMesh&&!o.name.includes('weapon'))bodyBounds.union(new THREE.Box3().setFromObject(o));});model.scale.setScalar(2.05/(bodyBounds.max.y-bodyBounds.min.y));model.updateMatrixWorld(true);const placed=new THREE.Box3();model.traverse(o=>{if(o.isMesh&&!o.name.includes('weapon'))placed.union(new THREE.Box3().setFromObject(o));});model.position.y-=placed.min.y;model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 const bone=name=>model.getObjectByName(name),baseY=model.position.y;
 // Valve's workshop weapons are separate reference items at their origins.
 // Bake those two rigid skins, then mount the original geometry in the fists.
 function mountWeapon(meshName,pivotName,wristName,offset,rotation){
  const original=bone(meshName),reference=bone(pivotName),wrist=bone(wristName);if(!original||!reference||!wrist)return null;
  original.updateMatrixWorld(true);original.skeleton?.update();const geometry=original.geometry.clone(),position=geometry.attributes.position,v=new THREE.Vector3(),origin=reference.getWorldPosition(new THREE.Vector3());
  for(let i=0;i<position.count;i++){original.getVertexPosition(i,v);v.applyMatrix4(original.matrixWorld).sub(origin);position.setXYZ(i,v.x,v.y,v.z);}geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const item=new THREE.Mesh(geometry,original.material.clone());item.name=meshName+'_held';item.material.side=THREE.DoubleSide;item.castShadow=true;item.receiveShadow=true;
  item.position.copy(wrist.getWorldPosition(new THREE.Vector3())).add(offset);item.quaternion.setFromEuler(new THREE.Euler(...rotation));root.add(item);item.updateMatrixWorld(true);wrist.attach(item);original.visible=false;return item;
 }
 const hookMesh=mountWeapon('pudge_weapon','weapon_rt_1','wrist_R',new THREE.Vector3(-.08,-.12,.04),[Math.PI/2,0,0]);
 const cleaver=mountWeapon('pudge_offhand_weapon','weapon_lf_2','wrist_L',new THREE.Vector3(.08,-.12,.04),[.22,Math.PI/2,0]);
 const names=['spine1','spine2','spine3','bicep_R','bicep_L','elbow_R','elbow_L','thigh_R','thigh_L','knee_R','knee_L'];
 const joints=names.map(name=>bone(name)).filter(Boolean),rest=joints.map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
 const axisWorld=new THREE.Vector3(),parentQ=new THREE.Quaternion(),rootQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
 function rotate(name,axis,angle){const b=bone(name);if(!b?.parent||!angle)return;root.getWorldQuaternion(rootQ);b.parent.getWorldQuaternion(parentQ);axisWorld.copy(axis).applyQuaternion(rootQ).applyQuaternion(parentQ.invert()).normalize();delta.setFromAxisAngle(axisWorld,angle);b.quaternion.premultiply(delta);b.updateWorldMatrix(false,true);}
 const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);let time=0,move=0,attackAge=9,attackDuration=.55,hookAge=9;
 function update(dt,{moving=false}={}){
  time+=dt;attackAge+=dt;hookAge+=dt;if(dt>0)move+=(Number(moving)-move)*(1-Math.exp(-dt*10));for(const r of rest){r.o.position.copy(r.p);r.o.quaternion.copy(r.q);}model.position.y=baseY;
  const stride=Math.sin(time*6.8)*move;rotate('spine1',X,Math.sin(time*1.8)*.008);rotate('bicep_R',Z,.30);rotate('bicep_L',Z,-.30);rotate('elbow_R',X,-.12);rotate('elbow_L',X,-.16);
  rotate('thigh_L',X,stride*.32);rotate('thigh_R',X,-stride*.32);rotate('knee_L',X,Math.max(0,-stride)*.20);rotate('knee_R',X,Math.max(0,stride)*.20);rotate('spine2',Y,stride*.025);
  if(attackAge<attackDuration){const a=attackAge/attackDuration,wind=smooth(a/.20),sweep=smooth((a-.20)/.14),recover=smooth((a-.48)/.52),strength=1-recover;rotate('bicep_L',X,(-.35-.35*sweep)*wind*strength);rotate('bicep_L',Z,(.55-sweep)*wind*strength);rotate('bicep_L',Y,(.32-1.1*sweep)*wind*strength);rotate('spine2',Y,(.12-.28*sweep)*wind*strength);}
  if(hookAge<.44){const p=Math.sin(Math.PI*clamp(hookAge/.44));rotate('bicep_R',X,-1.0*p);rotate('elbow_R',X,-.18*p);}
  if(hookMesh)hookMesh.visible=hookAge>=.44;model.updateMatrixWorld(true);root.userData.attackAge=attackAge;root.userData.hookAge=hookAge;
 }
 function reset(){time=0;move=0;attackAge=9;hookAge=9;update(0);}
 reset();return{root,model,cleaver,hookMesh,update,attack({duration=.55}={}){attackDuration=Math.max(.14,duration);attackAge=0;},hook(){hookAge=0;},reset,dispose(){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();root.removeFromParent();}};
}
