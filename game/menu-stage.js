import * as THREE from 'three';
import {createLobbyAtmosphere} from './lobby-atmosphere.js';
// Only the live hero and its shadow are rendered over the compressed world plate.
export function createMenuStage(scene,{mobile=false,reducedMotion=false}={}){
 const root=new THREE.Group();root.name='Pixel lobby lighting';scene.add(root);
 const ambient=new THREE.HemisphereLight('#b7e7ff','#30486c',1.8);root.add(ambient);
 const key=new THREE.DirectionalLight('#ffe7c2',2.5);key.position.set(-3,6,5);key.castShadow=!mobile;key.shadow.mapSize.set(512,512);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-2,near:.5,far:18});key.shadow.bias=-.0006;key.shadow.normalBias=.025;root.add(key);
 const rim=new THREE.DirectionalLight('#64d8ff',1.9);rim.position.set(2,3,-4);root.add(rim);
 const geometry=new THREE.PlaneGeometry(5,5),material=new THREE.ShadowMaterial({opacity:mobile?.23:.30,depthWrite:false});const shadow=new THREE.Mesh(geometry,material);shadow.rotation.x=-Math.PI/2;shadow.position.y=.004;shadow.receiveShadow=true;root.add(shadow);
 const atmosphere=createLobbyAtmosphere(root,{mobile,reducedMotion});
 return{root,atmosphere,resize:(w,h)=>atmosphere.resize(w,h),update:(dt,options)=>atmosphere.update(dt,options),dispose(){atmosphere.dispose();geometry.dispose();material.dispose();key.shadow.map?.dispose();root.removeFromParent();}};
}
