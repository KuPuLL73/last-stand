import * as THREE from 'three';
import wither from './assets/minecraft-mobs/wither_boss.geo.json';
import witherURL from './assets/minecraft-mobs/wither.png?url';
import {createBedrockCubeGeometry} from './minecraft-mobs.js';

/** The actual central Wither head, centred for a forward-facing projectile. */
export function createWitherSkullGeometry(){
 const source=Object.values(wither).find(value=>value?.bones),head=source.bones.find(bone=>bone.name==='head1'),cube=head.cubes[0];
 const centred={...cube,origin:cube.size.map(size=>-size/2)};
 return createBedrockCubeGeometry(centred,{pivot:[0,0,0]},source.texturewidth,source.textureheight);
}

/** One instanced textured head batch; update allocates no per-shot objects. */
export function createWitherSkullBatch(parent,{capacity=80,mobile=false}={}){
 const texture=new THREE.TextureLoader().load(witherURL);texture.name='Mojang Wither · original head pixels';texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 const material=new THREE.MeshStandardMaterial({map:texture,roughness:1,alphaTest:.5});
 const mesh=new THREE.InstancedMesh(createWitherSkullGeometry(),material,capacity);mesh.name='Wither skulls · original head geometry and texture';mesh.count=0;mesh.castShadow=!mobile;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(mesh);
 const dummy=new THREE.Object3D();
 return{mesh,texture,update(projectiles){let count=0;for(const p of projectiles){if(p.kind!=='wither-skull'||p.life<=0||count>=capacity)continue;dummy.position.set(p.x,Number.isFinite(p.y)?p.y:2.3,p.z);dummy.rotation.set(0,Math.atan2(p.vx||0,p.vz||0),0);const scale=Number.isFinite(p.modelScale)?Math.max(.1,p.modelScale):1;dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(count++,dummy.matrix);}mesh.count=count;mesh.instanceMatrix.needsUpdate=true;},dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();texture.dispose();}};
}
