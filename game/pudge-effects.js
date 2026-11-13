import * as THREE from 'three';
const TAU=Math.PI*2;
export class PudgeEffects{
 constructor(scene,{mobile=false}={}){
  this.group=new THREE.Group();this.group.name='Pudge Rot and hook';scene.add(this.group);this.time=0;this.pulseTime=0;this.hookState=null;this.materials=[];this.geometries=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#ffffffcc');gradient.addColorStop(.4,'#ffffff65');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);this.texture=new THREE.CanvasTexture(canvas);
  const points=(count,color,size,opacity)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));const m=new THREE.PointsMaterial({map:this.texture,color,size,transparent:true,opacity,depthWrite:false,sizeAttenuation:true,toneMapped:false});const mesh=new THREE.Points(g,m);mesh.frustumCulled=false;mesh.visible=false;this.group.add(mesh);this.materials.push(m);this.geometries.push(g);return mesh;};
  this.fog=points(mobile?20:30,'#435a1e',1.65,.68);this.mist=points(14,'#c6d74e',.92,.58);this.spores=points(24,'#dfed8e',.09,.85);
  const ringG=new THREE.RingGeometry(.975,1,80);ringG.rotateX(-Math.PI/2);const ringM=new THREE.MeshBasicMaterial({color:'#c0c979',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});this.ring=new THREE.Mesh(ringG,ringM);this.ring.visible=false;this.group.add(this.ring);this.materials.push(ringM);this.geometries.push(ringG);
  const steel=new THREE.MeshStandardMaterial({color:'#8e9482',roughness:.55,metalness:.45}),chainG=new THREE.TorusGeometry(.067,.019,4,10);this.chain=new THREE.InstancedMesh(chainG,steel,64);this.chain.count=0;this.chain.frustumCulled=false;this.group.add(this.chain);this.materials.push(steel);this.geometries.push(chainG);this.dummy=new THREE.Object3D();
  this.hookHead=new THREE.Group();const hookG=new THREE.TorusGeometry(.18,.045,6,18,Math.PI*1.55),hook=new THREE.Mesh(hookG,steel);hook.rotation.x=Math.PI/2;this.hookHead.add(hook);const pointG=new THREE.ConeGeometry(.065,.20,5),point=new THREE.Mesh(pointG,steel);point.position.set(.13,0,-.16);point.rotation.x=-Math.PI/2;this.hookHead.add(point);this.group.add(this.hookHead);this.hookHead.visible=false;this.geometries.push(hookG,pointG);
 }
 hook(event){this.hookState={...event,age:0};}
 pulse(event){if(event.hits>0)this.pulseTime=.18;}
 update(dt,{player,phase,character}){
  this.time+=dt;this.pulseTime=Math.max(0,this.pulseTime-dt);const active=character==='pudge'&&player.rot?.level>0&&player.hp>0,r=player.rot?.radius||0;
  for(const mesh of [this.fog,this.mist,this.spores,this.ring])mesh.visible=active;
  if(active){
   for(const[mesh,layer]of [[this.fog,0],[this.mist,1],[this.spores,2]]){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const angle=i*2.39996+this.time*(layer===2?.2:.11)*(i%2?1:-1),distance=Math.sqrt(((i*37)%a.count+.5)/a.count)*r*(layer===2?.9:.78),y=layer===2?.40+(i%7)*.12+Math.sin(this.time+i)*.14:.48+layer*.22+Math.sin(this.time*.8+i)*.15;a.setXYZ(i,player.x+Math.cos(angle)*distance,y,player.z+Math.sin(angle)*distance);}a.needsUpdate=true;}
   this.fog.material.size=Math.max(1.3,r*.67);this.ring.position.set(player.x,.035,player.z);this.ring.scale.set(r,1,r);this.ring.material.opacity=.32+this.pulseTime*.5;
  }
  const h=this.hookState;if(h){h.age+=dt;const life=.44;if(h.age>=life){this.hookState=null;this.chain.count=0;this.hookHead.visible=false;}else{const t=h.age<.12?1-Math.pow(1-h.age/.12,2):Math.max(0,1-(h.age-.12)/.32),sx=player.x-h.dz*.7,sz=player.z+h.dx*.7,dx=h.targetX-sx,dz=h.targetZ-sz,d=Math.hypot(dx,dz)||1,length=d*t,angle=Math.atan2(dx,dz),n=Math.min(64,Math.floor(length/.14));this.chain.count=n;for(let i=0;i<n;i++){const f=(i+.5)/n*t;this.dummy.position.set(sx+dx*f,.85-Math.sin(f*Math.PI)*.12,sz+dz*f);this.dummy.rotation.set(i%2?Math.PI/2:0,angle+Math.PI/2,0);this.dummy.scale.set(.8,1,1);this.dummy.updateMatrix();this.chain.setMatrixAt(i,this.dummy.matrix);}this.chain.instanceMatrix.needsUpdate=true;this.hookHead.visible=true;this.hookHead.position.set(sx+dx*t,.85,sz+dz*t);this.hookHead.rotation.y=angle;}}
 }
 reset(){this.hookState=null;this.chain.count=0;this.hookHead.visible=false;this.time=0;this.pulseTime=0;for(const mesh of [this.fog,this.mist,this.spores,this.ring])mesh.visible=false;}
 dispose(){this.reset();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();this.texture.dispose();this.group.removeFromParent();}
}
