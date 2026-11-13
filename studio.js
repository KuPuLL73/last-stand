import './studio.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import modelURL from './shelly/model/shelly.glb?url';
import blendURL from './shelly/model/shelly.blend?url';
import info from './shelly/model/model-info.json';

document.querySelector('#download-glb').href=modelURL;
document.querySelector('#download-blend').href=blendURL;
document.querySelector('#triangles').textContent=new Intl.NumberFormat('ru-RU').format(info.triangles)+' трис';
document.querySelector('#bones').textContent=info.bones+' костей';
const viewport=document.querySelector('#canvas'),scene=new THREE.Scene();
scene.background=new THREE.Color('#0b171e');scene.fog=new THREE.Fog('#0b171e',18,42);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;viewport.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Объёмная модель Шелли: перетащи для поворота');
const camera=new THREE.PerspectiveCamera(34,1,.1,100),controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,1.75,0);controls.enableDamping=true;controls.dampingFactor=.07;
controls.minDistance=3.8;controls.maxDistance=16;controls.minPolarAngle=.20;controls.maxPolarAngle=Math.PI*.53;
controls.enablePan=false;controls.autoRotateSpeed=.7;
const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.45;
environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xcfe5ff,0x273a20,.8));
function light(color,intensity,pos,shadows=false){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);l.castShadow=shadows;if(shadows){l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-4,right:4,top:6,bottom:-2,near:.5,far:16});l.shadow.bias=-.0003;l.shadow.normalBias=.025;}scene.add(l);return l;}
light(0xffedcd,3.2,[-3,6,5],true);light(0xb8d9ff,1.4,[4,3,2]);light(0xffbb7b,2.6,[1,5,-4]);
const stage=new THREE.Mesh(new THREE.CylinderGeometry(2.35,2.4,.16,96),new THREE.MeshStandardMaterial({color:'#173743',roughness:.48,metalness:.15}));
stage.receiveShadow=true;scene.add(stage);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#0b202a',roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-.085;floor.receiveShadow=true;scene.add(floor);
let model,mixer,clips={},currentView='hero',animation='Idle';
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();setView(currentView);}
function setView(view){currentView=view;const visibleHeight=Math.max(4.7,4.8/camera.aspect),distance=visibleHeight/(2*Math.tan(THREE.MathUtils.degToRad(17)));const angles={hero:[.48,1.32],front:[0,1.48],side:[Math.PI/2,1.48],back:[Math.PI,1.48]};const [yaw,polar]=angles[view];camera.position.setFromSphericalCoords(distance,polar,yaw).add(controls.target);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));}
function setAnimation(name){if(!mixer)return;animation=name;if(name==='Rest'){mixer.timeScale=0;}else{mixer.timeScale=1;mixer.stopAllAction();if(clips[name]){const action=clips[name];action.reset();if(name==='Attack'){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}else action.setLoop(THREE.LoopRepeat,Infinity);action.play();}}document.querySelectorAll('[data-animation]').forEach(b=>b.classList.toggle('selected',b.dataset.animation===name));}
new GLTFLoader().load(modelURL,gltf=>{
  model=gltf.scene;model.name='Shelly';scene.add(model);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){mat.userData.originalColor=mat.color.clone();mat.userData.originalMap=mat.map;mat.userData.originalMetalness=mat.metalness;}}});
  mixer=new THREE.AnimationMixer(model);
  for(const clip of gltf.animations){const name=clip.name.includes('Attack')?'Attack':'Idle';clips[name]=mixer.clipAction(clip);}
  mixer.addEventListener('finished',()=>{if(animation==='Attack')setAnimation('Idle');});
  setAnimation('Idle');document.querySelector('#loading').remove();document.body.dataset.ready='true';
},undefined,error=>{console.error(error);document.querySelector('#loading').innerHTML='<strong>Не удалось загрузить модель</strong><small>Обнови страницу, чтобы повторить загрузку.</small>';});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{controls.autoRotate=false;document.querySelector('#rotate').setAttribute('aria-pressed','false');setView(b.dataset.view);}));
document.querySelectorAll('[data-animation]').forEach(b=>b.addEventListener('click',()=>setAnimation(b.dataset.animation)));
document.querySelector('#rotate').addEventListener('click',e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));});
document.querySelector('#wireframe').addEventListener('click',e=>{const enabled=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(enabled));model?.traverse(o=>{if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.wireframe=enabled;});});
document.querySelector('#clay').addEventListener('click',e=>{const enabled=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(enabled));model?.traverse(o=>{if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material]){mat.color.copy(enabled?new THREE.Color('#b9c9ca'):mat.userData.originalColor);mat.metalness=enabled?0:mat.userData.originalMetalness;mat.map=enabled?null:mat.userData.originalMap;mat.needsUpdate=true;}});});
let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.05);previous=now;if(!document.hidden){mixer?.update(dt);controls.update(dt);renderer.render(scene,camera);}});
new ResizeObserver(resize).observe(viewport);resize();
