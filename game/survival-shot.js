import * as THREE from 'three';

const FORWARD = new THREE.Vector3(0, 0, 1);

export function recoilEnvelope(age) {
  if (age < 0 || age >= .24) return 0;
  if (age < .04) return Math.sin(age / .04 * Math.PI / 2);
  const recovery = (age - .04) / .20;
  return Math.pow(Math.cos(recovery * Math.PI / 2), 2);
}

function flashShape() {
  const points = [new THREE.Vector3(0, 0, 0)];
  for (let i = 0; i <= 10; i++) {
    const angle = i / 10 * Math.PI * 2, radius = i % 2 ? .09 : .23;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(points);const indices=[];
  for (let i=1;i<=10;i++)indices.push(0,i,i+1);
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

const ARM_TRACK = /^(L|R)_(clavicle|shoulder|elbow|forearm_twist|wrist|middle|index|thumb|gunbone)/;

/** Retimed, masked original Shelly attack. Locomotion and face stay independent. */
export class ShotFeedback {
  constructor(scene, model, options={}) {
    this.model=model;this.age=1;this.flashLife=0;this.flashFrames=0;this.saved=[];
    this.chest=model.getObjectByName('chest_s');
    this.barrel=model.getObjectByName('L_gunbone_02_s');
    this.anchor=new THREE.Object3D();this.anchor.name='SurvivalMuzzle';
    const attachment=this.barrel||model;attachment.add(this.anchor);
    this.findMuzzle();
    this.configure(Array.isArray(options)?options:options.clips||[]);
    this.flash=new THREE.Group();scene.add(this.flash);
    const outer=new THREE.MeshBasicMaterial({color:'#ffcc51',transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    this.outerMaterial=outer;
    const inner=new THREE.MeshBasicMaterial({color:'#fff8d0',transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    const star=new THREE.Mesh(flashShape(),outer);star.position.z=.04;this.flash.add(star);
    const second=star.clone();second.rotation.x=Math.PI/2;second.scale.setScalar(.74);this.flash.add(second);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.09,.29,5),inner);cone.rotation.x=Math.PI/2;cone.position.z=.12;this.flash.add(cone);
    this.flash.visible=false;
    this.position=new THREE.Vector3();this.direction=new THREE.Vector3();this.inverse=new THREE.Matrix3();
    this.localDirection=new THREE.Vector3(0,0,1);
    if(this.barrel){const forward=new THREE.Vector3(0,0,1).transformDirection(this.model.matrixWorld);const origin=this.anchor.getWorldPosition(new THREE.Vector3());const end=origin.clone().add(forward);this.barrel.worldToLocal(origin);this.barrel.worldToLocal(end);this.localDirection.subVectors(end,origin).normalize();}
    this.delta=new THREE.Quaternion();this.blended=new THREE.Quaternion();this.identity=new THREE.Quaternion();
  }
  configure(clips){
    const attack=clips.find(c=>c.name==='Attack');this.channels=[];
    if(!attack)return;
    for(const track of attack.tracks){
      const split=track.name.lastIndexOf('.'),name=track.name.slice(0,split),property=track.name.slice(split+1),bone=this.model.getObjectByName(name);
      if(!bone||!ARM_TRACK.test(name)||!['position','quaternion'].includes(property))continue;
      const sample=track.createInterpolant(),reference=Array.from(sample.evaluate(0));
      this.channels.push({bone,property,sample,reference});
    }
  }
  findMuzzle() {
    this.model.updateWorldMatrix(true,true);
    // SkinnedMesh overrides updateMatrixWorld to refresh bindMatrixInverse.
    // updateWorldMatrix alone leaves the pre-render palette in bind space.
    this.model.updateMatrixWorld(true);
    const candidates=[];const v=new THREE.Vector3();const inverse=this.model.matrixWorld.clone().invert();
    this.model.traverse(object=>{
      if(!object.isSkinnedMesh||!/gun/i.test(object.name))return;
      // getVertexPosition reads the skeleton palette, normally refreshed by
      // WebGLRenderer. This constructor runs before the model's first draw.
      object.skeleton.update();
      for(let i=0;i<object.geometry.attributes.position.count;i++){
        object.getVertexPosition(i,v);v.applyMatrix4(object.matrixWorld).applyMatrix4(inverse);candidates.push(v.clone());
      }
    });
    if(candidates.length){
      const furthest=Math.max(...candidates.map(p=>p.z));const lip=candidates.filter(p=>p.z>furthest-.14);
      const centre=lip.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/lip.length);
      centre.z+=.05;centre.applyMatrix4(this.model.matrixWorld);
      this.anchor.position.copy(this.anchor.parent.worldToLocal(centre));
    }else this.anchor.position.set(0,1,.8);
  }
  trigger({power=1}={}){this.power=power;this.isSuper=power>1.2;this.age=0;this.flashLife=this.isSuper?.07:.045;this.flashFrames=2;this.outerMaterial.color.set(this.isSuper?'#ffd050':'#d8f3ff');}
  restorePose(){for(const {bone,position,quaternion} of this.saved){bone.position.copy(position);if(quaternion)bone.quaternion.copy(quaternion);}this.saved.length=0;}
  offsetBone(bone,distance){
    if(!bone?.parent)return;
    const position=bone.position.clone();this.saved.push({bone,position,quaternion:bone.quaternion.clone()});
    bone.parent.updateWorldMatrix(true,false);
    this.inverse.setFromMatrix4(bone.parent.matrixWorld).invert();
    const delta=this.direction.clone().multiplyScalar(-distance).applyMatrix3(this.inverse);
    bone.position.add(delta);bone.updateWorldMatrix(false,true);
  }
  update(dt){
    this.age+=dt;const duration=this.isSuper?.34:.24,normalized=this.age/duration;
    const pulse=recoilEnvelope(normalized*.24);
    this.model.updateWorldMatrix(true,true);
    this.direction.copy(FORWARD).transformDirection(this.model.matrixWorld);
    const power=this.power||1;
    if(pulse>0&&this.channels.length){
      // The source contains a long recovery/hold. Only its discharge gesture is
      // used here: 0.15 s neutral -> 0.235 s normal / 0.33 s Super kick.
      const sourceTime=.15+((this.isSuper?.33:.235)-.15)*pulse;
      const saved=new Set();
      for(const {bone,property,sample,reference}of this.channels){
        if(!saved.has(bone)){this.saved.push({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()});saved.add(bone);}
        const value=sample.evaluate(sourceTime);
        if(property==='position')bone.position.add(new THREE.Vector3(value[0]-reference[0],value[1]-reference[1],value[2]-reference[2]));
        else{this.delta.fromArray(reference).invert().multiply(this.blended.fromArray(value));bone.quaternion.multiply(this.delta).normalize();}
      }
    }else if(pulse>0){
      // Compatibility for callers without the GLB clips. The game passes them.
      this.offsetBone(this.chest,pulse*.025*power);this.offsetBone(this.barrel,pulse*.014*power);
    }
    this.model.updateWorldMatrix(true,true);this.anchor.getWorldPosition(this.position);
    if(this.barrel)this.direction.copy(this.localDirection).transformDirection(this.barrel.matrixWorld);
    this.flash.position.copy(this.position);this.flash.quaternion.setFromUnitVectors(FORWARD,this.direction);
    this.flashLife-=dt;this.flash.visible=this.flashLife>0||this.flashFrames>0;
    this.flash.scale.setScalar((.8+Math.max(0,this.flashLife/.055)*.35)*(this.isSuper?1.65:1));
    this.model.userData.shellyAttack={kind:this.isSuper?'super':'normal',age:this.age,duration,sourceChannels:this.channels.length};
  }
  afterRender(){if(this.flashFrames>0)this.flashFrames--;}
  reset(){this.restorePose();this.power=1;this.isSuper=false;this.age=1;this.flashFrames=0;this.flashLife=0;this.flash.visible=false;this.model.userData.shellyAttack=null;}
}
