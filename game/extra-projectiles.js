import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import itemPixels from './assets/extra-weapons/item-pixels.js';

// Original item pixels with real edge thickness. The trident tip is +Z, so the
// shared projectile renderer only needs yaw=atan2(vx,vz), just like its arrows.
function extrudePixels(key,pixel,depth){
 const p=itemPixels[key],positions=[],normals=[],colours=[];
 const opaque=(x,y)=>x>=0&&y>=0&&x<p.width&&y<p.height&&p.pixels[y*p.width+x][3]>127;
 const faces=[
  {n:[0,0,1],q:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:1},
  {n:[0,0,-1],q:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.93},
  {n:[1,0,0],q:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.77,near:[1,0]},
  {n:[-1,0,0],q:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.82,near:[-1,0]},
  {n:[0,1,0],q:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1.02,near:[0,-1]},
  {n:[0,-1,0],q:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.74,near:[0,1]},
 ];
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(opaque(x,y)){
  const rgba=p.pixels[y*p.width+x],c=new THREE.Color().setRGB(rgba[0]/255,rgba[1]/255,rgba[2]/255,THREE.SRGBColorSpace);
  for(const f of faces){if(f.near&&opaque(x+f.near[0],y+f.near[1]))continue;
   for(const i of [0,1,2,0,2,3]){const q=f.q[i];positions.push((x+q[0]-8)*pixel,(8-y-1+q[1])*pixel,(q[2]-.5)*depth);normals.push(...f.n);colours.push(c.r*f.shade,c.g*f.shade,c.b*f.shade);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
 g.computeBoundingSphere();g.computeBoundingBox();g.userData.itemPixelKey=key;return g;
}

export function createExtraProjectileGeometry(kind){
 if(kind==='trident'){
  const g=extrudePixels('thrown-trident',.065,.075);
  g.rotateZ(-Math.PI/4);g.rotateY(-Math.PI/2);g.rotateZ(Math.PI/2);
  g.computeBoundingSphere();g.computeBoundingBox();g.userData.forwardAxis='+Z';return g;
 }
 if(kind==='snowball'){
  // Two crossed original sprites retain the recognisable snowball silhouette
  // from the overhead and side cameras, rather than becoming an edge-on dot.
  const front=extrudePixels('snowball',.029,.10),side=front.clone();side.rotateY(Math.PI/2);
  const top=front.clone();top.rotateX(Math.PI/2);
  const g=mergeGeometries([front,side,top]);front.dispose();side.dispose();top.dispose();
  g.computeBoundingSphere();g.computeBoundingBox();g.userData.itemPixelKey='snowball';return g;
 }
 throw new Error(`Unknown extra projectile: ${kind}`);
}
